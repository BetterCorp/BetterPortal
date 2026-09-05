"""Loopback-only conformance adapter; never mount this in a consumer service."""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "python"))
from betterportal.contracts import contract, export
import anyvali as av


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            schema = av.import_schema(body["document"]) if "document" in body else contract(body["contract"])
            if body.get("action") == "roundtrip":
                schema = av.import_schema(export(schema))
            if body.get("action") == "import":
                payload = {"valid": True, "output": True, "document": export(schema)}
            else:
                result = schema.safe_parse(body["input"])
                payload = {"valid": result.success, "document": export(schema)}
                if result.success:
                    payload["output"] = result.data
            if body.get("action") == "encrypt":
                payload = {"valid": True, "output": av.encrypt(schema, body["input"], lambda path, value: "encrypted:" + json.dumps(value, separators=(",", ":")))}
            if body.get("action") == "decrypt":
                payload = {"valid": True, "output": av.decrypt(schema, body["input"], lambda path, value: json.loads(value[len("encrypted:"):]))}
            if body.get("action") == "encrypted":
                result = av.safe_parse_encrypted(schema, body["input"])
                payload = {"valid": result.success, "output": result.data}
            self.send_response(200)
        except Exception as error:
            payload = {"error": str(error)}
            self.send_response(500)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode())

    def log_message(self, *args):
        pass


HTTPServer(("127.0.0.1", int(sys.argv[1])), Handler).serve_forever()
