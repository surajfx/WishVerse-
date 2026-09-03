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
async function initFirebase(){
  try {
    const [{ initializeApp }, firestore] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
    ]);
    db = firestore.getFirestore(initializeApp(firebaseConfig));
    firebaseReady = true;
  } catch (error) {
    console.error("Firebase could not initialize:", error);
    toast("Cards are ready. Firebase setup is not connected yet.");
  }
}

const cards = [
 {id:"birthday",title:"Birthday Surprise",category:"Celebration",desc:"Make their special day unforgettable.",colors:["#ffd6e7","#ffc2d8"]},
 {id:"love",title:"Just For You",category:"Love",desc:"A little message from your heart.",colors:["#ffd1dc","#ffb3c6"]},
 {id:"eid",title:"Eid Mubarak",category:"Festival",desc:"Warm wishes, peace and blessings.",colors:["#d8f3dc","#95d5b2"]},
 {id:"diwali",title:"Happy Diwali",category:"Festival",desc:"Light, joy and beautiful beginnings.",colors:["#ffe8b6","#ffc971"]},
 {id:"friendship",title:"Best Friends",category:"Friends",desc:"For the person who makes life brighter.",colors:["#cde7ff","#a8dadc"]},
 {id:"family",title:"With Love, Family",category:"Family",desc:"A heartfelt note for your loved ones.",colors:["#e5d4ff","#cdb4db"]},
 {id:"anniversary",title:"Our Anniversary",category:"Love",desc:"Celebrate every beautiful chapter.",colors:["#ffd6a5","#ffadad"]},
 {id:"proposal",title:"One Question",category:"Love",desc:"A special moment deserves a special wish.",colors:["#ffc8dd","#bde0fe"]},
 {id:"thankyou",title:"Thank You",category:"Daily",desc:"Say thanks in a meaningful way.",colors:["#d9ed92","#b5e48c"]},
 {id:"goodmorning",title:"Good Morning",category:"Daily",desc:"Start their day with a smile.",colors:["#ffef9f","#ffd166"]},
 {id:"goodnight",title:"Good Night",category:"Daily",desc:"A peaceful wish before sleep.",colors:["#c8b6ff","#b8c0ff"]},
 {id:"girlfriend",title:"Girlfriend Day",category:"Love",desc:"A sweet reminder of how special she is.",colors:["#ffcad4","#f4acb7"]},
 {id:"brother",title:"For My Brother",category:"Family",desc:"A bond that keeps getting stronger.",colors:["#bde0fe","#a2d2ff"]},
 {id:"sister",title:"For My Sister",category:"Family",desc:"A beautiful wish for your favorite person.",colors:["#e2afff","#cdb4db"]},
 {id:"congratulations",title:"Congratulations",category:"Celebration",desc:"Celebrate their success with love.",colors:["#caffbf","#9bf6ff"]}
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
    <div class="card-art" style="background:linear-gradient(135deg,${card.colors[0]},${card.colors[1]})">
      <p>${card.category.toUpperCase()}</p><h3>${card.title}</h3><p>Made with love ✦</p>
    </div>
    <div class="card-meta"><div><strong>${card.title}</strong><br><small>${card.desc}</small></div>
      <div class="card-actions">
        <button class="small-btn favorite-btn ${fav?"active":""}" data-fav="${card.id}" aria-label="Favorite">${fav?"♥":"♡"}</button>
        <button class="small-btn" data-open="${card.id}">Open</button>
      </div>
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
  $("#modalPreview").style.background = `linear-gradient(135deg,${selectedCard.colors[0]},${selectedCard.colors[1]})`;
  $("#modalPreview").innerHTML = `<div class="card-art" style="height:100%;background:transparent"><p>${selectedCard.category.toUpperCase()}</p><h3>${selectedCard.title}</h3><p>Every feeling deserves a beautiful place.</p></div>`;
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
  const cloudName = "YOUR_CLOUDINARY_CLOUD_NAME";
  const uploadPreset = "YOUR_UNSIGNED_UPLOAD_PRESET";
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
$("#demoBtn").onclick = () => toast("Live demo preview is shown above.");
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
    imageUrl: uploadedImageUrl, createdAt: serverTimestamp()
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

async function loadSharedWish() {
  const id = new URLSearchParams(location.search).get("wish");
  if (!id) return;
  try {
    if (!firebaseReady || !db) return;
    const { getDocs, collection } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const snapshot = await getDocs(collection(db, "wishes"));
    const match = snapshot.docs.find(d => d.id === id);
    if (!match) return;
    const wish = match.data();
    selectedCard = cards.find(c => c.id === wish.templateId) || cards[0];
    openCustomize();
    $("#fromInput").value = wish.from || "";
    $("#toInput").value = wish.to || "";
    $("#messageInput").value = wish.message || "";
    toast("Shared wish loaded");
  } catch (e) { console.log("Shared wish unavailable", e); }
}

renderChips();
renderCards();
initFirebase();
loadSharedWish();
