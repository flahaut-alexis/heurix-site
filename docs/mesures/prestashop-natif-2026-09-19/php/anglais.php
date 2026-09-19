<?php
define('_PS_ADMIN_DIR_', getcwd());
require 'config/config.inc.php';
$ctx = Context::getContext(); $ctx->employee = new Employee(1); $ctx->shop = new Shop(1); $ctx->language = new Language(1); $ctx->customer = new Customer(); $ctx->cart = new Cart();
$ids = [];
foreach (['Flat washer M8 stainless steel A2', 'Spring washer M10 zinc plated'] as $n) {
  $p = new Product(); $p->name = [1 => $n]; $p->link_rewrite = [1 => Tools::str2url($n)]; $p->price = 1; $p->id_category_default = 2; $p->active = 1; $p->visibility = 'both'; $p->add(); $p->addToCategories([2]); $ids[] = $p->id;
}
Search::indexation(false);
foreach (['washer', 'wahser', 'washr', 'washers', 'flat wahser m8'] as $q) {
  $r = Search::find(1, $q, 1, 50, 'position', 'desc', false, false, $ctx);
  echo str_pad($q, 18), ' total=', $r['total'], '  ', implode(' | ', array_column($r['result'], 'name')), "\n";
}
foreach ($ids as $id) { (new Product($id))->delete(); }
echo 'supprimés: ', implode(',', $ids), ' ; produits restants: ', Db::getInstance()->getValue('SELECT COUNT(*) FROM '._DB_PREFIX_.'product'), "\n";
