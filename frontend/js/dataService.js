/**
 * dataService.js
 * ----------------
 * Data processing & image URL resolution.
 * Converts raw image_id from the API response into a full image URL
 * and extracts metadata (video code, frame number).
 *
 * Modify this file when the data folder structure or naming convention changes.
 */

/**
 * Resolve a full image URL from an image_id returned by the backend.
 *
 * The backend returns IDs like:
 *   - "K01_V001/001.jpg"
 *   - "keyframes/K01_V001/001.jpg"
 *
 * Images are served via FastAPI static mount at /data/keyframes/...
 *
 * @param {string} imageId - The image_id from search results.
 * @returns {string} Full URL to load the image.
 */
function resolveImageUrl(imageId) {
  // Strip leading "keyframes/" if the backend already includes it
  const cleanId = imageId.replace(/^keyframes\//, "");
  return `./data/keyframes/${cleanId}`;
}

/**
 * Parse an image_id into structured metadata.
 *
 * @param {string} imageId - e.g. "K01_V001/001.jpg"
 * @returns {{ videoCode: string, frameNumber: string, fileName: string, displayLabel: string }}
 */
function parseImageId(imageId) {
  const cleanId = imageId.replace(/^keyframes\//, "");
  const parts = cleanId.split("/");

  const videoCode = parts.length > 1 ? parts[0] : "unknown";
  const fileName = parts.length > 1 ? parts[1] : parts[0];
  const frameNumber = fileName.replace(/\.\w+$/, ""); // strip extension

  return {
    videoCode,
    frameNumber,
    fileName,
    displayLabel: `${videoCode} / ${frameNumber}`,
  };
}

/**
 * Process raw API search results into a normalized flat array for the UI.
 * Handles both old flat format ({image_id}) and new grouped format ({video_id, group:[...]}).
 *
 * @param {Array} results - Raw results from API.
 * @returns {Array<{imageId, url, videoCode, frameNumber, displayLabel, ocrText, asrText, groupId}>}
 */
function processSearchResults(results) {
  if (!results || results.length === 0) return [];

  // New grouped format: [{video_id, group:[{image_id, ocr_text, asr_text}]}]
  if (results[0] && results[0].group) {
    const flat = [];
    results.forEach((group) => {
      group.group.forEach((item) => {
        const meta = parseImageId(item.image_id);
        flat.push({
          index: flat.length,
          imageId: item.image_id,
          url: resolveImageUrl(item.image_id),
          ocrText: item.ocr_text || "",
          asrText: item.asr_text || "",
          groupId: group.video_id,
          ...meta,
        });
      });
    });
    return flat;
  }

  // Legacy flat format: [{image_id}]
  return results.map((item, index) => {
    const meta = parseImageId(item.image_id);
    return {
      index,
      imageId: item.image_id,
      url: resolveImageUrl(item.image_id),
      ocrText: item.ocr_text || "",
      asrText: item.asr_text || "",
      groupId: meta.videoCode,
      ...meta,
    };
  });
}

/**
 * Process raw API search results into grouped structure for the UI.
 * @param {Array} results - Raw results from API.
 * @returns {Array<{groupId: string, items: Array}>}
 */
function processSearchResultsGrouped(results) {
  if (!results || results.length === 0) return [];

  // New grouped format
  if (results[0] && results[0].group) {
    return results.map((group) => ({
      groupId: group.video_id,
      items: group.group.map((item, i) => {
        const meta = parseImageId(item.image_id);
        return {
          imageId: item.image_id,
          url: resolveImageUrl(item.image_id),
          ocrText: item.ocr_text || "",
          asrText: item.asr_text || "",
          groupId: group.video_id,
          ...meta,
        };
      }),
    }));
  }

  // Legacy flat format — treat each image as its own group
  return results.map((item) => {
    const meta = parseImageId(item.image_id);
    const processed = {
      imageId: item.image_id,
      url: resolveImageUrl(item.image_id),
      ocrText: item.ocr_text || "",
      asrText: item.asr_text || "",
      groupId: meta.videoCode,
      ...meta,
    };
    return { groupId: meta.videoCode, items: [processed] };
  });
}

/**
 * In-memory cache: videoCode → string[] of bare frame IDs (e.g. "00012", "00045").
 * Populated on first request per video; entries are keyed by videoCode.
 * @type {Map<string, string[] | null>}
 */
const _frameListCache = new Map();

/**
 * Fetch and cache the ordered frame-ID manifest for a video.
 *
 * The manifest is served at: /keyframes_index/{videoCode}.json
 * It is expected to be a JSON array of bare frame IDs (no extension):
 *   e.g. ["00012", "00045", "00088", "00120"]
 *
 * Returns null when the manifest is unavailable (404 or network error).
 *
 * @param {string} videoCode - e.g. "K01_V001"
 * @returns {Promise<string[] | null>}
 */
async function fetchVideoFrameList(videoCode) {
  if (_frameListCache.has(videoCode)) {
    const cached = _frameListCache.get(videoCode);
    console.log(`[AdjacentFrames] Cache hit for video "${videoCode}":`, cached ? `${cached.length} frames` : "null (manifest unavailable)");
    return cached;
  }

  const url = `./data/keyframes_index/${videoCode}.json`;
  console.log(`[AdjacentFrames] Fetching manifest: ${url}`);

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[AdjacentFrames] Failed to fetch manifest for "${videoCode}" (HTTP ${res.status} ${res.statusText}) at ${url}`);
      _frameListCache.set(videoCode, null);
      return null;
    }
    const list = await res.json();
    if (!Array.isArray(list)) {
      console.error(`[AdjacentFrames] Invalid manifest format for "${videoCode}" (expected Array, got ${typeof list}):`, list);
      _frameListCache.set(videoCode, null);
      return null;
    }
    console.log(`[AdjacentFrames] Successfully loaded manifest for "${videoCode}" (${list.length} frames)`);
    _frameListCache.set(videoCode, list);
    return list;
  } catch (err) {
    console.error(`[AdjacentFrames] Network/Parse error fetching manifest for "${videoCode}" from ${url}:`, err);
    _frameListCache.set(videoCode, null);
    return null;
  }
}

/**
 * Build a full item object (compatible with processSearchResults output) from a
 * bare frame ID string returned by the manifest and the owning videoCode.
 *
 * @param {string} videoCode - e.g. "K01_V001"
 * @param {string} frameId   - bare frame ID from manifest, e.g. "00045"
 * @param {string} [ext=".webp"] - file extension e.g. ".webp" or ".jpg"
 * @returns {{ url, frameNumber, fileName, imageId, videoCode, displayLabel, ocrText, asrText, groupId }}
 */
function resolveFrameByVideoCode(videoCode, frameId, ext = ".webp") {
  const cleanExt = ext.startsWith(".") ? ext : `.${ext}`;
  const fileName = `${frameId}${cleanExt}`;
  const imageId  = `${videoCode}/${fileName}`;
  return {
    url:         resolveImageUrl(imageId),
    frameNumber: frameId,
    fileName,
    imageId,
    videoCode,
    displayLabel: `${videoCode} / ${frameId}`,
    ocrText:      "",
    asrText:      "",
    groupId:      videoCode,
  };
}

/* ──────────────── Media & Video Info ──────────────── */

/** In-memory cache for media json metadata */
const _mediaCache = new Map();

/**
 * Extract YouTube video ID from various YouTube URL formats.
 * @param {string} url - e.g. "https://youtube.com/watch?v=Rzpw5WR7nAY"
 * @returns {string|null}
 */
function extractYouTubeVideoId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

/**
 * Fetch YouTube video media info from static public storage: ./data/media/{videoCode}.json
 *
 * @param {string} videoCode - e.g. "L21_V001"
 * @returns {Promise<{ watch_url: string, videoId: string|null, title?: string, author?: string, publish_date?: string } | null>}
 */
async function fetchVideoMediaInfo(videoCode) {
  if (_mediaCache.has(videoCode)) {
    return _mediaCache.get(videoCode);
  }

  const url = `./data/media/${videoCode}.json`;
  console.log(`[MediaService] Fetching media info: ${url}`);

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[MediaService] Media JSON not found for "${videoCode}" (HTTP ${res.status}) at ${url}`);
      _mediaCache.set(videoCode, null);
      return null;
    }
    const data = await res.json();
    if (!data || !data.watch_url) {
      console.warn(`[MediaService] Missing watch_url in media JSON for "${videoCode}"`);
      _mediaCache.set(videoCode, null);
      return null;
    }

    const videoId = extractYouTubeVideoId(data.watch_url);
    const mediaInfo = {
      ...data,
      videoId,
    };
    console.log(`[MediaService] Loaded media info for "${videoCode}", videoId: ${videoId}`);
    _mediaCache.set(videoCode, mediaInfo);
    return mediaInfo;
  } catch (err) {
    console.error(`[MediaService] Error fetching/parsing media info for "${videoCode}":`, err);
    _mediaCache.set(videoCode, null);
    return null;
  }
}

