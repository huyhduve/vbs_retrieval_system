/**
 * submitService.js
 * ------------------
 * Handles DRES API authentication, keyframe CSV mapping, and submission logic.
 * Tích hợp Console Logs hỗ trợ Debug chi tiết.
 */

// Cấu hình thông tin kết nối và tài khoản
const BASE_URL = "http://192.168.28.151:5000";
const AUTH_CREDENTIALS = {
  username: "tohd",
  password: "123456"
};

const STORAGE_KEY = "vlm_submission_history";
const SESSION_KEY = "vlm_session_id";

// Cache chứa dữ liệu CSV đã đọc
const csvCache = new Map();

let sessionId = localStorage.getItem(SESSION_KEY) || null;

/**
 * Tự động đăng nhập lấy sessionId
 */
async function login() {
  console.log("%c[AUTH] Đang gửi yêu cầu đăng nhập...", "color: #3b82f6; font-weight: bold;");
  console.log("   --> URL:", `${BASE_URL}/api/v2/login`);
  console.log("   --> User:", AUTH_CREDENTIALS.username);

  try {
    const response = await fetch(`${BASE_URL}/api/v2/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(AUTH_CREDENTIALS)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    sessionId = data.sessionId;
    localStorage.setItem(SESSION_KEY, sessionId);

    console.log("%c[AUTH] Đăng nhập thành công!", "color: #22c55e; font-weight: bold;");
    console.log("   --> Session ID:", sessionId);
    return sessionId;
  } catch (error) {
    console.error("%c[AUTH ERROR] Đăng nhập thất bại:", "color: #ef4444; font-weight: bold;", error.message);
    throw error;
  }
}

// Chạy tự động login khi module được nạp
login();

/**
 * Lấy danh sách Evaluation đang ACTIVE từ Server
 */
async function getActiveEvaluationId() {
  if (!sessionId) {
    console.warn("[EVAL] Chưa có sessionId, tiến hành đăng nhập lại...");
    await login();
  }

  const evalUrl = `${BASE_URL}/api/v2/client/evaluation/list/?session=${sessionId}`;
  console.log("%c[EVAL] Đang tải danh sách Evaluation...", "color: #3b82f6;");

  const response = await fetch(evalUrl, {
    method: "GET",
    headers: { "Content-Type": "application/json" }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Không thể lấy danh sách evaluation (${response.status}): ${errText}`);
  }

  const evaluations = await response.json();
  console.log("   --> Đã nhận danh sách Evaluation:", evaluations);

  const activeEval = evaluations.find((item) => item.status === "ACTIVE");

  if (!activeEval) {
    throw new Error("Không tìm thấy đợt đánh giá nào ở trạng thái ACTIVE.");
  }

  console.log(`%c[EVAL] Tìm thấy Evaluation ACTIVE: "${activeEval.name}" (ID: ${activeEval.id})`, "color: #22c55e;");
  return activeEval.id;
}

/**
 * Đọc file CSV map-keyframes và tra cứu pts
 */
async function getFrameIdxFromCSV(videoCode, frameNumberStr) {
  const targetN = parseInt(frameNumberStr, 10);
  const csvUrl = `video_fps.csv`;

  console.log(`%c[CSV] Đang tra cứu keyframe cho Video: ${videoCode}, Frame index =${targetN}`, "color: #8b5cf6;");

  if (!csvCache.has(csvUrl)) {
    console.log(`   --> File chưa có trong Cache, đang tải từ: ${csvUrl}`);
    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error(`Không thể tải file CSV mapping tại: ${csvUrl} (Status: ${response.status})`);
    }
    const text = await response.text();

    // Parse CSV
    const lines = text.trim().split("\n");
    const header = lines[0].split(",").map((h) => h.trim());
    const video_id = header.indexOf("video_id");
    const fps = header.indexOf("fps");

    if (video_id === -1 || fps === -1) {
      throw new Error(`File CSV ${csvUrl} thiếu cột 'video_id' hoặc 'fps'`);
    }

    const mapping = new Map();
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const cols = lines[i].split(",").map((c) => c.trim());
      mapping.set(cols[video_id].trim(), parseFloat(cols[fps]) || 25);
    }

    csvCache.set(csvUrl, mapping);
    console.log(`   --> Tải và Parse CSV thành công. Tổng số bản ghi: ${mapping.size}`);
  } else {
    console.log(`   --> Lấy dữ liệu CSV từ Memory Cache.`);
  }

  const mapData = csvCache.get(csvUrl);
  if (!mapData.has(videoCode)) {
    throw new Error(`Không tìm thấy giá trị 'video=${videoCode}' trong file ${csvUrl}`);
  }

  const fps = mapData.get(videoCode);
  console.log(`%c[CSV] Tra cứu thành công: video=${videoCode} => fps=${fps}`, "color: #22c55e;");
  return fps;
}

