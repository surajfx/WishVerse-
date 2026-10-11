// Branded payment popup around Razorpay Checkout: confirm sheet -> secure window -> verifying
// -> animated success (check + confetti) or failure (cross + retry). Works in light and night theme.
import { startCheckout } from "./payments.js";

const CSS = `
.pm-back{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:16px;background:rgba(18,10,28,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity .25s}
.pm-back.on{opacity:1}
.pm{width:min(420px,100%);border-radius:28px;padding:26px 22px 22px;text-align:center;background:var(--surface,#fff);color:var(--text,#1b1530);border:1px solid var(--border,rgba(0,0,0,.08));box-shadow:0 30px 80px rgba(0,0,0,.35);transform:translateY(24px) scale(.96);transition:transform .35s cubic-bezier(.2,1.2,.3,1);position:relative;overflow:hidden;font-family:inherit}
.pm-back.on .pm{transform:none}
.pm h3{margin:12px 0 4px;font-size:22px;font-family:inherit;font-weight:800}
.pm p{margin:4px 0;color:var(--muted,#6b647a);font-size:14.5px;line-height:1.55}
.pm-ico{width:74px;height:74px;margin:0 auto;border-radius:24px;display:grid;place-items:center;font-size:38px;background:linear-gradient(135deg,#ff7aa8,#c2418f);box-shadow:0 10px 26px rgba(232,52,111,.35);animation:pmFloat 3s ease-in-out infinite}
.pm-price{font-size:40px;font-weight:800;margin:14px 0 2px;letter-spacing:-.5px}
.pm-price small{font-size:14px;font-weight:600;color:var(--muted,#6b647a);margin-left:6px}
.pm-list{list-style:none;padding:0;margin:14px 0 16px;text-align:left;display:grid;gap:8px;font-size:14px}
.pm-list li{display:flex;gap:10px;align-items:center;padding:9px 12px;border-radius:12px;background:var(--surface2,rgba(0,0,0,.04))}
.pm-list li i{font-style:normal;color:#17a56b;font-weight:800}
.pm-btn{width:100%;border:0;border-radius:16px;min-height:52px;font-weight:700;font-size:16px;font-family:inherit;color:#fff;cursor:pointer;background:linear-gradient(135deg,#ff5c93,#d6336c);box-shadow:0 10px 24px rgba(214,51,108,.4);transition:transform .15s,box-shadow .15s}
.pm-btn:hover{transform:translateY(-1px)}.pm-btn:active{transform:scale(.98)}
.pm-btn.ghost{background:transparent;color:var(--muted,#6b647a);box-shadow:none;min-height:42px;margin-top:6px;font-weight:600}
.pm-secure{margin-top:12px;font-size:12.5px;color:var(--muted,#6b647a)}
.pm-note{margin:10px 0 0;padding:9px 12px;border-radius:12px;font-size:13.5px;background:color-mix(in srgb,#f59e0b 16%,transparent);color:var(--text,#1b1530)}
.pm-spin{width:64px;height:64px;margin:6px auto 0;border-radius:50%;border:5px solid color-mix(in srgb,#d6336c 18%,transparent);border-top-color:#d6336c;animation:pmSpin .9s linear infinite}
.pm-dots span{display:inline-block;width:7px;height:7px;margin:0 3px;border-radius:50%;background:#d6336c;animation:pmDot 1.2s infinite}
.pm-dots span:nth-child(2){animation-delay:.18s}.pm-dots span:nth-child(3){animation-delay:.36s}
.pm-steps{display:flex;justify-content:center;gap:8px;margin:16px 0 4px}
.pm-steps b{width:30px;height:5px;border-radius:9px;background:color-mix(in srgb,var(--muted,#6b647a) 28%,transparent);transition:background .3s}
.pm-steps b.d{background:#d6336c}
.pm-svg{width:96px;height:96px;margin:4px auto 0;display:block}
.pm-svg circle{fill:none;stroke-width:5;stroke-linecap:round;stroke-dasharray:289;stroke-dashoffset:289;animation:pmDraw .7s .05s ease forwards}
.pm-svg path{fill:none;stroke-width:6;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:60;stroke-dashoffset:60;animation:pmDraw .45s .65s ease forwards}
.pm-ok circle,.pm-ok path{stroke:#17a56b}.pm-bad circle,.pm-bad path{stroke:#e5484d}
.pm-bad{animation:pmShake .5s .9s}
.pm-pop{animation:pmPop .5s .2s both}
.pm canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.pm-x{position:absolute;top:10px;right:12px;border:0;background:transparent;font-size:22px;color:var(--muted,#6b647a);cursor:pointer;line-height:1;padding:6px}
@keyframes pmSpin{to{transform:rotate(360deg)}}
@keyframes pmDraw{to{stroke-dashoffset:0}}
@keyframes pmDot{0%,80%,100%{transform:scale(.5);opacity:.4}40%{transform:scale(1);opacity:1}}
@keyframes pmFloat{50%{transform:translateY(-5px)}}
@keyframes pmPop{from{transform:scale(.7);opacity:0}to{transform:none;opacity:1}}
@keyframes pmShake{20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
@media (prefers-reduced-motion:reduce){.pm *,.pm{animation-duration:.01s!important;animation-delay:0s!important;transition-duration:.01s!important}}
`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function confetti(cv) {
  const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = r.width * dpr; cv.height = r.height * dpr;
  const g = cv.getContext("2d"); g.scale(dpr, dpr);
  const cols = ["#ff5c93", "#ffd166", "#17a56b", "#6c8cff", "#c084fc", "#fb923c"];
  const ps = Array.from({ length: 70 }, () => ({
    x: r.width / 2, y: r.height * 0.28, vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 9 - 3,
    s: 5 + Math.random() * 5, c: cols[(Math.random() * cols.length) | 0], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
  }));
  let t = 0;
  (function tick() {
    g.clearRect(0, 0, r.width, r.height);
    ps.forEach((p) => { p.vy += 0.28; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.c; g.globalAlpha = Math.max(0, 1 - t / 110); g.fillRect(-p.s / 2, -p.s / 3, p.s, p.s / 1.6); g.restore(); });
    if (++t < 110) requestAnimationFrame(tick); else g.clearRect(0, 0, r.width, r.height);
  })();
}

