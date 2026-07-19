export function uploadFile(file, expiresISO, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("upfile", file);
    form.append("expires", expiresISO || "");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/files");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      let body = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body);
      } else {
        reject({ status: xhr.status, error: body.error || "Upload failed" });
      }
    };
    xhr.onerror = () => reject({ status: 0, error: "Network error" });
    xhr.send(form);
  });
}

export async function getFileMeta(slug) {
  const res = await fetch(`/api/files/${slug}`);
  if (!res.ok) {
    throw { status: res.status };
  }
  return res.json();
}

export async function sendEmail({ slug, emailTo, emailFrom }) {
  const res = await fetch("/api/files/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, emailTo, emailFrom }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw { status: res.status, error: body.error || "Failed to send" };
  }
}
