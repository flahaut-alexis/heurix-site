// Heurix Search — recherche interne du site
// Index statique, correspondance insensible à la casse et aux accents.

const HEURIX_SEARCH_INDEX = [
  { title: "Le problème", excerpt: "La recherche interne est le point de conversion le moins surveillé d'un site marchand.", path: "index.html#probleme" },
  { title: "Comment ça marche", excerpt: "Opérationnel en 3 étapes : indexez votre catalogue, la cascade annote chaque produit, vos clients trouvent.", path: "index.html#comment-ca-marche" },
  { title: "Notre mission", excerpt: "La recherche ne devrait jamais être un fardeau. C'est un levier de conversion.", path: "index.html#mission" },
  { title: "Console — tableau de bord", excerpt: "Mots les plus recherchés, recherches sans résultat, erreurs, consommation. Connexion avec votre clé API.", path: "console.html" },
  { title: "Intégrations", excerpt: "Guides techniques Shopify, PrestaShop, WooCommerce, Magento — recherche et synchronisation de catalogue, avec du vrai code.", path: "integrations.html" },
  { title: "Fonctionnalités", excerpt: "Cascade d'annotations, tolérance aux fautes, références composées, synonymes métier, résultats explicables — page dédiée avec liens vers la doc API.", path: "fonctionnalites.html" },
  { title: "Documentation API", excerpt: "Référence complète du Search API : authentification, indexation, recherche, synonymes, cascade d'annotations, bonnes pratiques.", path: "docs.html" },
  { title: "Search API — Tarifs", excerpt: "Le moteur de recherche Heurix en self-service, à partir de gratuit. Facturation à l'usage, sans engagement.", path: "pricing.html" },
  { title: "Le moteur", excerpt: "Un moteur de recherche et d'indexation développé en propre, avec expressions régulières pour les catalogues techniques.", path: "index.html#moteur" },
  { title: "À propos — Notre histoire", excerpt: "D'un moteur d'annotation né en 2014 au moteur de recherche e-commerce Heurix : l'histoire et la mission.", path: "about.html" },
  { title: "Simulateur ROI", excerpt: "Estimez l'effet de levier d'un moteur de recherche mieux réglé sur votre chiffre d'affaires.", path: "index.html#tarifs" },
  { title: "Blog", excerpt: "Notes sur la recherche et le e-commerce, publiées chaque mois.", path: "blog.html" },
  { title: "FAQ — Combien coûte une mission ?", excerpt: "Facturation à la journée, 850 € HT/jour, sur devis établi selon le périmètre.", path: "index.html#faq" },
  { title: "FAQ — Et si les résultats ne sont pas au rendez-vous ?", excerpt: "Pas d'abonnement, pas d'engagement dans la durée : l'audit initial limite le risque.", path: "index.html#faq" },
  { title: "FAQ — Dois-je changer de plateforme e-commerce ?", excerpt: "Non, Heurix intervient sur la couche recherche sans toucher au reste de votre architecture.", path: "index.html#faq" },
  { title: "FAQ — Moteur propriétaire ou Algolia / Elasticsearch / Typesense ?", excerpt: "Le choix se fait pendant l'audit, selon votre catalogue, votre budget et votre existant.", path: "index.html#faq" },
  { title: "Devis / Contact", excerpt: "Réservez votre audit initial — réponse sous 48h ouvrées.", path: "index.html#contact" },
  { title: "Mentions légales", excerpt: "Informations légales sur l'éditeur du site heurix.fr.", path: "mentions-legales.html" },
  { title: "Comment configurer la recherche par référence (SKU, DIN, ISO) sur un e-commerce B2B ?", excerpt: "Pourquoi les moteurs par défaut échouent sur les codes produits techniques, et comment les regex changent la donne.", path: "blog/recherche-reference-sku-b2b.html" },
  { title: "Shopify, PrestaShop, Magento : pourquoi leurs moteurs natifs échouent au-delà de 10 000 références ?", excerpt: "Les limites d'indexation des gros catalogues, et comment y remédier sans refondre le site.", path: "blog/limites-moteurs-natifs-gros-catalogue.html" },
  { title: "Recherche à facettes en B2B : comment structurer vos filtres multi-attributs ?", excerpt: "Concevoir des facettes dynamiques et bien ordonnées pour des catalogues techniques.", path: "blog/facettes-b2b-multi-attributs.html" },
  { title: "Synonymes et jargon industriel", excerpt: "Concevoir un dictionnaire de synonymes métier sans créer de faux positifs.", path: "blog/synonymes-jargon-industriel.html" },
  { title: "Mauvais moteur de recherche interne : quel impact réel sur l'EBITDA ?", excerpt: "Le levier économique de la recherche interne, et une méthode simple pour chiffrer la perte actuelle.", path: "blog/impact-ebitda-recherche-interne.html" },
  { title: "Pourquoi le moteur natif de votre plateforme ne suffit pas", excerpt: "Les trois angles morts les plus fréquents des moteurs livrés par défaut.", path: "blog/moteur-natif-ne-suffit-pas.html" },
  { title: "5 signes que votre moteur de recherche vous coûte des ventes", excerpt: "Des symptômes concrets à vérifier sur votre propre site, en moins de dix minutes.", path: "blog/5-signes-recherche-vous-coute-des-ventes.html" },
  { title: "Le glossaire du search e-commerce, sans jargon", excerpt: "Synonymes, facettes, tolérance aux fautes : ce que ces termes veulent dire concrètement.", path: "blog/glossaire-search-ecommerce.html" },
  { title: "Algolia, Typesense, Meilisearch : quelle alternative pour un catalogue technique ?", excerpt: "Comparatif honnête entre les moteurs les plus courants, du point de vue d'un catalogue technique.", path: "blog/alternative-algolia-catalogue-technique.html" },
  { title: "La recherche de votre blog ou de votre FAQ mérite aussi d'être bonne", excerpt: "Le search e-commerce oublie souvent le contenu éditorial — un point aveugle coûteux.", path: "blog/recherche-blog-faq-contenu.html" },
  { title: "Recherches sans résultat : le tableau de bord que la plupart des sites n'ont pas", excerpt: "Vos clients tapent exactement ce qu'ils veulent acheter — peu de sites savent quand ça échoue.", path: "blog/recherches-sans-resultat-tableau-bord.html" },
  { title: "Combien coûte un moteur de recherche e-commerce en 2026 ?", excerpt: "Les modèles de facturation comparés, et comment estimer votre propre volume.", path: "blog/cout-moteur-recherche-ecommerce.html" }
];

// Derniers articles du blog — affichés par défaut, avant toute frappe.
const HEURIX_LATEST_ARTICLES = [
  "blog/cout-moteur-recherche-ecommerce.html",
  "blog/recherches-sans-resultat-tableau-bord.html",
  "blog/recherche-blog-faq-contenu.html"
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
    const root = window.location.pathname.includes("/blog/") ? "../" : "";
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
