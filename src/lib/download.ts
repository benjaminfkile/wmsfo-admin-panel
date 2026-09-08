// Client-side blob → file download. Used for location CSV exports and
// the subscriber export (admin.md 6.10, 6.3).

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export function downloadText(
  text: string,
  filename: string,
  contentType = "text/plain;charset=utf-8"
): void {
  downloadBlob(new Blob([text], { type: contentType }), filename);
}

export function downloadCsv(text: string, filename: string): void {
  downloadText(text, filename, "text/csv;charset=utf-8");
}
