#!/usr/bin/env bash
set -e

echo "=== Installing pnpm ==="
npm install -g pnpm

echo "=== Installing workspace dependencies ==="
pnpm install --frozen-lockfile

echo "=== Building Dashboard ==="
# Build dashboard against the confirmed Render production API.
# BASE_PATH=/dashboard so React Router and asset paths work correctly
BASE_PATH=/dashboard VITE_API_BASE_URL="https://the-levantine-house.onrender.com" pnpm --filter @workspace/dashboard run build

echo "=== Building API Server ==="
pnpm --filter @workspace/api-server run build

echo "=== Build complete ==="
