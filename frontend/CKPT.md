# ⚡ NSD WORM WEC — Frontend Checkpoint & Architecture Guide (`CKPT.md`)

> **Mục đích của file này:** Cung cấp tài liệu tổng quan và chi tiết toàn bộ kiến trúc, luồng hoạt động, cấu trúc tệp tin và các hàm chức năng trong thư mục `frontend_dev`. Khi các AI Agent hoặc lập trình viên tiếp nhận dự án, chỉ cần đọc file này là nắm rõ toàn bộ hệ thống mà không cần phân tích lại từ đầu.

---

## 1. Tổng quan Dự án (Project Overview)

- **Tên ứng dụng:** NSD WORM WEC (VLM Keyframe Image Retrieval & Evaluation Client).
- **Mục tiêu:** Hệ thống truy vấn & tìm kiếm ảnh/keyframe video đa phương thức (Text, OCR, ASR) sử dụng vector embeddings, hỗ trợ workspace đa tab, xem chi tiết ảnh kèm tra cứu frame/thời gian mili-giây (`Time (ms)`), xem video YouTube đồng bộ theo frame, và gửi kết quả chấm điểm lên hệ thống đánh giá DRES (KIS / VBS Evaluation).
- **Tech Stack:**
  - **HTML5 / CSS3 / Vanilla JavaScript (ES6+)**.
  - **Không dùng Framework / Bundler (No Webpack, Vite, React)** — Nạp trực tiếp qua thẻ `<script>` trong `index.html`.
  - Giao diện Dark theme hiện đại, hỗ trợ hiệu ứng kính mờ (glassmorphism), flexbox, CSS grid và floating draggable windows.

---

## 2. Thứ tự nạp Script (Script Loading Order)

Toàn bộ các file Javascript chia sẻ chung Global Scope trong trình duyệt. Thứ tự khai báo trong `index.html` bắt buộc như sau:

```html
<script src="./js/config.js?v=56"></script>       <!-- 1. Cấu hình hằng số & Backend URLs -->
<script src="./js/apiService.js?v=56"></script>   <!-- 2. Gọi API Backend (Search, Health) -->
<script src="./js/dataService.js?v=56"></script>  <!-- 3. Xử lý dữ liệu, ảnh, FPS, Manifest, Media -->
<script src="./js/submitService.js?v=56"></script><!-- 4. Tích hợp DRES server & Submission -->
<script src="./js/tabState.js?v=56"></script>     <!-- 5. Quản lý trạng thái đa tab (Multi-tab) -->
<script src="./js/ui.js?v=56"></script>           <!-- 6. Quản lý DOM, Grid, Floating Windows, Modal -->
<script src="./js/app.js?v=56"></script>          <!-- 7. Main Controller & Event Listeners -->
```

> **Lưu ý Cache:** Khi thay đổi file `.js` hoặc `.css`, hãy tăng số version `?v=...` trong `index.html`.

---

## 3. Cấu trúc Thư mục & Chi tiết Từng File (File Structure & Details)

```
frontend_dev/
├── index.html               # Giao diện chính của ứng dụng
├── video_fps.csv            # Bảng map video_id -> fps (VD: L21_V001,30)
├── api contract.md          # Đặc tả API Backend & DRES
├── CKPT.md                  # File checkpoint này (Tài liệu kiến trúc)
├── css/
│   └── style.css            # Toàn bộ CSS (Layout, Grid, Draggable Window, Modal, Toast)
├── js/
│   ├── config.js            # Cấu hình BASE_URLS, ENDPOINTS, DEFAULTS
│   ├── apiService.js        # Giao tiếp HTTP với Backend FastAPI
│   ├── dataService.js       # Xử lý metadata, manifest frames, FPS map, Time (ms)
│   ├── submitService.js     # Đăng nhập & submit lên DRES server, lưu lịch sử
│   ├── tabState.js          # Quản lý state nhiều tab, thuật toán Merge tabs
│   ├── ui.js                # Render Grid, PreviewWindow, VideoWindow, Modals, Toasts
│   └── app.js               # Khởi tạo app, bắt sự kiện người dùng
└── data/
    ├── keyframes/           # Thư mục ảnh tĩnh keyframe (định dạng .webp / .jpg)
    ├── keyframes_index/     # File manifest JSON danh sách frame theo video ({videoCode}.json)
    └── media/               # File JSON thông tin video Youtube ({videoCode}.json)
```

---

## 4. Chi tiết Chức năng của Từng File JavaScript

### 4.1. `js/config.js` — Cấu hình hệ thống
- `CONFIG.BASE_URLS`: Mảng chứa các URL backend FastAPI (hỗ trợ pool URL để cân bằng tải / load balancing).
- `getRandomBaseUrl()`: Chọn ngẫu nhiên một Backend URL từ pool cho mỗi request.
- `CONFIG.ENDPOINTS`: Danh sách endpoint (`SEARCH: "/api/v1/search"`, `HEALTH: "/api/v1/health"`, `SUBMIT: "/api/v1/submit"`).
- `CONFIG.DEFAULTS`: Cấu hình mặc định cho `TOP_K` (100, min 1, max 200).

