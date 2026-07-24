/* graphite.js — the studio's own hand applied to its website.
 * Rules and frames are drawn as tremored pencil strokes (2 accumulation passes),
 * seeded by the date, so the page re-draws itself slightly differently each day.
 * Ornaments are DIE guillotine partitions. Headings get a misregistered
 * sanguine impression (MARTENS OVERPRINT). Without JS the crisp CSS borders
 * simply remain. */
(function () {
  function cssv(n, fb) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    return v || fb;
  }
  var INK = "28,26,22", SANG = "156,61,30";
  function refreshInks() {
    INK = cssv("--ink-rgb", "28,26,22");
    SANG = cssv("--sang-rgb", "156,61,30");
  }

  // ---- seeded rng (mulberry32, seeded by the date) ----
  var d = new Date();
  var daySeed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  function rngFor(seed) {
    var s = seed >>> 0;
    return function () {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      var t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  var NS = "http://www.w3.org/2000/svg";
  function svgEl(w, h) {
    var s = document.createElementNS(NS, "svg");
    s.setAttribute("width", w); s.setAttribute("height", h);
    s.setAttribute("viewBox", "0 0 " + w + " " + h);
    s.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:visible";
    s.setAttribute("aria-hidden", "true");
    return s;
  }

  // one tremored line as an svg path; amp = waviness, drift = slow bow
  function penD(x1, y1, x2, y2, r, amp) {
    var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    var n = Math.max(2, Math.round(len / 7));
    var bow = (r() - 0.5) * amp * 2.4, ph = r() * Math.PI * 2;
    var p = "M" + x1.toFixed(1) + " " + y1.toFixed(1);
    for (var i = 1; i <= n; i++) {
      var t = i / n;
      var wob = Math.sin(t * Math.PI * (2 + r() * 2) + ph) * amp * (0.4 + r() * 0.6)
              + Math.sin(t * Math.PI) * bow + (r() - 0.5) * amp * 0.7;
      // offset perpendicular to the line
      var px = x1 + dx * t - (dy / len) * wob;
      var py = y1 + dy * t + (dx / len) * wob;
      p += "L" + px.toFixed(1) + " " + py.toFixed(1);
    }
    return p;
  }

  function penStroke(svg, x1, y1, x2, y2, r, opts) {
    opts = opts || {};
    var amp = opts.amp || 0.9, col = opts.col || INK;
    var passes = [[1.15, 0.5], [0.75, 0.32]];
    for (var i = 0; i < passes.length; i++) {
      var path = document.createElementNS(NS, "path");
      path.setAttribute("d", penD(x1 + (r() - 0.5) * 1.2, y1 + (r() - 0.5) * 1.2,
                                  x2 + (r() - 0.5) * 1.2, y2 + (r() - 0.5) * 1.2, r, amp));
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "rgba(" + col + "," + passes[i][1] * (opts.alpha || 1) + ")");
      path.setAttribute("stroke-width", passes[i][0] * (opts.w || 1));
      path.setAttribute("stroke-linecap", "round");
      svg.appendChild(path);
    }
  }

  // ---- element treatments ----
  function elSeed(el, i) { return daySeed ^ (i * 2654435761); }

  // a horizontal rule drawn on the bottom (or top) edge
  function penRule(el, i, edge) {
    var w = el.clientWidth; if (!w) return;
    clearOld(el);
    el.style.position = el.style.position || "relative";
    el.style.borderBottomColor = "transparent";
    el.style.borderTopColor = "transparent";
    var svg = svgEl(w, el.clientHeight || 4);
    svg.classList.add("g-pen");
    var r = rngFor(elSeed(el, i));
    var y = edge === "top" ? 0.5 : (el.clientHeight || 4) - 0.5;
    penStroke(svg, 0, y, w, y, r, { amp: 0.8 });
    el.appendChild(svg);
  }

  // a frame drawn around the element's box
  function penRect(el, i) {
    var w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
    clearOld(el);
    el.style.position = el.style.position || "relative";
    el.style.borderColor = "transparent";
    var svg = svgEl(w, h);
    svg.classList.add("g-pen");
    var r = rngFor(elSeed(el, i));
    penStroke(svg, 1, 1, w - 1, 1, r, { amp: 0.8 });
    penStroke(svg, w - 1, 1, w - 1, h - 1, r, { amp: 0.8 });
    penStroke(svg, w - 1, h - 1, 1, h - 1, r, { amp: 0.8 });
    penStroke(svg, 1, h - 1, 1, 1, r, { amp: 0.8 });
    el.appendChild(svg);
  }

  function clearOld(el) {
    el.querySelectorAll(":scope > svg.g-pen").forEach(function (s) { s.remove(); });
  }

  // ---- DIE guillotine partition ornament ----
  function dieOrnament(w, h, seedOffset) {
    var svg = svgEl(w, h);
    svg.style.position = "static";
    var r = rngFor(daySeed ^ (seedOffset || 0xD1E));
    var cells = [{ x: 0.5, y: 0.5, w: w - 1, h: h - 1 }];
    for (var depth = 0; depth < 4; depth++) {
      var next = [];
      cells.forEach(function (c) {
        if (Math.max(c.w, c.h) < 9 || r() < 0.22) { next.push(c); return; }
        var vert = c.w > c.h ? true : c.h > c.w ? false : r() < 0.5;
        var t = 0.3 + r() * 0.4;
        if (vert) {
          next.push({ x: c.x, y: c.y, w: c.w * t, h: c.h });
          next.push({ x: c.x + c.w * t, y: c.y, w: c.w * (1 - t), h: c.h });
        } else {
          next.push({ x: c.x, y: c.y, w: c.w, h: c.h * t });
          next.push({ x: c.x, y: c.y + c.h * t, w: c.w, h: c.h * (1 - t) });
        }
      });
      cells = next;
    }
    var sang = Math.floor(r() * cells.length);
    cells.forEach(function (c, ci) {
      var rect = document.createElementNS(NS, "rect");
      rect.setAttribute("x", c.x.toFixed(1)); rect.setAttribute("y", c.y.toFixed(1));
      rect.setAttribute("width", Math.max(1, c.w - 1.4).toFixed(1));
      rect.setAttribute("height", Math.max(1, c.h - 1.4).toFixed(1));
      rect.setAttribute("fill", ci === sang ? "rgba(" + SANG + ",.75)" : "none");
      rect.setAttribute("stroke", "rgba(" + INK + ",.6)");
      rect.setAttribute("stroke-width", "0.8");
      svg.appendChild(rect);
    });
    return svg;
  }

  // ---- overprint (misregistered sanguine impression under the ink) ----
  function overprint(el) {
    if (el.dataset.gOver) return;
    el.dataset.gOver = "1";
    var r = rngFor(daySeed ^ el.textContent.length * 7919);
    var dx = (0.8 + r() * 1.4).toFixed(1), dy = (0.4 + r() * 1.0).toFixed(1);
    el.style.position = el.style.position || "relative";
    var ghost = document.createElement("span");
    ghost.textContent = el.textContent;
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.cssText = "position:absolute;left:" + dx + "px;top:" + dy +
      "px;width:calc(100% + 10px);color:rgba(" + SANG + ",.42);mix-blend-mode:multiply;z-index:-1;pointer-events:none";
    el.appendChild(ghost);
  }

  // ---- init: scan the page ----
  var RULE_SEL = ".mast .rule, .sect2, .plate figcaption, .furniture, .piece-head, .art-nav, .carousel-head, .toc-series h4, .writing-row";
  var RECT_SEL = ".plate .img, .well, .a-img .frame, .a-pair .frame, .a-code, .contents, .piece-plates .img";

  var ro = ("ResizeObserver" in window) ? new ResizeObserver(function (entries) {
    entries.forEach(function (en) { redrawOne(en.target); });
  }) : null;

  var targets = [];
  function redrawOne(el) {
    var t = targets.find(function (t) { return t.el === el; });
    if (t) (t.kind === "rect" ? penRect : penRule)(el, t.i, t.edge);
  }

  function ornaments(root) {
    (root || document).querySelectorAll("[data-die]").forEach(function (el) {
      if (el.dataset.gDie) return;
      el.dataset.gDie = "1";
      var parts = (el.dataset.die || "72x22").split("x");
      el.appendChild(dieOrnament(+parts[0], +parts[1], el.className.length));
    });
  }

  addEventListener("studio-theme", function () {
    refreshInks();
    targets.forEach(function (t) { redrawOne(t.el); });
    document.querySelectorAll("[data-die]").forEach(function (el) {
      delete el.dataset.gDie; el.innerHTML = "";
    });
    ornaments(document);
  });

  function init(root) {
    refreshInks();
    root = root || document;
    var i = 0;
    root.querySelectorAll(RULE_SEL).forEach(function (el) {
      var edge = el.matches(".plate figcaption, .pagenav, .art-nav") ? "top" : "bottom";
      targets.push({ el: el, kind: "rule", edge: edge, i: ++i });
      penRule(el, i, edge);
      if (ro) ro.observe(el);
    });
    root.querySelectorAll(RECT_SEL).forEach(function (el) {
      targets.push({ el: el, kind: "rect", i: ++i });
      penRect(el, i);
      if (ro) ro.observe(el);
    });
    ornaments(root);
  }

  // ---- pentimento arrival: images resolve from underdrawing to full colour ----
  var RESOLVE_SEL = ".plate .img img, .piece-plates .img img, .a-img img, .a-pair img, .well img";
  var rio = ("IntersectionObserver" in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add("g-resolved"); rio.unobserve(en.target); }
    });
  }, { threshold: 0.12 }) : null;
  function resolveImgs(root) {
    (root || document).querySelectorAll(RESOLVE_SEL).forEach(function (img) {
      if (img.dataset.gRes) return;
      img.dataset.gRes = "1";
      if (rio) { img.classList.add("g-under"); rio.observe(img); }
    });
  }

  var _init = init;
  init = function (root) { _init(root); resolveImgs(root); };

  window.Graphite = { init: init, die: dieOrnament };
})();
