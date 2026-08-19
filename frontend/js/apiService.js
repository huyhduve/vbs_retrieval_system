/**
 * apiService.js
 * --------------
 * Raw API communication layer.
 * All HTTP requests to the backend are defined here.
 * On each call, one base URL is chosen at random from CONFIG.BASE_URLS
 * for load-spreading across multiple backend instances.
 */

/**
 * Search for images using the current text fields and slider scores.
 * @param {{\
 *   text: string, textScore: number,
 *   ocr: string, ocrScore: number,
 *   asr: string, asrScore: number,
 *   topK: number
 * }} searchInput - Current UI values at the moment Search is pressed.
 * @returns {Promise<{results: Array<{image_id: string}>}>}
 */
async function searchImages(searchInput) {
  const base = getRandomBaseUrl();
  const url = `${base}${CONFIG.ENDPOINTS.SEARCH}`;
  console.log(`[API] searchImages → ${url}`);

  const response = await fetch(url, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": true
    },
    body: JSON.stringify({
      text: searchInput.text,
      text_score: searchInput.textScore,
      ocr: searchInput.ocr,
      ocr_score: searchInput.ocrScore,
      asr: searchInput.asr,
      asr_score: searchInput.asrScore,
      top_k: searchInput.topK,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Search failed (${response.status}): ${errorBody}`);
  }

  return response.json();
}

/**
 * Check backend health status.
 * @returns {Promise<object>}
 */
async function checkHealth() {
  const base = getRandomBaseUrl();
  const url = `${base}${CONFIG.ENDPOINTS.HEALTH}`;
  console.log(`[API] checkHealth → ${url}`);

  const response = await fetch(url, { method: "GET" });

  if (!response.ok) {
    throw new Error(`Health check failed (${response.status})`);
  }

  return response.json();
}

/**
 * Submit a selected image to the backend.
 * @param {object} payload - Submission data ({ image_id, query, ... }).
 * @returns {Promise<object>}
 */
async function submitToBackend(payload) {
  const base = getRandomBaseUrl();
  const url = `${base}${CONFIG.ENDPOINTS.SUBMIT}`;
  console.log(`[API] submitToBackend → ${url}`);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Submit failed (${response.status}): ${errorBody}`);
  }

  return response.json();
}
