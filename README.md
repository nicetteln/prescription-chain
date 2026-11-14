# Prescription Chain

Vérification d'ordonnances PDF par blockchain.

## 1. Présentation

Prescription Chain est un mini-projet qui permet de garantir qu'une ordonnance PDF n'a pas été modifiée entre sa délivrance et sa présentation en pharmacie. Un médecin enregistre une ordonnance. Un pharmacien soumet ensuite un fichier PDF et son identifiant pour vérifier s'il correspond à ce qui a été enregistré.

La vérification renvoie l'un des trois résultats suivants.

| Résultat | Signification |
|---|---|
| Authentique | L'identifiant est enregistré et le fichier est identique à l'original. |
| Modifié | L'identifiant est enregistré mais le fichier diffère de l'original. |
| Non enregistré | Aucune ordonnance n'est enregistrée sous cet identifiant. |

## 2. Principe de fonctionnement

Le projet repose sur l'empreinte SHA-256 du fichier. Cette fonction de hachage produit, pour un contenu donné, une valeur de 256 bits toujours identique. Si un seul octet du fichier change, l'empreinte change complètement. Comparer deux empreintes revient donc à tester si deux fichiers sont identiques octet par octet.

Le PDF n'est pas stocké sur la blockchain, car le stockage de fichiers volumineux y est très coûteux. La blockchain conserve uniquement l'identifiant, l'empreinte SHA-256, le CID IPFS et la date d'enregistrement. Le PDF lui-même est stocké sur IPFS via le service Pinata, et son CID (identifiant de contenu IPFS) permet de le retrouver.

### Enregistrement (médecin)

1. Le navigateur envoie le PDF au backend (`POST /api/upload`).
2. Le backend vérifie que le fichier est un PDF de taille acceptable, calcule son SHA-256 et l'envoie sur IPFS via Pinata. Il renvoie l'empreinte et le CID.
3. Le navigateur appelle la fonction `register(id, hash, cid)` du contrat via Ethers.js. MetaMask demande au médecin de signer la transaction.
4. Le contrat vérifie que l'expéditeur est autorisé et que l'identifiant n'existe pas déjà, puis enregistre les données avec un horodatage et émet un événement.

### Vérification (pharmacien)

1. Le navigateur envoie le PDF et l'identifiant au backend (`POST /api/verify`).
2. Le backend calcule l'empreinte du fichier reçu et lit l'enregistrement correspondant dans le contrat (lecture seule, sans signature).
3. Le backend compare les empreintes et renvoie `authentic`, `modified` ou `not_registered`.

## 3. Architecture

| Composant | Rôle |
|---|---|
| Contrat intelligent (Solidity) | Stocke identifiant, empreinte, CID et horodatage. Applique le contrôle d'accès et refuse les identifiants en double. |
| Blockchain locale (nœud Hardhat) | Chaîne Ethereum locale avec comptes de test, utilisée pour le développement et la démonstration. |
| Backend (Node.js + Express) | Valide le PDF, calcule le SHA-256, communique avec Pinata, lit le contrat pour la vérification. |
| Stockage (IPFS via Pinata) | Conserve le fichier PDF original. |
| Interface web (HTML + JavaScript) | Deux pages : enregistrement et vérification. |
| Portefeuille (MetaMask) | Signe la transaction d'enregistrement avec le compte du médecin. |

Choix d'architecture : la transaction d'enregistrement est signée dans le navigateur par MetaMask et non par le backend. Le compte du médecin est ainsi l'identité vérifiée par le contrat, et le backend ne détient aucune clé privée.

## 4. Choix techniques

| Besoin | Choix | Justification |
|---|---|---|
| Outillage du contrat | Hardhat 3 | Truffle et Ganache ont été arrêtés par leurs mainteneurs en 2023. |
| Blockchain locale | Nœud intégré à Hardhat | Remplace Ganache : chaîne Ethereum locale avec comptes de test, compatible MetaMask. |
| Langage du contrat | Solidity | Imposé par le sujet. |
| Communication avec le contrat | Ethers.js | Inclus dans le modèle de projet Hardhat. |
| Signature des transactions | MetaMask | Imposé par le sujet. |
| Backend | Node.js + Express | Gère l'envoi du PDF, le SHA-256 et l'échange avec Pinata. |
| SHA-256 | Module `crypto` de Node.js | Aucune dépendance supplémentaire, le calcul est centralisé dans le backend. |
| IPFS | Pinata | Imposé par le sujet. |
| Interface web | HTML + JavaScript | Moins de dépendances qu'un framework, suffisant pour deux pages. |

