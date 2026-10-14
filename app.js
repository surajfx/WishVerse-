
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

let db = null;
let firebaseReady = false;
let firestoreApi = null;
async function initFirebase(){
  try {
    const [{ initializeApp }, firestore] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
    ]);
    db = firestore.getFirestore(initializeApp(firebaseConfig));
    firestoreApi = firestore;
    firebaseReady = true;
  } catch (error) {
    console.error("Firebase could not initialize:", error);
    toast("Cards are ready. Firebase setup is not connected yet.");
  }
}

// Each card carries everything needed to drive the shared cinematic
// experience: its own colours (via the theme-<id> CSS class), its own
// copy for every step, its own memory captions and its own final reveal.
import { cards } from "./cards/index.js";
import { designOf } from "./cards/designs.js";

let selectedCard = cards[0];
let activeCategory = "All";
let favorites = JSON.parse(localStorage.getItem("wishverse-favorites") || "[]");
let uploadedImageUrls = [];

const $ = s => document.querySelector(s);
const wishGrid = $("#wishGrid");
const favoriteGrid = $("#favoriteGrid");
const featuredGrid = $("#featuredGrid");
const featuredIds = ["proposal","girlfriend","boyfriend","miss","sorry","birthday"];

function categories() {
  return ["All", ...new Set(cards.map(c => c.category))];
}

function renderFeatured(){
  featuredGrid.innerHTML = featuredIds.map(id => { const card=cards.find(c=>c.id===id); return `<button class="featured-card ${card.art}" data-open="${card.id}"><span class="featured-icon">${card.icon}</span><strong>${card.title}</strong></button>`; }).join("");
  featuredGrid.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>openCard(b.dataset.open));
}

function renderChips() {
  $("#categoryChips").innerHTML = categories().map(c =>
    `<button class="chip ${c===activeCategory?"active":""}" data-category="${c}">${c}</button>`
  ).join("");
  document.querySelectorAll("[data-category]").forEach(b => b.onclick = () => {
    activeCategory = b.dataset.category; renderChips(); renderCards();
  });
}

function filteredCards() {
  const term = ($("#searchInput").value || "").toLowerCase().trim();
  return cards.filter(c => (activeCategory==="All" || c.category===activeCategory) &&
    `${c.title} ${c.category} ${c.desc}`.toLowerCase().includes(term));
}

function cardHTML(card) {
  const fav = favorites.includes(card.id);
  return `<article class="wish-card">
    <div class="wish-art ${card.art}">
      <button class="heart-button ${fav?"active":""}" data-fav="${card.id}" aria-label="Favorite">${fav?"♥":"♡"}</button>
      <span class="art-icon">${card.icon}</span><span class="art-label">${card.title}</span>
    </div>
    <div class="wish-card-info"><h3>${card.title}</h3><p>${card.category} · ${card.desc}</p>
      <div class="card-actions"><button class="small-btn" data-open="${card.id}">Open</button></div>
    </div>
  </article>`;
}

function bindCardButtons() {
  document.querySelectorAll("[data-open]").forEach(b => b.onclick = () => openCard(b.dataset.open));
  document.querySelectorAll("[data-fav]").forEach(b => b.onclick = () => toggleFavorite(b.dataset.fav));
  document.querySelectorAll(".wish-card").forEach(c => c.onclick = e => {
    if (e.target.closest("[data-fav]")) return;
    const b = c.querySelector("[data-open]"); if (b) openCard(b.dataset.open);
  });
}

function renderCards() {
  const list = filteredCards();
  wishGrid.innerHTML = list.map(cardHTML).join("");
  $("#emptyState").classList.toggle("hidden", list.length > 0);
  bindCardButtons();
  renderFavorites();
}

function renderFavorites() {
  const list = cards.filter(c => favorites.includes(c.id));
  favoriteGrid.innerHTML = list.map(cardHTML).join("");
  $("#noFavorites").classList.toggle("hidden", list.length > 0);
  $("#favoriteCount").textContent = favorites.length;
  bindCardButtons();
}

function toggleFavorite(id) {
  favorites = favorites.includes(id) ? favorites.filter(x => x!==id) : [...favorites,id];
  localStorage.setItem("wishverse-favorites", JSON.stringify(favorites));
  renderCards();
  toast(favorites.includes(id) ? "Saved to favorites" : "Removed from favorites");
}

