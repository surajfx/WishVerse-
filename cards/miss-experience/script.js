(() => {
  const q = new URLSearchParams(location.search);
  const data = {
    to: q.get('to') || 'you',
    from: q.get('from') || 'someone who misses you',
    msg: q.get('msg') || 'I miss your voice, your smile, and all the little moments we share. I wish you were here.',
    photos: (q.get('photos') || '').split(',').filter(Boolean).slice(0,4),
    duration: q.get('duration') || '',
    memory: q.get('memory') || '',
    relationship: q.get('relationship') || 'Friend',
    unlockAt: q.get('unlockAt') || '',
    unlockEnabled: q.get('unlockEnabled') === '1'
  };

  const $ = s => document.querySelector(s);
  let scene = 'fogScene', audioContext = null, audioNodes = [], countdownTimer = null;
  const scenes = ['fogScene','memoriesScene','messageScene','finalScene','lockedScene'];

  const mainPhoto = data.photos[0];
  if (mainPhoto) {
    $('#heroPhoto').src = mainPhoto;
    $('#finalPhoto').src = mainPhoto;
    $('#photoPlaceholder').classList.add('hidden');
    $('#finalPhotoPlaceholder').classList.add('hidden');
  } else {
    $('#heroPhoto').classList.add('hidden');
    $('#photoPlaceholder').style.display = 'flex';
    $('#finalPhoto').classList.add('hidden');
    $('#finalPhotoPlaceholder').style.display = 'grid';
  }

  $('#messageTo').textContent = data.to;
  $('#personalMessage').textContent = data.msg;
  $('#signatureName').textContent = data.from;
  $('#finalFrom').textContent = data.from;
  $('#finalQuote').textContent = data.msg.length > 180 ? data.msg.slice(0,177) + '…' : data.msg;
  $('#finalMemory').textContent = [
    data.duration ? `It's been ${data.duration} since we last met.` : '',
    data.memory ? `The memory I miss most: ${data.memory}` : ''
  ].filter(Boolean).join('\n\n');
  $('#distanceNote').textContent = data.duration
    ? `It has been ${data.duration}… and I still find little ways to miss you every day. 💙`
    : 'No matter the distance, some people always feel close.';
  if (data.memory) $('[data-memory="2"] .memory-back').textContent = `The memory I miss most: ${data.memory}`;
  $('#lockedName').textContent = data.to;

  function showScene(id) {
    scenes.forEach(s => $('#' + s).classList.toggle('active', s === id));
    scene = id;
    window.scrollTo({top: 0, behavior: 'smooth'});
  }

  function setupFog() {
    const canvas = $('#fogCanvas'), box = $('#photoReveal');
    const resize = () => {
      const r = box.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round((r.width - 20) * dpr);
      canvas.height = Math.round((r.height - 20) * dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = r.width - 20, h = r.height - 20;
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, 'rgba(215,232,247,.97)');
      g.addColorStop(.5, 'rgba(177,200,223,.94)');
      g.addColorStop(1, 'rgba(226,237,247,.98)');
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 220; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * .18})`;
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 4 + .5, 0, Math.PI * 2);
        ctx.fill();
      }
      canvas.dataset.wiped = '0';
    };

    resize();
    window.addEventListener('resize', resize, {passive: true});
    const ctx = canvas.getContext('2d');
    let drawing = false, wiped = 0, lastCheck = 0;

    function wipe(e) {
      if (!drawing) return;
      const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      ctx.globalCompositeOperation = 'destination-out';
      const grad = ctx.createRadialGradient(x, y, 2, x, y, 42);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, 42, 0, Math.PI * 2);
      ctx.fill();
      wiped++;
      if (wiped - lastCheck > 5) {
        lastCheck = wiped;
        canvas.style.opacity = Math.max(.08, 1 - wiped / 85);
      }
      if (wiped > 38) {
        canvas.style.opacity = '.04';
        $('#revealContinue').classList.add('ready');
      }
    }

    canvas.addEventListener('pointerdown', e => {
      drawing = true;
      canvas.setPointerCapture(e.pointerId);
      wipe(e);
    });
    canvas.addEventListener('pointermove', wipe);
    canvas.addEventListener('pointerup', () => drawing = false);
    canvas.addEventListener('pointercancel', () => drawing = false);
    $('#revealContinue').addEventListener('click', () => showScene('memoriesScene'));
  }

  setupFog();
  document.querySelectorAll('[data-memory]').forEach(card =>
    card.addEventListener('click', () => card.classList.toggle('flipped'))
  );
  $('#readMessage').addEventListener('click', () => showScene('messageScene'));
  $('#finalReveal').addEventListener('click', () => showScene('finalScene'));
  $('#watchAgain').addEventListener('click', () => {
    showScene('fogScene');
    $('#fogCanvas').style.opacity = '1';
    window.dispatchEvent(new Event('resize'));
  });

  $('#downloadKeepsake').addEventListener('click', async () => {
    const btn = $('#downloadKeepsake');
    btn.disabled = true;
    btn.textContent = 'Preparing your keepsake…';
    try {
      if (!window.html2canvas) throw new Error('Download is unavailable right now.');
      const canvas = await window.html2canvas($('#keepsake'), {
        backgroundColor: '#101c38', scale: 2, useCORS: true
      });
      const a = document.createElement('a');
      a.download = `miss-you-${data.to.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'keepsake'}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    } catch (e) {
      alert(e.message || 'Could not create the keepsake image.');
    } finally {
      btn.disabled = false;
      btn.textContent = '⇩ Download Keepsake';
    }
  });

  $('#soundToggle').addEventListener('click', async () => {
    const button = $('#soundToggle');
    const enabled = button.getAttribute('aria-pressed') !== 'true';
    if (enabled) {
      try {
        audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
        await audioContext.resume();
        [174.61, 261.63].forEach((freq, i) => {
          const osc = audioContext.createOscillator(), gain = audioContext.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.value = .018 / (i + 1);
          osc.connect(gain);
          gain.connect(audioContext.destination);
          osc.start();
          audioNodes.push({osc, gain});
        });
      } catch (_) {
        button.querySelector('span').textContent = 'Sound unavailable';
        return;
      }
    } else {
      audioNodes.forEach(n => { try { n.osc.stop(); } catch (_) {} });
      audioNodes = [];
    }
    button.setAttribute('aria-pressed', String(enabled));
    button.querySelector('span').textContent = enabled ? 'Sound on' : 'Sound off';
  });

  function startLock() {
    showScene('lockedScene');
    const target = new Date(data.unlockAt).getTime();
    function update() {
      const diff = target - Date.now();
      if (diff <= 0) {
        clearInterval(countdownTimer);
        showScene('fogScene');
        return;
      }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor(diff % 86400000 / 3600000);
      const mins = Math.floor(diff % 3600000 / 60000);
      const secs = Math.floor(diff % 60000 / 1000);
      $('#countdown').textContent =
        `${String(days).padStart(2,'0')} : ${String(hours).padStart(2,'0')} : ${String(mins).padStart(2,'0')} : ${String(secs).padStart(2,'0')}`;
    }
    update();
    countdownTimer = setInterval(update, 1000);
  }

  if (data.unlockEnabled && data.unlockAt &&
      Number.isFinite(new Date(data.unlockAt).getTime()) &&
      new Date(data.unlockAt).getTime() > Date.now()) {
    startLock();
  }
})();
