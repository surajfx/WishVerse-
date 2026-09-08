const particlesEl = document.getElementById('particles');
const glyphs = ['♥','✦','❋'];
for(let i=0;i<14;i++){
  const p = document.createElement('div');
  p.className='particle'; p.textContent = glyphs[i%3];
  p.style.left = (Math.random()*100)+'%';
  p.style.animationDuration = (7+Math.random()*6)+'s';
  p.style.animationDelay = (Math.random()*6)+'s';
  p.style.fontSize = (10+Math.random()*10)+'px';
  particlesEl.appendChild(p);
}

function playHeading(el){
  const text = el.dataset.text;
  el.textContent = ''; el.classList.add('typing'); let i = 0;
  clearInterval(el._typeTimer);
  el._typeTimer = setInterval(()=>{
    i++; el.textContent = text.slice(0,i);
    if(i >= text.length){ clearInterval(el._typeTimer); el.classList.remove('typing'); }
  }, 38);
}
document.querySelectorAll('.chapter-heading').forEach(playHeading);

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
    if(i < text.length){ el._penTimer = setTimeout(tick, 26); }
    else { pen.remove(); if(cb) cb(); }
  }
  tick();
}
function typeParagraphs(container, paragraphs){
  container.innerHTML = '';
  let idx = 0;
  function next(){
    if(idx >= paragraphs.length) return;
    const p = document.createElement('p');
    container.appendChild(p);
    typeInto(p, paragraphs[idx], 26, ()=>{ idx++; next(); });
  }
  next();
}

const screens = { 1: document.getElementById('screen1'), 2: document.getElementById('screen2'), 3: document.getElementById('screen3'),
  4: document.getElementById('screen4'), 5: document.getElementById('screen5'), 6: document.getElementById('screen6'), 7: document.getElementById('screen7'),
  8: document.getElementById('screen8'), 9: document.getElementById('screen9'), 10: document.getElementById('screen10') };
function showScreen(n){
  Object.values(screens).forEach(s=>s.classList.add('hidden'));
  screens[n].classList.remove('hidden');
  screens[n].querySelectorAll('.chapter-heading').forEach(playHeading);
  fillProgress(screens[n]);
}
function fillProgress(screenEl){
  const badge = screenEl.querySelector('.progress-badge');
  if(!badge) return;
  const pct = Number(badge.dataset.pct);
  const fillSvg = badge.querySelector('.heart-fill-svg');
  fillSvg.style.transition = 'none';
  fillSvg.style.clipPath = 'inset(100% 0 0 0)';
  void fillSvg.offsetWidth;
  fillSvg.style.transition = '';
  requestAnimationFrame(()=>{ fillSvg.style.clipPath = `inset(${100-pct}% 0 0 0)`; });
}

function attachHold(btn, ringFillEl, iconEl, holdMs, onComplete, hintEl){
  let holding=false, startTime=0, raf=null;
  function setRing(pct){
    const c = 2*Math.PI*40;
    ringFillEl.style.strokeDashoffset = c - (c*pct);
    const glowSize = 3 + pct*12;
    ringFillEl.style.filter = pct>0 ? `drop-shadow(0 0 ${glowSize}px var(--glow))` : 'none';
    if(iconEl) iconEl.style.filter = pct>0 ? `drop-shadow(0 0 ${4+pct*8}px var(--glow))` : 'none';
  }
  function start(){ holding=true; startTime=performance.now(); step(); }
  function step(){
    if(!holding) return;
    const pct = Math.min((performance.now()-startTime)/holdMs,1);
    setRing(pct);
    if(pct>=1){ holding=false; cancelAnimationFrame(raf); if(hintEl) hintEl.textContent='sealed ♥'; onComplete(); return; }
    raf = requestAnimationFrame(step);
  }
  function cancel(){ holding=false; cancelAnimationFrame(raf); setRing(0); }
  btn.addEventListener('pointerdown', e=>{ e.preventDefault(); btn.setPointerCapture(e.pointerId); start(); });
  btn.addEventListener('pointerup', cancel);
  btn.addEventListener('pointercancel', cancel);
  btn.addEventListener('pointerleave', cancel);
}

attachHold(document.getElementById('holdBtn'), document.getElementById('ringCircle'), document.getElementById('heartIcon'), 1400,
  ()=>setTimeout(()=>showScreen(2), 350), document.getElementById('holdHint'));

