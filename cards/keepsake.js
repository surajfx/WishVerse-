// Shared "Download Keepsake" for the experience cards. Draws the final card into a PNG and saves it.
(function () {
  var LIBS = [
    "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
    "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js",
  ];
  function loadLib(i) {
    return new Promise(function (resolve, reject) {
      if (window.html2canvas) return resolve();
      if (i >= LIBS.length) return reject(new Error("lib"));
      var s = document.createElement("script");
      s.src = LIBS[i]; s.onload = function () { resolve(); };
      s.onerror = function () { s.remove(); loadLib(i + 1).then(resolve, reject); };
      document.head.appendChild(s);
    });
  }
  function msg(btn, text, ms) {
    var old = btn.dataset.label || btn.textContent;
    btn.dataset.label = old; btn.textContent = text;
    clearTimeout(btn._t); btn._t = setTimeout(function () { btn.textContent = old; btn.disabled = false; }, ms || 2200);
  }
  function showPreview(url, name) {
    var o = document.createElement("div");
    o.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:18px;text-align:center;color:#fff;font:600 14px system-ui,sans-serif";
    o.innerHTML = '<div>Touch &amp; hold the image, then choose <b>Save image</b></div>' +
      '<img alt="Keepsake" style="max-width:100%;max-height:68vh;border-radius:12px" src="' + url + '">' +
      '<a download="' + name + '" href="' + url + '" style="padding:10px 20px;border-radius:999px;background:#fff;color:#111;text-decoration:none">Download</a>' +
      '<button style="background:none;border:1px solid #fff8;color:#fff;border-radius:999px;padding:8px 18px">Close</button>';
    o.querySelector("button").onclick = function () { o.remove(); };
    document.body.appendChild(o);
  }
  function save(blob, name) {
    var url = URL.createObjectURL(blob);
    var ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (ios) { showPreview(url, name); return; }
    var a = document.createElement("a");
    a.href = url; a.download = name; a.style.display = "none";
    document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); }, 1500);
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }
  function target(sel) {
    var k = document.querySelector(sel || ".keepsake-card");
    if (k) return k;
    return document.querySelector(".screen:not(.hidden)") || document.body;
  }
  function render(el, withImages) {
    var bg = getComputedStyle(document.body).backgroundColor;
    return window.html2canvas(el, {
      backgroundColor: el.classList && el.classList.contains("keepsake-card") ? null : bg,
      scale: Math.min(2, window.devicePixelRatio || 2), useCORS: true, allowTaint: false, logging: false,
      imageTimeout: 8000,
      ignoreElements: function (n) {
        if (!n.classList) return false;
        if (n.classList.contains("final-buttons") || n.classList.contains("topbar") || n.classList.contains("sound-toggle")) return true;
        if (!withImages && (n.tagName === "IMG")) return true;
        return false;
      },
      onclone: function (doc) {
        if (!withImages) doc.querySelectorAll(".ph,[style*='url(']").forEach(function (x) { x.style.backgroundImage = "none"; });
        doc.querySelectorAll("*").forEach(function (x) { x.style.animation = "none"; x.style.transition = "none"; });
      },
    });
  }
  window.WVKeepsake = {
    bind: function (btnId, who, sel) {
      var btn = document.getElementById(btnId); if (!btn) return;
      btn.addEventListener("click", function () {
        if (btn.disabled) return;
        btn.disabled = true; btn.dataset.label = btn.dataset.label || btn.textContent; btn.textContent = "Preparing…";
        var w = typeof who === "function" ? who() : who;
        var name = "wishverse-" + String(w || "keepsake").replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".png";
        loadLib(0).then(function () {
          var el = target(sel);
          return render(el, true).catch(function () { return render(el, false); });
        }).then(function (canvas) {
          return new Promise(function (res, rej) {
            canvas.toBlob(function (b) { b ? res(b) : rej(new Error("blob")); }, "image/png");
          });
        }).then(function (blob) {
          save(blob, name); msg(btn, "Saved ✓", 2500);
        }).catch(function (e) {
          console.error("keepsake failed", e);
          msg(btn, "Could not save, try again", 3000);
        });
      });
    },
  };
})();
