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

const cards = [
 {id:"proposal",title:"Proposal",category:"Love",desc:"A beautiful question deserves a beautiful moment.",example:"I have something important to ask you... You make my world brighter every day. Will you be my forever? ❤️",icon:"💍",art:"art-proposal",formHint:"Write a message that feels like your heart speaking."},
 {id:"birthday",title:"Happy Birthday",category:"Celebration",desc:"A joyful birthday surprise made just for them.",example:"Happy Birthday! May this year bring you happiness, success, love and beautiful memories. You deserve the best. 🎂✨",icon:"🎂",art:"art-birthday",formHint:"Add a birthday message they will want to read again."},
 {id:"girlfriend",title:"Girlfriend / Boyfriend Day",category:"Love",desc:"A personal surprise for your favourite person.",example:"You are my favourite person, my safest place and my sweetest part of every day. I am so lucky to have you. ❤️",icon:"💖",art:"art-girlfriend",formHint:"Tell them what makes your relationship special."},
 {id:"sorry",title:"Sorry",category:"Emotion",desc:"A gentle way to say what matters after a difficult moment.",example:"I am truly sorry. You matter to me more than my pride, and I hope we can make things right. 🤍",icon:"🥺",art:"art-sorry",formHint:"Say what you feel honestly, in your own words."},
 {id:"miss",title:"Miss You",category:"Emotion",desc:"A soft memory journey for someone you wish was near.",example:"I miss your voice, your smile and all the little moments we share. I wish you were here. 🌙❤️",icon:"🌙",art:"art-miss",formHint:"Write the little things you miss most."}
];

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

let sharedWish = null;
let sharedStep = 0;
let sharedIsDemo = false;
function escapeHTML(value=""){return String(value).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function getPhotos(w){return (w.imageUrls&&w.imageUrls.length?w.imageUrls:(w.imageUrl?[w.imageUrl]:[])).slice(0,4);}
function showSharedExperience(wish,isDemo=false){sharedWish=wish;sharedStep=0;sharedIsDemo=isDemo;document.body.classList.add('shared-mode');$('#sharedExperience').classList.remove('hidden');$('#sharedActions').classList.add('hidden');renderSharedStage();}
function renderSharedStage(){
 const w=sharedWish||{}, card=cards.find(c=>c.id===w.templateId)||cards[0], name=escapeHTML(w.to||'Someone Special'), from=escapeHTML(w.from||'Someone who cares'), msg=escapeHTML(w.message||card.example), photos=getPhotos(w), photoIndex=Math.min(Math.max(sharedStep-2,0),Math.max(photos.length-1,0));
 const photo=photos.length?`<img class="memory-photo" src="${escapeHTML(photos[photoIndex])}" alt="A memory">`:`<div class="memory-placeholder">${card.icon}<small>Add your beautiful memory</small></div>`;
 const themes={proposal:{k:'A QUESTION FROM THE HEART',open:'There is something I need to ask you…',memory:'Our Beautiful Memories',final:'Will You Be My Forever? ❤️'},birthday:{k:'A LITTLE SURPRISE FOR',open:'Happy Birthday',memory:'Birthday Memories',final:'Make a Wish 🎂'},girlfriend:{k:'MADE JUST FOR YOU',open:'You Make My World Brighter',memory:'Our Little Moments',final:'You Are My Favourite Person ❤️'},sorry:{k:'A MESSAGE FROM MY HEART',open:'I Owe You An Apology',memory:'The Moments That Matter',final:'Can We Make Things Right? 🤍'},miss:{k:'FOR SOMEONE I WISH WAS HERE',open:'I Miss You',memory:'Memories I Hold Close',final:'Until We Meet Again 🌙'}}[card.id];
 let html='';
 if(sharedStep===0) html=`<div class="experience-orb ${card.art}"><span>${card.icon}</span></div><div class="shared-kicker">${themes.k}</div><h1>${themes.open}<span>${name}</span></h1><p class="shared-intro">Someone made this little experience just for you.</p><button class="shared-cta" data-next>Tap to open <b>→</b></button>`;
 else if(sharedStep<=4) html=`<div class="shared-kicker">${themes.memory}</div><h2>One photo. One memory. One feeling.</h2><div class="memory-frame ${card.art}">${photo}</div><p class="memory-count">Memory ${Math.min(sharedStep,4)} of 4</p><button class="shared-cta" data-next>${sharedStep<4?'Next Memory':'Read the message'} <b>→</b></button>`;
 else if(sharedStep===5) html=`<div class="shared-kicker">FROM THE HEART</div><h2>A message for ${name}</h2><div class="letter-card ${card.art}"><p>${msg}</p><div class="letter-sign">With love,<br><strong>${from}</strong></div></div><button class="shared-cta" data-next>Open the final surprise <b>→</b></button>`;
 else html=`<div class="shared-kicker">THE FINAL MOMENT</div><h2>${themes.final}</h2><div class="final-card ${card.art}">${photos.length?`<div class="final-collage">${photos.map((u,i)=>`<img src="${escapeHTML(u)}" alt="Memory ${i+1}">`).join('')}</div>`:''}<p>${msg}</p><div class="letter-sign">With love,<br><strong>${from}</strong></div></div>`;
 $('#sharedStage').innerHTML=html; document.querySelectorAll('[data-next]').forEach(b=>b.onclick=()=>{sharedStep=Math.min(sharedStep+1,6);renderSharedStage();});
 if(sharedStep===6) $('#sharedActions').classList.remove('hidden'); else $('#sharedActions').classList.add('hidden');
 document.querySelectorAll('.shared-progress i').forEach((el,i)=>el.classList.toggle('active',i<=Math.min(sharedStep,3)));
}
function closeSharedExperience(){if(sharedIsDemo){$('#sharedExperience').classList.add('hidden');$('#sharedActions').classList.add('hidden');document.body.classList.remove('shared-mode');return;}location.href=location.pathname;}
$('#sharedBack').onclick=closeSharedExperience; $('#watchAgain').onclick=()=>{sharedStep=0;renderSharedStage();};
$('#downloadKeepsake').onclick=async()=>{const target=document.querySelector('.final-card');if(!target)return; if(!window.html2canvas){toast('Download engine is loading…');return;}const canvas=await window.html2canvas(target,{backgroundColor:null,scale:2,useCORS:true});const a=document.createElement('a');a.download=`wishverse-${(sharedWish?.to||'keepsake').replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.png`;a.href=canvas.toDataURL('image/png');a.click();};
async function loadSharedWish(){const id=new URLSearchParams(location.search).get('wish');if(!id)return;try{if(!firebaseReady||!db)await initFirebase();const {getDoc,doc}=firestoreApi;const snap=await getDoc(doc(db,'wishes',id));if(!snap.exists())throw new Error('This wish link is not available.');showSharedExperience(snap.data());}catch(e){console.error(e);toast(e.message||'This wish could not be loaded.');}}
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
  
