import { network } from "hardhat";
import { mkdirSync, writeFileSync } from "node:fs";

const DOCTOR_WALLET = "0x39b46ff6FC67a69160181A2Fd2c1F8eAe13D4C9d";

const { ethers } = await network.connect("localhost");
const [deployer] = await ethers.getSigners();
const registry = await ethers.deployContract("PrescriptionRegistry");
await registry.waitForDeployment();

// Automatically authorize & fund your MetaMask wallet
await (await registry.setAuthorized(DOCTOR_WALLET, true)).wait();
await (await deployer.sendTransaction({ to: DOCTOR_WALLET, value: ethers.parseEther("10") })).wait();

const address = await registry.getAddress();
const chainId = (await ethers.provider.getNetwork()).chainId.toString();
const abi = JSON.parse(registry.interface.formatJson());

mkdirSync("deployments", { recursive: true });
writeFileSync(
  "deployments/localhost.json",
  JSON.stringify({ network: "localhost", chainId, address, deployer: deployer.address, abi }, null, 2)
);

writeFileSync(
  "frontend/js/config.js",
  `export const API_URL = "http://localhost:3000";\nexport const CONTRACT = ${JSON.stringify({ address, chainId, abi }, null, 2)};\n`
);

console.log("PrescriptionRegistry ready at", address, "| Authorized:", DOCTOR_WALLET);
