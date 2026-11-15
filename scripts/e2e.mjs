// End-to-end check on the local node with a real PDF.
// Prerequisite: ./start.sh is running (node, contract deployed, backend on :3000).
// Run with: node scripts/e2e.mjs
import { readFile } from "node:fs/promises";
import { JsonRpcProvider, Contract } from "ethers";
import { sha256Hex } from "../backend/verification.js";

const API = process.env.API_URL || "http://localhost:3000";
const RPC = process.env.RPC_URL || "http://127.0.0.1:8545";
const demo = (name) => readFile(new URL(`../demo/${name}`, import.meta.url));

const deployment = JSON.parse(await readFile(new URL("../deployments/localhost.json", import.meta.url), "utf8"));
const provider = new JsonRpcProvider(RPC);
// Account 0 of the local node is the deployer, so it is authorized (no private key needed).
const signer = await provider.getSigner(0);
const registry = new Contract(deployment.address, deployment.abi, signer);

// Unique copy of the demo PDF so the script can be run again on the same chain
// (trailing bytes after %%EOF do not change how a PDF opens).
const original = Buffer.concat([await demo("ordonnance-originale.pdf"), Buffer.from(`\n% e2e ${Date.now()}\n`)]);
const tampered = Buffer.from(original);
tampered[tampered.length - 20] ^= 0x01; // one changed byte
const neverRegistered = await demo("ordonnance-non-enregistree.pdf");

const id = `RX-E2E-${Date.now()}`;
await (await registry.register(id, sha256Hex(original), "bafybei-e2e-test")).wait();
console.log(`Registered ${id} on the local chain.`);

async function verify(label, file, verifyId, expected) {
  const fd = new FormData();
  fd.append("id", verifyId);
  fd.append("file", new Blob([file], { type: "application/pdf" }), "test.pdf");
  const res = await fetch(`${API}/api/verify`, { method: "POST", body: fd });
  const body = await res.json();
  const ok = body.status === expected;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: ${body.status ?? body.error} (expected ${expected})`);
  return ok;
}

const results = [
  await verify("untouched file", original, id, "authentic"),
  await verify("one byte changed", tampered, id, "modified"),
  await verify("never registered", neverRegistered, `RX-E2E-UNKNOWN-${Date.now()}`, "not_registered"),
];
process.exit(results.every(Boolean) ? 0 : 1);
