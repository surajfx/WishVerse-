// ---- Dynamic data from the real WishVerse form (?to=&from=&msg=&photos=&notes=&boxletter=&reasons=&collage=) ----
const _params = new URLSearchParams(location.search);
const TO = _params.get('to') || 'My Love';
const FROM = _params.get('from') || 'Someone';
const MSG = _params.get('msg') || '';
const PHOTOS = (_params.get('photos') || '').split(',').map(s=>s.trim()).filter(Boolean);
const NOTES = (_params.get('notes') || '').split('|').map(s=>s.trim()).filter(Boolean);
const BOXLETTER = _params.get('boxletter') || '';
const COLLAGE = (_params.get('collage') || '').split(',').map(s=>s.trim()).filter(Boolean);

document.title = `For ${TO} — A Rose Garden Proposal`;
const _set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
try{
  _set('toNameEm', TO);
  _set('heartIntroName', `${TO}…`);
  _set('letterGreeting', `Dear ${TO},`);
  _set('letterSig', `— ${FROM}`);
  _set('keepsakeTo', `To ${TO}`);
  _set('finalSigScript', `with love, ${FROM}`);
  if (BOXLETTER) _set('ringBoxCaption', BOXLETTER);
  if (MSG) _set('finalMsg', MSG);
  const _collagePhotos = document.querySelectorAll('.collage .ph');
  const _collageSrc = COLLAGE.length ? COLLAGE : PHOTOS;
  _collagePhotos.forEach((el,i)=>{ if(_collageSrc[i]) el.style.background = `center/cover url('${_collageSrc[i]}')`; });
}catch(e){ console.error('dynamic text setup failed', e); }

// ---- Falling rose petals ----
try{
  const petalsEl = document.getElementById('petals');
  for(let i=0;i<16;i++){
    const p = document.createElement('div');
    p.className='rose-petal';
    p.style.left = (Math.random()*100)+'%';
    p.style.animationDuration = (6+Math.random()*6)+'s';
    p.style.animationDelay = (Math.random()*6)+'s';
    const scale = 0.7 + Math.random()*0.8;
    p.style.transform = `scale(${scale})`;
    petalsEl.appendChild(p);
  }
}catch(e){ console.error('petals failed', e); }

// ---- Screen navigation ----
const screens = {};
for(let i=1;i<=8;i++) screens[i] = document.getElementById('screen'+i);
function fillProgress(screenEl){
  try{
    const badge = screenEl && screenEl.querySelector('.progress-badge');
    if(!badge) return;
    const pct = Number(badge.dataset.pct);
    const fillSvg = badge.querySelector('.heart-fill-svg');
    if(!fillSvg) return;
    fillSvg.style.transition = 'none';
    fillSvg.style.clipPath = 'inset(100% 0 0 0)';
    void fillSvg.offsetWidth;
    fillSvg.style.transition = '';
    requestAnimationFrame(()=>{ fillSvg.style.clipPath = `inset(${100-pct}% 0 0 0)`; });
  }catch(e){ console.error('fillProgress failed', e); }
}
function showScreen(n){
  try{
    Object.values(screens).forEach(s=>{ if(s) s.classList.add('hidden'); });
    if(screens[n]){ screens[n].classList.remove('hidden'); fillProgress(screens[n]); }
    if(n===6) playQuestionHeading();
  }catch(e){ console.error('showScreen failed', e); }
}
try{ fillProgress(screens[1]); }catch(e){ console.error(e); }

const enterBtn = document.getElementById('enterBtn');
if(enterBtn) enterBtn.addEventListener('click', ()=>showScreen(2));

// ---- Screen 2: Photo gallery ----
const galleryPhoto = document.getElementById('galleryPhoto');
const galleryCounter = document.getElementById('galleryCounter');
const galleryCaption = document.getElementById('galleryCaption');
const nextMemoryBtn = document.getElementById('nextMemoryBtn');
const galleryPhotos = PHOTOS.length ? PHOTOS : [null,null,null,null];
const galleryNotes = NOTES.length ? NOTES : ['A memory worth keeping.','A moment I never want to forget.','A little piece of us.','A beautiful moment.'];
let galleryIdx = 0;
function renderGallery(){
  const url = galleryPhotos[galleryIdx];
  galleryPhoto.style.background = url ? `center/cover url('${url}')` : 'linear-gradient(135deg,#7a2347,#1a0a14)';
  galleryCounter.textContent = `Photo ${galleryIdx+1} of ${galleryPhotos.length}`;
  galleryCaption.textContent = galleryNotes[galleryIdx] || '';
  nextMemoryBtn.textContent = (galleryIdx === galleryPhotos.length-1) ? 'Continue' : 'Next Memory';
}
renderGallery();
nextMemoryBtn.addEventListener('click', ()=>{
  if(galleryIdx < galleryPhotos.length-1){ galleryIdx++; renderGallery(); }
  else { showScreen(3); }
});

// ---- Screen 3: Heart introduction ----
document.getElementById('yesIntroBtn').addEventListener('click', ()=>showScreen(4));