### 4.2. `js/apiService.js` — Giao tiếp API Search
- `searchImages(searchInput)`: Gửi POST request tới `/api/v1/search` với payload:
  ```json
  {
    "text": "...", "text_score": 0.5,
    "ocr": "...", "ocr_score": 0.5,
    "asr": "...", "asr_score": 0.5,
    "top_k": 100
  }
  ```
  *(Có đính kèm header `"ngrok-skip-browser-warning": true` khi gọi qua ngrok).*
- `checkHealth()`: Kiểm tra trạng thái hoạt động của backend.

### 4.3. `js/dataService.js` — Xử lý dữ liệu, Video FPS & Thời gian
- **Xử lý URL ảnh & Image ID:**
  - `resolveImageUrl(imageId)`: Chuyển đổi `imageId` (ví dụ `K01_V001/001.webp`) thành đường dẫn tĩnh `./data/keyframes/K01_V001/001.webp`.
  - `parseImageId(imageId)`: Trả về `{ videoCode, frameNumber, fileName, displayLabel }`.
  - `processSearchResults(results)` & `processSearchResultsGrouped(results)`: Chuẩn hóa kết quả trả về từ API thành mảng flat hoặc mảng grouped theo `videoCode`.
- **Tra cứu danh sách frame lân cận (Adjacent Frames):**
  - `fetchVideoFrameList(videoCode)`: Đọc file `./data/keyframes_index/{videoCode}.json` (lưu cache trong `_frameListCache`) trả về danh sách các frame ID.
  - `resolveFrameByVideoCode(videoCode, frameId, ext)`: Tạo object item đầy đủ từ frame ID lân cận.
- **Tính toán FPS & Thời gian mili-giây:**
  - `fetchFpsMap()`: Tự động tải và parse `video_fps.csv` thành `Map<videoCode, fps>` (tự động prefetch khi nạp script).
  - `getVideoFps(videoCode)`: Lấy FPS của video từ map (mặc định trả về 25 nếu không tìm thấy).
  - `calculateFrameMs(frameNumber, fps)`: Tính toán `Math.floor((frameIdx / fps) * 1000)` trả về mili-giây (không lấy số thập phân).
  - `calculateFrameSeconds(frameNumber, fps)`: `Math.max(0, Math.round(frameIdx / fps))` (giây).
  - `formatTimestamp(seconds)`: Định dạng giây thành chuỗi `MM:SS` hoặc `HH:MM:SS`.
- **Thông tin Video YouTube:**
  - `fetchVideoMediaInfo(videoCode)`: Đọc file `./data/media/{videoCode}.json` để lấy `watch_url`, `title`, `author`, v.v.
  - `extractYouTubeVideoId(url)`: Trích xuất video ID 11 ký tự từ link YouTube.

### 4.4. `js/submitService.js` — Đăng nhập & Nộp bài DRES (Evaluation)
- `login()`: Tự động đăng nhập vào DRES Server (`http://192.168.28.151:5000/api/v2/login`) bằng tài khoản cấu hình, lưu `sessionId` vào `localStorage`.
- `getActiveEvaluationId()`: Lấy ID của đợt đánh giá có `status === "ACTIVE"`.
- `getFrameIdxFromCSV(videoCode, frameNumberStr)`: Tra cứu FPS từ `video_fps.csv` (có cache).
- `handleSubmit(imageData, currentQuery)`:
  - Tính `startMs = (frameNumber / fps) * 1000` và `endMs = startMs + 50`.
  - Tạo payload KIS và POST tới `/api/v2/submit/{evaluationId}?session={sessionId}`.
  - Ghi nhận lịch sử submit vào `localStorage` (`vlm_submission_history`).
- Quản lý lịch sử nộp bài: `getSubmissionHistory()`, `saveSubmissionHistory()`, `clearSubmissionHistory()`.

### 4.5. `js/tabState.js` — Quản lý Workspace Đa Tab (Multi-Tab State)
- Cung cấp API quản lý tab độc lập:
  - `createTab()`, `createTabWithData(data)`, `removeTab(id)`, `setActiveTab(id)`, `getActiveTab()`, `getTabs()`.
  - `saveTabState(partial)`: Lưu các giá trị input (`query`, `asr`, `ocr`, `weights`, `topK`, `searchResults`, `groupedResults`) vào tab hiện tại trước khi chuyển tab.
- **Thuật toán Hợp nhất Tab (`mergeTabResults(idA, idB)`):**
  - Trộn xen kẽ (interleave) kết quả từ 2 tab A và B.
  - Loại bỏ trùng lặp dựa trên `videoCode + "/" + frameNumber`.
  - Tạo một tab mới chứa danh sách kết quả đã gộp.

