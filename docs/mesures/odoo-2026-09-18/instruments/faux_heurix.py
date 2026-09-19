# Instrument de mesure : simule les reponses d'Heurix. Le chemin choisit le cas.
#   /ok  /401  /403  /429  /402  /503  /hang (ne repond jamais)  /slow/<ms>
import json, sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_POST(self):
        self.rfile.read(int(self.headers.get('Content-Length', 0)))
        parts = self.path.strip('/').split('/')
        if parts[0] == 'hang':
            time.sleep(3600)
            return
        code, body = 200, {'ids': [], 'total': 0}
        if parts[0] == 'slow':
            time.sleep(int(parts[1]) / 1000)
        elif parts[0].isdigit():
            code, body = int(parts[0]), {'detail': 'faux ' + parts[0]}
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)


ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
