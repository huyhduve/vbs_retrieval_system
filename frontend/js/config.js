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
    "http://127.0.0.1:8000",
    "http://127.0.0.1:8000",
    "http://127.0.0.1:8000",
  ],

  ENDPOINTS: {
    SEARCH: "/api/v1/search",
    HEALTH: "/api/v1/health",
    SUBMIT: "/api/v1/submit",
  },

  DATA_PATH: "/data/keyframes",

  DEFAULTS: {
    TOP_K: 100,
    TOP_K_MIN: 1,
    TOP_K_MAX: 200,
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
