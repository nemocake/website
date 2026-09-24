/* gridnav.js — the site header: "con / rad" stacked beside a 2×2 mark of the four
 * sections. One filled square travels between the cells as you point; the label
 * beside it rolls to that section's name. Leaving the mark returns both to the
 * page you're on. Usage: <div data-gridnav data-cur="studio"></div>
 * (data-cur="" on the home page: nothing filled until you point).
 * On touch screens there is no hover to preview with: the lockup is a little
 * larger, each cell has a padded tap area, and a tap snaps the square straight
 * to that cell and goes. */
(function () {
  var SECTIONS = ["studio", "writings", "collection", "projects"];   // 2×2: TL, TR, BL, BR
  var script = document.currentScript;
  var ROOT = new URL("../../", script ? script.src : location.href).href;
  var HOVER = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  var CSS = [
    "[data-gridnav]{--gn:26px;--gn-cell:11px;--gn-step:15px;--gn-font:13px;display:flex;align-items:center;gap:14px;color:var(--ink,currentColor)}",
    "@media (hover:none),(pointer:coarse){[data-gridnav]{--gn:32px;--gn-cell:14px;--gn-step:18px;--gn-font:15px}}",
    "[data-gridnav] a{color:inherit;text-decoration:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation}",
    ".gn-home{display:flex;flex-direction:column;justify-content:space-between;height:var(--gn);font:500 var(--gn-font)/1 'Areal',sans-serif;letter-spacing:-.035em}",
    ".gn-home span{display:block;height:var(--gn-cell);line-height:var(--gn-cell)}",
    ".gn-mark{position:relative;width:var(--gn);height:var(--gn);display:grid;grid-template-columns:1fr 1fr;gap:4px;flex:none}",
    ".gn-mark a{position:relative;display:block;outline:1px solid var(--ink-faint,var(--mute,#8c8c8c));outline-offset:-1px;transition:outline-color .2s}",
    /* a padded, invisible tap area around each cell (meets its neighbour halfway across the gap) */
    ".gn-mark a::after{content:'';position:absolute;inset:-2px}",
    "@media (hover:none),(pointer:coarse){.gn-mark a::after{inset:-8px}.gn-mark a:nth-child(2n+1)::after{right:-2px}.gn-mark a:nth-child(2n)::after{left:-2px}.gn-mark a:nth-child(-n+2)::after{bottom:-2px}.gn-mark a:nth-child(n+3)::after{top:-2px}}",
    "@media (hover:hover){.gn-mark a:hover{outline-color:var(--ink,currentColor)}}",
    ".gn-mark a:focus-visible{outline-color:var(--ink,currentColor)}",
    ".gn-sq{position:absolute;left:0;top:0;width:var(--gn-cell);height:var(--gn-cell);background:var(--ink,currentColor);pointer-events:none;",
    "transition:left .45s cubic-bezier(.2,.9,.25,1.12),top .45s cubic-bezier(.2,.9,.25,1.12),opacity .25s}",
    ".gn-roll{display:block;height:16px;overflow:hidden;margin-left:4px;font:400 var(--gn-font)/16px 'Areal',sans-serif;letter-spacing:.005em;transition:opacity .25s}",
    ".gn-track{transition:transform .45s cubic-bezier(.65,0,.35,1)}",
    ".gn-track span{display:block;height:16px}",
    "[data-gridnav].gn-none .gn-sq,[data-gridnav].gn-none .gn-roll{opacity:0}",
    "[data-gridnav].gn-snap .gn-sq,[data-gridnav].gn-snap .gn-track{transition:none}",
    "@media (prefers-reduced-motion:reduce){.gn-sq,.gn-track{transition:none}}"
  ].join("\n");

  function mount(el) {
    if (el.dataset.gnDone) return;
    el.dataset.gnDone = "1";
    var cur = el.getAttribute("data-cur") || "";
    var href = function (s) { return ROOT + s + "/"; };
    el.setAttribute("role", "navigation");
    el.setAttribute("aria-label", "site");
    el.innerHTML =
      '<a class="gn-home" href="' + ROOT + '" aria-label="con.rad — home"><span>con</span><span>rad</span></a>' +
      '<div class="gn-mark">' + SECTIONS.map(function (s) {
        return '<a data-s="' + s + '" href="' + href(s) + '" title="' + s + '" aria-label="' + s + '"' + (s === cur ? ' aria-current="page"' : "") + "></a>";
      }).join("") + '<span class="gn-sq" aria-hidden="true"></span></div>' +
      '<a class="gn-roll" aria-hidden="true" tabindex="-1"><div class="gn-track">' +
      SECTIONS.map(function (s) { return "<span>" + s + "</span>"; }).join("") + "</div></a>";

    var sq = el.querySelector(".gn-sq"), track = el.querySelector(".gn-track"), roll = el.querySelector(".gn-roll");
    function show(s) {
      var i = SECTIONS.indexOf(s);
      el.classList.toggle("gn-none", i < 0);
      if (i < 0) { roll.removeAttribute("href"); return; }
      sq.style.left = "calc(var(--gn-step) * " + (i % 2) + ")";
      sq.style.top = "calc(var(--gn-step) * " + Math.floor(i / 2) + ")";
      track.style.transform = "translateY(" + (-16 * i) + "px)";
      roll.href = href(s);
    }
    // start in place without animating
    el.classList.add("gn-snap");
    show(cur);
    sq.offsetWidth;
    requestAnimationFrame(function () { el.classList.remove("gn-snap"); });

    var cells = el.querySelectorAll(".gn-mark a");
    if (HOVER) {
      cells.forEach(function (a) { a.addEventListener("mouseenter", function () { show(a.dataset.s); }); });
      // the label stays live while you move from a cell onto it
      el.addEventListener("mouseleave", function () { show(cur); });
    } else {
      // touch: no preview — the square snaps to the tapped cell as the page starts to change
      cells.forEach(function (a) {
        a.addEventListener("pointerdown", function () { el.classList.add("gn-snap"); show(a.dataset.s); }, { passive: true });
      });
      // coming back via the browser's back button shows the real current page again
      window.addEventListener("pageshow", function () { el.classList.add("gn-snap"); show(cur); });
    }
    cells.forEach(function (a) { a.addEventListener("focus", function () { show(a.dataset.s); }); });
    el.addEventListener("focusout", function (e) { if (!el.contains(e.relatedTarget)) show(cur); });
  }

  function init() {
    if (!document.getElementById("gridnav-css")) {
      var st = document.createElement("style");
      st.id = "gridnav-css"; st.textContent = CSS;
      document.head.appendChild(st);
    }
    document.querySelectorAll("[data-gridnav]").forEach(mount);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
