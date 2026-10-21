/* geom.js — TAILLE. The BONES and the COMBS, pure (no canvas), node-tested.
 * ===========================================================================
 * After Claude Mellan's taille-douce: one family of parallel burin lines,
 * NO cross-hatching, NO outlines — tone is the WIDTH of each line (the burin
 * rotated / the groove widened) at a pitch that never changes. Measured off
 * the reference (ref/blue-slabs.jpg, 700 px): pitch 6 px everywhere (wall,
 * floor, every face); ink coverage lit ≈ 0.37–0.42, floor-in-shadow 0.51,
 * the dark side face 0.70. So: constant pitch, light in the swell.
 *
 * The structures are the BROKEN ROOM rule, ported from paintsystem3-rooms/
 * carve.js geomRoom(): a panel whose every edge extrudes toward one of 2–4
 * MISMATCHED vanishing points. construct 'room' is that function's exact
 * structure (1–2 back panels, depth 0.4–0.9, VPs in [-0.45,1.45]W ×
 * [-0.4,1.4]H, receding edges extended ×1.15 as scribed construction lines,
 * planes ordered by area like the engine's z()). construct 'slabs' applies the
 * same edge→VP extrusion to free-standing panels resting on a floor (the
 * reference's leaning slabs); 'both' puts slabs inside the room.
 *
 * The LEGIBILITY LAW is built, not hoped for: a face's comb direction is
 * chosen to differ from every face it overlaps (≥ MINANG) — verify() proves it
 * per overlapping pair, or that the tone step carries the border instead.
 *
 *   Taille.build(opts) -> { W,H,S,pitch, faces:[...], scribes:[...], vps, stats }
 *   Taille.coverage(built, face, x, y) -> 0..1 ink fraction at a point
 *   Taille.verify(built) -> { ok, problems, stats }
 * ===========================================================================*/
