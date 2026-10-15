// @ts-nocheck
// WishVerse API (Cloudflare Worker). Built from worker/src. Paste this whole file into the Worker editor.
// GENERATED from functions/lib.js (pure helpers). Edit there, then regenerate. Used by the Cloudflare Worker.

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
// limit = creations allowed per card (admin can change it); free = the card is free for everyone.
function checkEntitlement(ent, cardId, limit, free) {
ent = ent || {};
const max = Number.isInteger(limit) && limit > 0 ? limit : USES_PER_CARD;
const owns = !!free || !!ent.all || !!(ent.cards && ent.cards[cardId]);
if (!owns) return { ok: false, reason: "NO_ENTITLEMENT" };
const used = (ent.usage && ent.usage[cardId]) || 0;
if (used >= max) return { ok: false, reason: "LIMIT_REACHED", used };
return { ok: true, used };
}

/* ---------- per-card pricing (admin): own price, free card, bundle (bonus cards), uses per card ---------- */
const MAX_USES_PER_CARD = 100;
const validDesignId = (d) => /^[a-z0-9][a-z0-9-]{0,39}$/.test(String(d || ""));
// inp: { price (rupees, "" = use the One Card price), old (rupees, ""), free (bool), bonus ([cardId]) }
function normalizeCardConfig(cardId, inp) {
inp = inp || {};
if (!CARDS[cardId]) return { ok: false, error: "Unknown card." };
const out = { free: !!inp.free, bonus: [] };
if (inp.price !== "" && inp.price != null) {
const r = Number(inp.price);
if (!Number.isFinite(r) || r < 1 || r > 50000) return { ok: false, error: "Card price must be between ₹1 and ₹50,000 (use the Free switch for free cards)." };
out.amount = Math.round(r * 100);
let old = inp.old === "" || inp.old == null ? 0 : Math.round(Number(inp.old) * 100);
if (!Number.isFinite(old) || old < 0 || old > 5000000) return { ok: false, error: "Old price is invalid." };
out.old = old <= out.amount ? 0 : old;
}
const seen = new Set();
for (const b of Array.isArray(inp.bonus) ? inp.bonus : []) {
if (b === cardId || !CARDS[b] || seen.has(b)) continue;
seen.add(b); out.bonus.push(b);
}
return { ok: true, value: out };
}
// Effective settings for one card from the pricing doc { single, all, cards, usesPerCard }.
function effectiveCard(pr, cardId) {
pr = pr || {};
const c = (pr.cards && pr.cards[cardId]) || {};
const hasOwn = Number.isInteger(c.amount);
const amount = hasOwn ? c.amount : (pr.single || DEFAULT_PRICING.single).amount;
const old = hasOwn ? (c.old || 0) : (pr.single || DEFAULT_PRICING.single).old || 0;
return { amount, old, free: !!c.free, bonus: Array.isArray(c.bonus) ? c.bonus.filter((b) => CARDS[b] && b !== cardId) : [] };
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
designId: validDesignId(p.designId) ? String(p.designId) : "classic",
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

/* ---------- share preview (WhatsApp / Instagram / Telegram link cards) ---------- */

/* ---------- wish expiry (links live 10 days) ---------- */
const WISH_TTL_DAYS = 10;
const WISH_TTL_MS = WISH_TTL_DAYS * 24 * 60 * 60 * 1000;
const tms = (t) => (t == null ? null : typeof t === "number" ? t : t.toMillis ? t.toMillis() : null);
// When does this wish link stop working? (older wishes without expiresAt: createdAt + 10 days)
function wishExpiresMs(wish) {
if (!wish) return null;
const e = tms(wish.expiresAt);
if (e) return e;
const c = tms(wish.createdAt);
return c ? c + WISH_TTL_MS : null;
}
function isWishExpired(wish, now) {
const e = wishExpiresMs(wish);
return e != null && (now == null ? Date.now() : now) >= e;
}

/* ---------- creator program ---------- */
const DEFAULT_COMMISSION_PCT = 20; // lifetime: every purchase of a referred user
const MIN_PAYOUT_PAISE = 10000; // ₹100
const validUsername = (u) => /^[a-z0-9][a-z0-9_-]{2,23}$/.test(String(u || ""));
const RESERVED_USERNAMES = new Set(["admin", "owner", "wishverse", "creator", "support", "api", "www", "root", "test"]);
const normUsername = (u) => String(u == null ? "" : u).trim().toLowerCase();
const clampPct = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.min(90, Math.max(0, Math.round(n * 100) / 100)) : null; };
// Commission for one sale. creator = { commissionPct, cardPct: {cardId: pct} }; plan "all" uses key "all".
function commissionFor(creator, plan, cardId, amountPaise) {
creator = creator || {};
const key = plan === "all" ? "all" : cardId;
const own = creator.cardPct && creator.cardPct[key];
const pct = own != null && Number.isFinite(Number(own)) ? Number(own) : (creator.commissionPct != null ? Number(creator.commissionPct) : DEFAULT_COMMISSION_PCT);
return { pct, paise: Math.floor((amountPaise * pct) / 100) };
}

const SITE = "https://wishverse.surajfx.in";
const escHtml = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const validWishId = (id) => /^[A-Za-z0-9]{10,40}$/.test(String(id || ""));

// Title/description/image for a wish (or a generic fallback when the wish does not exist).
function shareMeta(wish, expired) {
if (expired) {
return { title: "This WishVerse link has expired", desc: "Wish links stay open for 10 days. Create a new wish on WishVerse.", image: `${SITE}/share-img/default.jpg` };
}
if (!wish) {
return { title: "WishVerse — Beautiful Wishes", desc: "Create a beautiful, personal wish and share it with someone special.", image: `${SITE}/share-img/default.jpg` };
}
const card = CARDS[wish.templateId];
const label = card ? card[0] : "Wish";
const to = String(wish.to || "").trim().slice(0, 40);
const from = String(wish.from || "").trim().slice(0, 40);
const title = to ? `${label} for ${to} 💌 | WishVerse` : `${label} | WishVerse`;
const desc = from ? `${from} made a little surprise for you. Tap to open it.` : "Someone made a little surprise for you. Tap to open it.";
const image = `${SITE}/share-img/${card ? wish.templateId : "default"}.jpg`;
return { title, desc, image };
}

// Tiny HTML page: crawlers read the tags, people are redirected straight to the real wish.
function shareHtml(id, wish, expired) {
const m = shareMeta(wish, expired);
const target = `${SITE}/?wish=${encodeURIComponent(id)}`;
const t = escHtml(m.title), d = escHtml(m.desc), i = escHtml(m.image), u = escHtml(target);
return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:site_name" content="WishVerse">
<meta property="og:type" content="website">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${i}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="${u}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}"><meta name="twitter:description" content="${d}"><meta name="twitter:image" content="${i}">
<meta http-equiv="refresh" content="0;url=${u}">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fff1f6;font:600 16px system-ui,sans-serif;color:#7a2b4c}</style>
</head><body><p>Opening your surprise… ✨</p>
<script>location.replace(${JSON.stringify(target)});</script>
<noscript><a href="${u}">Open your surprise</a></noscript></body></html>`;
}


// WishVerse API on Cloudflare Workers (free plan, no billing card).
// Replaces the Firebase Cloud Functions: same endpoints, same rules, but it talks to Firestore / Firebase Auth
// through their REST APIs using a service account, and to Razorpay through its REST API. No npm packages.
//
// Settings (Cloudflare dashboard -> Worker -> Settings -> Variables and Secrets):
//   RAZORPAY_KEY_ID (text), OWNER_EMAIL (text)
//   RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, FIREBASE_SERVICE_ACCOUNT (Secrets)

/* ================================ basics ================================ */
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
const HTTP = { unauthenticated: 401, "permission-denied": 403, "invalid-argument": 400, "not-found": 404, "failed-precondition": 400, "resource-exhausted": 429, "already-exists": 409, internal: 500 };
const lc = (e) => String(e || "").trim().toLowerCase();
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64uToBytes = (s) => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); };
const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function hmacHex(secret, data) {
const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
return hex(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}
function safeEq(a, b) {
if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0;
}
const projectId = (env) => env.FIREBASE_PROJECT_ID || JSON.parse(env.FIREBASE_SERVICE_ACCOUNT).project_id;
const OWNER = (env) => lc(env.OWNER_EMAIL || "suraj7uddin@gmail.com");

/* ===================== Google service-account access token ===================== */
let TOKEN = null;
async function accessToken(env) {
if (env.__TEST_TOKEN) return env.__TEST_TOKEN;
const now = Math.floor(Date.now() / 1000);
if (TOKEN && TOKEN.exp - 60 > now) return TOKEN.value;
const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
const pem = String(sa.private_key).replace(/\\n/g, "\n").replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
const key = await crypto.subtle.importKey("pkcs8", b64uToBytes(pem.replace(/\+/g, "-").replace(/\//g, "_")), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
const head = b64u(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
const body = b64u(enc.encode(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })));
const sig = b64u(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(`${head}.${body}`)));
const r = await fetch("https://oauth2.googleapis.com/token", {
method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${head}.${body}.${sig}`,
});
const j = await r.json();
if (!r.ok || !j.access_token) throw new HttpsError("internal", "Google sign-in for the server failed. Check FIREBASE_SERVICE_ACCOUNT.");
TOKEN = { value: j.access_token, exp: now + (j.expires_in || 3600) };
return TOKEN.value;
}

