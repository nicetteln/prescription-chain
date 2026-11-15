import express from "express";
import multer from "multer";
import { config } from "dotenv";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { JsonRpcProvider, Contract, Network } from "ethers";

// The .env file lives at the project root, one level above backend/.
config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const PORT = Number(process.env.PORT) || 3000;
const MAX_MB = Number(process.env.MAX_FILE_MB) || 5;
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const PINATA_JWT = process.env.PINATA_JWT;
const ALLOWED_ORIGINS = (process.env.FRONTEND_ORIGINS || "http://localhost:8080,http://127.0.0.1:8080").split(",");

class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ---------- helpers ----------

// Checks the real content of the file, not only the type announced by the client.
function readPdf(req) {
  if (!req.file) throw new AppError(400, "NO_FILE", "Aucun fichier reçu.");
  const buffer = req.file.buffer;
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new AppError(400, "INVALID_FILE", "Le fichier n'est pas un PDF valide.");
  }
  return buffer;
}

// SHA-256 as a 0x-prefixed hex string, the format of the contract's bytes32.
function sha256Hex(buffer) {
  return "0x" + createHash("sha256").update(buffer).digest("hex");
}

// Uploads the PDF to Pinata (public IPFS network) and returns its CID.
async function pinToIpfs(buffer, hash) {
  if (!PINATA_JWT) {
    throw new AppError(500, "PINATA_NOT_CONFIGURED", "PINATA_JWT manquant dans le fichier .env.");
  }
  const form = new FormData();
  form.append("network", "public");
  // Generic file name: the original name could contain personal data.
  form.append("file", new Blob([buffer], { type: "application/pdf" }), `rx-${hash.slice(2, 10)}.pdf`);

  let res;
  try {
    res = await fetch("https://uploads.pinata.cloud/v3/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${PINATA_JWT}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new AppError(502, "IPFS_UNAVAILABLE", "Service IPFS (Pinata) injoignable. Réessayez plus tard.");
  }
  if (res.status === 401 || res.status === 403) {
    throw new AppError(502, "IPFS_AUTH", "Clé Pinata refusée : vérifiez PINATA_JWT et sa permission d'envoi de fichiers.");
  }
  if (!res.ok) {
    throw new AppError(502, "IPFS_REJECTED", `Pinata a refusé l'envoi (code ${res.status}).`);
  }
  const body = await res.json().catch(() => null);
  const cid = body?.data?.cid;
  if (!cid) throw new AppError(502, "IPFS_BAD_RESPONSE", "Réponse inattendue de Pinata.");
  return cid;
}

// Reads the contract address and ABI written by scripts/deploy.ts.
async function getRegistry() {
  let deployment;
  try {
    const file = fileURLToPath(new URL("../deployments/localhost.json", import.meta.url));
    deployment = JSON.parse(await readFile(file, "utf8"));
  } catch {
    throw new AppError(500, "CONTRACT_NOT_DEPLOYED", "deployments/localhost.json introuvable : déployez d'abord le contrat.");
  }
  const network = Network.from(Number(deployment.chainId));
  const provider = new JsonRpcProvider(RPC_URL, network, { staticNetwork: network });
  return new Contract(deployment.address, deployment.abi, provider);
}

async function readRecord(id) {
  const registry = await getRegistry();
  try {
    const [hash, cid, timestamp] = await registry.getPrescription(id);
    return { hash, cid, timestamp };
  } catch (err) {
    if (err.code === "BAD_DATA" || err.code === "CALL_EXCEPTION") {
      throw new AppError(500, "CONTRACT_NOT_DEPLOYED",
        "Aucun contrat à l'adresse enregistrée : le nœud a peut-être été redémarré. Relancez le déploiement.");
    }
    throw new AppError(503, "BLOCKCHAIN_UNREACHABLE", "Blockchain injoignable : vérifiez que le nœud local est démarré.");
  }
}

// ---------- app ----------

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
}).single("file");

// CORS: only the frontend origins can call the API from a browser.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Receives a PDF, returns its SHA-256 and its IPFS CID.
app.post("/api/upload", upload, async (req, res, next) => {
  try {
    const file = readPdf(req);
    const hash = sha256Hex(file);
    const cid = await pinToIpfs(file, hash);
    res.json({ hash, cid, size: file.length });
  } catch (err) {
    next(err);
  }
});

// Receives a PDF and an ID, returns authentic | modified | not_registered.
app.post("/api/verify", upload, async (req, res, next) => {
  try {
    const file = readPdf(req);
    const id = String(req.body?.id ?? "").trim();
    if (!id) throw new AppError(400, "MISSING_ID", "Identifiant de l'ordonnance manquant.");

    const fileHash = sha256Hex(file);
    const record = await readRecord(id);

    if (record.timestamp === 0n) {
      return res.json({ status: "not_registered", id, fileHash });
    }
    const status = record.hash.toLowerCase() === fileHash ? "authentic" : "modified";
    res.json({
      status,
      id,
      fileHash,
      chainHash: record.hash,
      cid: record.cid,
      registeredAt: new Date(Number(record.timestamp) * 1000).toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

app.use((req, res) => res.status(404).json({ error: "Route inconnue.", code: "NOT_FOUND" }));

app.use((err, req, res, _next) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    err = new AppError(413, "FILE_TOO_LARGE", `Fichier trop volumineux (${MAX_MB} Mo maximum).`);
  } else if (err?.name === "MulterError") {
    err = new AppError(400, "INVALID_REQUEST", "Requête invalide.");
  }
  if (!(err instanceof AppError)) {
    console.error(err);
    err = new AppError(500, "INTERNAL", "Erreur interne du serveur.");
  }
  res.status(err.status).json({ error: err.message, code: err.code });
});

app.listen(PORT, () => console.log(`Backend démarré sur http://localhost:${PORT}`));