// ---- Screen 4: Ring box ----
document.getElementById('askBtn').addEventListener('click', ()=>showScreen(5));

// ---- Screen 5: Personal message (typewriter with pen) ----
function typeInto(el, text, speed, cb){
  clearTimeout(el._penTimer);
  let i = 0;
  const pen = document.createElement('span');
  pen.className='pen'; pen.textContent='🖊️';
  el.textContent = '';
  function tick(){
    i++;
    el.textContent = text.slice(0,i);
    el.appendChild(pen);
    if(i < text.length){ el._penTimer = setTimeout(tick, speed); }
    else { pen.remove(); if(cb) cb(); }
  }
  tick();
}
function typeParagraphs(container, paragraphs, cb){
  container.innerHTML = '';
  let idx = 0;
  function next(){
    if(idx >= paragraphs.length){ if(cb) cb(); return; }
    const p = document.createElement('p');
    p.className = 'body-text';
    container.appendChild(p);
    typeInto(p, paragraphs[idx], 24, ()=>{ idx++; next(); });
  }
  next();
}
const letterCard = document.getElementById('letterCard');
const letterBody = document.getElementById('letterBody');
const continueBtn5 = document.getElementById('continueBtn5');
const letterParagraphs = MSG ? [MSG] : [
  "From the very first memory, I knew there was something different about you.",
  "Every moment since has only made me more certain."
];
let letterStarted = false;
const screen5 = screens[5];
new MutationObserver(()=>{
  if(!screen5.classList.contains('hidden') && !letterStarted){
    letterStarted = true;
    setTimeout(()=>{
      letterCard.classList.add('show');
      typeParagraphs(letterBody, letterParagraphs, ()=>continueBtn5.classList.add('show'));
    }, 200);
  }
}).observe(screen5, {attributes:true, attributeFilter:['class']});
continueBtn5.addEventListener('click', ()=>showScreen(6));

// ---- Screen 6: Question reveal (typewriter heading) ----
const questionHeading = document.getElementById('questionHeading');
let questionTyped = false;
function playQuestionHeading(){
  if(questionTyped) return; questionTyped = true;
  const text = questionHeading.dataset.text;
  questionHeading.textContent = ''; questionHeading.classList.add('typing');
  let i = 0;
  const timer = setInterval(()=>{
    i++; questionHeading.textContent = text.slice(0,i);
    if(i >= text.length){ clearInterval(timer); questionHeading.classList.remove('typing'); }
  }, 55);
}
document.getElementById('answerBtn').addEventListener('click', ()=>showScreen(7));

// ---- Screen 7: Final proposal — ring reveal + dodging No button ----
const yesBtn = document.getElementById('yesBtn');
const noBtn = document.getElementById('noBtn');
const finalBtns = document.getElementById('finalBtns');
const dodgeIndicator = document.getElementById('dodgeIndicator');
const noTeases = ['No','Nope','Not happening','Try again','Nice try','Still no','Almost!','So close','Nuh-uh','Keep trying'];
let noMoves = 0;
function dodgeNo(){
  const wrapRect = finalBtns.getBoundingClientRect();
  const btnW = noBtn.offsetWidth || 70, btnH = noBtn.offsetHeight || 42;
  const maxX = Math.max(10, wrapRect.width - btnW - 10);
  const maxY = Math.max(10, wrapRect.height - btnH - 10);
  noBtn.style.left = (Math.random()*maxX) + 'px';
  noBtn.style.top = (Math.random()*maxY) + 'px';
  noBtn.style.transform = 'scale(1.12)';
  setTimeout(()=>{ noBtn.style.transform = 'scale(1)'; }, 180);
  noMoves++;
  noBtn.textContent = noTeases[Math.min(noMoves, noTeases.length-1)];
  noBtn.style.opacity = Math.max(.35, 1 - noMoves*0.05);
  dodgeIndicator.textContent = `Running from love (${noMoves}×)`;
  dodgeIndicator.classList.add('show');
}
noBtn.addEventListener('pointerdown', e=>{ e.preventDefault(); dodgeNo(); }, {passive:false});
noBtn.addEventListener('pointerenter', dodgeNo);
finalBtns.addEventListener('pointermove', e=>{
  const r = noBtn.getBoundingClientRect();
  const cx = r.left + r.width/2, cy = r.top + r.height/2;
  const dist = Math.hypot(e.clientX-cx, e.clientY-cy);
  if(dist < 70) dodgeNo();
});
yesBtn.addEventListener('click', ()=>showScreen(8));

// ---- Screen 8: Keepsake ----
document.getElementById('replayBtn').addEventListener('click', ()=>{
  galleryIdx = 0; renderGallery();
  letterStarted = false; letterCard.classList.remove('show'); continueBtn5.classList.remove('show'); letterBody.innerHTML='';
  questionTyped = false;
  noMoves = 0; noBtn.style.left=''; noBtn.style.top=''; noBtn.style.opacity='1'; noBtn.textContent='No'; dodgeIndicator.classList.remove('show');
  showScreen(1);
});
document.getElementById('downloadBtn').addEventListener('click', function(){ this.textContent = 'Saved ✓'; });
    
