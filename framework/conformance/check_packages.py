"""Verify shared artifacts in a native wheel/sdist and import directly from the wheel."""
import argparse
from pathlib import Path
import sys
import subprocess
import os
import tarfile
import zipfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("directory", type=Path)
args = parser.parse_args()
wheel, = args.directory.glob("betterportal-*.whl")
sdist, = args.directory.glob("betterportal-*.tar.gz")
canonical = Path(__file__).with_name("contracts")
with zipfile.ZipFile(wheel) as archive, tarfile.open(sdist) as source:
    for path in canonical.glob("*.json"):
        member = "betterportal/_contracts/" + path.name
        assert archive.read(member) == path.read_bytes(), member
        entry, = [item for item in source.getmembers() if item.name.endswith("/" + member)]
        with source.extractfile(entry) as stream:
            assert stream.read() == path.read_bytes(), member
    assert "betterportal/py.typed" in archive.namelist()
    assert "betterportal/generated_types.py" in archive.namelist()
    metadata, = [name for name in archive.namelist() if name.endswith(".dist-info/entry_points.txt")]
    assert "bp-python = betterportal.cli:main" in archive.read(metadata).decode()

sys.path.insert(0, str(wheel.resolve()))
import betterportal
from betterportal.contracts import parse
from betterportal.security import KeyPair
from betterportal.keys import public_keys, secure_endpoint
from betterportal.encryption import ConfigCipher, generate_preview_key, encrypt_preview_value, decrypt_preview_value
from betterportal.authorization import AuthContext, authorize_request
from betterportal.media import negotiate
from betterportal.streaming import StreamHandler, Summary
from betterportal.sse import LocalEvents, SseRoute, EventScope, encode_event
from betterportal.feeds import SseFeed
from betterportal.context import ScopedConfig, http_origin
from betterportal.context import OriginPolicy
from betterportal.cors import Cors
from betterportal.handler import Handler, RequestContext
from betterportal.response import RawHandler, RawResponse
from betterportal.rendering import Renderer, RenderContext
from betterportal.urls import Urls
from betterportal.registry import Operation, Route, Registry
from betterportal.access import AppAccess
from betterportal.service import Service
from betterportal.settings import SettingsSchema, ServiceSettings
from betterportal.config_api import ConfigApi
from betterportal.authorization import AuthorizedCaller
from betterportal.contracts import contract
import asyncio
assert str(wheel.resolve()) in betterportal.__file__
assert parse("JsonObjectSchema", {"x": [None, {"y": True}]}) == {"x": [None, {"y": True}]}
key = KeyPair.generate()
assert public_keys({"keys": [key.public_jwk()]})[key.kid] == key.public_key_pem
assert secure_endpoint("https://keys.example") == "https://keys.example"
cipher = ConfigCipher(ConfigCipher.generate_key())
assert cipher.decrypt(cipher.encrypt({"value": None})) == {"value": None}
settings = SettingsSchema([])
assert settings.values("tenant", {}) == settings.effective({}, {}) == {}
assert parse("PersistedServiceConfigStateSchema", {}) == {"tenants": {}}
async def settings_state():
    async with ServiceSettings(settings, cipher) as state:
        await state.write("tenant", {})
        assert state.values("tenant") == state.effective("tenant", "app") == {}
asyncio.run(settings_state())
assert ConfigApi().schema("com.example.service", [])["mode"] == "static"
preview_key = generate_preview_key()
assert decrypt_preview_value(preview_key, "tenant", ["secret"], encrypt_preview_value(preview_key, "tenant", ["secret"], "")) == ""
anonymous = asyncio.run(authorize_request({}, {}, AuthContext("unresolved", "unresolved"), view_id="hello", method="GET"))
assert anonymous.mode is None and anonymous.user is None and anonymous.service is None
assert negotiate("text/html;mode=fragment").mode == "fragment"
async def produce(context):
    yield {"nested": [None, True]}
    yield Summary(None)
handler = StreamHandler(contract("JsonValueSchema"), produce, contract("JsonValueSchema"))
assert asyncio.run(handler.buffered(None)) == {"items": [{"nested": [None, True]}], "summary": None}
async def sse():
    transport = LocalEvents()
    try:
        route = SseRoute("example", contract("JsonValueSchema"), contract("JsonValueSchema"), lambda value, context: value, transport=transport)
        owner = Handler(contract("JsonValueSchema"), lambda context: None)
        feed = SseFeed(owner, route)
        scope = EventScope("tenant", "app")
        async with route.subscribe(scope, None) as events:
            await feed.publish(scope, {"nested": [None]})
            assert await events.__anext__() == {"nested": [None]}
    finally:
        await transport.aclose()