(function(root){
  'use strict';

  var DEF = {
    seed: 1,
    construct: 'slabs',   // slabs | room | both
    stage: 'wall-floor',  // wall-floor | wall | paper
    horizon: 0.61,        // measured: floor line at 427/700
    solids: 3,            // slabs on the floor
    breakAmt: 0.35,       // 0 = each slab one VP (coherent box) … 1 = every edge its own VP (the room's rule)
    depth: 0.5,           // slab thickness
    nvp: 0,               // vanishing points (0 = random 2–4, as geomRoom)
    panels: 0,            // room back panels (0 = random 1–2, as geomRoom; 1–3 = fixed, nested)
    tilt: 24,             // max slab tilt in degrees (half the slabs tilt, as before; 0 = all upright)
    pitch: 0.0086,        // line pitch × short side (measured 6/700)
    hatch: 'parallel',    // parallel | converge (receding faces ruled as rays to their VP)
    lightAz: -40,         // the direction cast shadows travel across the floor, screen degrees (0 = right, −90 = straight back to the wall)
    shadowLen: 0.9,
    lit: 0.36,            // coverage of a fully lit face (measured 0.37)
    dark: 0.72,           // coverage of a face turned from the light (measured 0.70)
    ground: 0.05,         // wall/floor darkness 0..1 on the lit→dark ramp (measured ≈ lit)
    shadowAdd: 0.13,      // coverage added inside a cast shadow on the floor (measured 0.38 → 0.51); the upright wall takes WALLSHADOW× (0.38 → 0.70)
    swell: 0.5,           // along-line modelling inside a face (the burin's rotation)
    seam: 0.5,            // hairline of paper left where two combs meet (× pitch)
    margin: 0.07,         // the sheet's margin round the image × short side (the plate mark sits in it)
    scribe: 1,            // room: the receding construction edges as scribed hairlines
    // ---- the ink (plate.js: Jack Butcher's KYC drawInk process; defaults = his GRID 9 preset) ----
    rough: 1.0,           // groove-wall jitter (drawInk roughness 100%)
    inkVar: 0.25,         // per-line + along-line weight variance (drawInk weightVariance; grid preset 0-50%)
    ragged: 0.72,         // how unevenly the lines stop at a border (drawInk gradation 72%)
    taper: 0.6,           // torpedo ends: how far each line thins toward its end (per-line length)
    grain: 0.64,          // paper specks in the ink (drawInk paper 64%)
    grainDensity: 1,      // x drawInk's speck count per unit area
    grainSize: 1,         // x drawInk's speck radius
    // ---- the sheet (paper.js: a Hahnemuhle mould-made felt surface as a height field) ----
    sheet: 'german-etching-310', // none | william-turner-310 | german-etching-310 | torchon-285 (Conrad's pick: German Etching)
    sheetCm: 30,          // print size (short side, cm) - sets how many pixels a millimetre of felt spans
    noduleScale: 1,       // x the sheet's nodule size (ESTIMATED from Hahnemuhle's photos - no scale bar)
    relief: 0.5,          // felt contrast: 0.5 = gallery light; 1 = the raking light of Hahnemuhle's detail photographs
    rake: 135,            // light direction on the sheet (screen deg; 135 = upper-left, as the photographs)
    bite: 0.6,            // how strongly the felt steers the groove walls
    flecks: 1,            // x the sheet's coating flecks in the ink
    // ---- the studio's earlier paper experiments, combined into the same height field ----
    wove: 0.35,           // STRATA's plain-weave as the mould's wove wire under the felt
    wovePitch: 0.55,      // mm per wire cell
    fibres: 1,            // SIFRA's cotton fibres (x its count)
    platemark: 1,         // SWEPT's plate mark, made physical (needs a margin)
    plateGap: 4,          // mm between the image and the plate edge
    plateDepth: 1,        // how deep the plate sinks the sheet (and how flat the press irons the felt inside)
    plateTone: 0.6,       // STRATA's wipe law: the ink film left in the sheet's hollows inside the plate
    poupee: 1             // a la poupee: a palette's prims ink the structures (stage + shadows keep the key ink)
  };
  var MINANG = 18;         // degrees — the smallest direction change that reads as a new plane
  var MINTONE = 0.12;      // or a coverage step at least this big
  var WALLSHADOW = 2.4;    // measured: wall shadow +0.32 vs floor shadow +0.13

  function rng32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
  function lerp(a,b,t){ return {x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t}; }
  function norm(x,y){ var l=Math.hypot(x,y)||1; return {x:x/l, y:y/l}; }
  function centroid(P){ var x=0,y=0; for (var i=0;i<P.length;i++){ x+=P[i].x; y+=P[i].y; } return {x:x/P.length, y:y/P.length}; }
  function area(P){ var a=0; for (var i=0,j=P.length-1;i<P.length;j=i++) a+=(P[j].x+P[i].x)*(P[j].y-P[i].y); return Math.abs(a/2); }
  function angDiff(a,b){ var d=Math.abs(((a-b)%180+180)%180); return Math.min(d,180-d); }   // line directions are mod 180
  function deg(rad){ return rad*180/Math.PI; }

  function hull(pts){
    pts=pts.slice().sort(function(a,b){ return a.x-b.x||a.y-b.y; });
    if (pts.length<3) return pts;
    function cr(o,a,b){ return (a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x); }
    var lo=[],up=[],i;
    for (i=0;i<pts.length;i++){ while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],pts[i])<=0) lo.pop(); lo.push(pts[i]); }
    for (i=pts.length-1;i>=0;i--){ while(up.length>=2&&cr(up[up.length-2],up[up.length-1],pts[i])<=0) up.pop(); up.push(pts[i]); }
    lo.pop(); up.pop(); return lo.concat(up);
  }
  // Sutherland–Hodgman: clip subject by a CONVEX clip polygon (either winding)
  function clipConvex(subject, clip){
    var out=subject.slice(), n=clip.length, s=0;
    for (var i=0;i<n;i++){ var a=clip[i], b=clip[(i+1)%n]; s+=(b.x-a.x)*(b.y+a.y); }
    var sign = s>0 ? 1 : -1;   // orient inside test to the clip winding
    for (var e=0;e<n && out.length;e++){
      var A=clip[e], B=clip[(e+1)%n], inp=out; out=[];
      var side=function(p){ return sign*((B.x-A.x)*(p.y-A.y)-(B.y-A.y)*(p.x-A.x)); };
      for (var k=0;k<inp.length;k++){
        var cur=inp[k], nxt=inp[(k+1)%inp.length], dc=side(cur), dn=side(nxt);
        if (dc<=0) out.push(cur);
        if ((dc<0&&dn>0)||(dc>0&&dn<0)){ var t=dc/(dc-dn); out.push({x:cur.x+t*(nxt.x-cur.x), y:cur.y+t*(nxt.y-cur.y)}); }
      }
    }
    return out;
  }
  function clipRect(P,x0,y0,x1,y1){ return clipConvex(P,[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}]); }
  function inside(P,x,y){ var c=false; for (var i=0,j=P.length-1;i<P.length;j=i++){ var a=P[i],b=P[j]; if (((a.y>y)!==(b.y>y)) && (x < (b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)) c=!c; } return c; }
  function edgeDist(P,x,y){ var m=1e9; for (var i=0,j=P.length-1;i<P.length;j=i++){ var a=P[j],b=P[i],dx=b.x-a.x,dy=b.y-a.y,L=dx*dx+dy*dy||1,t=clamp(((x-a.x)*dx+(y-a.y)*dy)/L,0,1); m=Math.min(m,Math.hypot(a.x+t*dx-x,a.y+t*dy-y)); } return m; }

  // ---- a line through polygon P → the inside intervals (even–odd, works for simple non-convex P) ----
  function lineThrough(P, o, u){
    var ts=[];
    for (var i=0,j=P.length-1;i<P.length;j=i++){
      var a=P[j], b=P[i], ex=b.x-a.x, ey=b.y-a.y, den=u.x*ey-u.y*ex;
      if (Math.abs(den)<1e-12) continue;
      var t=((a.x-o.x)*ey-(a.y-o.y)*ex)/den, s=((a.x-o.x)*u.y-(a.y-o.y)*u.x)/den;
      if (s>=0 && s<1) ts.push(t);
    }
    ts.sort(function(p,q){ return p-q; });
    var out=[]; for (var k=0;k+1<ts.length;k+=2) out.push([ts[k],ts[k+1]]);
    return out;
  }

  // ---- the comb of one face: constant pitch, clipped to the face, seam-trimmed at the border ----
  function comb(face, pitch, seam){
    var P=face.poly, segs=[], trim=seam*pitch*0.5;
    if (face.hatch.mode==='converge'){
      var V=face.hatch.vp, c=centroid(P), dC=Math.hypot(c.x-V.x,c.y-V.y);
      if (dC < pitch*4 || inside(P,V.x,V.y)) return comb({poly:P, hatch:{mode:'parallel', ang:face.hatch.ang}}, pitch, seam);
      var step=pitch/dC, a0=Math.atan2(c.y-V.y,c.x-V.x), lo=1e9, hi=-1e9;
      for (var i=0;i<P.length;i++){ var a=Math.atan2(P[i].y-V.y,P[i].x-V.x)-a0; a=Math.atan2(Math.sin(a),Math.cos(a)); lo=Math.min(lo,a); hi=Math.max(hi,a); }
      for (var k=Math.ceil(lo/step); k*step<=hi; k++){
        var an=a0+k*step, u={x:Math.cos(an), y:Math.sin(an)}, iv=lineThrough(P,V,u);
        for (var q=0;q<iv.length;q++){ var t0=iv[q][0]+trim, t1=iv[q][1]-trim; if (t1-t0 < pitch*0.8) continue;
          segs.push({ax:V.x+u.x*t0, ay:V.y+u.y*t0, bx:V.x+u.x*t1, by:V.y+u.y*t1, vp:V, step:step}); }
      }
      return segs;
    }
    var th=face.hatch.ang*Math.PI/180, u={x:Math.cos(th), y:Math.sin(th)}, nr={x:-u.y, y:u.x}, mn=1e9, mx=-1e9;
    for (var i2=0;i2<P.length;i2++){ var pr=P[i2].x*nr.x+P[i2].y*nr.y; mn=Math.min(mn,pr); mx=Math.max(mx,pr); }
    for (var k2=Math.ceil(mn/pitch); k2*pitch<=mx; k2++){
      var off=k2*pitch, o={x:nr.x*off, y:nr.y*off}, iv2=lineThrough(P,o,u);   // world-anchored: every parallel comb shares one ruling
      for (var q2=0;q2<iv2.length;q2++){ var s0=iv2[q2][0]+trim, s1=iv2[q2][1]-trim; if (s1-s0 < pitch*0.8) continue;
        segs.push({ax:o.x+u.x*s0, ay:o.y+u.y*s0, bx:o.x+u.x*s1, by:o.y+u.y*s1}); }
    }
    return segs;
  }

  // effective direction of a face's comb (converge → the ray through its centroid)
  function faceAng(f){ if (f.hatch.mode==='converge'){ var c=centroid(f.poly); return deg(Math.atan2(c.y-f.hatch.vp.y, c.x-f.hatch.vp.x)); } return f.hatch.ang; }
  function overlapArea(A,B){ var h=hull(B); if (h.length<3) return 0; var c=clipConvex(hull(A),h); return c.length>=3 ? area(c) : 0; }

  // choose the comb direction that differs most from every earlier face it overlaps
  function chooseAng(poly, candidates, earlier, S){
    var best=candidates[0], bestScore=-1;
    for (var i=0;i<candidates.length;i++){
      var a=((candidates[i]%180)+180)%180, worst=40;                     // capped: past 40° every choice reads, so ties keep the preferred diagonal
      for (var j=0;j<earlier.length;j++){ if (overlapArea(poly, earlier[j].poly) > S*S*0.0008) worst=Math.min(worst, angDiff(a, faceAng(earlier[j]))); }
      if (worst>bestScore+0.01){ bestScore=worst; best=a; }
    }
    return best;
  }

  // ---- a receding face (room wall or slab side): ruled along its recession toward its VP, unless that
  //      direction collides with a face it overlaps — then re-ruled to the most contrasting direction ----
  function ruleReceding(poly, V, mode, faces, S){
    var c=centroid(poly), sa=deg(Math.atan2(c.y-V.y, c.x-V.x)), h = mode==='converge' ? {mode:'converge', vp:V, ang:sa} : {mode:'parallel', ang:((sa%180)+180)%180};
    for (var j=0;j<faces.length;j++){
      if (overlapArea(poly,faces[j].poly)>S*S*0.0008 && angDiff(faceAng({poly:poly,hatch:h}),faceAng(faces[j]))<MINANG){
        var ea=deg(Math.atan2(poly[1].y-poly[0].y, poly[1].x-poly[0].x)), cand=[sa, ea, sa+45, sa-45, ea+45, ea-45];
        for (var a=0;a<180;a+=5) cand.push(a);
        return {mode:'parallel', ang:chooseAng(poly,cand,faces,S)};
      }
    }
    return h;
  }

  // ---- light: toward-light 2D = against the shadow direction; a face's darkness 0..1 ----
  function lightVec(o){ var a=o.lightAz*Math.PI/180; return {x:-Math.cos(a), y:-Math.sin(a)}; }

  function build(opts){
    var o={}; for (var k in DEF) o[k]=DEF[k]; for (var k2 in (opts||{})) if (opts[k2]!==undefined && opts[k2]!==null && opts[k2]!=='') o[k2]=opts[k2];
    var W=+o.W||1000, H=+o.H||1000, S=Math.min(W,H), R=rng32((+o.seed||1)*7919+13);
    function rnd(a,b){ return a+(b-a)*R(); }
    var pitch=Math.max(2, o.pitch*S), M=o.margin*S, x0=M, y0=M, x1=W-M, y1=H-M, IW=x1-x0, IH=y1-y0;
    var hY=y0+IH*o.horizon, L=lightVec(o), faces=[], scribes=[];
    function addFace(f){ var P=clipRect(f.poly,x0,y0,x1,y1); if (P.length<3 || area(P)<pitch*pitch*2) return null; f.poly=P; f.order=faces.length; faces.push(f); return f; }

    // ---- the vanishing points: geomRoom's distribution ----
    var nVP=(o.nvp>=2&&o.nvp<=4) ? o.nvp : (2+(R()<0.55?1:0)+(R()<0.25?1:0));
    var VPs=[]; for (var i=0;i<nVP;i++) VPs.push({x:x0+IW*rnd(-0.45,1.45), y:y0+IH*rnd(-0.4,1.4)});
    if (o.vps && o.vps.length) VPs=o.vps.map(function(v){ return {x:v.x, y:v.y}; });   // a SHARED construction: rooms built against one set of vanishing points (draws above still consumed → default seeds reproduce)

    // ---- stage ----
    var groundDark=o.ground;
    if (o.stage==='wall-floor'){
      addFace({kind:'wall',  poly:[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:hY},{x:x0,y:hY}], hatch:{mode:'parallel',ang:90}, dark:groundDark, receives:true});
      addFace({kind:'floor', poly:[{x:x0,y:hY},{x:x1,y:hY},{x:x1,y:y1},{x:x0,y:y1}], hatch:{mode:'parallel',ang:0},  dark:groundDark, receives:true});
    } else if (o.stage==='wall'){
      addFace({kind:'wall',  poly:[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}], hatch:{mode:'parallel',ang:90}, dark:groundDark, receives:true});
    }

    // ---- ROOM: geomRoom's exact structure, every plane a comb ----
    if (o.construct==='room' || o.construct==='both'){
      var coin=R(), roomPlanes=[], boxes=(o.panels>=1&&o.panels<=3) ? Math.round(o.panels) : 1+(coin<0.45?1:0);   // the die is always rolled: default seeds reproduce
      for (var b=0;b<boxes;b++){
        var rs=o.roomScale||1, bw=IW*rnd(0.20,0.40)*rs, bh=IH*rnd(0.26,0.50)*rs, fx=rnd(0.12,0.55), fy=rnd(0.12,0.42);
        var bx = o.roomAt ? o.roomAt.x - bw/2 + (fx-0.335)*bw*0.8 : x0+IW*fx, by = o.roomAt ? o.roomAt.y - bh/2 + (fy-0.27)*bh*0.8 : y0+IH*fy;   // roomAt: place the room about a point (same draws)
        var back=[{x:bx,y:by},{x:bx+bw,y:by},{x:bx+bw,y:by+bh},{x:bx,y:by+bh}], bc=centroid(back);
        roomPlanes.push({kind:'back', poly:back, vp:null, n3:{x:0,y:0,z:1}});
        scribes.push([back[0],back[1]],[back[1],back[2]],[back[2],back[3]],[back[3],back[0]]);
        for (var e=0;e<4;e++){
          var p=back[e], q=back[(e+1)%4], V=VPs[Math.floor(R()*VPs.length)], dep=rnd(0.4,0.9);
          var p2=lerp(p,V,dep), q2=lerp(q,V,dep), mid=lerp(p,q,0.5), inw=norm(bc.x-mid.x, bc.y-mid.y);
          roomPlanes.push({kind:'roomside', poly:[p,q,q2,p2], vp:V, n3:{x:inw.x, y:inw.y, z:0.35}});   // a room wall faces INTO the room
          scribes.push([p, lerp(p,V,1.15)], [q, lerp(q,V,1.15)]);
        }
      }
      roomPlanes.sort(function(a,b2){ return area(b2.poly)-area(a.poly); });   // the engine's z(): larger first, smaller on top
      for (var r=0;r<roomPlanes.length;r++){
        var rp=roomPlanes[r], dk=shade(rp.n3), hatch;
        if (rp.vp) hatch=ruleReceding(clipRect(rp.poly,x0,y0,x1,y1), rp.vp, o.hatch, faces, S);
        else { var bc2=[45,135]; for (var ba=0;ba<180;ba+=5) bc2.push(ba); hatch={mode:'parallel', ang:chooseAng(rp.poly,bc2,faces,S)}; }
        addFace({kind:rp.kind, poly:rp.poly, hatch:hatch, dark:dk, receives:true, solid:-1});
      }
    }

    function shade(n3){   // Lambert against a light raised 0.55 toward the viewer, remapped to the measured ramp
      var l=norm(L.x,L.y), lz=0.55, ll=Math.hypot(1,lz);
      var nl=Math.hypot(n3.x,n3.y,n3.z)||1, d=(n3.x*l.x+n3.y*l.y+n3.z*lz)/(nl*ll);
      return clamp(1-(0.5+0.5*d)*1.25+0.25, 0, 1) ;
    }

    // ---- SLABS: the room's edge→VP extrusion applied to free-standing panels on the floor ----
    var solids=[];
    if (o.construct==='slabs' || o.construct==='both'){
      var nS=Math.max(1,Math.round(o.solids)), floorTop=(o.stage==='wall-floor')?hY:y0+IH*0.45, specs=[];
      for (var s=0;s<nS;s++){
        var w=S*rnd(0.2,0.4), h=S*rnd(0.18,0.36), rot=(R()<0.5?0:rnd(-1,1)*o.tilt);   // same draws as the original ±24° (the amount is drawn only when the coin says tilt); tilt 0 = all upright
        var baseY=floorTop+(y1-floorTop)*rnd(0.08,0.78), cx=x0+IW*rnd(0.16,0.84);
        specs.push({w:w,h:h,rot:rot,baseY:baseY,cx:cx});
      }
      specs.sort(function(a,b2){ return a.baseY-b2.baseY; });   // further up the floor = further back = drawn first
      for (var si=0;si<specs.length;si++){
        var sp=specs[si], th=sp.rot*Math.PI/180, cs=Math.cos(th), sn=Math.sin(th);
        var F=[{x:-sp.w/2,y:-sp.h},{x:sp.w/2,y:-sp.h},{x:sp.w/2,y:0},{x:-sp.w/2,y:0}].map(function(pt){ return {x:pt.x*cs-pt.y*sn, y:pt.x*sn+pt.y*cs}; });
        var maxY=-1e9; F.forEach(function(pt){ maxY=Math.max(maxY,pt.y); });
        F=F.map(function(pt){ return {x:pt.x+sp.cx, y:pt.y-maxY+sp.baseY}; });   // rests on the floor at baseY
        var fc=centroid(F), mainV=VPs[Math.floor(R()*VPs.length)], D=S*rnd(0.12,0.3)*(0.4+o.depth*1.2);
        var sideFaces=[];
        for (var e2=0;e2<4;e2++){
          var P0=F[e2], Q0=F[(e2+1)%4], V2=(R()<o.breakAmt) ? VPs[Math.floor(R()*VPs.length)] : mainV;
          var mid2=lerp(P0,Q0,0.5), out2=norm(mid2.x-fc.x, mid2.y-fc.y);
          if ((V2.x-mid2.x)*out2.x+(V2.y-mid2.y)*out2.y <= 0) continue;   // VP not beyond this edge → the face is hidden behind the front
          if (out2.y > 0.6) continue;                                        // the underside: the slab stands on it
          var dP=Math.hypot(V2.x-P0.x,V2.y-P0.y), dQ=Math.hypot(V2.x-Q0.x,V2.y-Q0.y);
          var P2=lerp(P0,V2,Math.min(0.9,D/dP)), Q2=lerp(Q0,V2,Math.min(0.9,D/dQ));
          if (Math.max(P2.y,Q2.y) > sp.baseY+pitch) continue;                // nothing recedes under the floor it stands on
          sideFaces.push({poly:[P0,Q0,Q2,P2], vp:V2, n3:{x:out2.x, y:out2.y, z:0.25}});
        }
        var solidIdx=solids.length, sol={faces:[], baseY:sp.baseY, pts:F.slice()};
        for (var sf=0;sf<sideFaces.length;sf++){
          var sd=sideFaces[sf], sh=ruleReceding(sd.poly, sd.vp, o.hatch, faces, S);
          var fS=addFace({kind:'side', poly:sd.poly, hatch:sh, dark:shade(sd.n3), receives:true, solid:solidIdx});
          if (fS){ sol.faces.push(fS); sd.poly.forEach(function(pt){ sol.pts.push(pt); }); }
        }
        var cand=[sp.rot+45, sp.rot-45]; for (var ca=0;ca<180;ca+=5) cand.push(sp.rot+ca);
        var fa=chooseAng(F,cand,faces,S);
        var fF=addFace({kind:'front', poly:F, hatch:{mode:'parallel', ang:fa}, dark:shade({x:0,y:0,z:1}), receives:true, solid:solidIdx});
        if (fF) sol.faces.push(fF);
        solids.push(sol);
      }
    }

    // ---- cast shadows: each slab thrown along the light onto what lies behind/beneath it ----
    var shadows=[], sd2=o.lightAz*Math.PI/180, sdx=Math.cos(sd2), sdy=Math.sin(sd2);
    for (var ci=0;ci<solids.length;ci++){
      var so=solids[ci], proj=[];
      if (!so.faces.length) continue;
      for (var pi=0;pi<so.pts.length;pi++){
        var pt=so.pts[pi], hgt=Math.max(0, so.baseY-pt.y);
        proj.push({x:pt.x, y:so.baseY});                                                     // its footprint
        var gx=pt.x+hgt*o.shadowLen*sdx, gy=so.baseY+hgt*o.shadowLen*sdy*0.8;             // thrown along the floor (foreshortened)
        if (o.stage==='wall-floor' && gy<hY && so.baseY>hY){                                  // the floor runs out → the rest climbs the wall
          var tw=(so.baseY-hY)/(so.baseY-gy);
          proj.push({x:pt.x+(gx-pt.x)*tw, y:hY});
          proj.push({x:pt.x+(gx-pt.x)*tw, y:hY-hgt*(1-tw)*0.9});
        } else proj.push({x:gx, y:gy});
      }
      var shp=hull(proj), firstOrder=Math.min.apply(null, so.faces.map(function(f){ return f.order; }));
      shadows.push({poly:shp, solid:ci, before:firstOrder});
    }
    // on bare paper there is no floor to receive a shadow → the shadow is ruled as its own comb (lines only)
    if (o.stage!=='wall-floor'){
      var ins=[];
      for (var sh2=0;sh2<shadows.length;sh2++){ var P3=clipRect(shadows[sh2].poly,x0,y0,x1,y1); if (P3.length>=3) ins.push({kind:'shadow', poly:P3, hatch:{mode:'parallel',ang:0}, dark:0.55, receives:false, solid:-1, before:shadows[sh2].before}); }
      var nStage=faces.filter(function(f){ return f.kind==='wall'; }).length;          // ground shadows lie under every slab
      Array.prototype.splice.apply(faces, [nStage,0].concat(ins));
      faces.forEach(function(f,idx){ f.order=idx; });
      shadows.forEach(function(s2){ s2.before=Math.min.apply(null, solids[s2.solid].faces.map(function(f){ return f.order; })); });
    }

    // ---- per-face modelling gradient (Mellan swells the line along the form) ----
    for (var fi=0;fi<faces.length;fi++){
      var fc2=faces[fi], c3=centroid(fc2.poly), ext=0;
      fc2.poly.forEach(function(pt){ ext=Math.max(ext, Math.abs((pt.x-c3.x)*L.x+(pt.y-c3.y)*L.y)); });
      fc2.grad={cx:c3.x, cy:c3.y, lx:L.x, ly:L.y, ext:ext||1};
      fc2.segs=comb(fc2, pitch, o.seam);
    }

    // ---- where no direction can carry a border (a face crowded by combs), the TONE carries it: the plane is
    //      re-cut at the darkness that best separates it from EVERY comb it can't out-angle, scored with the
    //      real coverage (shadows + modelling included) ----
    var Bp={ opts:o, shadows:shadows, pitch:pitch }, toned=0;
    for (var ti=0;ti<faces.length;ti++){
      var tf=faces[ti]; if (tf.kind==='shadow') continue;
      var near=[];
      for (var tj=0;tj<ti;tj++){ var tg=faces[tj]; if (tg.kind==='shadow' && tf.kind==='shadow') continue;
        if (overlapArea(tf.poly,tg.poly)>S*S*0.0008 && angDiff(faceAng(tf),faceAng(tg))<MINANG) near.push(tg); }
      if (!near.length) continue;
      var cf=centroid(tf.poly), covN=near.map(function(g){ var cg=centroid(g.poly); return coverage(Bp,g,cg.x,cg.y); });
      function score(dk){ var keep=tf.dark; tf.dark=dk; var cv=coverage(Bp,tf,cf.x,cf.y); tf.dark=keep; var m=9; covN.forEach(function(c){ m=Math.min(m,Math.abs(cv-c)); }); return m; }
      if (score(tf.dark) >= MINTONE+0.02) continue;
      var best=null, bd=9, mx=tf.dark, ms=score(tf.dark);
      var span2=Math.max(0.05,o.dark-o.lit), dk0=(0.08-o.lit)/span2, dk1=(0.92-o.lit)/span2;       // search the whole physical ink range (0.08–0.92), whatever the ramp
      for (var dk=dk0;dk<=dk1+1e-4;dk+=0.025*Math.max(1,(dk1-dk0)/1.6)){ var sc=score(dk);                        // below 0 = the highlight register: a plane cut in hairlines
        if (sc>=MINTONE+0.03 && Math.abs(dk-tf.dark)<bd){ bd=Math.abs(dk-tf.dark); best=dk; }   // the nearest tone that clearly separates
        if (sc>ms){ ms=sc; mx=dk; } }                                                          // else the most separating one
      if (best===null) best=mx;
      tf.dark=best; tf.toned=true; toned++;
    }

    return { W:W, H:H, S:S, pitch:pitch, opts:o, toned:toned, faces:faces, scribes:(o.construct==='slabs'||!o.scribe)?[]:scribes, shadows:shadows, vps:VPs, horizon:hY, rect:[x0,y0,x1,y1] };
  }

  // ---- ink coverage at a point of a face: the whole tonal system in one place ----
  function coverage(B, f, x, y){
    var o=B.opts, c=o.lit+(o.dark-o.lit)*f.dark;
    var g=f.grad; if (g){ var t=((x-g.cx)*g.lx+(y-g.cy)*g.ly)/g.ext; c -= o.swell*0.07*t; }     // lighter toward the light
    if (f.receives){
      for (var i=0;i<B.shadows.length;i++){
        var s=B.shadows[i]; if (f.order>=s.before) continue;          // a shadow falls only on what is drawn behind its caster
        if (!inside(s.poly,x,y)) continue;
        var dEdge=edgeDist(s.poly,x,y), soft=clamp(dEdge/(B.pitch*1.4),0,1);   // a short penumbra, one line wide
        c += o.shadowAdd*soft*(f.kind==='wall' ? WALLSHADOW : 1);
      }
    }
    return clamp(c, 0.04, 0.92);
  }

  function verify(B){
    var problems=[], S=B.S, legib=0, pairs=0, starved=0, cmin=1, cmax=0, lines=0, pitchDrift=0;
    for (var i=0;i<B.faces.length;i++){
      var f=B.faces[i]; lines+=f.segs.length;
      if (f.segs.length<3) starved++;
      if (f.hatch.mode==='parallel'){                                 // constant pitch: consecutive parallel lines exactly one pitch apart
        var th=f.hatch.ang*Math.PI/180, nr={x:-Math.sin(th), y:Math.cos(th)};
        for (var k=0;k<f.segs.length;k++){ var sg=f.segs[k], off=(sg.ax*nr.x+sg.ay*nr.y)/B.pitch; if (Math.abs(off-Math.round(off))>1e-6) pitchDrift++; }
      }
      var cc=centroid(f.poly), cv=coverage(B,f,cc.x,cc.y); cmin=Math.min(cmin,cv); cmax=Math.max(cmax,cv);
      for (var j=0;j<i;j++){
        var g=B.faces[j]; if (f.kind==='shadow' && g.kind==='shadow') continue;   // two shadows on one ground are one dark patch, not a border
        if (overlapArea(f.poly,g.poly) <= S*S*0.0008) continue;
        pairs++;
        var da=angDiff(faceAng(f),faceAng(g)), cg=centroid(g.poly), dt=Math.abs(cv-coverage(B,g,cg.x,cg.y));
        if (da<MINANG && dt<MINTONE){ legib++; problems.push('illegible border '+f.kind+'#'+i+' over '+g.kind+'#'+j+' ('+da.toFixed(0)+'°, Δtone '+dt.toFixed(2)+')'); }
      }
    }
    if (!B.faces.length) problems.push('no faces');
    if (pitchDrift) problems.push(pitchDrift+' lines off the one pitch');
    if (starved>B.faces.length*0.34) problems.push(starved+' starved faces');
    var stats={ faces:B.faces.length, lines:lines, pairs:pairs, illegible:legib, starved:starved, pitchDrift:pitchDrift,
      shadows:B.shadows.length, toned:B.toned, vps:B.vps.length, scribes:B.scribes.length, pitchPx:+B.pitch.toFixed(2),
      covRange:[+cmin.toFixed(2), +cmax.toFixed(2)], construct:B.opts.construct, stage:B.opts.stage };
    return { ok: problems.length===0, problems:problems, stats:stats };
  }

  root.Taille = { DEF:DEF, MINANG:MINANG, build:build, coverage:coverage, verify:verify, centroid:centroid, rng32:rng32, comb:comb };
})(typeof window!=='undefined' ? window : globalThis);
