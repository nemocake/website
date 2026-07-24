/* theme.js — white / cream / dark ground selector.
 * The chosen theme persists per visitor. Everything drawn (pencil rules,
 * masthead, ornaments) listens for "studio-theme" and redraws in the new inks. */
(function () {
  var KEY = "studio.theme";
  var THEMES = ["white", "cream", "dark"];

  function apply(t, fire) {
    if (THEMES.indexOf(t) < 0) t = "cream";
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem(KEY, t); } catch (_) {}
    document.querySelectorAll(".theme-picker button").forEach(function (b) {
      b.classList.toggle("cur", b.dataset.t === t);
    });
    if (fire) dispatchEvent(new CustomEvent("studio-theme", { detail: t }));
  }

  function picker() {
    var d = document.createElement("span");
    d.className = "theme-picker";
    d.setAttribute("role", "group");
    d.setAttribute("aria-label", "page ground");
    d.innerHTML = THEMES.map(function (t) {
      return '<button data-t="' + t + '" title="' + t + ' ground" aria-label="' + t + ' ground"></button>';
    }).join("");
    d.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (b) apply(b.dataset.t, true);
    });
    return d;
  }

  function init() {
    // prefer the fixed bottom-right corner mount (matches the rest of the site);
    // fall back to the colophon/rail only if no .ground-mount is present
    var fixed = document.querySelector(".ground-mount");
    if (fixed) {
      if (!fixed.querySelector(".theme-picker")) fixed.appendChild(picker());
    } else {
      document.querySelectorAll("footer.colophon, .colophon").forEach(function (f) {
        if (!f.querySelector(".theme-picker")) f.insertBefore(picker(), f.lastElementChild);
      });
      var rail = document.getElementById("rail");
      if (rail && !rail.querySelector(".theme-picker")) {
        var pk = picker();
        rail.appendChild(pk);
        new MutationObserver(function () {
          if (pk.isConnected && rail.contains(pk) && rail.lastElementChild !== pk) rail.appendChild(pk);
        }).observe(rail, { childList: true });
      }
    }
    // honour the visitor's saved choice across pages; fall back to the page default
    var stored = null;
    try { stored = localStorage.getItem(KEY); } catch (_) {}
    apply(stored || document.documentElement.dataset.theme || "cream", false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  window.StudioTheme = { apply: apply };
})();
