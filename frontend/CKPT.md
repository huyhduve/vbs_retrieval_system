# ⚡ NSD WORM WEC — Toàn bộ Kiến trúc & Bản đồ Mã nguồn Frontend (`CKPT.md`)

> **HƯỚNG DẪN DÀNH CHO AI AGENT & LẬP TRÌNH VIÊN:**
> File này ghi chép chi tiết 100% chức năng, vị trí code, hàm, selector DOM, luồng dữ liệu (Data Flow) và sự kiện của thư mục `frontend_dev`. Khi tiếp nhận bất kỳ yêu cầu sửa đổi/thêm mới nào, **hãy tra cứu bảng ánh xạ tính năng bên dưới để định vị chính xác vị trí cần sửa mà không cần phân tích lại codebase từ đầu**.

---

## 📑 MỤC LỤC TRA CỨU NHANH
1. [Bảng Ánh xạ Tính năng -> Code & Selector (Feature Map)](#1-bảng-ánh-xạ-tính-năng---code--selector-feature-map)
2. [Tổng quan Kiến trúc & Thứ tự Nạp Script](#2-tổng-quan-kiến-trúc--thứ-tự-nạp-script)
3. [Cấu trúc Thư mục & Dữ liệu Tĩnh](#3-cấu-trúc-thư-mục--dữ-liệu-tĩnh)
4. [Đặc tả Chi tiết Từng Module (File by File)](#4-đặc-tả-chi-tiết-từng-module-file-by-file)
   - [4.1. `js/config.js` — Cấu hình & URL Backend](#41-jsconfigjs--cấu-hình--url-backend)
   - [4.2. `js/apiService.js` — Tầng Giao tiếp HTTP Backend](#42-jsapiservicejs--tầng-giao-tiếp-http-backend)
   - [4.3. `js/dataService.js` — Xử lý Dữ liệu, Ảnh, FPS & Thời gian](#43-jsdataservicejs--xử-lý-dữ-liệu-ảnh-fps--thời-gian)
   - [4.4. `js/submitService.js` — Tích hợp Hệ thống Đánh giá DRES](#44-jssubmitservicejs--tích-hợp-hệ-thống-đánh-giá-dres)
   - [4.5. `js/tabState.js` — Quản lý State Đa Tab & Hợp nhất Kết quả](#45-jstabstatejs--quản-lý-state-đa-tab--hợp-nhất-kết-quả)
   - [4.6. `js/ui.js` — Render Grid, PreviewWindow, VideoWindow & Modals](#46-jsuijs--render-grid-previewwindow-videowindow--modals)
   - [4.7. `js/app.js` — Bộ Điều phối & Bắt sự kiện Giao diện](#47-jsappjs--bộ-điều-phối--bắt-sự-kiện-giao-diện)
   - [4.8. `css/style.css` — Hệ thống Style, Biến Màu & Glassmorphism](#48-cssstylecss--hệ-thống-style-biến-màu--glassmorphism)
5. [Luồng Dữ liệu Chi tiết (Data Flow Workflows)](#5-luồng-dữ-liệu-chi-tiết-data-flow-workflows)
6. [Quy tắc Phát triển & Mở rộng (Developer Recipes)](#6-quy-tắc-phát-triển--mở-rộng-developer-recipes)

---

## 1. Bảng Ánh xạ Tính năng -> Code & Selector (Feature Map)

| Tính năng / Yêu cầu | Tệp phụ trách chính | Hàm / Lớp liên quan | DOM Selector / ID / Class |
|---|---|---|---|
| **Tìm kiếm đa phương thức (Text/OCR/ASR)** | `js/app.js`<br>`js/apiService.js` | `performSearch()`<br>`searchImages(searchInput)` | `#search-input`, `#asr-input`, `#ocr-input`, `#search-btn`, `#search-spinner` |
| **Tìm kiếm bằng Upload Ảnh / Screenshot (<1.5MB)** | `js/app.js`<br>`js/apiService.js`<br>`js/config.js` | `performSearch()`<br>`searchByImage(imageFile, topK)`<br>`setSelectedImage(file)` | `#image-dropzone`, `#image-input`, `#image-preview`, `#image-remove-btn` |
| **Trọng số điểm (Weight Sliders)** | `js/app.js` | `scoreControls.forEach(...)` | `#score-text`, `#score-ocr`, `#score-asr`, `#score-*-value` |
| **Top-K Slider** | `js/app.js`<br>`js/config.js` | Slider input event | `#topk-slider`, `#topk-value` |
| **Workspace Đa Tab (Add/Switch/Close)** | `js/tabState.js`<br>`js/ui.js`<br>`js/app.js` | `createTab()`, `setActiveTab()`, `removeTab()`, `renderTabBar()` | `#tab-bar`, `.tab-item`, `.tab-add-btn`, `.tab-item__close` |
| **Gộp 2 Tab (Merge Tabs)** | `js/tabState.js`<br>`js/ui.js`<br>`js/app.js` | `mergeTabResults(idA, idB)`, `openMergeModal()` | `.tab-merge-btn`, `#merge-modal`, `#merge-select-a`, `#merge-select-b`, `#merge-confirm` |
| **Grid Ảnh (Gom nhóm theo Video)** | `js/ui.js`<br>`js/dataService.js` | `renderGrid(groups)`, `processSearchResultsGrouped()` | `#image-grid`, `.grid-group-row`, `.grid-group-strip`, `.grid-card` |
| **Cửa sổ Preview nổi (Floating Modal)** | `js/ui.js` | `class PreviewWindow`, `openPreview(index)` | `#preview-windows-container`, `.preview-window-floating`, `.preview-panel` |
| **Xem Frame lân cận (Neighbor Grid)** | `js/ui.js`<br>`js/dataService.js` | `PreviewWindow.renderStrip()`, `fetchVideoFrameList(videoCode)` | `.adj-strip-toggle`, `.adj-strip-panel`, `.adj-strip-panel__header`, `.adj-strip-frames`, `.adj-thumb` |
| **Trường Time (ms) trong Preview** | `js/ui.js`<br>`js/dataService.js` | `PreviewWindow.updateTimeMs()`, `calculateFrameMs(frame, fps)` | `.preview-info-timems`, `video_fps.csv` |
| **Similarity Search từ Preview** | `js/apiService.js`<br>`js/ui.js`<br>`js/app.js` | `searchSimilarImages(imageId)`, `PreviewWindow.setupEvents()` | `.preview-similarity-btn`, Event: `similaritySearchComplete` |
| **Nộp kết quả lên DRES (Submit)** | `js/submitService.js`<br>`js/ui.js` | `handleSubmit(imageData, query)`, `submitToBackend(payload)` | `.preview-submit-btn`, `#history-modal`, `#history-list` |
| **Cửa sổ Video YouTube nổi** | `js/ui.js`<br>`js/dataService.js` | `class VideoWindow`, `openVideoWindow(videoCode, frameNumber)` | `.video-window-floating`, `.video-panel`, `.video-iframe` |
| **Nút Play/Pause & No Autoplay** | `js/ui.js` | `VideoWindow.initYouTubePlayer()`, `VideoWindow.togglePlay()` | `.video-play-btn`, `.video-play-btn--playing` |
| **Real-time Time (ms) khi Video phát** | `js/ui.js` | `VideoWindow.startTimeTracker()`, `VideoWindow.updateTimeDisplay()` | `.video-panel__timems-tag`, `.video-timems-val`, `.video-info-timems` |
| **Toast Notifications** | `js/ui.js` | `showToast(message, type)` | `#toast-container`, `.toast`, `.toast--*` |

---

## 2. Tổng quan Kiến trúc & Thứ tự Nạp Script

Ứng dụng viết hoàn toàn bằng **Vanilla JavaScript (ES6+), HTML5, CSS3**, **KHÔNG sử dụng framework/bundler**. Tất cả các module chia sẻ chung Browser Global Scope.

### Thứ tự nạp Script trong `index.html` (Bắt buộc không thay đổi):
```html
<script src="https://www.youtube.com/iframe_api"></script> <!-- YouTube IFrame API -->
<script src="./js/config.js?v=59"></script>                <!-- 1. Config & Base URLs -->
<script src="./js/apiService.js?v=59"></script>            <!-- 2. API Services -->
<script src="./js/dataService.js?v=59"></script>           <!-- 3. Data Processing & Time Engine -->
<script src="./js/submitService.js?v=59"></script>         <!-- 4. DRES Evaluation Integration -->
<script src="./js/tabState.js?v=59"></script>              <!-- 5. Multi-Tab State Store -->
<script src="./js/ui.js?v=59"></script>                    <!-- 6. DOM & Floating Window Manager -->
<script src="./js/app.js?v=59"></script>                   <!-- 7. Main Controller & Event Bus -->
```

> **Quy tắc Cache:** Sau mỗi lần chỉnh sửa JS/CSS, luôn cập nhật số query parameter `?v=...` ở các thẻ `<script>` và `<link rel="stylesheet">` trong `index.html`.

---

## 3. Cấu trúc Thư mục & Dữ liệu Tĩnh

```
frontend_dev/
├── index.html                   # HTML chính của toàn bộ Single Page Application
├── video_fps.csv                # Bảng CSV ánh xạ video_id sang fps (video_id,fps)
├── api contract.md              # Đặc tả API Backend FastAPI & DRES
├── CKPT.md                      # Tài liệu checkpoint kiến trúc này
├── css/
│   └── style.css                # Toàn bộ CSS giao diện Dark theme Glassmorphism
├── js/
│   ├── config.js                # URL endpoints, load balancing pool & defaults
│   ├── apiService.js            # Giao tiếp HTTP với Backend FastAPI
│   ├── dataService.js           # Xử lý metadata ảnh, manifest JSON, FPS & Thời gian
│   ├── submitService.js         # Đăng nhập DRES, submit KIS payload & lưu history
│   ├── tabState.js              # State đa tab độc lập & thuật toán merge tab
│   ├── ui.js                    # Render Grid, PreviewWindow, VideoWindow, Modal, Toast
│   └── app.js                   # Khởi tạo ứng dụng & gắn event listeners
└── data/
    ├── keyframes/               # Ảnh keyframe tĩnh (.webp / .jpg)
    │   └── {videoCode}/         # Thư mục theo mã video (VD: L21_V001/0001.webp)
    ├── keyframes_index/         # Danh sách frame lân cận theo video
    │   └── {videoCode}.json     # Mảng JSON: ["00001", "00015", "00030", ...]
    └── media/                   # Metadata video YouTube
        └── {videoCode}.json     # JSON: { "watch_url": "https://...", "title": "..." }
```

---

## 4. Đặc tả Chi tiết Từng Module (File by File)

### 4.1. `js/config.js` — Cấu hình & URL Backend
- `CONFIG.BASE_URLS`: Mảng chứa danh sách URL backend FastAPI (hỗ trợ load balancing).
- `CONFIG.ENDPOINTS`:
  - `SEARCH: "/api/v1/search"`
  - `SEARCH_IMAGE: "/search/image"`
  - `HEALTH: "/api/v1/health"`
  - `SUBMIT: "/api/v1/submit"`
- `CONFIG.DATA_PATH`: `"/data/keyframes"`
- `CONFIG.MAX_IMAGE_SIZE`: `1.5 * 1024 * 1024` bytes (1.5MB limit cho file ảnh tìm kiếm).
- `CONFIG.DEFAULTS`: `{ TOP_K: 100, TOP_K_MIN: 1, TOP_K_MAX: 200, MAX_IMAGE_SIZE: 1572864 }`
- `getRandomBaseUrl()`: Chọn ngẫu nhiên 1 Base URL từ `CONFIG.BASE_URLS` cho mỗi request.

---

### 4.2. `js/apiService.js` — Tầng Giao tiếp HTTP Backend
- `searchImages(searchInput)`:
  - **Mục đích:** Gửi yêu cầu tìm kiếm đa phương thức lên Backend.
  - **Endpoint:** `POST {base}/api/v1/search`
  - **Headers:** `Content-Type: application/json`, `ngrok-skip-browser-warning: true`
  - **Payload Body:**
    ```json
    {
      "text": "cô gái áo đỏ", "text_score": 0.5,
      "ocr": "biển số xe",    "ocr_score": 0.5,
      "asr": "xin chào",      "asr_score": 0.5,
      "top_k": 100
    }
    ```
- `searchSimilarImages(imageId)`:
  - **Mục đích:** Tìm kiếm các keyframe tương đồng trực quan với 1 ảnh đã chọn.
  - **Endpoint:** `POST {base}/api/v1/search`
  - **Payload Body:** `{ "image_id": "L21_V001/2342.webp" }`
- `searchByImage(imageFile, topK)`:
  - **Mục đích:** Upload file ảnh / screenshot để truy vấn dữ liệu.
  - **Endpoint:** `POST {base}/search/image`
  - **Payload Body:** `FormData` với `file: <ImageFile>` và `top_k: <topK>`.
- `checkHealth()`: Kiểm tra backend health check (`GET /api/v1/health`).
- `submitToBackend(payload)`: Gửi submission tới backend mount cục bộ nếu có.

---

### 4.3. `js/dataService.js` — Xử lý Dữ liệu, Ảnh, FPS & Thời gian
- `resolveImageUrl(imageId)`: Biến đổi `imageId` thành đường dẫn tĩnh `./data/keyframes/{cleanId}`.
- `parseImageId(imageId)`: Bóc tách chuỗi thành `{ videoCode, frameNumber, fileName, displayLabel }`.
- `processSearchResults(results)`: Chuẩn hóa kết quả dạng mảng phẳng (Flat Array) cho bộ điều hướng Preview.
- `processSearchResultsGrouped(results)`: Chuẩn hóa kết quả gom nhóm theo `video_id` (`[{ groupId, items }]`) để render hàng Grid cuộn ngang.
- **Manifest Frame lân cận:**
  - `fetchVideoFrameList(videoCode)`: Đọc và cache `./data/keyframes_index/{videoCode}.json`.
  - `resolveFrameByVideoCode(videoCode, frameId, ext)`: Sinh item đầy đủ từ frame ID lân cận.
- **Tính toán FPS & Thời gian mili-giây / giây:**
  - `fetchFpsMap()`: Tự động tải và parse `video_fps.csv` thành `Map<videoCode, fps>` (Prefetch ngay khi nạp script).
  - `getVideoFps(videoCode)`: Lấy FPS từ cache map (mặc định 25 nếu không có trong CSV).
  - `calculateFrameMs(frameNumber, fps)`: Công thức `Math.floor((frameIdx / fps) * 1000)` (số nguyên mili-giây).
  - `calculateFrameSeconds(frameNumber, fps)`: `Math.max(0, Math.round(frameIdx / fps))` (giây).
  - `formatTimestamp(seconds)`: Format thành chuỗi `MM:SS` hoặc `HH:MM:SS`.
- **Thông tin Video YouTube:**
  - `fetchVideoMediaInfo(videoCode)`: Đọc và cache `./data/media/{videoCode}.json`.
  - `extractYouTubeVideoId(url)`: Regex trích xuất 11 ký tự Video ID từ link YouTube.

---

### 4.4. `js/submitService.js` — Tích hợp Hệ thống Đánh giá DRES
- `login()`: Tự động đăng nhập vào DRES Server (`http://192.168.28.151:5000/api/v2/login`), lưu `sessionId` vào `localStorage`.
- `getActiveEvaluationId()`: Lấy ID đợt thi ACTIVE từ `/api/v2/client/evaluation/list/?session=...`.
- `getFrameIdxFromCSV(videoCode, frameNumberStr)`: Tra cứu FPS từ `video_fps.csv` để phục vụ tính PTS/StartMs.
- `handleSubmit(imageData, currentQuery)`:
  - Tính `startMs = (frameNumber / fps) * 1000` và `endMs = startMs + 50`.
  - Tạo payload KIS:
    ```json
    {
      "answerSets": [{
        "answers": [{ "mediaItemName": videoCode, "start": startMs, "end": endMs }]
      }]
    }
    ```
  - Gửi POST tới `/api/v2/submit/{evaluationId}?session={sessionId}`.
  - Lưu vào lịch sử submit `localStorage['vlm_submission_history']`.
- `getSubmissionHistory()`, `saveSubmissionHistory(entry)`, `clearSubmissionHistory()`.

---

### 4.5. `js/tabState.js` — Quản lý State Đa Tab & Hợp nhất Kết quả
- **Cấu trúc Tab Object:**
  ```javascript
  {
    id: "tab-1",
    title: "Search 1",
    taskMode: "KIS",
    query: "...", asr: "...", ocr: "...",
    weights: { score_text: 0.5, score_ocr: 0.5, score_asr: 0.5 },
    topK: 100,
    searchResults: [],    // Mảng flat processed results
    groupedResults: [],   // Mảng grouped results theo video
    trakeBasket: []
  }
  ```
- **Hàm quản trị Tab:**
  - `createTab()`: Thêm tab trống mới và kích hoạt.
  - `createTabWithData(data)`: Tạo tab điền sẵn kết quả (Dùng cho Similarity Search & Merge Tab).
  - `removeTab(id)`: Đóng tab (Đảm bảo tối thiểu luôn còn 1 tab).
  - `setActiveTab(id)`, `getActiveTab()`, `getTabById(id)`, `getTabs()`.
  - `saveTabState(partial)`: Lưu snapshot input hiện tại vào tab active trước khi rời tab.
- **Hợp nhất Tab (`mergeTabResults(idA, idB)`):**
  - Trộn xen kẽ (Interleave) danh sách `searchResults` từ 2 tab.
  - Khử trùng lặp (Deduplicate) dựa trên khóa `${videoCode}/${frameNumber}`.
  - Trả về đối tượng tab mới chứa dữ liệu đã gộp.

---

### 4.6. `js/ui.js` — Render Grid, PreviewWindow, VideoWindow & Modals

#### 4.6.1. Image Grid
- `renderGrid(groups)`: Render danh sách nhóm video ra `#image-grid`. Mỗi video là 1 hàng `.grid-group-row` chứa dải card `.grid-card` cuộn ngang. Click vào card gọi `openPreview(flatIndex)`.
- `updateResultCount(count)`: Cập nhật text `#result-count`.

#### 4.6.2. Cửa sổ Preview Nổi (`class PreviewWindow`)
- Quản lý cửa sổ preview có thể kéo thả (`setupDragging`), thay đổi kích thước, nhiều cửa sổ mở đồng thời (`openPreviewWindows`).
- **Sidebar thông tin:**
  - Video-Frame: `.preview-info-videoframe`
  - Time (ms): `.preview-info-timems` (Tra cứu FPS và cập nhật tự động bằng `updateTimeMs()`).
  - ASR Text: `.preview-info-asr` (Tải động từ file JSON `./asr_data/{videoCode}.json` qua `updateAsrText()`).
  - Nút Similarity Search: `.preview-similarity-btn` (Gửi request `image_id` và bắn event `similaritySearchComplete`).
  - Nút Submit: `.preview-submit-btn` (Gọi `handleSubmit`).
- **Điều hướng & Frame Lân cận:**
  - Nút ◀ / ▶: `navigateResult(-1)` / `navigateResult(1)`.
  - Nút `👁️ Show Neighbor Frames` (`.adj-strip-toggle`): Mở panel lưới 6×6 frame lân cận nằm **bên phải** của preview window (`.adj-strip-panel`). `STRIP_WINDOW = 36` (6×6 = 36 frame). Panel bật thêm class `.preview-window-floating--strip-open` để mở rộng chiều rộng cửa sổ (lên đến 1260px). Nút ◀ / ▶ nằm trong header của panel (`adj-strip-panel__header`), nhấn để shift window theo từng frame.
  - Nút `▶ Show Video` (`.show-video-btn`): Mở cửa sổ video YouTube.

#### 4.6.3. Cửa sổ Video YouTube Nổi (`class VideoWindow`)
- Kích thước mặc định **900px × 620px**, có thể kéo thả và resizable.
- Tích hợp **YouTube IFrame Player API** (`YT.Player`), **không autoplay khi mở** (`autoplay: 0`), định vị sẵn tại `startSeconds`.
- **Nút `▶ Play` / `⏸ Pause` (`.video-play-btn`)**: Bấm để phát từ vị trí start/tạm dừng video, tự động đổi style khi video phát (`.video-play-btn--playing`).
- **Trường `Frame` Real-time (`.video-panel__timestamp`)**: Hiển thị dạng `Frame : <number>` và liên tục cập nhật số thứ tự Frame số nguyên `Math.round(currentTime * fps)` (`.video-frame-val`) theo thời gian thực khi video đang phát hoặc tua.
- **Trường `Time (ms)` Real-time (`.video-panel__timems-tag`, `.video-timems-val`)**: Timer `setInterval(..., 50ms)` liên tục lấy `player.getCurrentTime()` và cập nhật `Math.floor(currentTime * 1000)` khi video đang chạy hoặc khi người dùng tua trên YouTube.
- Tự động huỷ `player.destroy()` và dọn dẹp interval khi đóng cửa sổ (`close()`).

#### 4.6.4. Modals & Toasts
- `openMergeModal(tabs)` / `closeMergeModal()`: Quản lý modal gộp 2 tab (`#merge-modal`).
- `openHistoryPanel()` / `closeHistoryPanel()`: Quản lý modal lịch sử submission (`#history-modal`).
- `showToast(message, type)`: Hiển thị toast popup góc màn hình (`#toast-container`).

---

### 4.7. `js/app.js` — Bộ Điều phối & Bắt sự kiện Giao diện
- `DOMContentLoaded`: Khởi tạo UI, đồng bộ giá trị mặc định của slider.
- **Sự kiện Tab:**
  - `tabSwitch`: Lưu state tab cũ -> Kích hoạt tab mới -> `restoreTabToUI()` -> `refreshTabBar()`.
  - `tabAdd`: Tạo tab mới -> Chuyển focus vào `#search-input`.
  - `tabClose`: Đóng tab -> Phục hồi UI về tab liền kề.
  - `tabMergeOpen`: Mở `#merge-modal`.
- **Sự kiện Similarity Search (`similaritySearchComplete`):**
  - Nhận kết quả từ `PreviewWindow` -> Tạo tab mới bằng `createTabWithData` -> `restoreTabToUI` -> Chuyển tab và hiển thị grid ảnh tương tự.
- **Sự kiện Search (`performSearch()`):**
  - Đọc `#search-input`, `#asr-input`, `#ocr-input`, các slider trọng số và `#topk-slider`.
  - Validate dữ liệu đầu vào.
  - Gọi `searchImages(...)` -> Chuẩn hóa bằng `dataService` -> Render grid & Lưu state tab.
- **Phím tắt (Hotkeys):** Enter để tìm kiếm, ESC / Arrow keys để điều hướng.

---

### 4.8. `css/style.css` — Hệ thống Style, Biến Màu & Glassmorphism
- **Bảng màu CSS Variables:**
  - Nền & Kính: `--bg-primary: #0b0f19`, `--bg-secondary: #111827`, `--bg-card: #1e293b`, `--bg-glass: rgba(30, 41, 59, 0.45)`, `--border-glass: rgba(148, 163, 184, 0.12)`.
  - Brand & Accent: `--accent: #6366f1` (Indigo), `--accent-hover: #818cf8`, `--accent-glow: rgba(99, 102, 241, 0.35)`.
  - Trạng thái: `--success: #22c55e`, `--warning: #f59e0b`, `--error: #ef4444`.
- **Lớp điều khiển quan trọng:**
  - `.preview-window-floating`, `.preview-window-floating--active`: Popup Preview ảnh.
  - `.video-window-floating`, `.video-window-floating--active`: Popup Video YouTube.
  - `.video-play-btn`, `.video-play-btn--playing`: Nút Play/Pause video.
  - `.preview-similarity-btn`: Nút Similarity Search gradient tím.
  - `.adj-strip-wrapper`, `.adj-thumb--active`: Dải frame lân cận.

---

## 5. Luồng Dữ liệu Chi tiết (Data Flow Workflows)

### 5.1. Luồng Tìm kiếm Đa phương thức (Multimodal Search)
```
[User Input: Text / ASR / OCR & Sliders]
      │
      ▼
app.js: performSearch() ──► apiService.js: searchImages()
                                    │ (POST /api/v1/search)
                                    ▼
dataService.js: processSearchResults() & processSearchResultsGrouped()
      │
      ├─────────────────────────────┬─────────────────────────────┐
      ▼                             ▼                             ▼
ui.js: renderGrid(grouped)    tabState.js: saveTabState()   ui.js: showToast()
```

### 5.2. Luồng Similarity Search (Tìm kiếm ảnh tương đồng từ Preview)
```
[User clicks "🔍 Similarity Search" in PreviewWindow]
      │
      ▼
ui.js: PreviewWindow.setupEvents() ──► apiService.js: searchSimilarImages(imageId)
                                                │ (POST /api/v1/search { "image_id": "..." })
                                                ▼
ui.js: Dispatches "similaritySearchComplete" with flat & grouped results
      │
      ▼
app.js: Listener "similaritySearchComplete"
      │
      ├─► tabState.js: createTabWithData(detail)  (Tạo Tab mới)
      ├─► app.js: restoreTabToUI(newTab)          (Hiển thị kết quả lên Grid)
      └─► ui.js: renderTabBar()                   (Cập nhật Tab Bar)
```

### 5.3. Luồng Video Sync & Real-time Time (ms)
```
[User clicks "▶ Show Video" in PreviewWindow]
      │
      ▼
ui.js: openVideoWindow(videoCode, frameNumber)
      │
      ├─► dataService.js: fetchVideoMediaInfo() & getVideoFps()
      ├─► dataService.js: calculateFrameSeconds(frameNumber, fps)
      │
      ▼
ui.js: new VideoWindow(...) ──► YT.Player init (autoplay: 0, seekTo: startSeconds)
      │
      ▼
[User clicks "▶ Play" or plays inside YouTube iframe]
      │
      ▼
ui.js: VideoWindow.handleStateChange(PLAYING)
      │
      ├─► VideoWindow.startTimeTracker() (Interval 50ms)
      │         │
      │         ▼
      │   player.getCurrentTime() ──► Math.floor(sec * 1000) ──► Update .video-timems-val
      │
[User clicks "⏸ Pause" / Video ends]
      │
      ▼
ui.js: VideoWindow.stopTimeTracker()
```

---

## 6. Quy tắc Phát triển & Mở rộng (Developer Recipes)

### 6.1. Muốn thêm một trường thông tin mới vào Preview Modal:
1. Mở `js/ui.js` -> Tìm class `PreviewWindow` -> Phương thức `createDom()`.
2. Thêm HTML vào `<aside class="preview-panel__sidebar">`:
   ```html
   <div class="preview-info__group">
     <span class="preview-info__label">Tên Trường</span>
     <span class="preview-info-custom preview-info__value">—</span>
   </div>
   ```
3. Cache element trong `createDom()`: `this.infoCustomEl = winEl.querySelector(".preview-info-custom");`
4. Cập nhật dữ liệu trong `updateContent()` của `PreviewWindow`.

### 6.2. Muốn thay đổi Payload gửi lên Backend Search:
1. Mở `js/apiService.js` -> Sửa hàm `searchImages()` hoặc `searchSimilarImages()`.
2. Cập nhật `api contract.md` tương ứng.

### 6.3. Muốn thay đổi công thức tính toán thời gian:
1. Mở `js/dataService.js` -> Sửa hàm `calculateFrameMs` hoặc `calculateFrameSeconds`.

### 6.4. Sau khi hoàn thành code:
1. Kiểm tra không có lỗi console browser.
2. Tăng số version `?v=XX` trong `index.html` cho các file CSS / JS đã chỉnh sửa.
3. Cập nhật lại tài liệu `CKPT.md` nếu có hàm hoặc selector mới.
