import type { UploadTicket } from "../types";

export class UploadFailed extends Error {
  constructor(public readonly status: number) {
    super(`Upload failed with status ${status}`);
    this.name = "UploadFailed";
  }
}

export function uploadToS3(
  ticket: UploadTicket,
  file: File,
  onProgress: (fraction: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ticket.uploadUrl) {
      reject(new UploadFailed(0));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", ticket.uploadUrl, true);
    for (const [name, value] of Object.entries(ticket.headers ?? {})) {
      xhr.setRequestHeader(name, String(value));
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve();
      } else {
        reject(new UploadFailed(xhr.status));
      }
    };
    xhr.onerror = () => reject(new UploadFailed(0));
    xhr.onabort = () => reject(new UploadFailed(0));
    xhr.send(file);
  });
}
