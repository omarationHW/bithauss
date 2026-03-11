export const CDN_BASE = "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images";

export function cdnUrl(path: string) {
  // Convert "/images/Casa1.jpg" → "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Casa1.jpg"
  const filename = path.replace(/^\/images\//, "");
  return `${CDN_BASE}/${encodeURIComponent(filename)}`;
}
