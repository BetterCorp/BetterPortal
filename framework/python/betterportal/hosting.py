"""Explicit deployment configuration and a single trusted reverse-proxy hop."""
from __future__ import annotations

from dataclasses import dataclass, field
from ipaddress import ip_address, ip_network
import os
from pathlib import Path
from typing import Mapping
from urllib.parse import urlsplit

from .bootstrap import BootstrapCipher, BootstrapStateStore
from .installation import ServiceInstallation
from .keys import secure_endpoint
from .storage import FileStateStore


@dataclass(frozen=True)
class DeploymentConfig:
    cp_url: str
    public_origin: str
    state_directory: Path
    bootstrap_master_key: str = field(repr=False)
    trusted_proxies: tuple[str, ...] = ()

    def __post_init__(self):
        secure_endpoint(self.cp_url)
        secure_endpoint(self.public_origin)
        if urlsplit(self.public_origin).path not in ('', '/'):
            raise ValueError('Public origin must not contain a path')
        BootstrapCipher(self.bootstrap_master_key)
        for address in self.trusted_proxies:
            ip_network(address, strict=False)

    @classmethod
    def from_env(cls, environment: Mapping[str, str] | None = None) -> DeploymentConfig:
        env = os.environ if environment is None else environment
        key, key_file = env.get('BP_BOOTSTRAP_MASTER_KEY'), env.get('BP_BOOTSTRAP_MASTER_KEY_FILE')
        if bool(key) == bool(key_file):
            raise ValueError('Configure exactly one bootstrap master key source')
        if key_file:
            with Path(key_file).open('r', encoding='ascii') as source:
                key = source.read(256).strip()
                if source.read(1): raise ValueError('Bootstrap key file is too large')
        assert key is not None
        return cls(env['BP_CP_URL'], env['BP_PUBLIC_ORIGIN'], Path(env.get('BP_STATE_DIRECTORY', '.bp-state')),
                   key, tuple(value.strip() for value in env.get('BP_TRUSTED_PROXIES', '').split(',') if value.strip()))

    def create_app(self, registry, declaration, **options):
        """One process per state directory; the ASGI lifespan owns all resources."""
        from .asgi import create_app
        from .service import Service
        service = Service(registry, declaration, managed=True,
                          state_store=FileStateStore(self.state_directory / 'snapshot.json'))
        installation = ServiceInstallation(service,
            BootstrapStateStore(FileStateStore(self.state_directory / 'bootstrap.json'), self.bootstrap_master_key),
            self.cp_url, self.public_origin, settings_store=FileStateStore(self.state_directory / 'settings.json'))
        return TrustedProxyMiddleware(create_app(service, installation=installation, **options), self.trusted_proxies)


class TrustedProxyMiddleware:
    """Trust an explicit peer network, never a header-supplied proxy chain.

    The proxy must overwrite X-Forwarded-Host and X-Forwarded-Proto with one value.
    Disable the ASGI server's proxy-header processing to retain the socket peer.
    """
    def __init__(self, app, trusted_proxies=()):
        self.app = app
        self.networks = tuple(ip_network(value, strict=False) for value in trusted_proxies)

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http': return await self.app(scope, receive, send)
        peer = scope.get('client')
        try: trusted = bool(peer) and any(ip_address(peer[0]) in network for network in self.networks)
        except ValueError: trusted = False
        headers = scope.get('headers', ())
        forwarding = {b'forwarded', b'x-forwarded-host', b'x-forwarded-proto', b'x-forwarded-for', b'x-forwarded-port'}
        scope = {**scope, 'headers': [(key, value) for key, value in headers if key.lower() not in forwarding]}
        if trusted:
            hosts = [value for key, value in headers if key.lower() == b'x-forwarded-host']
            schemes = [value for key, value in headers if key.lower() == b'x-forwarded-proto']
            try:
                if hosts or schemes:
                    if len(hosts) != 1 or len(schemes) != 1: raise ValueError()
                    host, scheme = hosts[0].decode('ascii'), schemes[0].decode('ascii')
                    if scheme not in ('http', 'https') or not host or any(c in host for c in '/\\,?#@') or any(c.isspace() or ord(c) < 33 or ord(c) == 127 for c in host): raise ValueError()
                    parsed = urlsplit(scheme + '://' + host)
                    if not parsed.hostname or parsed.port == 0: raise ValueError()
                    scope['scheme'] = scheme
                    scope['server'] = (parsed.hostname, parsed.port or (443 if scheme == 'https' else 80))
                    scope['headers'] = [(key, value) for key, value in scope['headers'] if key.lower() != b'host'] + [(b'host', hosts[0])]
            except (ValueError, UnicodeError):
                await send({'type': 'http.response.start', 'status': 400, 'headers': [(b'cache-control', b'no-store')]})
                await send({'type': 'http.response.body', 'body': b'Invalid proxy headers'})
                return
        return await self.app(scope, receive, send)
