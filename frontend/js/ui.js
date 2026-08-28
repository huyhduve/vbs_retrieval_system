/**
 * ui.js
 * ------
 * All DOM manipulation and UI rendering logic.
 * Renders the image grid, preview modal, toasts, and submission history.
 */

/* ──────────────── State ──────────────── */
let currentResults = [];      // Array of processed image data
let currentPreviewIndex = -1; // Currently previewed image index
let currentPreviewItem = null;// Currently active image object displayed in preview modal
let currentQuery = "";        // Last search query

/**
 * Returns the currently active preview item (either the selected neighbor frame or search result frame).
 * @returns {object|null}
 */
function getCurrentPreviewItem() {
  return currentPreviewItem || (currentPreviewIndex >= 0 ? currentResults[currentPreviewIndex] : null);
}

/* ──────────────── Toast ──────────────── */

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => toast.classList.add("toast--visible"));

  setTimeout(() => {
    toast.classList.remove("toast--visible");
    toast.addEventListener("transitionend", () => toast.remove());
  }, 3000);
}

/* ──────────────── ASR Tooltip ──────────────── */

let _asrTooltipEl = null;

function initAsrTooltip() {
  if (_asrTooltipEl) return;
  _asrTooltipEl = document.createElement("div");
  _asrTooltipEl.id = "asr-tooltip";
  _asrTooltipEl.className = "asr-tooltip";
  document.body.appendChild(_asrTooltipEl);
}

function showAsrTooltip(text, x, y) {
  if (!_asrTooltipEl) initAsrTooltip();
  _asrTooltipEl.textContent = text;
  _asrTooltipEl.classList.add("visible");
  updateAsrTooltipPosition(x, y);
}

function updateAsrTooltipPosition(x, y) {
  if (!_asrTooltipEl) return;
  const offset = 15;
  let left = x + offset;
  let top = y + offset;

  // Prevent off-screen positioning
  const rect = _asrTooltipEl.getBoundingClientRect();
  if (left + rect.width > window.innerWidth) {
    left = x - rect.width - offset;
  }
  if (top + rect.height > window.innerHeight) {
    top = y - rect.height - offset;
  }

  _asrTooltipEl.style.left = `${Math.max(0, left)}px`;
  _asrTooltipEl.style.top = `${Math.max(0, top)}px`;
}

function hideAsrTooltip() {
  if (_asrTooltipEl) {
    _asrTooltipEl.classList.remove("visible");
  }
}

// Auto init DOMContentLoaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAsrTooltip);
} else {
  initAsrTooltip();
}

/* ──────────────── Image Grid ──────────────── */

/**
 * Render image grid grouped by video.
 * @param {Array<{groupId: string, items: Array}>} groups
 */
function renderGrid(groups) {
  const grid = document.getElementById("image-grid");
  grid.innerHTML = "";

  if (!groups || groups.length === 0) {
    grid.innerHTML = `<div class="grid-empty">No results. Enter Text, ASR, or OCR and click Search.</div>`;
    return;
  }

  // Build a flat index map so click handlers can reference currentResults
  let flatIndex = 0;

  groups.forEach((group) => {
    const row = document.createElement("div");
    row.className = "grid-group-row";

    // Group header
    const header = document.createElement("div");
    header.className = "grid-group-header";
    header.textContent = group.groupId;
    row.appendChild(header);

    // Horizontal strip of cards
    const strip = document.createElement("div");
    strip.className = "grid-group-strip";

    group.items.forEach((item) => {
      const idx = flatIndex++;
      const card = document.createElement("div");
      card.className = "grid-card";
      card.dataset.index = idx;

      const img = document.createElement("img");
      img.src = item.url;
      img.alt = item.displayLabel;
      img.loading = "lazy";
      img.decoding = "async";
      img.onerror = () => {
        img.style.display = "none";
        card.classList.add("grid-card--error");
        card.innerHTML += `<span class="grid-card__error-text">⚠ Load failed</span>`;
      };

      const label = document.createElement("span");
      label.className = "grid-card__label";
      label.textContent = item.frameNumber;

      card.appendChild(img);
      card.appendChild(label);
      card.addEventListener("click", () => openPreview(idx));

      // ASR Tooltip Hover Handlers
      let isMouseOver = false;
      card.addEventListener("mouseenter", async (e) => {
        isMouseOver = true;
        showAsrTooltip("Loading ASR...", e.clientX, e.clientY);
        
        try {
          const asrText = await getAsrTextForFrame(item.videoCode, item.frameNumber);
          if (isMouseOver) {
            showAsrTooltip(asrText || "No ASR transcript available", e.clientX, e.clientY);
          }
        } catch (err) {
          if (isMouseOver) {
            showAsrTooltip("Error loading ASR", e.clientX, e.clientY);
          }
        }
      });

      card.addEventListener("mousemove", (e) => {
        if (isMouseOver) {
          updateAsrTooltipPosition(e.clientX, e.clientY);
        }
      });

      card.addEventListener("mouseleave", () => {
        isMouseOver = false;
        hideAsrTooltip();
      });

      strip.appendChild(card);
    });

    row.appendChild(strip);
    grid.appendChild(row);
  });
}

