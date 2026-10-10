// Shared light/night theme for every WishVerse page. Include in <head>.
(function () {
  var KEY = "wishverse-theme", root = document.documentElement;
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  if (saved() === "light") root.classList.add("light");

  function sync() {
    var light = root.classList.contains("light");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", light ? "#fff8fb" : "#0a0a12");
    document.querySelectorAll("#themeToggle,.theme-toggle").forEach(function (b) {
      b.textContent = light ? "☾" : "☀"; b.setAttribute("aria-label", light ? "Switch to night view" : "Switch to light view");
    });
  }
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ["class"] });

  document.addEventListener("DOMContentLoaded", function () {
    if (!document.getElementById("themeToggle")) { // sub-pages: add a toggle to the top bar
      var bar = document.querySelector(".page-topbar,.cp-head,.top");
      if (bar && bar.lastElementChild) {
        var last = bar.lastElementChild, wrap = document.createElement("div"), btn = document.createElement("button");
        wrap.className = "theme-toggle-wrap"; btn.type = "button"; btn.className = "icon-btn theme-toggle";
        btn.onclick = function () { root.classList.toggle("light"); save(root.classList.contains("light") ? "light" : "dark"); };
        bar.replaceChild(wrap, last); wrap.appendChild(last); wrap.appendChild(btn);
      }
    }
    sync();
  });
})();
