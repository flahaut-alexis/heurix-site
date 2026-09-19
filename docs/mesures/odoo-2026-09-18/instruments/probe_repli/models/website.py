# Instrument de mesure : cout d'un appel Heurix suivi du repli natif.
# Pas de disjoncteur : on mesure le cout brut d'une requete.
import json, os, time
import requests
from odoo import models

LOG = os.environ.get('PROBE_REPLI_LOG', '/tmp/probe_repli.jsonl')
PRODUITS = {'products', 'products_only', 'product_template', 'all'}


class Website(models.Model):
    _inherit = 'website'

    def _search_with_fuzzy(self, search_type, search, *args, **kwargs):
        icp = self.env['ir.config_parameter'].sudo()
        get = getattr(icp, 'get_str', None) or icp.get_param  # 20.0 : get_str ; avant : get_param
        url = get('probe.heurix_url')
        if search_type not in PRODUITS or not search or not url:
            return super()._search_with_fuzzy(search_type, search, *args, **kwargs)
        timeout = float(get('probe.timeout') or 3)
        t0 = time.monotonic()
        issue = 'ok'
        try:
            r = requests.post(url, json={'q': search, 'ids_only': True}, timeout=timeout,
                              headers={'Authorization': 'Bearer hx_faux'})
            if r.status_code != 200:
                issue = f'http {r.status_code}'
        except requests.RequestException as e:
            issue = type(e).__name__
        t1 = time.monotonic()
        res = super()._search_with_fuzzy(search_type, search, *args, **kwargs)
        t2 = time.monotonic()
        with open(LOG, 'a') as fh:
            fh.write(json.dumps({'url': url, 'timeout': timeout, 'issue': issue, 'type': search_type,
                                 'heurix_ms': round((t1 - t0) * 1000, 1),
                                 'natif_ms': round((t2 - t1) * 1000, 1)}) + '\n')
        return res
