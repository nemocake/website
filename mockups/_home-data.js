/* _home-data.js — shared data layer for the homepage mockups.
 * All mockups pull sections, favorites and the are.na feed from here so they
 * are comparable and the plumbing is identical. Presentation is up to each. */
window.HomeData = (function () {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---- the four sections that belong on the homepage (no visual-scores / graph) ----
  const SECTION_DEFS = [
    { key: "studio",     name: "studio",     desc: "the process of chasing after images",       href: "../studio/",     count: "studio" },
    { key: "writings",   name: "writings",   desc: "notes from a rambling jester",               href: "../writings/",   count: "writings" },
    { key: "collection", name: "collection", desc: "works i've collected from others",            href: "../collection/", count: "collection" },
    { key: "projects",   name: "projects",   desc: "tools, sites and experiments",               href: "../projects/",   count: "projects" }
  ];

  // a representative image per section, for tiles/previews that want one
  const SECTION_IMG = {
    studio:     "../studio/assets/img/multiform/hero.jpg",
    writings:   "../studio/assets/img/capriccio/hero.jpg",
    collection: null,   // collection images are remote (ipfs); left to the mockup
    projects:   "../studio/assets/img/cube-study/hero.jpg"
  };

  // a handful of studio slugs per section, for peek mosaics (studio only)
  const SECTION_PEEK = {
    studio: ["multiform", "capriccio", "fugitive", "flux", "enfilade", "cube-study"]
  };

  // ---- favourites: things Conrad is proud of, surfaced without a full entry ----
  // type drives styling; artworks carry an image, writing/project are typographic.
  const FAVORITES = [
    { type: "artwork", title: "Multiform",          kicker: "colour field system", blurb: "a procedurally generative code study after rothko.", img: "../studio/assets/img/multiform/hero.jpg", href: "../studio/piece.html?w=multiform" },
    { type: "artwork", title: "Capriccio",          kicker: "impossible architecture", blurb: "drawn architecture where every element gets its own vanishing point.", img: "../studio/assets/img/capriccio/hero.jpg", href: "../studio/piece.html?w=capriccio" },
    { type: "writing", title: "art rabbit holing",  kicker: "writing", blurb: "on the practice of looking and exploring to understand personal taste.", img: null, href: "../writings/#art-rabbit-holing" },
    { type: "artwork", title: "Fugitive",           kicker: "a way of searching", blurb: "an explorative system built for finding the visual output range of procedural generative systems.", img: "../studio/assets/img/fugitive/hero.jpg", href: "../studio/piece.html?w=fugitive" },
    { type: "artwork", title: "Visual Scores",       kicker: "notation in three dimensions", blurb: "procedurally generated visual music scores, after cage and penderecki, read in 3d.", img: "../studio/assets/img/visual-scores/hero.jpg", href: "../studio/piece.html?w=visual-scores" },
    { type: "project", title: "Le Random Explorer", kicker: "project", blurb: "an interactive 3d knowledge graph for exploring generative art and its history.", img: null, href: "../projects/#le-random-explorer" }
  ];

  // ---- how each section's index-hover preview behaves ----
  // image = thumbnails drive a large image preview; text = titles drive a text
  // snippet; mix = title + snippet + metadata (projects have no images).
  const SECTION_KIND = { studio: "image", writings: "text", collection: "image", projects: "mix" };

  // ---- cached data load ----
  let _cache = null;
  async function _load() {
    if (_cache) return _cache;
    let cfg = null, st = null;
    try { cfg = await fetch("../data/config.json", { cache: "no-store" }).then(r => r.json()); } catch (_) {}
    try { st = await fetch("../studio/data/studio.json", { cache: "no-store" }).then(r => r.json()); } catch (_) {}
    _cache = { cfg, st };
    return _cache;
  }

  function snippet(s, n = 175) {
    s = String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s;
  }

  // ---- per-section item lists, for the index-hover previews ----
  // studio/collection: {kind:'image', title, thumb, img, meta, sub, href}
  // writings:          {kind:'text',  title, snippet, meta, href}
  // projects:          {kind:'mix',   title, snippet, tags, status, live, href}
  async function items(key) {
    const { cfg, st } = await _load();
    if (key === "studio") {
      if (!st) return [];
      const tops = (st.works || []).filter(w => !w.parent)
        .sort((a, b) => (a.order ?? a.edition ?? 999) - (b.order ?? b.edition ?? 999));
      return tops.map(w => ({
        kind: "image", title: w.name, thumb: studioThumb(w.slug), img: studioHero(w.slug),
        meta: w.edition != null ? "ed " + String(w.edition).padStart(2, "0") : "",
        sub: w.after ? "after " + w.after : "",
        href: "../studio/piece.html?w=" + encodeURIComponent(w.slug)
      }));
    }
    if (key === "writings") {
      if (!cfg) return [];
      return (cfg.writings || []).slice()
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
        .map(w => {
          const body0 = (w.body || []).find(x => typeof x === "string") || "";
          const paras = (w.body || []).map(x => typeof x === "string" ? x : (x && x.type === "quote" ? "“" + x.text + "”" : null)).filter(Boolean);
          return { kind: "text", title: w.title, snippet: snippet(w.description || body0), body: paras,
            meta: whenAgo(w.date ? w.date + "T00:00:00" : null) || "",
            href: "../writings/#" + w.id };
        });
    }
    if (key === "collection") {
      if (!cfg) return [];
      // local pre-generated thumbnails (fast + reliable) instead of live ipfs gateways
      return (cfg.collection || []).map((it, i) => ({
        kind: "image", title: it.title,
        thumb: `../assets/collection-thumbs/${i}.jpg`,
        img: `../assets/collection-thumbs/${i}.jpg`,
        meta: it.artist || "", sub: it.artist || "", artist: it.artist || "", href: "../collection/"
      }));
    }
    if (key === "projects") {
      if (!cfg) return [];
      return Object.entries(cfg.projects || {}).map(([k, v]) => ({
        kind: "mix", title: v.title || k, snippet: snippet(v.description), tags: v.tags || [],
        status: v.status || "", live: v.liveUrl || null,
        meta: v.status || "", href: v.liveUrl || "../projects/"
      }));
    }
    return [];
  }

  // ---- live section counts ----
  async function sections() {
    const { cfg, st } = await _load();
    const counts = {};
    if (cfg) {
      counts.writings = (cfg.writings || []).length;
      counts.collection = (cfg.collection || []).length;
      // config.projects is a keyed object, not an array
      counts.projects = cfg.projects ? Object.keys(cfg.projects).length : null;
    }
    if (st) counts.studio = (st.works || []).filter(w => !w.parent).length;
    return SECTION_DEFS.map(s => ({ ...s, img: SECTION_IMG[s.key], peek: SECTION_PEEK[s.key] || null, n: counts[s.count] != null ? counts[s.count] : null }));
  }

  // studio image URLs for a slug's thumb (for peek mosaics)
  const studioThumb = slug => `../studio/assets/img/${slug}/thumb.jpg`;
  const studioHero  = slug => `../studio/assets/img/${slug}/hero.jpg`;

  // ---- are.na "lately" feed: live recent blocks, local snapshot as fallback ----
  async function arena(n = 24) {
    try {
      const r = await fetch(`https://api.are.na/v2/channels/visually-intriguing?per=${n}&sort=position&direction=desc`, { cache: "no-store" });
      if (!r.ok) throw new Error("http " + r.status);
      const d = await r.json();
      const out = (d.contents || []).filter(b => b.image).map(b => ({
        title: b.title || b.generated_title || "",
        img: (b.image.display || b.image.thumb || b.image.original).url,
        thumb: (b.image.thumb || b.image.display).url,
        src: (b.source && b.source.url) || b.image.original.url,
        when: b.connected_at
      }));
      if (out.length) return { live: true, blocks: out };
      throw new Error("empty");
    } catch (e) {
      // local snapshot fallback
      try {
        const d = await fetch("../data/arena-graph.json", { cache: "no-store" }).then(r => r.json());
        const ts = Object.fromEntries((d.meta.sortedTimestamps || []).map(([t, id]) => [id, t]));
        const blocks = d.elements.nodes.map(x => x.data).filter(b => b.class && b.thumb);
        blocks.sort((a, b) => (ts[b.id] || 0) - (ts[a.id] || 0));
        return { live: false, blocks: blocks.slice(0, n).map(b => ({ title: b.label || "", img: b.display || b.thumb, thumb: b.thumb, src: b.source || "#", when: b.connectedAt })) };
      } catch (_) { return { live: false, blocks: [] }; }
    }
  }

  function whenAgo(iso) {
    if (!iso) return "";
    const d = new Date(iso), now = Date.now(), diff = (now - d.getTime()) / 1000;
    if (diff < 3600) return Math.max(1, Math.round(diff / 60)) + "m ago";
    if (diff < 86400) return Math.round(diff / 3600) + "h ago";
    if (diff < 86400 * 30) return Math.round(diff / 86400) + "d ago";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toLowerCase();
  }

  return { SECTION_DEFS, SECTION_KIND, FAVORITES, sections, items, arena, studioThumb, studioHero, whenAgo, snippet, esc };
})();
