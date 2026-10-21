/* hesh.js — a hatched 3-D bust seated in the lower-left of the page, watching the cursor.
 * Reuses the studio engine verbatim: CUBIFY (rig/pose, the scanned Lee Perry-Smith bust with the BUST shoulders hook)
 * + TAILLE's comb() burin ruling + the headsees colour-by-facing + CUBIFY's flurry (explode → hold a composition → return).
 * Self-contained & LAZY: loads its own deps after first paint, so it never blocks the page. A pure progressive
 * enhancement — the page is complete without it. Skipped on touch (no cursor) and under prefers-reduced-motion.
 * Markup: <canvas id="hesh" aria-hidden="true"></canvas> somewhere, plus this script. No globals left behind. */
(function () {
  "use strict";
  var mm = window.matchMedia || function () { return { matches: false }; };
  if (mm("(hover: none), (pointer: coarse)").matches) return;      // no cursor to follow → don't ship the engine to phones
  var REDUCE = mm("(prefers-reduced-motion: reduce)").matches;

  var BASE = (document.currentScript ? new URL(".", document.currentScript.src).href : "assets/catalogue/hesh/");
  function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }

  // ---- the look (tuned in the sandbox; the only knobs) ----
  var P = { op: 0.30, sz: 1.20, dens: 5, ox: -0.34, oy: 0.46 };    // presence · figure height · hatch density · lower-left offset
  var BASE_YAW = 14, BASE_PITCH = -2, RANGE_YAW = 30, RANGE_PITCH = 12;

  // ---- constants copied from taille-ext/tools/lab.mjs (headsees) ----
  var HLIGHT = (function () { var l = [-0.5, 0.6, 0.62], n = Math.hypot(l[0], l[1], l[2]); return [l[0] / n, l[1] / n, l[2] / n]; })();
  var DIRS = [[0, -0.35, 0.94], [-0.9, 0.1, 0.42], [0.9, 0.1, 0.42], [0, 0.75, 0.66]].map(function (d) { var l = Math.hypot(d[0], d[1], d[2]); return [d[0] / l, d[1] / l, d[2] / l]; });
  var PALS = [
    ["#0078bf", "#e0407f", "#e8a400", "#009da5"],   // cmyk — the headsees set
    ["#c6402f", "#e0892e", "#b8384f", "#5b3b8f"],   // warm
    ["#1f4fa3", "#2b8f8f", "#3f6fc4", "#3a9a6a"],   // cool
    ["#1b1a1c", "#6a6a6a", "#1b1a1c", "#8a8a8a"]    // graphite
  ];
  var DINK = PALS[0].slice();
  function hexLerp(a, b, t) { var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t), g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t), bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t);
    return "#" + (1 << 24 | r << 16 | g << 8 | bl).toString(16).slice(1); }

  // ---- flurry: explode to a scattered composition, HOLD, reassemble (calm: fixed lean per facet, gentle float) ----
  var FLUR = { spread: 0.52, drift: 0.014, spinMax: 0.38 };
  var TAU = Math.PI * 2, smooth = function (t) { return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t); };
  var flurry = { on: false, t0: 0, DUR: 7000, next: 0 };
  function schedule(now) { flurry.next = now + 45000 + Math.random() * 65000; }   // RARE: every ~45–110s
  function flurryAmount(now) {
    if (!flurry.on) { if (now >= flurry.next) { flurry.on = true; flurry.t0 = now; } return 0; }
    var e = (now - flurry.t0) / flurry.DUR;
    if (e >= 1) { flurry.on = false; schedule(now); return 0; }
    var F = e < 0.24 ? e / 0.24 : e < 0.70 ? 1 : 1 - (e - 0.70) / 0.30;     // ease out · HOLD · ease home
    return smooth(F);
  }

  var canvas, ctx, DPR = 1, T, Cb, rig, booted = false, mx = 0, my = 0;
  function resize() { if (!canvas) return; var W = canvas.clientWidth, H = canvas.clientHeight; canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR); }

  function facets(res, now, t) {
    var S = Math.min(canvas.width, canvas.height) * P.sz;
    var cx = canvas.width * (0.5 + P.ox), cy = canvas.height * (0.5 + P.oy);
    function PX(q) { return { x: cx + q[0] * S, y: cy - q[1] * S }; }
    var breathe = 1 + 0.13 * Math.sin(t * 0.5);
    var pitchPx = (6.0 - (P.dens - 2) * 0.4) / 1000 * S * breathe;
    var F = flurryAmount(now);
    // colour drifts only while a flurry churns; otherwise the steady cmyk set
    if (F > 0.02) { var cyc = t / 7, i0 = Math.floor(cyc) % PALS.length, i1 = (i0 + 1) % PALS.length, ct = cyc - Math.floor(cyc), ce = ct * ct * (3 - 2 * ct);
      for (var ci = 0; ci < 4; ci++) DINK[ci] = hexLerp(PALS[i0][ci], PALS[i1][ci], ce); }
    else { for (var cj = 0; cj < 4; cj++) DINK[cj] = PALS[0][cj]; }

    var ya = (res._yaw) * Math.PI / 180, cyw = Math.cos(ya), syw = Math.sin(ya);
    var bg = getComputedStyle(document.body).backgroundColor;           // the page's real ground → the occluder is invisible on it
    if (!bg || bg === "transparent" || bg === "rgba(0, 0, 0, 0)") bg = getComputedStyle(document.documentElement).getPropertyValue("--paper-deep").trim() || "#fff";

    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.lineCap = "round";
    res.planes.slice().sort(function (a, b) { return (a.z || 0) - (b.z || 0); }).forEach(function (pl) {
      var n = pl.n, nd = n[0] * HLIGHT[0] + n[1] * HLIGHT[1] + n[2] * HLIGHT[2];
      var ang = ((Math.atan2(-n[1], n[0]) * 180 / Math.PI + 37) % 180 + 180) % 180;
      var dark = Math.max(0, Math.min(1, 0.12 + 0.88 * (1 - (0.5 + 0.5 * nd))));
      var hn = [n[0] * cyw - n[2] * syw, n[1], n[0] * syw + n[2] * cyw];
      var bi = 0, bd = -2; for (var i = 0; i < DIRS.length; i++) { var dd = DIRS[i][0] * hn[0] + DIRS[i][1] * hn[1] + DIRS[i][2] * hn[2]; if (dd > bd) { bd = dd; bi = i; } }
      var ink = DINK[bi];

      var screenLoops = pl.loops.map(function (lp) { return lp.map(PX); });
      if (F > 0.001 && screenLoops[0] && screenLoops[0].length) {   // flurry displacement
        var o0 = screenLoops[0], ccx = 0, ccy = 0; for (var ib = 0; ib < o0.length; ib++) { ccx += o0[ib].x; ccy += o0[ib].y; } ccx /= o0.length; ccy /= o0.length;
        var r = Cb.mulberry32(((pl.id | 0) ^ 0x9e3779b1) >>> 0);
        var ang0 = r() * TAU, rad = S * (0.20 + r() * FLUR.spread), freq = 0.18 + r() * 0.22, ph = r() * TAU, orb = S * FLUR.drift, rs1 = r();
        var flx = cx + Math.cos(ang0) * rad + Math.cos(TAU * t * freq + ph) * orb;
        var fly = cy + Math.sin(ang0) * rad + Math.sin(TAU * t * freq * 1.1 + ph) * orb;
        var px_ = ccx + (flx - ccx) * F, py_ = ccy + (fly - ccy) * F;
        var rot = F * (rs1 - 0.5) * 2 * FLUR.spinMax, ca = Math.cos(rot), sa = Math.sin(rot), scl = 1 - F * 0.18;
        screenLoops.forEach(function (poly) { poly.forEach(function (p) { var vx = (p.x - ccx) * scl, vy = (p.y - ccy) * scl; p.x = px_ + vx * ca - vy * sa; p.y = py_ + vx * sa + vy * ca; }); });
      }

      ctx.globalAlpha = 1; ctx.fillStyle = bg; ctx.beginPath();          // occlude interior facets with the page ground
      screenLoops.forEach(function (poly) { poly.forEach(function (p, i) { i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }); ctx.closePath(); });
      ctx.fill("evenodd");

      ctx.globalAlpha = P.op; ctx.strokeStyle = ink; ctx.lineWidth = Math.max(0.5, dark * pitchPx * 0.95);
      screenLoops.forEach(function (poly) { if (poly.length < 3) return;
        var segs = T.comb({ poly: poly, hatch: { mode: "parallel", ang: ang } }, pitchPx, 0.5);
        ctx.beginPath(); for (var s = 0; s < segs.length; s++) { var g = segs[s]; ctx.moveTo(g.ax, g.ay); ctx.lineTo(g.bx, g.by); }
        ctx.stroke(); });
    });
    ctx.globalAlpha = 1;
  }

  var yaw = BASE_YAW, pitch = BASE_PITCH;
  function draw() {
    requestAnimationFrame(draw);
    if (!booted) return;
    var now = performance.now(), t = now / 1000;
    yaw += (BASE_YAW + mx * RANGE_YAW - yaw) * 0.06;
    pitch += (BASE_PITCH + my * RANGE_PITCH - pitch) * 0.06;
    var res = Cb.pose(rig, yaw, pitch); res._yaw = yaw;
    facets(res, now, t);
  }
  function renderStatic() {   // prefers-reduced-motion: one still bust, no tracking, no animation
    var res = Cb.pose(rig, BASE_YAW, BASE_PITCH); res._yaw = BASE_YAW;
    flurry.next = Infinity; facets(res, 0, 0);
  }

  async function boot() {
    canvas = document.getElementById("hesh"); if (!canvas) return;
    ctx = canvas.getContext("2d"); DPR = Math.min(2, window.devicePixelRatio || 1); resize();
    window.addEventListener("resize", resize);
    try {
      await loadScript(BASE + "vendor/meshopt_simplifier.js");
      await loadScript(BASE + "vendor/polygon-clipping.umd.js");
      await loadScript(BASE + "geom.js"); T = window.Taille;
      var cbText = await fetch(BASE + "cubify.js").then(function (r) { return r.text(); });
      var CUT = "yCut -= 0.10;"; if (cbText.split(CUT).length === 2) cbText = cbText.replace(CUT, "yCut = -1e9;");   // BUST: keep shoulders
      (0, eval)(cbText); Cb = window.Cubify;
      var rs = await Promise.all([
        fetch(BASE + "models/head.glb").then(function (r) { return r.arrayBuffer(); }),
        fetch(BASE + "models/canonical_face_model.obj").then(function (r) { return r.text(); }),
        fetch(BASE + "models/features.json").then(function (r) { return r.json(); }),
        window.MeshoptSimplifier.ready
      ]);
      Cb.setSources({ canonical: { objText: rs[1], features: rs[2] }, scan: { glb: rs[0] } });
      rig = Cb.rig({ src: "scan", tris: 600, planeDeg: 12, seed: 7, yaw: 0, pitch: -4 });
      booted = true;
      window.addEventListener("mousemove", function (e) { mx = (e.clientX / window.innerWidth) * 2 - 1; my = (e.clientY / window.innerHeight) * 2 - 1; });
      schedule(performance.now());
      if (REDUCE) renderStatic(); else requestAnimationFrame(draw);
    } catch (e) { /* stay invisible on any failure — the page is fine without it */ }
  }

  function start() { ("requestIdleCallback" in window) ? requestIdleCallback(boot, { timeout: 2500 }) : setTimeout(boot, 1200); }
  if (document.readyState === "complete") start(); else window.addEventListener("load", start);
})();
