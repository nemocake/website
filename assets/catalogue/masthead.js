/* masthead.js — the site draws its own title.
 * A small self-contained sketching system that exists only for this page:
 * the word is rasterized to a mask, then filled by accumulated short strokes
 * whose density is the rendering. Seeded by the date, so each day is a new
 * drawing. Interactive: attention accumulates — the graphite darkens under
 * your cursor — and a click starts a fresh sitting. */
(function () {
  var INK = "#1c1a16", PAPER = "rgb(231,228,221)", SANG = "#9c3d1e";
  function refreshInks() {
    var cs = getComputedStyle(document.documentElement);
    var ink = cs.getPropertyValue("--ink-rgb").trim();
    var pap = cs.getPropertyValue("--paper-rgb").trim();
    var sang = cs.getPropertyValue("--sanguine").trim();
    if (ink) INK = "rgb(" + ink + ")";
    if (pap) PAPER = "rgb(" + pap + ")";
    if (sang) SANG = sang;
  }

  // ---- rng (mulberry32) ----
  function rngFor(seed) {
    var s = seed >>> 0;
    var r = function () {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      var t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    return {
      rand: r,
      range: function (a, b) { return a + (b - a) * r(); },
      int: function (a, b) { return Math.floor(a + (b - a + 1) * r()); },
      bool: function (p) { return r() < p; },
    };
  }

  // ---- hashed value noise, cosine-smoothed ----
  function noiseFor(seed) {
    function h(x, y) {
      var n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519);
      n = Math.imul(n ^ n >>> 13, 1274126177);
      return ((n ^ n >>> 16) >>> 0) / 4294967296;
    }
    return function (x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
      var ux = (1 - Math.cos(fx * Math.PI)) / 2, uy = (1 - Math.cos(fy * Math.PI)) / 2;
      var a = h(xi, yi) * (1 - ux) + h(xi + 1, yi) * ux;
      var b = h(xi, yi + 1) * (1 - ux) + h(xi + 1, yi + 1) * ux;
      return (a * (1 - uy) + b * uy) * 2 - 1;   // [-1, 1]
    };
  }

  function daySeed() {
    var d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  // ---- the word as an alpha mask ----
  function textMask(text, W, H, baseY, fontPx, xOff) {
    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    var x = c.getContext("2d");
    x.font = fontPx + "px 'Happy Times', serif";
    x.textBaseline = "alphabetic";
    x.fillStyle = "#000";
    x.fillText(text, xOff != null ? xOff : Math.round(W * 0.005), baseY);
    var data = x.getImageData(0, 0, W, H).data;
    return {
      canvas: c,
      at: function (px, py) {
        if (px < 0 || py < 0 || px >= W || py >= H) return 0;
        return data[((py | 0) * W + (px | 0)) * 4 + 3] / 255;
      }
    };
  }

  // ---- one mark: a short shaft with per-segment wander, sometimes retraced ----
  function mark(ctx, m, noise, W, H) {
    var r = rngFor(m.ms);
    var segs = 4 + r.int(0, 6);
    var nx = -m.ty, ny = m.tx;
    var amp = Math.min(m.len * 0.045, m.cap || 1e9) * m.loose;
    var pts = [];
    for (var i = 0; i <= segs; i++) {
      var u = i / segs;
      var px = m.x + m.tx * m.len * u, py = m.y + m.ty * m.len * u;
      var w = noise(px / W * 90 + m.ms % 97, py / H * 90) * amp + (r.rand() - 0.5) * amp * 0.8;
      pts.push([px + nx * w, py + ny * w]);
    }
    // retrace: draw back over part of the shaft, slightly shifted (a worked stroke)
    if (r.bool(0.3)) {
      var back = pts.slice(Math.floor(pts.length * r.range(0.25, 0.55))).reverse();
      for (var k = 0; k < back.length; k++)
        pts.push([back[k][0] + nx * amp * 0.5, back[k][1] + ny * amp * 0.5]);
    }
    ctx.globalAlpha = m.op;
    ctx.globalCompositeOperation = m.blend;
    ctx.strokeStyle = m.col;
    ctx.lineWidth = m.w;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
    ctx.stroke();
  }

  // ---- direction field: blocky quantized regions drifting off one sweep ----
  function makeAngleField(seed, sweep) {
    var n = noiseFor(seed ^ 0xA716);
    return function (nx, ny) {
      var q = Math.floor((n(nx * 3.1, ny * 2.3) + 1) * 2.4);       // 0..4 region index
      var off = [-0.35, 0, 0.42, Math.PI / 2 - 0.2, Math.PI / 2 + 0.25][q % 5];
      return sweep + off + n(nx * 8, ny * 8) * 0.09;
    };
  }

  function buildMarks(mask, W, H, fontPx, seed, count, cx0, cy0, radius) {
    var r = rngFor(seed);
    var noise = noiseFor(seed ^ 0x51DE);
    var sweep = -0.16 + rngFor(seed ^ 0x77).range(-0.1, 0.1);
    var angleAt = makeAngleField(seed, sweep);
    var out = [];
    var tries = count * 7;
    while (out.length < count && tries-- > 0) {
      var px, py;
      if (radius) {                                   // local accumulation near the pointer
        var a = r.rand() * Math.PI * 2, d = Math.sqrt(r.rand()) * radius;
        px = cx0 + Math.cos(a) * d; py = cy0 + Math.sin(a) * d;
      } else {
        px = r.rand() * W; py = r.rand() * H;
      }
      if (mask.at(px, py) < 0.2) continue;
      var ang = angleAt(px / W, py / H);
      var op = r.range(0.11, 0.22), col = INK;
      var roll = r.rand();
      if (roll < 0.08) { col = SANG; op *= r.range(0.45, 0.75); }
      else if (roll < 0.2) { col = PAPER; op *= 0.75; }
      out.push({ x: px, y: py, tx: Math.cos(ang), ty: Math.sin(ang),
        len: fontPx * r.range(0.09, 0.2), col: col, op: op,
        blend: r.bool(0.3) ? "multiply" : "source-over",
        w: fontPx * 0.0045 * r.range(0.9, 2), loose: r.range(0.8, 1.5), ms: r.int(1, 1e9) });
    }
    return out;
  }

  function buildGuides(W, H, baseY, fontPx, seed) {
    var r = rngFor(seed ^ 0x6D1);
    var out = [];
    [baseY, baseY - fontPx * 0.44, baseY - fontPx * 0.72].forEach(function (y) {
      var n = r.int(1, 2);
      for (var i = 0; i < n; i++)
        out.push({ x: -W * 0.01, y: y + r.range(-2, 2), tx: 1, ty: r.range(-0.004, 0.004),
          len: W * r.range(0.85, 1.02), col: INK, op: r.range(0.04, 0.08),
          blend: "source-over", w: fontPx * 0.0024, loose: 1.4, cap: fontPx * 0.01, ms: r.int(1, 1e9) });
    });
    for (var k = 0, kn = r.int(2, 4); k < kn; k++)
      out.push({ x: W * r.range(0.05, 0.9), y: baseY + fontPx * 0.06,
        tx: Math.cos(-1.32), ty: Math.sin(-1.32), len: fontPx * r.range(0.65, 0.95),
        col: INK, op: r.range(0.035, 0.06), blend: "source-over",
        w: fontPx * 0.0022, loose: 1.5, cap: fontPx * 0.012, ms: r.int(1, 1e9) });
    return out;
  }

  // ---------------------------------------------------------------- controller
  function Masthead(canvas) {
    var holder = canvas.parentElement;
    var word = canvas.dataset.word || "Studio";
    var state = null;

    function vertical() { return canvas.dataset.orient === "vertical"; }

    function setup(seed) {
      // in vertical mode the word runs down the rail: the drawing is built on an
      // internal horizontal canvas (length = rail height) and blitted rotated.
      var railW = holder.clientWidth, railH = holder.clientHeight;
      var cssW = vertical() ? railH : railW;
      if (!cssW) return null;
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var probe = document.createElement("canvas").getContext("2d");
      probe.font = "100px 'Happy Times', serif";
      var w100 = probe.measureText(word).width || 300;
      var maxByLen = cssW * 0.94 / (w100 / 100);
      var capH = +(canvas.dataset.cap || 0);
      var fontPx = vertical() ? Math.min(maxByLen, railW * 0.72)
                 : (capH ? Math.min(maxByLen, capH) : Math.min(maxByLen, cssW * 0.35));
      var cssH = fontPx * 1.06;
      var W = Math.round(cssW * dpr), H = Math.round(cssH * dpr), F = fontPx * dpr;
      var baseY = Math.round(F * 0.82);
      var xOff;
      if (vertical()) {
        canvas.width = Math.round(cssH * dpr); canvas.height = W;
        canvas.style.width = cssH + "px"; canvas.style.height = cssW + "px";
      } else {
        // shrink the canvas to the actual text width so a capped title (narrower
        // than its holder) can be centred by its container instead of sitting
        // left-aligned inside a wide box, and centre the word within that box.
        var textCssW = (w100 / 100) * fontPx;
        var fitW = Math.min(cssW, Math.ceil(textCssW + fontPx * 0.14));
        W = Math.round(fitW * dpr);
        xOff = Math.max(0, Math.round((W - textCssW * dpr) / 2));
        canvas.width = W; canvas.height = H;
        canvas.style.height = cssH + "px"; canvas.style.width = fitW + "px";
      }
      var mask = textMask(word, W, H, baseY, F, xOff);
      var sheet = document.createElement("canvas"); sheet.width = W; sheet.height = H;
      return { seed: seed, W: W, H: H, F: F, dpr: dpr, baseY: baseY, mask: mask,
        sheet: sheet, sctx: sheet.getContext("2d"),
        ctx: canvas.getContext("2d"),
        noise: noiseFor(seed ^ 0x51DE),
        guides: buildGuides(W, H, baseY, F, seed),
        budget: 2600 };                               // extra marks the pointer may add
    }

    function blit() {
      var s = state;
      var trimmed = document.createElement("canvas"); trimmed.width = s.W; trimmed.height = s.H;
      var t = trimmed.getContext("2d");
      t.drawImage(s.sheet, 0, 0);
      t.globalCompositeOperation = "destination-in";
      t.drawImage(s.mask.canvas, 0, 0);
      var flat = document.createElement("canvas"); flat.width = s.W; flat.height = s.H;
      var f = flat.getContext("2d");
      f.lineCap = "round"; f.lineJoin = "round";
      for (var i = 0; i < s.guides.length; i++) mark(f, s.guides[i], s.noise, s.W, s.H);
      f.globalAlpha = 1; f.globalCompositeOperation = "source-over";
      f.drawImage(trimmed, 0, 0);
      s.ctx.setTransform(1, 0, 0, 1, 0, 0);
      s.ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (vertical()) {                               // rotate 90° cw: word reads top → bottom
        s.ctx.translate(canvas.width, 0);
        s.ctx.rotate(Math.PI / 2);
      }
      s.ctx.drawImage(flat, 0, 0);
      s.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function drawAll(seed) {
      refreshInks();
      state = setup(seed);
      if (!state) return;
      var s = state;
      var base = buildMarks(s.mask, s.W, s.H, s.F, seed, Math.round(s.W * s.H / (s.F * s.F) * 950));
      var sang = buildMarks(s.mask, s.W, s.H, s.F, seed ^ 0x5A6, Math.round(base.length * 0.22))
        .map(function (m) { m.x += s.F * 0.015; m.y += s.F * 0.01; m.col = SANG; m.op *= 0.5; m.blend = "multiply"; return m; });
      var all = base.concat(sang);
      s.sctx.lineCap = "round"; s.sctx.lineJoin = "round";
      var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        for (var i = 0; i < all.length; i++) mark(s.sctx, all[i], s.noise, s.W, s.H);
        blit();
      } else {
        var i2 = 0, per = Math.max(120, Math.ceil(all.length / 85));
        (function frame() {
          for (var k = i2; k < i2 + per && k < all.length; k++) mark(s.sctx, all[k], s.noise, s.W, s.H);
          i2 += per; blit();
          if (i2 < all.length) requestAnimationFrame(frame);
        })();
      }
      holder.classList.add("mast-drawn");
    }

    // attention accumulates: extra marks land under the pointer, capped
    var pending = false;
    canvas.addEventListener("pointermove", function (e) {
      if (!state || state.budget <= 0 || pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        var s = state;
        var r = canvas.getBoundingClientRect();
        var px, py;
        if (vertical()) {                             // invert the 90° cw rotation
          var vx = (e.clientX - r.left) * (canvas.width / r.width);
          var vy = (e.clientY - r.top) * (canvas.height / r.height);
          px = vy; py = canvas.width - vx;
        } else {
          px = (e.clientX - r.left) * (s.W / r.width);
          py = (e.clientY - r.top) * (s.H / r.height);
        }
        if (s.mask.at(px, py) < 0.05) return;
        var add = buildMarks(s.mask, s.W, s.H, s.F, (s.seed ^ (px * 31 + py * 17)) >>> 0,
          10, px, py, s.F * 0.22);
        s.sctx.lineCap = "round"; s.sctx.lineJoin = "round";
        for (var i = 0; i < add.length; i++) mark(s.sctx, add[i], s.noise, s.W, s.H);
        s.budget -= add.length;
        blit();
      });
    });

    // a click starts a fresh sitting
    canvas.addEventListener("click", function () {
      drawAll((Date.now() % 2147483647) >>> 0);
    });
    canvas.style.cursor = "crosshair";
    canvas.title = "click for a fresh sitting";

    this.draw = function () { drawAll(daySeed()); };
  }

  // ---- draw any element's text as a hatched title -------------------------
  // <h1 data-drawn>title</h1> → canvas alongside; the h1 stays for a11y/no-JS.
  function drawHeading(el) {
    if (el.dataset.drawnDone) return;
    el.dataset.drawnDone = "1";
    var word = el.textContent.trim();
    if (!word || !el.parentNode) return;
    var holder = document.createElement("div");
    holder.className = "drawn-title" + (el.classList.contains("mobile-mast") ? " drawn-mobile" : "");
    var canvas = document.createElement("canvas");
    canvas.dataset.word = word;
    if (el.dataset.cap) canvas.dataset.cap = el.dataset.cap;
    if (el.dataset.orient) canvas.dataset.orient = el.dataset.orient;
    canvas.setAttribute("aria-hidden", "true");
    holder.appendChild(canvas);
    el.parentNode.insertBefore(holder, el);
    holder.appendChild(el);                       // h1 sits inside, hidden once drawn
    var m = new Masthead(canvas);
    var go = function () { m.draw(); };
    go();
    var t;
    addEventListener("resize", function () { clearTimeout(t); t = setTimeout(go, 250); });
    addEventListener("studio-theme", go);
  }

  function init() {
    var run = function () {
      var canvas = document.getElementById("masthead-canvas");
      if (canvas && !canvas.dataset.bound) {
        canvas.dataset.bound = "1";
        var m = new Masthead(canvas);
        var go = function () { m.draw(); };
        go();
        var t;
        addEventListener("resize", function () { clearTimeout(t); t = setTimeout(go, 250); });
        addEventListener("studio-theme", go);
      }
      document.querySelectorAll("[data-drawn]").forEach(drawHeading);
    };
    if (document.fonts && document.fonts.ready) {
      document.fonts.load("100px 'Happy Times'").then(function () { document.fonts.ready.then(run); });
    } else run();
  }

  window.Masthead = { init: init, drawHeading: drawHeading };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