/**
 * Phân tích image_id
 */
function parseImageId(rawImageId) {
  console.log(`[PARSE] Đang phân tích rawImageId: "${rawImageId}"`);
  const cleanId = rawImageId.replace(/\.(jpg|png|jpeg|webp)$/i, "");
  const parts = cleanId.split("/");

  if (parts.length < 2) {
    throw new Error(`Định dạng image_id không hợp lệ: "${rawImageId}". Yêu cầu dạng "K**_V**/0**"`);
  }

  const videoCode = parts[0];
  const frameNumber = parts[1];

  console.log(`   --> Video Code: ${videoCode} | Frame Number (n): ${frameNumber}`);
  return { videoCode, frameNumber };
}

/**
 * Gửi request submit payload lên DRES Server
 */
async function submitToBackend(payload) {
  const evaluationId = await getActiveEvaluationId();
  const submitUrl = `${BASE_URL}/api/v2/submit/${evaluationId}?session=${sessionId}`;

  console.log("%c[SUBMIT API] Đang gửi Payload lên DRES Server...", "color: #eab308; font-weight: bold;");
  console.log("   --> Endpoint:", submitUrl);
  console.log("   --> Payload Body:", JSON.stringify(payload, null, 2));

  const response = await fetch(submitUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const responseText = await response.text();

  if (!response.ok) {
    console.error(`%c[SUBMIT API ERROR] Status ${response.status}`, "color: #ef4444; font-weight: bold;");
    console.error("   --> Response Raw:", responseText);
    throw new Error(`Submit failed (${response.status}): ${responseText}`);
  }

  let resultData;
  try {
    resultData = JSON.parse(responseText);
  } catch (e) {
    console.warn("[SUBMIT API] Server phản hồi không phải dạng JSON thuần:", responseText);
    resultData = responseText;
  }

  console.log("%c[SUBMIT API] Phản hồi từ Server:", "color: #22c55e; font-weight: bold;", resultData);
  return resultData;
}

/**
 * Xử lý chính khi bấm nút Submit
 */
async function handleSubmit(imageData, currentQuery) {
  console.group("%c🚀 BẮT ĐẦU TIẾN TRÌNH SUBMIT", "color: #06b6d4; font-size: 12px; font-weight: bold;");

  const rawImageId = imageData.imageId || imageData.image_id;
  console.log("1. Dữ liệu đầu vào (imageData):", imageData);
  console.log("2. Query tìm kiếm hiện tại:", currentQuery);

  try {
    // 1. Parse Image ID
    const { videoCode, frameNumber } = parseImageId(rawImageId);

    // 2. Tra cứu CSV
    const fps = await getFrameIdxFromCSV(videoCode, frameNumber);
    const startMs = (frameNumber / fps) * 1000;
    const endMs = startMs + 50;
    console.log("[SUBMIT TKIS] video = ", videoCode, " fps = ", fps, " frameNumber = ", frameNumber, "startMs = ", startMs, " endMs = ", endMs);
    // 3. Tạo Payload KIS
    const payload = {
      answerSets: [
        {
          answers: [
            {
              mediaItemName: videoCode,
              start: startMs,
              end: endMs
            }
          ]
        }
      ]
    };

    // 4. Gửi Request
    const result = await submitToBackend(payload);

    // 5. Lưu lịch sử
    const entry = {
      rawImageId,
      videoCode,
      payload,
      status: "success",
      response: result,
      timestamp: new Date().toISOString()
    };
    saveHistoryEntry(entry);

    console.log("%c✅ SUBMIT HOÀN TẤT THÀNH CÔNG!", "color: #22c55e; font-size: 13px; font-weight: bold;");
    console.groupEnd();

    return { success: true, message: "Submitted successfully", result };
  } catch (err) {
    console.error("%c❌ SUBMIT THẤT BẠI:", "color: #ef4444; font-size: 13px; font-weight: bold;", err.message);

    const entry = {
      rawImageId,
      status: "error",
      error: err.message,
      timestamp: new Date().toISOString()
    };
    saveHistoryEntry(entry);

    console.groupEnd();
    return { success: false, message: err.message };
  }
}

/* LocalStorage History Handlers */
function loadSubmissionHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistoryEntry(entry) {
  const history = loadSubmissionHistory();
  history.unshift(entry);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    console.log("[STORAGE] Đã lưu thông tin lượt submit vào LocalStorage.");
  } catch (e) {
    console.warn("Failed to save submission history:", e);
  }
}

function getSubmissionHistory() {
  return loadSubmissionHistory();
}

function clearSubmissionHistory() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    console.log("[STORAGE] Đã xóa lịch sử submit.");
  } catch (e) {
    console.warn("Failed to clear history", e);
  }
}