function openCard(id) {
  location.href = "card.html?id=" + encodeURIComponent(id);
}

function closeModal(id) { $(id).classList.add("hidden"); }

function toast(message) {
  const t = $("#toast"); t.textContent = message; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

async function uploadToCloudinary(file) {
  const cloudName = "wtlx95j4";
  const uploadPreset = "ml_default";
  if (cloudName.startsWith("YOUR_") || uploadPreset.startsWith("YOUR_")) return "";
  const data = new FormData();
  data.append("file", file); data.append("upload_preset", uploadPreset);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {method:"POST",body:data});
  if (!response.ok) throw new Error("Cloudinary upload failed");
  const result = await response.json();
  return result.secure_url;
}

$("#searchInput").addEventListener("input", renderCards);
$("#themeToggle").onclick = () => {
  document.documentElement.classList.toggle("light");
  localStorage.setItem("wishverse-theme", document.documentElement.classList.contains("light") ? "light" : "dark");
};
if (localStorage.getItem("wishverse-theme")==="light") document.documentElement.classList.add("light");

/* "Create Wish" popup: shows every card; tapping one opens that card's page. */
function openPicker() {
  const grid = $("#pickGrid");
  if (!grid.dataset.ready) {
    grid.innerHTML = cards.map(c => `<a class="pick-card ${c.art}" href="card.html?id=${encodeURIComponent(c.id)}"><span class="pick-ic">${c.icon}</span><strong>${c.title}</strong><small>${c.category}</small></a>`).join("");
    grid.dataset.ready = "1";
  }
  $("#pickModal").classList.remove("hidden");
  document.body.classList.add("modal-lock");
}
function closePicker() { $("#pickModal").classList.add("hidden"); document.body.classList.remove("modal-lock"); }
$("#heroCreate").onclick = openPicker;
document.querySelectorAll("[data-close-pick]").forEach(x => x.onclick = closePicker);
document.addEventListener("keydown", e => { if (e.key === "Escape") closePicker(); });

/* Creating a wish: the step-by-step wizard (shared/wizard.js). */
async function openCustomize(card, designId) {
  const pay = await import("./shared/payments.js");
  const user = pay.auth.currentUser || await pay.waitForUser();
  if (!user) {
    toast("Please log in to create your wish.");
    setTimeout(() => location.href = "login.html?next=" + encodeURIComponent("card.html?id=" + card.id), 1100);
    return;
  }
  const { openWizard } = await import("./shared/wizard.js");
  openWizard({
    card, designId, upload: uploadToCloudinary, toast,
    onClose: () => { history.replaceState(null, "", location.pathname); },
    submit: async (payload) => {
      try {
        const res = await pay.call("createWish", payload);
        // Preview-friendly link (WhatsApp/Instagram read card title + picture from it), falls back to the plain link.
        return { link: res.shareUrl || `${location.origin}${location.pathname}?wish=${res.id}` };
      } catch (error) {
        console.error(error);
        const m = String(error && error.message || "");
        if (m.includes("NO_ENTITLEMENT")) { setTimeout(() => location.href = "card.html?id=" + card.id, 1500); throw new Error("Unlock this card first to create your wish."); }
        if (m.includes("LIMIT_REACHED")) throw new Error("You have used all creations for this card.");
        if (m.includes("SUSPENDED")) throw new Error("Your account is suspended. Please contact support.");
        throw new Error("Could not save your wish. Please try again.");
      }
    },
  });
}

/* =========================================================================
   SHARED CINEMATIC WISH EXPERIENCE
   Each card walks through the same overall structure (loading → intro →
   4 memories → letter → final reveal), but every step, colour and photo
   caption comes from that card's own config, so no two cards feel alike.
   Birthday additionally gets a "make a wish" candle-blowing step.
   ========================================================================= */
let sharedWish = null;
let sharedStep = 0;
let sharedIsDemo = false;
let demoReturn = "";
let sharedSteps = [];
let statusInterval = null;

