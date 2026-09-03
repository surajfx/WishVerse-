import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCPZ39YnVkITns2UpnPM6LzSw1lPDDrZGQ",
  authDomain: "surajfx3-731fb.firebaseapp.com",
  databaseURL: "https://surajfx3-731fb-default-rtdb.firebaseio.com",
  projectId: "surajfx3-731fb",
  storageBucket: "surajfx3-731fb.firebasestorage.app",
  messagingSenderId: "346279566901",
  appId: "1:346279566901:web:32d331a9051da9caa55b7c",
  measurementId: "G-80CTS299RN"
};

const CLOUDINARY_CLOUD_NAME = "wtlx95j4";
const CLOUDINARY_UPLOAD_PRESET = "ml_default";

let db = null;
try { db = getFirestore(initializeApp(firebaseConfig)); } catch (error) { console.warn("Firebase is not configured:", error); }

const wishes = [
  ["proposal","💍","Proposal","Love","A beautiful question deserves a beautiful moment.","Will you be mine?"],
  ["girlfriend","🌹","Girlfriend Special","Love","A sweet little surprise for your favorite person.","You make my world softer and brighter."],
  ["boyfriend","🖤","Boyfriend Special","Love","A heartfelt card for the person who feels like home.","Life feels better with you in it."],
  ["distance","💞","Long Distance Love","Love","For two hearts that are far away but never apart.","Miles cannot change what you mean to me."],
  ["anniversary","❤️","Anniversary","Love","Celebrate the memories, the growth and the love.","Every chapter with you is my favorite."],
  ["letter","💌","Love Letter","Love","A timeless letter-style experience for honest feelings.","If I could write one thing forever, it would be us."],
  ["confession","💕","Love Confession","Love","Say the words you have been keeping in your heart.","I think I have fallen for you."],
  ["miss","☁️","Miss You","Emotion","A soft, emotional card for someone you wish was near.","I wish you were here right now."],
  ["sorry","🥺","Sorry","Emotion","A gentle way to say what matters after a difficult moment.","I am sorry. You matter more than my pride."],
  ["special","💖","You Are Special","Special","Remind someone that they are deeply appreciated.","You are one of the best things in my life."],
  ["birthday","🎂","Birthday Surprise","Celebration","A joyful birthday reveal with room for your own message.","Today is all about celebrating you."],
  ["bestfriend","👑","Best Friend Special","Friends","For the friend who turns ordinary days into memories.","Thank you for being my person."],
  ["countdown","📅","Countdown Until We Meet","Long Distance","A sweet anticipation card for the next meeting.","Counting every day until I see you again."],
  ["morning","🌞","Good Morning","Daily","Start someone's day with a warm, personal message.","Good morning. I hope today is kind to you."],
  ["night","🌙","Good Night","Daily","A peaceful good-night message for a special person.","Good night. You are my favorite thought before sleep."]
];

let selectedWish = wishes[0];
let selectedPhoto = "";
const favorites = new Set(JSON.parse(localStorage.getItem("wishverse-favorites") || "[]"));

const $ = (id) => document.getElementById(id);
const grid = $("wishGrid"), favoriteGrid = $("favoriteGrid");

function cardHTML(wish) {
  const [id, icon, title, type, description] = wish;
  return `<article class="wish-card" data-id="${id}">
    <div class="wish-art art-${id}">
      <button class="heart-button ${favorites.has(id) ? "active" : ""}" data-favorite="${id}" aria-label="Save ${title}">${favorites.has(id) ? "♥" : "♡"}</button>
      <span class="art-icon">${icon}</span><span class="art-label">${title}</span>
    </div>
    <div class="wish-card-info"><h3>${title}</h3><p>${type} · ${description}</p></div>
  </article>`;
}

function render(list = wishes) {
  grid.innerHTML = list.map(cardHTML).join("");
  const favs = wishes.filter(w => favorites.has(w[0]));
  favoriteGrid.innerHTML = favs.map(cardHTML).join("");
  $("favoriteEmpty").classList.toggle("hidden", favs.length > 0);
  $("emptyState").classList.toggle("hidden", list.length > 0);
}

function openCard(id) {
  selectedWish = wishes.find(w => w[0] === id) || wishes[0];
  const [key, icon, title, type, description, demo] = selectedWish;
  $("modalEyebrow").textContent = type;
  $("modalTitle").textContent = title;
  $("modalDescription").textContent = description;
  $("modalPreview").innerHTML = previewHTML(selectedWish, demo);
  $("modalFavorite").textContent = favorites.has(key) ? "♥ Saved" : "♡ Save";
  $("cardModal").classList.remove("hidden");
}

function previewHTML(wish, message) {
  const [key, icon, title] = wish;
  return `<div class="preview-art art-${key}"><div class="preview-icon">${icon}</div><h3>${title}</h3><p>${message || wish[5] || ""}</p><span class="hero-signature">With love, always ♥</span></div>`;
}

