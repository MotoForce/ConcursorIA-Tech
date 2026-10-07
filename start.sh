#!/usr/bin/env sh
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18 ou superior não foi encontrado."
  echo "Use standalone/Imob_Velocity_V5_Standalone.html para o modo local."
  exit 1
fi
exec node server.js
