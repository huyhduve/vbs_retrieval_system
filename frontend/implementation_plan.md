# Multi-Tab State Architecture — STEP 1.1

Introduce a global tab state array so users can have multiple independent search workspaces. Switching tabs must save/restore: query inputs, slider weights, search results, and task mode.

---

## Proposed Changes

### New File

#### [NEW] tabState.js
A new module loaded **before** `app.js` that owns all tab state and exposes the mutation API.

```
tabs[]         — array of tab objects
activeTabId    — string id of the currently active tab
```

**Tab object shape:**
```js
{
  id: "tab-1",
  title: "Search 1",
  taskMode: "KIS",          // "KIS" | "QA" | "TRAKE"
  query: "",
  asr: "",
  ocr: "",
  weights: { score_text: 0.5, score_ocr: 0.5, score_asr: 0.5 },
  topK: 100,
  searchResults: [],        // flat processed array (used by preview navigator)
  groupedResults: [],       // grouped array (used by renderGrid)
  trakeBasket: []
}
```

**Exported functions:**
- `createTab()` → adds a new tab, returns it
- `removeTab(id)` → removes tab (min 1 tab)
- `setActiveTab(id)` → switches active tab
- `getActiveTab()` → returns current tab object
- `saveTabState(partial)` → merges fields into active tab

---

### Modified Files

#### [MODIFY] app.js
- On **DOMContentLoaded**: initialize `tabState` with 1 default tab, render tab bar
- **`saveCurrentInputsToTab()`** — snapshot all input values into `getActiveTab()` before switching
- **`restoreTabToUI(tab)`** — write tab state back to DOM inputs/sliders/grid on switch
- **`performSearch()`** — after results come back, call `saveTabState({ searchResults, groupedResults })`
- Wire tab bar events: **+ Add**, **click to switch**, **× close**

#### [MODIFY] ui.js
- Add `renderTabBar(tabs, activeTabId)` — renders the tab strip at the top of the main area
- Tab bar emits `tabSwitch` / `tabAdd` / `tabClose` custom events that `app.js` handles

#### [MODIFY] index.html
- Add `<div id="tab-bar"></div>` above the grid container inside `.grid-container`
- Add `<script src="./js/tabState.js"></script>` before `app.js`

#### [MODIFY] style.css
- Add `.tab-bar`, `.tab-item`, `.tab-item--active`, `.tab-item__close`, `.tab-add-btn` styles

---

## Open Questions

> [!IMPORTANT]
> **taskMode field**: The task only defines "KIS" | "QA" | "TRAKE" as valid modes, but the current UI has no mode switcher yet. Should `taskMode` be stored in tab state now (as a placeholder) and the UI switcher implemented in a later step? Or should the mode switcher also be built in this step?

> [!NOTE]
> **Tab title**: Tabs will be named "Search 1", "Search 2", etc. by default. Should users be able to rename tabs (double-click to edit)? Or is auto-naming sufficient for this step?

> [!NOTE]
> **trakeBasket**: Defined in the data structure but TRAKE mode is not yet implemented. The field will be stored but not rendered in this step.

---

## Verification Plan

### Manual Verification
1. Open the page — one default tab "Search 1" appears
2. Enter query + search → results show in the grid
3. Click **+** → new tab "Search 2" opens, inputs and grid are empty
4. Switch back to tab 1 → original query and results are restored
5. Close tab 2 → only tab 1 remains (close button hidden when only 1 tab)
