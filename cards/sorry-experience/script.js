/**
 * WISHVERSE — SORRY EXPERIENCE (13-SCREEN INTERACTIVE ENGINE)
 * Ready for cards/sorry-experience/script.js
 */

(function () {
  'use strict';

  // --- 1. DEFAULT & DYNAMIC DATA CONFIGURATION ---
  const params = new URLSearchParams(window.location.search);
  const storedData = window.WISH_DATA || {};

  function createSvgFallbackPhoto(title, bgStart, bgEnd, accent) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${bgStart}"/>
          <stop offset="100%" stop-color="${bgEnd}"/>
        </linearGradient>
      </defs>
      <rect width="500" height="500" fill="url(#g)"/>
      <circle cx="250" cy="210" r="95" fill="${accent}" opacity="0.28"/>
      <path d="M250,275 C250,275 180,225 180,180 C180,155 200,138 222,138 C236,138 245,146 250,156 C255,146 264,138 278,138 C300,138 320,155 320,180 C320,225 250,275 250,275 Z" fill="${accent}" opacity="0.85"/>
      <text x="250" y="380" text-anchor="middle" fill="#FAF7F0" font-family="Georgia, serif" font-style="italic" font-size="28">${title}</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  const state = {
    recipient:
      params.get('to') ||
      params.get('recipient') ||
      params.get('receiver') ||
      params.get('name') ||
      storedData.recipient ||
      storedData.to ||
      'Shrishti',
    sender:
      params.get('from') ||
      params.get('sender') ||
      params.get('by') ||
      storedData.sender ||
      storedData.from ||
      'Arpit',
    customMessage:
      params.get('msg') ||
      params.get('message') ||
      params.get('note') ||
      storedData.message ||
      '',
    photos: [
      params.get('img1') || params.get('photo1') || (storedData.photos && storedData.photos[0]) || createSvgFallbackPhoto('Our Quiet Walks', '#351C42', '#7A2E63', '#FF8B94'),
      params.get('img2') || params.get('photo2') || (storedData.photos && storedData.photos[1]) || createSvgFallbackPhoto('Shared Laughter', '#1F3044', '#4B6B88', '#F7B74B'),
      params.get('img3') || params.get('photo3') || (storedData.photos && storedData.photos[2]) || createSvgFallbackPhoto('Golden Evenings', '#4A2618', '#964B2E', '#FF7A65')
    ],
    captions: [
      params.get('cap1') || 'Memory 1',
      params.get('cap2') || 'Memory 2',
      params.get('cap3') || 'Memory 3'
    ],
    healedCount: 0,
    totalCracks: 6,
    currentMemory: 0,
    revealedMemories: [false, false, false],
    musicPlaying: false,
    audioCtx: null,
    ambientInterval: null
  };

  // --- 2. POPULATE DYNAMIC TEXT & IMAGES ---
  function hydratePersonalization() {
    document.querySelectorAll('.dyn-recipient').forEach(el => {
      el.textContent = state.recipient;
    });
    document.querySelectorAll('.dyn-sender').forEach(el => {
      el.textContent = state.sender;
    });

    if (state.customMessage.trim()) {
      const letterBody = document.getElementById('letterBodyText');
      letterBody.innerHTML = '';
      state.customMessage.split('\n').filter(Boolean).forEach(para => {
        const p = document.createElement('p');
        p.className = 'letter-line';
        p.textContent = para;
        letterBody.appendChild(p);
      });
      document.getElementById('keepsakeBodyText').textContent = `"${state.customMessage.trim()}"`;
    }

    document.querySelectorAll('.dyn-photo-1').forEach(img => { img.src = state.photos[0]; });
    document.querySelectorAll('.dyn-photo-2').forEach(img => { img.src = state.photos[1]; });
    document.querySelectorAll('.dyn-photo-3').forEach(img => { img.src = state.photos[2]; });
  }

  // --- 3. SCREEN NAVIGATION CONTROLLER ---
  function showSection(sectionId, dataScreenNum) {
    document.querySelectorAll('.screen').forEach(sec => {
      sec.classList.remove('active');
    });
    const target = document.getElementById(sectionId);
    if (target) {
      target.classList.add('active');
    }
    document.body.setAttribute('data-screen', String(dataScreenNum));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- 4. SCREEN 01: AUTOMATIC LOADING RING ---
  function runLoadingSequence() {
    const ring = document.getElementById('loadingRing');
    const percentEl = document.getElementById('loadingPercent');
    const circumference = 2 * Math.PI * 50;
    let progress = 0;

    const timer = setInterval(() => {
      progress += 2;
      if (progress > 100) progress = 100;

      const offset = circumference - (progress / 100) * circumference;
      ring.style.strokeDashoffset = String(offset);
      percentEl.textContent = `${progress}%`;

      if (progress >= 100) {
        clearInterval(timer);
        setTimeout(() => {
          document.getElementById('musicToggle').classList.remove('hidden');
          showSection('screen-2', 2);
        }, 450);
      }
    }, 45);
  }

  // --- 5. DIAGONAL RAIN CANVAS (SCREENS 2, 6, 7) ---
  function initRainCanvas() {
    const canvas = document.getElementById('rainCanvas');
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const drops = Array.from({ length: 75 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      len: 14 + Math.random() * 18,
      speed: 2.2 + Math.random() * 2.5,
      drift: -0.6
    }));

    function drawRain() {
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = '#263246';
      ctx.lineWidth = 1.25;
      ctx.lineCap = 'round';

      for (const d of drops) {
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + d.drift * 5, d.y + d.len);
        ctx.stroke();

        d.y += d.speed;
        d.x += d.drift;

        if (d.y > height) {
          d.y = -20;
          d.x = Math.random() * width;
        }
        if (d.x < 0) {
          d.x = width;
        }
      }
      requestAnimationFrame(drawRain);
    }
    drawRain();
  }

  // --- 6. WEB AUDIO SYNTHESIZER FOR AMBIENT MUSIC ---
  function playSoftChime(freq = 528, duration = 0.9) {
    if (!state.musicPlaying) return;
    try {
      if (!state.audioCtx) {
        state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      const osc = state.audioCtx.createOscillator();
      const gain = state.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, state.audioCtx.currentTime);

      gain.gain.setValueAtTime(0.001, state.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, state.audioCtx.currentTime + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, state.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(state.audioCtx.destination);
      osc.start();
      osc.stop(state.audioCtx.currentTime + duration);
    } catch (e) {
      // Ignore audio unlock errors
    }
  }

  function toggleAmbientMusic() {
    const btn = document.getElementById('musicToggle');
    const icon = document.getElementById('musicIcon');
    const label = document.getElementById('musicLabel');

    state.musicPlaying = !state.musicPlaying;
    btn.setAttribute('aria-pressed', String(state.musicPlaying));

    if (state.musicPlaying) {
      icon.textContent = '🎵';
      label.textContent = 'Music On';
      const chordNotes = [261.63, 329.63, 392.00, 493.88, 440.00, 349.23];
      let idx = 0;
      playSoftChime(chordNotes[0], 2.2);
      state.ambientInterval = setInterval(() => {
        idx = (idx + 1) % chordNotes.length;
        playSoftChime(chordNotes[idx], 2.4);
      }, 2200);
    } else {
      icon.textContent = '🔇';
      label.textContent = 'Music Off';
      if (state.ambientInterval) clearInterval(state.ambientInterval);
    }
  }

  // --- 7. SCREEN 03 -> 04 -> 05: ENVELOPE & LETTER REVEAL ---
  function openEnvelopeAndShowLetter() {
    const wrapper = document.getElementById('envelopeWrapper');
    if (wrapper.classList.contains('opening')) return;
    wrapper.classList.add('opening');
    playSoftChime(440, 1.1);

    setTimeout(() => {
      showSection('screen-4', 4);
      const lines = document.querySelectorAll('.letter-line');
      lines.forEach((line, index) => {
        setTimeout(() => {
          line.classList.add('revealed');
        }, 450 * (index + 1));
      });

      setTimeout(() => {
        document.body.setAttribute('data-screen', '5');
        document.getElementById('letterContinueWrap').classList.add('visible');
      }, 450 * lines.length + 500);
    }, 850);
  }

  // --- 8. SCREEN 06 & 07: HEAL THE HEART INTERACTION ---
  function handleParticleTap(btn) {
    if (btn.classList.contains('healed')) return;
    btn.classList.add('healed');

    const crackIndex = btn.getAttribute('data-crack');
    const crackPath = document.getElementById(`crack-${crackIndex}`);
    if (crackPath) {
      crackPath.classList.add('healed');
    }

    state.healedCount += 1;
    playSoftChime(420 + state.healedCount * 45, 0.9);

    const progressPercent = (state.healedCount / state.totalCracks) * 100;
    const progressBar = document.getElementById('healProgressBar');
    const counter = document.getElementById('healCounter');

    progressBar.style.width = `${progressPercent}%`;
    counter.textContent = `${state.healedCount} / ${state.totalCracks} cracks healed`;

    // Screen 07: All 6 cracks healed -> Heart Restored
    if (state.healedCount >= state.totalCracks) {
      document.body.setAttribute('data-screen', '7');
      progressBar.classList.add('completed');
      document.getElementById('heartStop1').setAttribute('stop-color', '#F13B8B');
      document.getElementById('heartStop2').setAttribute('stop-color', '#A71650');
      document.querySelector('.repair-heart-svg').classList.add('restored');
      document.getElementById('repairHeartGlow').classList.add('restored');
      document.getElementById('heartRestoredBadge').classList.add('visible');
      document.getElementById('healInstruction').textContent = 'Every piece cared for with patience...';

      setTimeout(() => {
        loadMemorySlide(0);
        showSection('screen-8', 8);
      }, 2100);
    }
  }

  // --- 9. SCREEN 08, 09, 10: MEMORY LANE GALLERY ---
  function loadMemorySlide(index) {
    state.currentMemory = index;
    const screenNum = 8 + index;
    document.body.setAttribute('data-screen', String(screenNum));

    const polaroid = document.getElementById('mainPolaroid');
    const img = document.getElementById('memoryImage');
    const overlay = document.getElementById('colorRevealOverlay');
    const caption = document.getElementById('memoryCaption');
    const counter = document.getElementById('memoryCounter');
    const prevBtn = document.getElementById('prevMemoryBtn');
    const nextBtn = document.getElementById('nextMemoryBtn');
    const gardenWrap = document.getElementById('gardenCtaWrap');

    polaroid.classList.add('switching');
    setTimeout(() => {
      img.src = state.photos[index];
      caption.textContent = state.captions[index];
      counter.textContent = `${index + 1} / 3`;

      if (state.revealedMemories[index]) {
        img.classList.remove('grayscale-photo');
        img.classList.add('color-revealed');
        overlay.classList.add('hidden-overlay');
      } else {
        img.classList.add('grayscale-photo');
        img.classList.remove('color-revealed');
        overlay.classList.remove('hidden-overlay');
      }

      const rotationAngles = [-2.5, 2.2, -1.5];
      polaroid.style.transform = `rotate(${rotationAngles[index]}deg)`;
      polaroid.classList.remove('switching');
    }, 220);

    document.querySelectorAll('#memoryDots .dot').forEach((dot, idx) => {
      dot.classList.toggle('active', idx === index);
    });

    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === 2;

    if (index === 2) {
      gardenWrap.classList.remove('hidden');
    } else {
      gardenWrap.classList.add('hidden');
    }
  }

  function revealCurrentMemoryColor() {
    const idx = state.currentMemory;
    state.revealedMemories[idx] = true;
    const img = document.getElementById('memoryImage');
    const overlay = document.getElementById('colorRevealOverlay');
    img.classList.remove('grayscale-photo');
    img.classList.add('color-revealed');
    overlay.classList.add('hidden-overlay');
    playSoftChime(587.33, 0.8);
  }

  // --- 10. SCREEN 13: HIGH-RES CANVAS KEEPSAKE DOWNLOAD ---
  function downloadKeepsakeCard() {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');

    // Outer Dark Background
    ctx.fillStyle = '#080A12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Inner Cream Keepsake Card
    ctx.fillStyle = '#F6F1E5';
    ctx.strokeStyle = '#B7C6B0';
    ctx.lineWidth = 6;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(70, 70, 940, 1210, 36);
    } else {
      ctx.rect(70, 70, 940, 1210);
    }
    ctx.fill();
    ctx.stroke();

    // Headings
    ctx.fillStyle = '#63795C';
    ctx.font = '700 24px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('S I N C E R E   A P O L O G Y', 540, 170);

    ctx.fillStyle = '#64775A';
    ctx.font = 'italic 72px Georgia, serif';
    ctx.fillText(`To ${state.recipient}`, 540, 260);

    ctx.fillStyle = '#88977D';
    ctx.font = '600 19px sans-serif';
    ctx.fillText('SINCERE THOUGHTS AND HEALING HOPES', 540, 315);

    // Draw Polaroid Collage from DOM Images
    const domImgs = [
      document.querySelector('.c-pol-1 img'),
      document.querySelector('.c-pol-2 img'),
      document.querySelector('.c-pol-3 img')
    ];
    const layouts = [
      { x: 370, y: 470, angle: -0.14 },
      { x: 540, y: 460, angle: 0.03 },
      { x: 710, y: 470, angle: 0.15 }
    ];

    layouts.forEach((layout, i) => {
      ctx.save();
      ctx.translate(layout.x, layout.y);
      ctx.rotate(layout.angle);
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#E2DEC9';
      ctx.lineWidth = 2;
      ctx.fillRect(-105, -105, 210, 240);
      ctx.strokeRect(-105, -105, 210, 240);
      try {
        if (domImgs[i] && domImgs[i].complete) {
          ctx.drawImage(domImgs[i], -92, -92, 184, 184);
        }
      } catch (e) {}
      ctx.restore();
    });

    // Apology Body Text
    ctx.fillStyle = '#5E554D';
    ctx.font = 'italic 32px Georgia, serif';
    const messageText = document.getElementById('keepsakeBodyText').textContent.trim();
    wrapText(ctx, messageText, 540, 690, 740, 48);

    // Divider Line
    ctx.strokeStyle = '#88977D';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(380, 960);
    ctx.lineTo(700, 960);
    ctx.stroke();

    // Signature
    ctx.fillStyle = '#758A6B';
    ctx.font = 'italic 56px Georgia, serif';
    ctx.fillText(`with love, ${state.sender}`, 540, 1065);

    // Footer Watermark
    ctx.fillStyle = '#88977D';
    ctx.font = '500 18px sans-serif';
    ctx.fillText('WishVerse • Sincere Apology Keepsake', 540, 1215);

    const link = document.createElement('a');
    link.download = `Sincere-Apology-For-${state.recipient}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
  }

  // --- 11. RESET / WATCH AGAIN ---
  function resetExperience() {
    state.healedCount = 0;
    state.currentMemory = 0;
    state.revealedMemories = [false, false, false];

    document.getElementById('envelopeWrapper').classList.remove('opening');
    document.querySelectorAll('.letter-line').forEach(l => l.classList.remove('revealed'));
    document.getElementById('letterContinueWrap').classList.remove('visible');

    document.querySelectorAll('.heart-crack').forEach(c => c.classList.remove('healed'));
    document.querySelectorAll('.repair-particle').forEach(p => p.classList.remove('healed'));
    const progressBar = document.getElementById('healProgressBar');
    progressBar.style.width = '0%';
    progressBar.classList.remove('completed');
    document.getElementById('healCounter').textContent = '0 / 6 cracks healed';
    document.querySelector('.repair-heart-svg').classList.remove('restored');
    document.getElementById('repairHeartGlow').classList.remove('restored');
    document.getElementById('heartRestoredBadge').classList.remove('visible');
    document.getElementById('healInstruction').textContent = 'Tap each glowing particle to mend the cracks...';
    document.getElementById('timeRespectNote').classList.add('hidden');

    showSection('screen-2', 2);
  }

  // --- 12. EVENT LISTENERS & INITIALIZATION ---
  document.addEventListener('DOMContentLoaded', () => {
    hydratePersonalization();
    initRainCanvas();
    runLoadingSequence();

    document.getElementById('musicToggle').addEventListener('click', toggleAmbientMusic);

    document.getElementById('btnOpenEnvelopeScene').addEventListener('click', () => {
      playSoftChime(392, 0.8);
      showSection('screen-3', 3);
    });

    const envStage = document.getElementById('envelopeInteractive');
    envStage.addEventListener('click', openEnvelopeAndShowLetter);
    envStage.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openEnvelopeAndShowLetter();
      }
    });

    document.getElementById('btnToHealHeart').addEventListener('click', () => {
      showSection('screen-6', 6);
    });

    document.querySelectorAll('.repair-particle').forEach(btn => {
      btn.addEventListener('click', () => handleParticleTap(btn));
    });

    const mainPolaroid = document.getElementById('mainPolaroid');
    mainPolaroid.addEventListener('click', revealCurrentMemoryColor);
    mainPolaroid.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        revealCurrentMemoryColor();
      }
    });

    document.getElementById('prevMemoryBtn').addEventListener('click', () => {
      if (state.currentMemory > 0) loadMemorySlide(state.currentMemory - 1);
    });
    document.getElementById('nextMemoryBtn').addEventListener('click', () => {
      if (state.currentMemory < 2) loadMemorySlide(state.currentMemory + 1);
    });

    document.getElementById('btnGardenAwaits').addEventListener('click', () => {
      showSection('screen-11', 11);
    });

    document.getElementById('btnForgive').addEventListener('click', () => {
      playSoftChime(523.25, 1.4);
      document.getElementById('bloomHeading').innerHTML = `Thank you, <span class="dyn-recipient">${state.recipient}</span>.`;
      document.getElementById('bloomSubtext').textContent = 'A new beginning blooms. 🌸';
      showSection('screen-12', 12);
    });

    document.getElementById('btnNeedTime').addEventListener('click', () => {
      const note = document.getElementById('timeRespectNote');
      note.classList.remove('hidden');
      setTimeout(() => {
        document.getElementById('bloomHeading').innerHTML = `Take your time, <span class="dyn-recipient">${state.recipient}</span>.`;
        document.getElementById('bloomSubtext').textContent = 'Patience and understanding come first. 🌸';
        showSection('screen-12', 12);
      }, 2200);
    });

    document.getElementById('btnToKeepsake').addEventListener('click', () => {
      showSection('screen-13', 13);
    });

    document.getElementById('btnDownloadKeepsake').addEventListener('click', downloadKeepsakeCard);
    document.getElementById('btnWatchAgain').addEventListener('click', resetExperience);
  });
})();