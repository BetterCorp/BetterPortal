# Generated from AnyVali documents; do not edit. SHA256: ef28ce346d4a73e98f89bbb64f26a4464bc929eed425910c4d4e1273be42f92d
from __future__ import annotations
from typing import Any, Literal, NoReturn, TypeAlias, Union
from typing_extensions import NotRequired, Required, TypedDict

BetterPortalJsonValue: TypeAlias = 'Union[None, bool, str, float, list[PeerClient_check_get_Response], dict[str, PeerClient_check_get_Response]]'

BetterPortalJsonValueInput: TypeAlias = 'Union[None, bool, str, float, list[PeerClient_check_get_ResponseInput], dict[str, PeerClient_check_get_ResponseInput]]'

PeerClient_check_get_Response: TypeAlias = 'BetterPortalJsonValue'

PeerClient_check_get_ResponseInput: TypeAlias = 'BetterPortalJsonValueInput'

PeerClient_check_get_body: TypeAlias = 'dict[str, PeerClient_check_get_Response]'

PeerClient_check_get_bodyInput: TypeAlias = 'dict[str, PeerClient_check_get_ResponseInput]'

PeerClient_check_get_headers: TypeAlias = 'dict[str, PeerClient_check_get_Response]'

PeerClient_check_get_headersInput: TypeAlias = 'dict[str, PeerClient_check_get_ResponseInput]'

PeerClient_check_get_params: TypeAlias = 'dict[str, PeerClient_check_get_Response]'

PeerClient_check_get_paramsInput: TypeAlias = 'dict[str, PeerClient_check_get_ResponseInput]'

PeerClient_check_get_query: TypeAlias = 'dict[str, PeerClient_check_get_Response]'

PeerClient_check_get_queryInput: TypeAlias = 'dict[str, PeerClient_check_get_ResponseInput]'

import json as _bp_json
from typing import cast as _bp_cast
from betterportal.clients import RequestClients as _BpRequestClients, ClientContract as _BpClientContract

_bp_contract = _BpClientContract(_bp_json.loads('{"manifest":{"protocolVersion":2,"pluginId":"com.example.service","title":"Host","description":"Host service","version":"1.0.0","category":"service","deploymentModes":["self-hosted"],"capabilities":["view.json","view.metadata"],"supportedRenderers":[],"supportedRenderModes":[],"views":[{"viewId":"check","title":"GET","description":"Check","path":"/check/:key","pathVariants":[],"paramsSchema":{},"operations":[{"operationId":"check.get","method":"GET","title":"GET","description":"Check","querySchema":{},"headersSchema":{},"bodySchema":{},"jsonResponseSchema":{"anyvaliVersion":"1.0","schemaVersion":"1.1","root":{"kind":"ref","ref":"#/definitions/BetterPortalJsonValue"},"definitions":{"BetterPortalJsonValue":{"kind":"union","variants":[{"kind":"null"},{"kind":"bool"},{"kind":"string"},{"kind":"number"},{"kind":"array","items":{"kind":"ref","ref":"#/definitions/BetterPortalJsonValue"}},{"kind":"record","valueSchema":{"kind":"ref","ref":"#/definitions/BetterPortalJsonValue"}}]}},"extensions":{}},"metadataResponseSchema":{},"renderable":false,"html":{"renderers":{}},"auth":{"required":true,"callers":["user","service","delegated"],"permissions":[{"serviceId":"com.example.service","viewId":"check","permissions":["read"]}]},"sitemap":{"kind":"default"},"robots":[],"dependencies":[],"apiContracts":[{"id":"read-item","title":"Read","version":"1.0.0","viewId":"check","methods":["GET"],"capabilities":[],"permissions":["read"],"modes":["service","delegated"]}],"demoScenarios":[],"cacheHints":{"ttlSeconds":0,"varyBy":[]}}]}],"configSchemas":[],"permissions":[],"adminApis":[],"webhooks":[],"apiContracts":[{"id":"read-item","title":"Read","version":"1.0.0","viewId":"check","methods":["GET"],"capabilities":[],"permissions":["read"],"modes":["service","delegated"]}],"m2mRequests":[],"developerResources":[],"cacheHints":{"metadataTtlSeconds":1800}},"routes":[{"viewId":"check","path":"/check/:key","pathVariants":[],"operations":[{"operationId":"check.get","method":"GET"}],"paramNames":["key"],"renderers":[],"hasFragments":false,"fragments":[],"components":[]}]}'))

PeerClient_check_getInputs = TypedDict('PeerClient_check_getInputs', {
    'params': NotRequired['PeerClient_check_get_paramsInput'],
    'query': NotRequired['PeerClient_check_get_queryInput'],
    'headers': NotRequired['PeerClient_check_get_headersInput'],
    'body': NotRequired['PeerClient_check_get_bodyInput'],
})

class PeerClient:
    def __init__(self, context: _BpRequestClients, *, service_id: str | None = None, request_id: str | None = None):
        if service_id is not None and request_id is not None: raise ValueError('Select a user service or a declared M2M request')
        self._bp_client = context.m2m(request_id, _bp_contract) if request_id is not None else context.user(_bp_contract, service_id)

    async def check_get(self, values: PeerClient_check_getInputs | None = None) -> PeerClient_check_get_Response:
        return _bp_cast(PeerClient_check_get_Response, await self._bp_client.request('check.get', values))
