import { network } from "hardhat";
import { mkdirSync, writeFileSync } from "node:fs";

const { ethers } = await network.connect("localhost");
const [deployer] = await ethers.getSigners();
const registry = await ethers.deployContract("PrescriptionRegistry");
await registry.waitForDeployment();

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

console.log("PrescriptionRegistry deployed");
console.log("  address :", address);
console.log("  deployer:", deployer.address);
console.log("  saved   : deployments/localhost.json & frontend/js/config.js");
