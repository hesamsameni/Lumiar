/**
 * One-time migration script: Bunny.net → Cloudflare R2
 *
 * Tables handled:
 *   generations  → output_image_url  (lumiar-generations/)
 *                  input_image_url   (lumiar-original-images/)
 *   profiles     → avatar_url        (lumiar-profile-pics/)
 *   prompt_items → image_urls[]      (lumiar-thumbnails/)
 *
 * Run:
 *   node scripts/migrate-bunny-to-r2.mjs
 *
 * Requires .env to still contain the BUNNY_* variables alongside the new R2_* ones.
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Load .env manually (dotenv is a CJS module; use its config via require-like)
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");
const envLines = readFileSync(envPath, "utf8").split("\n");
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed
    .slice(eqIdx + 1)
    .trim()
    .replace(/^['"]|['"]$/g, "");
  if (!(key in process.env)) process.env[key] = val;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const _bunnyCdnRaw = process.env.BUNNY_CDN_URL?.replace(/\/+$/, "") ?? "";
const BUNNY_CDN_URL = _bunnyCdnRaw.startsWith("http")
  ? _bunnyCdnRaw
  : `https://${_bunnyCdnRaw}`;
const BUNNY_STORAGE_HOSTNAME = process.env.BUNNY_STORAGE_HOSTNAME;
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_API_KEY = process.env.BUNNY_API_KEY;

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

for (const [k, v] of Object.entries({
  BUNNY_CDN_URL,
  BUNNY_STORAGE_HOSTNAME,
  BUNNY_STORAGE_ZONE,
  BUNNY_API_KEY,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
})) {
  if (!v) {
    console.error(`Missing env var: ${k}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract path relative to the CDN base, e.g. "generations/uuid/file.png" */
function extractBunnyPath(url) {
  if (!url || !url.startsWith(BUNNY_CDN_URL)) return null;
  return url.slice(BUNNY_CDN_URL.length).replace(/^\/+/, "");
}

/**
 * Map the first segment (old folder) to the new R2 folder prefix.
 * e.g. "generations/uuid/file.png" → "lumiar-generations/uuid/file.png"
 */
const FOLDER_MAP = {
  generations: null, // determined by calling context (output vs input)
  "profile-pictures": "lumiar-profile-pics",
  "prompt-library": "lumiar-thumbnails",
};

function remapPath(bunnyPath, targetFolder) {
  const slashIdx = bunnyPath.indexOf("/");
  const rest = slashIdx === -1 ? bunnyPath : bunnyPath.slice(slashIdx + 1);
  return `${targetFolder}/${rest}`;
}