asyncio.run(sse())
assert encode_event("one\r\ntwo\n", event="tick") == b"event: tick\ndata: one\ndata: two\ndata: \n\n"
assert http_origin("HTTPS://Example.com:443") == "https://example.com"
assert ScopedConfig({"managementOrigins": [], "tenants": [], "apps": []}).resolve({"host": "unknown.test"}) is None
policy = OriginPolicy(frozenset(["https://app.test"]), frozenset(["https://app.test"]))
assert Cors(policy, ["GET"]).preflight("https://app.test", "GET")["access-control-allow-origin"] == "https://app.test"
tenant_id, app_id = "01900000-0000-7000-8000-000000000001", "01900000-0000-7000-8000-000000000002"
scope = ScopedConfig({"managementOrigins": [], "tenants": [{"id": tenant_id, "slug": "tenant", "title": "Tenant", "services": []}],
                      "apps": [{"id": app_id, "tenantId": tenant_id, "slug": "app", "title": "App", "hostnames": ["app.test"]}]}).by_id(tenant_id, app_id)
assert scope is not None
render_context = RenderContext.create(RequestContext(scope, AuthorizedCaller(), "GET", "/"), "hello.index", "/", "bootstrap5", "page", "page", None, 200, {}, {})
renderer = Renderer({"renderer": "bootstrap5"}, lambda value, context: "<p>" + context.tenant["title"] + "</p>")
assert asyncio.run(renderer.render({}, render_context)) == "<p>Tenant</p>"
assert "services" not in render_context.tenant
assert Urls.path("/hello", {"query": {"greet": "Hi BP"}}) == "/hello?greet=Hi+BP"
handler = Handler(contract("JsonObjectSchema"), lambda context: context.query, query=contract("JsonObjectSchema"))
assert asyncio.run(handler.invoke(RequestContext(scope, AuthorizedCaller(), "GET", "/"), {"query": {"nested": [None]}})) == {"nested": [None]}
raw_handler = RawHandler(lambda context: RawResponse.file(b"hello", "report.txt"))
raw_response = asyncio.run(raw_handler.invoke(RequestContext(scope, AuthorizedCaller(), "GET", "/"), {}))
assert raw_response.body == b"hello" and raw_handler.is_raw
asyncio.run(raw_response.aclose())
registry = Registry([Route("hello.index", "/", [Operation(handler, {"operationId": "hello.get", "method": "GET", "title": "Hello", "description": "Hello operation", "auth": {}})])])
manifest = registry.manifest({"pluginId": "com.example.hello", "title": "Hello", "description": "Example service", "version": "1.0.0"})
assert manifest["views"][0]["operations"][0]["operationId"] == "hello.get"
access = AppAccess(scope, [])
assert not access.allows(registry.routes[0], "GET") and dict(access.permission_aliases()) == {}
async def hosting():
    from betterportal.asgi import create_app
    from betterportal.clients import ClientContract, ClientError
    import httpx
    async with Service(registry, {"pluginId": "com.example.hello", "title": "Hello", "description": "Example service", "version": "1.0.0"}) as service:
        contract = ClientContract(service.schema())
        assert contract.plugin_id == "com.example.hello"
        try:
            await service.clients.scope(tenant_id, app_id).m2m("read", contract).request("hello.get")
            raise AssertionError("Unready packaged service made an outbound call")
        except ClientError as error:
            assert error.status == 503
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app(service)), base_url="http://example.test") as client:
            response = await client.get("/.well-known/bp/health")
            assert response.status_code == 503 and response.json() == {"ok": False}
asyncio.run(hosting())
async def managed():
    from betterportal.sync import ControlPlaneSync
    async with Service(registry, {"pluginId": "com.example.hello", "title": "Hello", "description": "Example service", "version": "1.0.0"}, managed=True) as service:
        sync = ControlPlaneSync(service, "https://config.example", "test-key")
        assert not service.ready and sync.status["phase"] == "idle"
        assert sync.submission()["viewIndex"]["hello.index"]["operations"][0]["operationId"] == "hello.get"
        await sync.aclose()
asyncio.run(managed())
subprocess.run([sys.executable, "-m", "betterportal", "types", "--platform", "--output",
    str(canonical.parents[1] / "python/betterportal/generated_types.py"), "--check"],
    env={**os.environ, "PYTHONPATH": str(wheel.resolve())}, cwd=args.directory.resolve(), check=True)
print("Wheel and sdist contain identical canonical contracts; standalone wheel import, recursive parsing, RSA and native type CLI passed")
