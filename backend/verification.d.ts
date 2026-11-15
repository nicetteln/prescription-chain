export function sha256Hex(buffer: Uint8Array): string;
export function decideStatus(
  record: { hash: string; cid: string; timestamp: bigint | number },
  fileHash: string
): "authentic" | "modified" | "not_registered";
