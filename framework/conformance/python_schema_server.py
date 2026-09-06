"""Loopback-only conformance adapter; never mount this in a consumer service."""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "python"))
from betterportal.contracts import contract, export, object_document
import anyvali as av
from python_security import security
from python_encryption import encryption
from python_authorization import authorization
from betterportal.media import negotiate, NotAcceptable
from dataclasses import asdict
from python_stream import streaming, probe as stream_probe
import asyncio
from python_sse import probe as sse_probe, wire as sse_wire
from python_context import context_request
from python_cors import handle as cors_request
from python_handler import invoke as handler_request
from python_registry import registry_request
from python_access import access_request
from python_hosting import hosting_request
from python_snapshots import snapshots
from python_sync import sync_request
from python_settings import settings_request, settings_store
from python_config_api import config_api_request
from python_bootstrap import bootstrap_request


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        cors_request(self)

    def do_GET(self):
        cors_request(self)

    def do_POST(self):
        try:
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            if body.get("action") == "bootstrap":
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(asyncio.run(bootstrap_request(body))).encode())
                return
            if body.get("action") == "config-api":
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(asyncio.run(config_api_request(body))).encode())
                return
            if body.get("action") == "settings-store":
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(asyncio.run(settings_store(body))).encode())
                return
            if body.get("action") == "settings-schema":
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(settings_request(body)).encode())
                return
            if body.get("action") == "runtime":
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"runtime":"python"}')
                return
            if body.get("action") == "handler":
                payload = asyncio.run(handler_request(body))
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(payload).encode())
                return
            if body.get("action") == "registry":
                payload = registry_request(body)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(payload).encode())
                return
            if body.get("action") == "access":
                payload = access_request(body)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(payload).encode())
                return
            if body.get("action") == "hosting":
                payload = asyncio.run(hosting_request(body))
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(payload).encode())
                return
            if body.get("action") == "snapshots":
                payload = asyncio.run(snapshots(body))
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(payload).encode())
                return
            if body.get("action") == "sync":
                payload = asyncio.run(sync_request(body))
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(payload).encode())
                return
            if body.get("action") in ("context", "http-origin"):
                payload = context_request(body)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(payload).encode())
                return
            if body.get("action") == "sse-probe":
                payload = asyncio.run(sse_probe())
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(payload).encode())
                return
            if body.get("action") == "sse-wire":
                sse_wire(self, body)
                return
            if body.get("action") == "stream-probe":
                payload = asyncio.run(stream_probe())
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(payload).encode())
                return
            if body.get("action") == "stream":
                asyncio.run(streaming(self, body))
                return
            if body.get("action") == "media":
                try:
                    options = {"available": body["available"]} if "available" in body else {}
                    representation = negotiate(body.get("accept"), **options)
                    payload = {"status": 200, "output": {"kind": representation.kind, "mode": representation.mode}}
                except NotAcceptable:
                    payload = {"status": 406}
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(payload).encode())
                return
            if body.get("action", "").startswith(("jwt-", "keys-", "crypto-", "auth-")):
                payload = authorization(body) if body["action"] == "auth-request" else encryption(body) if body["action"].startswith("crypto-") else security(body)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(payload).encode())
                return
            schema = av.import_schema(body["document"]) if "document" in body else contract(body["contract"])
            if body.get("wrapDocument"):
                schema = av.import_schema(object_document({"payload": export(schema)}))
            if body.get("wrap"):
                schema = av.object_({"payload": schema})
            if body.get("roundtrip") or body.get("action") == "roundtrip":
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
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception as error:
            payload = {"error": str(error)}
            self.send_response(500)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode())

    def log_message(self, *args):
        pass


HTTPServer(("127.0.0.1", int(sys.argv[1])), Handler).serve_forever()
