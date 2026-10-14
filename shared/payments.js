// Shared client for auth + Cloud Functions (payments, account, admin).
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { API_BASE } from "./config.js";

const firebaseConfig = {
  apiKey: "AIzaSyDhH_fplGM0SYhXYQyGEmSgsxchuUgi43I",
  authDomain: "surajfx2.firebaseapp.com",
  databaseURL: "https://surajfx2-default-rtdb.firebaseio.com",
  projectId: "surajfx2",
  storageBucket: "surajfx2.firebasestorage.app",
  messagingSenderId: "386646596801",
  appId: "1:386646596801:web:db3b3fc2a212d644b28840",
  measurementId: "G-N6KNJJ5B3D"
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
const NOT_READY = "The WishVerse server is not connected yet. If you are the site owner, finish the Cloudflare Worker setup (see setup guide), then try again.";
const notReady = () => { const e = new Error(NOT_READY); e.code = "SERVER_NOT_READY"; return e; };
// Calls the WishVerse API (Cloudflare Worker). Sends the Firebase login token so the server knows who you are.
export const call = async (name, data = {}) => {
  if (!API_BASE || API_BASE.includes("YOUR-")) throw notReady();
  const headers = { "Content-Type": "application/json" };
  const u = auth.currentUser;
  if (u) { try { headers.Authorization = "Bearer " + (await u.getIdToken()); } catch {} }
  let res;
  try { res = await fetch(`${API_BASE}/${name}`, { method: "POST", headers, body: JSON.stringify(data) }); }
  catch { throw notReady(); }
  let j = null;
  try { j = await res.json(); } catch {}
  if (!j) throw notReady();
  if (j.error) { const e = new Error(j.error.message || "Something went wrong."); e.code = j.error.code; throw e; }
  return j.result;
};

// Resolves once Firebase has decided whether someone is logged in.
export const waitForUser = () => new Promise((res) => {
  const off = onAuthStateChanged(auth, (u) => { off(); res(u); });
});
export const logout = () => signOut(auth);

export const DEFAULT_PRICING = { single: { amount: 3500, old: 29900 }, all: { amount: 9900, old: 99900 }, cards: {}, usesPerCard: 7 };
// Price / free / bundle settings of one card (admin can set them per card).
export function cardPrice(pr, id) {
  pr = pr || DEFAULT_PRICING;
  const c = (pr.cards && pr.cards[id]) || {};
  const own = Number.isInteger(c.amount);
  const single = pr.single || DEFAULT_PRICING.single;
  return { amount: own ? c.amount : single.amount, old: own ? (c.old || 0) : (single.old || 0), free: !!c.free, bonus: Array.isArray(c.bonus) ? c.bonus : [] };
}
export const inr = (paise) => "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
export const offPct = (a, o) => (o > a ? Math.round((1 - a / o) * 100) : 0);
// Calls cb(prices) right away with cached/default prices, then again with the live ones.
export function loadPricing(cb) {
  let cur = DEFAULT_PRICING;
  try { const c = JSON.parse(sessionStorage.getItem("wv-pricing")); if (c && c.single && c.all) cur = c; } catch {}
  cb(cur);
  call("getPricing").then((r) => {
    try { sessionStorage.setItem("wv-pricing", JSON.stringify(r)); } catch {}
    cb(r);
  }).catch(() => {});
}
export const rupees = (paise) => "₹" + (paise / 100).toLocaleString("en-IN");
export const fmtDate = (ms) => ms ? new Date(ms).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Opens Razorpay Checkout for a plan. Resolves {ok:true} or {ok:false,cancelled:true|error}.
// hooks (optional): onOpen() when the Razorpay window opens, onVerifying() after the customer paid.
export async function startCheckout(plan, cardId, hooks = {}) {
  await loadCheckoutScript();
  let ref = ""; try { const r = JSON.parse(localStorage.getItem("wv-ref")); if (r && r.u && Date.now() - r.t < 30 * 86400000) ref = r.u; } catch {}
  const o = await call("createOrder", { plan, cardId, ref });
  return new Promise((resolve) => {
    const rz = new window.Razorpay({
      key: o.keyId, order_id: o.orderId, amount: o.amount, currency: o.currency,
      name: "WishVerse", description: o.label, prefill: { email: o.email },
      theme: { color: "#e8346f" },
      retry: { enabled: true },
      handler: async (r) => {
        try { hooks.onVerifying && hooks.onVerifying(); } catch {}
        try { await call("verifyPayment", r); resolve({ ok: true }); }
        catch (e) { resolve({ ok: false, error: e.message || "Verification failed. If money was deducted it will be unlocked shortly." }); }
      },
      modal: { ondismiss: () => resolve({ ok: false, cancelled: true }) },
    });
    rz.on("payment.failed", (resp) => {
      call("reportPaymentFailure", { orderId: o.orderId, description: resp?.error?.description }).catch(() => {});
    });
    rz.open();
    try { hooks.onOpen && hooks.onOpen(); } catch {}
  });
}
function loadCheckoutScript() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = res; s.onerror = () => rej(new Error("Could not load Razorpay. Check your internet."));
    document.head.appendChild(s);
  });
}