function updateResultCount(count) {
  const el = document.getElementById("result-count");
  el.textContent = count > 0 ? `${count} results` : "";
}

/* ──────────────── Floating Preview Window Manager ──────────────── */

let _highestZIndex = 1000;
const openPreviewWindows = new Map(); // winId -> PreviewWindow instance
let _activePreviewWindow = null;
const STRIP_WINDOW = 7;

/**
 * Returns the currently active preview item from the focused window.
 * @returns {object|null}
 */
function getCurrentPreviewItem() {
  return _activePreviewWindow ? _activePreviewWindow.previewItem : null;
}

class PreviewWindow {
  constructor(resultIndex, item) {
    this.resultIndex = resultIndex;
    this.previewItem = { ...item };
    this.id = `preview-win-${resultIndex}-${Date.now()}`;

    // Neighbor strip state per window instance
    this.stripVisible = false;
    this.stripFrameList = null;
    this.stripCurrentIndex = -1;
    this.stripVideoCode = null;
    this.stripExt = item.fileName ? (item.fileName.match(/\.\w+$/)?.[0] || ".webp") : ".webp";

    this.createDom();
    this.setupDragging();
    this.setupEvents();
    this.updateTimeMs();
    this.updateAsrText();
    this.focus();
  }

  createDom() {
    const container = document.getElementById("preview-windows-container") || document.body;

    // Calculate staggered cascade position
    const cascadeOffset = (openPreviewWindows.size * 35) % 240;
    const initialLeft = Math.min(window.innerWidth - 860, Math.max(20, 60 + cascadeOffset));
    const initialTop = Math.min(window.innerHeight - 560, Math.max(20, 60 + cascadeOffset));

    const winEl = document.createElement("div");
    winEl.className = "preview-window-floating";
    winEl.id = this.id;
    winEl.style.left = `${initialLeft}px`;
    winEl.style.top = `${initialTop}px`;

    winEl.innerHTML = `
      <div class="preview-panel">
        <div class="preview-panel__header">
          <span class="preview-panel__counter">${this.resultIndex + 1} / ${currentResults.length}</span>
          <div class="preview-panel__header-actions">
            <button class="show-video-btn" title="Watch Video on YouTube">
              ▶ Show Video
            </button>
            <button class="preview-similarity-btn" title="Search similar images by Image ID">🔍 Similarity Search</button>
            <button class="adj-strip-toggle" title="Toggle adjacent frame strip">
              👁️ Show Neighbor Frames
            </button>
            <button class="preview-panel__close" title="Close Window">✕</button>
          </div>
        </div>
        <div class="preview-panel__body">
          <div class="preview-panel__image-wrap">
            <button class="preview-panel__nav preview-panel__nav--prev">◀</button>
            <img class="preview-image" src="${this.previewItem.url}" alt="${this.previewItem.displayLabel}" />
            <button class="preview-panel__nav preview-panel__nav--next">▶</button>
          </div>
          <aside class="preview-panel__sidebar">
            <div class="preview-info__group">
              <span class="preview-info__label">Video-Frame</span>
              <span class="preview-info-videoframe preview-info__value">${this.previewItem.videoCode} - ${this.previewItem.frameNumber}</span>
            </div>
            <div class="preview-info__group">
              <span class="preview-info__label">Time (ms)</span>
              <span class="preview-info-timems preview-info__value">—</span>
            </div>
            <div class="preview-info__group">
              <span class="preview-info__label">Context Summary</span>
              <span class="preview-info-asr preview-info__value preview-info__value--text">${this.previewItem.asrText || "—"}</span>
            </div>
            <button class="preview-submit-btn">Submit</button>
          </aside>
        </div>
        <!-- ── Adjacent Frame Strip ── -->
        <div class="adj-strip-wrapper" hidden>
          <button class="adj-strip-nav adj-strip-prev" title="Shift strip left (earlier frames)">◀</button>
          <div class="adj-strip-frames"></div>
          <button class="adj-strip-nav adj-strip-next" title="Shift strip right (later frames)">▶</button>
        </div>
      </div>
    `;

    container.appendChild(winEl);
    this.winEl = winEl;

    // Cache element references
    this.headerEl = winEl.querySelector(".preview-panel__header");
    this.counterEl = winEl.querySelector(".preview-panel__counter");
    this.showVideoBtn = winEl.querySelector(".show-video-btn");
    this.toggleBtn = winEl.querySelector(".adj-strip-toggle");
    this.closeBtn = winEl.querySelector(".preview-panel__close");
    this.prevBtn = winEl.querySelector(".preview-panel__nav--prev");
    this.nextBtn = winEl.querySelector(".preview-panel__nav--next");
    this.imageEl = winEl.querySelector(".preview-image");
    this.infoVideoFrameEl = winEl.querySelector(".preview-info-videoframe");
    this.infoTimeMsEl = winEl.querySelector(".preview-info-timems");
    this.infoAsrEl = winEl.querySelector(".preview-info-asr");
    this.similarityBtn = winEl.querySelector(".preview-similarity-btn");
    this.submitBtn = winEl.querySelector(".preview-submit-btn");

    this.stripWrapperEl = winEl.querySelector(".adj-strip-wrapper");
    this.stripPrevBtn = winEl.querySelector(".adj-strip-prev");
    this.stripFramesEl = winEl.querySelector(".adj-strip-frames");
    this.stripNextBtn = winEl.querySelector(".adj-strip-next");
  }

