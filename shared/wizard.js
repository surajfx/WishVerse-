// Step-by-step "create your wish" wizard. One screen = one scene, with Back / Continue on every screen.
//   openWizard({ card, designId, upload(file)->url, submit(payload)->{link}, toast(msg), onClose() })
import { designsFor } from "../cards/designs.js";
import { mountDesignSlider } from "./design-slider.js";

/* ---------- what each animated card asks for (names of the scenes + safe defaults) ---------- */
const GF = {
  notes: ["Every little moment with you feels like this.", "I keep coming back to this one in my head.", "Small, silly, and completely ours.", "You made an ordinary day feel like this."],
  boxLetter: "Every little thing about you makes an ordinary day feel like a memory worth keeping. I just wanted you to know that.",
  reasons: ["Because you make every ordinary day feel like a good one.", "Because you listen, even when I ramble about nothing.", "Because your laugh is my favourite sound.", "Because you believe in me even when I doubt myself.", "Because being loved by you feels like home."],
};
const PRO = {
  notes: ["I knew even back then I wanted forever with you.", "This is one of my favourite memories of us.", "Small moment, but I think about it often.", "This is when I started imagining our future."],
  boxLetter: "I've been carrying something for a while now, something I've been meaning to ask you.", reasons: GF.reasons,
};
const MISS = { notes: ["Every quiet moment, you cross my mind.", "I wonder if you see the same moon tonight.", "I still make two cups out of habit.", ""], boxLetter: "someone is missing you deeply right now.", reasons: GF.reasons };
const BDAY = { notes: ["First Photo Together ❤️", "The Day We Met ✨", "Our Craziest Moment 😂", "A Memory I'll Never Forget 🌸"], boxLetter: "Thank you for being in my life.", reasons: GF.reasons };

const CIN = {
  girlfriend: { d: GF, memTitle: "Memory", noteLabel: "A little note behind this photo", letterTitle: "The memory box letter", letterSub: "Shown when she opens the memory box.", reasons: true, notes: 4 },
  boyfriend: { d: GF, memTitle: "Memory", noteLabel: "A little note behind this photo", letterTitle: "The memory box letter", letterSub: "Shown when he opens the memory box.", reasons: true, notes: 4 },
  proposal: { d: PRO, memTitle: "Gallery photo", noteLabel: "Caption under this photo", letterTitle: "The ring box message", letterSub: "Shown when the ring box opens.", reasons: false, notes: 4 },
  miss: { d: MISS, memTitle: "Longing letter", noteLabel: "A message that appears with this scene", letterTitle: "The opening message", letterSub: "The very first thing they read.", reasons: false, notes: 3 },
  birthday: { d: BDAY, memTitle: "Memory", noteLabel: "Caption for this memory", letterTitle: "The thank-you line", letterSub: "Shown in the memory capsule.", reasons: false, notes: 4 },
};

