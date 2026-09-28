"""Disposable Linux Docker rehearsal: installed wheel, real CP, Bootstrap browser, restart and rollback.

Build Node config-manager and Bootstrap1 plus the Python wheel first. Needs Docker,
Node and Playwright Chromium. Uses only loopback listeners and test credentials.
"""
import argparse
import base64
from contextlib import contextmanager
from copy import deepcopy
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from hosting_cases import fixture
from key_cases import peer as key_peer
from security_cases import post, fixtures, TENANT, SOURCE, TARGET, APP

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('packages', type=Path)
parser.add_argument('--sudo', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
wheel, = args.packages.resolve().glob('betterportal-*.whl')
prefix = 'bp-python-acceptance-' + secrets.token_hex(5)
docker = ['sudo', '-n', 'docker'] if args.sudo else ['docker']
containers, images, volumes = [], [], []

def run(command, **kwargs):
    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600, **kwargs)
    if result.returncode: raise AssertionError(result.stdout[-6000:])
    return result.stdout.strip()

def port():
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0)); return probe.getsockname()[1]

def request(url, status=200, data=None, headers=None):
    req = Request(url, None if data is None else json.dumps(data).encode(), headers or {})
    if data is not None: req.add_header('content-type', 'application/json')
    try: response = urlopen(req, timeout=15)
    except HTTPError as error: response = error
    with response:
        value = response.read().decode()
        assert response.status == status, (url, response.status, value[:1000])
        return json.loads(value) if 'application/json' in response.headers.get('content-type', '') else value

def ready(url, status):
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        try: return request(url, status)
        except (OSError, AssertionError): time.sleep(.1)
    raise AssertionError('Container did not reach expected readiness')