### 4.6. `js/ui.js` — Giao diện & Cửa sổ Floating
- **Grid ảnh (`renderGrid`):** Hiển thị danh sách ảnh gom nhóm theo từng hàng video (`grid-group-row`), cho phép cuộn ngang từng nhóm. Click vào ảnh sẽ mở cửa sổ Preview.
- **Cửa sổ Preview nổi (`PreviewWindow`):**
  - Có thể kéo thả (draggable), thay đổi kích thước (resizable), focus nổi lên trên (`_highestZIndex`).
  - Hỗ trợ mở nhiều cửa sổ preview cùng lúc.
  - Điều hướng bằng nút ◀ / ▶ hoặc phím bấm.
  - Hiển thị đầy đủ thông tin bên sidebar:
    - **Video-Frame:** mã video và số thứ tự frame.
    - **Time (ms):** thời gian frame tính bằng mili-giây (tính từ `frame / fps * 1000`).
    - **OCR Text & ASR Text**.
    - **Nút Submit:** Nộp trực tiếp lên DRES.
  - **Dải frame lân cận (`Neighbor Frames Strip`):** Bấm nút `👁️ Show Neighbor Frames` để xem và chọn 7 frame lân cận liền trước/sau lấy từ manifest JSON.
  - **Nút `▶ Show Video`:** Mở cửa sổ video YouTube tương ứng.
- **Cửa sổ Video nổi (`VideoWindow`):**
  - Tích hợp **YouTube IFrame Player API** (`YT.Player`), không autoplay khi vừa mở (`autoplay: 0`), tự động seek đến đúng vị trí frame (`startSeconds`).
  - **Nút `▶ Play` / `⏸ Pause`:** Cho phép người dùng chủ động bấm phát/tạm dừng video từ vị trí ban đầu.
  - **Trường `Time (ms)` theo thời gian thực:** Hiển thị và liên tục cập nhật mili-giây phát của video (`Math.floor(currentTime * 1000)` ms) khi video đang chạy hoặc khi người dùng tua trên YouTube.
  - Nút xem trực tiếp trên YouTube kèm timestamp.
- **Modal & Thông báo:**
  - `openMergeModal(tabs)` / `closeMergeModal()`: Modal chọn 2 tab để gộp.
  - `openHistoryPanel()` / `closeHistoryPanel()`: Modal xem lịch sử các lượt submit.
  - `showToast(message, type)`: Hiển thị thông báo popup góc màn hình (`success`, `error`, `info`, `warning`).

### 4.7. `js/app.js` — Bộ điều phối chính (Main App Entry)
- Lắng nghe sự kiện `DOMContentLoaded`.
- Đồng bộ các thanh trượt trọng số (`score-text`, `score-ocr`, `score-asr`) và thanh trượt `Top-K`.
- Bắt sự kiện chuyển tab (`tabSwitch`), thêm tab (`tabAdd`), đóng tab (`tabClose`), mở modal gộp tab (`tabMergeOpen`).
- Xử lý tìm kiếm (`performSearch()`):
  - Validate: ít nhất 1 trường query (Text, ASR, OCR) có dữ liệu và tổng trọng số > 0.
  - Bật loading spinner -> Gọi `searchImages` -> Xử lý kết quả bằng `dataService` -> Cập nhật UI & lưu vào tab hiện tại.
- Bắt sự kiện phím tắt (Keyboard shortcuts) và đóng mở các modal.

---

## 5. Dữ liệu Đầu vào & Quy ước Định danh (Data & Identifiers)

1. **Quy ước `image_id`:** Có dạng `<videoCode>/<frameNumber>.<ext>`
   - Ví dụ: `L21_V001/001.webp` hoặc `keyframes/L21_V003/002859.jpg`.
2. **Quy ước Video FPS (`video_fps.csv`):**
   - Cột 1: `video_id` (ví dụ `L21_V001`).
   - Cột 2: `fps` (ví dụ `25` hoặc `30`).
3. **Quy ước Manifest Keyframes (`data/keyframes_index/{videoCode}.json`):**
   - File JSON chứa mảng chuỗi số thứ tự frame: `["00001", "00015", "00030", ...]`.
4. **Quy ước Media Video (`data/media/{videoCode}.json`):**
   - File JSON chứa trường `watch_url` (link YouTube) và metadata liên quan.

---

## 6. Hướng dẫn Dành cho Agent khi Mở rộng Tính năng (Dev Guidelines)

- **Khi sửa đổi giao diện / CSS:** Kiểm tra tính tương thích với dark-mode variables trong `css/style.css` (các biến `--bg-primary`, `--accent`, `--border-glass`, v.v.).
- **Khi thêm trường thông tin mới vào Preview:** Cập nhật HTML template trong `createDom()`, thêm bộ chọn cache trong `createDom()` và hàm cập nhật dữ liệu trong `updateContent()` của class `PreviewWindow` trong `js/ui.js`.
- **Khi thêm hàm xử lý dữ liệu mới:** Đặt trong `js/dataService.js`.
- **Luôn tăng cache-buster version** trên các thẻ `<script src="... ?v=XX">` trong `index.html` sau mỗi lần chỉnh sửa JS.
