// ---- Dynamic data from the real WishVerse form ----
const _params = new URLSearchParams(location.search);
const TO = _params.get('to') || 'Friend';
const FROM = _params.get('from') || 'Someone';
const MSG = _params.get('msg') || '';
const PHOTOS = (_params.get('photos') || '').split(',').map(s=>s.trim()).filter(Boolean);
const NOTES = (_params.get('notes') || '').split('|').map(s=>s.trim()).filter(Boolean);
const BOXLETTER = _params.get('boxletter') || '';
const COLLAGE = (_params.get('collage') || '').split(',').map(s=>s.trim()).filter(Boolean);

document.title = `Happy Birthday, ${TO}!`;
const _set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
try{
  _set('welcomeName', TO);
  _set('memCounter', 'Memory 1 of 5');
  _set('letterSig', `— ${FROM}`);
  _set('capsuleThanks', `"A capsule of our beautiful times together. ${BOXLETTER || 'Thank you for being in my life.'}"`);
  _set('capsuleFrom', FROM);
  const capsulePhotoEl = document.getElementById('capsulePhoto');
  const capsuleSrc = (COLLAGE[0] || PHOTOS[0]);
  if (capsulePhotoEl && capsuleSrc) capsulePhotoEl.style.backgroundImage = `url('${capsuleSrc}')`;
  _set('finaleSub', `To ${TO}`);
  _set('keepsakeTo', `To ${TO}`);
  _set('finalSigScript', `with love, ${FROM}`);
  if (MSG) _set('finalMsg', MSG);
  const _collagePhotos = document.querySelectorAll('.collage .ph');
  const _collageSrc = COLLAGE.length ? COLLAGE : PHOTOS;
  _collagePhotos.forEach((el,i)=>{ if(_collageSrc[i]) el.style.background = `center/cover url('${_collageSrc[i]}')`; });
}catch(e){ console.error('dynamic text setup failed', e); }