  focus() {
    _highestZIndex += 1;
    this.winEl.style.zIndex = _highestZIndex;
    openPreviewWindows.forEach((win) => win.winEl.classList.remove("preview-window-floating--active"));
    this.winEl.classList.add("preview-window-floating--active");
    _activePreviewWindow = this;
  }

  setupDragging() {
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    const onMouseDown = (e) => {
      if (e.target.closest("button")) return;

      this.focus();
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = this.winEl.offsetLeft;
      initialTop = this.winEl.offsetTop;

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newLeft = initialLeft + dx;
      let newTop = initialTop + dy;

      newLeft = Math.max(-this.winEl.offsetWidth + 100, Math.min(window.innerWidth - 100, newLeft));
      newTop = Math.max(0, Math.min(window.innerHeight - 60, newTop));

      this.winEl.style.left = `${newLeft}px`;
      this.winEl.style.top = `${newTop}px`;
    };

    const onMouseUp = () => {
      isDragging = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    this.headerEl.addEventListener("mousedown", onMouseDown);
  }

  setupEvents() {
    this.winEl.addEventListener("mousedown", () => this.focus());
    this.closeBtn.addEventListener("click", () => this.close());
    this.prevBtn.addEventListener("click", () => this.navigateResult(-1));
    this.nextBtn.addEventListener("click", () => this.navigateResult(1));
    this.toggleBtn.addEventListener("click", () => this.toggleStrip());
    this.stripPrevBtn.addEventListener("click", () => this.shiftStrip(-1));
    this.stripNextBtn.addEventListener("click", () => this.shiftStrip(1));

    if (this.showVideoBtn) {
      this.showVideoBtn.addEventListener("click", () => {
        console.log(`[ShowVideo] Opening video "${this.previewItem.videoCode}" at frame "${this.previewItem.frameNumber}"`);
        openVideoWindow(this.previewItem.videoCode, this.previewItem.frameNumber);
      });
    }

    if (this.similarityBtn) {
      this.similarityBtn.addEventListener("click", async () => {
        const imageId = this.previewItem.imageId;
        if (!imageId) {
          showToast("Invalid image ID for similarity search", "error");
          return;
        }

        this.similarityBtn.disabled = true;
        this.similarityBtn.textContent = "Searching...";
        showToast(`Searching similar images for ${this.previewItem.displayLabel}…`, "info");

        try {
          const data = await searchSimilarImages(imageId);
          const results = data.results || [];
          const grouped = processSearchResultsGrouped(results);
          const flat = processSearchResults(results);

          document.dispatchEvent(
            new CustomEvent("similaritySearchComplete", {
              detail: {
                title: `Sim: ${this.previewItem.videoCode}/${this.previewItem.frameNumber}`,
                query: "",
                searchResults: flat,
                groupedResults: grouped,
                topK: flat.length || 100,
              },
            })
          );
        } catch (err) {
          console.error("Similarity search error:", err);
          showToast(`Similarity search failed: ${err.message}`, "error");
        } finally {
          this.similarityBtn.disabled = false;
          this.similarityBtn.textContent = "🔍 Similarity Search";
        }
      });
    }

    this.submitBtn.addEventListener("click", async () => {
      this.submitBtn.disabled = true;
      this.submitBtn.textContent = "Submitting...";

      const result = await handleSubmit(this.previewItem, currentQuery);

      if (result.success) {
        showToast(`Submitted: ${this.previewItem.displayLabel}`, "success");
      } else {
        showToast(`Submit failed: ${result.message}`, "error");
      }

      this.submitBtn.disabled = false;
      this.submitBtn.textContent = "Submit";
    });
  }

  navigateResult(direction) {
    const newIdx = this.resultIndex + direction;
    if (newIdx >= 0 && newIdx < currentResults.length) {
      this.resultIndex = newIdx;
      this.previewItem = { ...currentResults[newIdx] };
      this.stripCurrentIndex = -1;
      this.updateContent();
      if (this.stripVisible) {
        this.renderStrip();
      }
    }
  }

  updateContent() {
    this.imageEl.src = this.previewItem.url;
    this.imageEl.alt = this.previewItem.displayLabel;
    this.infoVideoFrameEl.textContent = `${this.previewItem.videoCode} - ${this.previewItem.frameNumber}`;
    this.infoAsrEl.textContent = this.previewItem.asrText || "—";

    const isAdj = this.previewItem.frameNumber !== currentResults[this.resultIndex]?.frameNumber;
    this.counterEl.textContent = isAdj
      ? `${this.resultIndex + 1} / ${currentResults.length} · adj`
      : `${this.resultIndex + 1} / ${currentResults.length}`;

    this.updateTimeMs();
    this.updateAsrText();
  }

  async updateTimeMs() {
    if (!this.infoTimeMsEl) return;
    const targetVideoCode = this.previewItem.videoCode;
    const targetFrameNumber = this.previewItem.frameNumber;
    const fps = await getVideoFps(targetVideoCode);
    if (this.previewItem && this.previewItem.videoCode === targetVideoCode && this.previewItem.frameNumber === targetFrameNumber) {
      const timeMs = calculateFrameMs(targetFrameNumber, fps);
      this.infoTimeMsEl.textContent = `${timeMs}`;
    }
  }

  async updateAsrText() {
    if (!this.infoAsrEl) return;
    this.infoAsrEl.textContent = "Loading ASR...";

    const targetVideoCode = this.previewItem.videoCode;
    const targetFrameNumber = this.previewItem.frameNumber;
    try {
      const text = await getAsrTextForFrame(targetVideoCode, targetFrameNumber);
      if (this.previewItem && this.previewItem.videoCode === targetVideoCode && this.previewItem.frameNumber === targetFrameNumber) {
        const displayText = text || "No ASR transcript available";
        this.infoAsrEl.textContent = displayText;
        this.previewItem.asrText = displayText;
      }
    } catch (err) {
      if (this.previewItem && this.previewItem.videoCode === targetVideoCode && this.previewItem.frameNumber === targetFrameNumber) {
        this.infoAsrEl.textContent = "Error loading ASR";
      }
    }
  }

  toggleStrip() {
    this.stripVisible = !this.stripVisible;
    showToast(this.stripVisible ? "Showing neighbor frames" : "Hiding neighbor frames", "info");
    this.updateStripVisibility();

    if (this.stripVisible) {
      this.stripCurrentIndex = -1;
      this.renderStrip();
    }
  }

  updateStripVisibility() {
    this.stripWrapperEl.hidden = !this.stripVisible;
    this.toggleBtn.classList.toggle("adj-strip-toggle--active", this.stripVisible);
    this.toggleBtn.textContent = this.stripVisible ? "👁️ Hide Neighbor Frames" : "👁️ Show Neighbor Frames";
  }

  async renderStrip() {
    const anchor = this.previewItem;
    if (!anchor) return;

    if (anchor.fileName) {
      const extMatch = anchor.fileName.match(/\.\w+$/);
      if (extMatch) this.stripExt = extMatch[0];
    }

    this.stripFramesEl.innerHTML = `<span class="adj-strip-message">Loading frames…</span>`;
    this.stripPrevBtn.disabled = true;
    this.stripNextBtn.disabled = true;

    if (this.stripVideoCode !== anchor.videoCode) {
      this.stripFrameList = await fetchVideoFrameList(anchor.videoCode);
      this.stripVideoCode = anchor.videoCode;
      this.stripCurrentIndex = -1;
    }

    if (!this.stripFrameList) {
      this.stripFramesEl.innerHTML = `<span class="adj-strip-message adj-strip-message--error">
        Frame index manifest not available for <strong>${anchor.videoCode}</strong>
      </span>`;
      return;
    }

    if (this.stripCurrentIndex < 0 || this.stripFrameList[this.stripCurrentIndex] !== anchor.frameNumber) {
      this.stripCurrentIndex = this.stripFrameList.indexOf(anchor.frameNumber);
    }

    if (this.stripCurrentIndex < 0) {
      this.stripCurrentIndex = 0;
    }

    this.renderStripThumbnails();
    this.stripPrevBtn.disabled = this.stripCurrentIndex <= 0;
    this.stripNextBtn.disabled = this.stripCurrentIndex >= this.stripFrameList.length - 1;
  }

  renderStripThumbnails() {
    this.stripFramesEl.innerHTML = "";

    const half = Math.floor(STRIP_WINDOW / 2);
    const startIdx = Math.max(0, this.stripCurrentIndex - half);
    const endIdx = Math.min(this.stripFrameList.length, startIdx + STRIP_WINDOW);
    const slice = this.stripFrameList.slice(startIdx, endIdx);

    slice.forEach((frameId, i) => {
      const absoluteIdx = startIdx + i;
      const frameData = resolveFrameByVideoCode(this.stripVideoCode, frameId, this.stripExt);

      const thumb = document.createElement("div");
      thumb.className = "adj-thumb";
      if (absoluteIdx === this.stripCurrentIndex) thumb.classList.add("adj-thumb--active");

      const img = document.createElement("img");
      img.src = frameData.url;
      img.alt = frameData.frameNumber;
      img.loading = "lazy";
      img.decoding = "async";
      img.onerror = () => {
        img.style.display = "none";
        thumb.classList.add("adj-thumb--error");
      };

      const label = document.createElement("span");
      label.className = "adj-thumb__label";
      label.textContent = frameData.frameNumber;

      thumb.appendChild(img);
      thumb.appendChild(label);
      thumb.addEventListener("click", () => this.selectAdjacentFrame(frameData, absoluteIdx));
      this.stripFramesEl.appendChild(thumb);
    });
  }

  selectAdjacentFrame(frameData, manifestIdx) {
    this.previewItem = {
      ...frameData,
      ocrText: "",
      asrText: "",
      groupId: frameData.videoCode,
      displayLabel: frameData.displayLabel,
    };

    this.stripCurrentIndex = manifestIdx;
    this.updateContent();

    if (this.stripVisible && this.stripFrameList) {
      this.renderStripThumbnails();
      this.stripPrevBtn.disabled = this.stripCurrentIndex <= 0;
      this.stripNextBtn.disabled = this.stripCurrentIndex >= this.stripFrameList.length - 1;
    }
  }

  shiftStrip(direction) {
    if (!this.stripFrameList) return;

    const newIdx = this.stripCurrentIndex + direction;
    if (newIdx < 0 || newIdx >= this.stripFrameList.length) return;

    this.stripCurrentIndex = newIdx;
    const frameData = resolveFrameByVideoCode(this.stripVideoCode, this.stripFrameList[newIdx], this.stripExt);
    this.selectAdjacentFrame(frameData, newIdx);
  }

  close() {
    if (this.winEl && this.winEl.parentNode) {
      this.winEl.parentNode.removeChild(this.winEl);
    }
    openPreviewWindows.delete(this.id);
    if (_activePreviewWindow === this) {
      _activePreviewWindow = Array.from(openPreviewWindows.values()).pop() || null;
      if (_activePreviewWindow) _activePreviewWindow.focus();
    }
  }
}

/**
 * Open (or focus) a floating preview window for a result item by its flat index.
 * @param {number} index - Index in currentResults
 */
function openPreview(index) {
  if (index < 0 || index >= currentResults.length) return;

  const item = currentResults[index];
  // Check if a window for this result index is already open
  for (const win of openPreviewWindows.values()) {
    if (win.resultIndex === index) {
      win.focus();
      return win;
    }
  }

  const win = new PreviewWindow(index, item);
  openPreviewWindows.set(win.id, win);
  return win;
}

function closePreview() {
  if (_activePreviewWindow) {
    _activePreviewWindow.close();
  }
}

function navigatePreview(direction) {
  if (_activePreviewWindow) {
    _activePreviewWindow.navigateResult(direction);
  }
}

function toggleAdjacentStrip() {
  if (_activePreviewWindow) {
    _activePreviewWindow.toggleStrip();
  }
}

function shiftAdjacentStrip(direction) {
  if (_activePreviewWindow) {
    _activePreviewWindow.shiftStrip(direction);
  }
}

/* ──────────────── Floating Video Window Manager & YouTube API ──────────────── */

let _ytApiReady = false;
const _ytApiReadyCallbacks = [];

window.onYouTubeIframeAPIReady = function () {
  _ytApiReady = true;
  while (_ytApiReadyCallbacks.length > 0) {
    const cb = _ytApiReadyCallbacks.shift();
    try {
      cb();
    } catch (e) {
      console.error("[YouTubeAPI] Callback error:", e);
    }
  }
};

function ensureYouTubeIframeAPI(callback) {
  if (_ytApiReady || (window.YT && window.YT.Player)) {
    _ytApiReady = true;
    callback();
    return;
  }
  _ytApiReadyCallbacks.push(callback);
  if (!document.getElementById("yt-iframe-api-script")) {
    const tag = document.createElement("script");
    tag.id = "yt-iframe-api-script";
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }
}

const openVideoWindows = new Map(); // winId -> VideoWindow instance
let _activeVideoWindow = null;

class VideoWindow {
  constructor(videoCode, mediaInfo, frameNumber = null, fps = 25, startSeconds = 0) {
    this.videoCode = videoCode;
    this.mediaInfo = mediaInfo;
    this.frameNumber = frameNumber;
    this.fps = fps;
    this.startSeconds = startSeconds;
    this.id = `video-win-${videoCode}-${Date.now()}`;
    this.playerId = `yt-player-${this.id}`;
    this.player = null;
    this.isPlayerReady = false;
    this.isPlaying = false;
    this.timeTrackerInterval = null;

    this.createDom();
    this.setupDragging();
    this.setupEvents();
    this.initYouTubePlayer();
    this.focus();
  }

