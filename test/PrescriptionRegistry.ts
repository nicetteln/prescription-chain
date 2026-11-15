import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("PrescriptionRegistry", function () {
  const ID = "RX-2026-0001";
  const CID = "bafybei-exemple-cid";
  const HASH = ethers.sha256(ethers.toUtf8Bytes("contenu du pdf"));
  const OTHER_HASH = ethers.sha256(ethers.toUtf8Bytes("contenu modifie"));

  async function deploy() {
    const [owner, doctor, stranger] = await ethers.getSigners();
    const registry = await ethers.deployContract("PrescriptionRegistry");
    return { registry, owner, doctor, stranger };
  }

  it("makes the deployer the owner and an authorized account", async function () {
    const { registry, owner } = await deploy();
    expect(await registry.owner()).to.equal(owner.address);
    expect(await registry.authorized(owner.address)).to.equal(true);
  });

  it("registers a prescription and read returns the right values", async function () {
    const { registry } = await deploy();
    await registry.register(ID, HASH, CID);

    const [hash, cid, timestamp] = await registry.getPrescription(ID);
    expect(hash).to.equal(HASH);
    expect(cid).to.equal(CID);
    expect(timestamp > 0n).to.equal(true);
    expect(await registry.isRegistered(ID)).to.equal(true);
  });

  it("emits PrescriptionRegistered with the right arguments", async function () {
    const { registry, owner } = await deploy();
    const tx = await registry.register(ID, HASH, CID);
    const receipt = await tx.wait();

    const parsed = registry.interface.parseLog(receipt!.logs[0]);
    expect(parsed!.name).to.equal("PrescriptionRegistered");
    expect(parsed!.args.id).to.equal(ID);
    expect(parsed!.args.hash).to.equal(HASH);
    expect(parsed!.args.cid).to.equal(CID);
    expect(parsed!.args.registeredBy).to.equal(owner.address);
  });

  it("refuses a duplicate ID and keeps the original record", async function () {
    const { registry } = await deploy();
    await registry.register(ID, HASH, CID);

    await expect(registry.register(ID, OTHER_HASH, "autre-cid"))
      .to.be.revertedWithCustomError(registry, "AlreadyRegistered");

    const [hash, cid] = await registry.getPrescription(ID);
    expect(hash).to.equal(HASH);
    expect(cid).to.equal(CID);
  });

  it("refuses an unauthorized account", async function () {
    const { registry, stranger } = await deploy();

    await expect(registry.connect(stranger).register(ID, HASH, CID))
      .to.be.revertedWithCustomError(registry, "NotAuthorized");
    expect(await registry.isRegistered(ID)).to.equal(false);
  });

  it("refuses an empty ID", async function () {
    const { registry } = await deploy();
    await expect(registry.register("", HASH, CID))
      .to.be.revertedWithCustomError(registry, "EmptyId");
  });

  it("lets the owner authorize and revoke an account", async function () {
    const { registry, doctor } = await deploy();

    await registry.setAuthorized(doctor.address, true);
    await registry.connect(doctor).register(ID, HASH, CID);
    expect(await registry.isRegistered(ID)).to.equal(true);

    await registry.setAuthorized(doctor.address, false);
    await expect(registry.connect(doctor).register("RX-2026-0002", HASH, CID))
      .to.be.revertedWithCustomError(registry, "NotAuthorized");
  });

  it("refuses setAuthorized from a non-owner", async function () {
    const { registry, stranger } = await deploy();
    await expect(registry.connect(stranger).setAuthorized(stranger.address, true))
      .to.be.revertedWithCustomError(registry, "NotOwner");
  });

  it("returns empty values for an unknown ID", async function () {
    const { registry } = await deploy();
    const [hash, cid, timestamp] = await registry.getPrescription("inconnu");
    expect(hash).to.equal(ethers.ZeroHash);
    expect(cid).to.equal("");
    expect(timestamp).to.equal(0n);
    expect(await registry.isRegistered("inconnu")).to.equal(false);
  });

  it("refuses the same file registered twice under another ID", async function () {
    const { registry } = await deploy();
    await registry.register(ID, HASH, CID);

    await expect(registry.register("RX-2026-0002", HASH, CID))
      .to.be.revertedWithCustomError(registry, "HashAlreadyRegistered");
    expect(await registry.isRegistered("RX-2026-0002")).to.equal(false);
  });

  it("tells whether a hash is already registered", async function () {
    const { registry } = await deploy();
    expect(await registry.isHashRegistered(HASH)).to.equal(false);
    await registry.register(ID, HASH, CID);
    expect(await registry.isHashRegistered(HASH)).to.equal(true);
    expect(await registry.isHashRegistered(OTHER_HASH)).to.equal(false);
  });
});
