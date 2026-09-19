<?php
define('_PS_ADMIN_DIR_', getcwd());
require 'config/config.inc.php';
Context::getContext()->employee = new Employee(1);
$cat = json_decode(file_get_contents($argv[1]), true);
$idLang = (int) Configuration::get('PS_LANG_DEFAULT');
$marques = [];
$map = [];
foreach ($cat as $f) {
    $idM = 0;
    if ($f['brand'] !== '') {
        if (!isset($marques[$f['brand']])) {
            $m = new Manufacturer(); $m->name = $f['brand']; $m->active = 1; $m->add();
            $marques[$f['brand']] = (int) $m->id;
        }
        $idM = $marques[$f['brand']];
    }
    $p = new Product();
    $p->name = [$idLang => mb_substr($f['name'], 0, 128)];
    $p->link_rewrite = [$idLang => Tools::str2url(mb_substr($f['name'], 0, 100)) ?: 'p'];
    $p->description = [$idLang => $f['desc']];
    $p->reference = $f['ref'];
    $p->price = $f['price'];
    $p->id_category_default = 2;
    $p->id_manufacturer = $idM;
    $p->active = 1;
    $p->visibility = 'both';
    $p->add();
    $p->addToCategories([2]);
    StockAvailable::setQuantity($p->id, 0, 100);
    $map[$f['id']] = (int) $p->id;
}
Search::indexation(true);
file_put_contents($argv[2], json_encode($map));
echo count($map), " produits, ", Db::getInstance()->getValue('SELECT COUNT(*) FROM '._DB_PREFIX_.'search_word'), " mots indexés\n";