const memories = [
  {caption:'A memory worth keeping', note:'Every little moment with you feels like this.'},
  {caption:'A moment I never want to forget', note:'I keep coming back to this one in my head.'},
  {caption:'A little piece of us', note:'Small, silly, and completely ours.'},
  {caption:'A beautiful moment', note:'You made an ordinary day feel like this.'}
];
const stack = document.getElementById('stack');
const tapHint = document.getElementById('tapHint');
const continueBtn1 = document.getElementById('continueBtn1');
let cards=[];
function buildStack(){
  stack.innerHTML=''; cards=[];
  memories.forEach((m,i)=>{
    const card = document.createElement('div');
    card.className='polaroid';
    card.style.zIndex = memories.length-i;
    const baseTransform = `translateY(${i*6}px) rotate(${(i%2?1:-1)*(i*1.5)}deg) scale(${1-i*0.03})`;
    card.dataset.base = baseTransform; card.style.transform = baseTransform;
    card.innerHTML = `<div class="card-inner"><div class="card-face card-front"><div class="photo"></div><div class="caption">${m.caption}</div></div><div class="card-face card-back"><p>${m.note}</p></div></div>`;
    stack.appendChild(card); cards.push(card);
  });
  attachFrontHandlers();
}
function attachFrontHandlers(){
  const front = cards[0];
  if(!front){ tapHint.textContent = "that's all the memories for now"; continueBtn1.classList.add('show'); return; }
  front.style.touchAction='none';
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
        front.remove(); cards.shift();
        cards.forEach((c,i)=>{ c.style.zIndex = cards.length-i; const b = `translateY(${i*6}px) rotate(${(i%2?1:-1)*(i*1.5)}deg) scale(${1-i*0.03})`; c.dataset.base = b; c.style.transform = b; });
        attachFrontHandlers();
      },450);
    } else if(!moved){ inner.classList.toggle('flipped'); front.style.transition=''; front.style.transform = front.dataset.base; }
    else { front.style.transition=''; front.style.transform = front.dataset.base; }
    dragging=false;
  }
  front.addEventListener('pointerdown', onDown);
}
buildStack();
continueBtn1.addEventListener('click', ()=>showScreen(3));

const envInner = document.getElementById('envInner');
const tapHint2 = document.getElementById('tapHint2');
const continueBtn2 = document.getElementById('continueBtn2');
const envBackText = document.getElementById('envBackText');
const envBackFull = "Dearest Sona, every little thing about you makes an ordinary day feel like a memory worth keeping. I just wanted you to know that. ♥";
let envTyped = false;
envInner.addEventListener('click', ()=>{
  envInner.classList.toggle('flipped');
  if(envInner.classList.contains('flipped')){
    tapHint2.textContent = '';
    if(!envTyped){ envTyped = true; typeInto(envBackText, envBackFull, 24, ()=>continueBtn2.classList.add('show')); }
    else { continueBtn2.classList.add('show'); }
  }
});
continueBtn2.addEventListener('click', ()=>showScreen(4));

const reasons = [
  'Because you make every ordinary day feel like a good one.',
  'Because you listen, even when I ramble about nothing.',
  'Because your laugh is my favourite sound.',
  'Because you believe in me even when I doubt myself.',
  'Because being loved by you feels like home.'
];
const envList = document.getElementById('envList');
const continueBtn3 = document.getElementById('continueBtn3');
let openedCount = 0;
reasons.forEach((r,i)=>{
  const item = document.createElement('div');
  item.className='env-item';
  item.innerHTML = `<div class="env-row"><span class="env-num">${i+1}</span><span class="env-row-text">Break this seal</span></div><div class="env-content"><p>${r}</p></div>`;
  item.querySelector('.env-row').addEventListener('click', ()=>{
    if(item.classList.contains('open')) return;
    item.classList.add('open'); item.querySelector('.env-row-text').textContent = 'Sealed with love';
    openedCount++; if(openedCount === reasons.length) continueBtn3.classList.add('show');
  });
  envList.appendChild(item);
});
continueBtn3.addEventListener('click', ()=>showScreen(5));

const letterPaper = document.getElementById('letterPaper');
const continueBtn4 = document.getElementById('continueBtn4');
const screen5 = document.getElementById('screen5');
const letterParagraphs = [
  "I don't say this enough, but you are the softest, warmest part of my everyday life.",
  "Thank you for staying, for laughing at my worst jokes, and for loving me exactly as I am.",
  "This is just the beginning of everything I still want to tell you."
];
let letterStarted = false;
new MutationObserver(()=>{
  if(!screen5.classList.contains('hidden')){
    setTimeout(()=>{
      letterPaper.classList.add('show');
      if(!letterStarted){ letterStarted = true; typeParagraphs(letterPaper, letterParagraphs); }
      setTimeout(()=>continueBtn4.classList.add('show'), letterStarted ? 200 : 3200);
    }, 200);
  } else { letterPaper.classList.remove('show'); continueBtn4.classList.remove('show'); }
}).observe(screen5, {attributes:true, attributeFilter:['class']});
continueBtn4.addEventListener('click', ()=>showScreen(6));

