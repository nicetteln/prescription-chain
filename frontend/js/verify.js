import { API_URL } from "./config.js";

const $ = (id) => document.getElementById(id);

const form = $("verifyForm");
const idInput = $("prescriptionId");
const fileInput = $("pdfFile");
const verifyBtn = $("verifyBtn");

const resultEmpty = $("resultEmpty");
const resultEl = $("result");
const resultTitle = $("resultTitle");
const resultText = $("resultText");

const outId = $("outId");
const outDate = $("outDate");
const outChainHash = $("outChainHash");
const outFileHash = $("outFileHash");
const hashBadge = $("hashBadge");
const outCid = $("outCid");
const cidLink = $("cidLink");

function setResultState(state, title, text) {
  resultEmpty.hidden = true;
  resultEl.hidden = false;
  resultEl.dataset.state = state;
  resultTitle.textContent = title;
  resultText.textContent = text;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = idInput.value.trim();
  const file = fileInput.files?.[0];

  if (!id) {
    setResultState("error", "Identifiant manquant", "Saisissez l'identifiant de l'ordonnance à vérifier.");
    return;
  }
  if (!file) {
    setResultState("error", "Fichier manquant", "Sélectionnez le fichier PDF de l'ordonnance.");
    return;
  }

  verifyBtn.disabled = true;
  setResultState("loading", "Vérification en cours…", "Comparaison de l'empreinte du fichier avec la blockchain.");

  try {
    const fd = new FormData();
    fd.append("id", id);
    fd.append("file", file);

    const res = await fetch(`${API_URL}/api/verify`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Erreur serveur (${res.status})`);
    }

    outId.textContent = data.id || id;
    outFileHash.textContent = data.fileHash || "—";

    if (data.status === "not_registered") {
      setResultState(
        "not_registered",
        "Non enregistrée",
        "Aucune ordonnance ne correspond à cet identifiant sur la blockchain."
      );
      return;
    }

    outChainHash.textContent = data.chainHash || "—";
    outDate.textContent = data.registeredAt
      ? new Date(data.registeredAt).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })
      : "—";
    outCid.textContent = data.cid || "—";
    cidLink.href = data.cid ? `https://gateway.pinata.cloud/ipfs/${data.cid}` : "#";
    cidLink.target = "_blank";
    cidLink.rel = "noopener noreferrer";

    if (data.status === "authentic") {
      hashBadge.textContent = "Identique";
      setResultState(
        "authentic",
        "Ordonnance authentique",
        "L'empreinte du PDF correspond exactement à celle enregistrée sur la blockchain."
      );
    } else {
      hashBadge.textContent = "Différente";
      setResultState(
        "modified",
        "Document modifié ou falsifié",
        "L'empreinte de ce PDF ne correspond pas à l'ordonnance originale enregistrée."
      );
    }
  } catch (err) {
    setResultState("error", "Erreur de vérification", err?.message || "Impossible de contacter le serveur.");
  } finally {
    verifyBtn.disabled = false;
  }
});
