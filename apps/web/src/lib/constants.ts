export const CDN_BASE = "https://bithaussstorage.blob.core.windows.net/images";

export function cdnUrl(path: string) {
  // Convert "/images/Casa1.jpg" → "https://bithaussstorage.blob.core.windows.net/images/Casa1.jpg"
  const filename = path.replace(/^\/images\//, "");
  return `${CDN_BASE}/${encodeURIComponent(filename)}`;
}
