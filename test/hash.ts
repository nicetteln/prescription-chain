import { expect } from "chai";
import { readFileSync } from "node:fs";
import { sha256Hex } from "../backend/verification.js";

// A real PDF of the demo folder.
const loadPdf = () => readFileSync(new URL("../demo/ordonnance-originale.pdf", import.meta.url));

describe("SHA-256 of a PDF", function () {
  it("gives the same hash every time for the same file", function () {
    const a = sha256Hex(loadPdf());
    const b = sha256Hex(loadPdf());
    expect(a).to.equal(b);
    expect(a).to.match(/^0x[0-9a-f]{64}$/);
  });

  it("gives a different hash when one byte changes", function () {
    const original = loadPdf();
    const tampered = Buffer.from(original);
    tampered[tampered.length - 20] ^= 0x01; // flip one bit of one byte

    expect(tampered.equals(original)).to.equal(false);
    expect(sha256Hex(tampered)).to.not.equal(sha256Hex(original));
  });
});
