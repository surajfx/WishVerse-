// ---- Dynamic data from the real WishVerse form ----
const _params = new URLSearchParams(location.search);
const TO = _params.get('to') || 'My Love';
const FROM = _params.get('from') || 'Someone';
const MSG = _params.get('msg') || '';
const PHOTOS = (_params.get('photos') || '').split(',').map(s=>s.trim()).filter(Boolean);
const NOTES = (_params.get('notes') || '').split('|').map(s=>s.trim()).filter(Boolean);
const BOXLETTER = _params.get('boxletter') || '';
const COLLAGE = (_params.get('collage') || '').split(',').map(s=>s.trim()).filter(Boolean);

document.title = `Missing You, ${TO}`;
const _set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
try{
  _set('introMsg', BOXLETTER || `Hey ${TO}, someone is missing you deeply right now.`);
  _set('distFrom', FROM);
  _set('distTo', TO);
  _set('nbSig', `— ${FROM}`);
  _set('keepsakeTo', `To ${TO}`);
  _set('finalSigScript', `with love, ${FROM}`);
  if (MSG) _set('finalMsg', MSG);
  const _collagePhotos = document.querySelectorAll('.collage .ph');
  const _collageSrc = COLLAGE.length ? COLLAGE : PHOTOS;
  _collagePhotos.forEach((el,i)=>{ if(_collageSrc[i]) el.style.background = `center/cover url('${_collageSrc[i]}')`; });
}catch(e){ console.error('dynamic text setup failed', e); }

try{
  const starsEl = document.getElementById('stars');
  for(let i=0;i<24;i++){
    const s = document.createElement('div');
    s.className='star';
    const size = 1 + Math.random()*2;
    s.style.width = size+'px'; s.style.height = size+'px';
    s.style.left = (Math.random()*100)+'%'; s.style.top = (Math.random()*100)+'%';
    s.style.animationDelay = (Math.random()*3)+'s';
    starsEl.appendChild(s);
  }
}catch(e){ console.error('stars failed', e); }

// ---- Screens ----
const screens = {};
for(let i=1;i<=6;i++) screens[i] = document.getElementById('screen'+i);
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
  }catch(e){ console.error('showScreen failed', e); }
}
try{ fillProgress(screens[1]); }catch(e){ console.error(e); }

const openLetterBtn = document.getElementById('openLetterBtn');
if(openLetterBtn) openLetterBtn.addEventListener('click', ()=>showScreen(2));

// ---- Screen 2: Fog-wipe photo reveal ----
const fogPhotos = PHOTOS.length ? PHOTOS : [null,null,null];
const fogPhoto = document.getElementById('fogPhoto');
const fogCanvas = document.getElementById('fogCanvas');
const fogInstruction = document.getElementById('fogInstruction');
const beautifulLabel = document.getElementById('beautifulLabel');
const nextMemoryBtn = document.getElementById('nextMemoryBtn');
const fogDotsWrap = document.getElementById('fogDots');
fogPhotos.forEach((_,i)=>{ const d=document.createElement('div'); d.className='dot'+(i===0?' active':''); fogDotsWrap.appendChild(d); });
const fogDotEls = fogDotsWrap.querySelectorAll('.dot');
let fogIdx = 0;
let fogCtx, fogDrawing=false, fogPathLen=0, fogLastX=0, fogLastY=0, fogDone=false;