const promiseTexts = [ 'I promise to choose you, even on the ordinary days.', 'I promise to hold on to us through everything ahead.' ];
let promiseIndex = 0;
const promiseNum = document.getElementById('promiseNum');
const promiseText = document.getElementById('promiseText');
const promiseHint = document.getElementById('promiseHint');
const promiseGlyph = document.getElementById('promiseGlyph');
const promiseHoldWrap = document.querySelector('#screen6 .hold-wrap');
const heartRevealWrap = document.getElementById('heartRevealWrap');
const giftBox = document.getElementById('giftBox');
const boxRing = document.getElementById('boxRing');
const giftNote = document.getElementById('giftNote');
const continueBtn5 = document.getElementById('continueBtn5');
heartRevealWrap.style.display = 'none';
attachHold(document.getElementById('promiseBtn'), document.getElementById('promiseRingCircle'), null, 1400, onPromiseSealed, promiseHint);
function onPromiseSealed(){
  promiseGlyph.style.opacity='0'; promiseGlyph.style.transform='scale(1.3)';
  promiseIndex++;
  const isLast = promiseIndex >= promiseTexts.length;
  setTimeout(()=>{
    if(!isLast){
      promiseNum.textContent = `Promise ${promiseIndex+1} of ${promiseTexts.length}`;
      promiseText.textContent = promiseTexts[promiseIndex];
      promiseHint.textContent = 'press & hold to seal this promise';
      promiseGlyph.style.opacity='1'; promiseGlyph.style.transform='scale(1)';
      document.getElementById('promiseRingCircle').style.strokeDashoffset = 2*Math.PI*40;
      document.getElementById('promiseRingCircle').style.filter='none';
    } else {
      promiseHoldWrap.style.display='none';
      promiseNum.textContent = 'Two promises, sealed with your touch…';
      promiseText.textContent = '';
      heartRevealWrap.style.display='flex';
      setTimeout(()=>giftBox.classList.add('open'), 200);
      setTimeout(()=>{ enableRingDrag(boxRing); giftNote.style.opacity='1'; }, 1550);
      setTimeout(()=>continueBtn5.classList.add('show'), 2400);
    }
  }, isLast ? 500 : 500);
}
function enableRingDrag(el){
  let startX=0, rot=20;
  el.addEventListener('pointerdown', e=>{
    startX = e.clientX; el.setPointerCapture(e.pointerId); el.style.cursor='grabbing';
    el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp);
  });
  function onMove(e){
    const dx = e.clientX - startX;
    el.style.transform = `translate(-50%,-46px) scale(1) rotateY(${rot + dx*0.6}deg)`;
  }
  function onUp(e){
    rot += (e.clientX - startX)*0.6;
    el.style.cursor='grab';
    el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerup', onUp);
  }
}
continueBtn5.addEventListener('click', ()=>showScreen(7));

const track = document.getElementById('carouselTrack');
const dotsWrap = document.getElementById('carouselDots');
const cardEls = track.querySelectorAll('.carousel-card');
let activeIdx = 0;
cardEls.forEach((_,i)=>{
  const d = document.createElement('div'); d.className='dot'+(i===0?' active':'');
  dotsWrap.appendChild(d);
});
const dotEls = dotsWrap.querySelectorAll('.dot');
const cardStep = 256;
function goTo(i){
  activeIdx = Math.max(0, Math.min(cardEls.length-1, i));
  track.style.transition='transform .4s ease';
  track.style.transform = `translateX(${-activeIdx*cardStep}px)`;
  dotEls.forEach((d,idx)=>d.classList.toggle('active', idx===activeIdx));
}
let cStartX=0, cDx=0, cDragging=false;
track.addEventListener('pointerdown', e=>{ cStartX=e.clientX; cDx=0; cDragging=true; track.style.transition='none'; track.setPointerCapture(e.pointerId); });
track.addEventListener('pointermove', e=>{ if(!cDragging) return; cDx = e.clientX-cStartX; track.style.transform = `translateX(${-activeIdx*cardStep+cDx}px)`; });
track.addEventListener('pointerup', ()=>{ cDragging=false; if(cDx < -50) goTo(activeIdx+1); else if(cDx > 50) goTo(activeIdx-1); else goTo(activeIdx); });
track.addEventListener('pointercancel', ()=>{ cDragging=false; goTo(activeIdx); });
document.getElementById('continueBtn6').addEventListener('click', ()=>showScreen(8));
document.getElementById('continueBtn7').addEventListener('click', ()=>showScreen(9));
document.getElementById('continueBtn8').addEventListener('click', ()=>showScreen(10));
document.getElementById('replayBtn').addEventListener('click', ()=>showScreen(1));
document.getElementById('downloadBtn').addEventListener('click', function(){ this.textContent = 'Saved ✓'; });
fillProgress(screens[1]);
                                            
