// utils/cacheConfig.js
/**
 * Unified cache TTL configuration using environment variables
 * Provides default values and centralized configuration for all cache modules
 */

/**
 * Get cache TTL from environment variable or use default
 * @param {string} envVar - Environment variable name
 * @param {number} defaultValue - Default value in seconds
 * @returns {number} TTL in seconds
 */
const getCacheTTL = (envVar, defaultValue) => {
  const value = process.env[envVar];
  if (value) {
    const parsed = parseInt(value, 10);
    return !isNaN(parsed) && parsed > 0 ? parsed : defaultValue;
  }
  return defaultValue;
};

// Cache TTL configuration (in seconds)
const CACHE_TTL = {
  // Individual item cache (single blog, skill, etc.)
  ITEM: getCacheTTL('CACHE_TTL_ITEM', 3600), // 1 hour default

  // List cache (paginated results)
  LIST: getCacheTTL('CACHE_TTL_LIST', 1800), // 30 minutes default

  // Count cache (total counts)
  COUNT: getCacheTTL('CACHE_TTL_COUNT', 3600), // 1 hour default

  // Name lookup cache (for duplicate checking)
  NAME_LOOKUP: getCacheTTL('CACHE_TTL_NAME_LOOKUP', 300), // 5 minutes default
};

module.exports = {
  CACHE_TTL,
  getCacheTTL,
};
