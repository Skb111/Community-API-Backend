// utils/blogCache.js
/**
 * Caching utility for Blogs
 * Implements cache-aside pattern with Redis
 */

const { client } = require('../utils/redisClient');
const createLogger = require('../utils/logger');
const { CACHE_TTL } = require('./cacheConfig');

const logger = createLogger('BLOG_CACHE');

// Cache configuration
const CACHE_CONFIG = {
  // TTL in seconds (from unified config)
  BLOG_TTL: CACHE_TTL.ITEM,
  BLOG_LIST_TTL: CACHE_TTL.LIST,
  BLOG_COUNT_TTL: CACHE_TTL.COUNT,
  // Key prefixes
  PREFIX: {
    BLOG: 'blog',
    BLOG_LIST: 'blogs:list',
    BLOG_COUNT: 'blogs:count',
  },
};

/**
 * Generate cache key for a single blog
 * @param {string} blogId - Blog UUID
 * @returns {string} Cache key
 */
const getBlogKey = (blogId) => `${CACHE_CONFIG.PREFIX.BLOG}:${blogId}`;

/**
 * Generate cache key for paginated blog list with filters
 * @param {number} page - Page number
 * @param {number} pageSize - Page size
 * @param {Object} filters - Filter options (featured, topic, createdBy)
 * @returns {string} Cache key
 */
const getBlogListKey = (page, pageSize, filters = {}) => {
  const filterParts = [];
  if (filters.featured !== undefined) {
    filterParts.push(`featured:${filters.featured}`);
  }
  if (filters.topic) {
    filterParts.push(`topic:${filters.topic}`);
  }
  if (filters.createdBy) {
    filterParts.push(`createdBy:${filters.createdBy}`);
  }
  const filterStr = filterParts.length > 0 ? `:${filterParts.join(':')}` : '';
  return `${CACHE_CONFIG.PREFIX.BLOG_LIST}:page:${page}:pageSize:${pageSize}${filterStr}`;
};

/**
 * Generate cache key for blog count with filters
 * @param {Object} filters - Filter options
 * @returns {string} Cache key
 */
const getBlogCountKey = (filters = {}) => {
  const filterParts = [];
  if (filters.featured !== undefined) {
    filterParts.push(`featured:${filters.featured}`);
  }
  if (filters.topic) {
    filterParts.push(`topic:${filters.topic}`);
  }
  if (filters.createdBy) {
    filterParts.push(`createdBy:${filters.createdBy}`);
  }
  const filterStr = filterParts.length > 0 ? `:${filterParts.join(':')}` : '';
  return `${CACHE_CONFIG.PREFIX.BLOG_COUNT}${filterStr}`;
};

/**
 * Get cached blog by ID
 * @param {string} blogId - Blog UUID
 * @returns {Object|null} Cached blog or null
 */
const getCachedBlog = async (blogId) => {
  try {
    const key = getBlogKey(blogId);
    const cached = await client.get(key);

    if (cached) {
      logger.info(`Cache HIT for blog: ${blogId}`);
      return JSON.parse(cached);
    }

    logger.info(`Cache MISS for blog: ${blogId}`);
    return null;
  } catch (error) {
    logger.warn(`Error reading from cache for blog ${blogId}: ${error.message}`);
    return null;
  }
};

/**
 * Cache a blog by ID
 * @param {string} blogId - Blog UUID
 * @param {Object} blog - Blog object
 * @returns {Promise<void>}
 */
const cacheBlog = async (blogId, blog) => {
  try {
    const key = getBlogKey(blogId);
    await client.setex(key, CACHE_CONFIG.BLOG_TTL, JSON.stringify(blog));
    logger.info(`Cached blog: ${blogId}`);
  } catch (error) {
    logger.warn(`Error caching blog ${blogId}: ${error.message}`);
  }
};

/**
 * Get cached paginated blog list
 * @param {number} page - Page number
 * @param {number} pageSize - Page size
 * @param {Object} filters - Filter options
 * @returns {Object|null} Cached paginated result or null
 */
