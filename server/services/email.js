import nodemailer from "nodemailer";
import { shareEmailHtml } from "./emailTemplate.js";

function makeTransport() {
  if (!process.env.SMTP_HOST) {
    return nodemailer.createTransport({ jsonTransport: true }); // dev/test: no real send
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
  });
}

export async function sendShareEmail({ to, replyTo, downloadLink, filename, size, expiresAt }) {
  const transport = makeTransport();
  return transport.sendMail({
    from: process.env.MAIL_FROM,
    to,
    replyTo,
    subject: "A file was shared with you via FShare",
    text: `${replyTo} shared "${filename}" with you: ${downloadLink} (expires ${expiresAt.toUTCString()})`,
    html: shareEmailHtml({ replyTo, downloadLink, size, expiresAt }),
  });
}
