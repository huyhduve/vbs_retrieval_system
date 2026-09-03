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
  document.querySelectorAll(".accordion-card").forEach((card) => {
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
    });
  });

  /* ── Config Card & Topic Dropdown Handler ── */
  const topicDropdown = document.getElementById("topic-dropdown");
  const topicDropdownBtn = document.getElementById("topic-dropdown-btn");
  const topicDropdownMenu = document.getElementById("topic-dropdown-menu");
  const topicDropdownText = document.getElementById("topic-dropdown-text");
  const topicCheckboxes = document.querySelectorAll(".topic-checkbox");
  const llmSuggestionBtn = document.getElementById("llm-suggestion-btn");
  const configContextInput = document.getElementById("config-context-input");
  const configAdditionInput = document.getElementById("config-addition-input");

  function updateTopicDropdownText() {
    if (!topicDropdownText) return;
    const selected = Array.from(topicCheckboxes)
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);

    if (selected.length === 0) {
      topicDropdownText.textContent = "Select topics…";
      topicDropdownText.classList.remove("custom-dropdown__selected--has-value");
    } else if (selected.length <= 2) {
      topicDropdownText.textContent = selected.join(", ");
      topicDropdownText.classList.add("custom-dropdown__selected--has-value");
    } else {
      topicDropdownText.textContent = `${selected.length} topics selected`;
      topicDropdownText.classList.add("custom-dropdown__selected--has-value");
    }
  }

  if (topicDropdownBtn && topicDropdownMenu) {
    topicDropdownBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = topicDropdownMenu.hidden;
      topicDropdownMenu.hidden = !isHidden;
      topicDropdown.classList.toggle("custom-dropdown--open", isHidden);
    });

    topicCheckboxes.forEach((cb) => {
      cb.addEventListener("change", () => {
        updateTopicDropdownText();
      });
    });

    document.addEventListener("click", (e) => {
      if (topicDropdown && !topicDropdown.contains(e.target)) {
        topicDropdownMenu.hidden = true;
        topicDropdown.classList.remove("custom-dropdown--open");
      }
    });
  }

  /* ── Global Config Store ── */
  window.globalConfig = {
    context: "",
    topics: [],
    addition: "",
  };

  const configSaveBtn = document.getElementById("config-save-btn");
  const headerConfigDropdown = document.getElementById("header-config-dropdown");
  const headerConfigBtn = document.getElementById("header-config-btn");
  const headerConfigMenu = document.getElementById("header-config-menu");

  if (configSaveBtn) {
    configSaveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const contextText = configContextInput ? configContextInput.value.trim() : "";
      const additionText = configAdditionInput ? configAdditionInput.value.trim() : "";
      const selectedTopics = Array.from(topicCheckboxes)
        .filter((cb) => cb.checked)
        .map((cb) => cb.value);

      window.globalConfig.context = contextText;
      window.globalConfig.topics = selectedTopics;
      window.globalConfig.addition = additionText;

      showToast("💾 Config saved globally!", "success");
      if (headerConfigMenu) headerConfigMenu.hidden = true;
    });
  }

  if (headerConfigDropdown && headerConfigMenu) {
    if (headerConfigBtn) {
      headerConfigBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const willShow = headerConfigMenu.hidden;
        headerConfigMenu.hidden = !willShow;

        if (willShow) {
          // Populate current global config when opening
          if (configContextInput) configContextInput.value = window.globalConfig.context || "";
          if (configAdditionInput) configAdditionInput.value = window.globalConfig.addition || "";
          const globalTopics = window.globalConfig.topics || [];
          topicCheckboxes.forEach((cb) => {
            cb.checked = globalTopics.includes(cb.value);
          });
          updateTopicDropdownText();
        }
      });
    }

    // Prevent popover from closing when clicking inside it
    headerConfigMenu.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    // Close popover when clicking outside
    document.addEventListener("click", (e) => {
      if (!headerConfigDropdown.contains(e.target)) {
        headerConfigMenu.hidden = true;
      }
    });
  }

  if (llmSuggestionBtn) {
    llmSuggestionBtn.addEventListener("click", async () => {
      const contextText = window.globalConfig.context || (configContextInput ? configContextInput.value.trim() : "");
      const additionText = window.globalConfig.addition || (configAdditionInput ? configAdditionInput.value.trim() : "");
      const selectedTopics = window.globalConfig.topics.length > 0 
        ? window.globalConfig.topics 
        : Array.from(topicCheckboxes).filter((cb) => cb.checked).map((cb) => cb.value);

      const topicStr = selectedTopics.join(", ") || "General";
      const systemPrompt = CONFIG.GEMINI ? CONFIG.GEMINI.SYSTEM_PROMPT : "";
      const userPromptTemplate = (CONFIG.GEMINI ? CONFIG.GEMINI.USER_PROMPT : "") || "Context: {context}\nTopic: {topics}\nAddition: {addition}";
      const userPrompt = userPromptTemplate
        .replace("{context}", contextText || "(Chưa có ngữ cảnh)")
        .replace("{topics}", topicStr)
        .replace("{addition}", additionText || "(Không có)");

      // Disable button & dim appearance (non-blocking async request)
      llmSuggestionBtn.disabled = true;
      llmSuggestionBtn.classList.add("header__llm-btn--loading");
      const originalText = llmSuggestionBtn.textContent;
      llmSuggestionBtn.textContent = "⏳ Generating…";

      showToast("✨ Sending request to Gemini LLM…", "info");

      try {
        const responseText = await callGeminiAPI(userPrompt, systemPrompt);
        // Save to LLM history
        saveLLMHistoryEntry({
          timestamp: new Date().toISOString(),
          context: contextText,
          topics: selectedTopics,
          addition: additionText,
          response: responseText,
        });
        showLLMNotificationModal(responseText);
        showToast("✅ LLM suggestion received!", "success");
      } catch (err) {
        console.error("[LLM Suggestion Error]", err);
        showToast(`❌ LLM Error: ${err.message}`, "error");
      } finally {
        llmSuggestionBtn.disabled = false;
        llmSuggestionBtn.classList.remove("header__llm-btn--loading");
        llmSuggestionBtn.textContent = originalText;
      }
    });
  }



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
    filterTopKSlider.value = 5; // Default to a smaller window of 20 for adjacent frames
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
    const rrfToggle = document.getElementById("topk-rrf-toggle");
    tabState.saveTabState({
      query:   searchInput.value,
      asr:     asrInput.value,
      ocr:     ocrInput.value,
      imageFile: currentImageFile,
      imagePreviewUrl: currentImagePreviewUrl,
      topK:  parseInt(topKSlider.value, 10),
      weights: {
        score_text: Number(document.getElementById("score-text").value),
        score_ocr:  Number(document.getElementById("score-ocr").value),
        score_asr:  Number(document.getElementById("score-asr").value),
      },
      rrf: rrfToggle ? rrfToggle.checked : false,
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

    // Config Card inputs & Header Popover always reflect globalConfig across tab switches
    if (configContextInput) {
      configContextInput.value = window.globalConfig.context || "";
    }
    if (configAdditionInput) {
      configAdditionInput.value = window.globalConfig.addition || "";
    }
    const globalTopics = window.globalConfig.topics || [];
    topicCheckboxes.forEach((cb) => {
      cb.checked = globalTopics.includes(cb.value);
    });
    updateTopicDropdownText();

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

    const rrfToggle = document.getElementById("topk-rrf-toggle");
    if (rrfToggle) {
      rrfToggle.checked = tab.rrf || false;
    }

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

  /* ── LLM Search Suggestion Click Event ── */
  document.addEventListener("llmSearchRequested", (e) => {
    const payload = e.detail;
    if (!payload) return;

    // 1. Fill Text input
    if (searchInput) searchInput.value = payload.text || "";
    if (ocrInput)    ocrInput.value    = payload.ocr || "";
    if (asrInput)    asrInput.value    = payload.asr || "";

    // 2. Clear image query if present
    if (currentImageFile) {
      currentImageFile = null;
      currentImagePreviewUrl = null;
      if (imageInput) imageInput.value = "";
      if (imagePreview) imagePreview.src = "";
      if (imagePreviewContainer) imagePreviewContainer.hidden = true;
      if (imagePlaceholder) imagePlaceholder.hidden = false;
      if (imageDropzone) imageDropzone.classList.remove("image-dropzone--has-file");
    }

    // 3. Set Weights
    const textScoreInput = document.getElementById("score-text");
    const textScoreValue = document.getElementById("score-text-value");
    const ocrScoreInput  = document.getElementById("score-ocr");
    const ocrScoreValue  = document.getElementById("score-ocr-value");
    const asrScoreInput  = document.getElementById("score-asr");
    const asrScoreValue  = document.getElementById("score-asr-value");

    if (textScoreInput) {
      const val = payload.text_score !== undefined ? payload.text_score : 1.0;
      textScoreInput.value = val;
      if (textScoreValue) textScoreValue.textContent = Number(val).toFixed(2);
    }
    if (ocrScoreInput) {
      const val = payload.ocr_score !== undefined ? payload.ocr_score : 0.0;
      ocrScoreInput.value = val;
      if (ocrScoreValue) ocrScoreValue.textContent = Number(val).toFixed(2);
    }
    if (asrScoreInput) {
      const val = payload.asr_score !== undefined ? payload.asr_score : 0.0;
      asrScoreInput.value = val;
      if (asrScoreValue) asrScoreValue.textContent = Number(val).toFixed(2);
    }

    // 4. Set Top-K
    if (payload.top_k && topKSlider) {
      topKSlider.value = payload.top_k;
      if (topKValue) topKValue.textContent = payload.top_k;
    }

    // 5. Set RRF Toggle
    const rrfToggle = document.getElementById("topk-rrf-toggle");
    if (rrfToggle && payload.RRF !== undefined) {
      rrfToggle.checked = !!payload.RRF;
    }

    // 6. Set Topics
    if (Array.isArray(payload.topic) && payload.topic.length > 0) {
      const TOPIC_REVERSE_MAP = {
        "News": "Tin tức",
        "Tech": "Công nghệ",
        "Race": "Đua xe",
        "Dragon": "Múa lân",
        "Food": "Ẩm thực & Nấu ăn",
        "Lecture": "Bài giảng",
        "Travel": "Du lịch & Văn hóa",
        "Life": "Ký sự & Đời sống",
      };
      const vnTopics = payload.topic.map((t) => TOPIC_REVERSE_MAP[t] || t);
      window.globalConfig.topics = vnTopics;
      topicCheckboxes.forEach((cb) => {
        cb.checked = vnTopics.includes(cb.value);
      });
      updateTopicDropdownText();
    }

    showToast("🔍 Triggering search from LLM suggestion…", "info");

    // 7. Perform Search
    performSearch();
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
    const hasText = !!query;
    const hasAsr  = !!asr;
    const hasOcr  = !!ocr;

    // Validation: Require at least 1 of the 3 fields (Text, ASR, OCR) or an Image
    if (!hasText && !hasAsr && !hasOcr && !hasImage) {
      showToast("Please enter at least 1 field (Text, ASR, OCR) or select an Image", "warning");
      searchInput.focus();
      return;
    }

    // Auto-fallback weights if totalScore is 0
    if (!hasImage && totalScore === 0) {
      if (hasText) scores.score_text = 0.5;
      if (hasOcr)  scores.score_ocr  = 0.5;
      if (hasAsr)  scores.score_asr  = 0.5;
    }

    const topK = parseInt(topKSlider.value, 10);
    const rrfToggle = document.getElementById("topk-rrf-toggle");
    const isRrfEnabled = rrfToggle ? rrfToggle.checked : false;
    currentQuery = query || asr || ocr || (hasImage ? "[Image Search]" : "");
    setLoading(true);

    const TOPIC_MAP = {
      "Tin tức": "News",
      "Công nghệ": "Tech",
      "Đua xe": "Race",
      "Múa lân": "Dragon",
      "Ẩm thực & Nấu ăn": "Food",
      "Bài giảng": "Lecture",
      "Du lịch & Văn hóa": "Travel",
      "Ký sự & Đời sống": "Life",
    };

    const rawTopics = (window.globalConfig && window.globalConfig.topics && window.globalConfig.topics.length > 0)
      ? window.globalConfig.topics
      : Array.from(document.querySelectorAll(".topic-checkbox:checked")).map((cb) => cb.value);

    const mappedTopics = rawTopics
      .map((t) => TOPIC_MAP[t])
      .filter(Boolean);

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
          RRF: isRrfEnabled,
          topic: mappedTopics,
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
        rrf: isRrfEnabled,
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
    const activeTab = document.querySelector(".history-tab--active");
    const tabName = activeTab ? activeTab.dataset.tab : "submissions";
    if (tabName === "llm") {
      clearLLMHistory();
      renderLLMHistory();
      showToast("LLM response history cleared", "info");
    } else {
      clearSubmissionHistory();
      renderSubmissionHistory();
      showToast("Submission history cleared", "info");
    }
  });
  document.getElementById("history-modal").addEventListener("click", (e) => {
    if (e.target.id === "history-modal") closeHistoryPanel();
  });
});
