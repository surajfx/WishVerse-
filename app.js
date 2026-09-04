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

const cards = [
 {id:"proposal",title:"Proposal",category:"Love",desc:"A beautiful question deserves a beautiful moment.",icon:"💍",art:"art-proposal"},
 {id:"girlfriend",title:"Girlfriend Special",category:"Love",desc:"A sweet little surprise for your favorite person.",icon:"🌹",art:"art-girlfriend"},
 {id:"boyfriend",title:"Boyfriend Special",category:"Love",desc:"A heartfelt card for the person who feels like home.",icon:"🖤",art:"art-boyfriend"},
 {id:"distance",title:"Long Distance Love",category:"Love",desc:"For two hearts that are far away but never apart.",icon:"💞",art:"art-distance"},
 {id:"anniversary",title:"Anniversary",category:"Love",desc:"Celebrate the memories, the growth and the love.",icon:"❤️",art:"art-anniversary"},
 {id:"letter",title:"Love Letter",category:"Love",desc:"A timeless letter-style experience for honest feelings.",icon:"💌",art:"art-letter"},
 {id:"confession",title:"Love Confession",category:"Love",desc:"Say the words you have been keeping in your heart.",icon:"💕",art:"art-confession"},
 {id:"miss",title:"Miss You",category:"Emotion",desc:"A soft, emotional card for someone you wish was near.",icon:"☁️",art:"art-miss"},
 {id:"sorry",title:"Sorry",category:"Emotion",desc:"A gentle way to say what matters after a difficult moment.",icon:"🥺",art:"art-sorry"},
 {id:"special",title:"You Are Special",category:"Special",desc:"Remind someone that they are deeply appreciated.",icon:"💖",art:"art-special"},
 {id:"birthday",title:"Birthday Surprise",category:"Celebration",desc:"A joyful birthday reveal with room for your own message.",icon:"🎂",art:"art-birthday"},
 {id:"bestfriend",title:"Best Friend Special",category:"Friends",desc:"For the friend who turns ordinary days into memories.",icon:"👑",art:"art-bestfriend"},
 {id:"countdown",title:"Countdown Until We Meet",category:"Long Distance",desc:"A sweet anticipation card for the next meeting.",icon:"📅",art:"art-countdown"},
 {id:"morning",title:"Good Morning",category:"Daily",desc:"Start someone's day with a warm, personal message.",icon:"🌞",art:"art-morning"},
 {id:"night",title:"Good Night",category:"Daily",desc:"A peaceful good-night message for a special person.",icon:"🌙",art:"art-night"}
];

let selectedCard = cards[0];
let activeCategory = "All";
let favorites = JSON.parse(localStorage.getItem("wishverse-favorites") || "[]");
let uploadedImageUrl = "";

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
  closeModal("#cardModal");
  $("#wishForm").classList.remove("hidden");
  $("#createdResult").classList.add("hidden");
  $("#customizeModal").classList.remove("hidden");
}

function toast(message) {
  const t = $("#toast"); t.textContent = message; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

async function uploadToCloudinary(file) {
  // Add your Cloudinary cloud name and unsigned upload preset here.
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
$("#heroCreate").onclick = () => openCustomize();
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

$("#imageInput").onchange = async e => {
  const file = e.target.files[0]; if (!file) return;
  $("#uploadStatus").textContent = "Uploading image...";
  try { uploadedImageUrl = await uploadToCloudinary(file); $("#uploadStatus").textContent = uploadedImageUrl ? "Image uploaded successfully." : "Image selected. Add Cloudinary keys to enable upload."; }
  catch { uploadedImageUrl = ""; $("#uploadStatus").textContent = "Upload failed. You can continue without an image."; }
};

$("#wishForm").onsubmit = async e => {
  e.preventDefault();
  const payload = {
    templateId: selectedCard.id, templateTitle: selectedCard.title,
    category: selectedCard.category, from: $("#fromInput").value.trim(),
    to: $("#toInput").value.trim(), message: $("#messageInput").value.trim(),
    imageUrl: uploadedImageUrl, createdAt: firestoreApi.serverTimestamp()
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

let sharedWish = null;
let sharedStep = 0;

function escapeHTML(value="") {
  return String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}

function showSharedExperience(wish, isDemo=false) {
  sharedWish = wish;
  sharedStep = 0;
  document.body.classList.add("shared-mode");
  $("#sharedExperience").classList.remove("hidden");
  renderSharedStage(isDemo);
}

function renderSharedStage(isDemo=false) {
  const w = sharedWish || {};
  const card = cards.find(c => c.id === w.templateId) || cards[0];
  const name = escapeHTML(w.to || "Someone Special");
  const from = escapeHTML(w.from || "Someone who cares");
  const message = escapeHTML(w.message || card.desc);
  const photo = w.imageUrl ? `<img class="memory-photo" src="${escapeHTML(w.imageUrl)}" alt="A shared memory">` : `<div class="memory-placeholder">${card.icon}<small>Your beautiful memory</small></div>`;
  const stages = [
    `<div class="shared-kicker">A LITTLE SURPRISE FOR</div><h1>For ${name}<span>♥</span></h1><p class="shared-intro">Someone made this little corner of the internet just for you.</p><button class="shared-cta" data-next>Open your wish <b>→</b></button>`,
    `<div class="shared-kicker">OUR BEAUTIFUL MEMORIES</div><h2>One moment, one memory, one feeling.</h2><div class="memory-frame">${photo}</div><p class="memory-count">Photo 1 of 1 · tap the frame to continue</p><button class="shared-cta" data-next>Next Memory <b>→</b></button>`,
    `<div class="shared-kicker">FROM THE HEART</div><h2>A message for ${name}</h2><div class="letter-card"><p>${message}</p><div class="letter-sign">With love,<br><strong>${from}</strong></div></div><button class="shared-cta" data-next>Read the final surprise <b>→</b></button>`,
    `<div class="shared-kicker">BE MY FOREVER</div><h2>${name}, you are special.</h2><div class="final-card">${photo}<p>${message}</p><div class="letter-sign">Always,<br><strong>${from}</strong></div></div><button class="shared-cta" id="sharedClose">Back to WishVerse <b>↗</b></button>`
  ];
  $("#sharedStage").innerHTML = stages[sharedStep];
  document.querySelectorAll("[data-next]").forEach(btn => btn.onclick = () => { sharedStep=Math.min(sharedStep+1,3); renderSharedStage(isDemo); });
  $("#sharedClose")?.addEventListener("click", closeSharedExperience);
  document.querySelectorAll(".shared-progress i").forEach((el,i)=>el.classList.toggle("active",i<=Math.min(sharedStep,2)));
}

function closeSharedExperience() {
  $("#sharedExperience").classList.add("hidden");
  document.body.classList.remove("shared-mode");
  if (new URLSearchParams(location.search).has("wish")) history.replaceState({},"",location.pathname);
}
$("#sharedBack").onclick = closeSharedExperience;

async function loadSharedWish() {
  const id = new URLSearchParams(window.location.search).get("wish");
  if (!id) return;
  try {
    if (!firebaseReady || !db) await initFirebase();
    if (!firebaseReady || !db) throw new Error("Firebase is not connected");
    const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const snapshot = await getDoc(doc(db, "wishes", id));
    if (!snapshot.exists()) throw new Error("This wish link is not available.");
    showSharedExperience(snapshot.data());
  } catch (e) {
    console.error("Shared wish unavailable:", e);
    toast(e?.code?.includes("permission-denied") ? "Firestore read permission is blocked. Publish the rules from this ZIP." : (e.message || "This wish link could not be loaded."));
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
                               