try{
  const starsEl = document.getElementById('stars');
  for(let i=0;i<20;i++){
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
for(let i=1;i<=10;i++) screens[i] = document.getElementById('screen'+i);
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

// ---- Screen 1: Loading (auto-advance with percent) ----
(function(){
  const loadPct = document.getElementById('loadPct');
  let p = 0;
  const timer = setInterval(()=>{
    p += 6 + Math.random()*10;
    if(p >= 100){ p = 100; clearInterval(timer); }
    if(loadPct) loadPct.textContent = Math.floor(p)+'%';
  }, 100);
})();
setTimeout(()=>showScreen(2), 1500);

// ---- Screen 2: Envelope (tap to open the flap, then advance) ----
const envelopeWrap = document.getElementById('envelopeWrap');
let envelopeOpened = false;
function openEnvelope(){
  if(envelopeOpened) return;
  envelopeOpened = true;
  envelopeWrap.classList.add('open');
  setTimeout(()=>showScreen(3), 900);
}
envelopeWrap.addEventListener('click', openEnvelope);
document.getElementById('openSurpriseBtn').addEventListener('click', openEnvelope);

// ---- Screen 3: Welcome ----
document.getElementById('viewMemoriesBtn').addEventListener('click', ()=>showScreen(4));

// ---- Screen 4: Memory journey (polaroid stack, 5 memories) ----
const stack = document.getElementById('stack');
const memCounter = document.getElementById('memCounter');
const nextMemoryBtn = document.getElementById('nextMemoryBtn');
const memCaptions = ['First Photo Together ❤️','The Day We Met ✨','Our Craziest Moment 😂',"A Memory I'll Never Forget 🌸",'A Beautiful Chapter 💕'];
const memNotes = [NOTES[0],NOTES[1],NOTES[2],NOTES[3]].map((n,i)=> n || memCaptions[i]);
const memPhotos = [PHOTOS[0],PHOTOS[1],PHOTOS[2],PHOTOS[3],PHOTOS[0]];
let memCards = [];
function buildMemStack(){
  stack.innerHTML=''; memCards = [];
  memCaptions.forEach((cap,i)=>{
    const card = document.createElement('div');
    card.className='polaroid';
    card.style.zIndex = memCaptions.length-i;
    const baseTransform = `translateY(${i*6}px) rotate(${(i%2?1:-1)*(i*1.5)}deg) scale(${1-i*0.03})`;
    card.dataset.base = baseTransform; card.style.transform = baseTransform;
    const url = memPhotos[i];
    const photoStyle = url ? ` style="background-image:url('${url}');background-size:cover;background-position:center;"` : '';
    card.innerHTML = `<div class="card-inner"><div class="card-face card-front"><div class="photo"${photoStyle}></div><div class="caption">${cap}</div></div><div class="card-face card-back"><p>${memNotes[i] || cap}</p></div></div>`;
    stack.appendChild(card); memCards.push(card);
  });
  memCounter.textContent = `Memory 1 of ${memCaptions.length}`;
  attachMemHandlers();
}
function attachMemHandlers(){
  const front = memCards[0];
  if(!front){ nextMemoryBtn.textContent = '🎂 Make a Wish!'; nextMemoryBtn.onclick = ()=>showScreen(5); return; }
  const inner = front.querySelector('.card-inner');
  let startX=0, startY=0, dx=0, dy=0, dragging=false, moved=false;
  function onDown(e){
    startX = e.clientX; startY = e.clientY; dx=0; dy=0; moved=false; dragging=false;
    front.style.transition='none'; front.setPointerCapture(e.pointerId);
    front.addEventListener('pointermove', onMove); front.addEventListener('pointerup', onUp); front.addEventListener('pointercancel', onUp);
  }
  function onMove(e){
    dx = e.clientX - startX; dy = e.clientY - startY;
    if(Math.abs(dx)>8 || Math.abs(dy)>8){ moved=true; dragging=true; front.classList.add('dragging'); }
    if(dragging){ front.style.transform = `${front.dataset.base} translate(${dx}px, ${dy}px) rotate(${dx/18}deg)`; }
  }
  function onUp(){
    front.removeEventListener('pointermove', onMove); front.removeEventListener('pointerup', onUp); front.removeEventListener('pointercancel', onUp);
    front.classList.remove('dragging');
    const dist = Math.hypot(dx,dy);
    if(dragging && dist > 90){
      const angle = Math.atan2(dy,dx);
      front.classList.add('flying');
      front.style.transform = `${front.dataset.base} translate(${Math.cos(angle)*700}px, ${Math.sin(angle)*700}px) rotate(${dx/10}deg)`;
      front.style.opacity='0';
      setTimeout(()=>{
        front.remove(); memCards.shift();
        memCards.forEach((c,i)=>{ c.style.zIndex = memCards.length-i; const b = `translateY(${i*6}px) rotate(${(i%2?1:-1)*(i*1.5)}deg) scale(${1-i*0.03})`; c.dataset.base = b; c.style.transform = b; });
        memCounter.textContent = `Memory ${memCaptions.length-memCards.length+1} of ${memCaptions.length}`;
        attachMemHandlers();
      },450);
    } else if(!moved){ inner.classList.toggle('flipped'); front.style.transition=''; front.style.transform = front.dataset.base; }
    else { front.style.transition=''; front.style.transform = front.dataset.base; }
    dragging=false;
  }
  front.addEventListener('pointerdown', onDown);
}
buildMemStack();
nextMemoryBtn.addEventListener('click', ()=>{
  const front = memCards[0];
  if(!front) return;
  front.classList.add('flying');
  front.style.transform = `${front.dataset.base} translate(700px, -80px) rotate(30deg)`;
  front.style.opacity = '0';
  setTimeout(()=>{
    front.remove(); memCards.shift();
    memCards.forEach((c,i)=>{ c.style.zIndex = memCards.length-i; const b = `translateY(${i*6}px) rotate(${(i%2?1:-1)*(i*1.5)}deg) scale(${1-i*0.03})`; c.dataset.base = b; c.style.transform = b; });
    memCounter.textContent = memCards.length ? `Memory ${memCaptions.length-memCards.length+1} of ${memCaptions.length}` : `Memory ${memCaptions.length} of ${memCaptions.length}`;
    attachMemHandlers();
  }, 450);
});

// ---- Floating memory photo bubbles (reused behind candles + cake-cut scenes) ----
function spawnFloatPhotos(containerId){
  const wrap = document.getElementById(containerId);
  if(!wrap) return;
  wrap.innerHTML = '';
  const pics = PHOTOS.length ? PHOTOS : [null,null,null];
  pics.slice(0,4).forEach((url,i)=>{
    const b = document.createElement('div');
    b.className = 'float-photo';
    if(url) b.style.backgroundImage = `url('${url}')`;
    else b.style.background = 'linear-gradient(135deg,var(--pink),var(--purple-acc))';
    const positions = [{left:'-6%',top:'4%'},{right:'-8%',top:'10%'},{left:'-4%',bottom:'6%'},{right:'-6%',bottom:'0%'}];
    Object.assign(b.style, positions[i % positions.length]);
    b.style.animationDuration = (4+Math.random()*2)+'s';
    b.style.animationDelay = (Math.random()*2)+'s';
    wrap.appendChild(b);
  });
}
spawnFloatPhotos('floatPhotosCandles');
spawnFloatPhotos('floatPhotosCut');

// ---- Screen 5: Candles ----
const candlesWrap = document.getElementById('candlesWrap');
const blowAllBtn = document.getElementById('blowAllBtn');
const blowCheek = document.getElementById('blowCheek');
function puffCheek(){
  if(!blowCheek) return;
  blowCheek.classList.remove('puff'); void blowCheek.offsetWidth; blowCheek.classList.add('puff');
}
const candleColors = ['#20D9FF','#F02C86','#9147FF','#FFC928','#16E879'];
let candlesLeft = 5;
candleColors.forEach((c,i)=>{
  const cd = document.createElement('div');
  cd.className='candle';
  cd.style.background = c;
  cd.innerHTML = `<span class="flame">🔥</span>`;
  cd.addEventListener('click', ()=>blowCandle(cd));
  candlesWrap.appendChild(cd);
});
function blowCandle(cd){
  if(cd.classList.contains('blown')) return;
  cd.classList.add('blown'); candlesLeft--;
  if(candlesLeft<=0) setTimeout(()=>showScreen(6), 500);
}
blowAllBtn.addEventListener('click', ()=>{
  puffCheek();
  setTimeout(()=>{
    candlesWrap.querySelectorAll('.candle').forEach(cd=>cd.classList.add('blown'));
    candlesLeft = 0;
    setTimeout(()=>showScreen(6), 500);
  }, 250);
});
// ---- Screen 6: Cut the cake (drag knife) ----
const knife = document.getElementById('knife');
const cutLine = document.getElementById('cutLine');
const cakeSceneCut = document.getElementById('cakeSceneCut');
const fallbackCutBtn = document.getElementById('fallbackCutBtn');
const cakeSlice = document.getElementById('cakeSlice');
let cutDone = false;
function doCut(){
  if(cutDone) return;
  cutDone = true;
  cutLine.classList.add('show');
  knife.style.transition = 'top .5s ease';
  knife.style.top = '150px';
  cakeSceneCut.classList.add('cut-apart');
  setTimeout(()=>{
    cakeSlice.classList.add('pop');
    setTimeout(()=>{
      cakeSlice.classList.remove('pop');
      cakeSlice.classList.add('eaten');
      setTimeout(()=>showScreen(7), 650);
    }, 750);
  }, 350);
}
knife.addEventListener('pointerdown', e=>{
  if(cutDone) return;
  knife.setPointerCapture(e.pointerId);
  knife.style.transition = 'none';
  const sceneRect = cakeSceneCut.getBoundingClientRect();
  function onMove(ev){
    let top = ev.clientY - sceneRect.top - 35;
    top = Math.max(0, Math.min(150, top));
    knife.style.top = top + 'px';
    if(top > 100) doCut();
  }
  function onUp(){ knife.removeEventListener('pointermove', onMove); knife.removeEventListener('pointerup', onUp); }
  knife.addEventListener('pointermove', onMove);
  knife.addEventListener('pointerup', onUp);
});
fallbackCutBtn.addEventListener('click', doCut);

// ---- Screen 7: Grand finale prep (confetti, auto-advance) ----
const fxLayer = document.getElementById('fxLayer');
function burstConfetti(count){
  const colors = ['#FF2D78','#FFC400','#F5F5F5','#8847FF','#00BFFF'];
  for(let i=0;i<count;i++){
    const c = document.createElement('div');
    c.className='confetto';
    c.style.left = (Math.random()*100)+'%';
    c.style.width = (6+Math.random()*4)+'px';
    c.style.height = (10+Math.random()*6)+'px';
    c.style.background = colors[i%colors.length];
    c.style.borderRadius = Math.random()>0.5 ? '50%' : '2px';
    c.style.animationDuration = (3+Math.random()*2.5)+'s';
    c.style.animationDelay = (Math.random()*0.6)+'s';
    fxLayer.appendChild(c);
    setTimeout(()=>c.remove(), 6500);
  }
}
function spawnBalloons(){
  const stage = document.getElementById('balloonStage');
  if(!stage) return;
  stage.innerHTML = '';
  const colors = ['#FF2D78','#FFC400','#8847FF','#00BFFF','#16E879','#FFA51A','#F02C86'];
  const count = 7;
  for(let i=0;i<count;i++){
    const b = document.createElement('div');
    b.className = 'balloon';
    b.style.background = `radial-gradient(circle at 35% 30%, ${colors[i%colors.length]}, ${colors[i%colors.length]}cc)`;
    b.style.left = (8 + i*(84/count) + Math.random()*4) + '%';
    b.style.setProperty('--drift', (Math.random()*30-15)+'px');
    const dur = 2.2 + Math.random()*1.2;
    b.style.animationDuration = dur+'s';
    b.style.animationDelay = (i*0.18)+'s';
    stage.appendChild(b);
    const popDelay = (i*0.18 + dur) * 1000;
    setTimeout(()=>{
      const rect = b.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const px = rect.left - stageRect.left + rect.width/2;
      const py = rect.top - stageRect.top + rect.height/2;
      b.remove();
      for(let g=0; g<10; g++){
        const sp = document.createElement('div');
        sp.className = 'glitter';
        const size = 3+Math.random()*4;
        sp.style.width = size+'px'; sp.style.height = size+'px';
        sp.style.left = px+'px'; sp.style.top = py+'px';
        sp.style.background = colors[(i+g)%colors.length];
        const angle = (Math.PI*2*g)/10;
        const dist = 20+Math.random()*30;
        sp.style.setProperty('--gx', Math.cos(angle)*dist+'px');
        sp.style.setProperty('--gy', Math.sin(angle)*dist+'px');
        stage.appendChild(sp);
        setTimeout(()=>sp.remove(), 1000);
      }
    }, popDelay);
  }
}
let prepStarted = false;
new MutationObserver(()=>{
  if(!screens[7].classList.contains('hidden') && !prepStarted){
    prepStarted = true;
    spawnBalloons();
    setTimeout(()=>showScreen(8), 3600);
  }
}).observe(screens[7], {attributes:true, attributeFilter:['class']});

// ---- Screen 8: Personal message (typewriter with pen) ----
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
const letterCard = document.getElementById('letterCard');
const letterBody = document.getElementById('letterBody');
const continueBtn8 = document.getElementById('continueBtn8');
const birthdayMsg = MSG || `Wishing you the happiest of birthdays! May this year bring you everything you've been hoping for and more.`;
let letterStarted = false;
new MutationObserver(()=>{
  if(!screens[8].classList.contains('hidden') && !letterStarted){
    letterStarted = true;
    setTimeout(()=>{
      letterCard.classList.add('show');
      const p = document.createElement('p'); p.className='body-text';
      letterBody.appendChild(p);
      typeInto(p, birthdayMsg, 22, ()=>continueBtn8.classList.add('show'));
    }, 200);
  }
}).observe(screens[8], {attributes:true, attributeFilter:['class']});
continueBtn8.addEventListener('click', ()=>showScreen(9));

// ---- Screen 9: Memory capsule ----
document.getElementById('revealFinaleBtn').addEventListener('click', ()=>showScreen(10));

// ---- Screen 10: Fireworks finale ----
function launchFirework(){
  const colors = ['#16E879','#FFC928','#20D9FF','#FF2C7D','#9147FF'];
  const x = 15 + Math.random()*70, y = 15 + Math.random()*55;
  for(let i=0;i<14;i++){
    const p = document.createElement('div');
    p.className='firework';
    const size = 4+Math.random()*4;
    p.style.width = size+'px'; p.style.height = size+'px';
    p.style.left = x+'%'; p.style.top = y+'%';
    p.style.background = colors[Math.floor(Math.random()*colors.length)];
    const angle = (Math.PI*2*i)/14;
    const dist = 40+Math.random()*40;
    p.style.setProperty('--tx', Math.cos(angle)*dist+'px');
    p.style.transform = `translate(${Math.cos(angle)*dist}px, ${Math.sin(angle)*dist}px)`;
    fxLayer.appendChild(p);
    setTimeout(()=>p.remove(), 1300);
  }
}
let fireworksTimer = null;
let finaleStarted = false;
const keepsakeCard = document.getElementById('keepsakeCard');
new MutationObserver(()=>{
  if(!screens[10].classList.contains('hidden') && !finaleStarted){
    finaleStarted = true;
    launchFirework();
    fireworksTimer = setInterval(launchFirework, 650);
    setTimeout(()=>keepsakeCard.classList.add('show'), 1200);
  } else if(screens[10].classList.contains('hidden') && fireworksTimer){
    clearInterval(fireworksTimer); fireworksTimer = null;
  }
}).observe(screens[10], {attributes:true, attributeFilter:['class']});

// ---- Replay ----
document.getElementById('replayBtn').addEventListener('click', ()=>{
  candlesWrap.innerHTML=''; candleColors.forEach((c)=>{ const cd=document.createElement('div'); cd.className='candle'; cd.style.background=c; cd.innerHTML=`<span class="flame">🔥</span>`; cd.addEventListener('click',()=>blowCandle(cd)); candlesWrap.appendChild(cd); });
  candlesLeft = 5;
  cutDone = false; cutLine.classList.remove('show'); knife.style.transition=''; knife.style.top='0px';
  cakeSceneCut.classList.remove('cut-apart'); cakeSlice.classList.remove('pop','eaten');
  prepStarted = false;
  letterStarted = false; letterCard.classList.remove('show'); continueBtn8.classList.remove('show'); letterBody.innerHTML='';
  finaleStarted = false; keepsakeCard.classList.remove('show');
  envelopeOpened = false; envelopeWrap.classList.remove('open');
  buildMemStack();
  showScreen(1);
  setTimeout(()=>showScreen(2), 1500);
});
document.getElementById('downloadBtn').addEventListener('click', function(){ this.textContent = 'Saved ✓'; });

fillProgress(screens[2]);
