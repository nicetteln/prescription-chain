import { createHash } from "node:crypto";

// SHA-256 as a 0x-prefixed hex string, the format of the contract's bytes32.
export function sha256Hex(buffer) {
  return "0x" + createHash("sha256").update(buffer).digest("hex");
}

// Decides the verification result from the on-chain record and the hash of the uploaded file.
// record = { hash, cid, timestamp } as returned by getPrescription (timestamp is a bigint).
// A timestamp of 0 means the ID was never registered.
export function decideStatus(record, fileHash) {
  if (BigInt(record.timestamp) === 0n) return "not_registered";
  return record.hash.toLowerCase() === fileHash.toLowerCase() ? "authentic" : "modified";
}
