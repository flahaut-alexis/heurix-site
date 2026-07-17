// Heurix — internal site search (English index)
// Static index, case- and accent-insensitive matching.

const HEURIX_SEARCH_INDEX = [
  { title: "The problem", excerpt: "Internal search is the least-monitored conversion point on an online store.", path: "en/index.html#probleme" },
  { title: "The offer", excerpt: "Audit, integration, training, ongoing optimization — four steps in the order that makes sense.", path: "en/index.html#offre" },
  { title: "Search API — Pricing", excerpt: "The Heurix search engine, self-service, starting free. Usage-based billing, no commitment.", path: "en/pricing.html" },
  { title: "The engine", excerpt: "A proprietary search and indexing engine, with regular-expression support for technical catalogs.", path: "en/index.html#moteur" },
  { title: "About us", excerpt: "Independent expertise, made in France. Company and engine designed and built in France.", path: "en/index.html#apropos" },
  { title: "Who it's for: Is Heurix right for you?", excerpt: "Sizeable SME and mid-market, large technical catalog, not yet equipped with a dedicated engine.", path: "en/index.html#pourqui" },
  { title: "ROI simulator", excerpt: "Estimate the leverage of a better-tuned search engine on your revenue.", path: "en/index.html#tarifs" },
  { title: "Blog", excerpt: "Notes on search and e-commerce, published monthly.", path: "en/blog.html" },
  { title: "FAQ — How much does a mission cost?", excerpt: "Billed daily, €850/day excl. VAT, quoted based on exact scope.", path: "en/index.html#faq" },
  { title: "FAQ — What if the results don't show up?", excerpt: "No subscription, no long-term commitment — the initial audit limits your risk.", path: "en/index.html#faq" },
  { title: "FAQ — Do I need to change e-commerce platforms?", excerpt: "No — Heurix works on the search layer without touching the rest of your architecture.", path: "en/index.html#faq" },
  { title: "FAQ — Proprietary engine or Algolia / Elasticsearch / Typesense?", excerpt: "The choice is made during the audit, based on your catalog, budget, and existing setup.", path: "en/index.html#faq" },
  { title: "Quote / Contact", excerpt: "Book your initial audit — response within 48 business hours.", path: "en/index.html#contact" },
  { title: "Legal notice", excerpt: "Legal information about the publisher of heurix.fr.", path: "en/mentions-legales.html" },
  { title: "How to configure search by reference (SKU, DIN, ISO) on a B2B e-commerce site?", excerpt: "Why default engines fail on technical product codes, and how regex changes the game.", path: "en/blog/recherche-reference-sku-b2b.html" },
  { title: "Shopify, PrestaShop, Magento: why native search fails past 10,000 references?", excerpt: "Indexing limits of large catalogs, and how to fix it without rebuilding the site.", path: "en/blog/limites-moteurs-natifs-gros-catalogue.html" },
  { title: "Faceted search in B2B: how to structure multi-attribute filters?", excerpt: "Designing dynamic, well-ordered facets for technical catalogs.", path: "en/blog/facettes-b2b-multi-attributs.html" },
  { title: "Synonyms and industry jargon", excerpt: "Designing a business synonym dictionary without creating false positives.", path: "en/blog/synonymes-jargon-industriel.html" },
  { title: "Poor internal search: what's the real impact on EBITDA?", excerpt: "The economic leverage of internal search, and a simple method to size the current loss.", path: "en/blog/impact-ebitda-recherche-interne.html" },
  { title: "Why your platform's native search engine isn't enough", excerpt: "The three most common blind spots in default search engines.", path: "en/blog/moteur-natif-ne-suffit-pas.html" },
  { title: "5 signs your search engine is costing you sales", excerpt: "Concrete symptoms to check on your own site, in under ten minutes.", path: "en/blog/5-signes-recherche-vous-coute-des-ventes.html" },
  { title: "The e-commerce search glossary, no jargon", excerpt: "Synonyms, facets, typo tolerance: what these terms actually mean.", path: "en/blog/glossaire-search-ecommerce.html" }
];

(function () {
  function normalize(str) {
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function highlight(text, query) {
    if (!query) return text;
    const nText = normalize(text);
    const nQuery = normalize(query);
    const idx = nText.indexOf(nQuery);
    if (idx === -1) return text;
    return text.slice(0, idx) + "<mark>" + text.slice(idx, idx + query.length) + "</mark>" + text.slice(idx + query.length);
  }

  function runSearch(query) {
    const nQuery = normalize(query.trim());
    if (!nQuery) return [];
    return HEURIX_SEARCH_INDEX
      .map((item) => {
        const nTitle = normalize(item.title);
        const nExcerpt = normalize(item.excerpt);
        let score = -1;
        if (nTitle.includes(nQuery)) score = nTitle.indexOf(nQuery) === 0 ? 2 : 1;
        else if (nExcerpt.includes(nQuery)) score = 0;
        return { item, score };
      })
      .filter((r) => r.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.item)
      .slice(0, 8);
  }

  function init() {
    // All EN index paths are root-relative (e.g. "en/index.html#..."), so we
    // always resolve from the actual site root regardless of current page depth.
    const depth = (window.location.pathname.match(/\/en\/blog\//) ? 2 : window.location.pathname.match(/\/en\//) ? 1 : 0);
    const root = depth === 2 ? "../../" : depth === 1 ? "../" : "";

    const btn = document.getElementById("heurix-search-btn");
    const modal = document.getElementById("heurix-search-modal");
    const backdrop = document.getElementById("heurix-search-backdrop");
    const input = document.getElementById("heurix-search-input");
    const resultsEl = document.getElementById("heurix-search-results");
    const emptyEl = document.getElementById("heurix-search-empty");
    if (!btn || !modal) return;

    function open() {
      modal.classList.add("open");
      document.body.style.overflow = "hidden";
      input.value = "";
      resultsEl.innerHTML = "";
      emptyEl.hidden = true;
      setTimeout(() => input.focus(), 10);
      if (window.dataLayer) window.dataLayer.push({ event: "site_search_open" });
    }
    function close() {
      modal.classList.remove("open");
      document.body.style.overflow = "";
    }

    btn.addEventListener("click", open);
    backdrop.addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("open")) close();
      if ((e.key === "/" || (e.ctrlKey && e.key === "k") || (e.metaKey && e.key === "k")) &&
          document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        e.preventDefault();
        open();
      }
    });

    input.addEventListener("input", () => {
      const q = input.value;
      const results = runSearch(q);
      resultsEl.innerHTML = "";
      emptyEl.hidden = !(q.trim() && results.length === 0);
      results.forEach((item) => {
        const a = document.createElement("a");
        a.className = "search-result";
        a.href = root + item.path;
        a.innerHTML =
          '<div class="search-result-title">' + highlight(item.title, q) + "</div>" +
          '<div class="search-result-excerpt">' + highlight(item.excerpt, q) + "</div>";
        resultsEl.appendChild(a);
      });
    });

    modal.querySelectorAll("[data-search-close]").forEach((el) => el.addEventListener("click", close));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
