"""Test-only orchestration around the runtime's JWKS client."""
import asyncio
from betterportal.keys import JwksClient, secure_endpoint
from betterportal.security import TokenError


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
                    await asyncio.sleep(0.025)
                    if step.get("cancel"):
                        task.cancel()
                    elif step.get("close"):
                        await client.aclose()
                    else:
                        client.invalidate()
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
