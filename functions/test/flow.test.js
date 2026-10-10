// Smoke-tests index.js business flows with in-memory fakes (no network, no real Firebase).
const Module = require("module"); const assert = require("assert"); const crypto = require("crypto");
const store = {}; // path -> data
const DEL = { __del: 1 }, TS = { __ts: 1 };
const inc = (n) => ({ __inc: n });
const setPath = (o, path, v) => { const k = path.split("."); let c = o; k.slice(0, -1).forEach((p) => (c = c[p] ||= {})); const last = k.at(-1);
  if (v === DEL) delete c[last]; else if (v && v.__inc !== undefined) c[last] = (c[last] || 0) + v.__inc; else if (v === TS) c[last] = { toMillis: () => 1 }; else c[last] = v; };
const apply = (cur, upd) => { const o = JSON.parse(JSON.stringify(cur || {})); for (const [k, v] of Object.entries(upd)) setPath(o, k, v); return o; };
const snap = (p) => ({ exists: p in store, data: () => JSON.parse(JSON.stringify(store[p])), id: p.split("/").pop(), ref: docRef(p) });
const docRef = (p) => ({ path: p, id: p.split("/").pop(), get: async () => snap(p),
  set: async (d, o) => { store[p] = o && o.merge ? apply(store[p], d) : apply({}, d); },
  update: async (d) => { if (!(p in store)) throw new Error("no doc " + p); store[p] = apply(store[p], d); } });
let n = 0;
const fakeDb = { doc: docRef, collection: (c) => ({ doc: (id) => docRef(`${c}/${id || "auto" + ++n}`), add: async (d) => { store[`${c}/ev${++n}`] = apply({}, d); } }),
  runTransaction: async (fn) => fn({ get: async (r) => r.get(), set: (r, d) => { store[r.path] = apply({}, d); }, update: (r, d) => { store[r.path] = apply(store[r.path], d); } }) };
const fsFn = () => fakeDb; fsFn.FieldValue = { serverTimestamp: () => TS, increment: inc, delete: () => DEL };
class HttpsError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const handlers = {};
const stubs = {
  "firebase-functions/v2/https": { onCall: (o, f) => f, onRequest: (o, f) => f, HttpsError },
  "firebase-functions/params": { defineSecret: (n) => ({ value: () => "secret" }), defineString: (n) => ({ value: () => (n === "ADMIN_UIDS" ? "adm1" : "rzp_key") }) },
  "firebase-admin": { initializeApp() {}, firestore: Object.assign(fsFn, {}), auth: () => ({ updateUser: async () => {}, revokeRefreshTokens: async () => {} }) },
  razorpay: class { constructor() { this.orders = { create: async (o) => ({ id: "order_" + ++n, ...o }) };
    this.payments = { fetch: async (id) => ({ id, order_id: global.__order, status: "captured", amount: global.__amt, currency: "INR", method: "upi" }), refund: async () => ({ id: "rfnd_1" }) }; } },
};
const origLoad = Module._load; Module._load = function (r, ...a) { return stubs[r] || origLoad.call(this, r, ...a); };
const fn = require("../index.js");
const req = (uid, data) => ({ auth: { uid, token: { email: uid + "@x.com" } }, data });
const code = async (p) => { try { await p; return "OK"; } catch (e) { return e.code + ":" + e.message; } };

(async () => {
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
  assert.strictEqual((await fn.adminRefund(req("adm1", { paymentId: o.orderId, note: "ok" }))).refundId, "rfnd_1");
  assert.strictEqual(store[`payments/${o.orderId}`].status, "refunded");
  assert.strictEqual(store[`payments/${o.orderId}`].refundRequest.status, "approved");
  assert.strictEqual(store["entitlements/u1"].all, null);
  assert.match(await code(fn.createWish(req("u1", wish))), /NO_ENTITLEMENT/);
  assert.match(await code(fn.adminRefund(req("adm1", { paymentId: o.orderId }))), /Only paid/); // no double refund

  // 7) suspend blocks everything; admin can't be suspended
  await fn.adminSetSuspended(req("adm1", { uid: "u1", suspended: true, reason: "bypass" }));
  assert.match(await code(fn.createOrder(req("u1", { plan: "all" }))), /SUSPENDED/);
  assert.match(await code(fn.adminSetSuspended(req("adm1", { uid: "adm1", suspended: true }))), /Cannot suspend an admin/);
  console.log("ALL FLOW TESTS PASSED");
})().catch((e) => { console.error("FLOW TEST FAILED:", e); process.exit(1); });
