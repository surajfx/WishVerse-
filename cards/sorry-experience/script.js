// ---- Dynamic data from the WishVerse form ----
const _params = new URLSearchParams(location.search);
const TO = _params.get('to') || 'You';
const FROM = _params.get('from') || 'Someone';
const MSG = _params.get('msg') || '';
const PHOTOS = (_params.get('photos') || '').split(',').map(s=>s.trim()).filter(Boolean);
const NOTES = (_params.get('notes') || '').split('|').map(s=>s.trim()).filter(Boolean);
const BOXLETTER = _params.get('boxletter') || '';
const COLLAGE = (_params.get('collage') || '').split(',').map(s=>s.trim()).filter(Boolean);

document.title = `A Sincere Apology for ${TO}`;
const _set = (id, t) => { const el = document.getElementById(id); if(el) el.textContent = t; };
try{
  _set('saySub', BOXLETTER || `Hey ${TO}, a heartfelt message from ${FROM} awaits you.`);
  _set('greeting', `Dear ${TO},`);
  _set('letterSig', `— ${FROM}`);
  _set('thanksLine', `Thank you, ${TO}.`);
  _set('keepTo', `To ${TO}`);
  _set('keepSig', `with love, ${FROM}`);
  if(MSG) _set('keepMsg', MSG);
  const miniSrc = [PHOTOS[0], PHOTOS[1]];
  ['miniA','miniB'].forEach((id,i)=>{ const el=document.getElementById(id); if(el && miniSrc[i]) el.style.backgroundImage=`url('${miniSrc[i]}')`; });
  const cs = COLLAGE.length ? COLLAGE : PHOTOS;
  document.querySelectorAll('.collage .ph').forEach((el,i)=>{ if(cs[i]) el.style.background=`center/cover url('${cs[i]}')`; });
}catch(e){ console.error(e); }

// rain
try{
  const rain = document.getElementById('rain');
  for(let i=0;i<26;i++){
    const d = document.createElement('div'); d.className='drop';
    d.style.left = (Math.random()*110-5)+'%';
    d.style.animationDuration = (1.1+Math.random()*1.2)+'s';
    d.style.animationDelay = (Math.random()*2)+'s';
    rain.appendChild(d);
  }
}catch(e){ console.error(e); }

// screens
const screens = {};
for(let i=1;i<=9;i++) screens[i] = document.getElementById('screen'+i);
function showScreen(n){
  Object.values(screens).forEach(s=>s.classList.add('hidden'));
  screens[n].classList.remove('hidden');
}

// 1 loading
(function(){
  const el = document.getElementById('loadPct'); let p = 0;
  const t = setInterval(()=>{ p += 6+Math.random()*10; if(p>=100){ p=100; clearInterval(t); } el.textContent = Math.floor(p)+'%'; }, 100);
})();
setTimeout(()=>showScreen(2), 1600);

// 2
document.getElementById('openLetterBtn').addEventListener('click', ()=>showScreen(3));

// 3 envelope
const envelopeWrap = document.getElementById('envelopeWrap');
let envOpened = false;
envelopeWrap.addEventListener('click', ()=>{
  if(envOpened) return; envOpened = true;
  envelopeWrap.classList.add('open');
  setTimeout(()=>showScreen(4), 900);
});

// 4 letter (typed)
function typeInto(el, text, speed, cb){
  let i = 0;
  const pen = document.createElement('span'); pen.className='pen'; pen.textContent='🖊️';
  el.textContent = '';
  (function tick(){
    i++; el.textContent = text.slice(0,i); el.appendChild(pen);
    if(i < text.length) setTimeout(tick, speed); else { pen.remove(); if(cb) cb(); }
  })();
}
const paper = document.getElementById('paper');
const letterBody = document.getElementById('letterBody');
const continueLetterBtn = document.getElementById('continueLetterBtn');
const letterText = MSG || `I'm truly sorry for hurting you. I never meant to, but I know my words and actions mattered. I'd like the chance to make it right.`;
let letterStarted = false;
new MutationObserver(()=>{
  if(!screens[4].classList.contains('hidden') && !letterStarted){
    letterStarted = true;
    setTimeout(()=>{
      paper.classList.add('show');
      const p = document.createElement('p'); letterBody.appendChild(p);
      typeInto(p, letterText, 22, ()=>continueLetterBtn.classList.add('show'));
    }, 200);
  }
}).observe(screens[4], {attributes:true, attributeFilter:['class']});
continueLetterBtn.addEventListener('click', ()=>showScreen(5));

