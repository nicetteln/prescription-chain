#!/usr/bin/env bash
set -e

trap 'kill 0' EXIT

echo "1/4 Starting local Hardhat node..."
npx hardhat node > /tmp/hardhat.log 2>&1 &
until curl -s -X POST http://127.0.0.1:8545 -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' >/dev/null; do
  sleep 0.5
done

echo "2/4 Deploying contract & authorizing wallet..."
npx hardhat run scripts/deploy.ts

echo "3/4 Starting backend API on :3000..."
(cd backend && npm start) > /tmp/backend.log 2>&1 &

echo "4/4 Starting frontend on http://localhost:8080..."
echo "Press Ctrl+C to stop everything."
python3 -m http.server 8080 -d frontend
