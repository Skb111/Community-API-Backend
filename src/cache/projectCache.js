/**
 * Caching utility for Projects
 * Implements cache-aside pattern with Redis
 */

const { client } = require('../utils/redisClient');
const createLogger = require('../utils/logger');
const { CACHE_TTL } = require('./cacheConfig');

const logger = createLogger('PROJECT_CACHE');

// Cache configuration
const CACHE_CONFIG = {
  // TTL in seconds
  PROJECT_TTL: CACHE_TTL.ITEM,
  PROJECT_LIST_TTL: CACHE_TTL.LIST,
  PROJECT_COUNT_TTL: CACHE_TTL.COUNT,
  PROJECT_SEARCH_TTL: CACHE_TTL.SEARCH,
  // Key prefixes
  PREFIX: {
    PROJECT: 'project',
    PROJECT_LIST: 'projects:list',
    PROJECT_COUNT: 'projects:count',
    PROJECT_USER: 'projects:user',
    PROJECT_TECH: 'projects:tech',
  },
};

/**
 * Generate cache key for a single project
 * @param {string} projectId - Project UUID
 * @returns {string} Cache key
 */
const getProjectKey = (projectId) => `${CACHE_CONFIG.PREFIX.PROJECT}:${projectId}`;

/**
 * Generate cache key for paginated project list
 * @param {number} page - Page number
 * @param {number} pageSize - Page size
 * @param {Object} filters - Filter parameters
 * @returns {string} Cache key
 */
const getProjectListKey = (page, pageSize, filters = {}) => {
  const filterStr = Object.entries(filters)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join(':');
  return `${CACHE_CONFIG.PREFIX.PROJECT_LIST}:page:${page}:pageSize:${pageSize}:${filterStr}`;
};

/**
 * Generate cache key for project count
 * @param {Object} filters - Filter parameters
 * @returns {string} Cache key
 */
const getProjectCountKey = (filters = {}) => {
  const filterStr = Object.entries(filters)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join(':');
  return `${CACHE_CONFIG.PREFIX.PROJECT_COUNT}:${filterStr}`;
};

/**
 * Generate cache key for user's projects
 * @param {string} userId - User UUID
 * @param {number} page - Page number
 * @param {number} pageSize - Page size
 * @returns {string} Cache key
 */
const getUserProjectsKey = (userId, page, pageSize) =>
  `${CACHE_CONFIG.PREFIX.PROJECT_USER}:${userId}:page:${page}:pageSize:${pageSize}`;

/**
 * Generate cache key for projects by tech
 * @param {string} techId - Tech UUID
 * @param {number} page - Page number
 * @param {number} pageSize - Page size
 * @returns {string} Cache key
 */
const getTechProjectsKey = (techId, page, pageSize) =>
  `${CACHE_CONFIG.PREFIX.PROJECT_TECH}:${techId}:page:${page}:pageSize:${pageSize}`;

/**
 * Get cached project by ID
 * @param {string} projectId - Project UUID
 * @returns {Object|null} Cached project or null
 */
const getCachedProject = async (projectId) => {
  try {
    const key = getProjectKey(projectId);
    const cached = await client.get(key);

    if (cached) {
      logger.info(`Cache HIT for project: ${projectId}`);
      return JSON.parse(cached);
    }

    logger.info(`Cache MISS for project: ${projectId}`);
    return null;
  } catch (error) {
    logger.warn(`Error reading from cache for project ${projectId}: ${error.message}`);
    return null;
  }
};

/**
 * Cache a project by ID
 * @param {string} projectId - Project UUID
 * @param {Object} project - Project object
 * @returns {Promise<void>}
 */
const cacheProject = async (projectId, project) => {
  try {
    const key = getProjectKey(projectId);
    await client.setex(key, CACHE_CONFIG.PROJECT_TTL, JSON.stringify(project));
    logger.info(`Cached project: ${projectId}`);
  } catch (error) {
    logger.warn(`Error caching project ${projectId}: ${error.message}`);
  }
};

/**
 * Get cached paginated project list
 * @param {number} page - Page number
 * @param {number} pageSize - Page size
 * @param {Object} filters - Filter parameters
 * @returns {Object|null} Cached paginated result or null
 */
