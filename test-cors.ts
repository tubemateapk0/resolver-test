import { listLivePopular, listStreams } from "./api/streamed.js";
import { findMatch } from "./api/streamed.js";
import { makeSlot, resolveGoat } from "./goat/resolve.js";
import { unlockGolf } from "./goat/golf.js";
import { selectMediaPlaylist } from "./proxy/media.js";
import { checkCors } from "./proxy/cors.js";
import { embedOrigin } from "./config/site.js";

async function testCors() {
  console.log("=== CORS Test for Stream Resolver ===\n");

  try {
    console.log("1. Fetching live matches...");
    const matches = await listLivePopular();
    console.log(`   Found ${matches.length} live matches\n`);

    if (matches.length === 0) {
      console.log("No live matches available. Try again when matches are live.");
      return;
    }

    const match = matches[0];
    console.log(`2. Testing with: ${match.title}`);
    console.log(`   Match ID: ${match.id}\n`);

    const streams = await listStreams(match.sources[0].source, match.sources[0].id);
    if (streams.length === 0) {
      console.log("   No streams available for this match.");
      return;
    }

    const stream = streams[0];
    console.log(`3. Selected stream: ${stream.language} (${stream.hd ? "HD" : "SD"})`);
    console.log(`   Source: ${stream.source}, Stream #: ${stream.streamNo}\n`);

    console.log("4. Resolving m3u8 URL...");
    const slot = makeSlot(stream.source, stream.id, stream.streamNo);
    let m3u8: string;

    if (stream.source === "golf") {
      m3u8 = await unlockGolf(slot);
    } else {
      m3u8 = await resolveGoat(slot);
    }

    const referer = `${embedOrigin}/`;
    const resolvedM3u8 = await selectMediaPlaylist(m3u8, referer);

    console.log(`   Resolved URL: ${resolvedM3u8}\n`);

    console.log("5. Testing CORS headers...");
    const corsResult = await checkCors(resolvedM3u8);

    console.log(`\n=== Results ===`);
    console.log(`URL: ${corsResult.url}`);
    console.log(`CORS Allowed: ${corsResult.corsAllowed ? "YES" : "NO"}`);

    if (corsResult.error) {
      console.log(`Error: ${corsResult.error}`);
    }

    console.log(`\nResponse Headers:`);
    for (const [key, value] of Object.entries(corsResult.headers)) {
      console.log(`  ${key}: ${value}`);
    }

    console.log(`\n=== Recommendation ===`);
    if (corsResult.corsAllowed) {
      console.log("CORS is enabled. Player can fetch directly from CDN.");
      console.log("Use direct m3u8 URL in HLS.js.");
    } else {
      console.log("CORS is NOT enabled. Player cannot fetch directly from CDN.");
      console.log("Use /api/hls relay endpoint instead.");
    }

  } catch (error) {
    console.error("Test failed:", error);
  }
}

testCors();
