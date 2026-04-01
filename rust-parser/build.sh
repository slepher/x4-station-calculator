#!/bin/bash
# Build WASM and output directly to src/wasm
cd "$(dirname "$0")"

wasm-pack build --target web --out-dir ../src/wasm --no-pack

# Remove unwanted files
rm -f ../src/wasm/README.md ../src/wasm/.gitignore ../src/wasm/package.json

echo "Build complete. Output in src/wasm/"
