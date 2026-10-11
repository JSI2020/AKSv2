/**
 * Save an AI Studio image straight to disk instead of opening it in a tab.
 *
 * `<a download>` is ignored for cross-origin URLs (renders live on fal's
 * CDN), so remote images go through the same-origin download route, which
 * answers with `Content-Disposition: attachment`. Same-origin URLs (local
 * assets, blob/data URLs) can use the download attribute directly.
 */
export function downloadImage(url: string, filename: string): void {
  let href = url;
  try {
    const parsed = new URL(url, window.location.href);
    if (
      parsed.origin !== window.location.origin &&
      (parsed.protocol === "https:" || parsed.protocol === "http:")
    ) {
      href = `/api/photoreal/download?${new URLSearchParams({
        url: parsed.href,
        name: filename,
      }).toString()}`;
    }
  } catch {
    // Unparseable URL — fall through and let the browser try.
  }

  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
