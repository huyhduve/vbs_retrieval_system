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
    // "https://eating-stingily-sponge.ngrok-free.dev",
    // "https://eating-stingily-sponge.ngrok-free.dev",
    // "https://eating-stingily-sponge.ngrok-free.dev",
      // "http://127.0.0.1:8000", 
      // 
      // 
      // "https://madonna-yards-fisheries-cartridges.trycloudflare.com",
      // "https://madonna-yards-fisheries-cartridges.trycloudflare.com",
      "http://127.0.0.1:8000"
      
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
});

/**
 * Return a random base URL from CONFIG.BASE_URLS.
 * @returns {string}
 */
function getRandomBaseUrl() {
  const urls = CONFIG.BASE_URLS;
  return urls[Math.floor(Math.random() * urls.length)];
}