/**
 * payWithPopup({ plan, cardId, icon, name, price, perks[], doneLabel, onDone })
 * Resolves {ok:true} after success is shown and closed, {ok:false} if the person leaves without paying.
 */
export function payWithPopup(o) {
  if (!document.getElementById("pm-css")) { const st = document.createElement("style"); st.id = "pm-css"; st.textContent = CSS; document.head.appendChild(st); }
  return new Promise((resolve) => {
    const back = document.createElement("div"); back.className = "pm-back";
    back.innerHTML = '<div class="pm" role="dialog" aria-modal="true" aria-live="polite"></div>';
    document.body.appendChild(back); document.body.style.overflow = "hidden";
    const box = back.firstChild; let busy = false, result = { ok: false };
    requestAnimationFrame(() => back.classList.add("on"));
    const close = () => { if (busy) return; back.classList.remove("on"); document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); setTimeout(() => back.remove(), 250); resolve(result); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    back.addEventListener("click", (e) => { if (e.target === back) close(); });
    const steps = (n) => `<div class="pm-steps">${[1, 2, 3].map((i) => `<b class="${i <= n ? "d" : ""}"></b>`).join("")}</div>`;

    const confirmView = (note) => {
      box.innerHTML = `<button class="pm-x" aria-label="Close">×</button>
        <div class="pm-ico">${esc(o.icon || "✨")}</div><h3>${esc(o.name)}</h3>
        <div class="pm-price">${esc(o.price)}<small>one-time</small></div>
        <ul class="pm-list">${(o.perks || ["Unlocks instantly after payment", "7 creations for each unlocked card", "Pay with UPI, cards, netbanking or wallets"]).map((p) => `<li><i>✓</i>${esc(p)}</li>`).join("")}</ul>
        ${note ? `<div class="pm-note">${esc(note)}</div>` : ""}
        <button class="pm-btn" id="pmGo" style="margin-top:14px">Pay ${esc(o.price)} securely</button>
        <button class="pm-btn ghost" id="pmNo">Not now</button>
        <div class="pm-secure">🔒 Secured by Razorpay · We never see your card or UPI details</div>`;
      box.querySelector(".pm-x").onclick = close; box.querySelector("#pmNo").onclick = close;
      box.querySelector("#pmGo").onclick = go;
    };
    const wait = (title, sub, n) => { box.innerHTML = `<div class="pm-spin" style="margin-top:18px"></div><h3>${title}</h3><p>${sub}</p><p class="pm-dots"><span></span><span></span><span></span></p>${steps(n)}`; };
    const success = () => {
      busy = false; result = { ok: true };
      box.innerHTML = `<canvas></canvas><svg class="pm-svg pm-ok" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/><path d="M30 52l14 14 27-30"/></svg>
        <h3 class="pm-pop">Payment successful 🎉</h3><p class="pm-pop">Your plan is unlocked. You can create your wish now.</p>${steps(3)}
        <button class="pm-btn" id="pmDone" style="margin-top:16px">${esc(o.doneLabel || "Continue")}</button>`;
      try { confetti(box.querySelector("canvas")); } catch {}
      box.querySelector("#pmDone").onclick = () => { close(); if (o.onDone) o.onDone(); };
    };
    const failure = (msg) => {
      busy = false;
      box.innerHTML = `<svg class="pm-svg pm-bad" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/><path d="M34 34l32 32M66 34L34 66"/></svg>
        <h3 class="pm-pop">Payment did not go through</h3><p class="pm-pop">${esc(msg || "Something went wrong. You were not charged.")}</p>
        <button class="pm-btn" id="pmRetry" style="margin-top:16px">Try again</button><button class="pm-btn ghost" id="pmClose">Close</button>`;
      box.querySelector("#pmRetry").onclick = () => confirmView(); box.querySelector("#pmClose").onclick = close;
    };
    async function go() {
      busy = true; wait("Preparing secure payment", "Setting up your order…", 1);
      try {
        const r = await startCheckout(o.plan, o.cardId, {
          onOpen: () => wait("Complete the payment", "Finish paying in the Razorpay window. Please do not close this page.", 2),
          onVerifying: () => wait("Confirming your payment", "Checking with the bank. This takes a few seconds…", 3),
        });
        if (r.ok) return success();
        busy = false;
        if (r.cancelled) return confirmView("Payment cancelled. You were not charged.");
        failure(r.error);
      } catch (e) { failure(e && e.message); }
    }
    confirmView();
  });
}
