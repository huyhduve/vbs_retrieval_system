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
      RRF: searchInput.RRF,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Search failed (${response.status}): ${errorBody}`);
  }

  return response.json();
}

/**
 * Search for visually similar images using an image_id.
 * @param {string} imageId - e.g. "L21_V001/2342.webp"
 * @returns {Promise<{results: Array<{image_id: string}>}>}
 */
async function searchSimilarImages(imageId) {
  const base = getRandomBaseUrl();
  const url = `${base}${CONFIG.ENDPOINTS.SEARCH}`;
  console.log(`[API] searchSimilarImages → ${url} with image_id: ${imageId}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": true,
    },
    body: JSON.stringify({
      image_id: imageId,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Similarity search failed (${response.status}): ${errorBody}`);
  }

  return response.json();
}

/**
 * Search for images by uploading an image file.
 * @param {File|Blob} imageFile - Image file to search with.
 * @param {number} [topK] - Number of results requested.
 * @returns {Promise<{results: Array<{image_id: string}>}>}
 */
async function searchByImage(imageFile, topK) {
  const base = getRandomBaseUrl();
  const url = `${base}${CONFIG.ENDPOINTS.SEARCH_IMAGE}`;
  console.log(`[API] searchByImage → ${url}`);

  const formData = new FormData();
  formData.append("file", imageFile);
  if (topK) {
    formData.append("top_k", topK);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "ngrok-skip-browser-warning": true,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Image search failed (${response.status}): ${errorBody}`);
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