try:
    with tempfile.TemporaryDirectory(prefix=prefix) as tmp:
        tmp = Path(tmp)
        env = {**os.environ, 'PYTHONPATH': str(wheel)}
        project = tmp / 'service'
        run([sys.executable, '-m', 'betterportal', 'init', str(project), '--plugin-id', 'com.example.service', '--registry-ref', 'example/service', '--title', 'Python deployment'], env=env)
        shutil.copy(wheel, project / wheel.name)
        # Use the unpublished wheel in this isolated image. The production scaffold
        # uses its exact released package version from the package index.
        dockerfile = project / 'Dockerfile'
        dockerfile.write_text(dockerfile.read_text().replace('python -m pip install --no-cache-dir .', 'python -m pip install --no-cache-dir ./' + wheel.name + ' .'))
        definition = project / 'my_service/definition.py'
        definition.write_text(definition.read_text() + '''
import anyvali as av
from betterportal.contracts import export
from betterportal.handler import Handler
from betterportal.registry import Operation, Route
_original_registry = registry
declaration['webhooks'] = [{'id': 'changed', 'title': 'Changed', 'payloadSchema': export(av.string())}]
async def publish(context):
    return await context.webhook('changed', context.request['payload'], idempotency_key=context.request['key'])
def registry():
    original = _original_registry()
    operation = Operation(Handler(av.string(), publish, request=av.object_({'key': av.string(), 'payload': av.string()})),
        {'operationId': 'publish.post', 'method': 'POST', 'title': 'Publish', 'description': 'Publish a declared event', 'auth': {'required': True}})
    return Registry([*original.routes, Route('publish', '/publish', [operation])])
''')
        run([sys.executable, '-m', 'betterportal', 'export', '--module', 'my_service.definition:contract', '--project', str(project), '--output', 'bp-contract.json'], env=env)
        image = prefix + ':baseline'; images.append(image)
        print('Building isolated Python service image', flush=True)
        run([*docker, 'build', '--force-rm', '-t', image, str(project)])
        # A genuine app upgrade with the same runtime/state format; rollback must
        # restore the previous behavior while preserving the installation.
        hello = project / 'my_service/bp_routes/hello/GET.py'
        hello.write_text(hello.read_text().replace('"Hello"', '"Hello v2"').replace('<p>Hello</p>', '<p>Hello v2</p>'))
        candidate = prefix + ':candidate'; images.append(candidate)
        run([*docker, 'build', '--force-rm', '-t', candidate, str(project)])
        volume = prefix + '-state'; volumes.append(volume)
        run([*docker, 'volume', 'create', volume])
        service_port, peer_port = port(), port()
        service_url, peer_url = f'http://127.0.0.1:{service_port}', f'http://127.0.0.1:{peer_port}'
        peer_name = prefix + '-cp'; containers.append(peer_name)
        run([*docker, 'run', '-d', '--name', peer_name, '--network', 'host', '--read-only', '--tmpfs', '/tmp',
             '--mount', f'type=bind,source={root},target=/repo,readonly', 'node:24-bookworm-slim',
             'node', '/repo/framework/conformance/node-schema-server.mjs', str(peer_port)])
        deadline = time.monotonic() + 20
        while True:
            try: post(peer_url, {'action': 'runtime'}); break
            except OSError:
                if time.monotonic() > deadline: raise
                time.sleep(.1)
        deliveries = []
        class Receiver(BaseHTTPRequestHandler):
            def do_POST(self):
                deliveries.append(json.loads(self.rfile.read(int(self.headers['content-length']))))
                self.send_response(204); self.end_headers()
            def log_message(self, *args): pass
        receiver = ThreadingHTTPServer(('127.0.0.1', 0), Receiver)
        thread = threading.Thread(target=receiver.serve_forever, daemon=True); thread.start()
        try:
            with key_peer() as (key_url, keys, _, _):
                signer = post(peer_url, {'action': 'jwt-key'})['jwk']
                keys['/auth-keys'] = [{'body': {'keys': [signer]}}]
                token = post(peer_url, {'action': 'jwt-sign', 'purpose': 'access', 'claims': fixtures()['access']})['token']
                config = {name: fixture()['snapshot'][name] for name in ('tenants', 'apps')}
                config['tenants'][0]['services'][0]['hostname'] = service_url
                config['tenants'][0]['services'][1].update(serviceId='org.betterportal.theme-bootstrap1', hostname='https://theme.test')
                app = config['apps'][0]
                app['routes'][0].update(path='/hello', viewId='hello.index', operations=['hello.get'], resolvedServicePath='/hello')
                app['routes'].append({**deepcopy(app['routes'][0]), 'id': SOURCE, 'path': '/publish', 'viewId': 'publish', 'operations': ['publish.post'], 'resolvedServicePath': '/publish'})
                app['auth'] = {'serviceId': TARGET, 'expectedIssuer': fixtures()['access']['iss'], 'expectedAudience': fixtures()['access']['aud'], 'jwksUri': key_url + '/auth-keys', 'roles': [{'id': 'reader', 'title': 'Reader', 'permissions': []}]}
                app['shell'] = {'serviceId': SOURCE}
                config['manifestCache'] = [{'serviceId': SOURCE, 'manifestVersion': '1.0.0', 'fetchedAt': '2026-09-01T00:00:00Z', 'shell': {'service': 'bootstrap1', 'renderer': 'bootstrap5', 'fragments': []}}]
                config['webhooks'] = {'targets': [{'id': SOURCE, 'tenantId': TENANT, 'appId': APP, 'serviceId': TARGET, 'eventId': 'changed', 'url': f'http://127.0.0.1:{receiver.server_port}/events', 'secret': secrets.token_hex(32), 'createdAt': '2026-09-25T00:00:00Z'}]}
                control = post(peer_url, {'action': 'sync-peer', 'command': 'start', 'config': config, 'setup': True, 'shell': True, 'serviceUrl': service_url, 'jwks': [signer]})
                origin = control['url']
                key_file = tmp / 'bootstrap-key'
                key_file.write_text('bp_bsk_' + base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip('=')); key_file.chmod(0o444)
                common = ['--network', 'host', '--read-only', '--tmpfs', '/tmp', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
                    '--mount', f'type=volume,source={volume},target=/data', '--mount', f'type=bind,source={key_file},target=/run/bp-key,readonly',
                    '-e', 'BP_BOOTSTRAP_MASTER_KEY_FILE=/run/bp-key', '-e', 'BP_CP_URL=' + origin, '-e', 'BP_PUBLIC_ORIGIN=' + service_url]
                def start(tag, suffix):
                    name = prefix + '-' + suffix; containers.append(name)
                    run([*docker, 'run', '-d', '--name', name, '--health-interval=1s', '--health-start-period=1s',
                         '--health-cmd', f"python -c \"import urllib.request; urllib.request.urlopen('{service_url}/.well-known/bp/health', timeout=2)\"", *common, tag, 'python', '-m', 'uvicorn', 'my_service.app:create_app', '--factory', '--no-proxy-headers', '--host', '127.0.0.1', '--port', str(service_port)])
                    return name
                def healthy(name):
                    deadline = time.monotonic() + 20
                    while time.monotonic() < deadline:
                        if run([*docker, 'inspect', '--format', '{{.State.Health.Status}}', name]) == 'healthy': return
                        time.sleep(.2)
                    raise AssertionError('Docker readiness probe did not become healthy')
                headers = {'origin': origin, 'authorization': 'Bearer ' + token, 'accept': 'application/json'}
                active = start(image, 'baseline')
                ready(service_url + '/.well-known/bp/health', 503)
                issued = post(origin + '/.well-known/bp/admin/services/begin-install', {'serviceUrl': service_url, 'tenantId': TENANT, 'instanceId': TARGET})
                request(service_url + '/.well-known/bp/install', data={'setupToken': issued['setupToken'], 'cpUrl': origin})
                ready(service_url + '/.well-known/bp/health', 200)
                healthy(active)
                request(service_url + '/hello', 401, headers={'origin': origin})
                assert request(service_url + '/hello', headers=headers) == 'Hello'
                assert '<p>Hello</p>' in request(service_url + '/hello', headers={**headers, 'accept': 'text/html'})
                for _ in range(2): assert request(service_url + '/publish', data={'key': 'duplicate-test', 'payload': 'hello'}, headers=headers) == 'duplicate-test'
                assert len(deliveries) == 1 and deliveries[0]['payload'] == 'hello', deliveries
                browser = root / 'framework/conformance/check_python_browser.mjs'
                run(['node', str(browser), origin], cwd=root, input=token)
                for tag, suffix, expected in [(image, 'restart', 'Hello'), (candidate, 'upgrade', 'Hello v2'), (image, 'rollback', 'Hello')]:
                    run([*docker, 'stop', active]); active = start(tag, suffix)
                    ready(service_url + '/.well-known/bp/health', 200)
                    healthy(active)
                    assert request(service_url + '/hello', headers=headers) == expected
                state = post(peer_url, {'action': 'sync-peer', 'command': 'state', 'id': control['id']})
                assert sum(call['path'] == '/.well-known/bp/services/redeem' for call in state['calls']) == 1
                post(peer_url, {'action': 'sync-peer', 'command': 'update', 'id': control['id'], 'revoke': True})
                request(service_url + '/publish', 500, data={'key': 'revoked-test', 'payload': 'hello'}, headers=headers)
                assert len(deliveries) == 1
                print('Docker acceptance passed: installed wheel, authenticated Bootstrap browser, duplicate webhook, revoked key, persistent restart, upgrade and rollback', flush=True)
        finally:
            receiver.shutdown(); receiver.server_close(); thread.join(2)
finally:
    if sys.exc_info()[0] is not None:
        for name in containers:
            log = subprocess.run([*docker, 'logs', '--tail', '60', name], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            print(log.stdout, file=sys.stderr)
    for name in reversed(containers): subprocess.run([*docker, 'rm', '-f', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for name in volumes: subprocess.run([*docker, 'volume', 'rm', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for name in images: subprocess.run([*docker, 'image', 'rm', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