/* ──────────────── FPS & Timestamp Calculations ──────────────── */

let _fpsMapCache = null;

/**
 * Fetch and parse video_fps.csv into an in-memory Map (videoCode -> fps).
 * @returns {Promise<Map<string, number>>}
 */
async function fetchFpsMap() {
  if (_fpsMapCache) return _fpsMapCache;

  _fpsMapCache = new Map();
  const url = "./video_fps.csv";
  console.log(`[MediaService] Fetching video FPS map from ${url}`);

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[MediaService] Failed to fetch video_fps.csv (HTTP ${res.status})`);
      return _fpsMapCache;
    }
    const text = await res.text();
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (index === 0 || !line.trim()) return; // skip header or empty lines
      const parts = line.split(",");
      if (parts.length >= 2) {
        const videoId = parts[0].trim();
        const fps = parseFloat(parts[1].trim());
        if (videoId && !isNaN(fps) && fps > 0) {
          _fpsMapCache.set(videoId, fps);
        }
      }
    });
    console.log(`[MediaService] Successfully loaded FPS map (${_fpsMapCache.size} videos)`);
    return _fpsMapCache;
  } catch (err) {
    console.error(`[MediaService] Error loading video_fps.csv:`, err);
    return _fpsMapCache;
  }
}

/**
 * Get FPS for a given videoCode (defaults to 25 if not found).
 * @param {string} videoCode
 * @returns {Promise<number>}
 */
async function getVideoFps(videoCode) {
  const map = await fetchFpsMap();
  const fps = map.get(videoCode);
  if (fps) return fps;
  console.warn(`[MediaService] FPS not found for video "${videoCode}". Defaulting to 25.`);
  return 25;
}

/**
 * Calculate start time in seconds from frame number and fps.
 * @param {string|number} frameNumber - e.g. "2859" or 2859
 * @param {number} fps - e.g. 30
 * @returns {number} Start seconds rounded to nearest integer
 */
function calculateFrameSeconds(frameNumber, fps) {
  const frameIdx = parseInt(String(frameNumber).replace(/\.\w+$/, ""), 10);
  if (isNaN(frameIdx) || !fps || fps <= 0) return 0;
  return Math.max(0, Math.round(frameIdx / fps));
}

/**
 * Format seconds into HH:MM:SS or MM:SS format.
 * @param {number} seconds
 * @returns {string} e.g. "01:35"
 */
function formatTimestamp(seconds) {
  const sec = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;

  const pad = (n) => String(n).padStart(2, "0");
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}
