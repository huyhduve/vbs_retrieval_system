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
    SYSTEM_PROMPT: `Bạn là một AI Query Engine thông minh chuyên phân tích ngữ nghĩa và chuyển đổi yêu cầu tìm kiếm keyframe video (Video Browser Search - VBS) đa phương thức (Text, OCR, ASR).

    NHIỆM VỤ CHÍNH:
    1. "reason": Phân tích ngắn gọn ngữ cảnh (Context), chủ đề (Topic) và thông tin bổ sung (Addition). Suy luận góc nhìn hình ảnh, từ khóa chữ hiển thị (OCR) hoặc lời thoại (ASR) tiềm năng và gợi ý hướng tìm kiếm. Độ dài TOÀN BỘ đoạn "reason" BẮT BUỘC KHÔNG VƯỢT QUÁ 30 TỪ.
    2. "search_list": Sinh ra CHÍNH XÁC 3 payload truy vấn khác nhau dạng Pydantic Schema. BẮT BUỘC kết hợp linh hoạt cả 3 kênh: Visual Text (SigLIP-2), OCR (Text trên màn hình) và ASR (Giọng nói/Subtitle).

    ==================================================
    🎯 QUY TẮC BẮT BUỘC CHO 3 PAYLOAD TRONG "search_list":
    ==================================================

    - PAYLOAD 1: CHIẾN LƯỢC HÌNH ẢNH THUẦN TÚY (Visual SigLIP-2 Focus)
      + "text": Mô tả hình ảnh tiếng Anh chi tiết, chuẩn SigLIP-2 (có góc quay, màu sắc, hành động, bối cảnh).
      + "ocr": "", "asr": ""
      + "RRF": false, "text_score": 1.0, "ocr_score": 0.0, "asr_score": 0.0

    - PAYLOAD 2: CHIẾN LƯỢC ĐỌC CHỮ MÀN HÌNH (OCR & Text Hybrid)
      + "ocr": BẮT BUỘC trích xuất các từ khóa chữ hiển thị có khả năng xuất hiện trên video (tiêu đề, địa danh, tên người, bảng hiệu, áo đấu, slide).
      + "text": Câu mô tả khung cảnh tiếng Anh đơn giản hỗ trợ OCR.
      + "asr": ""
      + "RRF": true (hoặc RRF: false với "ocr_score": 0.7, "text_score": 0.3)

    - PAYLOAD 3: CHIẾN LƯỢC LỜI THOẠI & KẾT HỢP ĐA PHƯƠNG THỨC (ASR / Multi-Modal Fusion)
      + "asr": BẮT BUỘC lấy trọn vẹn hoặc các cụm từ khóa cốt lõi từ lời thuyết minh/giọng nói tiếng Việt trong Context.
      + "ocr": Từ khóa OCR bổ trợ (nếu có).
      + "text": Câu mô tả tiếng Anh chuẩn SigLIP-2 bổ trợ.
      + "RRF": true, "text_score": 0.4, "ocr_score": 0.3, "asr_score": 0.3

    ==================================================
    🚨 MẸO TẠO "text" SIGLIP-2 FRIENDLY (CHO TRƯỜNG TEXT):
    ==================================================
    1. Cấu trúc câu mô tả tự nhiên: "A professional cyclist wearing a blue jersey crossing the finish line..."
    2. Thêm góc quay: "close-up shot of...", "wide-angle view of...", "aerial drone view of...", "medium shot of...".
    3. Tránh từ trừu tượng, mô tả vật thể vật lý, màu sắc, ánh sáng rõ ràng.

    DANH SÁCH TOPIC CHUẨN HÓA (TopicType):
    - "News": Bản tin 60s, thời sự, báo chí.
    - "Tech": Công nghệ, phần mềm, hệ thống.
    - "Race": Đua xe đạp Cúp Truyền Hình.
    - "Dragon": Múa lân, Lân Sư Rồng, Mai hoa thung.
    - "Food": Ẩm thực, món ăn, nấu ăn, công thức.
    - "Lecture": Bài giảng, ôn thi đại học, giáo dục.
    - "Travel": Du lịch, văn hóa, danh lam thắng cảnh.
    - "Life": Ký sự, đời sống, Tản mạn Mê Kông, Đôi mắt Mê Kông, Lan tỏa năng lượng tích cực.

    BẮT BUỘC TRẢ VỀ DUY NHẤT ĐỊNH DẠNG JSON MẪU YÊU CẦU.`,

    USER_PROMPT: 
      `Dựa trên các thông tin được cung cấp:
      - Context (Đoạn văn bản/ASR): {context}
      - Topic (Chủ đề): {topics}
      - Addition (Thông tin bổ sung): {addition}

      Hãy suy luận và sinh ra JSON gồm "reason" (dưới 30 từ) và "search_list" chứa đúng 3 payload theo đúng 3 chiến lược (Visual Focus, OCR Focus, ASR/Hybrid Fusion) như quy tắc:

      {
        "reason": "<Phân tích hình ảnh, OCR, ASR ngắn gọn và gợi ý hướng tìm kiếm, tối đa 30 từ>",
        "search_list": [
          {
            "text": "<Payload 1: SigLIP-2 English visual description>",
            "ocr": "",
            "asr": "",
            "RRF": false,
            "text_score": 1.0,
            "ocr_score": 0.0,
            "asr_score": 0.0,
            "top_k": 100,
            "topic": ["<TopicType>"]
          },
          {
            "text": "<Payload 2: Short SigLIP-2 English description>",
            "ocr": "<Payload 2: Chữ tiếng Việt xuất hiện trên màn hình (địa danh, tên riêng, tiêu đề...)>",
            "asr": "",
            "RRF": true,
            "text_score": 0.4,
            "ocr_score": 0.6,
            "asr_score": 0.0,
            "top_k": 100,
            "topic": ["<TopicType>"]
          },
          {
            "text": "<Payload 3: Supporting SigLIP-2 English description>",
            "ocr": "<Payload 3: OCR bổ trợ nếu có>",
            "asr": "<Payload 3: Lời thoại/Subtitle tiếng Việt trích từ Context>",
            "RRF": true,
            "text_score": 0.33,
            "ocr_score": 0.33,
            "asr_score": 0.34,
            "top_k": 100,
            "topic": ["<TopicType>"]
          }
        ]
      }`
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