const getCachedProjectList = async (page, pageSize, filters = {}) => {
  try {
    const key = getProjectListKey(page, pageSize, filters);
    const cached = await client.get(key);

    if (cached) {
      logger.info(
        `Cache HIT for project list: page ${page}, pageSize ${pageSize}, filters ${JSON.stringify(filters)}`
      );
      return JSON.parse(cached);
    }

    logger.info(
      `Cache MISS for project list: page ${page}, pageSize ${pageSize}, filters ${JSON.stringify(filters)}`
    );
    return null;
  } catch (error) {
    logger.warn(`Error reading from cache for project list: ${error.message}`);
    return null;
  }
};

/**
 * Cache paginated project list
 * @param {number} page - Page number
 * @param {number} pageSize - Page size
 * @param {Object} filters - Filter parameters
 * @param {Object} data - Paginated result object
 * @returns {Promise<void>}
 */
const cacheProjectList = async (page, pageSize, filters, data) => {
  try {
    const key = getProjectListKey(page, pageSize, filters);
    await client.setex(key, CACHE_CONFIG.PROJECT_LIST_TTL, JSON.stringify(data));
    logger.info(
      `Cached project list: page ${page}, pageSize ${pageSize}, filters ${JSON.stringify(filters)}`
    );
  } catch (error) {
    logger.warn(`Error caching project list: ${error.message}`);
  }
};

/**
 * Get cached total project count
 * @param {Object} filters - Filter parameters
 * @returns {number|null} Cached count or null
 */
const getCachedProjectCount = async (filters = {}) => {
  try {
    const key = getProjectCountKey(filters);
    const cached = await client.get(key);

    if (cached) {
      logger.info(`Cache HIT for project count: filters ${JSON.stringify(filters)}`);
      return parseInt(cached, 10);
    }

    logger.info(`Cache MISS for project count: filters ${JSON.stringify(filters)}`);
    return null;
  } catch (error) {
    logger.warn(`Error reading from cache for project count: ${error.message}`);
    return null;
  }
};

/**
 * Cache total project count
 * @param {number} count - Total count
 * @param {Object} filters - Filter parameters
 * @returns {Promise<void>}
 */
const cacheProjectCount = async (count, filters = {}) => {
  try {
    const key = getProjectCountKey(filters);
    await client.setex(key, CACHE_CONFIG.PROJECT_COUNT_TTL, count.toString());
    logger.info(`Cached project count: ${count}, filters ${JSON.stringify(filters)}`);
  } catch (error) {
    logger.warn(`Error caching project count: ${error.message}`);
  }
};

/**
 * Get cached user projects
 * @param {string} userId - User UUID
 * @param {number} page - Page number
 * @param {number} pageSize - Page size
 * @returns {Object|null} Cached result or null
 */
const getCachedUserProjects = async (userId, page, pageSize) => {
  try {
    const key = getUserProjectsKey(userId, page, pageSize);
    const cached = await client.get(key);

    if (cached) {
      logger.info(
        `Cache HIT for user projects: user ${userId}, page ${page}, pageSize ${pageSize}`
      );
      return JSON.parse(cached);
    }

    logger.info(`Cache MISS for user projects: user ${userId}, page ${page}, pageSize ${pageSize}`);
    return null;
  } catch (error) {
    logger.warn(`Error reading from cache for user projects: ${error.message}`);
    return null;
  }
};

/**
 * Cache user projects
 * @param {string} userId - User UUID
 * @param {number} page - Page number
 * @param {number} pageSize - Page size
 * @param {Object} data - Result object
 * @returns {Promise<void>}
 */
const cacheUserProjects = async (userId, page, pageSize, data) => {
  try {
    const key = getUserProjectsKey(userId, page, pageSize);
    await client.setex(key, CACHE_CONFIG.PROJECT_LIST_TTL, JSON.stringify(data));
    logger.info(`Cached user projects: user ${userId}, page ${page}, pageSize ${pageSize}`);
  } catch (error) {
    logger.warn(`Error caching user projects: ${error.message}`);
  }
};

/**
 * Get cached tech projects
 * @param {string} techId - Tech UUID
 * @param {number} page - Page number
 * @param {number} pageSize - Page size
 * @returns {Object|null} Cached result or null
 */
