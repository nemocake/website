/* cubify.js — CUBIFY. Procedurally cube a face. One implementation for browser and node (no imports:
 * expects the globals MeshoptSimplifier (vendor/meshopt_simplifier.js, its `ready` promise awaited by the
 * caller) and polygonClipping (vendor/polygon-clipping.umd.js)).
 * ===========================================================================
 * The law: a cubist plane is a facet of a solid seen from one angle. So the regions come from a 3-D head,
 * never from cutting a 2-D shape: a source mesh (the MediaPipe canonical face — 468 vertices, the average
 * face — or a scanned head) → a seeded IDENTITY WARP (jaw, chin, brow, nose, eye spacing, width, a shear,
 * a low-frequency wobble) → meshoptimizer decimation to N triangles (N is the cubism dial: ~80 synthetic,
 * ~150 the sweet spot, 300+ analytic) → turn + orthographic projection → front-facing triangles region-grown
 * into PLANES by normal similarity (John Asaro's planes of the head, computed instead of sculpted) → each
 * plane's outline as the exact polygon union of its triangles → the eyes, brows and lips (MediaPipe's own
 * vertex loops) subtracted from the planes so they are regions of their own.
 *   Cubify.setSources({canonical:{objText, features}, scan:{glb}})  — parse + normalise once
 *   Cubify.build(opts) → { planes[{n,area,tris,loops}], feats[{role,poly}], silhouette, meta }   (synchronous)
 *   Cubify.draw(ctx, res, {W,H,palette,light,stroke})  — flat colour by plane normal, the paint-ready map
 *   Cubify.verify(res) → the numbers
 * ===========================================================================*/
