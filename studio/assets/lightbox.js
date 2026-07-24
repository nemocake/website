/* lightbox.js — click any plate to view it full screen.
 * Annotations are typed in the corners (work, plate number, title, caption) and
 * optional pinned notes can sit on the image itself: give an image
 *   "notes": [{ "x": 0.42, "y": 0.31, "text": "the hatch turns here" }]
 * in studio.json and each renders as a sanguine pin with a leader line.
 * Keys: ← → to move through the set, F for actual size, Esc to close. */
(function () {
  var box, imgEl, capEls = {}, pinLayer, items = [], idx = 0, zoomed = false;

  function build() {
    box = document.createElement("div");
    box.className = "lb";
    box.innerHTML =
      '<div class="lb-stage">' +
        '<div class="lb-frame"><img class="lb-img" alt="" /><div class="lb-pins"></div></div>' +
      '</div>' +
      '<div class="lb-ann lb-tl"></div>' +
      '<div class="lb-ann lb-tr"></div>' +
      '<div class="lb-ann lb-bl"></div>' +
      '<div class="lb-ann lb-br"></div>' +
      '<button class="lb-nav lb-prev" aria-label="previous">◀</button>' +
      '<button class="lb-nav lb-next" aria-label="next">▶</button>' +
      '<button class="lb-close" aria-label="close">✕</button>';
    document.body.appendChild(box);
    imgEl = box.querySelector(".lb-img");
    pinLayer = box.querySelector(".lb-pins");
    capEls = { tl: box.querySelector(".lb-tl"), tr: box.querySelector(".lb-tr"),
               bl: box.querySelector(".lb-bl"), br: box.querySelector(".lb-br") };
    box.querySelector(".lb-close").onclick = close;
    box.querySelector(".lb-prev").onclick = function (e) { e.stopPropagation(); go(-1); };
    box.querySelector(".lb-next").onclick = function (e) { e.stopPropagation(); go(1); };
    box.addEventListener("click", function (e) {
      if (e.target === box || e.target.classList.contains("lb-stage")) close();
    });
    imgEl.addEventListener("click", function (e) { e.stopPropagation(); toggleZoom(); });
    addEventListener("keydown", function (e) {
      if (!box.classList.contains("open")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "f" || e.key === "F") toggleZoom();
    });
  }

  function toggleZoom() {
    zoomed = !zoomed;
    box.classList.toggle("zoomed", zoomed);
    capEls.br.textContent = zoomed ? "actual size · click to fit" : (items[idx] && items[idx].caption) || "";
  }

  function show(i) {
    idx = (i + items.length) % items.length;
    var it = items[idx];
    zoomed = false; box.classList.remove("zoomed");
    imgEl.src = it.src;
    imgEl.alt = it.title || it.caption || "";
    capEls.tl.textContent = it.work || "";
    capEls.tr.textContent = items.length > 1 ? "pl. " + (idx + 1) + " / " + items.length : "";
    capEls.bl.textContent = it.title || "";
    capEls.br.textContent = it.caption || "";
    box.querySelector(".lb-prev").style.display = items.length > 1 ? "" : "none";
    box.querySelector(".lb-next").style.display = items.length > 1 ? "" : "none";
    pinLayer.innerHTML = (it.notes || []).map(function (n, k) {
      var side = n.x > 0.6 ? "left" : "right";
      return '<div class="lb-pin ' + side + '" style="left:' + (n.x * 100) + '%;top:' + (n.y * 100) + '%">' +
             '<span class="dot"></span><span class="lbl">' + esc(n.text) + '</span></div>';
    }).join("");
  }

  function go(d) { if (items.length > 1) show(idx + d); }

  function open(list, start) {
    if (!box) build();
    items = list; show(start || 0);
    box.classList.add("open");
    document.documentElement.style.overflow = "hidden";
  }
  function close() {
    box.classList.remove("open", "zoomed");
    document.documentElement.style.overflow = "";
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* Wire a gallery: every [data-lb] element becomes clickable. Data comes from
     data-lb-title / data-lb-caption / data-lb-work / data-lb-notes (JSON). */
  function attach(root) {
    root = root || document;
    var nodes = [].slice.call(root.querySelectorAll("[data-lb]"));
    if (!nodes.length) return;
    var groups = {};
    nodes.forEach(function (n) {
      var g = n.dataset.lbGroup || "default";
      (groups[g] = groups[g] || []).push(n);
    });
    Object.keys(groups).forEach(function (g) {
      var list = groups[g].map(function (n) {
        var im = n.tagName === "IMG" ? n : n.querySelector("img");
        return {
          src: (n.dataset.lbFull || (im && im.getAttribute("src")) || "").split("?")[0],
          title: n.dataset.lbTitle || "",
          caption: n.dataset.lbCaption || "",
          work: n.dataset.lbWork || "",
          notes: (function () { try { return JSON.parse(n.dataset.lbNotes || "[]"); } catch (_) { return []; } })(),
        };
      });
      groups[g].forEach(function (n, i) {
        if (n.dataset.lbBound) return;
        n.dataset.lbBound = "1";
        n.style.cursor = "zoom-in";
        n.addEventListener("click", function (e) {
          if (e.metaKey || e.ctrlKey) return;      // let cmd-click do its thing
          e.preventDefault(); e.stopPropagation();
          open(list, i);
        });
      });
    });
  }

  window.Lightbox = { attach: attach, open: open };
})();
