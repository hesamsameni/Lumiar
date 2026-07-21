/**
 * A single image chosen through the asset picker.
 * - `url`  → an already-hosted image (bucket asset or past generation). The
 *            server resolves it to base64 so the AI receives the pixels.
 * - `file` → a fresh device upload, handled through the normal upload pipeline.
 */
export type PickedAsset =
  | { kind: "url"; url: string }
  | { kind: "file"; file: File };
