import { network } from "hardhat";
import { mkdirSync, writeFileSync } from "node:fs";

const { ethers } = await network.connect("localhost");

const [deployer] = await ethers.getSigners();
const registry = await ethers.deployContract("PrescriptionRegistry");
await registry.waitForDeployment();

const address = await registry.getAddress();
const chainId = (await ethers.provider.getNetwork()).chainId.toString();

mkdirSync("deployments", { recursive: true });
writeFileSync(
  "deployments/localhost.json",
  JSON.stringify(
    { network: "localhost", chainId, address, deployer: deployer.address, abi: JSON.parse(registry.interface.formatJson()) },
    null,
    2
  )
);

console.log("PrescriptionRegistry deployed");
console.log("  address :", address);
console.log("  deployer:", deployer.address);
console.log("  saved   : deployments/localhost.json");
