/**
 * Caching utility for Techs
 * Implements cache-aside pattern with Redis
 */

const { client } = require('../utils/redisClient');
const createLogger = require('../utils/logger');
const { CACHE_TTL } = require('./cacheConfig');

const logger = createLogger('TECH_CACHE');

// Cache configuration
const CACHE_CONFIG = {
  // TTL in seconds (from unified config)
  TECH_TTL: CACHE_TTL.ITEM,
  TECH_LIST_TTL: CACHE_TTL.LIST,
  TECH_COUNT_TTL: CACHE_TTL.COUNT,
  TECH_SEARCH_TTL: CACHE_TTL.SEARCH,
  // Key prefixes
  PREFIX: {
    TECH: 'tech',
    TECH_LIST: 'techs:list',
    TECH_COUNT: 'techs:count',
    TECH_NAME: 'tech:name',
    TECH_SEARCH: 'techs:search',
  },
};

/**
 * Generate cache key for a single tech
 * @param {string} techId - Tech UUID
 * @returns {string} Cache key
 */
const getTechKey = (techId) => `${CACHE_CONFIG.PREFIX.TECH}:${techId}`;

/**
 * Generate cache key for paginated tech list
 * @param {number} page - Page number
 * @param {number} pageSize - Page size
 * @param {string} search - Search term
 * @returns {string} Cache key
 */
const getTechListKey = (page, pageSize, search = '') =>
  `${CACHE_CONFIG.PREFIX.TECH_LIST}:page:${page}:pageSize:${pageSize}:search:${search.toLowerCase().trim()}`;

/**
 * Generate cache key for tech count
 * @param {string} search - Search term
 * @returns {string} Cache key
 */
const getTechCountKey = (search = '') =>
  `${CACHE_CONFIG.PREFIX.TECH_COUNT}:search:${search.toLowerCase().trim()}`;

/**
 * Generate cache key for tech name lookup
 * @param {string} name - Tech name (normalized)
 * @returns {string} Cache key
 */
const getTechNameKey = (name) => `${CACHE_CONFIG.PREFIX.TECH_NAME}:${name.toLowerCase().trim()}`;

/**
 * Generate cache key for tech search
 * @param {string} searchTerm - Search term
 * @returns {string} Cache key
 */
const _getTechSearchKey = (searchTerm) =>
  `${CACHE_CONFIG.PREFIX.TECH_SEARCH}:${searchTerm.toLowerCase().trim()}`;

/**
 * Get cached tech by ID
 * @param {string} techId - Tech UUID
 * @returns {Object|null} Cached tech or null
 */
const getCachedTech = async (techId) => {
  try {
    const key = getTechKey(techId);
    const cached = await client.get(key);

    if (cached) {
      logger.info(`Cache HIT for tech: ${techId}`);
      return JSON.parse(cached);
    }

    logger.info(`Cache MISS for tech: ${techId}`);
    return null;
  } catch (error) {
    logger.warn(`Error reading from cache for tech ${techId}: ${error.message}`);
    return null;
  }
};

/**
 * Cache a tech by ID
 * @param {string} techId - Tech UUID
 * @param {Object} tech - Tech object
 * @returns {Promise<void>}
 */
const cacheTech = async (techId, tech) => {
  try {
    const key = getTechKey(techId);
    await client.setex(key, CACHE_CONFIG.TECH_TTL, JSON.stringify(tech));
    logger.info(`Cached tech: ${techId}`);
  } catch (error) {
    logger.warn(`Error caching tech ${techId}: ${error.message}`);
  }
};

/**
 * Get cached paginated tech list
 * @param {number} page - Page number
 * @param {number} pageSize - Page size
 * @param {string} search - Search term
 * @returns {Object|null} Cached paginated result or null
 */
const getCachedTechList = async (page, pageSize, search = '') => {
  try {
    const key = getTechListKey(page, pageSize, search);
    const cached = await client.get(key);

    if (cached) {
      logger.info(
        `Cache HIT for tech list: page ${page}, pageSize ${pageSize}, search "${search}"`
      );
      return JSON.parse(cached);
    }

    logger.info(`Cache MISS for tech list: page ${page}, pageSize ${pageSize}, search "${search}"`);
    return null;
  } catch (error) {
    logger.warn(`Error reading from cache for tech list: ${error.message}`);
    return null;
  }
};

/**
 * Cache paginated tech list
 * @param {number} page - Page number
 * @param {number} pageSize - Page size
 * @param {string} search - Search term
 * @param {Object} data - Paginated result object
 * @returns {Promise<void>}
 */
