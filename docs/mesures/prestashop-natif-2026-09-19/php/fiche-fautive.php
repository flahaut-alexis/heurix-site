<?php
// Une faute dans une fiche desactive la correction pour tous. Mesure les
// requetes avant et apres l'ajout d'UNE fiche dont la description porte
// « chevile », puis la retire. A lancer depuis la racine de l'installation.
define('_PS_ADMIN_DIR_', getcwd());
require 'config/config.inc.php';
$ctx = Context::getContext(); $ctx->employee = new Employee(1); $ctx->shop = new Shop(1); $ctx->language = new Language(1); $ctx->customer = new Customer(); $ctx->cart = new Cart();
$requetes = ['cheville', 'chevile', 'chevilles'];
$mesurer = function ($etape) use ($ctx, $requetes) {
    foreach ($requetes as $q) {
        $r = Search::find(1, $q, 1, 50, 'position', 'desc', false, false, $ctx);
        echo str_pad($etape, 12), str_pad($q, 12), ' total=', (int) $r['total'], '  ', implode(' | ', array_column($r['result'], 'name')), "\n";
    }
};
$mesurer('sans');
$n = 'Cheville à expansion nylon Ø10 x 50 mm';
$p = new Product(); $p->name = [1 => $n]; $p->link_rewrite = [1 => Tools::str2url($n)];
$p->description = [1 => 'Une chevile à expansion pour béton plein.'];
$p->price = 1; $p->id_category_default = 2; $p->active = 1; $p->visibility = 'both'; $p->add(); $p->addToCategories([2]);
Search::indexation(false);
$mesurer('avec');
$p->delete();
echo 'fiche retiree, produits restants : ', Db::getInstance()->getValue('SELECT COUNT(*) FROM ' . _DB_PREFIX_ . 'product'), "\n";
