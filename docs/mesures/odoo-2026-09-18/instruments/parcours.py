# Instrument de mesure : joue les routes publiques puis le back-office, et note chaque etape
# dans le journal de la sonde (ligne {"etape": ...}) pour attribuer les appels.
import json, os, sys, requests

BASE, DB, LOG = sys.argv[1], sys.argv[2], os.environ['PROBE_LOG']
v20 = DB == 'o20'


def etape(nom):
    with open(LOG, 'a') as fh:
        fh.write(json.dumps({'etape': nom}) + '\n')


def rpc(s, url, params):
    r = s.post(BASE + url, json={'jsonrpc': '2.0', 'method': 'call', 'params': params}, timeout=60)
    return r.status_code, r.json().get('error', {}).get('data', {}).get('message') if r.ok else r.text[:80]


def kw(s, model, method, args, kwargs=None):
    return rpc(s, '/web/dataset/call_kw', {'model': model, 'method': method, 'args': args, 'kwargs': kwargs or {}})


pub = requests.Session()
cat_id = None
for nom, url in [
    ('shop', '/shop'), ('shop page 2', '/shop/page/2'),
    ('shop tri prix', '/shop?order=list_price+asc'),
    ('shop categorie', '/shop/category/1'),
    ('shop filtre attribut', '/shop?attribute_value=1-1'),
    ('shop filtre prix', '/shop?min_price=10&max_price=500'),
    ('shop recherche', '/shop?search=desk'), ('shop recherche floue', '/shop?search=dosk'),
    ('shop recherche + categorie', '/shop/category/1?search=desk'),
('panier', '/shop/cart'), ('wishlist', '/shop/wishlist'),
    ('comparaison', '/shop/compare'),
    ('website/search all', '/website/search?search=desk'),
    ('website/search products', '/website/search/products?search=desk'),
    ('blog recherche', '/blog?search=desk'), ('blog', '/blog'),
    ('event recherche', '/event?search=desk'), ('event', '/event'),
    ('forum recherche', '/forum/1?search=desk'), ('forum', '/forum/1'),
    ('jobs recherche', '/jobs?search=desk'), ('jobs', '/jobs'),
    ('slides recherche', '/slides/all?search=desk'), ('slides', '/slides'),
    ('accueil', '/'), ('contactus', '/contactus'),
]:
    etape('public ' + nom)
    r = pub.get(BASE + url, timeout=60)
    print(f'{r.status_code} public {nom}')

import re
m = re.search(r'href="(/shop/[a-z0-9-]+-\d+)"', pub.get(BASE + '/shop', timeout=60).text)
etape('public fiche produit')
print(pub.get(BASE + m.group(1), timeout=60).status_code, 'public fiche produit', m.group(1))
for t in ['products', 'products_only' if not v20 else 'product_template', 'all', 'blogs' if not v20 else 'blog_post',
          'events', 'forums' if not v20 else 'forum_post', 'slides', 'jobs', 'pages']:
    etape('autocomplete ' + t)
    p = {'search_type': t, 'term': 'desk', 'order': 'name asc', 'limit': 5, 'max_nb_chars': 50,
         'options': {'displayImage': True, 'displayDescription': True, 'displayExtraLink': True, 'displayDetail': True, 'allowFuzzy': True}}
    if v20:
        p['offset'] = 0
    print(rpc(pub, '/website/snippet/autocomplete', p), 'autocomplete', t)

adm = requests.Session()
etape('login admin')
print(rpc(adm, '/web/session/authenticate', {'db': DB, 'login': 'admin', 'password': 'admin'})[0], 'login')
for nom, url in [('admin shop', '/shop'), ('admin shop recherche', '/shop?search=desk'),
                 ('admin backend', '/odoo'), ('admin action produits', '/odoo/action-website_sale.product_template_action_website')]:
    etape(nom)
    print(adm.get(BASE + url, timeout=60).status_code, nom)
for nom, args in [
    ('orm name_search produit', ('product.template', 'name_search', [], {'name': 'desk'})),
    ('orm web_search_read produit', ('product.template', 'web_search_read', [[['name', 'ilike', 'desk']]], {'specification': {'name': {}}})),
    ('orm search_read commandes', ('sale.order', 'search_read', [[]], {'fields': ['name'], 'limit': 5})),
    ('orm name_search page', ('website.page', 'name_search', [], {'name': 'home'})),
    ('orm name_search blog', ('blog.post', 'name_search', [], {'name': 'a'})),
]:
    etape(nom)
    print(kw(adm, *args), nom)
etape('rapport commande html')
st, _ = kw(adm, 'sale.order', 'search', [[]], {'limit': 1})
print(adm.get(BASE + '/report/html/sale.report_saleorder/1', timeout=60).status_code, 'rapport')
etape('tous les crons')
r = adm.post(BASE + '/web/dataset/call_kw', json={'jsonrpc': '2.0', 'method': 'call', 'params': {'model': 'ir.cron', 'method': 'search_read', 'args': [[]], 'kwargs': {'fields': ['id', 'name']}}}).json()['result']
ok = 0
for c in r:
    st, err = kw(adm, 'ir.cron', 'method_direct_trigger', [[c['id']]])
    ok += st == 200 and not err
print(f'crons declenches {ok}/{len(r)}')
