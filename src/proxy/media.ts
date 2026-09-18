export function relayLink(base: string, target: string, referer: string): string {
  return `${base.replace(/\/$/, "")}/api/hls?${new URLSearchParams({ url: target, referer })}`;
}

export async function selectMediaPlaylist(url: string, referer: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Referer: referer,
    },
  });
  const text = await res.text();
  if (!text.includes("#EXT-X-STREAM-INF")) return url;

  const lines = text.split(/\r?\n/);
  let bestBw = -1;
  let bestUri = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";
    if (!line.startsWith("#EXT-X-STREAM-INF:")) continue;
    const bw = Number(/BANDWIDTH=(\d+)/.exec(line)?.[1] ?? 0);
    const next = lines[i + 1]?.trim() ?? "";
    if (!next || next.startsWith("#")) continue;
    if (bw >= bestBw) {
      bestBw = bw;
      bestUri = next;
    }
  }
  if (!bestUri) return url;
  return bestUri.startsWith("http") ? bestUri : new URL(bestUri, url).href;
}