const cacheTechList = async (page, pageSize, search, data) => {
  try {
    const key = getTechListKey(page, pageSize, search);
    await client.setex(key, CACHE_CONFIG.TECH_LIST_TTL, JSON.stringify(data));
    logger.info(`Cached tech list: page ${page}, pageSize ${pageSize}, search "${search}"`);
  } catch (error) {
    logger.warn(`Error caching tech list: ${error.message}`);
  }
};

/**
 * Get cached total tech count
 * @param {string} search - Search term
 * @returns {number|null} Cached count or null
 */
const getCachedTechCount = async (search = '') => {
  try {
    const key = getTechCountKey(search);
    const cached = await client.get(key);

    if (cached) {
      logger.info(`Cache HIT for tech count: search "${search}"`);
      return parseInt(cached, 10);
    }

    logger.info(`Cache MISS for tech count: search "${search}"`);
    return null;
  } catch (error) {
    logger.warn(`Error reading from cache for tech count: ${error.message}`);
    return null;
  }
};

/**
 * Cache total tech count
 * @param {number} count - Total count
 * @param {string} search - Search term
 * @returns {Promise<void>}
 */
const cacheTechCount = async (count, search = '') => {
  try {
    const key = getTechCountKey(search);
    await client.setex(key, CACHE_CONFIG.TECH_COUNT_TTL, count.toString());
    logger.info(`Cached tech count: ${count}, search "${search}"`);
  } catch (error) {
    logger.warn(`Error caching tech count: ${error.message}`);
  }
};

/**
 * Invalidate all tech-related caches
 * Called when a tech is created, updated, or deleted
 * @returns {Promise<void>}
 */
const invalidateAllTechCaches = async () => {
  try {
    const patterns = [
      `${CACHE_CONFIG.PREFIX.TECH}:*`,
      `${CACHE_CONFIG.PREFIX.TECH_LIST}:*`,
      `${CACHE_CONFIG.PREFIX.TECH_COUNT}:*`,
      `${CACHE_CONFIG.PREFIX.TECH_NAME}:*`,
      `${CACHE_CONFIG.PREFIX.TECH_SEARCH}:*`,
    ];

    for (const pattern of patterns) {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(...keys);
        logger.info(`Invalidated ${keys.length} cache keys matching pattern: ${pattern}`);
      }
    }
  } catch (error) {
    logger.warn(`Error invalidating tech caches: ${error.message}`);
  }
};

/**
 * Invalidate a specific tech cache
 * @param {string} techId - Tech UUID
 * @returns {Promise<void>}
 */
const invalidateTechCache = async (techId) => {
  try {
    const key = getTechKey(techId);
    await client.del(key);
    logger.info(`Invalidated cache for tech: ${techId}`);
  } catch (error) {
    logger.warn(`Error invalidating tech cache ${techId}: ${error.message}`);
  }
};

/**
 * Invalidate tech name cache
 * @param {string} name - Tech name (normalized)
 * @returns {Promise<void>}
 */
const invalidateTechNameCache = async (name) => {
  try {
    const key = getTechNameKey(name);
    await client.del(key);
    logger.info(`Invalidated cache for tech name: ${name}`);
  } catch (error) {
    logger.warn(`Error invalidating tech name cache: ${error.message}`);
  }
};

/**
 * Cache tech name lookup (for duplicate checking)
 * @param {string} name - Tech name
 * @param {string|null} techId - Tech ID if exists, null otherwise
 * @returns {Promise<void>}
 */
const cacheTechNameLookup = async (name, techId) => {
  try {
    const key = getTechNameKey(name);
    await client.setex(key, CACHE_TTL.NAME_LOOKUP, techId || '');
    logger.info(`Cached tech name lookup: ${name}`);
  } catch (error) {
    logger.warn(`Error caching tech name lookup: ${error.message}`);
  }
};

/**
 * Get cached tech name lookup
 * @param {string} name - Tech name
 * @returns {Promise<string|null>} Cached tech ID or null
 */
const getCachedTechNameLookup = async (name) => {
  try {
    const key = getTechNameKey(name);
    const cached = await client.get(key);

    if (cached !== null) {
      logger.info(`Cache HIT for tech name lookup: ${name}`);
      return cached === '' ? null : cached;
    }

    logger.info(`Cache MISS for tech name lookup: ${name}`);
    return null;
  } catch (error) {
    logger.warn(`Error reading from cache for tech name lookup: ${error.message}`);
    return null;
  }
};

module.exports = {
  // Get operations
  getCachedTech,
  getCachedTechList,
  getCachedTechCount,
  getCachedTechNameLookup,
  // Set operations
  cacheTech,
  cacheTechList,
  cacheTechCount,
  cacheTechNameLookup,
  // Invalidation operations
  invalidateAllTechCaches,
  invalidateTechCache,
  invalidateTechNameCache,
  // Configuration
  CACHE_CONFIG,
};