/** Download a file from Bunny storage API (authenticated). */
async function downloadFromBunny(bunnyPath) {
  const url = `https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${bunnyPath}`;
  const res = await fetch(url, { headers: { AccessKey: BUNNY_API_KEY } });
  if (!res.ok) throw new Error(`Bunny download failed (${res.status}): ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType =
    res.headers.get("content-type") ?? "application/octet-stream";
  return { buf, contentType };
}

/** Upload buffer to R2. Skips if key already exists. */
async function uploadToR2(key, buf, contentType) {
  // Skip if already exists
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return "skipped";
  } catch {
    // not found → proceed
  }
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: new Uint8Array(buf),
      ContentType: contentType,
    }),
  );
  return "uploaded";
}

function r2Url(key) {
  return `${R2_PUBLIC_URL}/${key}`;
}

let totalMigrated = 0;
let totalSkipped = 0;
let totalFailed = 0;

async function migrateUrl(bunnyUrl, targetFolder) {
  const bunnyPath = extractBunnyPath(bunnyUrl);
  if (!bunnyPath) return { newUrl: bunnyUrl, status: "not-bunny" };

  const r2Key = remapPath(bunnyPath, targetFolder);
  try {
    const { buf, contentType } = await downloadFromBunny(bunnyPath);
    const status = await uploadToR2(r2Key, buf, contentType);
    if (status === "uploaded") totalMigrated++;
    else totalSkipped++;
    return { newUrl: r2Url(r2Key), status };
  } catch (err) {
    totalFailed++;
    console.error(`  FAILED: ${bunnyUrl} — ${err.message}`);
    return { newUrl: bunnyUrl, status: "failed" };
  }
}

// ---------------------------------------------------------------------------
// Table migrations
// ---------------------------------------------------------------------------

async function migrateGenerations() {
  console.log("\n--- generations ---");
  const { data, error } = await supabase
    .from("generations")
    .select("id, output_image_url, input_image_url");
  if (error) throw error;
  console.log(`  Found ${data.length} rows`);

  for (const row of data) {
    const updates = {};

    if (row.output_image_url?.startsWith(BUNNY_CDN_URL)) {
      const { newUrl } = await migrateUrl(
        row.output_image_url,
        "lumiar-generations",
      );
      if (newUrl !== row.output_image_url) updates.output_image_url = newUrl;
    }

    if (row.input_image_url?.startsWith(BUNNY_CDN_URL)) {
      const { newUrl } = await migrateUrl(
        row.input_image_url,
        "lumiar-original-images",
      );
      if (newUrl !== row.input_image_url) updates.input_image_url = newUrl;
    }

    if (Object.keys(updates).length) {
      const { error: upErr } = await supabase
        .from("generations")
        .update(updates)
        .eq("id", row.id);
      if (upErr)
        console.error(
          `  DB update failed for generation ${row.id}:`,
          upErr.message,
        );
      else console.log(`  ✓ generation ${row.id}`);
    }
  }
}

async function migrateProfiles() {
  console.log("\n--- profiles ---");
  const { data, error } = await supabase
    .from("profiles")
    .select("id, avatar_url")
    .not("avatar_url", "is", null);
  if (error) throw error;
  const bunnyRows = data.filter((r) => r.avatar_url?.startsWith(BUNNY_CDN_URL));
  console.log(`  Found ${bunnyRows.length} rows with Bunny avatar URLs`);

  for (const row of bunnyRows) {
    const { newUrl } = await migrateUrl(row.avatar_url, "lumiar-profile-pics");
    if (newUrl !== row.avatar_url) {
      const { error: upErr } = await supabase
        .from("profiles")
        .update({ avatar_url: newUrl })
        .eq("id", row.id);
      if (upErr)
        console.error(
          `  DB update failed for profile ${row.id}:`,
          upErr.message,
        );
      else console.log(`  ✓ profile ${row.id}`);
    }
  }
}

async function migratePromptItems() {
  console.log("\n--- prompt_items ---");
  const { data, error } = await supabase
    .from("prompt_items")
    .select("id, image_urls");
  if (error) {
    console.log("  Skipped (table not found or no access):", error.message);
    return;
  }
  const rowsWithBunny = data.filter(
    (r) =>
      Array.isArray(r.image_urls) &&
      r.image_urls.some((u) => u?.startsWith(BUNNY_CDN_URL)),
  );
  console.log(`  Found ${rowsWithBunny.length} rows with Bunny image URLs`);

  for (const row of rowsWithBunny) {
    const newUrls = await Promise.all(
      row.image_urls.map(async (url) => {
        if (!url?.startsWith(BUNNY_CDN_URL)) return url;
        const { newUrl } = await migrateUrl(url, "lumiar-thumbnails");
        return newUrl;
      }),
    );
    const { error: upErr } = await supabase
      .from("prompt_items")
      .update({ image_urls: newUrls })
      .eq("id", row.id);
    if (upErr)
      console.error(
        `  DB update failed for prompt_item ${row.id}:`,
        upErr.message,
      );
    else console.log(`  ✓ prompt_item ${row.id}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("Starting Bunny → R2 migration...");
  console.log(`  Bunny CDN base: ${BUNNY_CDN_URL}`);
  console.log(`  R2 public URL:  ${R2_PUBLIC_URL}`);

  await migrateGenerations();
  await migrateProfiles();
  await migratePromptItems();

  console.log("\n=== Done ===");
  console.log(`  Uploaded : ${totalMigrated}`);
  console.log(`  Skipped  : ${totalSkipped} (already on R2)`);
  console.log(`  Failed   : ${totalFailed}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
