// Pure helpers (no Firebase/Razorpay imports) so they can be unit-tested.
const crypto = require("crypto");

const PLANS = {
  single: { amount: 3500, label: "One Card (₹35)" },
  all: { amount: 9900, label: "All Cards Pass (₹99)" },
};
const USES_PER_CARD = 7;
// Defaults only; the live prices live in Firestore config/pricing (admin can change them).
const DEFAULT_PRICING = {
  single: { amount: 3500, old: 29900 },
  all: { amount: 9900, old: 99900 },
};
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || "").trim()) && String(e).length <= 254;

// Admin enters rupees; we store paise. old = crossed-out "MRP" (0 = hide).
function normalizePricing(inp) {
  inp = inp || {};
  const rs = (v) => (typeof v === "number" ? v : Number(v));
  const out = {};
  for (const [plan, k, ko] of [["single", "single", "singleOld"], ["all", "all", "allOld"]]) {
    const r = rs(inp[k]);
    if (!Number.isFinite(r) || r < 1 || r > 50000) return { ok: false, error: `${plan} price must be between ₹1 and ₹50,000.` };
    const amount = Math.round(r * 100);
    let old = inp[ko] === "" || inp[ko] == null ? 0 : Math.round(rs(inp[ko]) * 100);
    if (!Number.isFinite(old) || old < 0 || old > 5000000) return { ok: false, error: `${plan} old price is invalid.` };
    if (old <= amount) old = 0;
    out[plan] = { amount, old };
  }
  return { ok: true, value: out };
}

const CARDS = {
  "proposal": ["Proposal", "Love"],
  "girlfriend": ["Girlfriend Special", "Love"],
  "boyfriend": ["Boyfriend Special", "Love"],
  "long-distance": ["Long Distance Love", "Love"],
  "anniversary": ["Anniversary", "Love"],
  "love-letter": ["Love Letter", "Love"],
  "love-confession": ["Love Confession", "Love"],
  "miss": ["Miss You", "Emotion"],
  "sorry": ["Sorry", "Emotion"],
  "birthday": ["Birthday Surprise", "Celebration"],
  "best-friend": ["Best Friend Special", "Friendship"],
  "countdown": ["Countdown Until We Meet", "Love"],
  "good-morning": ["Good Morning", "Daily"],
  "good-night": ["Good Night", "Daily"],
  "raksha-bandhan": ["Raksha Bandhan", "Family"],
};

function hmacHex(secret, data) {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}
function safeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const A = Buffer.from(a, "utf8"), B = Buffer.from(b, "utf8");
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}
function verifyCheckoutSignature(secret, orderId, paymentId, signature) {
  return safeEqualHex(hmacHex(secret, `${orderId}|${paymentId}`), signature);
}
function verifyWebhookSignature(secret, rawBody, signature) {
  return safeEqualHex(hmacHex(secret, rawBody), signature);
}

function wordCount(s) {
  return String(s || "").trim().split(/\s+/).filter(Boolean).length;
}
function validateRefundMessage(msg) {
  const text = String(msg || "").trim();
  const n = wordCount(text);
  if (n < 3) return { ok: false, error: "Please write at least 3 words." };
  if (n > 100) return { ok: false, error: "Maximum 100 words allowed." };
  if (text.length > 1200) return { ok: false, error: "Message is too long." };
  return { ok: true, text, words: n };
}

// Does this entitlements doc allow creating a wish for cardId? Returns {ok, reason}.
function checkEntitlement(ent, cardId) {
  ent = ent || {};
  const owns = !!ent.all || !!(ent.cards && ent.cards[cardId]);
  if (!owns) return { ok: false, reason: "NO_ENTITLEMENT" };
  const used = (ent.usage && ent.usage[cardId]) || 0;
  if (used >= USES_PER_CARD) return { ok: false, reason: "LIMIT_REACHED", used };
  return { ok: true, used };
}

const s = (v, max) => String(v == null ? "" : v).slice(0, max);
const strArr = (v, n, max) => (Array.isArray(v) ? v.slice(0, n).map((x) => s(x, max)) : []);
const okImg = (u) => /^https:\/\/res\.cloudinary\.com\//.test(u);

// Whitelist + length-cap the wish payload coming from the browser.
function sanitizeWish(p) {
  p = p || {};
  const meta = CARDS[p.templateId];
  if (!meta) return null;
  const imageUrls = strArr(p.imageUrls, 10, 500).filter(okImg);
  const out = {
    templateId: p.templateId,
    templateTitle: meta[0],
    category: meta[1],
    from: s(p.from, 80).trim(),
    to: s(p.to, 80).trim(),
    message: s(p.message, 3000).trim(),
    imageUrl: imageUrls[0] || "",
    imageUrls,
  };
  if (!out.from || !out.to || !out.message) return null;
  if (p.gfNotes) out.gfNotes = strArr(p.gfNotes, 4, 400);
  if (p.gfBoxLetter) out.gfBoxLetter = s(p.gfBoxLetter, 3000);
  if (p.gfReasons) out.gfReasons = strArr(p.gfReasons, 5, 300);
  if (p.gfCollage) out.gfCollage = strArr(p.gfCollage, 2, 500).filter(okImg);
  return out;
}

module.exports = {
  PLANS, USES_PER_CARD, CARDS, DEFAULT_PRICING, isEmail, normalizePricing,
  verifyCheckoutSignature, verifyWebhookSignature,
  validateRefundMessage, wordCount, checkEntitlement, sanitizeWish,
};