  createDom() {
    const container = document.getElementById("preview-windows-container") || document.body;

    const cascadeOffset = (openVideoWindows.size * 35) % 240;
    const initialLeft = Math.min(window.innerWidth - 920, Math.max(20, 60 + cascadeOffset));
    const initialTop = Math.min(window.innerHeight - 640, Math.max(20, 50 + cascadeOffset));

    const winEl = document.createElement("div");
    winEl.className = "video-window-floating";
    winEl.id = this.id;
    winEl.style.left = `${initialLeft}px`;
    winEl.style.top = `${initialTop}px`;

    const title = this.mediaInfo.title || `Video ${this.videoCode}`;
    const author = this.mediaInfo.author || "YouTube";
    const timeFormatted = formatTimestamp(this.startSeconds);
    const initialMs = Math.floor(this.startSeconds * 1000);

    const initialFrame = this.frameNumber !== null ? this.frameNumber : Math.round(this.startSeconds * this.fps);

    const timestampUrl = this.mediaInfo.watch_url
      ? `${this.mediaInfo.watch_url}${this.mediaInfo.watch_url.includes("?") ? "&" : "?"}t=${this.startSeconds}s`
      : "";

    winEl.innerHTML = `
      <div class="video-panel">
        <div class="video-panel__header">
          <div class="video-panel__title-wrap">
            <span class="video-panel__tag">🎥 ${this.videoCode}</span>
            <span class="video-panel__timestamp" title="Real-time frame @ ${this.fps} FPS">Frame : <strong class="video-frame-val">${initialFrame}</strong></span>
            <span class="video-panel__timems-tag" title="Time (ms) - current playback position in milliseconds">
              Time (ms): <strong class="video-timems-val">${initialMs}</strong>
            </span>
            <span class="video-panel__title" title="${title}">${title}</span>
          </div>
          <div class="video-panel__header-actions">
            ${
              this.mediaInfo.videoId
                ? `<button class="video-play-btn" title="Play / Pause Video">▶ Play</button>`
                : ""
            }
            <a href="${timestampUrl}" target="_blank" rel="noopener noreferrer" class="video-panel__ext-link" title="Open on YouTube at ${timeFormatted}">
              ↗ YouTube (${timeFormatted})
            </a>
            <button class="video-panel__close" title="Close Video">✕</button>
          </div>
        </div>
        <div class="video-panel__body">
          ${
            this.mediaInfo.videoId
              ? `<div id="${this.playerId}" class="video-iframe"></div>`
              : `<div class="video-error-fallback">
                  <p>Cannot embed video stream.</p>
                  <a href="${timestampUrl}" target="_blank" class="btn-yt-direct">Watch on YouTube.com (${timeFormatted}) ↗</a>
                </div>`
          }
        </div>
        <div class="video-panel__footer">
          <span class="video-info-author">👤 ${author}</span>
          <span class="video-info-timems">⏱️ Time (ms): <strong class="video-timems-val">${initialMs}</strong></span>
          <span class="video-info-fps">⚡ ${this.fps} FPS · <span class="video-cursec-val">${this.startSeconds}s</span></span>
          ${this.mediaInfo.publish_date ? `<span class="video-info-date">📅 ${this.mediaInfo.publish_date}</span>` : ""}
        </div>
      </div>
    `;

    container.appendChild(winEl);
    this.winEl = winEl;

    this.headerEl = winEl.querySelector(".video-panel__header");
    this.closeBtn = winEl.querySelector(".video-panel__close");
    this.playBtn = winEl.querySelector(".video-play-btn");
  }

