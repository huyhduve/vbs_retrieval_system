/**
 * tabState.js
 * -----------
 * Owns the multi-tab workspace state.
 * Must be loaded BEFORE app.js.
 *
 * Public API (window-scoped):
 *   createTab()                → TabObject
 *   createTabWithData(data)    → TabObject   (insert pre-filled tab)
 *   removeTab(id)              → void  (min 1 tab enforced)
 *   setActiveTab(id)           → void
 *   getActiveTab()             → TabObject
 *   getTabById(id)             → TabObject | undefined
 *   saveTabState(partial)      → void  (merges into active tab)
 *   getTabs()                  → TabObject[]
 *   mergeTabResults(idA, idB)  → TabObject  (new merged tab)
 */

(function () {
  "use strict";

  /* ── Helpers ── */
  let _tabCounter = 0;

  function _makeTab(overrides) {
    _tabCounter += 1;
    return Object.assign(
      {
        id: `tab-${_tabCounter}`,
        title: `Search ${_tabCounter}`,
        taskMode: "KIS",        // "KIS" | "QA" | "TRAKE"  (placeholder)
        query: "",
        asr: "",
        ocr: "",
        imageFile: null,
        imagePreviewUrl: null,
        weights: { score_text: 0.5, score_ocr: 0.5, score_asr: 0.5 },
        topK: 100,
        rrf: false,
        searchResults: [],     // flat processed array (used by preview navigator)
        groupedResults: [],    // grouped array (used by renderGrid)
        trakeBasket: [],       // placeholder — TRAKE not yet implemented
      },
      overrides || {}
    );
  }

  /* ── Internal state ── */
  const _tabs = [];
  let _activeTabId = null;

  /* ═══════════════════════════════════════════
     Core CRUD
  ═══════════════════════════════════════════ */

  /**
   * Add a blank tab and return it.
   * @returns {Object}
   */
  function createTab() {
    const tab = _makeTab();
    _tabs.push(tab);
    _activeTabId = tab.id;
    return tab;
  }

  /**
   * Add a pre-filled tab (used by mergeTabResults).
   * @param {Partial<TabObject>} data
   * @returns {Object}
   */
  function createTabWithData(data) {
    const tab = _makeTab(data);
    _tabs.push(tab);
    _activeTabId = tab.id;
    return tab;
  }

  /**
   * Remove a tab by id. Minimum 1 tab is enforced.
   * @param {string} id
   */
  function removeTab(id) {
    if (_tabs.length <= 1) return;

    const idx = _tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;

    _tabs.splice(idx, 1);

    if (_activeTabId === id) {
      _activeTabId = _tabs[Math.min(idx, _tabs.length - 1)].id;
    }
  }

  /**
   * Switch the active tab.
   * @param {string} id
   */
  function setActiveTab(id) {
    if (_tabs.some((t) => t.id === id)) _activeTabId = id;
  }

  /**
   * Return the active tab object (by reference).
   * @returns {Object}
   */
  function getActiveTab() {
    return _tabs.find((t) => t.id === _activeTabId) || _tabs[0];
  }

  /**
   * Return a tab by id (by reference), or undefined.
   * @param {string} id
   * @returns {Object|undefined}
   */
  function getTabById(id) {
    return _tabs.find((t) => t.id === id);
  }

  /**
   * Shallow-merge `partial` fields into the active tab.
   * @param {Partial<TabObject>} partial
   */
  function saveTabState(partial) {
    const tab = getActiveTab();
    if (tab) Object.assign(tab, partial);
  }

  /**
   * Return a shallow copy of the tabs array (for rendering).
   * @returns {Object[]}
   */
  function getTabs() {
    return _tabs.slice();
  }

  /* ═══════════════════════════════════════════
     Merge Algorithm
  ═══════════════════════════════════════════ */

  /**
   * Merge the searchResults of two tabs into a brand-new tab.
   *
   * Algorithm:
   *  1. Combine flat searchResults from tabA + tabB.
   *  2. Group frames by videoCode.
   *  3. Deduplicate within each group by imageId (Map keyed on imageId).
   *  4. Sort each group's frames ascending by frameNumber (natural / numeric).
   *  5. Rebuild groupedResults from the deduplicated, sorted groups.
   *  6. Rebuild a flat searchResults array (re-indexed).
   *  7. Create a new tab titled "Merged: <A> + <B>" with these results.
   *
   * Original tabs are NOT mutated.
   *
   * @param {string} idA
   * @param {string} idB
   * @returns {Object} The newly created merged tab.
   * @throws {Error} If either id is not found or they are the same tab.
   */
  function mergeTabResults(idA, idB) {
    if (idA === idB) throw new Error("Cannot merge a tab with itself.");

    const tabA = getTabById(idA);
    const tabB = getTabById(idB);

    if (!tabA) throw new Error(`Tab "${idA}" not found.`);
    if (!tabB) throw new Error(`Tab "${idB}" not found.`);

    // 1. Combine flat arrays (deep-copy each item to avoid shared refs)
    const combined = [
      ...tabA.searchResults.map((x) => Object.assign({}, x)),
      ...tabB.searchResults.map((x) => Object.assign({}, x)),
    ];

    // 2+3. Group + deduplicate by imageId per videoCode
    const groupMap = new Map(); // videoCode → Map<imageId, item>

    combined.forEach((item) => {
      const vid = item.videoCode || item.groupId || "unknown";
      if (!groupMap.has(vid)) groupMap.set(vid, new Map());
      // Map.set on the same imageId overwrites — keeps the first occurrence
      // (tabA takes priority; tabB fills in missing frames)
      const frameMap = groupMap.get(vid);
      if (!frameMap.has(item.imageId)) frameMap.set(item.imageId, item);
    });

    // 4. Sort each group ascending by frameNumber (natural sort)
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

    const groupedResults = [];
    let flatIndex = 0;

    groupMap.forEach((frameMap, videoCode) => {
      const items = Array.from(frameMap.values()).sort((a, b) =>
        collator.compare(a.frameNumber, b.frameNumber)
      );

      // Re-index flat positions
      items.forEach((item) => {
        item.index = flatIndex++;
      });

      groupedResults.push({ groupId: videoCode, items });
    });

    // 5. Rebuild flat searchResults in the same order as groupedResults
    const searchResults = groupedResults.flatMap((g) => g.items);

    // 6. Create and return the merged tab
    const title = `Merged: ${tabA.title} + ${tabB.title}`;

    return createTabWithData({
      title,
      searchResults,
      groupedResults,
    });
  }

  /* ── Initialise with one default tab ── */
  createTab();

  /* ── Expose on window ── */
  window.tabState = {
    createTab,
    createTabWithData,
    removeTab,
    setActiveTab,
    getActiveTab,
    getTabById,
    saveTabState,
    getTabs,
    mergeTabResults,
  };
})();
