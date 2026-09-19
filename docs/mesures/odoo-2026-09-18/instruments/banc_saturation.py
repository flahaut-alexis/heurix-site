# Instrument de mesure : N recherches simultanees pendant une panne, et le temps d'une page sans recherche.
import sys, time, threading, requests

BASE, DB, URL, N, TO = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), sys.argv[5]
v20 = DB == 'o20'
adm = requests.Session()
adm.post(BASE + '/web/session/authenticate', json={'jsonrpc': '2.0', 'method': 'call', 'params': {'db': DB, 'login': 'admin', 'password': 'admin'}})
adm.post(BASE + '/web/dataset/call_kw', json={'jsonrpc': '2.0', 'method': 'call', 'params': {
    'model': 'ir.config_parameter', 'method': 'set_str' if v20 else 'set_param', 'args': ['probe.heurix_url', URL], 'kwargs': {}}})
adm.post(BASE + '/web/dataset/call_kw', json={'jsonrpc': '2.0', 'method': 'call', 'params': {
    'model': 'ir.config_parameter', 'method': 'set_str' if v20 else 'set_param', 'args': ['probe.timeout', TO], 'kwargs': {}}})
fin = {}


def chercher(i):
    t = time.monotonic(); requests.get(BASE + f'/shop?search=desk{i}', timeout=120); fin[i] = time.monotonic() - t


ths = [threading.Thread(target=chercher, args=(i,)) for i in range(N)]
[t.start() for t in ths]
time.sleep(0.3)
res = {}
def page():
    t = time.monotonic(); requests.get(BASE + '/contactus', timeout=120); res['page'] = time.monotonic() - t
tp = threading.Thread(target=page); tp.start()
t = time.monotonic(); r2 = adm.post(BASE + '/web/dataset/call_kw', json={'jsonrpc': '2.0', 'method': 'call', 'params': {'model': 'sale.order', 'method': 'search_read', 'args': [[]], 'kwargs': {'fields': ['name'], 'limit': 5}}}); bo = time.monotonic() - t
tp.join(); page = res['page']
[t.join() for t in ths]
adm.post(BASE + '/web/dataset/call_kw', json={'jsonrpc': '2.0', 'method': 'call', 'params': {
    'model': 'ir.config_parameter', 'method': 'set_str' if v20 else 'set_param', 'args': ['probe.heurix_url', ''], 'kwargs': {}}})
print(f'timeout {TO}s {URL or "module inactif":40s} N={N}  /contactus {page:5.2f} s  back-office {bo:5.2f} s  recherches: max {max(fin.values()):5.2f} s')
