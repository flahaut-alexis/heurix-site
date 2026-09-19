<?php
require 'config/config.inc.php';
use PrestaShop\PrestaShop\Core\Product\Search\ProductSearchContext;
use PrestaShop\PrestaShop\Core\Product\Search\ProductSearchQuery;
use PrestaShop\PrestaShop\Core\Product\Search\SortOrder;
use PrestaShop\PrestaShop\Adapter\Search\SearchProductSearchProvider;
$ctx = Context::getContext();
$ctx->shop = new Shop(1); $ctx->language = new Language(1); $ctx->customer = new Customer(); $ctx->cart = new Cart(); $ctx->currency = new Currency((int) Configuration::get('PS_CURRENCY_DEFAULT'));
$ctx->country = new Country((int) Configuration::get('PS_COUNTRY_DEFAULT'));
$tr = new Symfony\Component\Translation\IdentityTranslator();
$inv = array_flip(json_decode(file_get_contents($argv[2]), true));
$src = []; foreach (json_decode(file_get_contents($argv[3]), true) as $f) $src[$f['id']] = [$f['src'], $f['name']];
$psctx = new ProductSearchContext($ctx);
$perPage = (int) Configuration::get('PS_PRODUCTS_PER_PAGE');
$out = [];
foreach (json_decode(file_get_contents($argv[1]), true) as $q) {
    $row = ['q' => $q];
    foreach (['natif', 'module'] as $mode) {
        $query = (new ProductSearchQuery())->setQueryType('search')->setSortOrder(new SortOrder('product', 'position', 'desc'))->setSearchString($q);
        $provider = null;
        if ($mode === 'module') {
            foreach ((array) Hook::exec('productSearchProvider', ['query' => $query], null, true) as $p) { if ($p) { $provider = $p; break; } }
            if (!$provider) { $row[$mode] = 'AUCUN FOURNISSEUR'; continue; }
            $row['classe_module'] = get_class($provider);
        } else {
            $provider = new SearchProductSearchProvider($tr);
        }
        $query->setResultsPerPage($perPage)->setPage(1);
        $t = microtime(true);
        $res = $provider->runQuery($psctx, $query);
        $ids = array_map(fn($p) => (int) $p['id_product'], $res->getProducts());
        $row[$mode] = ['total' => $res->getTotalProductsCount(), 'ms' => (int) ((microtime(true) - $t) * 1000),
            'page1' => array_map(fn($id) => ($inv[$id] ?? "?$id"), $ids)];
    }
    $out[] = $row;
}
$out[] = ['_meta' => ['par_page' => $perPage, 'derniere_panne' => Configuration::get('HEURIX_LAST_FAILURE')]];
file_put_contents($argv[4], json_encode($out, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
echo "ok ", count($out) - 1, " requetes, par page $perPage\n";