const getCachedTechProjects = async (techId, page, pageSize) => {
  try {
    const key = getTechProjectsKey(techId, page, pageSize);
    const cached = await client.get(key);

    if (cached) {
      logger.info(
        `Cache HIT for tech projects: tech ${techId}, page ${page}, pageSize ${pageSize}`
      );
      return JSON.parse(cached);
    }

    logger.info(`Cache MISS for tech projects: tech ${techId}, page ${page}, pageSize ${pageSize}`);
    return null;
  } catch (error) {
    logger.warn(`Error reading from cache for tech projects: ${error.message}`);
    return null;
  }
};

/**
 * Cache tech projects
 * @param {string} techId - Tech UUID
 * @param {number} page - Page number
 * @param {number} pageSize - Page size
 * @param {Object} data - Result object
 * @returns {Promise<void>}
 */
const cacheTechProjects = async (techId, page, pageSize, data) => {
  try {
    const key = getTechProjectsKey(techId, page, pageSize);
    await client.setex(key, CACHE_CONFIG.PROJECT_LIST_TTL, JSON.stringify(data));
    logger.info(`Cached tech projects: tech ${techId}, page ${page}, pageSize ${pageSize}`);
  } catch (error) {
    logger.warn(`Error caching tech projects: ${error.message}`);
  }
};

/**
 * Invalidate all project-related caches
 * Called when a project is created, updated, or deleted
 * @returns {Promise<void>}
 */
const invalidateAllProjectCaches = async () => {
  try {
    const patterns = [
      `${CACHE_CONFIG.PREFIX.PROJECT}:*`,
      `${CACHE_CONFIG.PREFIX.PROJECT_LIST}:*`,
      `${CACHE_CONFIG.PREFIX.PROJECT_COUNT}:*`,
      `${CACHE_CONFIG.PREFIX.PROJECT_USER}:*`,
      `${CACHE_CONFIG.PREFIX.PROJECT_TECH}:*`,
    ];

    for (const pattern of patterns) {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(...keys);
        logger.info(`Invalidated ${keys.length} cache keys matching pattern: ${pattern}`);
      }
    }
  } catch (error) {
    logger.warn(`Error invalidating project caches: ${error.message}`);
  }
};

/**
 * Invalidate a specific project cache
 * @param {string} projectId - Project UUID
 * @returns {Promise<void>}
 */
const invalidateProjectCache = async (projectId) => {
  try {
    const key = getProjectKey(projectId);
    await client.del(key);
    logger.info(`Invalidated cache for project: ${projectId}`);
  } catch (error) {
    logger.warn(`Error invalidating project cache ${projectId}: ${error.message}`);
  }
};

/**
 * Invalidate user's project caches
 * @param {string} userId - User UUID
 * @returns {Promise<void>}
 */
const invalidateUserProjectCaches = async (userId) => {
  try {
    const pattern = getUserProjectsKey(userId, '*', '*').replace(/:\*:\*/g, ':*');
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
      logger.info(`Invalidated ${keys.length} cache keys for user: ${userId}`);
    }
  } catch (error) {
    logger.warn(`Error invalidating user project caches: ${error.message}`);
  }
};

/**
 * Invalidate tech's project caches
 * @param {string} techId - Tech UUID
 * @returns {Promise<void>}
 */
const invalidateTechProjectCaches = async (techId) => {
  try {
    const pattern = getTechProjectsKey(techId, '*', '*').replace(/:\*:\*/g, ':*');
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
      logger.info(`Invalidated ${keys.length} cache keys for tech: ${techId}`);
    }
  } catch (error) {
    logger.warn(`Error invalidating tech project caches: ${error.message}`);
  }
};

module.exports = {
  // Get operations
  getCachedProject,
  getCachedProjectList,
  getCachedProjectCount,
  getCachedUserProjects,
  getCachedTechProjects,
  // Set operations
  cacheProject,
  cacheProjectList,
  cacheProjectCount,
  cacheUserProjects,
  cacheTechProjects,
  // Invalidation operations
  invalidateAllProjectCaches,
  invalidateProjectCache,
  invalidateUserProjectCaches,
  invalidateTechProjectCaches,
  // Configuration
  CACHE_CONFIG,
};
