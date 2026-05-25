import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  cdnUrl: string;
}

let _cachedClient: S3Client | null = null;
let _cachedEndpoint: string | null = null;

function getR2Client(config: R2Config): S3Client {
  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
  if (!_cachedClient || _cachedEndpoint !== endpoint) {
    _cachedClient = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    _cachedEndpoint = endpoint;
  }
  return _cachedClient;
}

export function buildCdnUrl(publicUrl: string, path: string): string {
  const base = publicUrl.replace(/\/+$/, "");
  return base.startsWith("http")
    ? `${base}/${path}`
    : `https://${base}/${path}`;
}

export function generateStorageFilename(ext: string): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
}

export async function uploadToR2(
  config: R2Config,
  path: string,
  buffer: Buffer,
  contentType: string = "application/octet-stream",
): Promise<void> {
  const client = getR2Client(config);
  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: path,
    Body: new Uint8Array(buffer),
    ContentType: contentType,
  });
  try {
    await client.send(command);
  } catch (err) {
    console.error(`[R2] Upload failed for key "${path}":`, err);
    throw new Error("R2 upload failed");
  }
}

export async function deleteFromR2(
  config: R2Config,
  path: string,
): Promise<void> {
  const client = getR2Client(config);
  const command = new DeleteObjectCommand({
    Bucket: config.bucketName,
    Key: path,
  });
  try {
    await client.send(command);
  } catch (err) {
    console.error(`[R2] Delete failed for key "${path}":`, err);
  }
}
