# Instrument de mesure : trace chaque appel a _search_with_fuzzy, puis delegue.
import json, os, time, traceback
from odoo import models
from odoo.http import request

LOG = os.environ.get('PROBE_LOG', '/tmp/probe_fuzzy.jsonl')


class Website(models.Model):
    _inherit = 'website'

    def _search_with_fuzzy(self, search_type, search, *args, **kwargs):
        t0 = time.monotonic()
        res = super()._search_with_fuzzy(search_type, search, *args, **kwargs)
        path = None
        try:
            path = request.httprequest.path if request else None
        except Exception:
            pass
        frames = [f"{os.path.relpath(f.filename, os.environ.get('PROBE_ROOT', '/'))}:{f.lineno} {f.name}"
                  for f in traceback.extract_stack()[:-1] if '/addons/' in f.filename][-3:]
        rec = {'type': search_type, 'search': search, 'path': path,
               'uid': self.env.uid, 'public': self.env.user._is_public(),
               'count': res[0], 'ms': round((time.monotonic() - t0) * 1000, 1), 'callers': frames}
        with open(LOG, 'a') as fh:
            fh.write(json.dumps(rec) + '\n')
        return res
