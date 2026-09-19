# Instrument de mesure : temps vu par le client, par cas de panne, sur /shop?search= et l'autocompletion.
import json, statistics, sys, time, requests

BASE, DB, TIMEOUT, REPS = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
v20 = DB == 'o20'
F = 'http://127.0.0.1:8099'
CAS = [
    ('cle absente (module inactif)', ''),
    ('succes rapide (faux 200)', F + '/ok'),
    ('cle invalide (production, 403 reel)', 'https://api.heurix.fr/v1/index/visserie/search'),
    ('refus quota 429', F + '/429'),
    ('refus paiement 402', F + '/402'),
    ('panne 503', F + '/503'),
    ('lent 1,5 s', F + '/slow/1500'),
    ('lent 5 s', F + '/slow/5000'),
    ('ne repond pas (connexion ouverte, rien)', F + '/hang'),
    ('port ferme (connexion refusee)', 'http://127.0.0.1:8098/x'),
    ('DNS inexistant', 'http://heurix.invalid/x'),
    ('hote injoignable (paquets perdus)', 'http://10.255.255.1/x'),
]
adm = requests.Session()
adm.post(BASE + '/web/session/authenticate', json={'jsonrpc': '2.0', 'method': 'call', 'params': {'db': DB, 'login': 'admin', 'password': 'admin'}})


def setp(k, v):
    adm.post(BASE + '/web/dataset/call_kw', json={'jsonrpc': '2.0', 'method': 'call', 'params': {
        'model': 'ir.config_parameter', 'method': 'set_str' if v20 else 'set_param', 'args': [k, v], 'kwargs': {}}}).raise_for_status()


setp('probe.timeout', TIMEOUT)
ac = {'search_type': 'products', 'term': 'desk', 'order': 'name asc', 'limit': 8, 'max_nb_chars': 50,
      'options': {'displayImage': True, 'displayDescription': True, 'displayExtraLink': True, 'displayDetail': True, 'allowFuzzy': True}}
if v20:
    ac['offset'] = 0
print(f'timeout={TIMEOUT}s  {DB}  mediane / max sur {REPS} essais, en secondes')
for nom, url in CAS:
    setp('probe.heurix_url', url)
    pub = requests.Session()
    pub.get(BASE + '/shop')  # session publique chaude
    t_shop, t_ac = [], []
    for _ in range(REPS):
        t = time.monotonic(); r = pub.get(BASE + '/shop?search=desk', timeout=120); t_shop.append(time.monotonic() - t)
        assert r.status_code == 200 and 'desk' in r.text.lower(), (nom, r.status_code)
        t = time.monotonic(); r = pub.post(BASE + '/website/snippet/autocomplete', json={'jsonrpc': '2.0', 'method': 'call', 'params': ac}, timeout=120); t_ac.append(time.monotonic() - t)
        assert 'result' in r.json() and r.json()['result']['results_count'] > 0, (nom, r.text[:200])
    print(f'{nom:42s} /shop {statistics.median(t_shop):6.3f} / {max(t_shop):6.3f}   autocomplete {statistics.median(t_ac):6.3f} / {max(t_ac):6.3f}')
setp('probe.heurix_url', '')