  initYouTubePlayer() {
    if (!this.mediaInfo.videoId) return;

    ensureYouTubeIframeAPI(() => {
      if (!document.getElementById(this.playerId)) return;
      try {
        this.player = new YT.Player(this.playerId, {
          videoId: this.mediaInfo.videoId,
          playerVars: {
            start: this.startSeconds,
            autoplay: 0, // Do NOT autoplay on open
            playsinline: 1,
            rel: 0,
            enablejsapi: 1,
          },
          events: {
            onReady: (event) => {
              this.isPlayerReady = true;
              try {
                event.target.seekTo(this.startSeconds, true);
                event.target.pauseVideo();
              } catch (e) {}
              this.updateTimeDisplay();
            },
            onStateChange: (event) => {
              this.handleStateChange(event.data);
            },
          },
        });
      } catch (err) {
        console.error(`[VideoWindow] Error initializing YT.Player:`, err);
      }
    });
  }

  togglePlay() {
    if (!this.player) return;
    try {
      if (this.isPlaying) {
        if (typeof this.player.pauseVideo === "function") {
          this.player.pauseVideo();
        }
      } else {
        if (typeof this.player.playVideo === "function") {
          this.player.playVideo();
        }
      }
    } catch (e) {
      console.warn("[VideoWindow] Play/Pause error:", e);
    }
  }

