<?php
require 'config/config.inc.php';
$ctx = Context::getContext();
$ctx->shop = new Shop(1); $ctx->language = new Language((int) Configuration::get('PS_LANG_DEFAULT'));
$ctx->customer = new Customer(); $ctx->cart = new Cart();
$idLang = (int) $ctx->language->id;
$src = json_decode(file_get_contents($argv[3]), true); $inv = array_flip(json_decode(file_get_contents($argv[2]), true));
$srcById = []; foreach ($src as $f) $srcById[$f['id']] = $f['src'];
$db = Db::getInstance(); $min = (int) Configuration::get('PS_SEARCH_MINWORDLEN');
$out = [];
foreach (json_decode(file_get_contents($argv[1]), true) as $q) {
    $trace = [];
    foreach (Search::extractKeyWords($q, $idLang, false, 'fr') as $w) {
        if ($w === '' ) continue;
        if (strlen($w) < $min) { $trace[] = "$w:ECARTE(court)"; continue; }
        $n = (int) $db->getValue("SELECT COUNT(DISTINCT si.id_product) FROM "._DB_PREFIX_."search_word sw JOIN "._DB_PREFIX_."search_index si ON sw.id_word=si.id_word WHERE sw.id_lang=$idLang AND sw.word LIKE '".Search::getSearchParamFromWord($w)."'");
        if ($n) { $trace[] = "$w:$n"; continue; }
        $c = Search::findClosestWeightestWord($ctx, $w);
        $trace[] = $c ? "$w=>~$c" : "$w:ABANDONNE";
    }
    $r = Search::find($idLang, $q, 1, 200, 'position', 'desc', false, false, $ctx);
    $noms = []; foreach ($r['result'] as $p) { $id = $inv[$p['id_product']] ?? '?'; $noms[] = [$id, $srcById[$id] ?? '?', $p['name']]; }
    $out[] = ['q' => $q, 'total' => (int) $r['total'], 'trace' => $trace, 'resultats' => $noms];
}
file_put_contents($argv[4], json_encode($out, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));
