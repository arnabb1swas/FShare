export function shareEmailHtml({ replyTo, downloadLink, size, expiresAt }) {
  const expires = expiresAt.toUTCString();
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><title>FShare</title></head>
  <body style="background:#f6f6f6;font-family:sans-serif;margin:0;padding:0">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;padding:20px">
      <tr><td style="background:#fff;border-radius:8px;padding:24px">
        <p>Hi there,</p>
        <p><b>${replyTo}</b> shared a file with you.</p>
        <p>${size} in total ・ Expires ${expires}</p>
        <p><a href="${downloadLink}" target="_blank"
          style="display:inline-block;background:#3498db;color:#fff;text-decoration:none;
          padding:12px 24px;border-radius:6px;font-weight:bold">Download file</a></p>
        <p style="color:#999;font-size:12px;margin-top:24px">Sent via FShare.</p>
      </td></tr>
    </table>
  </body></html>`;
}
