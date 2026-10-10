"""Local dev server: serves this folder with caching off, so edits show up on reload.

    python3 serve.py          # http://localhost:8080 (also reachable from other devices on your Wi-Fi)
"""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


os.chdir(os.path.dirname(os.path.abspath(__file__)))
print(f"Snakes at http://localhost:{PORT}")
http.server.ThreadingHTTPServer(("", PORT), NoCacheHandler).serve_forever()