  handleStateChange(state) {
    const isPlaying = state === 1; // YT.PlayerState.PLAYING = 1
    this.isPlaying = isPlaying;

    if (this.playBtn) {
      if (isPlaying) {
        this.playBtn.innerHTML = "⏸ Pause";
        this.playBtn.classList.add("video-play-btn--playing");
      } else {
        this.playBtn.innerHTML = "▶ Play";
        this.playBtn.classList.remove("video-play-btn--playing");
      }
    }

    if (isPlaying) {
      this.startTimeTracker();
    } else {
      this.stopTimeTracker();
      this.updateTimeDisplay();
    }
  }

  startTimeTracker() {
    this.stopTimeTracker();
    this.timeTrackerInterval = setInterval(() => {
      this.updateTimeDisplay();
    }, 50);
  }

  stopTimeTracker() {
    if (this.timeTrackerInterval) {
      clearInterval(this.timeTrackerInterval);
      this.timeTrackerInterval = null;
    }
  }

  updateTimeDisplay() {
    let currentSec = this.startSeconds;
    if (this.player && typeof this.player.getCurrentTime === "function") {
      try {
        const t = this.player.getCurrentTime();
        if (typeof t === "number" && !isNaN(t)) {
          currentSec = t;
        }
      } catch (e) {}
    }
    const currentMs = Math.floor(currentSec * 1000);
    const currentFrame = Math.round(currentSec * this.fps);
    const timeFormatted = formatTimestamp(currentSec);

    const timemsEls = this.winEl.querySelectorAll(".video-timems-val");
    timemsEls.forEach((el) => {
      el.textContent = currentMs;
    });

    const curSecEl = this.winEl.querySelector(".video-cursec-val");
    if (curSecEl) {
      curSecEl.textContent = `${currentSec.toFixed(1)}s`;
    }

    const frameValEl = this.winEl.querySelector(".video-frame-val");
    if (frameValEl) {
      frameValEl.textContent = currentFrame;
    }
  }

