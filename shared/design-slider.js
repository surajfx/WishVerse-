// Swipe slider that shows every design of a card. Used on the card page and inside the create wizard.
//   mountDesignSlider(element, card, { selected, onSelect(designId), demoHref(designId) })
import { designsFor } from "../cards/designs.js";

const CSS = `
.dz{position:relative}
.dz-track{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;padding:4px 2px 10px;scrollbar-width:none}
.dz-track::-webkit-scrollbar{display:none}
.dz-slide{flex:0 0 78%;max-width:300px;scroll-snap-align:center;border:2px solid var(--border);border-radius:22px;background:var(--surface);overflow:hidden;display:flex;flex-direction:column;transition:border-color .2s,transform .2s}
.dz-slide.on{border-color:var(--primary);box-shadow:0 10px 28px rgba(255,46,126,.18)}
.dz-art{height:190px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;background-size:cover;background-position:center;position:relative}
.dz-art .ic{font-size:58px;filter:drop-shadow(0 6px 14px rgba(0,0,0,.3))}
.dz-art b{font-size:15px;margin-top:6px;text-shadow:0 2px 8px rgba(0,0,0,.35)}
.dz-tick{position:absolute;top:10px;right:10px;width:30px;height:30px;border-radius:50%;background:#fff;color:#e8346f;display:none;place-items:center;font-weight:800}
.dz-slide.on .dz-tick{display:grid}
.dz-body{padding:12px 14px 14px;display:grid;gap:8px}
.dz-name{font-weight:800;font-size:16px;color:var(--text)}
.dz-row{display:flex;gap:8px}
.dz-btn{flex:1;border:1px solid var(--border);background:var(--surface2);color:var(--text);border-radius:12px;padding:10px 8px;font-weight:700;font-size:14px;text-align:center;text-decoration:none;cursor:pointer;min-height:42px;box-sizing:border-box}
.dz-btn.pick{background:var(--brand);color:#fff;border-color:transparent}
.dz-soon{justify-content:center;align-items:center;text-align:center;color:var(--muted);border-style:dashed;min-height:300px;padding:20px;font-weight:700;line-height:1.6}
.dz-soon span{font-size:38px;display:block;margin-bottom:8px}
.dz-dots{display:flex;justify-content:center;gap:7px;margin-top:4px}
.dz-dots i{width:8px;height:8px;border-radius:50%;background:var(--border);transition:.2s}
.dz-dots i.on{background:var(--primary);width:22px;border-radius:8px}
.dz-hint{text-align:center;color:var(--muted);font-size:13px;margin:6px 0 0}
`;

export function mountDesignSlider(el, card, opts = {}) {
  if (!document.getElementById("dz-css")) { const st = document.createElement("style"); st.id = "dz-css"; st.textContent = CSS; document.head.appendChild(st); }
  const list = designsFor(card.id);
  const multi = list.length > 1;
  let sel = opts.selected && list.some((d) => d.id === opts.selected) ? opts.selected : list[0].id;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const paint = () => {
    el.innerHTML = `<div class="dz"><div class="dz-track">${list.map((d) => `
      <div class="dz-slide ${d.id === sel ? "on" : ""}" data-d="${esc(d.id)}">
        <div class="dz-art ${d.preview ? "" : card.art}" ${d.preview ? `style="background-image:url('${esc(d.preview)}')"` : ""}>
          ${d.preview ? "" : `<span class="ic">${card.icon}</span>`}<b>${esc(d.name)}</b><span class="dz-tick">✓</span>
        </div>
        <div class="dz-body"><div class="dz-name">${esc(d.name)}</div>
          <div class="dz-row">${opts.demoHref ? `<a class="dz-btn" href="${esc(opts.demoHref(d.id))}">👁 Live Demo</a>` : ""}${multi ? `<button type="button" class="dz-btn pick" data-pick="${esc(d.id)}">${d.id === sel ? "Selected ✓" : "Choose"}</button>` : ""}</div>
        </div>
      </div>`).join("")}
      <div class="dz-slide dz-soon"><div><span>✨</span>More designs coming soon</div></div>
    </div><div class="dz-dots">${list.map((d, i) => `<i class="${i === 0 ? "on" : ""}"></i>`).join("")}<i></i></div>
    ${multi ? '<p class="dz-hint">Swipe to see every design. Tap Choose to pick one.</p>' : ""}</div>`;
    const track = el.querySelector(".dz-track"), dots = [...el.querySelectorAll(".dz-dots i")];
    const slides = [...track.querySelectorAll(".dz-slide")];
    track.addEventListener("scroll", () => {
      const mid = track.scrollLeft + track.clientWidth / 2;
      let best = 0, bd = 1e9; slides.forEach((s, i) => { const d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - mid); if (d < bd) { bd = d; best = i; } });
      dots.forEach((x, i) => x.classList.toggle("on", i === best));
    }, { passive: true });
    el.querySelectorAll("[data-pick]").forEach((b) => b.onclick = () => {
      sel = b.dataset.pick; const sc = track.scrollLeft; paint(); const t = el.querySelector(".dz-track"); t.scrollLeft = sc;
      opts.onSelect && opts.onSelect(sel);
    });
  };
  paint();
  return { get selected() { return sel; } };
}
