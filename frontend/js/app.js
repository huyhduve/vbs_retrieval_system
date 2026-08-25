/**
 * app.js
 * -------
 * Main entry point. Wires up event listeners and orchestrates
 * the services (apiService, dataService, submitService) with the UI.
 * Also manages multi-tab workspace state via window.tabState (tabState.js).
 */

document.addEventListener("DOMContentLoaded", () => {
  /* ── Element refs ── */
  const searchInput = document.getElementById("search-input");
  const asrInput    = document.getElementById("asr-input");
  const ocrInput    = document.getElementById("ocr-input");
  const topKSlider  = document.getElementById("topk-slider");
  const topKValue   = document.getElementById("topk-value");
  const searchBtn   = document.getElementById("search-btn");

  const imageDropzone         = document.getElementById("image-dropzone");
  const imageInput            = document.getElementById("image-input");
  const imagePreviewContainer = document.getElementById("image-preview-container");
  const imagePreview          = document.getElementById("image-preview");
  const imagePlaceholder      = document.getElementById("image-placeholder");
  const imageRemoveBtn        = document.getElementById("image-remove-btn");

  let currentImageFile       = null;
  let currentImagePreviewUrl = null;

  /* ── Filter Search Refs ── */
  const filterVideoId    = document.getElementById("filter-video-id");
  const filterFrameId    = document.getElementById("filter-frame-id");
  const filterTopKSlider = document.getElementById("filter-topk-slider");
  const filterTopKValue  = document.getElementById("filter-topk-value");
  const filterOpenVideo  = document.getElementById("filter-open-video");
  const filterSearchBtn  = document.getElementById("filter-search-btn");

  /* ── Accordion Cards Toggle ── */
  const accordionCards = document.querySelectorAll(".accordion-card");

  function updateAccordionStates() {
    let hideRest = false;
    accordionCards.forEach((card) => {
      if (hideRest) {
        card.classList.add("accordion-card--hidden");
      } else {
        card.classList.remove("accordion-card--hidden");
        if (card.classList.contains("accordion-card--expanded")) {
          hideRest = true;
        }
      }
    });
  }

  accordionCards.forEach((card) => {
    const header = card.querySelector(".accordion-card__header");
    const icon   = card.querySelector(".accordion-card__icon");

    if (!header) return;

    header.addEventListener("click", () => {
      const isExpanded = card.classList.contains("accordion-card--expanded");

      if (isExpanded) {
        card.classList.remove("accordion-card--expanded");
        header.setAttribute("aria-expanded", "false");
        if (icon) icon.textContent = "►";
      } else {
        card.classList.add("accordion-card--expanded");
        header.setAttribute("aria-expanded", "true");
        if (icon) icon.textContent = "▼";
      }
      updateAccordionStates();
    });
  });

  // Run initially to hide cards below any expanded card on page load
  updateAccordionStates();



  const scoreControls = [
    { input: document.getElementById("score-text"), output: document.getElementById("score-text-value") },
    { input: document.getElementById("score-ocr"),  output: document.getElementById("score-ocr-value") },
    { input: document.getElementById("score-asr"),  output: document.getElementById("score-asr-value") },
  ];

  scoreControls.forEach(({ input, output }) => {
    const updateScoreLabel = () => {
      output.textContent = Number(input.value).toFixed(2);
    };
    input.addEventListener("input",  updateScoreLabel);
    input.addEventListener("change", updateScoreLabel);
    updateScoreLabel();
  });

  /* ── Top-K slider sync ── */
  topKSlider.min   = CONFIG.DEFAULTS.TOP_K_MIN;
  topKSlider.max   = CONFIG.DEFAULTS.TOP_K_MAX;
  topKSlider.value = CONFIG.DEFAULTS.TOP_K;
  topKValue.textContent = CONFIG.DEFAULTS.TOP_K;

  topKSlider.addEventListener("input", () => {
    topKValue.textContent = topKSlider.value;
  });

  /* ── Filter Top-K slider sync ── */
  if (filterTopKSlider) {
    filterTopKSlider.min   = CONFIG.DEFAULTS.TOP_K_MIN;
    filterTopKSlider.max   = CONFIG.DEFAULTS.TOP_K_MAX;
    filterTopKSlider.value = 20; // Default to a smaller window of 20 for adjacent frames
    filterTopKValue.textContent = filterTopKSlider.value;

    filterTopKSlider.addEventListener("input", () => {
      filterTopKValue.textContent = filterTopKSlider.value;
    });
  }

  /* ── Image Search Input Handlers ── */
  function setSelectedImage(file) {
    if (!file) return;

    if (!file.type || !file.type.startsWith("image/")) {
      showToast("Please select a valid image file", "error");
      return;
    }

    const maxBytes = CONFIG.MAX_IMAGE_SIZE || (1.5 * 1024 * 1024);
    if (file.size > maxBytes) {
      showToast(`Image size exceeds 1.5MB limit (${(file.size / (1024 * 1024)).toFixed(2)}MB)`, "error");
      return;
    }

    currentImageFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      currentImagePreviewUrl = e.target.result;
      imagePreview.src = currentImagePreviewUrl;
      imagePreviewContainer.hidden = false;
      imagePlaceholder.hidden = true;
    };
    reader.readAsDataURL(file);
  }

  function clearSelectedImage() {
    currentImageFile = null;
    currentImagePreviewUrl = null;
    if (imageInput) imageInput.value = "";
    if (imagePreview) imagePreview.src = "";
    if (imagePreviewContainer) imagePreviewContainer.hidden = true;
    if (imagePlaceholder) imagePlaceholder.hidden = false;
  }

  if (imageDropzone) {
    imageDropzone.addEventListener("click", (e) => {
      if (e.target.closest("#image-remove-btn")) return;
      imageInput.click();
    });

    imageInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        setSelectedImage(e.target.files[0]);
      }
    });

    imageRemoveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      clearSelectedImage();
    });

    imageDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      imageDropzone.classList.add("image-dropzone--dragover");
    });

    imageDropzone.addEventListener("dragleave", () => {
      imageDropzone.classList.remove("image-dropzone--dragover");
    });

    imageDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      imageDropzone.classList.remove("image-dropzone--dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        setSelectedImage(e.dataTransfer.files[0]);
      }
    });
  }

  // Paste screenshot from clipboard (Ctrl+V)
  document.addEventListener("paste", (e) => {
    if (!e.clipboardData || !e.clipboardData.items) return;
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          setSelectedImage(file);
          showToast("Pasted image screenshot from clipboard", "info");
          break;
        }
      }
    }
  });

  /* ══════════════════════════════════════════
     Multi-tab helpers
  ══════════════════════════════════════════ */

  /**
   * Snapshot all current DOM input values into the active tab object.
   */
  function saveCurrentInputsToTab() {
    tabState.saveTabState({
      query: searchInput.value,
      asr:   asrInput.value,
      ocr:   ocrInput.value,
      imageFile: currentImageFile,
      imagePreviewUrl: currentImagePreviewUrl,
      topK:  parseInt(topKSlider.value, 10),
      weights: {
        score_text: Number(document.getElementById("score-text").value),
        score_ocr:  Number(document.getElementById("score-ocr").value),
        score_asr:  Number(document.getElementById("score-asr").value),
      },
    });
  }

  /**
   * Write a tab's stored state back into the DOM inputs, grid, and result count.
   * @param {Object} tab
   */
  function restoreTabToUI(tab) {
    // Clear Filter Search inputs
    if (filterVideoId) filterVideoId.value = "";
    if (filterFrameId) filterFrameId.value = "";

    // Inputs
    searchInput.value = tab.query;
    asrInput.value    = tab.asr;
    ocrInput.value    = tab.ocr;

    // Restore or clear Image query
    if (tab.imageFile || tab.imagePreviewUrl) {
      currentImageFile = tab.imageFile;
      currentImagePreviewUrl = tab.imagePreviewUrl;
      imagePreview.src = tab.imagePreviewUrl;
      imagePreviewContainer.hidden = false;
      imagePlaceholder.hidden = true;
    } else {
      clearSelectedImage();
    }

    // Top-K
    topKSlider.value      = tab.topK;
    topKValue.textContent = tab.topK;

    // Weight sliders
    document.getElementById("score-text").value = tab.weights.score_text;
    document.getElementById("score-ocr").value  = tab.weights.score_ocr;
    document.getElementById("score-asr").value  = tab.weights.score_asr;

    // Refresh displayed values
    scoreControls.forEach(({ input, output }) => {
      output.textContent = Number(input.value).toFixed(2);
    });

    // Grid
    renderGrid(tab.groupedResults);
    updateResultCount(tab.searchResults.length);

    // Keep ui.js currentResults in sync with the restored tab
    currentResults = tab.searchResults;
    currentQuery   = tab.query;
  }

  /**
   * Re-render the tab bar from tabState and wire document-level event listeners.
   */
  function refreshTabBar() {
    renderTabBar(tabState.getTabs(), tabState.getActiveTab().id);
  }

  /* ── Initialise tab bar ── */
  refreshTabBar();
  // Restore the initial (only) tab to the UI so sliders etc. reflect stored defaults
  restoreTabToUI(tabState.getActiveTab());

  /* ── Tab bar event delegation (events bubble from #tab-bar to document) ── */
  document.addEventListener("tabSwitch", (e) => {
    saveCurrentInputsToTab();               // persist current inputs to outgoing tab
    tabState.setActiveTab(e.detail.id);
    restoreTabToUI(tabState.getActiveTab()); // load incoming tab
    refreshTabBar();
  });

  document.addEventListener("tabAdd", () => {
    saveCurrentInputsToTab();               // persist before switching
    tabState.createTab();
    restoreTabToUI(tabState.getActiveTab()); // load fresh tab
    refreshTabBar();
    searchInput.focus();
  });

  document.addEventListener("tabClose", (e) => {
    const closingActive = e.detail.id === tabState.getActiveTab().id;
    tabState.removeTab(e.detail.id);
    if (closingActive) {
      restoreTabToUI(tabState.getActiveTab());
    }
    refreshTabBar();
  });

  /* ── Merge tab events ── */

  // Open merge modal when the 🔀 Merge button is clicked
  document.addEventListener("tabMergeOpen", () => {
    saveCurrentInputsToTab();
    openMergeModal(tabState.getTabs());
  });

  // Backdrop click to close merge modal
  document.getElementById("merge-modal").addEventListener("click", (e) => {
    if (e.target.id === "merge-modal") closeMergeModal();
  });

  // X button
  document.getElementById("merge-close").addEventListener("click", closeMergeModal);
  // Cancel button
  document.getElementById("merge-cancel").addEventListener("click", closeMergeModal);

  // Confirm button — run the merge algorithm
  document.getElementById("merge-confirm").addEventListener("click", () => {
    const idA = document.getElementById("merge-select-a").value;
    const idB = document.getElementById("merge-select-b").value;

    if (idA === idB) {
      showToast("Select two different tabs to merge.", "warning");
      return;
    }

    try {
      const merged = tabState.mergeTabResults(idA, idB);
      closeMergeModal();
      restoreTabToUI(merged);
      refreshTabBar();
      showToast(
        `Merged → ${merged.title} (${merged.searchResults.length} frames)`,
        "success"
      );
    } catch (err) {
      console.error("Merge error:", err);
      showToast(`Merge failed: ${err.message}`, "error");
    }
  });

  /* ── Similarity search event ── */
  document.addEventListener("similaritySearchComplete", (e) => {
    saveCurrentInputsToTab();
    const newTab = tabState.createTabWithData(e.detail);
    restoreTabToUI(newTab);
    refreshTabBar();
    if (newTab.searchResults.length === 0) {
      showToast("No similar images found", "warning");
    } else {
      showToast(`Similarity search: Found ${newTab.searchResults.length} images in new tab`, "success");
    }
  });

  /* ══════════════════════════════════════════
     Search
  ══════════════════════════════════════════ */

  async function performSearch() {
    // Clear Filter Search inputs
    if (filterVideoId) filterVideoId.value = "";
    if (filterFrameId) filterFrameId.value = "";

    const query = searchInput.value.trim();
    const asr   = asrInput.value.trim();
    const ocr   = ocrInput.value.trim();
    const hasImage = !!currentImageFile;

    const scores = {
      score_text: Number(document.getElementById("score-text").value),
      score_ocr:  Number(document.getElementById("score-ocr").value),
      score_asr:  Number(document.getElementById("score-asr").value),
    };
    const totalScore = scores.score_text + scores.score_ocr + scores.score_asr;

    if (!hasImage && totalScore === 0) {
      showToast("The total of weight components must be greater than 0.", "error");
      return;
    }

    if (!hasImage && !query && !asr && !ocr) {
      showToast("Please enter Text, ASR, OCR, or select an Image", "warning");
      searchInput.focus();
      return;
    }

    const topK = parseInt(topKSlider.value, 10);
    currentQuery = query || (hasImage ? `[Image Search]` : "");
    setLoading(true);

    try {
      let data;
      if (hasImage) {
        data = await searchByImage(currentImageFile, topK);
      } else {
        data = await searchImages({
          text:      query,
          textScore: scores.score_text,
          ocr,
          ocrScore:  scores.score_ocr,
          asr,
          asrScore:  scores.score_asr,
          topK,
        });
      }

      const grouped = processSearchResultsGrouped(data.results || []);
      currentResults = processSearchResults(data.results || []);

      renderGrid(grouped);
      updateResultCount(currentResults.length);

      // Persist results into the active tab
      tabState.saveTabState({
        searchResults:  currentResults,
        groupedResults: grouped,
        query,
        asr,
        ocr,
        imageFile: currentImageFile,
        imagePreviewUrl: currentImagePreviewUrl,
        topK,
        weights: { ...scores },
      });

      if (currentResults.length === 0) {
        showToast("No results found", "warning");
      } else {
        showToast(`Found ${currentResults.length} images`, "success");
      }
    } catch (err) {
      console.error("Search error:", err);
      showToast(`Search error: ${err.message}`, "error");
      currentResults = [];
      renderGrid([]);
      updateResultCount(0);
      tabState.saveTabState({ searchResults: [], groupedResults: [] });
    } finally {
      setLoading(false);
    }
  }

  searchBtn.addEventListener("click", performSearch);
  [searchInput, asrInput, ocrInput].forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (input === ocrInput || e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        performSearch();
      }
    });
  });

  /* ── Floating Preview Window Shortcuts ── */
  document.addEventListener("keydown", (e) => {
    if (typeof openPreviewWindows === "undefined" || openPreviewWindows.size === 0) return;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;

    if (e.key === "Escape")     closePreview();
    if (e.key === "ArrowLeft")  navigatePreview(-1);
    if (e.key === "ArrowRight") navigatePreview(1);
  });

  /* ── Filter Search Handlers ── */
  function groupProcessedResults(items) {
    const groupsMap = new Map();
    items.forEach((item) => {
      const gId = item.groupId || item.videoCode || "unknown";
      if (!groupsMap.has(gId)) {
        groupsMap.set(gId, []);
      }
      groupsMap.get(gId).push(item);
    });
    return Array.from(groupsMap.entries()).map(([groupId, groupItems]) => ({
      groupId,
      items: groupItems
    }));
  }

  async function performFilterSearch() {
    const videoIdQuery = filterVideoId.value.trim();
    const frameIdQuery = filterFrameId.value.trim();
    const topKVal = parseInt(filterTopKSlider.value, 10);
    const shouldOpenVideo = filterOpenVideo.checked;

    if (!videoIdQuery) {
      showToast("Please enter a Video ID", "warning");
      filterVideoId.focus();
      return;
    }

    if (!frameIdQuery) {
      showToast("Please enter a Frame ID", "warning");
      filterFrameId.focus();
      return;
    }

    // Show loading toast
    showToast(`Loading keyframes around frame ${frameIdQuery} of video ${videoIdQuery}...`, "info");

    try {
      // 1. Fetch manifest
      const manifest = await fetchVideoFrameList(videoIdQuery);
      if (!manifest || manifest.length === 0) {
        showToast(`Video ID "${videoIdQuery}" not found or manifest index is unavailable.`, "error");
        return;
      }

      // 2. Parse targets
      const targetFrameInt = parseInt(frameIdQuery, 10);
      if (isNaN(targetFrameInt)) {
        showToast("Invalid Frame ID. Please enter a valid number.", "error");
        return;
      }

      // 3. Find closest frame index in manifest
      let closestIdx = -1;
      let minDiff = Infinity;
      for (let i = 0; i < manifest.length; i++) {
        const fInt = parseInt(manifest[i], 10);
        const diff = Math.abs(fInt - targetFrameInt);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = i;
        }
      }

      if (closestIdx === -1) {
        showToast("Could not locate adjacent frames in manifest.", "error");
        return;
      }

      // 4. Slice topK adjacent frames centered around closestIdx
      const start = Math.max(0, closestIdx - Math.floor((topKVal - 1) / 2));
      const end = Math.min(manifest.length, start + topKVal);
      // Adjust start if end is capped at manifest.length
      const finalStart = Math.max(0, end - topKVal);
      const slicedFrames = manifest.slice(finalStart, end);

      // 5. Build results objects (ext defaults to .webp)
      const results = slicedFrames.map((frameId, idx) => {
        const item = resolveFrameByVideoCode(videoIdQuery, frameId, ".webp");
        item.index = idx;
        return item;
      });

      const grouped = groupProcessedResults(results);

      // 6. Save current inputs before switching to the new tab
      saveCurrentInputsToTab();

      // 7. Create a new search tab with these results
      const newTab = tabState.createTabWithData({
        title: `${videoIdQuery} - F:${frameIdQuery}`,
        query: `[Filter Search: ${videoIdQuery} - F:${frameIdQuery}]`,
        searchResults: results,
        groupedResults: grouped,
        topK: topKVal,
      });

      // 8. Restore the new tab to UI and update grid
      restoreTabToUI(newTab);
      refreshTabBar();

      showToast(`Loaded ${results.length} adjacent frames in new tab.`, "success");

      // 9. Auto open video if checked (use closest matching frame ID from manifest)
      if (shouldOpenVideo) {
        const closestFrameId = manifest[closestIdx];
        console.log(`[FilterSearch] Auto opening video for ${videoIdQuery} at frame ${closestFrameId}`);
        openVideoWindow(videoIdQuery, closestFrameId);
      }

    } catch (err) {
      console.error("Filter Search error:", err);
      showToast(`Error performing Filter Search: ${err.message}`, "error");
    }
  }

  if (filterSearchBtn) {
    filterSearchBtn.addEventListener("click", performFilterSearch);
  }

  [filterVideoId, filterFrameId].forEach(input => {
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          performFilterSearch();
        }
      });
    }
  });

  /* ── History panel ── */
  document.getElementById("history-btn").addEventListener("click", openHistoryPanel);
  document.getElementById("history-close").addEventListener("click", closeHistoryPanel);
  document.getElementById("history-clear-btn").addEventListener("click", () => {
    clearSubmissionHistory();
    renderSubmissionHistory();
    showToast("History cleared", "info");
  });
  document.getElementById("history-modal").addEventListener("click", (e) => {
    if (e.target.id === "history-modal") closeHistoryPanel();
  });
});