/* ============================ Firestore over REST ============================ */
const FV = { serverTimestamp: () => ({ __fv: "ts" }), increment: (n) => ({ __fv: "inc", n }), delete: () => ({ __fv: "del" }) };
class Ts { constructor(ms) { this.ms = ms; } toMillis() { return this.ms; } toJSON() { return this.ms; } }
const isFv = (v) => v && typeof v === "object" && v.__fv;
const isPlain = (v) => v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Ts) && !v.__fv;
function encVal(v) {
if (v === null || v === undefined) return { nullValue: null };
if (typeof v === "boolean") return { booleanValue: v };
if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
if (typeof v === "string") return { stringValue: v };
if (Array.isArray(v)) return { arrayValue: { values: v.map(encVal) } };
if (v instanceof Ts) return { timestampValue: new Date(v.ms).toISOString() };
return { mapValue: { fields: encFields(v) } };
}
function encFields(o) { const f = {}; for (const [k, v] of Object.entries(o)) if (v !== undefined) f[k] = encVal(v); return f; }
function decVal(v) {
if ("nullValue" in v) return null;
if ("booleanValue" in v) return v.booleanValue;
if ("integerValue" in v) return Number(v.integerValue);
if ("doubleValue" in v) return v.doubleValue;
if ("stringValue" in v) return v.stringValue;
if ("timestampValue" in v) return new Ts(Date.parse(v.timestampValue));
if ("arrayValue" in v) return (v.arrayValue.values || []).map(decVal);
if ("mapValue" in v) return decFields(v.mapValue.fields || {});
return null;
}
function decFields(f) { const o = {}; for (const [k, v] of Object.entries(f)) o[k] = decVal(v); return o; }
const SIMPLE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const fp = (segs) => segs.map((s) => (SIMPLE.test(s) ? s : "`" + s.replace(/\\/g, "\\\\").replace(/`/g, "\\`") + "`")).join(".");
function putPath(obj, segs, val) { let c = obj; for (const s of segs.slice(0, -1)) c = c[s] = c[s] && isPlain(c[s]) ? c[s] : {}; c[segs[segs.length - 1]] = val; }

// mode: "set" (replace doc) | "merge" (deep merge) | "update" (dotted keys, doc must exist)
function buildWrite(name, data, mode) {
const fields = {}, mask = [], tf = [];
const handle = (segs, v) => {
if (isFv(v)) {
if (v.__fv === "del") { if (mode !== "set") mask.push(fp(segs)); }
else if (v.__fv === "ts") tf.push({ fieldPath: fp(segs), setToServerValue: "REQUEST_TIME" });
else tf.push({ fieldPath: fp(segs), increment: { integerValue: String(v.n) } });
return true;
}
return false;
};
const walk = (obj, prefix) => {
for (const [k, v] of Object.entries(obj)) {
if (v === undefined) continue;
const segs = prefix.concat(k);
if (handle(segs, v)) continue;
if (mode !== "update" && isPlain(v) && Object.keys(v).length) { walk(v, segs); continue; } // deep merge / nested transforms
putPath(fields, segs, v);
if (mode !== "set") mask.push(fp(segs));
}
};
if (mode === "update") {
for (const [k, v] of Object.entries(data)) {
const segs = k.split(".");
if (handle(segs, v)) continue;
putPath(fields, segs, v); mask.push(fp(segs));
}
} else walk(data, []);
if (mode !== "set" && !mask.length && tf.length) throw new Error("transform-only write is not supported");
const w = { update: { name, fields: encFields(fields) } };
if (mode !== "set") w.updateMask = { fieldPaths: mask };
if (tf.length) w.updateTransforms = tf;
if (mode === "update") w.currentDocument = { exists: true };
return w;
}

function makeDb(env) {
if (env.__DB) return env.__DB;
const root = `projects/${projectId(env)}/databases/(default)/documents`;
const base = `https://firestore.googleapis.com/v1/${root}`;
const api = async (method, url, body) => {
const r = await fetch(url, { method, headers: { Authorization: "Bearer " + (await accessToken(env)), "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
const t = await r.text(); let j = {}; try { j = t ? JSON.parse(t) : {}; } catch {}
if (!r.ok) { const e = new Error((j.error && j.error.message) || "Firestore error " + r.status); e.status = r.status; throw e; }
return j;
};
const urlOf = (path) => `${base}/${path.split("/").map(encodeURIComponent).join("/")}`;
const nameOf = (path) => `${root}/${path}`;
const snapOf = (path, doc) => ({ exists: !!doc, id: path.split("/").pop(), ref: docRef(path), data: () => (doc ? decFields(doc.fields || {}) : undefined) });
async function getDoc(path, tx) {
try { return snapOf(path, await api("GET", urlOf(path) + (tx ? `?transaction=${encodeURIComponent(tx)}` : ""))); }
catch (e) { if (e.status === 404) return snapOf(path, null); throw e; }
}
const commit = (writes, transaction) => api("POST", `${base}:commit`, { writes, ...(transaction ? { transaction } : {}) });
function docRef(path) {
return {
path, id: path.split("/").pop(), get: () => getDoc(path),
set: (d, o) => commit([buildWrite(nameOf(path), d, o && o.merge ? "merge" : "set")]),
update: (d) => commit([buildWrite(nameOf(path), d, "update")]),
delete: () => commit([{ delete: nameOf(path) }]),
};
}
const autoId = () => { const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"; return [...crypto.getRandomValues(new Uint8Array(20))].map((x) => a[x % a.length]).join(""); };
function query(c, q = {}) {
const self = {
where: (f, op, v) => query(c, { ...q, where: { field: f, v } }),
orderBy: (f, dir) => query(c, { ...q, order: { f, dir: String(dir || "asc").toLowerCase() === "desc" ? "DESCENDING" : "ASCENDING" } }),
limit: (n) => query(c, { ...q, limit: n }),
get: async () => {
const sq = { from: [{ collectionId: c }] };
if (q.where) sq.where = { fieldFilter: { field: { fieldPath: q.where.field }, op: "EQUAL", value: encVal(q.where.v) } };
if (q.order) sq.orderBy = [{ field: { fieldPath: q.order.f }, direction: q.order.dir }];
if (q.limit) sq.limit = q.limit;
const rows = await api("POST", `${base}:runQuery`, { structuredQuery: sq });
const docs = rows.filter((r) => r.document).map((r) => {
const path = r.document.name.slice(root.length + 1).split("/").map(decodeURIComponent).join("/");
return snapOf(path, r.document);
});
return { docs, forEach: (f) => docs.forEach(f), empty: !docs.length };
},
doc: (id) => docRef(`${c}/${id || autoId()}`),
add: async (d) => { const id = autoId(); await docRef(`${c}/${id}`).set(d); return { id }; },
};
return self;
}
return {
doc: docRef,
collection: (c) => query(c),
batch: () => {
const ops = [];
return {
set: (r, d, o) => ops.push(buildWrite(nameOf(r.path), d, o && o.merge ? "merge" : "set")),
update: (r, d) => ops.push(buildWrite(nameOf(r.path), d, "update")),
delete: (r) => ops.push({ delete: nameOf(r.path) }),
commit: async () => { if (ops.length) await commit(ops); },
};
},
runTransaction: async (fn) => {
for (let attempt = 0; ; attempt++) {
const { transaction } = await api("POST", `${base}:beginTransaction`, { options: { readWrite: {} } });
const writes = [];
const tx = {
get: (r) => getDoc(r.path, transaction),
set: (r, d, o) => writes.push(buildWrite(nameOf(r.path), d, o && o.merge ? "merge" : "set")),
update: (r, d) => writes.push(buildWrite(nameOf(r.path), d, "update")),
delete: (r) => writes.push({ delete: nameOf(r.path) }),
};
let out;
try { out = await fn(tx); }
catch (e) { api("POST", `${base}:rollback`, { transaction }).catch(() => {}); throw e; }
try { await commit(writes, transaction); return out; }
catch (e) { if ((e.status === 409 || e.status === 400 && /abort|contention/i.test(e.message)) && attempt < 4) continue; throw e; }
}
},
};
}

/* ======================= Firebase Auth (admin) over REST ======================= */
function makeAuthAdmin(env) {
if (env.__AUTH) return env.__AUTH;
const base = () => `https://identitytoolkit.googleapis.com/v1/projects/${projectId(env)}`;
const post = async (path, body) => {
const r = await fetch(base() + path, { method: "POST", headers: { Authorization: "Bearer " + (await accessToken(env)), "Content-Type": "application/json" }, body: JSON.stringify(body) });
const j = await r.json().catch(() => ({}));
if (!r.ok) throw new Error((j.error && j.error.message) || "Auth admin error " + r.status);
return j;
};
const norm = (u) => ({ uid: u.localId, email: u.email || "", createdAt: Number(u.createdAt) || null, lastSignIn: Number(u.lastLoginAt) || null, disabled: !!u.disabled });
return {
getUser: async (uid) => { const j = await post("/accounts:lookup", { localId: [uid] }); return j.users && j.users[0] ? norm(j.users[0]) : null; },
getUserByEmail: async (email) => { const j = await post("/accounts:lookup", { email: [email] }); return j.users && j.users[0] ? norm(j.users[0]) : null; },
updateUser: (uid, { disabled }) => post("/accounts:update", { localId: uid, disableUser: !!disabled }),
revokeRefreshTokens: (uid) => post("/accounts:update", { localId: uid, validSince: String(Math.floor(Date.now() / 1000)) }),
deleteUser: (uid) => post("/accounts:delete", { localId: uid }),
listUsers: async () => {
const out = []; let tok = "";
for (let i = 0; i < 5; i++) {
const r = await fetch(`${base()}/accounts:batchGet?maxResults=1000${tok ? "&nextPageToken=" + encodeURIComponent(tok) : ""}`, { headers: { Authorization: "Bearer " + (await accessToken(env)) } });
const j = await r.json().catch(() => ({}));
if (!r.ok) throw new Error((j.error && j.error.message) || "Auth list error");
(j.users || []).forEach((u) => out.push(norm(u)));
tok = j.nextPageToken || ""; if (!tok) break;
}
return out;
},
};
}

/* ========================= Firebase ID token verification ========================= */
let JWKS = null; const KEYS = {};
async function jwks(force) {
if (!force && JWKS && JWKS.exp > Date.now()) return JWKS.keys;
const r = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
const j = await r.json();
const m = /max-age=(\d+)/.exec(r.headers.get("cache-control") || "");
JWKS = { keys: j.keys || [], exp: Date.now() + (m ? Number(m[1]) : 3600) * 1000 };
return JWKS.keys;
}
async function verifyIdToken(token, env) {
if (env.__VERIFY) return env.__VERIFY(token);
const parts = String(token || "").split(".");
if (parts.length !== 3) throw new Error("bad token");
const header = JSON.parse(new TextDecoder().decode(b64uToBytes(parts[0])));
const payload = JSON.parse(new TextDecoder().decode(b64uToBytes(parts[1])));
if (header.alg !== "RS256" || !header.kid) throw new Error("bad alg");
let jwk = (await jwks(false)).find((k) => k.kid === header.kid) || (await jwks(true)).find((k) => k.kid === header.kid);
if (!jwk) throw new Error("unknown key");
const key = KEYS[header.kid] || (KEYS[header.kid] = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]));
const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64uToBytes(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
const now = Math.floor(Date.now() / 1000), pid = projectId(env);
if (!ok || payload.aud !== pid || payload.iss !== `https://securetoken.google.com/${pid}` || !payload.sub || payload.exp < now || payload.iat > now + 300) throw new Error("invalid token");
return payload;
}

/* ================================= Razorpay REST ================================= */
function makeRzp(env) {
if (env.__RZP) return env.__RZP;
const call = async (method, path, body) => {
const r = await fetch("https://api.razorpay.com/v1" + path, {
method, headers: { Authorization: "Basic " + btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`), "Content-Type": "application/json" },
body: body ? JSON.stringify(body) : undefined,
});
const j = await r.json().catch(() => ({}));
if (!r.ok) {
console.error("razorpay", r.status, JSON.stringify(j));
throw new HttpsError(r.status === 401 ? "internal" : "failed-precondition", "Razorpay: " + ((j.error && j.error.description) || "request failed (" + r.status + ")"));
}
return j;
};
return {
orders: { create: (b) => call("POST", "/orders", b), fetchPayments: (id) => call("GET", `/orders/${id}/payments`) },
payments: { fetch: (id) => call("GET", `/payments/${id}`), capture: (id, amount, currency) => call("POST", `/payments/${id}/capture`, { amount, currency }), refund: (id, b) => call("POST", `/payments/${id}/refund`, b) },
};
}

/* ================================ shared helpers ================================ */
const ms = (t) => (t && t.toMillis ? t.toMillis() : null);
async function isAdminEmail(c, email, verified) {
email = lc(email);
if (!email || !verified) return false;
if (email === OWNER(c.env)) return true;
return (await c.db.doc(`admins/${email}`).get()).exists;
}
const isOwnerAuth = (c, a) => !!a.token.email_verified && lc(a.token.email) === OWNER(c.env);
const isAdminAuth = (c, a) => isAdminEmail(c, a.token.email, a.token.email_verified);
function needAuth(c) {
const a = c.auth;
if (!a) throw new HttpsError("unauthenticated", "Please log in first.");
const prov = a.token.firebase && a.token.firebase.sign_in_provider;
if (prov !== "google.com" || !a.token.email_verified) throw new HttpsError("permission-denied", "GOOGLE_LOGIN_REQUIRED");
return a;
}
async function needAdmin(c) { const a = needAuth(c); if (!(await isAdminAuth(c, a))) throw new HttpsError("permission-denied", "Admins only."); return a; }
function needOwner(c) { const a = needAuth(c); if (!isOwnerAuth(c, a)) throw new HttpsError("permission-denied", "Owner only."); return a; }
async function needActiveUser(c) {
const a = needAuth(c);
const u = await c.db.doc(`users/${a.uid}`).get();
if (u.exists && u.data().suspended) throw new HttpsError("permission-denied", "SUSPENDED");
return a;
}
async function touchUser(c, a) {
await c.db.doc(`users/${a.uid}`).set({ email: a.token.email || "", lastSeen: FV.serverTimestamp() }, { merge: true });
await applyPendingGrants(c, a.uid, a.token.email);
}
async function grantEntitlement(c, uid, email, g) {
const id = "grant_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
const batch = c.db.batch();
batch.set(c.db.doc(`payments/${id}`), {
uid, email: lc(email), plan: g.plan, cardId: g.plan === "single" ? g.cardId : null, amount: 0, currency: "INR",
status: "granted", grantedBy: g.by || "", note: String(g.note || "").slice(0, 200), attempts: 0,
createdAt: FV.serverTimestamp(), paidAt: FV.serverTimestamp(),
});
batch.set(c.db.doc(`entitlements/${uid}`),
g.plan === "all" ? { all: { paymentId: id, at: Date.now() } } : { cards: { [g.cardId]: { paymentId: id, at: Date.now() } } },
{ merge: true });
await batch.commit();
return id;
}
async function applyPendingGrants(c, uid, email) {
const e = lc(email); if (!e) return;
const ref = c.db.doc(`pendingGrants/${e}`);
const s = await ref.get(); if (!s.exists) return;
for (const g of s.data().grants || []) await grantEntitlement(c, uid, e, g);
await ref.delete();
}
async function getPricingDoc(c) {
const s = await c.db.doc("config/pricing").get();
const d = s.exists ? s.data() : {};
const D = DEFAULT_PRICING, pick = (k) => ({
amount: d[k] && Number.isInteger(d[k].amount) ? d[k].amount : D[k].amount,
old: d[k] && Number.isInteger(d[k].old) ? d[k].old : D[k].old,
});
const cards = {};
for (const id of Object.keys(CARDS)) {
const x = d.cards && d.cards[id];
if (!x) continue;
const e = { free: !!x.free, bonus: Array.isArray(x.bonus) ? x.bonus.filter((b) => CARDS[b] && b !== id) : [] };
if (Number.isInteger(x.amount)) { e.amount = x.amount; e.old = Number.isInteger(x.old) ? x.old : 0; }
cards[id] = e;
}
const up = Number.isInteger(d.usesPerCard) && d.usesPerCard >= 1 && d.usesPerCard <= MAX_USES_PER_CARD ? d.usesPerCard : USES_PER_CARD;
return { single: pick("single"), all: pick("all"), cards, usesPerCard: up };
}
async function logEvent(c, type, uid, email, detail) {
try { await c.db.collection("securityEvents").add({ type, uid: uid || "", email: email || "", detail: String(detail || "").slice(0, 500), at: FV.serverTimestamp() }); }
catch (e) { console.error("logEvent", e); }
}
function cleanPayment(id, d) {
return {
id, uid: d.uid, email: d.email, plan: d.plan, cardId: d.cardId || null,
amount: d.amount, status: d.status, razorpayPaymentId: d.razorpayPaymentId || null,
method: d.method || null, error: d.error || null, attempts: d.attempts || 0,
note: d.note || "", grantedBy: d.grantedBy || "",
createdAt: ms(d.createdAt), paidAt: ms(d.paidAt), refundedAt: ms(d.refundedAt),
refundRequest: d.refundRequest ? {
message: d.refundRequest.message, status: d.refundRequest.status,
at: ms(d.refundRequest.at), usageAtRequest: d.refundRequest.usageAtRequest ?? null,
adminNote: d.refundRequest.adminNote || "", decidedAt: ms(d.refundRequest.decidedAt),
} : null,
refundId: d.refundId || null, hidden: !!d.hiddenByUser,
};
}
// Idempotent: mark paid + grant entitlement. Safe to call from verify, webhook, admin sync.
async function fulfillTx(c, orderId, rp) {
const pRef = c.db.doc(`payments/${orderId}`);
return c.db.runTransaction(async (tx) => {
const ps = await tx.get(pRef);
if (!ps.exists) return { ok: false, reason: "NO_ORDER" };
const p = ps.data();
if (p.status === "paid" || p.status === "refunded") return { ok: true, already: true };
if (rp.amount !== p.amount || (rp.currency && rp.currency !== "INR")) return { ok: false, reason: "AMOUNT_MISMATCH", uid: p.uid, email: p.email };
const eRef = c.db.doc(`entitlements/${p.uid}`);
const es = await tx.get(eRef);
const upd = {};
const have = (es.exists && es.data().cards) || {};
const bonus = p.plan === "single" ? (Array.isArray(p.bonus) ? p.bonus : []).filter((b) => CARDS[b] && b !== p.cardId && !have[b]) : [];
if (p.plan === "all") { upd.all = { paymentId: orderId, at: Date.now() }; upd.usage = {}; }
else {
upd[`cards.${p.cardId}`] = { paymentId: orderId, at: Date.now() }; upd[`usage.${p.cardId}`] = 0;
for (const b of bonus) { upd[`cards.${b}`] = { paymentId: orderId, at: Date.now(), bonus: true }; upd[`usage.${b}`] = 0; }
}
tx.update(pRef, { status: "paid", razorpayPaymentId: rp.id, method: rp.method || null, paidAt: FV.serverTimestamp(), error: FV.delete() });
if (es.exists) tx.update(eRef, upd);
else {
const cardsObj = { [p.cardId]: upd[`cards.${p.cardId}`] }, usageObj = { [p.cardId]: 0 };
for (const b of bonus) { cardsObj[b] = upd[`cards.${b}`]; usageObj[b] = 0; }
tx.set(eRef, p.plan === "all" ? { all: upd.all, cards: {}, usage: {} } : { all: null, cards: cardsObj, usage: usageObj });
}
return { ok: true };
});
}
async function fulfill(c, orderId, rp) {
const r = await fulfillTx(c, orderId, rp);
if (r.ok) await recordCommission(c, orderId);
return r;
}
async function revokeEntitlement(c, p) {
const eRef = c.db.doc(`entitlements/${p.uid}`);
const es = await eRef.get(); if (!es.exists) return;
if (p.plan === "all") await eRef.update({ all: null });
else {
const upd = { [`cards.${p.cardId}`]: FV.delete() };
const have = es.data().cards || {};
// bonus cards that came with this very payment go back too
for (const b of Array.isArray(p.bonus) ? p.bonus : []) if (have[b] && have[b].bonus && have[b].paymentId === p.id) upd[`cards.${b}`] = FV.delete();
await eRef.update(upd);
}
}
async function allPayments(c, limit) {
const s = await c.db.collection("payments").orderBy("createdAt", "desc").limit(limit).get();
return s.docs.map((d) => cleanPayment(d.id, d.data()));
}

/* ================================== endpoints ================================== */
const H = {};

H.createOrder = async (c) => {
const a = await needActiveUser(c);
const { plan, cardId } = c.data || {};
if (!PLANS[plan]) throw new HttpsError("invalid-argument", "Unknown plan.");
if (await isAdminAuth(c, a)) throw new HttpsError("failed-precondition", "Admins already have free access.");
if (plan === "single" && !CARDS[cardId]) throw new HttpsError("invalid-argument", "Choose a valid card.");
const pr = await getPricingDoc(c);
const cfg = plan === "single" ? effectiveCard(pr, cardId) : null;
if (cfg && cfg.free) throw new HttpsError("failed-precondition", "This card is free: no payment needed.");
const planDef = { amount: cfg ? cfg.amount : pr.all.amount, label: plan === "all" ? "All Cards Pass" : "One Card" };
await touchUser(c, a);
const rf = await referrerFor(c, a.uid, (c.data || {}).ref);
const es = await c.db.doc(`entitlements/${a.uid}`).get();
const ent = es.exists ? es.data() : {};
if (ent.all) throw new HttpsError("failed-precondition", "You already have the All Cards Pass.");
if (plan === "single" && ent.cards && ent.cards[cardId]) throw new HttpsError("failed-precondition", "You already own this card.");
const order = await c.rzp.orders.create({
amount: planDef.amount, currency: "INR", receipt: `wv_${Date.now()}`.slice(0, 40),
notes: { uid: a.uid, plan, cardId: plan === "single" ? cardId : "all" },
});
await c.db.doc(`payments/${order.id}`).set({
uid: a.uid, email: a.token.email || "", plan, cardId: plan === "single" ? cardId : null,
amount: planDef.amount, currency: "INR", status: "created", attempts: 0, createdAt: FV.serverTimestamp(),
...(rf ? { ref: rf.username, refUid: rf.uid } : {}),
...(cfg && cfg.bonus.length ? { bonus: cfg.bonus } : {}),
});
return { orderId: order.id, amount: planDef.amount, currency: "INR", keyId: c.env.RAZORPAY_KEY_ID, label: planDef.label, email: a.token.email || "" };
};

H.verifyPayment = async (c) => {
const a = needAuth(c);
const { razorpay_order_id: oid, razorpay_payment_id: pid, razorpay_signature: sig } = c.data || {};
if (!oid || !pid || !sig) throw new HttpsError("invalid-argument", "Missing payment details.");
const pSnap = await c.db.doc(`payments/${oid}`).get();
if (!pSnap.exists || pSnap.data().uid !== a.uid) {
await logEvent(c, "verify_foreign_order", a.uid, a.token.email, `order ${oid}`);
throw new HttpsError("not-found", "Order not found.");
}
if (!safeEq(await hmacHex(c.env.RAZORPAY_KEY_SECRET, `${oid}|${pid}`), String(sig))) {
await logEvent(c, "bad_signature", a.uid, a.token.email, `order ${oid} payment ${pid}`);
throw new HttpsError("permission-denied", "Payment signature mismatch.");
}
// Never trust the browser: ask Razorpay what really happened.
let rp = await c.rzp.payments.fetch(pid);
if (rp.order_id !== oid) {
await logEvent(c, "order_mismatch", a.uid, a.token.email, `order ${oid} payment ${pid}`);
throw new HttpsError("permission-denied", "Payment does not belong to this order.");
}
if (rp.status === "authorized") rp = await c.rzp.payments.capture(pid, rp.amount, "INR");
if (rp.status !== "captured") throw new HttpsError("failed-precondition", `Payment status: ${rp.status}`);
const r = await fulfill(c, oid, rp);
if (!r.ok) {
if (r.reason === "AMOUNT_MISMATCH") await logEvent(c, "amount_mismatch", a.uid, a.token.email, `order ${oid}`);
throw new HttpsError("failed-precondition", r.reason);
}
return { ok: true };
};

H.reportPaymentFailure = async (c) => {
const a = needAuth(c);
const { orderId, description } = c.data || {};
if (!orderId) return { ok: true };
const ref = c.db.doc(`payments/${orderId}`);
const s = await ref.get();
if (!s.exists || s.data().uid !== a.uid) return { ok: true };
if (s.data().status === "created" || s.data().status === "failed") {
await ref.update({ status: "failed", error: String(description || "Payment failed").slice(0, 300), attempts: FV.increment(1) });
}
return { ok: true };
};

async function webhook(c, ev) {
const pay = ev.payload && ev.payload.payment && ev.payload.payment.entity;
if (ev.event === "payment.captured" && pay) {
const r = await fulfill(c, pay.order_id, pay);
if (!r.ok && r.reason === "AMOUNT_MISMATCH") await logEvent(c, "amount_mismatch", r.uid, r.email, `order ${pay.order_id} (webhook)`);
} else if (ev.event === "payment.failed" && pay) {
const ref = c.db.doc(`payments/${pay.order_id}`);
const s = await ref.get();
if (s.exists && s.data().status !== "paid" && s.data().status !== "refunded") {
await ref.update({
status: "failed", razorpayPaymentId: pay.id, method: pay.method || null,
error: String(pay.error_description || pay.error_reason || "Payment failed").slice(0, 300), attempts: FV.increment(1),
});
}
} else if (ev.event === "refund.processed" || ev.event === "refund.created") {
const rf = ev.payload.refund.entity;
const q = await c.db.collection("payments").where("razorpayPaymentId", "==", rf.payment_id).limit(1).get();
if (!q.empty && q.docs.length) {
const d = q.docs[0];
if (d.data().status === "paid") { // refund made from the Razorpay dashboard directly -> mirror it here
await d.ref.update({ status: "refunded", refundId: rf.id, refundedAt: FV.serverTimestamp() });
await revokeEntitlement(c, { ...d.data(), id: d.id });
await reverseCommission(c, d.id);
}
}
}
}

H.getMyAccount = async (c) => {
const a = needAuth(c);
await touchUser(c, a);
const [u, e, ps, ws] = await Promise.all([
c.db.doc(`users/${a.uid}`).get(),
c.db.doc(`entitlements/${a.uid}`).get(),
c.db.collection("payments").where("uid", "==", a.uid).get(),
c.db.collection("wishes").where("ownerUid", "==", a.uid).get(),
]);
const wishes = ws.docs.map((d) => ({ id: d.id, templateId: d.data().templateId, to: d.data().to || "", createdAt: ms(d.data().createdAt), expiresAt: wishExpiresMs(d.data()), expired: isWishExpired(d.data()) }))
.sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0)).slice(0, 100);
const ent = e.exists ? e.data() : {};
const pr = await getPricingDoc(c);
const freeCards = Object.keys(pr.cards).filter((id) => pr.cards[id].free);
const payments = ps.docs.map((d) => cleanPayment(d.id, d.data()))
.filter((p) => p.status !== "created" && !p.hidden).sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));
return {
email: a.token.email || "", suspended: !!(u.exists && u.data().suspended),
isAdmin: await isAdminAuth(c, a), isOwner: isOwnerAuth(c, a), isCreator: await isApprovedCreator(c, a.uid),
all: !!ent.all, cards: Object.keys(ent.cards || {}), freeCards, usage: ent.usage || {}, usesPerCard: pr.usesPerCard,
payments, wishes, shareBase: `${c.origin}/wishShare`,
};
};

// Delete one of my wishes (the link stops working at once).
H.deleteWish = async (c) => {
const a = needAuth(c);
const id = String((c.data || {}).id || "");
if (!validWishId(id)) throw new HttpsError("invalid-argument", "Invalid wish.");
const ref = c.db.doc(`wishes/${id}`);
const s = await ref.get();
if (!s.exists || s.data().ownerUid !== a.uid) throw new HttpsError("not-found", "Wish not found.");
await ref.delete();
return { ok: true };
};
// Remove a payment from my list. The record stays for accounting and refunds; only the list hides it.
H.hidePayment = async (c) => {
const a = needAuth(c);
const id = String((c.data || {}).id || "");
const ref = c.db.doc(`payments/${id}`);
const s = await ref.get();
if (!id || !s.exists || s.data().uid !== a.uid) throw new HttpsError("not-found", "Payment not found.");
await ref.update({ hiddenByUser: true });
return { ok: true };
};

// Permanently deletes the account + its wishes. Payment records stay (accounting / refund disputes).
H.deleteMyAccount = async (c) => {
const a = needAuth(c);
if ((c.data || {}).confirm !== "DELETE") throw new HttpsError("invalid-argument", "Type DELETE to confirm.");
if (isOwnerAuth(c, a)) throw new HttpsError("failed-precondition", "The owner account cannot be deleted here.");
const u = await c.db.doc(`users/${a.uid}`).get();
if (u.exists && u.data().suspended) throw new HttpsError("permission-denied", "SUSPENDED"); // no wiping to escape a suspension
const ps = await c.db.collection("payments").where("uid", "==", a.uid).get();
if (ps.docs.some((d) => d.data().refundRequest && d.data().refundRequest.status === "pending")) throw new HttpsError("failed-precondition", "REFUND_PENDING");
const ws = await c.db.collection("wishes").where("ownerUid", "==", a.uid).get();
for (let i = 0; i < ws.docs.length; i += 25) await Promise.all(ws.docs.slice(i, i + 25).map((d) => d.ref.delete()));
await c.db.doc(`entitlements/${a.uid}`).delete();
await c.db.doc(`users/${a.uid}`).delete();
await logEvent(c, "account_deleted", a.uid, a.token.email, `wishes removed: ${ws.docs.length}`);
await c.authAdmin.deleteUser(a.uid);
return { ok: true, wishesDeleted: ws.docs.length };
};

H.requestRefund = async (c) => {
const a = await needActiveUser(c);
const { paymentId, message } = c.data || {};
const v = validateRefundMessage(message);
if (!v.ok) throw new HttpsError("invalid-argument", v.error);
const ref = c.db.doc(`payments/${paymentId}`);
await c.db.runTransaction(async (tx) => {
const s = await tx.get(ref);
if (!s.exists || s.data().uid !== a.uid) throw new HttpsError("not-found", "Payment not found.");
const p = s.data();
if (p.status !== "paid") throw new HttpsError("failed-precondition", "Only paid orders can be reported.");
if (p.refundRequest) throw new HttpsError("already-exists", "You have already reported this payment.");
const es = await tx.get(c.db.doc(`entitlements/${a.uid}`));
const usage = es.exists ? es.data().usage || {} : {};
const used = p.plan === "all" ? Object.values(usage).reduce((x, y) => x + y, 0) : usage[p.cardId] || 0;
tx.update(ref, { refundRequest: { message: v.text, status: "pending", at: FV.serverTimestamp(), usageAtRequest: used } });
});
return { ok: true };
};

// The only way a wish gets saved: server checks payment, suspension and the 7-use limit.
H.createWish = async (c) => {
const a = await needActiveUser(c);
const wish = sanitizeWish(c.data);
if (!wish) throw new HttpsError("invalid-argument", "Please fill From, To and Message.");
const eRef = c.db.doc(`entitlements/${a.uid}`);
const wRef = c.db.collection("wishes").doc();
const isAdmin = await isAdminAuth(c, a); // only owner/admins are free; creators get free cards only when the owner gives them a plan
const pr = await getPricingDoc(c);
const freeCard = effectiveCard(pr, wish.templateId).free;
try {
await c.db.runTransaction(async (tx) => {
if (!isAdmin) { // owner/admins use every card free and unlimited
const es = await tx.get(eRef);
const ent = es.exists ? es.data() : null;
const chk = checkEntitlement(ent, wish.templateId, pr.usesPerCard, freeCard);
if (!chk.ok) throw new HttpsError(chk.reason === "LIMIT_REACHED" ? "resource-exhausted" : "failed-precondition", chk.reason);
if (es.exists) tx.update(eRef, { [`usage.${wish.templateId}`]: chk.used + 1 });
else tx.set(eRef, { all: null, cards: {}, usage: { [wish.templateId]: chk.used + 1 } });
}
tx.set(wRef, { ...wish, ownerUid: a.uid, createdAt: FV.serverTimestamp(), expiresAt: new Ts(Date.now() + WISH_TTL_MS) });
});
} catch (e) {
if (e instanceof HttpsError && e.message === "NO_ENTITLEMENT") await logEvent(c, "wish_without_entitlement", a.uid, a.token.email, `card ${wish.templateId}`);
throw e;
}
return { id: wRef.id, shareUrl: `${c.origin}/s/${wRef.id}`, expiresAt: Date.now() + WISH_TTL_MS };
};

/* -------------------------------- admin -------------------------------- */
H.adminCheck = async (c) => { const a = needAuth(c); return { isAdmin: await isAdminAuth(c, a), isOwner: isOwnerAuth(c, a), email: a.token.email || "" }; };

H.adminOverview = async (c) => {
await needAdmin(c);
const [pays, users, ev] = await Promise.all([
allPayments(c, 1000), c.db.collection("users").get(),
c.db.collection("securityEvents").orderBy("at", "desc").limit(300).get(),
]);
const by = (st) => pays.filter((p) => p.status === st);
const paid = by("paid"), refunded = by("refunded");
const flagged = new Set(ev.docs.map((d) => d.data().uid).filter(Boolean));
return {
totalOrders: pays.length, created: by("created").length, paid: paid.length, failed: by("failed").length,
refunded: refunded.length, granted: by("granted").length,
refundRequestsPending: pays.filter((p) => p.refundRequest && p.refundRequest.status === "pending").length,
plan99Buyers: new Set(pays.filter((p) => p.plan === "all" && p.status === "paid").map((p) => p.uid)).size,
plan35Buyers: new Set(pays.filter((p) => p.plan === "single" && p.status === "paid").map((p) => p.uid)).size,
revenuePaise: paid.reduce((x, p) => x + p.amount, 0), refundedPaise: refunded.reduce((x, p) => x + p.amount, 0),
suspended: users.docs.filter((d) => d.data().suspended).length, flaggedUsers: flagged.size,
};
};
H.adminListPayments = async (c) => { await needAdmin(c); return { payments: await allPayments(c, 1000) }; };

H.adminListUsers = async (c) => {
await needAdmin(c);
const [list, docs, ents, ev, adms] = await Promise.all([
c.authAdmin.listUsers(), c.db.collection("users").get(), c.db.collection("entitlements").get(),
c.db.collection("securityEvents").orderBy("at", "desc").limit(300).get(), c.db.collection("admins").get(),
]);
const adm = new Set(adms.docs.map((d) => d.id));
const meta = {}; docs.docs.forEach((d) => (meta[d.id] = d.data()));
const entm = {}; ents.docs.forEach((d) => (entm[d.id] = d.data()));
const flags = {}; ev.docs.forEach((d) => { const u = d.data().uid; if (u) flags[u] = (flags[u] || 0) + 1; });
return {
users: list.map((u) => ({
uid: u.uid, email: u.email || "", createdAt: u.createdAt, lastSignIn: u.lastSignIn,
suspended: !!(meta[u.uid] && meta[u.uid].suspended), reason: (meta[u.uid] && meta[u.uid].suspendReason) || "",
hasAll: !!(entm[u.uid] && entm[u.uid].all), cards: Object.keys((entm[u.uid] && entm[u.uid].cards) || {}),
flags: flags[u.uid] || 0, isAdmin: lc(u.email) === OWNER(c.env) || adm.has(lc(u.email)),
})),
};
};

H.adminSecurityEvents = async (c) => {
await needAdmin(c);
const s = await c.db.collection("securityEvents").orderBy("at", "desc").limit(200).get();
return { events: s.docs.map((d) => ({ id: d.id, ...d.data(), at: ms(d.data().at) })) };
};

H.adminSetSuspended = async (c) => {
await needAdmin(c);
const { uid, suspended, reason } = c.data || {};
if (!uid) throw new HttpsError("invalid-argument", "uid missing");
let target = null;
try { target = await c.authAdmin.getUser(uid); } catch { target = null; }
if (!target) throw new HttpsError("not-found", "User not found.");
if (target.uid === c.auth.uid || (await isAdminEmail(c, target.email, true))) throw new HttpsError("failed-precondition", "Cannot suspend an admin.");
await c.db.doc(`users/${uid}`).set(
{ suspended: !!suspended, suspendReason: suspended ? String(reason || "").slice(0, 300) : "", suspendedAt: suspended ? FV.serverTimestamp() : null },
{ merge: true });
await c.authAdmin.updateUser(uid, { disabled: !!suspended }); // blocks login completely
if (suspended) await c.authAdmin.revokeRefreshTokens(uid);
return { ok: true };
};

H.adminRefund = async (c) => {
const a = await needAdmin(c);
const { paymentId, note } = c.data || {};
const ref = c.db.doc(`payments/${paymentId}`);
const s = await ref.get();
if (!s.exists) throw new HttpsError("not-found", "Payment not found.");
const p = s.data();
if (p.status !== "paid" || !p.razorpayPaymentId) throw new HttpsError("failed-precondition", "Only paid payments can be refunded.");
const rf = await c.rzp.payments.refund(p.razorpayPaymentId, { amount: p.amount, speed: "normal", notes: { by: a.uid, note: String(note || "").slice(0, 200) } });
const upd = { status: "refunded", refundId: rf.id, refundedAt: FV.serverTimestamp() };
if (p.refundRequest) {
upd["refundRequest.status"] = "approved";
upd["refundRequest.adminNote"] = String(note || "").slice(0, 300);
upd["refundRequest.decidedAt"] = FV.serverTimestamp();
}
await ref.update(upd);
await revokeEntitlement(c, { ...p, id: paymentId });
await reverseCommission(c, paymentId);
return { ok: true, refundId: rf.id };
};

H.adminRejectRefund = async (c) => {
await needAdmin(c);
const { paymentId, note } = c.data || {};
const ref = c.db.doc(`payments/${paymentId}`);
const s = await ref.get();
if (!s.exists || !s.data().refundRequest) throw new HttpsError("failed-precondition", "No refund request.");
await ref.update({ "refundRequest.status": "rejected", "refundRequest.adminNote": String(note || "").slice(0, 300), "refundRequest.decidedAt": FV.serverTimestamp() });
return { ok: true };
};

// Re-check an order directly with Razorpay (fixes "user paid but nothing unlocked").
H.adminSyncPayment = async (c) => {
await needAdmin(c);
const { paymentId } = c.data || {};
const s = await c.db.doc(`payments/${paymentId}`).get();
if (!s.exists) throw new HttpsError("not-found", "Payment not found.");
const list = await c.rzp.orders.fetchPayments(paymentId);
const items = list.items || [];
const captured = items.find((x) => x.status === "captured");
if (captured) {
const r = await fulfill(c, paymentId, captured);
return { ok: r.ok, razorpayStatus: "captured", note: r.already ? "Already synced" : r.ok ? "Fixed: entitlement granted" : r.reason };
}
const last = items[items.length - 1];
return { ok: true, razorpayStatus: last ? last.status : "no payment attempt", note: "No captured payment found at Razorpay." };
};


/* ============================== creator program ============================== */
// Creators apply, the owner approves them and sets a username + commission %. Their link is SITE/?ref=<username>.
// Commission is calculated on the server from the real paid amount, never from anything the browser sends.
const sstr = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
const isUpi = (u) => /^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9.-]{1,30}$/.test(String(u || "").trim());
const cleanPhone = (p) => String(p || "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
const SOCIALS = ["instagram", "youtube", "facebook", "twitter", "linkedin", "tiktok"];
const PROMOS = ["Instagram Reels & Stories", "YouTube Videos & Shorts", "Facebook Posts & Groups", "WhatsApp Broadcast", "Twitter / X Posts", "TikTok Videos", "Telegram Channel", "Blog / Website Content", "Other"];

async function isApprovedCreator(c, uid) {
const s = await c.db.doc(`creators/${uid}`).get();
return s.exists && s.data().status === "approved";
}
// ?ref=username -> { uid, username } only if that creator is approved
async function resolveRef(c, ref, buyerUid) {
const u = normUsername(ref);
if (!validUsername(u)) return null;
const m = await c.db.doc(`creatorUsernames/${u}`).get();
if (!m.exists) return null;
const uid = m.data().uid;
if (uid === buyerUid) return null; // no self-referral
const cs = await c.db.doc(`creators/${uid}`).get();
if (!cs.exists || cs.data().status !== "approved") return null;
return { uid, username: u };
}
// Lifetime referral: the first creator link a person signs up / buys through keeps earning on every purchase they make.
async function referrerFor(c, uid, refParam) {
const us = await c.db.doc(`users/${uid}`).get();
const stored = us.exists && us.data().referredBy;
if (stored && stored.username) {
const r = await resolveRef(c, stored.username, uid).catch(() => null);
if (r) return r;
}
if (!refParam) return null;
const rf = await resolveRef(c, refParam, uid).catch(() => null);
if (rf && !(stored && stored.username)) await c.db.doc(`users/${uid}`).set({ referredBy: { username: rf.username, uid: rf.uid, at: Date.now() } }, { merge: true }).catch(() => {});
return rf;
}
// Called after a payment is marked paid. Idempotent (commissions/<orderId>).
async function recordCommission(c, orderId) {
try {
const ps = await c.db.doc(`payments/${orderId}`).get();
if (!ps.exists) return;
const p = ps.data();
if (p.status !== "paid" || !p.refUid) return;
const cRef = c.db.doc(`commissions/${orderId}`);
const crRef = c.db.doc(`creators/${p.refUid}`);
await c.db.runTransaction(async (tx) => {
if ((await tx.get(cRef)).exists) return;
const cs = await tx.get(crRef);
if (!cs.exists || cs.data().status !== "approved") return;
const cr = cs.data();
const k = commissionFor(cr, p.plan, p.cardId, p.amount);
tx.set(cRef, {
creatorUid: p.refUid, username: cr.username, paymentId: orderId, buyerUid: p.uid, buyerEmail: p.email || "",
plan: p.plan, cardId: p.cardId || null, amount: p.amount, pct: k.pct, commissionPaise: k.paise,
status: "active", createdAt: FV.serverTimestamp(),
});
tx.update(crRef, { sales: FV.increment(1) });
});
} catch (e) { console.error("recordCommission", e); }
}
async function reverseCommission(c, orderId) {
try {
const cRef = c.db.doc(`commissions/${orderId}`);
await c.db.runTransaction(async (tx) => {
const cs = await tx.get(cRef);
if (!cs.exists || cs.data().status !== "active") return;
tx.update(cRef, { status: "reversed", reversedAt: FV.serverTimestamp() });
tx.update(c.db.doc(`creators/${cs.data().creatorUid}`), { sales: FV.increment(-1) });
});
} catch (e) { console.error("reverseCommission", e); }
}
const cleanCommission = (id, d) => ({
id, plan: d.plan, cardId: d.cardId || null, amount: d.amount, pct: d.pct, commissionPaise: d.commissionPaise,
status: d.status, createdAt: ms(d.createdAt), buyerEmail: d.buyerEmail || "",
});
async function creatorMoney(c, uid) {
const [cq, pq] = await Promise.all([
c.db.collection("commissions").where("creatorUid", "==", uid).get(),
c.db.collection("payouts").where("creatorUid", "==", uid).get(),
]);
const commissions = cq.docs.map((d) => cleanCommission(d.id, d.data())).sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));
const payouts = pq.docs.map((d) => ({ id: d.id, amountPaise: d.data().amountPaise, note: d.data().note || "", at: ms(d.data().at) })).sort((x, y) => (y.at || 0) - (x.at || 0));
const earnedPaise = commissions.filter((x) => x.status === "active").reduce((t, x) => t + x.commissionPaise, 0);
const paidPaise = payouts.reduce((t, x) => t + x.amountPaise, 0);
return { commissions, payouts, earnedPaise, paidPaise, balancePaise: earnedPaise - paidPaise };
}
function cleanCardPct(v) {
const out = {};
if (v && typeof v === "object") for (const [k, val] of Object.entries(v)) {
if (val === "" || val == null) continue;
if (k !== "all" && !CARDS[k]) continue;
const n = clampPct(val); if (n != null) out[k] = n;
}
return out;
}
async function rateTable(c, cr) {
const pr = await getPricingDoc(c);
const row = (key, label, amount) => {
const k = commissionFor(cr, key === "all" ? "all" : "single", key, amount);
return { key, label, pct: k.pct, amountPaise: amount, earnPaise: k.paise };
};
return [row("all", "All Cards Pass", pr.all.amount), ...Object.entries(CARDS).map(([id, m]) => row(id, m[0], effectiveCard(pr, id).amount))];
}

H.creatorApply = async (c) => {
const a = await needActiveUser(c);
const d = c.data || {};
const firstName = sstr(d.firstName, 40), lastName = sstr(d.lastName, 40);
if (!firstName || !lastName) throw new HttpsError("invalid-argument", "Please enter your first and last name.");
const phone = cleanPhone(d.phone);
if (!/^\d{10}$/.test(phone)) throw new HttpsError("invalid-argument", "Please enter a 10-digit phone number.");
const socials = {};
for (const k of SOCIALS) { const v = sstr(d.socials && d.socials[k], 200); if (v) { if (!/^https?:\/\//i.test(v)) throw new HttpsError("invalid-argument", `Please paste a full link for ${k} (starting with https://).`); socials[k] = v; } }
if (!Object.keys(socials).length) throw new HttpsError("invalid-argument", "Add at least one social profile link.");
const promo = (Array.isArray(d.promo) ? d.promo : []).map((x) => sstr(x, 60)).filter((x) => PROMOS.includes(x)).slice(0, 10);
if (!promo.length) throw new HttpsError("invalid-argument", "Choose how you will promote WishVerse.");
const upi = sstr(d.upi, 64);
if (upi && !isUpi(upi)) throw new HttpsError("invalid-argument", "That UPI ID does not look right (example: name@okaxis).");
const ref = c.db.doc(`creators/${a.uid}`);
const ex = await ref.get();
if (ex.exists && ex.data().status !== "rejected") throw new HttpsError("failed-precondition", "ALREADY_APPLIED");
await ref.set({
uid: a.uid, email: lc(a.token.email), firstName, lastName, phone, telegram: sstr(d.telegram, 40), upi,
socials, promo, note: sstr(d.note, 500), status: "pending", clicks: 0, sales: 0, createdAt: FV.serverTimestamp(),
});
return { ok: true };
};

// One-time: every creator goes to the standard 20% (the owner can still change a creator or a card later).
async function ensurePct20(c) {
try {
const f = c.db.doc("config/migrations");
const m = await f.get();
if (m.exists && m.data().pct20) return;
const cs = await c.db.collection("creators").get();
for (const d of cs.docs) await d.ref.update({ commissionPct: DEFAULT_COMMISSION_PCT, cardPct: {} });
await f.set({ pct20: true }, { merge: true });
} catch (e) { console.error("ensurePct20", e); }
}
H.getMyCreator = async (c) => {
const a = needAuth(c);
await ensurePct20(c);
const s = await c.db.doc(`creators/${a.uid}`).get();
if (!s.exists) return { status: "none" };
const d = s.data();
const base = { status: d.status, name: `${d.firstName} ${d.lastName}`, upi: d.upi || "", phone: d.phone || "", telegram: d.telegram || "", adminNote: d.adminNote || "" };
if (d.status !== "approved" && d.status !== "suspended") return base;
const m = await creatorMoney(c, a.uid);
return {
...base, username: d.username, link: `${SITE}/?ref=${d.username}`, clicks: d.clicks || 0, sales: d.sales || 0,
...m, commissions: m.commissions.slice(0, 200), minPayoutPaise: MIN_PAYOUT_PAISE,
rates: d.status === "approved" ? await rateTable(c, d) : [],
};
};

H.creatorUpdatePayout = async (c) => {
const a = needAuth(c);
const ref = c.db.doc(`creators/${a.uid}`);
if (!(await ref.get()).exists) throw new HttpsError("failed-precondition", "Apply to the creator program first.");
const upi = sstr((c.data || {}).upi, 64);
if (!isUpi(upi)) throw new HttpsError("invalid-argument", "That UPI ID does not look right (example: name@okaxis).");
await ref.update({ upi });
return { ok: true };
};

// Public + cheap: count a visit on a creator link (the browser calls it once per day per creator).
H.claimRef = async (c) => { // called once after login when the visitor came through a creator link
const a = needAuth(c);
const rf = await referrerFor(c, a.uid, (c.data || {}).ref);
return { ok: true, linked: !!rf };
};
H.trackRef = async (c) => {
try {
const u = normUsername((c.data || {}).ref);
if (!validUsername(u)) return { ok: true };
const m = await c.db.doc(`creatorUsernames/${u}`).get();
if (m.exists) await c.db.doc(`creators/${m.data().uid}`).update({ clicks: FV.increment(1) });
} catch (e) { console.error("trackRef", e); }
return { ok: true };
};

/* --- owner side --- */
H.adminListCreators = async (c) => {
needOwner(c);
await ensurePct20(c);
const [cs, cm, po] = await Promise.all([c.db.collection("creators").get(), c.db.collection("commissions").get(), c.db.collection("payouts").get()]);
const earned = {}, paid = {}, salesN = {};
for (const d of cm.docs) { const x = d.data(); if (x.status === "active") { earned[x.creatorUid] = (earned[x.creatorUid] || 0) + x.commissionPaise; salesN[x.creatorUid] = (salesN[x.creatorUid] || 0) + 1; } }
for (const d of po.docs) { const x = d.data(); paid[x.creatorUid] = (paid[x.creatorUid] || 0) + x.amountPaise; }
const creators = cs.docs.map((d) => {
const x = d.data(), e = earned[d.id] || 0, p = paid[d.id] || 0;
return {
uid: d.id, email: x.email, name: `${x.firstName} ${x.lastName}`, phone: x.phone, telegram: x.telegram || "", upi: x.upi || "",
socials: x.socials || {}, promo: x.promo || [], note: x.note || "", status: x.status, username: x.username || "",
commissionPct: x.commissionPct != null ? x.commissionPct : DEFAULT_COMMISSION_PCT, cardPct: x.cardPct || {},
clicks: x.clicks || 0, sales: salesN[d.id] || 0, earnedPaise: e, paidPaise: p, balancePaise: e - p,
createdAt: ms(x.createdAt), adminNote: x.adminNote || "",
};
}).sort((a, b) => ({ pending: 0, approved: 1, suspended: 2, rejected: 3 }[a.status] - { pending: 0, approved: 1, suspended: 2, rejected: 3 }[b.status]) || (b.createdAt || 0) - (a.createdAt || 0));
return { creators, cards: Object.fromEntries(Object.entries(CARDS).map(([id, m]) => [id, m[0]])), defaultPct: DEFAULT_COMMISSION_PCT, minPayoutPaise: MIN_PAYOUT_PAISE };
};

H.adminCreatorDecide = async (c) => {
const a = needOwner(c);
const { uid, action, note } = c.data || {};
const ref = c.db.doc(`creators/${uid}`);
const s = await ref.get();
if (!s.exists) throw new HttpsError("not-found", "Creator not found.");
const cur = s.data();
const stamp = { decidedAt: FV.serverTimestamp(), decidedBy: a.token.email || "", adminNote: sstr(note, 300) };
if (action === "reject") { await ref.update({ status: "rejected", ...stamp }); return { ok: true }; }
if (action === "suspend") { await ref.update({ status: "suspended", ...stamp }); return { ok: true }; }
if (action !== "approve" && action !== "unsuspend") throw new HttpsError("invalid-argument", "Unknown action.");
let username = cur.username || "";
const upd = { status: "approved", ...stamp };
if (!username) {
username = normUsername((c.data || {}).username);
if (!validUsername(username) || RESERVED_USERNAMES.has(username)) throw new HttpsError("invalid-argument", "Username must be 3-24 letters, numbers, - or _ (not a reserved word).");
const uRef = c.db.doc(`creatorUsernames/${username}`);
await c.db.runTransaction(async (tx) => {
const us = await tx.get(uRef);
if (us.exists && us.data().uid !== uid) throw new HttpsError("already-exists", "That username is already taken.");
tx.set(uRef, { uid });
});
upd.username = username;
}
const pct = (c.data || {}).commissionPct;
if (pct !== undefined && pct !== "") { const n = clampPct(pct); if (n == null) throw new HttpsError("invalid-argument", "Commission % is not valid."); upd.commissionPct = n; }
else if (cur.commissionPct == null) upd.commissionPct = DEFAULT_COMMISSION_PCT;
if ((c.data || {}).cardPct) upd.cardPct = cleanCardPct(c.data.cardPct);
await ref.update(upd);
return { ok: true, username };
};

H.adminSetCreatorCommission = async (c) => {
needOwner(c);
const { uid, commissionPct, cardPct } = c.data || {};
const ref = c.db.doc(`creators/${uid}`);
if (!(await ref.get()).exists) throw new HttpsError("not-found", "Creator not found.");
const n = clampPct(commissionPct);
if (n == null) throw new HttpsError("invalid-argument", "Commission % is not valid.");
await ref.update({ commissionPct: n, cardPct: cleanCardPct(cardPct) });
return { ok: true };
};

H.adminCreatorDetail = async (c) => {
needOwner(c);
const uid = String((c.data || {}).uid || "");
const m = await creatorMoney(c, uid);
return { ...m, commissions: m.commissions.slice(0, 300) };
};

H.adminRecordPayout = async (c) => {
const a = needOwner(c);
const { uid, amount, note } = c.data || {};
const rupees = Number(amount);
if (!Number.isFinite(rupees) || rupees <= 0) throw new HttpsError("invalid-argument", "Enter the amount you paid (in rupees).");
const paise = Math.round(rupees * 100);
if (!(await c.db.doc(`creators/${uid}`).get()).exists) throw new HttpsError("not-found", "Creator not found.");
const m = await creatorMoney(c, uid);
if (paise > m.balancePaise) throw new HttpsError("failed-precondition", "That is more than the balance owed.");
await c.db.collection("payouts").add({ creatorUid: uid, amountPaise: paise, note: sstr(note, 200), by: a.token.email || "", at: FV.serverTimestamp() });
return { ok: true, balancePaise: m.balancePaise - paise };
};

/* ------------------------------- pricing ------------------------------- */
H.getPricing = async (c) => getPricingDoc(c);
H.adminSetPricing = async (c) => {
await needAdmin(c);
const v = normalizePricing(c.data);
if (!v.ok) throw new HttpsError("invalid-argument", v.error);
await c.db.doc("config/pricing").set(v.value, { merge: true }); // keeps per-card settings
return v.value;
};
// Per card: own price, free switch, bonus (bundle) cards. price "" = use the One Card price.
H.adminSetCardConfig = async (c) => {
await needAdmin(c);
const { cardId } = c.data || {};
const v = normalizeCardConfig(cardId, c.data);
if (!v.ok) throw new HttpsError("invalid-argument", v.error);
const ref = c.db.doc("config/pricing");
const s = await ref.get();
const empty = !v.value.free && !v.value.bonus.length && v.value.amount == null;
if (!s.exists) { if (!empty) await ref.set({ cards: { [cardId]: v.value } }); }
else await ref.update({ [`cards.${cardId}`]: empty ? FV.delete() : v.value }); // replaces this card's settings as a whole
return { ok: true };
};
H.adminSetUses = async (c) => {
await needAdmin(c);
const n = Number((c.data || {}).usesPerCard);
if (!Number.isInteger(n) || n < 1 || n > MAX_USES_PER_CARD) throw new HttpsError("invalid-argument", `Uses per card must be 1 to ${MAX_USES_PER_CARD}.`);
await c.db.doc("config/pricing").set({ usesPerCard: n }, { merge: true });
return { ok: true, usesPerCard: n };
};

/* ------------------------ free plans given by admins ------------------------ */
H.adminGrantPlan = async (c) => {
const a = await needAdmin(c);
const { email, plan, cardId, note } = c.data || {};
if (!isEmail(email)) throw new HttpsError("invalid-argument", "Enter a valid email.");
if (!PLANS[plan]) throw new HttpsError("invalid-argument", "Unknown plan.");
if (plan === "single" && !CARDS[cardId]) throw new HttpsError("invalid-argument", "Choose a card.");
const g = { plan, cardId: plan === "single" ? cardId : null, note: String(note || "").slice(0, 200), by: a.token.email || a.uid };
const user = await c.authAdmin.getUserByEmail(lc(email));
if (user) { await grantEntitlement(c, user.uid, email, g); return { ok: true, status: "granted" }; }
// Not signed up yet: it will be applied automatically on their first Google login.
const ref = c.db.doc(`pendingGrants/${lc(email)}`);
const s = await ref.get();
const grants = s.exists ? s.data().grants || [] : [];
grants.push(g);
await ref.set({ grants, updatedAt: FV.serverTimestamp() });
return { ok: true, status: "pending" };
};
H.adminRevokeGrant = async (c) => {
await needAdmin(c);
const ref = c.db.doc(`payments/${(c.data || {}).paymentId}`);
const s = await ref.get();
if (!s.exists || s.data().status !== "granted") throw new HttpsError("failed-precondition", "Only granted plans can be revoked.");
await ref.update({ status: "revoked", refundedAt: FV.serverTimestamp() });
await revokeEntitlement(c, s.data());
return { ok: true };
};
H.adminListPending = async (c) => {
await needAdmin(c);
const s = await c.db.collection("pendingGrants").get();
return { pending: s.docs.map((d) => ({ email: d.id, grants: d.data().grants || [] })) };
};
H.adminCancelPending = async (c) => { await needAdmin(c); await c.db.doc(`pendingGrants/${lc((c.data || {}).email)}`).delete(); return { ok: true }; };

/* ------------------------------ owner: admins ------------------------------ */
H.adminListAdmins = async (c) => {
needOwner(c);
const s = await c.db.collection("admins").get();
return { owner: OWNER(c.env), admins: s.docs.map((d) => ({ email: d.id, addedBy: d.data().addedBy || "" })) };
};
H.adminAddAdmin = async (c) => {
const a = needOwner(c);
const email = lc((c.data || {}).email);
if (!isEmail(email)) throw new HttpsError("invalid-argument", "Enter a valid Gmail address.");
if (email === OWNER(c.env)) throw new HttpsError("failed-precondition", "That is already the owner.");
await c.db.doc(`admins/${email}`).set({ addedBy: a.token.email, at: FV.serverTimestamp() });
return { ok: true };
};
H.adminRemoveAdmin = async (c) => {
needOwner(c);
const email = lc((c.data || {}).email);
if (email === OWNER(c.env)) throw new HttpsError("failed-precondition", "Owner cannot be removed.");
await c.db.doc(`admins/${email}`).delete();
return { ok: true };
};

/* ================================== router ================================== */
function corsHeaders(request, env) {
const origin = request.headers.get("Origin") || "";
const allowed = String(env.ALLOWED_ORIGINS || SITE).split(",").map((s) => s.trim());
const h = { "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Max-Age": "86400", Vary: "Origin" };
if (allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
return h;
}
const json = (obj, status, extra) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra } });

async function handle(request, env) {
const url = new URL(request.url);
const cors = corsHeaders(request, env);
if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
const path = url.pathname.replace(/\/+$/, "") || "/";
if (request.method === "GET" && path === "/") return json({ ok: true, service: "wishverse-api" }, 200, cors);
const c = { env, db: makeDb(env), authAdmin: makeAuthAdmin(env), rzp: makeRzp(env), origin: url.origin, auth: null, data: {} };

// public link-preview page (WhatsApp / Instagram / Telegram read og: tags, people get redirected)
if (request.method === "GET" && (path === "/wishShare" || path.startsWith("/s/"))) {
const id = String(url.searchParams.get("id") || path.split("/").filter(Boolean).pop() || "");
if (!validWishId(id)) return Response.redirect(SITE, 302);
let wish = null;
try { const s = await c.db.doc(`wishes/${id}`).get(); if (s.exists) wish = s.data(); } catch (e) { console.error("wishShare", e); }
const expired = !!wish && isWishExpired(wish);
return new Response(shareHtml(id, expired ? null : wish, expired), { status: expired ? 200 : wish ? 200 : 404, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}
if (request.method !== "POST") return json({ error: { code: "not-found", message: "Not found" } }, 404, cors);

// Razorpay -> server. Source of truth even if the customer closes the tab after paying.
if (path === "/razorpayWebhook") {
const raw = await request.text();
const expect = await hmacHex(env.RAZORPAY_WEBHOOK_SECRET || "", raw);
if (!env.RAZORPAY_WEBHOOK_SECRET || !safeEq(expect, request.headers.get("X-Razorpay-Signature") || "")) {
await logEvent(c, "bad_webhook_signature", "", "", request.headers.get("CF-Connecting-IP") || "");
return new Response("bad signature", { status: 400 });
}
try { await webhook(c, JSON.parse(raw)); } catch (e) { console.error("webhook", e); return new Response("error", { status: 500 }); }
return new Response("ok");
}

const name = path.slice(1);
if (!Object.prototype.hasOwnProperty.call(H, name)) return json({ error: { code: "not-found", message: "Unknown endpoint" } }, 404, cors);
try { c.data = (await request.json()) || {}; } catch { c.data = {}; }
if (c.data && typeof c.data === "object" && "data" in c.data && Object.keys(c.data).length === 1) c.data = c.data.data || {};
const bearer = /^Bearer (.+)$/.exec(request.headers.get("Authorization") || "");
if (bearer) {
try { const p = await verifyIdToken(bearer[1], env); c.auth = { uid: p.sub, token: { email: p.email || "", email_verified: !!p.email_verified, firebase: p.firebase || {} } }; }
catch { c.auth = null; }
}
try { return json({ result: await H[name](c) }, 200, cors); }
catch (e) {
if (e instanceof HttpsError) return json({ error: { code: e.code, message: e.message } }, HTTP[e.code] || 500, cors);
console.error(name, e && e.stack || e);
return json({ error: { code: "internal", message: "Server error. Please try again." } }, 500, cors);
}
}

export default { fetch: (request, env) => handle(request, env) };
