// Checks the Firestore REST layer (encoding, update masks, transforms, transactions, queries) against a tiny mock of Firestore's REST API.
import assert from "node:assert"; import crypto from "node:crypto";
const docs = {}; // "col/id" -> decoded plain object (timestamps as {__ts:ms})
const dec = (v) => ("nullValue" in v ? null : "booleanValue" in v ? v.booleanValue : "integerValue" in v ? Number(v.integerValue) : "doubleValue" in v ? v.doubleValue :
  "stringValue" in v ? v.stringValue : "timestampValue" in v ? { __ts: Date.parse(v.timestampValue) } : "arrayValue" in v ? (v.arrayValue.values || []).map(dec) : Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, dec(x)])));
const enc = (v) => v === null ? { nullValue: null } : typeof v === "boolean" ? { booleanValue: v } : typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) :
  typeof v === "string" ? { stringValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } } : v.__ts !== undefined ? { timestampValue: new Date(v.__ts).toISOString() } : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
const parsePath = (s) => { const out = []; let cur = "", q = false; for (let i = 0; i < s.length; i++) { const ch = s[i]; if (ch === "`") q = !q; else if (ch === "\\" && q) cur += s[++i]; else if (ch === "." && !q) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out; };
const getP = (o, p) => p.reduce((c, k) => (c == null ? c : c[k]), o);
const setP = (o, p, v) => { let c = o; for (const k of p.slice(0, -1)) c = c[k] = c[k] && typeof c[k] === "object" ? c[k] : {}; c[p.at(-1)] = v; };
const delP = (o, p) => { const c = getP(o, p.slice(0, -1)); if (c) delete c[p.at(-1)]; };
const ROOT = "projects/p1/databases/(default)/documents/";
const txs = new Set(); let calls = 0;
function applyWrite(w) {
  if (w.delete) { delete docs[w.delete.slice(ROOT.length)]; return; }
  const path = w.update.name.slice(ROOT.length); const exists = path in docs;
  if (w.currentDocument && w.currentDocument.exists && !exists) { const e = new Error("NOT_FOUND"); e.http = 404; throw e; }
  const fields = dec({ mapValue: { fields: w.update.fields } });
  let cur = w.updateMask ? JSON.parse(JSON.stringify(docs[path] || {})) : {};
  if (w.updateMask) { for (const m of w.updateMask.fieldPaths) { const p = parsePath(m), v = getP(fields, p); if (v === undefined) delP(cur, p); else setP(cur, p, v); } }
  else cur = fields;
  for (const t of w.updateTransforms || []) { const p = parsePath(t.fieldPath); if (t.setToServerValue) setP(cur, p, { __ts: 1700000000000 }); else setP(cur, p, (getP(cur, p) || 0) + Number(t.increment.integerValue)); }
  docs[path] = cur;
}
globalThis.fetch = async (url, init = {}) => {
  url = String(url); calls++;
  const ok = (j) => new Response(JSON.stringify(j), { status: 200 });
  const m = url.match(/documents(.*)$/); if (!m) throw new Error("unexpected fetch " + url);
  const rest = decodeURIComponent(m[1]); const body = init.body ? JSON.parse(init.body) : null;
  if (rest.startsWith(":beginTransaction")) { const id = "tx" + txs.size; txs.add(id); return ok({ transaction: id }); }
  if (rest.startsWith(":rollback")) return ok({});
  if (rest.startsWith(":commit")) { try { body.writes.forEach(applyWrite); } catch (e) { return new Response(JSON.stringify({ error: { message: e.message } }), { status: e.http || 400 }); } return ok({}); }
  if (rest.startsWith(":runQuery")) {
    const sq = body.structuredQuery, c = sq.from[0].collectionId;
    let rows = Object.keys(docs).filter((k) => k.split("/").length === 2 && k.startsWith(c + "/")).map((k) => [k, docs[k]]);
    if (sq.where) { const f = sq.where.fieldFilter; const want = dec(f.value); rows = rows.filter(([, d]) => d[f.field.fieldPath] === want); }
    if (sq.orderBy) rows = rows.filter(([, d]) => d[sq.orderBy[0].field.fieldPath] !== undefined);
    if (sq.limit) rows = rows.slice(0, sq.limit);
    return ok(rows.length ? rows.map(([k, d]) => ({ document: { name: ROOT + k.split("/").map(encodeURIComponent).join("/"), fields: enc(d).mapValue.fields } })) : [{ readTime: "x" }]);
  }
  const path = rest.replace(/^\//, "").replace(/\?.*$/, "");
  if (!(path in docs)) return new Response(JSON.stringify({ error: { message: "not found" } }), { status: 404 });
  return ok({ name: ROOT + path, fields: enc(docs[path]).mapValue.fields });
};
const AUTH = { deleteUser: async () => {}, updateUser: async () => {}, revokeRefreshTokens: async () => {}, getUser: async (u) => ({ uid: u, email: u + "@x.com" }), getUserByEmail: async () => null, listUsers: async () => [] };
const RZP = { orders: { create: async (o) => ({ id: "order_1", ...o }) }, payments: { fetch: async (id) => ({ id, order_id: "order_1", status: "captured", amount: 3500, currency: "INR", method: "upi" }) } };
const env = { FIREBASE_PROJECT_ID: "p1", __TEST_TOKEN: "t", RAZORPAY_KEY_ID: "k", RAZORPAY_KEY_SECRET: "secret", OWNER_EMAIL: "owner@x.com", __AUTH: AUTH, __RZP: RZP,
  __VERIFY: (t) => ({ sub: t, email: t + "@x.com", email_verified: true, firebase: { sign_in_provider: "google.com" } }) };
const worker = (await import("../dist/worker.js")).default;
const post = async (name, uid, data = {}) => { const r = await worker.fetch(new Request("https://api.dev/" + name, { method: "POST", headers: { Authorization: "Bearer " + uid }, body: JSON.stringify(data) }), env); const j = await r.json(); if (j.error) throw new Error(j.error.code + ":" + j.error.message); return j.result; };
const fails = async (p) => { try { await p; return "OK"; } catch (e) { return e.message; } };

const o = await post("createOrder", "u1", { plan: "single", cardId: "long-distance" });
assert.strictEqual(o.amount, 3500); assert.strictEqual(docs["payments/order_1"].status, "created");
assert(docs["users/u1"].lastSeen.__ts && docs["users/u1"].email === "u1@x.com", "merge-set keeps fields + server timestamp");
const sig = crypto.createHmac("sha256", "secret").update("order_1|pay_1").digest("hex");
await post("verifyPayment", "u1", { razorpay_order_id: "order_1", razorpay_payment_id: "pay_1", razorpay_signature: sig });
assert.strictEqual(docs["payments/order_1"].status, "paid"); assert.strictEqual(docs["payments/order_1"].error, undefined);
assert(docs["entitlements/u1"].cards["long-distance"], "hyphenated card id stored through the mask");
const wish = { templateId: "long-distance", from: "A", to: "B", message: "hi" };
for (let i = 0; i < 7; i++) await post("createWish", "u1", wish);
assert.strictEqual(docs["entitlements/u1"].usage["long-distance"], 7);
assert.match(await fails(post("createWish", "u1", wish)), /resource-exhausted:LIMIT_REACHED/);
assert.strictEqual(Object.keys(docs).filter((k) => k.startsWith("wishes/")).length, 7);
await post("requestRefund", "u1", { paymentId: "order_1", message: "this did not work" });
assert.strictEqual(docs["payments/order_1"].refundRequest.status, "pending"); assert.strictEqual(docs["payments/order_1"].refundRequest.usageAtRequest, 7);
const acc = await post("getMyAccount", "u1");
assert(acc.wishes.length === 7 && acc.payments.length === 1 && acc.cards[0] === "long-distance" && acc.usage["long-distance"] === 7);
// admin touches dotted + transform update paths
docs["admins/boss@x.com"] = { addedBy: "owner@x.com" };
await post("adminRejectRefund", "owner", { paymentId: "order_1", note: "no" });
assert.strictEqual(docs["payments/order_1"].refundRequest.status, "rejected"); assert(docs["payments/order_1"].refundRequest.message, "siblings kept");
assert.strictEqual(docs["payments/order_1"].status, "paid");
await post("adminSetPricing", "owner", { single: 19, singleOld: 299, all: 99, allOld: "" });
assert.deepStrictEqual((await post("getPricing", "")).single, { amount: 1900, old: 29900 });
await post("adminSetSuspended", "owner", { uid: "u1", suspended: true, reason: "x" });
assert.strictEqual(docs["users/u1"].suspended, true); assert(docs["users/u1"].email === "u1@x.com", "suspend merge keeps email");
assert.match(await fails(post("createOrder", "u1", { plan: "all" })), /SUSPENDED/);
await post("adminSetSuspended", "owner", { uid: "u1", suspended: false });
await post("deleteMyAccount", "u1", { confirm: "DELETE" });
assert(!docs["users/u1"] && !docs["entitlements/u1"] && Object.keys(docs).filter((k) => k.startsWith("wishes/")).length === 0 && docs["payments/order_1"]);
console.log("ALL REST LAYER TESTS PASSED (" + calls + " mock Firestore calls)");
