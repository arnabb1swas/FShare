import { test } from "node:test";
import assert from "node:assert/strict";
import { shareEmailHtml } from "../services/emailTemplate.js";
import { sendShareEmail } from "../services/email.js";

test("template embeds the download link", () => {
  const html = shareEmailHtml({ replyTo: "a@b.com", downloadLink: "http://x/files/abc", size: "10 KB", expiresAt: new Date() });
  assert.match(html, /http:\/\/x\/files\/abc/);
});

test("sendShareEmail uses MAIL_FROM and jsonTransport when no SMTP_HOST", async () => {
  const info = await sendShareEmail({
    to: "c@d.com", replyTo: "a@b.com", downloadLink: "http://x/files/abc",
    filename: "a.txt", size: "10 KB", expiresAt: new Date(),
  });
  const msg = JSON.parse(info.message);
  assert.equal(msg.from.address ?? msg.from, process.env.MAIL_FROM?.match(/<(.+)>/)?.[1] ?? process.env.MAIL_FROM);
  assert.equal(msg.replyTo?.[0]?.address ?? msg.replyTo, "a@b.com");
});
