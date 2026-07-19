import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const client = new S3Client({
  endpoint: process.env.B2_ENDPOINT,
  region: process.env.B2_REGION,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY,
  },
});

const Bucket = process.env.B2_BUCKET;

export async function putObject(key, buffer, contentType) {
  await client.send(new PutObjectCommand({ Bucket, Key: key, Body: buffer, ContentType: contentType }));
}

export function presignedDownloadUrl(key, filename, contentType) {
  // Strip quotes + CR/LF from the ASCII fallback (header-safety), and add an
  // RFC 5987 filename* so non-ASCII/unicode names download intact rather than
  // garbled or truncated.
  const asciiName = filename.replace(/[\r\n"]/g, "");
  const utf8Name = encodeURIComponent(filename);

  const cmd = new GetObjectCommand({
    Bucket,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
    ResponseContentType: contentType,
  });

  return getSignedUrl(client, cmd, { expiresIn: 300 });
}

export async function deleteObject(key) {
  await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
}
