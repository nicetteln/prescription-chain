import { BrowserProvider, Contract } from "https://esm.sh/ethers@6.13.4";
import { API_URL, CONTRACT } from "./config.js";

const $ = (id) => document.getElementById(id);

const connectBtn = $("connectBtn");
const accountPill = $("account");
const authTag = $("authTag");
const form = $("registerForm");
const idInput = $("prescriptionId");
const fileInput = $("pdfFile");
const submitBtn = $("submitBtn");

const sumId = $("sumId");
const sumFile = $("sumFile");
const sumHash = $("sumHash");
const sumAccount = $("sumAccount");

const resultEl = $("result");
const resultTitle = $("resultTitle");
const resultText = $("resultText");
const outHash = $("outHash");
const outCid = $("outCid");
const outTx = $("outTx");

let signer = null;
let userAddress = null;
let isAuthorized = false;

const shortAddr = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function updateSubmitState() {
  const ready = Boolean(signer && isAuthorized && idInput.value.trim() && fileInput.files?.[0]);
  submitBtn.disabled = !ready;
}

function showResult(state, title, text, rows = null) {
  resultEl.hidden = false;
  resultEl.dataset.state = state;
  resultTitle.textContent = title;
  resultText.textContent = text;
  if (rows) {
    outHash.textContent = rows.hash || "—";
    outCid.textContent = rows.cid || "—";
    outTx.textContent = rows.tx || "—";
  }
}

async function computeFileSha256(file) {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return "0x" + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function ensureHardhatNetwork() {
  const targetHex = "0x" + Number(CONTRACT.chainId).toString(16);
  const currentHex = await window.ethereum.request({ method: "eth_chainId" });
  if (currentHex.toLowerCase() === targetHex.toLowerCase()) return;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetHex }],
    });
  } catch (err) {
    if (err.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: targetHex,
          chainName: "Hardhat Local",
          rpcUrls: ["http://127.0.0.1:8545"],
          nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
        }],
      });
    } else {
      throw err;
    }
  }
}

async function connectWallet() {
  if (!window.ethereum) {
    showResult("error", "MetaMask introuvable", "Installez l'extension MetaMask dans votre navigateur.");
    return;
  }

  try {
    await ensureHardhatNetwork();
    const provider = new BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    userAddress = await signer.getAddress();

    accountPill.textContent = shortAddr(userAddress);
    accountPill.hidden = false;
    sumAccount.textContent = shortAddr(userAddress);
    connectBtn.textContent = "Connecté";

    const registry = new Contract(CONTRACT.address, CONTRACT.abi, signer);
    isAuthorized = await registry.authorized(userAddress);

    authTag.hidden = false;
    authTag.textContent = isAuthorized ? "Compte autorisé" : "Non autorisé";
    if (!isAuthorized) {
      showResult("error", "Compte non autorisé", "Ce portefeuille n'a pas le droit d'enregistrer des ordonnances sur le contrat.");
    } else {
      resultEl.hidden = true;
    }
    updateSubmitState();
  } catch (err) {
    const msg = err?.code === 4001 ? "Connexion MetaMask annulée." : (err?.message || "Erreur de connexion MetaMask.");
    showResult("error", "Erreur portefeuille", msg);
  }
}

connectBtn.addEventListener("click", connectWallet);

if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => connectWallet());
  window.ethereum.on("chainChanged", () => window.location.reload());
}

idInput.addEventListener("input", () => {
  sumId.textContent = idInput.value.trim() || "—";
  updateSubmitState();
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) {
    sumFile.textContent = "—";
    sumHash.textContent = "—";
    updateSubmitState();
    return;
  }
  sumFile.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} Ko)`;
  sumHash.textContent = "Calcul…";
  sumHash.textContent = await computeFileSha256(file);
  updateSubmitState();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = idInput.value.trim();
  const file = fileInput.files?.[0];
  if (!signer || !isAuthorized || !id || !file) return;

  submitBtn.disabled = true;

  try {
    // 0. Refuse duplicates before sending anything to IPFS or MetaMask
    const registry = new Contract(CONTRACT.address, CONTRACT.abi, signer);
    if (await registry.isRegistered(id)) {
      showResult("error", "Identifiant déjà utilisé", `L'identifiant « ${id} » est déjà enregistré sur la blockchain. Choisissez un autre identifiant.`);
      return;
    }
    if (await registry.isHashRegistered(await computeFileSha256(file))) {
      showResult("error", "Fichier déjà enregistré", "Ce fichier PDF exact est déjà enregistré sur la blockchain (sous un autre identifiant).");
      return;
    }

    // 1. Upload to backend -> SHA-256 + Pinata IPFS CID
    showResult("loading", "Envoi vers IPFS…", "Calcul de l'empreinte et épinglage du PDF sur IPFS.");
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch(`${API_URL}/api/upload`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Erreur serveur (${res.status})`);
    }

    // 2. Register on-chain via MetaMask
    showResult("loading", "Signature MetaMask…", "Confirmez la transaction dans la fenêtre MetaMask.");
    const tx = await registry.register(id, data.hash, data.cid);

    showResult("loading", "Confirmation blockchain…", "Transaction envoyée, attente de validation du bloc.");
    const receipt = await tx.wait();

    showResult(
      "success",
      "Enregistrée sur la blockchain",
      "L'empreinte SHA-256 et le CID IPFS sont inscrits de façon immuable.",
      { hash: data.hash, cid: data.cid, tx: receipt.hash }
    );
  } catch (err) {
    let message = err?.shortMessage || err?.message || "Erreur inattendue.";
    if (err?.code === "ACTION_REJECTED" || err?.code === 4001) {
      message = "Transaction refusée dans MetaMask.";
    } else if (err?.revert?.name === "HashAlreadyRegistered" || message.includes("HashAlreadyRegistered")) {
      message = "Ce fichier PDF exact est déjà enregistré sur la blockchain (sous un autre identifiant).";
    } else if (err?.revert?.name === "AlreadyRegistered" || message.includes("AlreadyRegistered")) {
      message = `L'identifiant « ${id} » est déjà enregistré sur la blockchain.`;
    } else if (err?.revert?.name === "NotAuthorized" || message.includes("NotAuthorized")) {
      message = "Ce compte n'est pas autorisé à enregistrer des ordonnances.";
    }
    showResult("error", "Échec de l'enregistrement", message);
  } finally {
    updateSubmitState();
  }
});