const getCachedBlogList = async (page, pageSize, filters = {}) => {
  try {
    const key = getBlogListKey(page, pageSize, filters);
    const cached = await client.get(key);

    if (cached) {
      logger.info(`Cache HIT for blog list: page ${page}, pageSize ${pageSize}`);
      return JSON.parse(cached);
    }

    logger.info(`Cache MISS for blog list: page ${page}, pageSize ${pageSize}`);
    return null;
  } catch (error) {
    logger.warn(`Error reading from cache for blog list: ${error.message}`);
    return null;
  }
};

/**
 * Cache paginated blog list
 * @param {number} page - Page number
 * @param {number} pageSize - Page size
 * @param {Object} filters - Filter options
 * @param {Object} data - Paginated result object
 * @returns {Promise<void>}
 */
const cacheBlogList = async (page, pageSize, filters, data) => {
  try {
    const key = getBlogListKey(page, pageSize, filters);
    await client.setex(key, CACHE_CONFIG.BLOG_LIST_TTL, JSON.stringify(data));
    logger.info(`Cached blog list: page ${page}, pageSize ${pageSize}`);
  } catch (error) {
    logger.warn(`Error caching blog list: ${error.message}`);
  }
};

/**
 * Get cached blog count
 * @param {Object} filters - Filter options
 * @returns {number|null} Cached count or null
 */
const getCachedBlogCount = async (filters = {}) => {
  try {
    const key = getBlogCountKey(filters);
    const cached = await client.get(key);

    if (cached) {
      logger.info('Cache HIT for blog count');
      return parseInt(cached, 10);
    }

    logger.info('Cache MISS for blog count');
    return null;
  } catch (error) {
    logger.warn(`Error reading from cache for blog count: ${error.message}`);
    return null;
  }
};

/**
 * Cache blog count
 * @param {number} count - Total count
 * @param {Object} filters - Filter options
 * @returns {Promise<void>}
 */
const cacheBlogCount = async (count, filters = {}) => {
  try {
    const key = getBlogCountKey(filters);
    await client.setex(key, CACHE_CONFIG.BLOG_COUNT_TTL, count.toString());
    logger.info(`Cached blog count: ${count}`);
  } catch (error) {
    logger.warn(`Error caching blog count: ${error.message}`);
  }
};

/**
 * Invalidate all blog-related caches
 * Called when a blog is created, updated, or deleted
 * @returns {Promise<void>}
 */
const invalidateAllBlogCaches = async () => {
  try {
    const patterns = [
      `${CACHE_CONFIG.PREFIX.BLOG}:*`,
      `${CACHE_CONFIG.PREFIX.BLOG_LIST}:*`,
      `${CACHE_CONFIG.PREFIX.BLOG_COUNT}*`,
    ];

    for (const pattern of patterns) {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(...keys);
        logger.info(`Invalidated ${keys.length} cache keys matching pattern: ${pattern}`);
      }
    }
  } catch (error) {
    logger.warn(`Error invalidating blog caches: ${error.message}`);
  }
};

/**
 * Invalidate a specific blog cache
 * @param {string} blogId - Blog UUID
 * @returns {Promise<void>}
 */
const invalidateBlogCache = async (blogId) => {
  try {
    const key = getBlogKey(blogId);
    await client.del(key);
    logger.info(`Invalidated cache for blog: ${blogId}`);
  } catch (error) {
    logger.warn(`Error invalidating blog cache ${blogId}: ${error.message}`);
  }
};

module.exports = {
  // Get operations
  getCachedBlog,
  getCachedBlogList,
  getCachedBlogCount,
  // Set operations
  cacheBlog,
  cacheBlogList,
  cacheBlogCount,
  // Invalidation operations
  invalidateAllBlogCaches,
  invalidateBlogCache,
  // Configuration
  CACHE_CONFIG,
};
