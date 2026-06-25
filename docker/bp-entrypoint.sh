#!/bin/sh
set -eu

if [ "$#" -gt 0 ]; then
  "$@"
fi

if [ -z "${BSB_CONFIG_FILE:-}" ]; then
  export BSB_CONFIG_FILE="$PWD/sec-config.yaml"
fi

if [ -x /app/entrypoint.sh ]; then
  exec /app/entrypoint.sh
fi

if [ -f /app/entrypoint.js ]; then
  exec node /app/entrypoint.js
fi

exec bsb
