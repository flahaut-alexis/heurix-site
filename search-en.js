// Heurix Search — internal site search (English index)
// Static index, case- and accent-insensitive matching.

const HEURIX_SEARCH_INDEX = [
  { title: "The problem", excerpt: "Internal search is the least-monitored conversion point on an online store.", path: "en/index.html#probleme" },
  { title: "How it works", excerpt: "Up and running in 3 steps: index your catalog, the cascade annotates every product, your customers find.", path: "en/index.html#comment-ca-marche" },
  { title: "Our mission", excerpt: "Search should never be a burden. It's a conversion lever.", path: "en/index.html#mission" },
  { title: "Console — dashboard", excerpt: "Top searched terms, zero-result searches, errors, usage. Sign in with your API key.", path: "en/console.html" },
  { title: "Features", excerpt: "Annotation cascade, typo tolerance, compound references, business synonyms, explainable results — dedicated page with links into the API docs.", path: "en/fonctionnalites.html" },
  { title: "API Documentation", excerpt: "Complete Search API reference: authentication, indexing, search, synonyms, annotation cascade, good practices.", path: "en/docs.html" },
  { title: "Search API — Pricing", excerpt: "The Heurix search engine, self-service, starting free. Usage-based billing, no commitment.", path: "en/pricing.html" },
  { title: "The engine", excerpt: "A proprietary search and indexing engine, with regular-expression support for technical catalogs.", path: "en/index.html#moteur" },
  { title: "About — Our story", excerpt: "From an annotation engine born in 2014 to the Heurix e-commerce search engine: the story and the mission.", path: "en/about.html" },
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

// Latest blog articles — shown by default, before any typing.
const HEURIX_LATEST_ARTICLES = [
  "en/blog/recherche-reference-sku-b2b.html",
  "en/blog/impact-ebitda-recherche-interne.html",
  "en/blog/5-signes-recherche-vous-coute-des-ventes.html"
].map((p) => HEURIX_SEARCH_INDEX.find((item) => item.path === p)).filter(Boolean);

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
    const depth = (window.location.pathname.match(/\/en\/blog\//) ? 2 : window.location.pathname.match(/\/en\//) ? 1 : 0);
    const root = depth === 2 ? "../../" : depth === 1 ? "../" : "";

    const btn = document.getElementById("heurix-search-btn");
    const modal = document.getElementById("heurix-search-modal");
    const backdrop = document.getElementById("heurix-search-backdrop");
    const input = document.getElementById("heurix-search-input");
    const resultsEl = document.getElementById("heurix-search-results");
    const emptyEl = document.getElementById("heurix-search-empty");
    const suggestLabel = document.getElementById("heurix-search-suggest-label");
    if (!btn || !modal) return;

    function renderItems(items, query) {
      resultsEl.innerHTML = "";
      items.forEach((item) => {
        const a = document.createElement("a");
        a.className = "search-result";
        a.href = root + item.path;
        a.innerHTML =
          '<div class="search-result-title">' + highlight(item.title, query) + "</div>" +
          '<div class="search-result-excerpt">' + highlight(item.excerpt, query) + "</div>";
        resultsEl.appendChild(a);
      });
    }

    function showDefaultSuggestions() {
      emptyEl.hidden = true;
      if (suggestLabel) suggestLabel.hidden = false;
      renderItems(HEURIX_LATEST_ARTICLES, "");
    }

    function open() {
      modal.classList.add("open");
      document.body.style.overflow = "hidden";
      input.value = "";
      showDefaultSuggestions();
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
      if (!q.trim()) {
        showDefaultSuggestions();
        return;
      }
      if (suggestLabel) suggestLabel.hidden = true;
      const results = runSearch(q);
      emptyEl.hidden = results.length !== 0;
      renderItems(results, q);
    });

    modal.querySelectorAll("[data-search-close]").forEach((el) => el.addEventListener("click", close));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
