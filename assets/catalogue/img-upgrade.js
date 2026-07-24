/* img-upgrade.js — serve avif/webp for studio plate images (any src under
 * assets/img/…), transparently, with the original jpg as fallback.
 *
 * why a global script instead of <picture> everywhere: the studio pages build
 * their images from JS across ~14 render points plus a lightbox. one observer
 * upgrades them all uniformly and can't drift out of sync with the render.
 * plates are lazy-loaded, so the swap happens before the jpg would ever fetch.
 * anything that 404s on the modern format falls back to the jpg via onerror. */
(function () {
  "use strict";
  var best = null;
  // 1x1 probes — decode support, tested once
  var AVIF = "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEDQgMgkQAAAAB8dSLfI=";
  var WEBP = "data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA";
  function can(uri) { return new Promise(function (r) { var i = new Image(); i.onload = function () { r(i.width > 0 && i.height > 0); }; i.onerror = function () { r(false); }; i.src = uri; }); }
  function up(img) {
    if (!best || img.__u) return;
    var s = img.getAttribute("src") || "";
    var m = s.match(/^(.*assets\/img\/.*?)\.(jpe?g)(\?.*)?$/i);
    if (!m) return;                              // studio plates only; not collection/other
    img.__u = 1;
    var jpg = s;
    img.addEventListener("error", function h() { img.removeEventListener("error", h); img.src = jpg; });
    img.src = m[1] + best + (m[3] || "");
  }
  function sweep() { var a = document.getElementsByTagName("img"), i; for (i = 0; i < a.length; i++) up(a[i]); }
  Promise.all([can(AVIF), can(WEBP)]).then(function (r) {
    best = r[0] ? ".avif" : (r[1] ? ".webp" : null);
    if (!best) return;                           // ancient browser: keep the jpgs
    sweep();
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var nn = muts[i].addedNodes;
        for (var j = 0; j < nn.length; j++) {
          var n = nn[j];
          if (n.tagName === "IMG") up(n);
          else if (n.getElementsByTagName) { var im = n.getElementsByTagName("img"), k; for (k = 0; k < im.length; k++) up(im[k]); }
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  });
})();