function resizeFogCanvas(){
  fogCanvas.width = fogCanvas.clientWidth;
  fogCanvas.height = fogCanvas.clientHeight;
  fogCtx = fogCanvas.getContext('2d');
  fogCtx.globalCompositeOperation = 'source-over';
  fogCtx.fillStyle = '#DCE7F0';
  fogCtx.fillRect(0,0,fogCanvas.width,fogCanvas.height);
}
function fogErase(x,y){
  fogCtx.globalCompositeOperation = 'destination-out';
  fogCtx.beginPath(); fogCtx.arc(x,y,32,0,Math.PI*2); fogCtx.fill();
}
function fogPos(e){ const r = fogCanvas.getBoundingClientRect(); return [e.clientX-r.left, e.clientY-r.top]; }
function revealFogFully(){
  fogDone = true; fogDrawing = false;
  fogCtx.clearRect(0,0,fogCanvas.width,fogCanvas.height);
  fogInstruction.style.opacity = '0';
  beautifulLabel.classList.add('show');
  nextMemoryBtn.classList.add('show');
  nextMemoryBtn.textContent = (fogIdx === fogPhotos.length-1) ? 'See Our Distance' : 'Next Memory';
}
function loadFogPhoto(){
  const url = fogPhotos[fogIdx];
  fogPhoto.style.background = url ? `center/cover url('${url}')` : 'linear-gradient(135deg,#1c3a5e,#0a1730)';
  fogDotEls.forEach((d,i)=>d.classList.toggle('active', i===fogIdx));
  fogInstruction.style.opacity = '1'; fogInstruction.textContent = "Drag your finger to wipe the fog away...";
  beautifulLabel.classList.remove('show');
  nextMemoryBtn.classList.remove('show');
  fogDone = false; fogPathLen = 0;
  resizeFogCanvas();
}
fogCanvas.addEventListener('pointerdown', e=>{
  if(fogDone) return;
  fogDrawing = true; const [x,y] = fogPos(e); fogLastX=x; fogLastY=y; fogErase(x,y);
  try{ fogCanvas.setPointerCapture(e.pointerId); }catch(err){}
});
fogCanvas.addEventListener('pointermove', e=>{
  if(!fogDrawing || fogDone) return;
  const [x,y] = fogPos(e);
  fogPathLen += Math.hypot(x-fogLastX, y-fogLastY);
  fogErase(x,y); fogLastX=x; fogLastY=y;
  if(fogPathLen > 600) revealFogFully();
});
fogCanvas.addEventListener('pointerup', ()=>{ fogDrawing=false; });
fogCanvas.addEventListener('pointercancel', ()=>{ fogDrawing=false; });
loadFogPhoto();
nextMemoryBtn.addEventListener('click', ()=>{
  if(fogIdx < fogPhotos.length-1){ fogIdx++; loadFogPhoto(); }
  else { showScreen(3); }
});

// ---- Screen 3: Space Between Us ----
document.getElementById('readLettersBtn').addEventListener('click', ()=>showScreen(4));

// ---- Screen 4: Longing Letters (3 tap cards) ----
const lettersWrap = document.getElementById('lettersWrap');
const readMsgBtn = document.getElementById('readMsgBtn');
const letterDefs = [
  {icon:'💌', title:'Thinking of You', msg: NOTES[0] || 'Every quiet moment, you cross my mind.'},
  {icon:'🌙', title:'The Moon Looks Different', msg: NOTES[1] || 'I wonder if you see the same moon tonight.'},
  {icon:'☕', title:'Our Coffee Mornings', msg: NOTES[2] || 'I still make two cups out of habit.'}
];
let lettersOpened = 0;
letterDefs.forEach((def,i)=>{
  const card = document.createElement('div');
  card.className = 'letter-card';
  card.innerHTML = `<div class="letter-card-inner">
    <div class="lc-face lc-front"><span class="lc-icon">${def.icon}</span><span class="lc-title">${def.title}</span></div>
    <div class="lc-face lc-back"><span class="lc-msg">${def.msg}</span></div>
  </div>`;
  card.addEventListener('click', ()=>{
    if(card.classList.contains('open')) return;
    card.classList.add('open');
    lettersOpened++;
    if(lettersOpened === letterDefs.length) readMsgBtn.classList.add('show');
  });
  lettersWrap.appendChild(card);
});
readMsgBtn.addEventListener('click', ()=>showScreen(5));

// ---- Screen 5: Handwritten letter (typewriter with pen) ----
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
const notebook = document.getElementById('notebook');
const nbBody = document.getElementById('nbBody');
const continueBtn5 = document.getElementById('continueBtn5');
const letterText = MSG || `I know we're apart right now, but you're never far from my thoughts. I miss the little things most — your laugh, your voice, just having you near.`;
let letterStarted = false;
const screen5 = screens[5];
new MutationObserver(()=>{
  if(!screen5.classList.contains('hidden') && !letterStarted){
    letterStarted = true;
    setTimeout(()=>{
      notebook.classList.add('show');
      const p = document.createElement('p');
      nbBody.appendChild(p);
      typeInto(p, letterText, 22, ()=>continueBtn5.classList.add('show'));
    }, 200);
  }
}).observe(screen5, {attributes:true, attributeFilter:['class']});
continueBtn5.addEventListener('click', ()=>showScreen(6));

// ---- Screen 6: Keepsake ----
document.getElementById('replayBtn').addEventListener('click', ()=>{
  fogIdx = 0; loadFogPhoto();
  lettersOpened = 0; readMsgBtn.classList.remove('show');
  lettersWrap.querySelectorAll('.letter-card').forEach(c=>c.classList.remove('open'));
  letterStarted = false; notebook.classList.remove('show'); continueBtn5.classList.remove('show'); nbBody.innerHTML='';
  showScreen(1);
});
document.getElementById('downloadBtn').addEventListener('click', function(){ this.textContent = 'Saved ✓'; });