function escapeHTML(value=""){return String(value).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function getPhotos(w){return (w.imageUrls&&w.imageUrls.length?w.imageUrls:(w.imageUrl?[w.imageUrl]:[])).slice(0,4);}
function currentCard(){ return cards.find(c=>c.id===(sharedWish||{}).templateId) || cards[0]; }

function buildSteps(card){
  const steps = ["loading","intro","memory","memory","memory","memory","letter"];
  if (card.id === "birthday") steps.push("cake");
  steps.push("final");
  return steps;
}

function applyTheme(card){
  const root = $("#sharedExperience");
  root.className = root.className.replace(/\btheme-\S+/g, "").trim();
  root.classList.add(`theme-${card.id}`);
}

function startAmbientParticles(card){
  const root = $("#sharedExperience");
  const old = root.querySelector(".ambient-particles");
  if (old) old.remove();
  const layer = document.createElement("div");
  layer.className = "ambient-particles";
  const symbols = card.particles && card.particles.length ? card.particles : ["✦","·","❋","♥"];
  const count = card.id === "birthday" ? 22 : 28;
  for (let i=0;i<count;i++){
    const p = document.createElement("span");
    p.textContent = symbols[i % symbols.length];
    p.style.setProperty("--x", `${Math.random()*100}%`);
    p.style.setProperty("--d", `${6+Math.random()*9}s`);
    p.style.setProperty("--delay", `${-Math.random()*12}s`);
    p.style.setProperty("--s", `${.55+Math.random()*1.1}`);
    layer.appendChild(p);
  }
  root.prepend(layer);
}

function stopStatusRotation(){ if (statusInterval){ clearInterval(statusInterval); statusInterval = null; } }

function renderGirlfriendExperience(w){
  const to = encodeURIComponent(w.to || "You");
  const from = encodeURIComponent(w.from || "Someone who loves you");
  const msg = encodeURIComponent(w.message || "");
  const photos = encodeURIComponent(getPhotos(w).join(","));
  const notes = encodeURIComponent((w.gfNotes || []).join("|"));
  const boxletter = encodeURIComponent(w.gfBoxLetter || "");
  const reasons = encodeURIComponent((w.gfReasons || []).join("|"));
  const collage = encodeURIComponent((w.gfCollage && w.gfCollage.length ? w.gfCollage : getPhotos(w).slice(0,2)).join(","));
  const folder = (designOf(w.templateId, w.designId).path) || `cards/${w.templateId}-experience/index.html`;
  $("#sharedStage").innerHTML = `<iframe class="girlfriend-frame" src="${folder}?to=${to}&from=${from}&msg=${msg}&photos=${photos}&notes=${notes}&boxletter=${boxletter}&reasons=${reasons}&collage=${collage}" title="A little surprise" allow="autoplay"></iframe>`;
}

function showSharedExperience(wish, isDemo=false){
  sharedWish = wish; sharedStep = 0; sharedIsDemo = isDemo;
  const card = currentCard();
  document.body.classList.add("shared-mode");
  $("#sharedExperience").classList.remove("hidden");
  $("#sharedActions").classList.add("hidden");
  const progressBar = document.querySelector(".shared-progress");
  if (designOf(card.id, wish.designId).path) {
    if (progressBar) progressBar.classList.add("hidden");
    $("#sharedExperience").classList.add("girlfriend-live");
    $("#sharedExperience").classList.toggle("no-topbar", !isDemo);
    applyTheme(card);
    renderGirlfriendExperience(wish);
    return;
  }
  $("#sharedExperience").classList.remove("girlfriend-live", "no-topbar");
  if (progressBar) progressBar.classList.remove("hidden");
  sharedSteps = buildSteps(card);
  applyTheme(card);
  startAmbientParticles(card);
  renderSharedStage();
}

function memoryIndexAt(step){
  let idx = 0;
  for (let i=0;i<step;i++) if (sharedSteps[i]==="memory") idx++;
  return idx;
}
function isLastMemoryStep(step){
  return sharedSteps.slice(step+1).indexOf("memory") === -1;
}

function renderSharedStage(){
  const w = sharedWish || {};
  const card = currentCard();
  const name = escapeHTML(w.to || "Someone Special");
  const from = escapeHTML(w.from || "Someone who cares");
  const msg = escapeHTML(w.message || card.example);
  const photos = getPhotos(w);
  const stepType = sharedSteps[sharedStep] || "final";
  stopStatusRotation();
  let html = "";
  if (stepType === "loading") {
    html = `<div class="prelude-icon"><span>${card.icon}</span></div><div class="loading-ring"><i></i></div><div class="shared-kicker" id="statusText">${card.statusMessages[0]}</div><h1 class="prelude-title">A little moment<br>made just for <span>${name}</span></h1><p class="shared-intro">Please wait… your surprise is opening.</p><button class="shared-cta" data-next>Open the surprise <b>→</b></button>`;
  } else if (stepType === "intro") {
    html = `<div class="experience-orb"><span>${card.icon}</span></div><div class="shared-kicker">${card.kicker}</div><h1>${card.openIntro}<span>${name}</span></h1><p class="shared-intro">Someone made this little experience just for you.</p><button class="shared-cta" data-next>Tap to continue <b>→</b></button>`;
  } else if (stepType === "memory") {
    const memIndex = memoryIndexAt(sharedStep);
    const photo = photos[memIndex]
      ? `<img class="memory-photo" src="${escapeHTML(photos[memIndex])}" alt="A memory">`
      : `<div class="memory-placeholder">${card.icon}<small>Add your beautiful memory</small></div>`;
    const caption = card.memoryCaptions[memIndex] || "";
    const last = isLastMemoryStep(sharedStep);
    html = `<div class="shared-kicker">${card.memoryHeading}</div><h2>One photo. One memory. One feeling.</h2><div class="memory-frame">${photo}</div><p class="memory-caption">${caption}</p><p class="memory-count">Memory ${memIndex+1} of 4</p><button class="shared-cta" data-next>${last?"Read the message":"Next Memory"} <b>→</b></button>`;
  } else if (stepType === "letter") {
    const nextLabel = sharedSteps[sharedStep+1] === "cake" ? "Make a wish" : "Open the final surprise";
    html = `<div class="shared-kicker">${card.letterHeading}</div><h2>A message for ${name}</h2><div class="letter-card"><p>${msg}</p><div class="letter-sign">With love,<br><strong>${from}</strong></div></div><button class="shared-cta" data-next>${nextLabel} <b>→</b></button>`;
  } else if (stepType === "cake") {
    html = `<div class="shared-kicker">MAKE A WISH</div><h2>Blow out the candles for ${name}</h2><div class="cake-wrap" id="cakeWrap"><div class="cake">🎂<span class="candle-flame">🕯️</span></div><p class="cake-hint">Tap the cake to make a wish</p></div><button class="shared-cta hidden" id="cakeNext" data-next>See your birthday surprise <b>→</b></button>`;
  } else {
    html = `<div class="shared-kicker">THE FINAL MOMENT</div><h2>${card.finalTitle}</h2><div class="final-card"><div class="final-title">${card.finalTitle}</div>${photos.length?`<div class="final-collage">${photos.map((u,i)=>`<img src="${escapeHTML(u)}" alt="Memory ${i+1}">`).join("")}</div>`:""}<p>${msg}</p><div class="letter-sign">With love,<br><strong>${from}</strong></div></div>`;
  }

  $("#sharedStage").innerHTML = html;

  document.querySelectorAll("[data-next]").forEach(b => b.onclick = () => {
    sharedStep = Math.min(sharedStep+1, sharedSteps.length-1);
    renderSharedStage();
  });

  if (stepType === "cake") {
    const cakeEl = document.getElementById("cakeWrap");
    cakeEl.onclick = () => {
      if (cakeEl.classList.contains("blown")) return;
      cakeEl.classList.add("blown");
      const nextBtn = document.getElementById("cakeNext");
      if (nextBtn) nextBtn.classList.remove("hidden");
    };
  }

  if (stepType === "loading") {
    let idx = 0;
    const statusEl = document.getElementById("statusText");
    statusInterval = setInterval(() => {
      idx = (idx+1) % card.statusMessages.length;
      if (statusEl) statusEl.textContent = card.statusMessages[idx];
    }, 1500);
  }

  $("#sharedActions").classList.toggle("hidden", stepType !== "final");
  const progress = sharedSteps.length > 1 ? (sharedStep/(sharedSteps.length-1))*100 : 100;
  const fill = document.querySelector(".progress-fill");
  if (fill) fill.style.width = `${progress}%`;
}

function closeSharedExperience(){
  stopStatusRotation();
  if (sharedIsDemo && demoReturn) { location.href = demoReturn; return; }
  if (sharedIsDemo) { $("#sharedExperience").classList.add("hidden"); $("#sharedExperience").classList.remove("girlfriend-live"); $("#sharedActions").classList.add("hidden"); document.body.classList.remove("shared-mode"); return; }
  location.href = location.pathname;
}
$("#sharedBack").onclick = closeSharedExperience;
$("#watchAgain").onclick = () => { sharedStep = 0; renderSharedStage(); };
(function(){
  const sc = document.createElement("script");
  sc.src = "cards/keepsake.js";
  sc.onload = () => window.WVKeepsake && window.WVKeepsake.bind("downloadKeepsake", () => (sharedWish && sharedWish.to) || "keepsake", ".final-card");
  document.head.appendChild(sc);
})();
function showLinkGone(expired){
  document.body.classList.add("shared-mode");
  const sec = $("#sharedExperience");
  sec.classList.remove("hidden");
  $("#sharedActions").classList.add("hidden");
  $("#sharedStage").innerHTML = `<div style="text-align:center;padding:60px 18px;max-width:420px;margin:0 auto"><div style="font-size:54px">⏳</div><h2 style="margin:14px 0 8px">${expired ? "This wish link has expired" : "This wish link is not available"}</h2><p style="opacity:.8;line-height:1.6">${expired ? "WishVerse links stay open for 10 days. Ask the sender to create a new one, or make your own." : "The link may be mistyped or removed."}</p><p style="margin-top:22px"><a class="btn btn-primary" href="${location.pathname}">Make your own wish ✦</a></p></div>`;
}
async function loadSharedWish(){
  const id = new URLSearchParams(location.search).get("wish");
  if (!id) return;
  try {
    if (!firebaseReady || !db) await initFirebase();
    const { getDoc, doc } = firestoreApi;
    const snap = await getDoc(doc(db, "wishes", id));
    if (!snap.exists()) return showLinkGone(false);
    const w = snap.data();
    const exp = w.expiresAt && w.expiresAt.toMillis ? w.expiresAt.toMillis() : (w.createdAt && w.createdAt.toMillis ? w.createdAt.toMillis() + 10*24*3600*1000 : 0);
    if (exp && Date.now() >= exp) return showLinkGone(true);
    showSharedExperience(w);
  } catch (e) {
    console.error(e);
    // Firestore rules refuse to read a wish after its 10 days are over
    if (e && (e.code === "permission-denied" || /permission/i.test(e.message || ""))) return showLinkGone(true);
    toast(e.message || "This wish could not be loaded.");
  }
}
renderFeatured();
renderChips();
renderCards();

// Mobile menu and theme controls
const menuToggle = $("#menuToggle");
if (menuToggle) {
  const nav = document.querySelector(".desktop-nav");
  menuToggle.onclick = () => {
    const open = nav?.classList.toggle("mobile-open");
    menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
    menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menuToggle.textContent = open ? "×" : "☰";
  };
  nav?.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      nav.classList.remove("mobile-open");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Open menu");
      menuToggle.textContent = "☰";
    });
  });
}

(async () => {
  const sharedId = new URLSearchParams(window.location.search).get("wish");
  if (sharedId) document.body.classList.add("loading-shared-wish");
  await initFirebase();
  await loadSharedWish();
  document.body.classList.remove("loading-shared-wish");
  const qs = new URLSearchParams(window.location.search);
  const pick = cards.find(c => c.id === (qs.get("create") || qs.get("demo")));
  if (pick && !sharedId) {
    selectedCard = pick;
    if (qs.get("create")) openCustomize(pick, qs.get("design"));
    else {
      demoReturn = "card.html?id=" + encodeURIComponent(pick.id);
      showSharedExperience({templateId:pick.id, designId:qs.get("design")||"classic", templateTitle:pick.title, category:pick.category, from:"Someone who cares", to:"Your Special Person", message:pick.desc, imageUrl:""}, true);
    }
  }
})();

/* Login link becomes "My Account" once logged in (menu keeps only 5 links). */
(async () => {
  try {
    const pay = await import("./shared/payments.js");
    const user = await pay.waitForUser();
    const link = document.querySelector('.desktop-nav a[href="login.html"]');
    if (user && link) { link.href = "account.html"; link.textContent = "🧾 My Account"; }
  } catch {}
})();