const CSS = `
body.wz-open{overflow:hidden}
.wz{position:fixed;inset:0;z-index:400;background:var(--bg);overflow-y:auto;-webkit-overflow-scrolling:touch;font-family:"DM Sans",system-ui,sans-serif}
.wz-in{max-width:520px;margin:0 auto;padding:18px 18px 40px;min-height:100%;box-sizing:border-box;position:relative}
.wz-top{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.wz-dots{flex:1;display:flex;gap:6px;justify-content:center}
.wz-dots i{height:6px;flex:1;max-width:34px;border-radius:6px;background:var(--border);transition:.25s}
.wz-dots i.d{background:var(--primary)}
.wz-x{width:42px;height:42px;border-radius:50%;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:24px;cursor:pointer;flex:none}
.wz-box{background:var(--surface);border:1px solid var(--border);border-radius:28px;padding:26px 22px 24px;box-shadow:var(--shadow);margin-top:8px;animation:wzin .28s ease}
@keyframes wzin{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.wz-step{text-align:center;font-weight:800;font-size:13px;letter-spacing:.06em;color:var(--muted);text-transform:uppercase}
.wz-ic{text-align:center;font-size:54px;margin:12px 0 4px}
.wz h2{font-family:var(--font-head,"DM Sans",sans-serif);text-align:center;font-size:27px;line-height:1.2;margin:6px 0 8px;color:var(--text);font-weight:800}
.wz-sub{text-align:center;color:var(--muted);margin:0 0 20px;line-height:1.55;font-size:15px}
.wz-f{display:grid;gap:7px;margin-bottom:16px}
.wz-f>span{font-weight:800;font-size:14px;color:var(--primary)}
.wz-f small{font-weight:600;color:var(--muted)}
.wz input[type=text],.wz textarea{width:100%;box-sizing:border-box;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);border-radius:16px;padding:15px 16px;font:inherit;font-size:16px;outline:none;resize:vertical}
.wz input[type=text]:focus,.wz textarea:focus{border-color:var(--primary)}
.wz-chip{justify-self:start;border:1px dashed var(--primary);color:var(--primary);background:transparent;border-radius:99px;padding:7px 13px;font-weight:700;font-size:13px;cursor:pointer}
.wz-photo{position:relative;display:grid;place-items:center;aspect-ratio:4/3;border:2px dashed var(--border);border-radius:20px;background:var(--surface2);color:var(--muted);cursor:pointer;overflow:hidden;text-align:center;font-weight:700}
.wz-photo input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.wz-photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.wz-photo .ph{font-size:40px;display:block}
.wz-photo .busy{position:absolute;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.45);color:#fff;font-weight:800}
.wz-photo.has{border-style:solid;border-color:var(--primary)}
.wz-rm{justify-self:center;border:0;background:none;color:var(--muted);text-decoration:underline;font-weight:700;cursor:pointer;padding:4px;font-size:13px}
.wz-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:6px}
.wz-grid .wz-photo{aspect-ratio:1/1;font-size:13px}
.wz-nav{display:grid;gap:10px;margin-top:22px}
.wz-go{border:0;border-radius:99px;padding:17px;font:800 17px "DM Sans",sans-serif;cursor:pointer;background:var(--brand);color:#fff;box-shadow:0 12px 26px rgba(255,46,126,.28);min-height:54px}
.wz-go[disabled]{opacity:.45;box-shadow:none;cursor:not-allowed}
.wz-back{border:1px solid var(--border);border-radius:99px;padding:14px;font:700 15px "DM Sans",sans-serif;cursor:pointer;background:var(--surface);color:var(--text);min-height:48px}
.wz-err{color:#d81b60;font-weight:700;text-align:center;font-size:14px;min-height:18px;margin-top:10px}
.wz-sum{display:grid;gap:10px;margin:6px 0 4px}
.wz-sum div{display:flex;gap:10px;justify-content:space-between;align-items:flex-start;background:var(--surface2);border:1px solid var(--border);border-radius:16px;padding:12px 14px}
.wz-sum small{display:block;color:var(--muted);font-weight:800;font-size:11px;letter-spacing:.06em;text-transform:uppercase}
.wz-sum b{display:block;font-size:15px;color:var(--text);word-break:break-word}
.wz-sum button{border:0;background:none;color:var(--primary);font-weight:800;cursor:pointer;flex:none;padding:4px}
.wz-thumbs{display:flex;gap:6px;margin-top:6px}.wz-thumbs img{width:44px;height:44px;border-radius:10px;object-fit:cover}
.wz-pick{display:flex;gap:10px;flex-wrap:wrap;margin-top:4px}
.wz-pick .t{position:relative;width:68px;height:68px;border-radius:12px;overflow:hidden;border:3px solid transparent;cursor:pointer}
.wz-pick .t img{width:100%;height:100%;object-fit:cover;display:block}
.wz-pick .t.on{border-color:var(--primary)}
.wz-share{display:flex;gap:8px;margin:14px 0}.wz-share input{flex:1}
.wz-row2{display:flex;gap:10px;flex-wrap:wrap}.wz-row2>*{flex:1 1 130px;text-align:center;text-decoration:none}
.wz-ok{width:74px;height:74px;border-radius:50%;background:#12a56a;color:#fff;display:grid;place-items:center;font-size:40px;margin:6px auto 12px}
`;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function openWizard({ card, designId, upload, submit, toast = () => {}, onClose = () => {} }) {
  if (!document.getElementById("wz-css")) { const st = document.createElement("style"); st.id = "wz-css"; st.textContent = CSS; document.head.appendChild(st); }
  const cin = CIN[card.id] || null;
  const dsg = designsFor(card.id);
  const S = {
    design: dsg.some((d) => d.id === designId) ? designId : dsg[0].id,
    to: "", from: "", message: "", boxLetter: "", notes: ["", "", "", ""], reasons: ["", "", "", "", ""],
    photos: [null, null, null, null], preview: [null, null, null, null], busy: [false, false, false, false], collage: [],
  };

  const steps = [];
  if (dsg.length > 1) steps.push({ k: "design" });
  steps.push({ k: "names" });
  if (cin) {
    for (let i = 0; i < 4; i++) steps.push({ k: "memory", i });
    steps.push({ k: "letter" });
    if (cin.reasons) steps.push({ k: "reasons" });
    steps.push({ k: "message" });
  } else { steps.push({ k: "photos" }); steps.push({ k: "message" }); }
  steps.push({ k: "review" });

  let at = 0, done = false, sending = false, errText = "";
  const root = document.createElement("div"); root.className = "wz"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true");
  document.body.appendChild(root); document.body.classList.add("wz-open");

  const close = (force) => {
    if (!done && !force && (S.to || S.from || S.message || S.photos.some(Boolean)) && !confirm("Close? What you typed so far will be lost.")) return;
    root.remove(); document.body.classList.remove("wz-open"); onClose(done);
  };
  const go = (n) => { at = Math.max(0, Math.min(steps.length - 1, n)); errText = ""; draw(); root.scrollTop = 0; };
  const filled = () => [0, 1, 2, 3].filter((i) => S.photos[i]);
  const anyBusy = () => S.busy.some(Boolean);

  function valid(st) {
    if (st.k === "names") return S.to.trim() && S.from.trim();
    if (st.k === "message") return S.message.trim().length > 0;
    if (st.k === "memory" || st.k === "photos") return !anyBusy();
    return true;
  }

  /* ----- one screen per step ----- */
  const photoTile = (i, label) => `<label class="wz-photo ${S.photos[i] ? "has" : ""}">
      ${S.preview[i] || S.photos[i] ? `<img src="${esc(S.preview[i] || S.photos[i])}" alt="">` : `<span><span class="ph">📷</span>${esc(label)}</span>`}
      ${S.busy[i] ? '<span class="busy">Uploading…</span>' : ""}
      <input type="file" accept="image/*" data-photo="${i}" ${S.busy[i] ? "disabled" : ""}></label>
      ${S.photos[i] && !S.busy[i] ? `<button type="button" class="wz-rm" data-rmphoto="${i}">Remove photo</button>` : ""}`;

  function body(st) {
    const def = cin ? cin.d : null;
    if (st.k === "design") return { ic: card.icon, h: "Choose a design", sub: "Swipe and pick the look you like best. You can watch a live demo of each.", html: `<div id="dzMount"></div>` };
    if (st.k === "names") return { ic: card.icon, h: `Who is this ${esc(card.title)} for?`, sub: "You are about to make someone's day unforgettable 🎀", html: `
      <label class="wz-f"><span>Their name</span><input type="text" id="fTo" maxlength="40" placeholder="e.g. Ananya" value="${esc(S.to)}" autocomplete="off"></label>
      <label class="wz-f"><span>Your name</span><input type="text" id="fFrom" maxlength="40" placeholder="e.g. Rahul" value="${esc(S.from)}" autocomplete="off"></label>` };
    if (st.k === "memory") {
      const i = st.i, hasNote = i < cin.notes;
      return { ic: "📸", h: `${cin.memTitle} ${i + 1} of 4`, sub: "Add a photo (optional). You can skip it, the card shows a pretty placeholder.", html: `
        ${photoTile(i, "Tap to add photo")}
        ${hasNote ? `<label class="wz-f" style="margin-top:14px"><span>${esc(cin.noteLabel)} <small>(optional)</small></span><textarea id="fNote" maxlength="140" rows="2" placeholder="${esc(def.notes[i])}">${esc(S.notes[i])}</textarea>${S.notes[i] ? "" : '<button type="button" class="wz-chip" data-fill="note">✨ Use this suggestion</button>'}</label>` : ""}` };
    }
    if (st.k === "photos") return { ic: "📸", h: "Add your photos", sub: "Up to 4 photos (optional). They appear one by one as memories.", html: `<div class="wz-grid">${[0, 1, 2, 3].map((i) => `<div>${photoTile(i, `Photo ${i + 1}`)}</div>`).join("")}</div>` };
    if (st.k === "letter") return { ic: "💌", h: cin.letterTitle, sub: cin.letterSub, html: `
      <label class="wz-f"><span>Your words <small>(optional)</small></span><textarea id="fLetter" maxlength="300" rows="4" placeholder="${esc(def.boxLetter)}">${esc(S.boxLetter)}</textarea>${S.boxLetter ? "" : '<button type="button" class="wz-chip" data-fill="letter">✨ Use this suggestion</button>'}</label>` };
    if (st.k === "reasons") return { ic: "💖", h: "5 reasons", sub: "Each reason sits inside a sealed envelope they open one by one.", html: [0, 1, 2, 3, 4].map((i) => `
      <label class="wz-f"><span>Reason ${i + 1} <small>(optional)</small></span><input type="text" data-reason="${i}" maxlength="100" placeholder="${esc(def.reasons[i])}" value="${esc(S.reasons[i])}"></label>`).join("") };
    if (st.k === "message") {
      const ph = filled();
      return { ic: "✍️", h: cin ? "Your final message" : "Your message", sub: "The heartfelt message they read at the very end.", html: `
        <label class="wz-f"><span>Message</span><textarea id="fMsg" maxlength="500" rows="5" placeholder="${esc(card.formHint)}">${esc(S.message)}</textarea>${S.message ? "" : '<button type="button" class="wz-chip" data-fill="msg">✨ Use a sample message</button>'}<small>Example: ${esc(card.example)}</small></label>
        ${cin && ph.length >= 3 ? `<div class="wz-f"><span>Final card collage <small>(tap 2 photos)</small></span><div class="wz-pick">${ph.map((i) => `<div class="t ${S.collage.includes(i) ? "on" : ""}" data-col="${i}"><img src="${esc(S.photos[i])}" alt=""></div>`).join("")}</div></div>` : ""}` };
    }
    // review
    const ph = filled();
    const dName = (dsg.find((d) => d.id === S.design) || dsg[0]).name;
    const jump = (k) => steps.findIndex((s) => s.k === k);
    return { ic: "🎁", h: "All set? Take a last look", sub: "Everything look right? Then create your wish.", html: `<div class="wz-sum">
      <div><span><small>For</small><b>${esc(S.to)}</b></span><button type="button" data-jump="${jump("names")}">Edit</button></div>
      <div><span><small>From</small><b>${esc(S.from)}</b></span><button type="button" data-jump="${jump("names")}">Edit</button></div>
      ${dsg.length > 1 ? `<div><span><small>Design</small><b>${esc(dName)}</b></span><button type="button" data-jump="${jump("design")}">Edit</button></div>` : ""}
      <div><span><small>Photos</small><b>${ph.length ? ph.length + " added" : "No photos"}</b>${ph.length ? `<span class="wz-thumbs">${ph.map((i) => `<img src="${esc(S.photos[i])}" alt="">`).join("")}</span>` : ""}</span><button type="button" data-jump="${jump(cin ? "memory" : "photos")}">Edit</button></div>
      <div><span><small>Message</small><b>${esc(S.message.length > 110 ? S.message.slice(0, 110) + "…" : S.message)}</b></span><button type="button" data-jump="${jump("message")}">Edit</button></div>
    </div><p class="wz-sub" style="margin:14px 0 0;font-size:13px">Your link will work for 10 days.</p><div class="wz-err" id="wzErr">${esc(errText)}</div>` };
  }

  function draw() {
    const st = steps[at], b = body(st), last = st.k === "review";
    const stepName = { design: "Design", names: "Names", memory: `${cin ? cin.memTitle : "Memory"} ${st.i + 1}`, photos: "Photos", letter: cin ? cin.letterTitle : "", reasons: "Reasons", message: "Message", review: "Review" }[st.k];
    root.innerHTML = `<div class="wz-in">
      <div class="wz-top"><div class="wz-dots">${steps.map((_, i) => `<i class="${i <= at ? "d" : ""}"></i>`).join("")}</div><button class="wz-x" type="button" aria-label="Close">×</button></div>
      <div class="wz-box"><div class="wz-step">Step ${at + 1} of ${steps.length} · ${esc(stepName)}</div>
        <div class="wz-ic">${b.ic}</div><h2>${b.h}</h2><p class="wz-sub">${b.sub}</p>${b.html}
        <div class="wz-nav"><button class="wz-go" id="wzNext" type="button" ${valid(st) && !sending ? "" : "disabled"}>${last ? (sending ? "Creating…" : "Create & Save Wish ✦") : (anyBusy() ? "Uploading photo…" : "Continue →")}</button>
        ${at > 0 ? '<button class="wz-back" id="wzBack" type="button">← Back</button>' : ""}</div>
      </div></div>`;
    bind(st);
  }

  function refreshNext() { const st = steps[at], n = root.querySelector("#wzNext"); if (n) n.disabled = !(valid(st) && !sending); }

  async function create() {
    sending = true; errText = ""; draw();
    const idx = filled();
    const def = cin ? cin.d : null;
    const urls = idx.map((i) => S.photos[i]);
    const payload = {
      templateId: card.id, templateTitle: card.title, category: card.category, designId: S.design,
      from: S.from.trim(), to: S.to.trim(), message: S.message.trim(), imageUrl: urls[0] || "", imageUrls: urls,
    };
    if (cin) {
      // keep each note with its own photo even when someone skips a photo slot
      const slotNote = [0, 1, 2, 3].map((i) => S.notes[i].trim() || def.notes[i]);
      payload.gfNotes = [...idx.map((i) => slotNote[i]), ...[0, 1, 2, 3].filter((i) => !idx.includes(i)).map((i) => slotNote[i])];
      payload.gfBoxLetter = S.boxLetter.trim() || def.boxLetter;
      payload.gfReasons = [0, 1, 2, 3, 4].map((i) => S.reasons[i].trim() || def.reasons[i]);
      const pick = (S.collage.length ? S.collage : idx.slice(0, 2)).filter((i) => S.photos[i]);
      payload.gfCollage = pick.map((i) => S.photos[i]);
    }
    try { const r = await submit(payload); sending = false; done = true; success(r.link); }
    catch (e) { sending = false; errText = (e && e.message) || "Could not save your wish. Please try again."; draw(); }
  }

  function success(link) {
    const msg = `💌 I made a little surprise for you on WishVerse. Tap to open it: ${link}`;
    root.innerHTML = `<div class="wz-in"><div class="wz-box" style="margin-top:40px"><div class="wz-ok">✓</div><h2>Your wish is ready! 🎉</h2>
      <p class="wz-sub">Share the link on WhatsApp or Instagram. It shows a pretty preview. The link stays open for 10 days.</p>
      <div class="wz-share"><input type="text" id="wzLink" readonly value="${esc(link)}"><button class="wz-back" id="wzCopy" type="button" style="padding:0 18px">Copy</button></div>
      <div class="wz-row2"><a class="wz-back" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">💬 WhatsApp</a>${navigator.share ? '<button class="wz-back" id="wzShare" type="button">📤 Share…</button>' : ""}</div>
      <div class="wz-nav"><button class="wz-go" id="wzDone" type="button">Done</button></div></div></div>`;
    root.scrollTop = 0;
    root.querySelector("#wzCopy").onclick = async () => { try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { root.querySelector("#wzLink").select(); } };
    const sh = root.querySelector("#wzShare"); if (sh) sh.onclick = () => navigator.share({ title: "A surprise for you 💌", text: "I made a little surprise for you on WishVerse.", url: link }).catch(() => {});
    root.querySelector("#wzDone").onclick = () => close(true);
  }

  function bind(st) {
    root.querySelector(".wz-x").onclick = () => close();
    const nx = root.querySelector("#wzNext"), bk = root.querySelector("#wzBack");
    if (bk) bk.onclick = () => go(at - 1);
    nx.onclick = () => { if (!valid(st) || sending) return; if (st.k === "review") create(); else go(at + 1); };
    const on = (sel, ev, fn) => { const e = root.querySelector(sel); if (e) e.addEventListener(ev, fn); };
    if (st.k === "design") mountDesignSlider(root.querySelector("#dzMount"), card, { selected: S.design, onSelect: (d) => { S.design = d; }, demoHref: (d) => `index.html?demo=${encodeURIComponent(card.id)}&design=${encodeURIComponent(d)}` });
    on("#fTo", "input", (e) => { S.to = e.target.value; refreshNext(); });
    on("#fFrom", "input", (e) => { S.from = e.target.value; refreshNext(); });
    on("#fMsg", "input", (e) => { S.message = e.target.value; refreshNext(); });
    on("#fNote", "input", (e) => { S.notes[st.i] = e.target.value; });
    on("#fLetter", "input", (e) => { S.boxLetter = e.target.value; });
    root.querySelectorAll("[data-reason]").forEach((el) => el.addEventListener("input", () => { S.reasons[+el.dataset.reason] = el.value; }));
    root.querySelectorAll("#fTo,#fFrom").forEach((el) => el.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); if (valid(st)) go(at + 1); } }));
    root.querySelectorAll("[data-fill]").forEach((b) => b.onclick = () => {
      const d = cin ? cin.d : null;
      if (b.dataset.fill === "msg") S.message = card.example; else if (b.dataset.fill === "letter") S.boxLetter = d.boxLetter; else S.notes[st.i] = d.notes[st.i];
      draw();
    });
    root.querySelectorAll("[data-photo]").forEach((inp) => inp.addEventListener("change", async () => {
      const i = +inp.dataset.photo, f = inp.files && inp.files[0]; if (!f) return;
      S.preview[i] = URL.createObjectURL(f); S.busy[i] = true; S.photos[i] = null; draw();
      try { const url = await upload(f); S.photos[i] = url || null; if (!url) toast("Photo could not be saved. You can continue without it."); }
      catch { S.photos[i] = null; S.preview[i] = null; toast("Upload failed. Try another photo, or continue without it."); }
      S.busy[i] = false; if (S.photos[i]) S.preview[i] = null; draw();
    }));
    root.querySelectorAll("[data-rmphoto]").forEach((b) => b.onclick = () => { const i = +b.dataset.rmphoto; S.photos[i] = null; S.preview[i] = null; S.collage = S.collage.filter((x) => x !== i); draw(); });
    root.querySelectorAll("[data-col]").forEach((el) => el.onclick = () => {
      const i = +el.dataset.col;
      if (S.collage.includes(i)) S.collage = S.collage.filter((x) => x !== i); else { if (S.collage.length >= 2) S.collage.shift(); S.collage.push(i); }
      draw();
    });
    root.querySelectorAll("[data-jump]").forEach((b) => b.onclick = () => go(+b.dataset.jump));
  }

  draw();
  return { close };
}
