from betterportal.encryption import ConfigCipher
from betterportal.settings import SettingsSchema


def settings_request(body):
    try:
        schema = SettingsSchema(body["descriptors"])
        command, scope = body["command"], body.get("scope", "tenant")
        if command == "values": output = schema.values(scope, body["values"], partial=body.get("partial", True))
        elif command == "encode": output = schema.encode(scope, body["values"], ConfigCipher(body["key"]))
        elif command == "decode": output = schema.decode(scope, body["values"], ConfigCipher(body["key"]))
        elif command == "redact": output = schema.redact(scope, body["values"])
        elif command == "merge": output = schema.merge(scope, body["current"], body["values"], body.get("clearKeys", []))
        elif command == "effective": output = schema.effective(body["tenant"], body["app"])
        else: raise ValueError("Unknown test command")
        return {"valid": True, "output": output}
    except Exception as error: return {"valid": False, "errorType": type(error).__name__}