  updateFrameTimestamp(frameNumber) {
    this.frameNumber = frameNumber;
    this.startSeconds = calculateFrameSeconds(frameNumber, this.fps);
    const timeFormatted = formatTimestamp(this.startSeconds);

    if (this.player && typeof this.player.seekTo === "function") {
      try {
        this.player.seekTo(this.startSeconds, true);
        if (!this.isPlaying && typeof this.player.pauseVideo === "function") {
          this.player.pauseVideo();
        }
      } catch (e) {}
    }

    const timestampUrl = this.mediaInfo.watch_url
      ? `${this.mediaInfo.watch_url}${this.mediaInfo.watch_url.includes("?") ? "&" : "?"}t=${this.startSeconds}s`
      : "";

    const extLink = this.winEl.querySelector(".video-panel__ext-link");
    if (extLink) {
      extLink.href = timestampUrl;
      extLink.textContent = `↗ YouTube (${timeFormatted})`;
    }

    const tsTag = this.winEl.querySelector(".video-panel__timestamp");
    if (tsTag) {
      tsTag.textContent = `⏱️ ${timeFormatted} (F:${frameNumber})`;
    }

    this.updateTimeDisplay();
  }

  focus() {
    _highestZIndex += 1;
    this.winEl.style.zIndex = _highestZIndex;
    document.querySelectorAll(".video-window-floating, .preview-window-floating")
      .forEach((el) => el.classList.remove("preview-window-floating--active"));
    this.winEl.classList.add("preview-window-floating--active");
    _activeVideoWindow = this;
  }

  setupDragging() {
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    const onMouseDown = (e) => {
      if (e.target.closest("button") || e.target.closest("a")) return;

      this.focus();
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = this.winEl.offsetLeft;
      initialTop = this.winEl.offsetTop;

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newLeft = initialLeft + dx;
      let newTop = initialTop + dy;

      newLeft = Math.max(-this.winEl.offsetWidth + 100, Math.min(window.innerWidth - 100, newLeft));
      newTop = Math.max(0, Math.min(window.innerHeight - 60, newTop));

      this.winEl.style.left = `${newLeft}px`;
      this.winEl.style.top = `${newTop}px`;
    };

    const onMouseUp = () => {
      isDragging = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    this.headerEl.addEventListener("mousedown", onMouseDown);
  }

  setupEvents() {
    this.winEl.addEventListener("mousedown", () => this.focus());
    this.closeBtn.addEventListener("click", () => this.close());
    if (this.playBtn) {
      this.playBtn.addEventListener("click", () => this.togglePlay());
    }
  }

  close() {
    this.stopTimeTracker();
    if (this.player && typeof this.player.destroy === "function") {
      try {
        this.player.destroy();
      } catch (e) {}
      this.player = null;
    }
    if (this.winEl && this.winEl.parentNode) {
      this.winEl.parentNode.removeChild(this.winEl);
    }
    openVideoWindows.delete(this.id);
    if (_activeVideoWindow === this) {
      _activeVideoWindow = null;
    }
  }
}

/**
 * Open (or focus) a floating video window for the given videoCode and frameNumber.
 * Calculates timestamp in seconds using frame index and video FPS.
 * @param {string} videoCode - e.g. "L21_V001"
 * @param {string|number} [frameNumber] - e.g. "2859"
 */
async function openVideoWindow(videoCode, frameNumber = null) {
  if (!videoCode) return;

  // Check if a window for this videoCode is already open
  for (const win of openVideoWindows.values()) {
    if (win.videoCode === videoCode) {
      if (frameNumber && win.frameNumber !== frameNumber) {
        win.updateFrameTimestamp(frameNumber);
      }
      win.focus();
      return win;
    }
  }

  showToast(`Loading video ${videoCode}…`, "info");
  
  const [mediaInfo, fps] = await Promise.all([
    fetchVideoMediaInfo(videoCode),
    getVideoFps(videoCode)
  ]);

  if (!mediaInfo || !mediaInfo.watch_url) {
    showToast(`Video metadata not available for ${videoCode}`, "error");
    return null;
  }

  const startSeconds = frameNumber ? calculateFrameSeconds(frameNumber, fps) : 0;
  const win = new VideoWindow(videoCode, mediaInfo, frameNumber, fps, startSeconds);
  openVideoWindows.set(win.id, win);
  showToast(`Opened video player for ${videoCode} at ${formatTimestamp(startSeconds)}`, "success");
  return win;
}

/* ──────────────── Submission History ──────────────── */

function renderSubmissionHistory() {
  const list = document.getElementById("history-list");
  const history = getSubmissionHistory();
  list.innerHTML = "";

  if (history.length === 0) {
    list.innerHTML = `<div class="history-empty">No submissions yet.</div>`;
    return;
  }

  history.forEach((entry) => {
    const row = document.createElement("div");
    row.className = `history-row history-row--${entry.status}`;

    const time = new Date(entry.timestamp).toLocaleString();
    row.innerHTML = `
      <span class="history-row__status">${entry.status === "success" ? "✓" : "✗"}</span>
      <span class="history-row__id">${entry.image_id}</span>
      <span class="history-row__query">"${entry.query}"</span>
      <span class="history-row__time">${time}</span>
    `;
    list.appendChild(row);
  });
}

function openHistoryPanel() {
  renderSubmissionHistory();
  document.getElementById("history-modal").classList.add("modal--open");
}

function closeHistoryPanel() {
  document.getElementById("history-modal").classList.remove("modal--open");
}

/* ──────────────── Tab Bar ──────────────── */

/**
 * Render the tab strip inside #tab-bar.
 * Dispatches custom events:
 *   tabSwitch  → { detail: { id } }
 *   tabAdd     → (no detail)
 *   tabClose   → { detail: { id } }
 *
 * @param {Array<{id: string, title: string}>} tabs
 * @param {string} activeTabId
 */
function renderTabBar(tabs, activeTabId) {
  const bar = document.getElementById("tab-bar");
  if (!bar) return;
  bar.innerHTML = "";

  tabs.forEach((tab) => {
    const item = document.createElement("div");
    item.className = "tab-item" + (tab.id === activeTabId ? " tab-item--active" : "");
    item.dataset.tabId = tab.id;
    item.title = tab.title;

    const titleSpan = document.createElement("span");
    titleSpan.className = "tab-item__title";
    titleSpan.textContent = tab.title;

    const closeBtn = document.createElement("button");
    closeBtn.className = "tab-item__close";
    closeBtn.innerHTML = "&#x2715;";
    closeBtn.title = "Close tab";
    closeBtn.setAttribute("aria-label", `Close ${tab.title}`);
    if (tabs.length <= 1) closeBtn.style.display = "none";

    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      bar.dispatchEvent(new CustomEvent("tabClose", { bubbles: true, detail: { id: tab.id } }));
    });

    item.appendChild(titleSpan);
    item.appendChild(closeBtn);

    item.addEventListener("click", () => {
      if (tab.id !== activeTabId) {
        bar.dispatchEvent(new CustomEvent("tabSwitch", { bubbles: true, detail: { id: tab.id } }));
      }
    });

    bar.appendChild(item);
  });