// 5 heal the heart
const particlePos = [[92,70],[72,66],[130,66],[96,112],[64,98],[138,100]];
const healHeart = document.getElementById('healHeart');
const healFill = document.getElementById('healFill');
const healCount = document.getElementById('healCount');
const restoredMsg = document.getElementById('restoredMsg');
let healed = 0;
function buildParticles(){
  healHeart.querySelectorAll('.particle').forEach(p=>p.remove());
  particlePos.forEach((pos,i)=>{
    const p = document.createElement('div'); p.className='particle';
    p.style.left = (pos[0]+10-11)+'px'; p.style.top = (pos[1]+10-11)+'px';
    p.style.animationDelay = (i*0.2)+'s';
    p.addEventListener('click', ()=>{
      if(p.classList.contains('gone')) return;
      p.classList.add('gone');
      document.getElementById('crack'+(i+1)).classList.add('healed');
      healed++;
      healFill.style.width = (healed/6*100)+'%';
      healCount.textContent = `${healed} / 6 cracks healed`;
      if(healed === 6){
        healHeart.classList.add('done'); restoredMsg.classList.add('show');
        setTimeout(()=>showScreen(6), 2200);
      }
    });
    healHeart.appendChild(p);
  });
}
buildParticles();

// 6 memory lane
const memPhotos = [PHOTOS[0], PHOTOS[1], PHOTOS[2]];
const memCaps = [NOTES[0] || 'Memory 1', NOTES[1] || 'Memory 2', NOTES[2] || 'Memory 3'];
const pola = document.getElementById('pola');
const memPhoto = document.getElementById('memPhoto');
const memCap = document.getElementById('memCap');
const memDots = document.getElementById('memDots');
const memCounter = document.getElementById('memCounter');
const gardenBtn = document.getElementById('gardenBtn');
let memIdx = 0;
[0,1,2].forEach(i=>{ const d=document.createElement('div'); d.className='dot'+(i===0?' active':''); memDots.appendChild(d); });
function renderMem(){
  const url = memPhotos[memIdx];
  memPhoto.style.backgroundImage = url ? `url('${url}')` : '';
  pola.classList.remove('revealed');
  pola.style.transform = `rotate(${memIdx%2 ? 3 : -3}deg)`;
  memCap.textContent = memCaps[memIdx];
  memDots.querySelectorAll('.dot').forEach((d,i)=>d.classList.toggle('active', i===memIdx));
  memCounter.textContent = `${memIdx+1} / 3`;
  if(memIdx === 2) gardenBtn.classList.add('show');
}
memPhoto.addEventListener('click', ()=>pola.classList.add('revealed'));
document.getElementById('prevBtn').addEventListener('click', ()=>{ memIdx = (memIdx+2)%3; renderMem(); });
document.getElementById('nextBtn').addEventListener('click', ()=>{ memIdx = (memIdx+1)%3; renderMem(); });
renderMem();
gardenBtn.addEventListener('click', ()=>showScreen(7));

// 7 forgive (explicit choice only)
document.getElementById('forgiveBtn').addEventListener('click', ()=>{
  showScreen(8);
  setTimeout(()=>document.getElementById('toKeepsakeBtn').classList.add('show'), 2200);
});

// 8
document.getElementById('toKeepsakeBtn').addEventListener('click', ()=>showScreen(9));

// 9 keepsake
document.getElementById('downloadBtn').addEventListener('click', function(){ this.textContent = 'Saved ✓'; });
document.getElementById('replayBtn').addEventListener('click', ()=>{
  envOpened = false; envelopeWrap.classList.remove('open');
  letterStarted = false; paper.classList.remove('show'); continueLetterBtn.classList.remove('show'); letterBody.innerHTML='';
  healed = 0; healFill.style.width='0'; healCount.textContent='0 / 6 cracks healed';
  healHeart.classList.remove('done'); restoredMsg.classList.remove('show');
  document.querySelectorAll('.crack').forEach(c=>c.classList.remove('healed')); buildParticles();
  memIdx = 0; gardenBtn.classList.remove('show'); renderMem();
  document.getElementById('toKeepsakeBtn').classList.remove('show');
  showScreen(2);
});
