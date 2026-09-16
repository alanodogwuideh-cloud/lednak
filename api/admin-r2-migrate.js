// Temporary migration endpoint. It only copies explicitly referenced portfolio media to R2 and never deletes the source.
export const access = "public";

const E = new TextEncoder();
const H = x => Array.from(new Uint8Array(x), b => b.toString(16).padStart(2, "0")).join("");
const SHA = async x => H(await crypto.subtle.digest("SHA-256", x));
const HM = async (k, s) => new Uint8Array(await crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw", k, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), E.encode(s)));

async function r2Put(key, body, contentType) {
  const account = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET_NAME;
  const ak = process.env.R2_ACCESS_KEY_ID;
  const secret = process.env.R2_SECRET_ACCESS_KEY;
  const host = `${account}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amz = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const date = amz.slice(0, 8);
  const payloadHash = await SHA(body);
  const path = `/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amz}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = `PUT\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${date}/auto/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amz}\n${scope}\n${await SHA(E.encode(canonicalRequest))}`;
  let signingKey = await HM(E.encode(`AWS4${secret}`), date);
  signingKey = await HM(signingKey, "auto");
  signingKey = await HM(signingKey, "s3");
  signingKey = await HM(signingKey, "aws4_request");
  const signature = H(await HM(signingKey, stringToSign));
  return fetch(`https://${host}${path}`, {
    method: "PUT",
    headers: {
      "x-amz-date": amz,
      "x-amz-content-sha256": payloadHash,
      Authorization: `AWS4-HMAC-SHA256 Credential=${ak}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "Content-Type": contentType || "application/octet-stream",
    },
    body,
  });
}

export default async function (req, res) {
  const sourcePath = String(req.body?.path || "").replace(/^\/+/, "");
  if (!sourcePath || sourcePath.includes("..")) return res.status(400).json({ error: "A valid source path is required." });
  const base = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !serviceKey) return res.status(500).json({ error: "Supabase migration source is not configured." });
  const sourceUrl = `${base}/storage/v1/object/portfolio-images/${sourcePath.split("/").map(encodeURIComponent).join("/")}`;
  const source = await fetch(sourceUrl, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
  if (!source.ok) return res.status(502).json({ error: `Supabase source returned ${source.status}.`, path: sourcePath });
  const body = new Uint8Array(await source.arrayBuffer());
  const put = await r2Put(sourcePath, body, source.headers.get("content-type") || "application/octet-stream");
  if (!put.ok) return res.status(502).json({ error: `R2 upload returned ${put.status}.`, path: sourcePath });
  return res.json({ ok: true, path: sourcePath, bytes: body.byteLength, contentType: source.headers.get("content-type") || "application/octet-stream" });
}