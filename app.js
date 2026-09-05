const canvasScript=document.createElement("script");canvasScript.src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";document.head.appendChild(canvasScript);

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

let selectedCard = cards[0];
let activeCategory = "All";
let favorites = JSON.parse(localStorage.getItem("wishverse-favorites") || "[]");
let uploadedImageUrls = [];

const $ = s => document.querySelector(s);
const wishGrid = $("#wishGrid");
const favoriteGrid = $("#favoriteGrid");

function categories() {
  return ["All", ...new Set(cards.map(c => c.category))];
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
  selectedCard = cards.find(c => c.id === id) || cards[0];
  $("#modalCategory").textContent = selectedCard.category.toUpperCase();
  $("#modalTitle").textContent = selectedCard.title;
  $("#modalDescription").textContent = selectedCard.desc;
  $("#modalPreview").innerHTML = `<div class="preview-art ${selectedCard.art}"><span class="preview-icon">${selectedCard.icon}</span><h3>${selectedCard.title}</h3><p>${selectedCard.desc}</p></div>`;
  $("#cardModal").classList.remove("hidden");
}

function closeModal(id) { $(id).classList.add("hidden"); }

function openCustomize() {
  if (!selectedCard) selectedCard = cards[0];
  closeModal("#cardModal");
  $("#wishForm").classList.remove("hidden");
  $("#createdResult").classList.add("hidden");
  $("#customizeTitle").textContent = `Create ${selectedCard.title} ${selectedCard.icon}`;
  $("#messageInput").value = selectedCard.example;
  $("#messageInput").placeholder = selectedCard.formHint;
  $("#messageExample").textContent = `Example: ${selectedCard.example}`;
  uploadedImageUrls = [];
  $("#uploadStatus").textContent = "";
  $("#customizeModal").classList.remove("hidden");
}

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
$("#heroCreate").onclick = () => { selectedCard = cards[0]; openCustomize(); };
$("#customizeBtn").onclick = openCustomize;
$("#demoBtn").onclick = () => {
  closeModal("#cardModal");
  showSharedExperience({templateId:selectedCard.id, templateTitle:selectedCard.title, category:selectedCard.category, from:"Someone who cares", to:"Your Special Person", message:selectedCard.desc, imageUrl:""}, true);
};
document.querySelectorAll("[data-close-modal]").forEach(x => x.onclick = () => closeModal("#cardModal"));
document.querySelectorAll("[data-close-customize]").forEach(x => x.onclick = () => closeModal("#customizeModal"));
$("#themeToggle").onclick = () => {
  document.documentElement.classList.toggle("light");
  localStorage.setItem("wishverse-theme", document.documentElement.classList.contains("light") ? "light" : "dark");
};
if (localStorage.getItem("wishverse-theme")==="light") document.documentElement.classList.add("light");

// Photo upload notes: photo 1 = main/favourite photo, photo 2 = a beautiful
// memory, photo 3 = a fun moment, photo 4 = a special memory. If the person
// uploads fewer than four, the memory steps fall back to an elegant
// placeholder instead of a broken image.
$("#imageInput").onchange = async e => {
  const files = [...e.target.files].slice(0,4); if (!files.length) return;
  $("#uploadStatus").textContent = `Uploading ${files.length} photo${files.length>1?"s":""}...`;
  try { uploadedImageUrls = []; for (const file of files) { const url = await uploadToCloudinary(file); if (url) uploadedImageUrls.push(url); } $("#uploadStatus").textContent = uploadedImageUrls.length ? `${uploadedImageUrls.length} photo${uploadedImageUrls.length>1?"s":""} uploaded successfully.` : "Photos selected."; }
  catch { uploadedImageUrls = []; $("#uploadStatus").textContent = "Upload failed. You can continue without photos."; }
};

$("#wishForm").onsubmit = async e => {
  e.preventDefault();
  const payload = {
    templateId: selectedCard.id, templateTitle: selectedCard.title,
    category: selectedCard.category, from: $("#fromInput").value.trim(),
    to: $("#toInput").value.trim(), message: $("#messageInput").value.trim(),
    imageUrl: uploadedImageUrls[0] || "", imageUrls: uploadedImageUrls, createdAt: firestoreApi.serverTimestamp()
  };
  try {
    if (!firebaseReady || !db) {
      toast("Firebase is not connected. Check Firebase setup.");
      return;
    }
    const { addDoc, collection } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const ref = await addDoc(collection(db, "wishes"), payload);
    const link = `${location.origin}${location.pathname}?wish=${ref.id}`;
    $("#shareLink").value = link;
    $("#wishForm").classList.add("hidden"); $("#createdResult").classList.remove("hidden");
    toast("Wish saved successfully");
  } catch (error) {
    console.error(error);
    toast("Firebase error. Check Firestore rules and setup.");
  }
};

$("#copyLink").onclick = async () => {
  await navigator.clipboard.writeText($("#shareLink").value);
  toast("Link copied");
};
$("#closeAfterCreate").onclick = () => closeModal("#customizeModal");

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

function showSharedExperience(wish, isDemo=false){
  sharedWish = wish; sharedStep = 0; sharedIsDemo = isDemo;
  const card = currentCard();
  sharedSteps = buildSteps(card);
  document.body.classList.add("shared-mode");
  $("#sharedExperience").classList.remove("hidden");
  $("#sharedActions").classList.add("hidden");
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
  if (sharedIsDemo) { $("#sharedExperience").classList.add("hidden"); $("#sharedActions").classList.add("hidden"); document.body.classList.remove("shared-mode"); return; }
  location.href = location.pathname;
}
$("#sharedBack").onclick = closeSharedExperience;
$("#watchAgain").onclick = () => { sharedStep = 0; renderSharedStage(); };
$("#downloadKeepsake").onclick = async () => {
  const target = document.querySelector(".final-card");
  if (!target) return;
  if (!window.html2canvas) { toast("Download engine is loading…"); return; }
  const canvas = await window.html2canvas(target, {backgroundColor:null, scale:2, useCORS:true});
  const a = document.createElement("a");
  a.download = `wishverse-${(sharedWish?.to||"keepsake").replace(/[^a-z0-9]+/gi,"-").toLowerCase()}.png`;
  a.href = canvas.toDataURL("image/png");
  a.click();
};
async function loadSharedWish(){
  const id = new URLSearchParams(location.search).get("wish");
  if (!id) return;
  try {
    if (!firebaseReady || !db) await initFirebase();
    const { getDoc, doc } = firestoreApi;
    const snap = await getDoc(doc(db, "wishes", id));
    if (!snap.exists()) throw new Error("This wish link is not available.");
    showSharedExperience(snap.data());
  } catch (e) {
    console.error(e);
    toast(e.message || "This wish could not be loaded.");
  }
}
renderChips();
renderCards();

// Mobile menu and theme controls
const menuToggle = $("#menuToggle");
if (menuToggle) {
  menuToggle.onclick = () => {
    document.querySelector(".desktop-nav")?.classList.toggle("mobile-open");
  };
}

(async () => {
  const sharedId = new URLSearchParams(window.location.search).get("wish");
  if (sharedId) document.body.classList.add("loading-shared-wish");
  await initFirebase();
  await loadSharedWish();
  document.body.classList.remove("loading-shared-wish");
})();
  