(function(root){
  'use strict';
  var DEF = {
    seed: 1, src: 'canonical', tris: 150, planeDeg: 22, yaw: -22, pitch: -3,
    width: 0, jaw: 0, chin: 0, brow: 0, nose: 0, eyes: 0, asym: 0, wobble: 0,
    lightX: -0.5, lightY: 0.6, lightZ: 0.62, stroke: 2.5, features: 1, fill: 'planes'
  };
  // paper · ink · the chord (dark → light by how much a plane faces the light) · feature fills
  function PAL(name, paper, ink, chord, lip, eye){ return { name: name, paper: paper, ink: ink, chord: chord, lip: lip, eye: eye }; }
  var PALETTES = {
    primaries: PAL('primaries · the reference', '#cdbf9a', '#1a1612', ['#1f2a44', '#3a5ea4', '#e8b81f', '#d23a2c', '#efe4c8', '#2f6b4f'], '#d23a2c', '#efe4c8'),
    picasso:   PAL('picasso · 1937',           '#d9cfb6', '#1b1e2a', ['#1b1e2a', '#2b6f8f', '#d6b24a', '#c7462f', '#f0e7d2', '#4d8a5c', '#e4907c'], '#c7462f', '#f0e7d2'),
    bauhaus:   PAL('bauhaus',                  '#f4f1ea', '#111111', ['#111111', '#0057a8', '#e32219', '#f2c318', '#f4f1ea', '#5a5a5a'], '#e32219', '#f4f1ea'),
    flesh:     PAL('flesh · planes study',     '#efe7d5', '#2b1d1a', ['#2b1d1a', '#6b3b30', '#a86a4e', '#d99c78', '#efd2b3', '#f7ead8'], '#a8453a', '#f7ead8'),
    gray:      PAL('black on gray · 1969',     '#e8e4da', '#1d1b18', ['#1d1b18', '#4a4844', '#8b857b', '#b5afa3', '#cfcabf', '#e8e4da'], '#4a4844', '#e8e4da'),
    rothko14:  PAL('rothko · no. 14',          '#efe4c8', '#1c2740', ['#1c2740', '#25345a', '#4a3a58', '#c33a28', '#e8b93a', '#efe4c8'], '#c33a28', '#efe4c8'),
    mbg:       PAL('rothko · mbg on orange',   '#de6b2c', '#17130f', ['#17130f', '#456f4a', '#b93a66', '#e07b2a', '#e8b93a', '#efe4c8'], '#b93a66', '#efe4c8'),
    seagram:   PAL('rothko · seagram',         '#e9dccb', '#241012', ['#241012', '#3a1618', '#5c2426', '#6e2a2a', '#8a2a24', '#c9a68c'], '#8a2a24', '#c9a68c'),
    night:     PAL('night · light on dark',    '#1c1b1e', '#e6dfcf', ['#2a2830', '#3d4a6b', '#7d6a9a', '#c26a4a', '#e0b45c', '#efe4c8'], '#c26a4a', '#efe4c8'),
    ink:       PAL('ink · two tones',          '#f1eee6', '#161616', ['#161616', '#161616', '#5a5a5a', '#f1eee6', '#f1eee6', '#f1eee6'], '#161616', '#f1eee6'),
    // — chords ramped dark→light from tablature's paint-ground palette library (paper/wash/cloud/ink/prims) —
    venetian:  PAL('venetian · earth',          '#cfb9a0', '#241e1c', ['#241e1c', '#5c3e2e', '#8f6a4e', '#b89a7c', '#cfb9a0', '#e6d8c4'], '#b52a1c', '#e6d8c4'),
    terra:     PAL('terra · burnt sienna',      '#c98d5f', '#231c16', ['#231c16', '#5a3420', '#8f5a38', '#b57a4e', '#c98d5f', '#e0b48a'], '#8f1d12', '#e0b48a'),
    baconDyer: PAL('bacon · dyer',              '#423536', '#e8e2d8', ['#211a1b', '#423536', '#6a5652', '#8a726d', '#a48480', '#ea9bb6'], '#ea9bb6', '#e8e2d8'),
    bacon46:   PAL('bacon · 1946',              '#100a06', '#f5a438', ['#100a06', '#3a2a14', '#654e2c', '#8f6f3e', '#b28f62', '#f5a438'], '#f5a438', '#dcbb89'),
    rustblue:  PAL('rothko · rust on blue',     '#5e7c90', '#e6ddc9', ['#16202a', '#2c3c4c', '#4e6e84', '#7a6a5a', '#9a5a3c', '#d9c9a8'], '#9a5a3c', '#d9c9a8'),
    forest:    PAL('forest floor',              '#1e2a1c', '#e2dcc4', ['#111a10', '#1e2a1c', '#33452c', '#5a6a3e', '#8a9a5b', '#d9cba8'], '#c8a03a', '#d9cba8'),
    terreverte:PAL('terre verte',               '#dfe0cf', '#2a3326', ['#2a3326', '#4a5c39', '#5a7247', '#7c8f5c', '#9cad7e', '#c3cf98'], '#8a4a30', '#e4e6d2'),
    cadmium:   PAL('cadmium yellow',            '#f2d81f', '#26200a', ['#26200a', '#6a5a10', '#a88f16', '#d0b41e', '#eed234', '#f9e75c'], '#c62a1c', '#f4efe2'),
    verdigris: PAL('verdigris',                 '#14201c', '#e4e2cf', ['#0c1210', '#14201c', '#2f4a40', '#4a6656', '#7a9a86', '#c8daca'], '#c8a03a', '#c8daca'),
    klimt:     PAL('the kiss · gold',           '#d8b04a', '#241a0c', ['#241a0c', '#5a4210', '#8a6816', '#a87f24', '#d8b04a', '#efdca0'], '#a81f2a', '#f2e6bb')
  };
  var PAL_KEYS = Object.keys(PALETTES);

  // ---------- rng ----------
  function mulberry32(seed){ var a = seed >>> 0; return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---------- sources ----------
  function parseObj(text){ var pos = [], idx = [], lines = text.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++){ var line = lines[i]; if (line.indexOf('v ') === 0){ var p = line.split(/\s+/); pos.push(+p[1], +p[2], +p[3]); } else if (line.indexOf('f ') === 0){ var f = line.split(/\s+/).slice(1).map(function(t){ return parseInt(t.split('/')[0], 10) - 1; }); for (var k = 1; k + 1 < f.length; k++) idx.push(f[0], f[k], f[k + 1]); } }
    return { pos: Float32Array.from(pos), idx: Uint32Array.from(idx), name: 'canonical' }; }
  function parseGlb(buf){ var dv = new DataView(buf); var jl = dv.getUint32(12, true); var json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jl))); var bl = dv.getUint32(20 + jl, true); var binOff = 28 + jl;
    var acc = function(i){ var a = json.accessors[i], bv = json.bufferViews[a.bufferView]; var off = binOff + (bv.byteOffset || 0) + (a.byteOffset || 0); var n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type] * a.count;
      if (a.componentType === 5126) return new Float32Array(buf, off, n); if (a.componentType === 5123) return new Uint16Array(buf, off, n); if (a.componentType === 5125) return new Uint32Array(buf, off, n); throw new Error('componentType ' + a.componentType); };
    var mesh = json.meshes[0], prim = mesh.primitives[0]; var pos = Float32Array.from(acc(prim.attributes.POSITION)), idx = Uint32Array.from(acc(prim.indices));
    var nodeIdx = -1; for (var ni = 0; ni < json.nodes.length; ni++) if (json.nodes[ni].mesh === 0){ nodeIdx = ni; break; }
    var chain = [], cur = nodeIdx; while (cur >= 0){ chain.unshift(json.nodes[cur]); var par = -1; for (var pi = 0; pi < json.nodes.length; pi++) if ((json.nodes[pi].children || []).indexOf(cur) >= 0){ par = pi; break; } cur = par; }
    chain.forEach(function(n){ var t = n.translation || [0, 0, 0], r = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1];
      for (var i = 0; i < pos.length; i += 3){ var x = pos[i] * s[0], y = pos[i + 1] * s[1], z = pos[i + 2] * s[2]; var qx = r[0], qy = r[1], qz = r[2], qw = r[3];
        var ix = qw * x + qy * z - qz * y, iy = qw * y + qz * x - qx * z, iz = qw * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z;
        x = ix * qw + iw * -qx + iy * -qz - iz * -qy; y = iy * qw + iw * -qy + iz * -qx - ix * -qz; z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
        pos[i] = x + t[0]; pos[i + 1] = y + t[1]; pos[i + 2] = z + t[2]; } });
    return { pos: pos, idx: idx, name: mesh.name || 'scan' }; }
  function normalise(m, idxSubset){ var mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], used = idxSubset ? new Set(idxSubset) : null;
    for (var i = 0; i < m.pos.length / 3; i++){ if (used && !used.has(i)) continue; for (var k = 0; k < 3; k++){ mn[k] = Math.min(mn[k], m.pos[i * 3 + k]); mx[k] = Math.max(mx[k], m.pos[i * 3 + k]); } }
    var c = [0, 1, 2].map(function(k){ return (mn[k] + mx[k]) / 2; }), sc = 1 / (mx[1] - mn[1]);
    for (var j = 0; j < m.pos.length; j += 3) for (var k2 = 0; k2 < 3; k2++) m.pos[j + k2] = (m.pos[j + k2] - c[k2]) * sc; }
  var SRC = {};
  function setSources(s){
    if (s.canonical){ var m = parseObj(s.canonical.objText); normalise(m); m.feat = s.canonical.features || null; SRC.canonical = m; }
    if (s.scan){ var g = parseGlb(s.scan.glb); normalise(g);
      // crop at the neck: the narrowest x-slice between y=-0.30 and 0.20, then a little below it
      var SL = 40, lo = new Float64Array(SL).fill(1e9), hi = new Float64Array(SL).fill(-1e9);
      for (var i = 0; i < g.pos.length; i += 3){ var y = g.pos[i + 1]; if (y < -0.30 || y > 0.20) continue; var sl = Math.min(SL - 1, Math.floor((y + 0.30) / 0.50 * SL)); lo[sl] = Math.min(lo[sl], g.pos[i]); hi[sl] = Math.max(hi[sl], g.pos[i]); }
      var yCut = -0.30, best = 1e9; for (var q = 0; q < SL; q++){ var w = hi[q] - lo[q]; if (w > 0 && w < best){ best = w; yCut = -0.30 + (q + 0.5) / SL * 0.50; } } yCut -= 0.10;
      var keep = []; for (var t = 0; t < g.idx.length; t += 3){ var a = g.idx[t], b = g.idx[t + 1], cc = g.idx[t + 2]; if (g.pos[a * 3 + 1] > yCut && g.pos[b * 3 + 1] > yCut && g.pos[cc * 3 + 1] > yCut) keep.push(a, b, cc); }
      g.idx = Uint32Array.from(keep); normalise(g, g.idx); g.feat = null; g.yCut = yCut; SRC.scan = g; }
  }

  // ---------- the identity warp ----------
  function warp(pos0, o, rng){ var pos = Float32Array.from(pos0), n = pos.length / 3, zmax = -1e9, i;
    for (i = 0; i < n; i++) zmax = Math.max(zmax, pos[i * 3 + 2]);
    var ph = [rng() * 6.28, rng() * 6.28, rng() * 6.28, rng() * 6.28];
    for (i = 0; i < n; i++){ var x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      x *= 1 + o.width * 0.35;
      if (y < 0) x *= 1 + o.jaw * 0.5 * Math.pow(-y * 2, 1.4);
      if (y < -0.15) y += o.chin * 0.6 * (y + 0.15);
      if (y > 0.10) y += o.brow * 0.5 * (y - 0.10);
      if (z > zmax - 0.28 && Math.abs(x) < 0.16 && y > -0.25 && y < 0.2) z += o.nose * 0.22 * ((z - (zmax - 0.28)) / 0.28);
      if (y > 0.0 && y < 0.28) x *= 1 + o.eyes * 0.35 * Math.sin(y / 0.28 * Math.PI);
      x += o.asym * 0.12 * y;
      var w = o.wobble * 0.05; x += w * Math.sin(y * 4.1 + ph[0]) * Math.cos(z * 2.3 + ph[1]); y += w * Math.sin(x * 3.7 + ph[2]) * 0.6; z += w * Math.cos(y * 3.3 + ph[3]) * Math.sin(x * 2.9);
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; }
    return pos; }

  // ---------- build ----------
  function build(opts){
    var o = Object.assign({}, DEF, opts || {}); var rng = mulberry32((o.seed >>> 0) || 1);
    var src = SRC[o.src] || SRC.canonical; if (!src) throw new Error('Cubify.setSources first');
    var P = warp(src.pos, o, rng);
    var target = Math.max(12, Math.round(o.tris)) * 3, mode = 'simplify';
    var r = MeshoptSimplifier.simplify(src.idx, P, 3, target, 1.0, ['LockBorder']); var simpIdx = r[0], err = r[1];
    if (simpIdx.length > target * 1.5){ r = MeshoptSimplifier.simplifySloppy(src.idx, P, 3, target, 1.0); simpIdx = r[0]; err = r[1]; mode = 'sloppy'; }
    var nT = simpIdx.length / 3, yaw = o.yaw * Math.PI / 180, pitch = o.pitch * Math.PI / 180;
    var rot = function(i){ var x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; var x2 = x * Math.cos(yaw) + z * Math.sin(yaw), z2 = -x * Math.sin(yaw) + z * Math.cos(yaw); x = x2; z = z2; var y2 = y * Math.cos(pitch) - z * Math.sin(pitch), z3 = y * Math.sin(pitch) + z * Math.cos(pitch); return [x, y2, z3]; };
    var R = new Array(P.length / 3); for (var vi = 0; vi < R.length; vi++) R[vi] = rot(vi);
    var T = [];
    for (var t = 0; t < nT; t++){ var a = simpIdx[t * 3], b = simpIdx[t * 3 + 1], cc = simpIdx[t * 3 + 2]; var A = R[a], B = R[b], C = R[cc];
      var u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      var nv = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; var L = Math.hypot(nv[0], nv[1], nv[2]) || 1; var nn = [nv[0] / L, nv[1] / L, nv[2] / L];
      if (nn[2] <= 0.02) continue; T.push({ v: [a, b, cc], n: nn, area2d: Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2 }); }
    // planes by normal region-growing, seeded from the largest triangles
    var cosT = Math.cos(o.planeDeg * Math.PI / 180), edgeKey = function(p, q){ return p < q ? p + '_' + q : q + '_' + p; };
    var edgeTris = new Map(); T.forEach(function(tr, i){ for (var k = 0; k < 3; k++){ var e = edgeKey(tr.v[k], tr.v[(k + 1) % 3]); if (!edgeTris.has(e)) edgeTris.set(e, []); edgeTris.get(e).push(i); } });
    var nbrs = T.map(function(){ return []; }); edgeTris.forEach(function(arr){ if (arr.length === 2){ nbrs[arr[0]].push(arr[1]); nbrs[arr[1]].push(arr[0]); } });
    var region = new Int32Array(T.length).fill(-1), regions = [];
    T.map(function(tr, i){ return i; }).sort(function(p, q){ return T[q].area2d - T[p].area2d; }).forEach(function(s){ if (region[s] >= 0) return; var id = regions.length; var reg = { tris: [s], n: T[s].n.slice(), area: T[s].area2d }; region[s] = id; var qq = [s];
      while (qq.length){ var tt = qq.shift(); for (var mi = 0; mi < nbrs[tt].length; mi++){ var m = nbrs[tt][mi]; if (region[m] >= 0) continue; var d = reg.n[0] * T[m].n[0] + reg.n[1] * T[m].n[1] + reg.n[2] * T[m].n[2];
        if (d >= cosT){ region[m] = id; reg.tris.push(m); qq.push(m); var wa = T[m].area2d; reg.n = reg.n.map(function(v, k){ return v * reg.area + T[m].n[k] * wa; }); var LL = Math.hypot(reg.n[0], reg.n[1], reg.n[2]) || 1; reg.n = reg.n.map(function(v){ return v / LL; }); reg.area += wa; } } }
      regions.push(reg); });
    // outlines = polygon union of the triangles; features = MediaPipe loops, subtracted
    var tri2d = function(ti){ var tr = T[ti]; var ring = tr.v.map(function(v){ return [R[v][0], R[v][1]]; }); var ar = (ring[1][0] - ring[0][0]) * (ring[2][1] - ring[0][1]) - (ring[2][0] - ring[0][0]) * (ring[1][1] - ring[0][1]); if (ar < 0) ring.reverse(); ring.push(ring[0]); return [ring]; };
    var feats = [];
    if (src.feat && o.features){ var ringOf = function(loop){ var rr = loop.map(function(v){ return [R[v][0], R[v][1]]; }); var ar = 0; for (var i = 0; i < rr.length; i++){ var p = rr[i], q = rr[(i + 1) % rr.length]; ar += p[0] * q[1] - q[0] * p[1]; } if (ar < 0) rr.reverse(); rr.push(rr[0]); return [rr]; };
      var F = src.feat, add = function(role, loop){ if (loop && loop.length >= 3) feats.push({ role: role, poly: ringOf(loop) }); };
      add('lips', F.LIPS[0]); add('mouth', F.LIPS[1]); add('eye', F.LEFT_EYE[0]); add('eye', F.RIGHT_EYE[0]);
      add('brow', F.LEFT_EYEBROW[0].concat(F.LEFT_EYEBROW[1].slice().reverse())); add('brow', F.RIGHT_EYEBROW[0].concat(F.RIGHT_EYEBROW[1].slice().reverse())); }
    var rings = function(mp){ var out = []; for (var pi = 0; pi < mp.length; pi++) for (var ri = 0; ri < mp[pi].length; ri++){ var rr2 = mp[pi][ri].slice(0, -1); if (rr2.length >= 3) out.push(rr2); } return out; };
    var planes = regions.map(function(reg, i){ var acc; try { acc = polygonClipping.union.apply(null, reg.tris.map(tri2d)); } catch (e){ acc = []; }
      for (var fi = 0; fi < feats.length; fi++) if (feats[fi].role !== 'mouth'){ try { acc = polygonClipping.difference(acc, feats[fi].poly); } catch (e2) {} }
      var z = 0; reg.tris.forEach(function(ti){ var v = T[ti].v; z += (R[v[0]][2] + R[v[1]][2] + R[v[2]][2]) / 3; }); z /= reg.tris.length;   // depth, so the nose paints over the cheek it occludes
      return { id: i, n: reg.n, area: reg.area, z: z, tris: reg.tris.length, loops: rings(acc) }; }).filter(function(p){ return p.loops.length; });
    var silhouette = []; try { silhouette = polygonClipping.union.apply(null, T.map(function(tr, i){ return tri2d(i); })).map(function(poly){ return poly[0].slice(0, -1); }); } catch (e3) {}
    return { planes: planes, feats: feats, silhouette: silhouette, meta: { seed: o.seed, src: src.name, srcTris: src.idx.length / 3, tris: nT, mode: mode, error: +err.toFixed(4), front: T.length, planes: planes.length, features: feats.length, opts: o } };
  }

  // ---------- rig + pose: a REAL 3D turn with FROZEN topology ----------
  // build() region-grows AFTER rotating, so re-calling it per yaw re-pops the facets. rig() freezes the
  // triangle→plane grouping once at the base pose and keeps the deformed 3D vertices; pose() rotates those 3D
  // triangles to any yaw/pitch and re-projects with the SAME grouping — the head genuinely turns, no flicker,
  // and each frame's plane normals are exact (so colour-as-lighting is correct).
  function rig(opts){
    var o = Object.assign({}, DEF, opts || {}); var rng = mulberry32((o.seed >>> 0) || 1);
    var src = SRC[o.src] || SRC.canonical; if (!src) throw new Error('Cubify.setSources first');
    var P = warp(src.pos, o, rng);
    var target = Math.max(12, Math.round(o.tris)) * 3, mode = 'simplify';
    var r = MeshoptSimplifier.simplify(src.idx, P, 3, target, 1.0, ['LockBorder']); var simpIdx = r[0], err = r[1];
    if (simpIdx.length > target * 1.5){ r = MeshoptSimplifier.simplifySloppy(src.idx, P, 3, target, 1.0); simpIdx = r[0]; err = r[1]; mode = 'sloppy'; }
    var nT = simpIdx.length / 3, yaw = o.yaw * Math.PI / 180, pitch = o.pitch * Math.PI / 180;
    var rot = function(i){ var x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; var x2 = x * Math.cos(yaw) + z * Math.sin(yaw), z2 = -x * Math.sin(yaw) + z * Math.cos(yaw); x = x2; z = z2; var y2 = y * Math.cos(pitch) - z * Math.sin(pitch), z3 = y * Math.sin(pitch) + z * Math.cos(pitch); return [x, y2, z3]; };
    var R = new Array(P.length / 3); for (var vi = 0; vi < R.length; vi++) R[vi] = rot(vi);
    var T = [];
    for (var t = 0; t < nT; t++){ var a = simpIdx[t * 3], b = simpIdx[t * 3 + 1], cc = simpIdx[t * 3 + 2]; var A = R[a], B = R[b], C = R[cc];
      var u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      var nv = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; var L = Math.hypot(nv[0], nv[1], nv[2]) || 1; var nn = [nv[0] / L, nv[1] / L, nv[2] / L];
      if (nn[2] <= 0.02) continue; T.push({ v: [a, b, cc], n: nn, area2d: Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2 }); }
    var cosT = Math.cos(o.planeDeg * Math.PI / 180), edgeKey = function(p, q){ return p < q ? p + '_' + q : q + '_' + p; };
    var edgeTris = new Map(); T.forEach(function(tr, i){ for (var k = 0; k < 3; k++){ var e = edgeKey(tr.v[k], tr.v[(k + 1) % 3]); if (!edgeTris.has(e)) edgeTris.set(e, []); edgeTris.get(e).push(i); } });
    var nbrs = T.map(function(){ return []; }); edgeTris.forEach(function(arr){ if (arr.length === 2){ nbrs[arr[0]].push(arr[1]); nbrs[arr[1]].push(arr[0]); } });
    var region = new Int32Array(T.length).fill(-1), regions = [];
    T.map(function(tr, i){ return i; }).sort(function(p, q){ return T[q].area2d - T[p].area2d; }).forEach(function(s){ if (region[s] >= 0) return; var id = regions.length; var reg = { tris: [s], n: T[s].n.slice(), area: T[s].area2d }; region[s] = id; var qq = [s];
      while (qq.length){ var tt = qq.shift(); for (var mi = 0; mi < nbrs[tt].length; mi++){ var m = nbrs[tt][mi]; if (region[m] >= 0) continue; var d = reg.n[0] * T[m].n[0] + reg.n[1] * T[m].n[1] + reg.n[2] * T[m].n[2];
        if (d >= cosT){ region[m] = id; reg.tris.push(m); qq.push(m); var wa = T[m].area2d; reg.n = reg.n.map(function(v, k){ return v * reg.area + T[m].n[k] * wa; }); var LL = Math.hypot(reg.n[0], reg.n[1], reg.n[2]) || 1; reg.n = reg.n.map(function(v){ return v / LL; }); reg.area += wa; } } }
      regions.push(reg); });
    var planeTris = regions.map(function(reg){ return reg.tris.map(function(ti){ return T[ti].v; }); });   // per-plane triangle vertex-index triples (into P)
    var allTris = T.map(function(tr){ return tr.v; });
    var featLoops = [];
    if (src.feat && o.features){ var F = src.feat, add = function(role, loop){ if (loop && loop.length >= 3) featLoops.push({ role: role, loop: loop }); };
      add('lips', F.LIPS[0]); add('mouth', F.LIPS[1]); add('eye', F.LEFT_EYE[0]); add('eye', F.RIGHT_EYE[0]);
      add('brow', F.LEFT_EYEBROW[0].concat(F.LEFT_EYEBROW[1].slice().reverse())); add('brow', F.RIGHT_EYEBROW[0].concat(F.RIGHT_EYEBROW[1].slice().reverse())); }
    return { P: P, planeTris: planeTris, allTris: allTris, featLoops: featLoops, meta: { seed: o.seed, src: src.name, tris: nT, mode: mode, planes: planeTris.length } };
  }

  function pose(rg, yawDeg, pitchDeg){
    var P = rg.P, yaw = yawDeg * Math.PI / 180, pitch = pitchDeg * Math.PI / 180;
    var rot = function(i){ var x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; var x2 = x * Math.cos(yaw) + z * Math.sin(yaw), z2 = -x * Math.sin(yaw) + z * Math.cos(yaw); x = x2; z = z2; var y2 = y * Math.cos(pitch) - z * Math.sin(pitch), z3 = y * Math.sin(pitch) + z * Math.cos(pitch); return [x, y2, z3]; };
    var R = new Array(P.length / 3); for (var vi = 0; vi < R.length; vi++) R[vi] = rot(vi);
    function ring2d(v){ var ring = [[R[v[0]][0], R[v[0]][1]], [R[v[1]][0], R[v[1]][1]], [R[v[2]][0], R[v[2]][1]]]; var ar = (ring[1][0] - ring[0][0]) * (ring[2][1] - ring[0][1]) - (ring[2][0] - ring[0][0]) * (ring[1][1] - ring[0][1]); if (ar < 0) ring.reverse(); ring.push(ring[0]); return [ring]; }
    function triNormal(v){ var A = R[v[0]], B = R[v[1]], C = R[v[2]]; var u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      var nv = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; var L = Math.hypot(nv[0], nv[1], nv[2]) || 1; return [nv[0] / L, nv[1] / L, nv[2] / L]; }
    function tri2dArea(v){ var A = R[v[0]], B = R[v[1]], C = R[v[2]]; return Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2; }
    var rings = function(mp){ var out = []; for (var pi = 0; pi < mp.length; pi++) for (var ri = 0; ri < mp[pi].length; ri++){ var rr2 = mp[pi][ri].slice(0, -1); if (rr2.length >= 3) out.push(rr2); } return out; };
    var feats = rg.featLoops.map(function(ft){ var rr = ft.loop.map(function(idx){ return [R[idx][0], R[idx][1]]; }); var ar = 0; for (var i = 0; i < rr.length; i++){ var p = rr[i], q = rr[(i + 1) % rr.length]; ar += p[0] * q[1] - q[0] * p[1]; } if (ar < 0) rr.reverse(); rr.push(rr[0]); return { role: ft.role, poly: [rr] }; });
    var planes = rg.planeTris.map(function(triV, i){
      var front = triV.filter(function(v){ return triNormal(v)[2] > 0; });   // back-faces turn away → drop (real occlusion)
      if (!front.length) return null;
      var acc; try { acc = polygonClipping.union.apply(null, front.map(ring2d)); } catch (e){ acc = []; }
      for (var fi = 0; fi < feats.length; fi++) if (feats[fi].role !== 'mouth'){ try { acc = polygonClipping.difference(acc, feats[fi].poly); } catch (e2) {} }
      var n = [0, 0, 0], area = 0, z = 0; front.forEach(function(v){ var a2 = tri2dArea(v), nn = triNormal(v); n[0] += nn[0] * a2; n[1] += nn[1] * a2; n[2] += nn[2] * a2; area += a2; z += (R[v[0]][2] + R[v[1]][2] + R[v[2]][2]) / 3; });
      var LL = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / LL, n[1] / LL, n[2] / LL]; z /= front.length;
      return { id: i, n: n, area: area, z: z, loops: rings(acc) };
    }).filter(function(p){ return p && p.loops.length; });
    var silhouette = []; try { var frontAll = rg.allTris.filter(function(v){ return triNormal(v)[2] > 0; }); silhouette = polygonClipping.union.apply(null, frontAll.map(ring2d)).map(function(poly){ return poly[0].slice(0, -1); }); } catch (e3) {}
    return { planes: planes, feats: feats, silhouette: silhouette };
  }

  // ---------- draw ----------
  function frame(res, W, H){ var bx = [1e9, 1e9, -1e9, -1e9]; res.silhouette.forEach(function(l){ l.forEach(function(q){ bx[0] = Math.min(bx[0], q[0]); bx[1] = Math.min(bx[1], q[1]); bx[2] = Math.max(bx[2], q[0]); bx[3] = Math.max(bx[3], q[1]); }); });
    if (!isFinite(bx[0])) bx = [-0.5, -0.5, 0.5, 0.5];
    var span = Math.max(bx[2] - bx[0], (bx[3] - bx[1]) * W / H) * 1.10, S = W / span; var ox = W / 2 - (bx[0] + bx[2]) / 2 * S, oy = H / 2 + (bx[1] + bx[3]) / 2 * S;
    return { X: function(q){ return ox + q[0] * S; }, Y: function(q){ return oy - q[1] * S; }, S: S }; }
  function draw(ctx, res, d){
    var dd = {}; Object.keys(d || {}).forEach(function(k){ if (d[k] !== undefined && d[k] !== null && !(typeof d[k] === 'number' && isNaN(d[k]))) dd[k] = d[k]; });   // never let an undefined option shadow a default
    d = Object.assign({ W: 1000, H: 1000, palette: 'primaries', stroke: DEF.stroke, lightX: DEF.lightX, lightY: DEF.lightY, lightZ: DEF.lightZ, fill: DEF.fill }, dd);
    var pal = PALETTES[d.palette] || PALETTES.primaries, W = d.W, H = d.H, f = frame(res, W, H), X = f.X, Y = f.Y;
    var key = [d.lightX, d.lightY, d.lightZ], kl = Math.hypot(key[0], key[1], key[2]) || 1; key = key.map(function(v){ return v / kl; });
    var chord = pal.chord, hex = function(n){ var lam = Math.max(0, n[0] * key[0] + n[1] * key[1] + n[2] * key[2]); return chord[Math.min(chord.length - 1, Math.floor(lam * chord.length))]; };
    var sc = W / 1000, stroke = d.stroke * sc;
    ctx.fillStyle = pal.paper; ctx.fillRect(0, 0, W, H); ctx.lineJoin = 'round';
    var path = function(loops){ ctx.beginPath(); loops.forEach(function(l){ l.forEach(function(q, i){ if (i) ctx.lineTo(X(q), Y(q)); else ctx.moveTo(X(q), Y(q)); }); ctx.closePath(); }); };
    res.planes.slice().sort(function(a, b){ return (a.z || 0) - (b.z || 0); }).forEach(function(p, i){ path(p.loops);   // far planes first: a projected overlap resolves as occlusion
      ctx.fillStyle = d.fill === 'index' ? chord[i % chord.length] : d.fill === 'paper' ? pal.paper : hex(p.n); ctx.fill('evenodd'); if (stroke > 0){ ctx.strokeStyle = pal.ink; ctx.lineWidth = stroke; ctx.stroke(); } });
    var FF = { lips: pal.lip, mouth: pal.ink, eye: pal.eye, brow: pal.ink };
    res.feats.forEach(function(ft){ path(ft.poly.map(function(r){ return r.slice(0, -1); })); ctx.fillStyle = FF[ft.role]; ctx.fill(); if (stroke > 0){ ctx.strokeStyle = pal.ink; ctx.lineWidth = stroke; ctx.stroke(); } });
    if (stroke > 0){ ctx.strokeStyle = pal.ink; ctx.lineWidth = stroke * 2; path(res.silhouette); ctx.stroke(); }
    return { W: W, H: H, scale: f.S };
  }

  // ---------- verify ----------
  function signedArea(l){ var s = 0; for (var i = 0; i < l.length; i++){ var p = l[i], q = l[(i + 1) % l.length]; s += p[0] * q[1] - q[0] * p[1]; } return s / 2; }   // polygon-clipping: outer rings positive, holes negative
  function polyArea(l){ return Math.abs(signedArea(l)); }
  function verify(res){ var nonfinite = 0, planeArea = 0, minPlane = 1e9, maxPlane = 0, emptyPlanes = 0;
    res.planes.forEach(function(p){ var a = 0; p.loops.forEach(function(l){ a += signedArea(l); l.forEach(function(q){ if (!isFinite(q[0]) || !isFinite(q[1])) nonfinite++; }); }); if (a <= 1e-9) emptyPlanes++; planeArea += Math.abs(a); minPlane = Math.min(minPlane, Math.abs(a)); maxPlane = Math.max(maxPlane, Math.abs(a)); });
    var silArea = 0; res.silhouette.forEach(function(l){ silArea += polyArea(l); });
    var featArea = 0; res.feats.forEach(function(f){ if (f.role !== 'mouth') featArea += polyArea(f.poly[0].slice(0, -1)); });
    return { planes: res.planes.length, features: res.feats.length, tris: res.meta.tris, front: res.meta.front, mode: res.meta.mode, nonfinite: nonfinite, emptyPlanes: emptyPlanes,
      coverage: silArea > 0 ? +((planeArea + featArea) / silArea).toFixed(4) : 0, minPlaneFrac: silArea > 0 ? +(minPlane / silArea).toFixed(5) : 0, maxPlaneFrac: silArea > 0 ? +(maxPlane / silArea).toFixed(4) : 0 }; }

  root.Cubify = { DEF: DEF, PALETTES: PALETTES, PAL_KEYS: PAL_KEYS, setSources: setSources, parseObj: parseObj, parseGlb: parseGlb, build: build, rig: rig, pose: pose, draw: draw, layout: frame, verify: verify, mulberry32: mulberry32 };
})(typeof window !== 'undefined' ? window : globalThis);