  // ── Add-tab button ──
  const addBtn = document.createElement("button");
  addBtn.className = "tab-add-btn";
  addBtn.id = "tab-add-btn";
  addBtn.textContent = "+";
  addBtn.title = "Add new search tab";
  addBtn.setAttribute("aria-label", "Add new search tab");
  addBtn.addEventListener("click", () => {
    bar.dispatchEvent(new CustomEvent("tabAdd", { bubbles: true }));
  });

  // ── Merge button (disabled when < 2 tabs) ──
  const mergeBtn = document.createElement("button");
  mergeBtn.className = "tab-merge-btn";
  mergeBtn.id = "tab-merge-btn";
  mergeBtn.innerHTML = "&#x1F500; Merge";
  mergeBtn.title = tabs.length >= 2 ? "Merge two tabs" : "Need at least 2 tabs to merge";
  mergeBtn.setAttribute("aria-label", "Merge tabs");
  mergeBtn.disabled = tabs.length < 2;
  mergeBtn.addEventListener("click", () => {
    bar.dispatchEvent(new CustomEvent("tabMergeOpen", { bubbles: true }));
  });

  bar.appendChild(addBtn);
  bar.appendChild(mergeBtn);
}

/* ──────────────── Merge Modal ──────────────── */

/**
 * Populate the two <select> elements with the current tab list,
 * then open #merge-modal.
 * @param {Array<{id: string, title: string}>} tabs
 */
function openMergeModal(tabs) {
  const modal = document.getElementById("merge-modal");
  const selA  = document.getElementById("merge-select-a");
  const selB  = document.getElementById("merge-select-b");
  const warn  = document.getElementById("merge-warning");

  // Build option lists
  [selA, selB].forEach((sel) => {
    sel.innerHTML = "";
    tabs.forEach((tab) => {
      const opt = document.createElement("option");
      opt.value       = tab.id;
      opt.textContent = tab.title;
      sel.appendChild(opt);
    });
  });

  // Default: A = first tab, B = second tab
  if (tabs.length >= 2) {
    selA.value = tabs[0].id;
    selB.value = tabs[1].id;
  }

  warn.hidden = true;
  warn.textContent = "";

  // Live validation: warn if same tab selected
  const validate = () => {
    const same = selA.value === selB.value;
    warn.hidden = !same;
    warn.textContent = same ? "⚠ Please select two different tabs." : "";
    document.getElementById("merge-confirm").disabled = same;
  };

  selA.onchange = validate;
  selB.onchange = validate;
  validate();

  modal.classList.add("modal--open");
  document.body.style.overflow = "hidden";
}

/** Close the merge modal without performing any action. */
function closeMergeModal() {
  document.getElementById("merge-modal").classList.remove("modal--open");
  document.body.style.overflow = "";
}

/* ──────────────── Loading State ──────────────── */

function setLoading(isLoading) {
  const btn = document.getElementById("search-btn");
  const spinner = document.getElementById("search-spinner");

  btn.disabled = isLoading;
  spinner.style.display = isLoading ? "inline-block" : "none";
}
