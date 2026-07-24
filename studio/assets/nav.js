/* nav.js — the studio rail: wordmark + full table of contents, on every page.
 * Lets you move between series and works without going back to the cover. */
(function () {
  async function build() {
    const rail = document.getElementById("rail");
    if (!rail) return;
    let d;
    try { d = await fetch("data/studio.json", { cache: "no-store" }).then(r => r.json()); }
    catch (_) { return; }

    const works = d.works || [];
    const series = d.series || [];
    const top = works.filter(w => !w.parent);
    const kids = slug => works.filter(w => w.parent === slug)
      .sort((a, b) => (a.order ?? a.edition ?? 999) - (b.order ?? b.edition ?? 999));
    const bySeries = id => top.filter(w => w.series === id)
      .sort((a, b) => (a.order ?? a.edition ?? 999) - (b.order ?? b.edition ?? 999));
    const explorations = top.filter(w => w.kind === "exploration");

    const params = new URLSearchParams(location.search);
    const here = params.get("w") || "";
    const hereWork = works.find(w => w.slug === here);
    const openSeries = hereWork ? (hereWork.parent
      ? (works.find(x => x.slug === hereWork.parent) || {}).series
      : hereWork.series) : null;
    const hashSeries = (location.hash.match(/^#\/s\/([a-z0-9-]+)/i) || [])[1] || null;

    const ed = w => w.edition != null ? String(w.edition).padStart(2, "0") : "✦";
    const row = (w, sub) => `
      <a class="nv-work${sub ? " nv-sub" : ""}${w.slug === here ? " cur" : ""}"
         href="piece.html?w=${encodeURIComponent(w.parent || w.slug)}${w.parent ? "#ss-" + w.slug : ""}">
        <span class="nm">${esc(title(w.name))}</span><span class="ed">${ed(w)}</span></a>`;

    const group = (id, numeral, name, list) => {
      const open = (openSeries === id) || (hashSeries === id);
      return `<div class="nv-group${open ? " open" : ""}" data-series="${id}">
        <a class="nv-head" href="./#/s/${id}"><span class="rn">${numeral}</span>${esc(name)}</a>
        <div class="nv-list">${list.map(w => row(w) + kids(w.slug).map(k => row(k, true)).join("")).join("")}</div>
      </div>`;
    };

    const groups = series.map(s => group(s.id, s.numeral, s.name, bySeries(s.id)))
      .concat(explorations.length ? [group("explorations", "◎", "Explorations", explorations)] : [])
      .join("");

    rail.querySelector(".rail-jumps")?.remove();
    const nav = document.createElement("nav");
    nav.className = "nv";
    nav.innerHTML = `<a class="nv-cover" href="./">contents</a>${groups}
      <a class="nv-cover" href="./#/s/writings">writings</a>`;
    rail.appendChild(nav);

    nav.querySelectorAll(".nv-head").forEach(h => h.addEventListener("click", e => {
      // on the index, let the router handle it; elsewhere follow the link
      const g = h.parentElement;
      if (location.pathname.endsWith("./") || location.pathname.endsWith("/studio/")) {
        g.classList.toggle("open");
      }
    }));
    const cur = nav.querySelector(".nv-work.cur");
    if (cur) cur.scrollIntoView({ block: "center" });
  }

  function title(s) { return String(s).toLowerCase().replace(/(^|\s|-)\S/g, c => c.toUpperCase()); }
  function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
  window.StudioNav = { build };
})();
