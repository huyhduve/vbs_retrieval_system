/**
 * config.js
 * ---------
 * Centralized configuration for API endpoints and default values.
 * Modify BASE_URLS to match the backend server addresses.
 * Each API call will randomly pick one of the URLs from the pool.
 */

const CONFIG = Object.freeze({
  // Backend base URLs — add/remove entries as needed.
  // On each API call, one URL is chosen at random for load-spreading.
  BASE_URLS: [
      "http://localhost:8000"
  ],

  ENDPOINTS: {
    SEARCH: "/api/v1/search",
    SIM_SEARCH: "/api/v1/search/sim",
    SEARCH_IMAGE: "/api/v1/search/image",
    HEALTH: "/api/v1/health",
    SUBMIT: "/api/v1/submit",
  },

  DATA_PATH: "/data/keyframes",
  MAX_IMAGE_SIZE: 1.5 * 1024 * 1024, // 1.5MB in bytes (1572864)

  DEFAULTS: {
    TOP_K: 100,
    TOP_K_MIN: 1,
    TOP_K_MAX: 200,
    MAX_IMAGE_SIZE: 1.5 * 1024 * 1024,
  },

  // Gemini API Configuration
  GEMINI: {
    API_KEY: "AIzaSyC072Hret1Pia-L_5xQ5VK_GLlZlxL5xds", // Replace with your Gemini API key
    MODEL: "gemini-3.5-flash-lite",
    SYSTEM_PROMPT: 
    `Bạn là một AI Query Engine chuyển đổi câu lệnh tự nhiên của người dùng thành cấu trúc JSON QueryRequest chuẩn mực cho backend hệ thống VBS (Video Browser Search).

    DANH SÁCH TOPIC CHUẨN HÓA (TopicType):
    - "News": Bản tin 60s, thời sự, báo chí.
    - "Tech": Công nghệ, phần mềm, hệ thống.
    - "Race": Đua xe đạp Cúp Truyền Hình.
    - "Dragon": Múa lân, Lân Sư Rồng, Mai hoa thung.
    - "Food": Ẩm thực, món ăn, nấu ăn, công thức.
    - "Lecture": Bài giảng, ôn thi đại học, giáo dục.
    - "Travel": Du lịch, văn hóa, danh lam thắng cảnh.
    - "Life": Ký sự, đời sống, Tản mạn Mê Kông, Đôi mắt Mê Kông, Lan tỏa năng lượng tích cực.

    QUY TẮC XÂY DỰNG TRƯỜNG DỮ LIỆU:
    1. "text" (string, max 500 chars): Câu mô tả hình ảnh/khung cảnh bằng tiếng Anh (dùng cho SigLIP-2 / Visual Search). Nếu người dùng không mô tả hình ảnh, để chuỗi rỗng "".
    2. "ocr" (string, max 200 chars): Văn bản/chữ viết xuất hiện TRÊN MÀN HÌNH (ví dụ: bảng tên, tiêu đề slide, chữ áo đua, bảng hiệu). Nếu không đề cập, để chuỗi rỗng "".
    3. "asr" (string, max 200 chars): Lời nói/giọng thuyết minh/subtitle trong video. Nếu không đề cập, để chuỗi rỗng "".
    4. "RRF" (boolean): 
      - 'true': Dùng khi tìm kiếm đa phương thức tổng hợp hoặc không yêu cầu trọng số cụ thể.
      - 'false': Dùng khi người dùng nhấn mạnh ưu tiên một phương thức cụ thể (khi đó thiết lập các score tương ứng).
    5. "text_score", "ocr_score", "asr_score" (float, 0.0 - 1.0): Trọng số của từng phương thức khi RRF=false.
    6. "top_k" (integer, 1 - 200): Số lượng kết quả cần lấy (mặc định 100 hoặc 200 nếu yêu cầu tìm rộng).
    7. "topic" (List[TopicType]): Danh sách danh mục liên quan. Nếu không xác định được, để mảng rỗng [].

    BẮT BUỘC TRẢ VỀ DUY NHẤT ĐỊNH DẠNG JSON TƯƠNG THÍCH HOÀN TOÀN VỚI PYDANTIC SCHEMA.`,

    USER_PROMPT: 
      `
      Dựa trên thông tin được cung cấp:
  - Context (Đoạn văn bản/ASR): {context}
  - Topic (Chủ đề): {topics}
  - Addition (Thông tin bổ sung): {addition}

  Hãy phân tích thuộc nhóm video nào trong dữ liệu và tạo ra từ 2 đến 3 câu truy vấn tiếng Anh (Search Queries) tối ưu nhất cho SigLIP-2 để tìm keyframe tương ứng.
    `,
  },
});

/**
 * Return a random base URL from CONFIG.BASE_URLS.
 * @returns {string}
 */
function getRandomBaseUrl() {
  const urls = CONFIG.BASE_URLS;
  return urls[Math.floor(Math.random() * urls.length)];
}
