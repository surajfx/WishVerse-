const assert = require("assert");
const crypto = require("crypto");
const L = require("../lib");
const sec = "s3cret";

// checkout signature
const sig = crypto.createHmac("sha256", sec).update("order_1|pay_1").digest("hex");
assert(L.verifyCheckoutSignature(sec, "order_1", "pay_1", sig));
assert(!L.verifyCheckoutSignature(sec, "order_1", "pay_2", sig));
assert(!L.verifyCheckoutSignature(sec, "order_1", "pay_1", "abc"));
assert(!L.verifyCheckoutSignature(sec, "order_1", "pay_1", undefined));
// webhook signature
const body = Buffer.from('{"event":"payment.captured"}');
const ws = crypto.createHmac("sha256", sec).update(body).digest("hex");
assert(L.verifyWebhookSignature(sec, body, ws));
assert(!L.verifyWebhookSignature(sec, Buffer.from("{}"), ws));

// refund message: 3..100 words
assert(!L.validateRefundMessage("hi there").ok);
assert(L.validateRefundMessage("I was charged twice").ok);
assert(L.validateRefundMessage(Array(100).fill("w").join(" ")).ok);
assert(!L.validateRefundMessage(Array(101).fill("w").join(" ")).ok);
assert(!L.validateRefundMessage("   ").ok);

// entitlement
assert.strictEqual(L.checkEntitlement(null, "birthday").reason, "NO_ENTITLEMENT");
assert(L.checkEntitlement({ all: { paymentId: "x" } }, "birthday").ok);
assert(L.checkEntitlement({ all: null, cards: { birthday: {} } }, "birthday").ok);
assert.strictEqual(L.checkEntitlement({ all: null, cards: { birthday: {} } }, "miss").reason, "NO_ENTITLEMENT");
assert.strictEqual(L.checkEntitlement({ all: {}, usage: { miss: 7 } }, "miss").reason, "LIMIT_REACHED");
assert(L.checkEntitlement({ all: {}, usage: { miss: 6, birthday: 7 } }, "miss").ok); // per-card allowance

// wish sanitizing
assert.strictEqual(L.sanitizeWish({ templateId: "hack", from: "a", to: "b", message: "c" }), null);
assert.strictEqual(L.sanitizeWish({ templateId: "miss", from: "", to: "b", message: "c" }), null);
const w = L.sanitizeWish({ templateId: "miss", templateTitle: "EVIL", category: "EVIL", from: "A", to: "B", message: "M",
  imageUrls: ["https://res.cloudinary.com/x/1.jpg", "https://evil.com/x.jpg"], ownerUid: "spoof", isPaid: true });
assert.strictEqual(w.templateTitle, "Miss You");
assert.deepStrictEqual(w.imageUrls, ["https://res.cloudinary.com/x/1.jpg"]);
assert(!("ownerUid" in w) && !("isPaid" in w));
assert.strictEqual(L.sanitizeWish({ templateId: "miss", from: "A", to: "B", message: "x".repeat(9999) }).message.length, 3000);
assert.strictEqual(L.PLANS.all.amount, 9900); assert.strictEqual(L.PLANS.single.amount, 3500);
// pricing normalisation (rupees in, paise out)
assert.deepStrictEqual(L.normalizePricing({ single: 35, singleOld: 299, all: 99, allOld: 999 }).value, { single: { amount: 3500, old: 29900 }, all: { amount: 9900, old: 99900 } });
assert.strictEqual(L.normalizePricing({ single: 35, singleOld: 20, all: 99 }).value.single.old, 0); // old <= price hides the strike
assert(!L.normalizePricing({ single: 0.5, all: 99 }).ok); assert(!L.normalizePricing({ single: 35, all: 60000 }).ok); assert(!L.normalizePricing({}).ok);
assert(L.isEmail("a@b.co")); assert(!L.isEmail("a@b")); assert(!L.isEmail("x y@z.com"));
console.log("ALL LOGIC TESTS PASSED");
