"""Test-only actions for real native configuration encryption."""
from functools import lru_cache
import anyvali as av
from betterportal.encryption import (ConfigCipher, generate_preview_key, encrypt_preview_value, decrypt_preview_value,
    preview_schema, encrypt_preview, decrypt_preview)

cipher = lru_cache(maxsize=4)(ConfigCipher)


def encryption(body):
    try:
        action = body["action"]
        if action == "crypto-keys":
            return {"valid": True, "output": {"storage": ConfigCipher.generate_key(), "preview": generate_preview_key()}}
        key, value = body["key"], body["value"]
        if action == "crypto-store-encrypt":
            output = cipher(key).encrypt(value)
        elif action == "crypto-store-decrypt":
            output = cipher(key).decrypt(value)
        elif action == "crypto-preview-encrypt":
            output = encrypt_preview_value(key, body["scope"], body["path"], value)
        elif action == "crypto-preview-decrypt":
            output = decrypt_preview_value(key, body["scope"], body["path"], value)
        elif action in ("crypto-preview-fields-encrypt", "crypto-preview-fields-decrypt"):
            schema = preview_schema(body["descriptors"], body["scope"])
            if body.get("roundtrip"):
                schema = av.import_schema(av.export_schema(schema))
            fn = encrypt_preview if action.endswith("-encrypt") else decrypt_preview
            output = fn(schema, key, body["scope"], value)
        else:
            raise ValueError("Unknown encryption action")
        return {"valid": True, "output": output}
    except Exception as error:
        return {"valid": False, "errorType": type(error).__name__}
