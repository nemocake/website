/* gridnav.js — the site header: "con / rad" stacked beside a 2×2 mark of the four
 * sections. One filled square travels between the cells as you point; the label
 * beside it rolls to that section's name. Leaving the mark returns both to the
 * page you're on. Usage: <div data-gridnav data-cur="studio"></div>
 * (data-cur="" on the home page: nothing filled until you point). */
(function () {
  var SECTIONS = ["studio", "writings", "collection", "projects"];   // 2×2: TL, TR, BL, BR
  var script = document.currentScript;
  var ROOT = new URL("../../", script ? script.src : location.href).href;

  var CSS = [
    "[data-gridnav]{display:flex;align-items:center;gap:14px;color:var(--ink,currentColor)}",
    "[data-gridnav] a{color:inherit;text-decoration:none}",
    ".gn-home{display:flex;flex-direction:column;justify-content:space-between;height:26px;font:500 13px/1 'Areal',sans-serif;letter-spacing:-.035em}",
    ".gn-home span{display:block;height:11px;line-height:11px}",
    ".gn-mark{position:relative;width:26px;height:26px;display:grid;grid-template-columns:1fr 1fr;gap:4px;flex:none}",
    ".gn-mark a{display:block;outline:1px solid var(--ink-faint,var(--mute,#8c8c8c));outline-offset:-1px;transition:outline-color .2s}",
    ".gn-mark a:hover,.gn-mark a:focus-visible{outline-color:var(--ink,currentColor)}",
    ".gn-sq{position:absolute;left:0;top:0;width:11px;height:11px;background:var(--ink,currentColor);pointer-events:none;",
    "transition:left .45s cubic-bezier(.2,.9,.25,1.12),top .45s cubic-bezier(.2,.9,.25,1.12),opacity .25s}",
    ".gn-roll{display:block;height:16px;overflow:hidden;margin-left:4px;font:400 13px/16px 'Areal',sans-serif;letter-spacing:.005em;transition:opacity .25s}",
    ".gn-track{transition:transform .45s cubic-bezier(.65,0,.35,1)}",
    ".gn-track span{display:block;height:16px}",
    "[data-gridnav].gn-none .gn-sq,[data-gridnav].gn-none .gn-roll{opacity:0}",
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
      sq.style.left = (i % 2) * 15 + "px";
      sq.style.top = Math.floor(i / 2) * 15 + "px";
      track.style.transform = "translateY(" + (-16 * i) + "px)";
      roll.href = href(s);
    }
    // start in place without animating
    sq.style.transition = "none"; track.style.transition = "none";
    show(cur);
    sq.offsetWidth;
    requestAnimationFrame(function () { sq.style.transition = ""; track.style.transition = ""; });

    el.querySelectorAll(".gn-mark a").forEach(function (a) {
      a.addEventListener("mouseenter", function () { show(a.dataset.s); });
      a.addEventListener("focus", function () { show(a.dataset.s); });
    });
    // the label stays live while you move from a cell onto it
    el.addEventListener("mouseleave", function () { show(cur); });
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
