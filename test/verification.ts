import { expect } from "chai";
import { network } from "hardhat";
import { readFileSync } from "node:fs";
import { sha256Hex, decideStatus } from "../backend/verification.js";

const { ethers } = await network.connect();

const loadPdf = (name: string) => readFileSync(new URL(`../demo/${name}`, import.meta.url));

// Same steps as POST /api/verify: hash the file, read the record, decide.
async function verify(registry: any, id: string, file: Uint8Array) {
  const [hash, cid, timestamp] = await registry.getPrescription(id);
  return decideStatus({ hash, cid, timestamp }, sha256Hex(file));
}

describe("Verification scenarios", function () {
  const ID = "RX-2026-0001";
  const CID = "bafybei-exemple-cid";

  async function deployAndRegisterOriginal() {
    const registry = await ethers.deployContract("PrescriptionRegistry");
    const original = loadPdf("ordonnance-originale.pdf");
    await registry.register(ID, sha256Hex(original), CID);
    return { registry, original };
  }

  it("an untouched file returns authentic", async function () {
    const { registry, original } = await deployAndRegisterOriginal();
    expect(await verify(registry, ID, original)).to.equal("authentic");
  });

  it("a file with one changed byte returns modified", async function () {
    const { registry, original } = await deployAndRegisterOriginal();
    const tampered = Buffer.from(original);
    tampered[tampered.length - 20] ^= 0x01;
    expect(await verify(registry, ID, tampered)).to.equal("modified");
  });

  it("the falsified demo PDF returns modified", async function () {
    const { registry } = await deployAndRegisterOriginal();
    const falsified = loadPdf("ordonnance-falsifiee.pdf");
    expect(await verify(registry, ID, falsified)).to.equal("modified");
  });

  it("a file never registered returns not registered", async function () {
    const { registry } = await deployAndRegisterOriginal();
    const other = loadPdf("ordonnance-non-enregistree.pdf");
    expect(await verify(registry, "RX-2026-0099", other)).to.equal("not_registered");
  });
});
