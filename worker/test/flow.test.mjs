// Flow tests for the Cloudflare Worker (dist/worker.js) with in-memory fakes: no network, no real Firebase/Razorpay.
import assert from "node:assert"; import crypto from "node:crypto";
const store = {}; // path -> data
const DEL = { __del: 1 }, TS = { __ts: 1 };
const setPath = (o, path, v) => { const k = path.split("."); let c = o; k.slice(0, -1).forEach((p) => (c = c[p] ||= {})); const last = k.at(-1);
  if (v && v.__fv === "del") delete c[last]; else if (v && v.__fv === "inc") c[last] = (c[last] || 0) + v.n; else if (v && v.__fv === "ts") c[last] = { toMillis: () => 1 }; else c[last] = v; };
const apply = (cur, upd) => { const o = JSON.parse(JSON.stringify(cur || {})); for (const [k, v] of Object.entries(upd)) setPath(o, k, v); return o; };
const snap = (p) => ({ exists: p in store, data: () => JSON.parse(JSON.stringify(store[p])), id: p.split("/").pop(), ref: docRef(p) });
const docRef = (p) => ({ path: p, id: p.split("/").pop(), get: async () => snap(p),
  set: async (d, o) => { store[p] = o && o.merge ? apply(store[p], d) : apply({}, d); },
  update: async (d) => { if (!(p in store)) throw new Error("no doc " + p); store[p] = apply(store[p], d); },
  delete: async () => { delete store[p]; } });
let n = 0;
const q = (c, f, v, lim) => { const docs = Object.keys(store).filter((k) => k.startsWith(c + "/") && (!f || store[k][f] === v)).slice(0, lim || 1e9).map(snap); return { docs, empty: !docs.length }; };
const mkQ = (c, f, v, lim) => ({ get: async () => q(c, f, v, lim), where: (ff, _o, vv) => mkQ(c, ff, vv, lim), orderBy: () => mkQ(c, f, v, lim), limit: (l) => mkQ(c, f, v, l),
  doc: (id) => docRef(`${c}/${id || "auto" + ++n}`), add: async (d) => { store[`${c}/ev${++n}`] = apply({}, d); } });
const fakeDb = { doc: docRef, collection: (c) => mkQ(c),
  batch: () => { const ops = []; return { set: (r, d, o) => ops.push(() => r.set(d, o)), commit: async () => { for (const f of ops) await f(); } }; },
  runTransaction: async (fn) => fn({ get: async (r) => r.get(), set: (r, d) => { store[r.path] = apply({}, d); }, update: (r, d) => { store[r.path] = apply(store[r.path], d); } }) };
const fakeAuth = { deleteUser: async (uid) => { (global.__deleted ||= []).push(uid); }, updateUser: async () => {}, revokeRefreshTokens: async () => {},
  getUser: async (uid) => ({ uid, email: uid + "@x.com" }),
  getUserByEmail: async (e) => (e.startsWith("ghost") ? null : { uid: e.split("@")[0], email: e }),
  listUsers: async () => Object.keys(store).filter((k) => k.startsWith("users/")).map((k) => ({ uid: k.slice(6), email: k.slice(6) + "@x.com", createdAt: 1, lastSignIn: 2 })) };
const fakeRzp = { orders: { create: async (o) => ({ id: "order_" + ++n, ...o }), fetchPayments: async () => ({ items: [] }) },
  payments: { fetch: async (id) => ({ id, order_id: global.__order, status: "captured", amount: global.__amt, currency: "INR", method: "upi" }), capture: async () => ({}), refund: async () => ({ id: "rfnd_1" }) } };
const env = { RAZORPAY_KEY_ID: "rzp_key", RAZORPAY_KEY_SECRET: "secret", RAZORPAY_WEBHOOK_SECRET: "whsec", OWNER_EMAIL: "owner@x.com",
  __DB: fakeDb, __AUTH: fakeAuth, __RZP: fakeRzp,
  __VERIFY: (t) => { const [uid, prov, ver] = t.split("|"); return { sub: uid, email: uid + "@x.com", email_verified: ver !== "no", firebase: { sign_in_provider: prov } }; } };