## 5. Structure du dépôt

```
prescription-chain/
  contracts/      contrat Solidity
  test/           tests du contrat et de la vérification
  scripts/        scripts de déploiement
  backend/        serveur Node.js + Express
  frontend/       pages register.html et verify.html
  .env.example    modèle des variables d'environnement
  README.md
```

Cette structure sera complétée au fur et à mesure du développement.

## 6. Prérequis

Node.js 22 LTS ou plus récent (requis par Hardhat 3), Git, l'extension de navigateur MetaMask et un compte Pinata avec une clé d'API. Le projet est prévu pour fonctionner sous macOS, Linux et Windows.

## 7. Installation et lancement

Cette section sera complétée au fur et à mesure de la construction du projet. Les étapes prévues sont : cloner le dépôt, créer le fichier `.env`, installer les dépendances, démarrer le nœud local, compiler et déployer le contrat, lancer le backend, puis servir l'interface web.

Cloner le dépôt et préparer la configuration :

```
git clone <url-du-depot>
cd prescription-chain
cp .env.example .env
```

Sous Windows (invite de commandes), utiliser `copy .env.example .env` à la place de `cp`. Remplir ensuite `.env` avec ses propres valeurs.

## 8. Configuration

Les secrets sont stockés dans le fichier `.env`, qui n'est jamais versionné. Le fichier `.env.example` liste les variables attendues.

| Variable | Description |
|---|---|
| `PINATA_JWT` | Jeton d'API Pinata personnel de chaque développeur. |
| `PORT` | Port du backend. |
| `MAX_FILE_MB` | Taille maximale d'un PDF accepté, en Mo. |
| `RPC_URL` | Adresse du nœud Ethereum (nœud Hardhat local par défaut). |
| `CONTRACT_ADDRESS` | Adresse du contrat après déploiement. |

## 9. API du backend

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/upload` | Reçoit un PDF, renvoie son SHA-256 et son CID IPFS. |
| POST | `/api/verify` | Reçoit un PDF et un identifiant, renvoie `authentic`, `modified` ou `not_registered`. |

Les erreurs sont explicites : fichier invalide ou trop volumineux, IPFS indisponible, blockchain injoignable, transaction rejetée.

## 10. Contrat intelligent

Pour chaque ordonnance, le contrat stocke l'identifiant, l'empreinte SHA-256, le CID et l'horodatage d'enregistrement. Il expose une fonction d'enregistrement `register(string id, bytes32 hash, string cid)`, réservée aux comptes autorisés, qui refuse un identifiant déjà existant afin qu'un enregistrement ne puisse pas être écrasé. Une fonction de lecture renvoie l'empreinte et le CID associés à un identifiant. Un événement `PrescriptionRegistered` est émis à chaque enregistrement.

## 11. Sécurité et limites

Le contrôle d'accès du contrat limite l'enregistrement aux comptes autorisés et il est couvert par des tests. Aucun secret n'est présent dans le code : les clés Pinata restent dans `.env`. Les fichiers envoyés sont validés (type PDF et taille maximale) côté backend. L'enregistrement d'un identifiant déjà utilisé est refusé par le contrat.

Limite de confidentialité : IPFS est un réseau public. Toute personne connaissant le CID d'un fichier peut le télécharger. Pour des données médicales réelles, il faudrait chiffrer le PDF avant de l'envoyer sur IPFS, ou ne stocker que l'empreinte. Ce projet reste un prototype pédagogique.

## 12. Tests

Les tests prévus couvrent le contrat (enregistrement, doublon refusé, compte non autorisé refusé, lecture des valeurs), le hachage (même fichier donne le même hash, un octet modifié change le hash) et les trois scénarios de vérification : fichier intact, fichier modifié d'un octet, fichier jamais enregistré. Un test de bout-en-bout est prévu sur le nœud local avec un vrai PDF.

## 13. Démonstration

La démonstration utilise trois PDF préparés : un original, une copie falsifiée et un fichier jamais enregistré.

## 14. Avancement

| Section | Contenu | État |
|---|---|---|
| A | Mise en place (dépôt, outils, `.env`) | En cours |
| B | Contrat intelligent | À faire |
| C | Backend | À faire |
| D | Interface web | À faire |
| E | Sécurité | À faire |
| F | Tests | À faire |
| G | Finalisation (README, démonstration) | À faire |

Le projet est terminé lorsqu'un PDF peut être enregistré avec son CID et son empreinte sur la blockchain, et que la vérification renvoie le bon résultat sur les trois fichiers de démonstration.

