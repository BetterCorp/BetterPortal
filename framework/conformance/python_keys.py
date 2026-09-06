"""Test-only orchestration around the runtime's JWKS client."""
import asyncio
from urllib.request import urlopen
from betterportal.keys import JwksClient, secure_endpoint
from betterportal.security import TokenError


def signal(uri, command):
    with urlopen(uri + "/control/" + command, timeout=4) as response:
        response.read()


async def key_actions(body):
    if body["action"] == "keys-url":
        try:
            secure_endpoint(body["uri"])
            return {"valid": True}
        except ValueError:
            return {"valid": False}
    results = []
    async with JwksClient(body["issuer"], body["uri"]) as client:
        for step in body["steps"]:
            if step.get("invalidate"):
                client.invalidate()
                results.append({"invalidated": True})
                continue
            try:
                if step.get("cancel") or step.get("close") or step.get("invalidateDuring"):
                    task = asyncio.create_task(client.resolve(step["kid"]))
                    await asyncio.to_thread(signal, body["uri"], "started")
                    if step.get("cancel"):
                        task.cancel()
                    elif step.get("close"):
                        await client.aclose()
                    else:
                        client.invalidate()
                    await asyncio.to_thread(signal, body["uri"], "release")
                    pem = await task
                elif step.get("parallel"):
                    values = await asyncio.gather(*(client.resolve(step["kid"]) for _ in range(step["parallel"])))
                    assert len(set(values)) == 1
                    pem = values[0]
                else:
                    pem = await client.resolve(step["kid"])
                results.append({"valid": True, "pem": pem})
            except asyncio.CancelledError:
                results.append({"cancelled": True})
            except TokenError:
                results.append({"valid": False})
    return {"results": results}
