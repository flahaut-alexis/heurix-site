// Heurix Search — internal site search (English index)
// Static index, case- and accent-insensitive matching.

const HEURIX_SEARCH_INDEX = [
  { title: "How it works", excerpt: "Up and running in 3 steps: index your catalog, the cascade annotates every product, your customers find.", path: "en/index.html#comment-ca-marche" },
  { title: "The problem", excerpt: "Internal search is the least-monitored conversion point on an online store.", path: "en/produit.html#probleme" },
  { title: "Our mission", excerpt: "Search should never be a burden. It's a conversion lever.", path: "en/produit.html#mission" },
  { title: "The engine", excerpt: "A proprietary search and indexing engine, with regular-expression support for technical catalogs.", path: "en/produit.html#moteur" },
  { title: "Console — dashboard", excerpt: "Top searched terms, zero-result searches, errors, usage. Sign in with your API key.", path: "en/console.html" },
  { title: "Integrations", excerpt: "Technical guides for Shopify, PrestaShop, WooCommerce, Magento — search and catalog sync, with real code.", path: "en/integrations.html" },
  { title: "Features", excerpt: "Annotation cascade, typo tolerance, compound references, business synonyms, explainable results — dedicated page with links into the API docs.", path: "en/fonctionnalites.html" },
  { title: "API Documentation", excerpt: "Complete Search API reference: authentication, indexing, search, synonyms, annotation cascade, good practices.", path: "en/docs.html" },
  { title: "Search API — Pricing", excerpt: "The Heurix search engine, self-service, starting free. Usage-based billing, no commitment.", path: "en/pricing.html" },
  { title: "About — Our story", excerpt: "From an annotation engine born in 2014 to the Heurix e-commerce search engine: the story and the mission.", path: "en/about.html" },
  { title: "ROI simulator", excerpt: "Estimate the leverage of a better-tuned search engine on your revenue.", path: "en/pricing.html#calculator" },
  { title: "Blog", excerpt: "Notes on search and e-commerce, published monthly.", path: "en/blog.html" },
  { title: "FAQ — How do I get started?", excerpt: "Start the 14-day free trial, index a first batch of products, run a search — 3 API calls.", path: "en/faq.html" },
  { title: "FAQ — Can I change plans or cancel anytime?", excerpt: "Yes. Monthly billing, no long-term commitment, no penalty.", path: "en/faq.html" },
  { title: "FAQ — Does Heurix replace Algolia or Elasticsearch?", excerpt: "A different engine, specialized for catalogs where references matter — not a layer on top of existing solutions.", path: "en/faq.html" },
  { title: "FAQ — Do I need to change e-commerce platforms?", excerpt: "No — Heurix plugs into your existing site by API without touching the rest of your architecture.", path: "en/faq.html" },
  { title: "FAQ — Is my industry covered?", excerpt: "Ten rule packs are provided; a fully custom pack is possible on Scale plans.", path: "en/faq.html" },
  { title: "FAQ — Where is my data hosted?", excerpt: "In France, with OVH — your catalogs never leave the European Union.", path: "en/faq.html" },
  { title: "Getting started guide", excerpt: "Three steps to get working search, then three independent optional modules: Tracker, front-end integration, MCP server.", path: "en/blog/guide-mise-en-route.html" },
  { title: "Search engine for PrestaShop", excerpt: "Replace PrestaShop's native search with an engine that understands your technical references. 2-3 day integration.", path: "en/prestashop.html" },
  { title: "Search engine for WooCommerce", excerpt: "Replace WooCommerce's native product search with an engine that understands your technical references. 3-4 day integration.", path: "en/woocommerce.html" },
  { title: "Search engine for Shopify", excerpt: "Improve Shopify search on technical catalogs: typo tolerance, reference spellings, large catalogs.", path: "en/shopify.html" },
  { title: "Hardware & tools", excerpt: "An M8x20 screw and an M8x25 screw have nothing in common for your customer — a generalist engine sees them as nearly identical.", path: "en/solutions/outillage.html" },
  { title: "Spare parts & industry", excerpt: "A 6204-2RS bearing and a 6204-ZZ bearing share the same number. They are not interchangeable.", path: "en/solutions/industrie.html" },
  { title: "Fashion & retail", excerpt: "Compound sizes, colorways, materials, variants — and customers who type fast, with typos.", path: "en/solutions/mode.html" },
  { title: "Electronics & high-tech", excerpt: "A 65W charger and a 45W charger look alike as text. Not in use.", path: "en/solutions/electronique.html" },
  { title: "Books & publishing", excerpt: "Two editions of the same novel share the same title and have two different ISBNs.", path: "en/solutions/livres.html" },
  { title: "Wine & spirits", excerpt: "The vintage isn't a detail: 2015 and 2016 are two different wines, two prices, two availabilities.", path: "en/solutions/vins.html" },
  { title: "Finance & accounting", excerpt: "A SIRET has 14 digits, a SIREN has 9, and both identify the same company.", path: "en/solutions/finance.html" },
  { title: "Legal notice", excerpt: "Legal information about the publisher of heurix.fr.", path: "en/mentions-legales.html" },
  { title: "Privacy Policy", excerpt: "What data Heurix processes, why, for how long, and how to exercise your rights.", path: "en/privacy.html" },
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
