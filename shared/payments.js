// Shared client for auth + Cloud Functions (payments, account, admin).
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

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
const functions = getFunctions(app, "asia-south1");

export const call = async (name, data = {}) => (await httpsCallable(functions, name)(data)).data;

// Resolves once Firebase has decided whether someone is logged in.
export const waitForUser = () => new Promise((res) => {
  const off = onAuthStateChanged(auth, (u) => { off(); res(u); });
});
export const logout = () => signOut(auth);

export const DEFAULT_PRICING = { single: { amount: 3500, old: 29900 }, all: { amount: 9900, old: 99900 } };
export const inr = (paise) => "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
export const offPct = (a, o) => (o > a ? Math.round((1 - a / o) * 100) : 0);
// Calls cb(prices) right away with cached/default prices, then again with the live ones.
export function loadPricing(cb) {
  let cur = DEFAULT_PRICING;
  try { const c = JSON.parse(sessionStorage.getItem("wv-pricing")); if (c && c.single && c.all) cur = c; } catch {}
  cb(cur);
  httpsCallable(functions, "getPricing")({}).then((r) => {
    try { sessionStorage.setItem("wv-pricing", JSON.stringify(r.data)); } catch {}
    cb(r.data);
  }).catch(() => {});
}
export const rupees = (paise) => "₹" + (paise / 100).toLocaleString("en-IN");
export const fmtDate = (ms) => ms ? new Date(ms).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Opens Razorpay Checkout for a plan. Resolves {ok:true} or {ok:false,cancelled:true|error}.
export async function startCheckout(plan, cardId) {
  await loadCheckoutScript();
  const o = await call("createOrder", { plan, cardId });
  return new Promise((resolve) => {
    const rz = new window.Razorpay({
      key: o.keyId, order_id: o.orderId, amount: o.amount, currency: o.currency,
      name: "WishVerse", description: o.label, prefill: { email: o.email },
      theme: { color: "#8bd8ff" },
      handler: async (r) => {
        try { await call("verifyPayment", r); resolve({ ok: true }); }
        catch (e) { resolve({ ok: false, error: e.message || "Verification failed. If money was deducted it will be unlocked shortly." }); }
      },
      modal: { ondismiss: () => resolve({ ok: false, cancelled: true }) },
    });
    rz.on("payment.failed", (resp) => {
      call("reportPaymentFailure", { orderId: o.orderId, description: resp?.error?.description }).catch(() => {});
    });
    rz.open();
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