function openCreator() {
  $("creatorTitle").textContent = `Create ${selectedWish[2]}`;
  $("wishForm").reset();
  selectedPhoto = "";
  $("formStatus").textContent = "";
  updateLivePreview();
  $("creatorModal").classList.remove("hidden");
}

function updateLivePreview() {
  const data = new FormData($("wishForm"));
  const from = data.get("from") || "Your name";
  const to = data.get("to") || "Someone special";
  const message = data.get("message") || selectedWish[5] || "Write something from your heart...";
  $("livePreview").innerHTML = previewHTML(selectedWish, message) + `<small class="preview-names">${from} → ${to}</small>`;
}

async function uploadToCloudinary(file) {
  if (!file) return "";
  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method:"POST", body });
  if (!response.ok) throw new Error("Image upload failed");
  const result = await response.json();
  return result.secure_url;
}

function makeLocalShareId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function createWish(event) {
  event.preventDefault();
  const form = new FormData($("wishForm"));
  const status = $("formStatus");
  status.textContent = "Preparing your wish...";
  try {
    let imageUrl = "";
    const file = $("photoInput").files[0];
    if (file) {
      status.textContent = "Uploading your photo...";
      imageUrl = await uploadToCloudinary(file);
    }
    const wishData = {
      templateId: selectedWish[0],
      templateTitle: selectedWish[2],
      from: form.get("from") || "",
      to: form.get("to") || "",
      message: form.get("message") || selectedWish[5] || "",
      imageUrl,
      createdAt: new Date().toISOString()
    };
    let shareId = makeLocalShareId();
    if (db) {
      const doc = await addDoc(collection(db, "wishes"), { ...wishData, createdAt: serverTimestamp() });
      shareId = doc.id;
    } else {
      localStorage.setItem(`wish-${shareId}`, JSON.stringify(wishData));
    }
    const link = `${location.origin}${location.pathname}#wish/${shareId}`;
    $("shareLink").value = link;
    $("creatorModal").classList.add("hidden");
    $("shareModal").classList.remove("hidden");
  } catch (error) {
    console.error(error);
    status.textContent = "Something went wrong. Please check Firebase/Cloudinary settings.";
  }
}

function toggleFavorite(id) {
  favorites.has(id) ? favorites.delete(id) : favorites.add(id);
  localStorage.setItem("wishverse-favorites", JSON.stringify([...favorites]));
  render();
}

document.addEventListener("click", (event) => {
  const wishCard = event.target.closest(".wish-card");
  const favButton = event.target.closest("[data-favorite]");
  if (favButton) { event.stopPropagation(); toggleFavorite(favButton.dataset.favorite); return; }
  if (wishCard) { openCard(wishCard.dataset.id); return; }
  if (event.target.matches("[data-close]") || event.target.classList.contains("modal-backdrop")) {
    event.target.closest(".modal-backdrop")?.classList.add("hidden");
  }
});
$("modalStart").addEventListener("click", () => { $("cardModal").classList.add("hidden"); openCreator(); });
$("modalFavorite").addEventListener("click", () => { toggleFavorite(selectedWish[0]); $("modalFavorite").textContent = favorites.has(selectedWish[0]) ? "♥ Saved" : "♡ Save"; });
$("wishForm").addEventListener("input", updateLivePreview);
$("wishForm").addEventListener("submit", createWish);
$("photoInput").addEventListener("change", updateLivePreview);
$("searchInput").addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase().trim();
  render(wishes.filter(w => w.join(" ").toLowerCase().includes(query)));
});
$("heroExplore").addEventListener("click", () => $("explore").scrollIntoView({behavior:"smooth"}));
["heroCreate","headerCreate"].forEach(id => $(id).addEventListener("click", () => { selectedWish = wishes[0]; openCreator(); }));
$("themeToggle").addEventListener("click", () => {
  document.documentElement.classList.toggle("light");
  $("themeToggle").textContent = document.documentElement.classList.contains("light") ? "☀" : "☾";
});
$("copyLink").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("shareLink").value);
  $("copyLink").textContent = "Copied!";
  setTimeout(() => $("copyLink").textContent = "Copy", 1500);
});

function showSharedWish() {
  const hash = location.hash;
  if (!hash.startsWith("#wish/")) return;
  const id = hash.slice(6);
  const saved = JSON.parse(localStorage.getItem(`wish-${id}`) || "null");
  if (!saved) return;
  const template = wishes.find(w => w[0] === saved.templateId) || wishes[0];
  selectedWish = template;
  $("modalEyebrow").textContent = "A shared wish";
  $("modalTitle").textContent = `${saved.from || "Someone"} sent a wish`;
  $("modalDescription").textContent = saved.to ? `For ${saved.to}` : "A message from the heart";
  $("modalPreview").innerHTML = previewHTML(template, saved.message);
  $("cardModal").classList.remove("hidden");
}
window.addEventListener("hashchange", showSharedWish);
render();
showSharedWish();