const worker = (await import("../dist/worker.js")).default;
const SITE = "https://wishverse.surajfx.in";
class HttpsError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const req = (uid, data, prov = "google.com") => ({ uid, data, prov });
async function post(name, r) {
  const res = await worker.fetch(new Request("https://api.dev/" + name, { method: "POST", headers: { Origin: SITE, "Content-Type": "application/json",
    ...(r.uid ? { Authorization: `Bearer ${r.uid}|${r.prov || "google.com"}|${r.verified === false ? "no" : "yes"}` } : {}) }, body: JSON.stringify(r.data || {}) }), env);
  const j = await res.json();
  if (j.error) throw new HttpsError(j.error.code, j.error.message);
  return j.result;
}
const fn = new Proxy({}, { get: (_t, name) => (r) => post(name, r) });
const code = async (p) => { try { await p; return "OK"; } catch (e) { return e.code + ":" + e.message; } };

await (async () => {
  // 1) no payment -> cannot create wish; event logged
  const wish = { templateId: "miss", from: "A", to: "B", message: "hi" };
  assert.match(await code(fn.createWish(req("u1", wish))), /failed-precondition:NO_ENTITLEMENT/);
  assert(Object.keys(store).some((k) => k.startsWith("securityEvents/")), "bypass attempt must be logged");

  // 2) buy ₹99 -> verify with wrong signature rejected & logged
  const o = await fn.createOrder(req("u1", { plan: "all" })); assert.strictEqual(o.amount, 9900);
  global.__order = o.orderId; global.__amt = 9900;
  assert.match(await code(fn.verifyPayment(req("u1", { razorpay_order_id: o.orderId, razorpay_payment_id: "pay_1", razorpay_signature: "bad" }))), /permission-denied/);
  assert.strictEqual(store[`payments/${o.orderId}`].status, "created");
  // another user cannot verify u1's order
  assert.match(await code(fn.verifyPayment(req("u2", { razorpay_order_id: o.orderId, razorpay_payment_id: "pay_1", razorpay_signature: "x" }))), /not-found/);
  // correct signature -> paid + entitlement
  const sig = crypto.createHmac("sha256", "secret").update(`${o.orderId}|pay_1`).digest("hex");
  assert.strictEqual((await fn.verifyPayment(req("u1", { razorpay_order_id: o.orderId, razorpay_payment_id: "pay_1", razorpay_signature: sig }))).ok, true);
  assert.strictEqual(store[`payments/${o.orderId}`].status, "paid"); assert(store["entitlements/u1"].all);
  // idempotent
  assert.strictEqual((await fn.verifyPayment(req("u1", { razorpay_order_id: o.orderId, razorpay_payment_id: "pay_1", razorpay_signature: sig }))).ok, true);
  // already owns -> cannot buy again
  assert.match(await code(fn.createOrder(req("u1", { plan: "single", cardId: "miss" }))), /failed-precondition/);

  // 3) 7 uses per card, 8th blocked, other card unaffected
  for (let i = 0; i < 7; i++) await fn.createWish(req("u1", wish));
  assert.match(await code(fn.createWish(req("u1", wish))), /resource-exhausted:LIMIT_REACHED/);
  assert.strictEqual((await fn.createWish(req("u1", { ...wish, templateId: "birthday" }))).id.length > 0, true);
  assert.strictEqual(store["entitlements/u1"].usage.miss, 7); assert.strictEqual(store["entitlements/u1"].usage.birthday, 1);

  // 4) amount mismatch => not fulfilled
  const o2 = await fn.createOrder(req("u3", { plan: "single", cardId: "miss" })); global.__order = o2.orderId; global.__amt = 100;
  const sig2 = crypto.createHmac("sha256", "secret").update(`${o2.orderId}|pay_2`).digest("hex");
  assert.match(await code(fn.verifyPayment(req("u3", { razorpay_order_id: o2.orderId, razorpay_payment_id: "pay_2", razorpay_signature: sig2 }))), /AMOUNT_MISMATCH/);
  assert(!store["entitlements/u3"]);

  // 5) refund report: once only, <=100 words
  assert.match(await code(fn.requestRefund(req("u1", { paymentId: o.orderId, message: Array(101).fill("w").join(" ") }))), /invalid-argument/);
  assert.strictEqual((await fn.requestRefund(req("u1", { paymentId: o.orderId, message: "Card did not work for me" }))).ok, true);
  assert.match(await code(fn.requestRefund(req("u1", { paymentId: o.orderId, message: "Second try please" }))), /already-exists/);
  assert.strictEqual(store[`payments/${o.orderId}`].refundRequest.usageAtRequest, 8);
  assert.match(await code(fn.requestRefund(req("u2", { paymentId: o.orderId, message: "not my payment" }))), /not-found/);

  // 6) admin only; refund revokes plan
  assert.match(await code(fn.adminRefund(req("u1", { paymentId: o.orderId }))), /permission-denied/);
  assert.strictEqual((await fn.adminRefund(req("owner", { paymentId: o.orderId, note: "ok" }))).refundId, "rfnd_1");
  assert.strictEqual(store[`payments/${o.orderId}`].status, "refunded");
  assert.strictEqual(store[`payments/${o.orderId}`].refundRequest.status, "approved");
  assert.strictEqual(store["entitlements/u1"].all, null);
  assert.match(await code(fn.createWish(req("u1", wish))), /NO_ENTITLEMENT/);
  assert.match(await code(fn.adminRefund(req("owner", { paymentId: o.orderId }))), /Only paid/); // no double refund

  // 7) suspend blocks everything; admin can't be suspended
  await fn.adminSetSuspended(req("owner", { uid: "u1", suspended: true, reason: "bypass" }));
  assert.match(await code(fn.createOrder(req("u1", { plan: "all" }))), /SUSPENDED/);
  assert.match(await code(fn.adminSetSuspended(req("owner", { uid: "owner", suspended: true }))), /Cannot suspend an admin/);
  // ---- 8) Google-only login ----
  assert.match(await code(fn.createOrder(req("u9", { plan: "all" }, "password"))), /GOOGLE_LOGIN_REQUIRED/);
  assert.match(await code(fn.getMyAccount({ uid: "u9", data: {}, verified: false })), /GOOGLE_LOGIN_REQUIRED/);

  // ---- 9) owner: free + unlimited, cannot buy ----
  for (let i = 0; i < 12; i++) await fn.createWish(req("owner", wish));
  assert(!store["entitlements/owner"], "owner usage must not be tracked");
  assert.match(await code(fn.createOrder(req("owner", { plan: "all" }))), /free access/);
  const me = await fn.getMyAccount(req("owner", {})); assert(me.isAdmin && me.isOwner);

  // ---- 10) owner appoints admins; others cannot ----
  assert.match(await code(fn.adminAddAdmin(req("u2", { email: "helper@x.com" }))), /Owner only/);
  assert.match(await code(fn.adminAddAdmin(req("owner", { email: "not-an-email" }))), /invalid-argument/);
  await fn.adminAddAdmin(req("owner", { email: "Helper@x.com" }));
  assert(store["admins/helper@x.com"]);
  assert.match(await code(fn.adminAddAdmin(req("helper", { email: "z@x.com" }))), /Owner only/); // admins can't appoint admins
  assert.strictEqual((await fn.adminCheck(req("helper", {}))).isAdmin, true);
  assert.strictEqual((await fn.adminCheck(req("u2", {}))).isAdmin, false);
  for (let i = 0; i < 9; i++) await fn.createWish(req("helper", wish)); // admins are free too
  assert.match(await code(fn.adminRemoveAdmin(req("owner", { email: "owner@x.com" }))), /Owner cannot/);

  // ---- 11) grant plan free (existing user) -> works, shows as granted, revocable ----
  assert.match(await code(fn.adminGrantPlan(req("u2", { email: "u5@x.com", plan: "all" }))), /Admins only/);
  assert.match(await code(fn.adminGrantPlan(req("helper", { email: "u5@x.com", plan: "single" }))), /Choose a card/);
  assert.strictEqual((await fn.adminGrantPlan(req("helper", { email: "u5@x.com", plan: "single", cardId: "sorry", note: "friend" }))).status, "granted");
  assert.strictEqual((await fn.createWish(req("u5", { ...wish, templateId: "sorry" }))).id.length > 0, true);
  assert.match(await code(fn.createWish(req("u5", wish))), /NO_ENTITLEMENT/); // only the granted card
  const gid = Object.keys(store).find((k) => k.startsWith("payments/grant_")).split("/")[1];
  assert.strictEqual(store[`payments/${gid}`].status, "granted"); assert.strictEqual(store[`payments/${gid}`].amount, 0);
  assert.match(await code(fn.adminRefund(req("helper", { paymentId: gid }))), /Only paid/); // grants never hit Razorpay
  await fn.adminRevokeGrant(req("helper", { paymentId: gid }));
  assert.match(await code(fn.createWish(req("u5", { ...wish, templateId: "sorry" }))), /NO_ENTITLEMENT/);

  // ---- 12) grant to someone who has not signed up yet -> pending, applied at first login ----
  assert.strictEqual((await fn.adminGrantPlan(req("owner", { email: "ghost1@x.com", plan: "all" }))).status, "pending");
  assert((await fn.adminListPending(req("owner", {}))).pending.some((p) => p.email === "ghost1@x.com"));
  const acc = await fn.getMyAccount(req("ghost1", {}));
  assert.strictEqual(acc.all, true); assert(!store["pendingGrants/ghost1@x.com"]);

  // ---- 13) price control ----
  assert.match(await code(fn.adminSetPricing(req("u2", { single: 10, all: 20 }))), /Admins only/);
  assert.match(await code(fn.adminSetPricing(req("owner", { single: 0, all: 99 }))), /invalid-argument/);
  assert.match(await code(fn.adminSetPricing(req("owner", { single: 10, all: "abc" }))), /invalid-argument/);
  let pr = await fn.getPricing({}); assert.strictEqual(pr.single.amount, 3500);
  await fn.adminSetPricing(req("helper", { single: 19, singleOld: 299, all: 149.5, allOld: "" }));
  pr = await fn.getPricing({});
  assert.deepStrictEqual(pr, { single: { amount: 1900, old: 29900 }, all: { amount: 14950, old: 0 } });
  const o3 = await fn.createOrder(req("u7", { plan: "all" })); assert.strictEqual(o3.amount, 14950);
  assert.strictEqual(store[`payments/${o3.orderId}`].amount, 14950);

  // ---- 14) admins/owner cannot be suspended; normal users can ----
  assert.match(await code(fn.adminSetSuspended(req("helper", { uid: "owner", suspended: true }))), /Cannot suspend an admin/);
  assert.match(await code(fn.adminSetSuspended(req("owner", { uid: "helper", suspended: true }))), /Cannot suspend an admin/);
  await fn.adminSetSuspended(req("helper", { uid: "u7", suspended: true, reason: "x" }));
  assert.match(await code(fn.createOrder(req("u7", { plan: "all" }))), /SUSPENDED/);
  await fn.adminSetSuspended(req("helper", { uid: "u7", suspended: false }));
  assert.strictEqual((await fn.createOrder(req("u7", { plan: "single", cardId: "miss" }))).amount, 1900);

  // ---- 15) account page data: wishes + share base ----
  const accU = await fn.getMyAccount(req("helper", {}));
  assert(accU.wishes.length >= 9 && accU.wishes[0].id && accU.shareBase === "https://api.dev/wishShare");
  const cw = await fn.createWish(req("helper", { ...wish, to: "Riya <b>", from: "Sam" }));
  assert(cw.shareUrl === "https://api.dev/s/" + cw.id);

  // ---- 16) share preview page: OG tags, escaped, generic for unknown ids ----
  const realId = "AbCdEfGhIj1234567890"; store["wishes/" + realId] = store["wishes/" + cw.id];
  let r1 = await worker.fetch(new Request("https://api.dev/s/" + realId), env); const b1 = await r1.text();
  assert.strictEqual(r1.status, 200);
  assert(b1.includes('property="og:title" content="Miss You for Riya &lt;b&gt; 💌 | WishVerse"'), "title escaped");
  assert(b1.includes("/share-img/miss.jpg") && b1.includes("og:image:width") && b1.includes("?wish=" + realId) && !b1.includes("<b>"));
  let r1b = await worker.fetch(new Request("https://api.dev/wishShare?id=" + realId), env); assert.strictEqual(r1b.status, 200);
  let r2 = await worker.fetch(new Request("https://api.dev/s/doesNotExist12345"), env); assert.strictEqual(r2.status, 404); assert((await r2.text()).includes("share-img/default.jpg"));
  let r3 = await worker.fetch(new Request("https://api.dev/s/..%2F..%2Fetc"), env); assert.strictEqual(r3.status, 302);

  // ---- 17) delete account ----
  assert.match(await code(fn.deleteMyAccount(req("u8", {}))), /invalid-argument/);
  assert.match(await code(fn.deleteMyAccount(req("owner", { confirm: "DELETE" }))), /owner account/);
  await fn.adminSetSuspended(req("owner", { uid: "u2", suspended: true, reason: "x" }));
  assert.match(await code(fn.deleteMyAccount(req("u2", { confirm: "DELETE" }))), /SUSPENDED/);
  await fn.adminSetSuspended(req("owner", { uid: "u2", suspended: false }));
  const op = await fn.createOrder(req("u10", { plan: "single", cardId: "miss" })); global.__order = op.orderId; global.__amt = op.amount;
  const sp = crypto.createHmac("sha256", "secret").update(`${op.orderId}|pay_10`).digest("hex");
  await fn.verifyPayment(req("u10", { razorpay_order_id: op.orderId, razorpay_payment_id: "pay_10", razorpay_signature: sp }));
  await fn.createWish(req("u10", { ...wish, to: "Z" }));
  await fn.requestRefund(req("u10", { paymentId: op.orderId, message: "please check this" }));
  assert.match(await code(fn.deleteMyAccount(req("u10", { confirm: "DELETE" }))), /REFUND_PENDING/);
  store[`payments/${op.orderId}`].refundRequest.status = "rejected";
  const del = await fn.deleteMyAccount(req("u10", { confirm: "DELETE" }));
  assert.strictEqual(del.wishesDeleted, 1);
  assert(!store["entitlements/u10"] && !store["users/u10"]);
  assert(!Object.keys(store).some((k) => k.startsWith("wishes/") && store[k].ownerUid === "u10"), "wishes removed");
  assert(store[`payments/${op.orderId}`], "payment record kept");
  assert((global.__deleted || []).includes("u10"));

  // ---- 18) worker-only: no token, CORS, webhook signature, unknown endpoint, admin lists ----
  assert.match(await code(post("getMyAccount", { data: {} })), /unauthenticated/);
  assert.match(await code(post("nope", { uid: "owner" })), /not-found/);
  const pre = await worker.fetch(new Request("https://api.dev/createOrder", { method: "OPTIONS", headers: { Origin: SITE } }), env);
  assert.strictEqual(pre.status, 204); assert.strictEqual(pre.headers.get("Access-Control-Allow-Origin"), SITE);
  const evil = await worker.fetch(new Request("https://api.dev/getPricing", { method: "POST", headers: { Origin: "https://evil.example" }, body: "{}" }), env);
  assert.strictEqual(evil.headers.get("Access-Control-Allow-Origin"), null, "other sites get no CORS");
  const wb = (body, sig) => worker.fetch(new Request("https://api.dev/razorpayWebhook", { method: "POST", headers: { "X-Razorpay-Signature": sig }, body }), env);
  assert.strictEqual((await wb("{}", "bad")).status, 400);
  const oc = await fn.createOrder(req("u11", { plan: "all" })); const amt = oc.amount;
  const evBody = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_w", order_id: oc.orderId, amount: amt, currency: "INR", method: "card" } } } });
  const wsig = crypto.createHmac("sha256", "whsec").update(evBody).digest("hex");
  assert.strictEqual((await wb(evBody, wsig)).status, 200);
  assert.strictEqual(store[`payments/${oc.orderId}`].status, "paid"); assert(store["entitlements/u11"].all);
  assert.strictEqual((await wb(evBody, wsig)).status, 200); // replay is harmless
  const ov = await fn.adminOverview(req("owner", {})); assert(ov.paid >= 2 && ov.totalOrders >= 3);
  assert((await fn.adminListPayments(req("owner", {}))).payments.length > 0);
  assert((await fn.adminListUsers(req("owner", {}))).users.some((u) => u.uid === "u11"));
  assert.match(await code(fn.adminOverview(req("u11", {}))), /Admins only/);
  console.log("ALL WORKER FLOW TESTS PASSED");
})().catch((e) => { console.error("WORKER FLOW TEST FAILED:", e); process.exit(1); });
