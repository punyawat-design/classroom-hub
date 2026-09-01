export function googleDriveFileId(url?: string | null) {
  if (!url) return null;
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function isGoogleDriveUrl(url?: string | null) {
  return !!url && /drive\.google\.com/.test(url);
}

export function drivePreviewUrl(url: string) {
  const id = googleDriveFileId(url);
  return id ? `https://drive.google.com/file/d/${id}/preview` : url;
}

export function driveDownloadUrl(url: string) {
  const id = googleDriveFileId(url);
  return id ? `https://drive.google.com/uc?export=download&id=${id}` : url;
}

export function looksLikePdf(fileName?: string | null, url?: string | null) {
  return /\.pdf($|\?)/i.test(fileName || "") || /\.pdf($|\?)/i.test(url || "");
}

export function looksLikeZip(fileName?: string | null) {
  return /\.(zip|rar|7z)$/i.test(fileName || "");
}
