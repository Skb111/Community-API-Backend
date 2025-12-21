/**
 * Project service - Read operations with caching
 * Write operations are in projectCreate.js, projectUpdate.js, projectManagement.js
 */

const createLogger = require('../../utils/logger');
const { NotFoundError, InternalServerError } = require('../../utils/customErrors');
const { Project, User, Tech } = require('../../models');
const {
  getCachedProject,
  cacheProject,
  getCachedProjectList,
  cacheProjectList,
  getCachedProjectCount,
  cacheProjectCount,
} = require('../../cache/projectCache');
const {
  buildWhereClause,
  buildFilters,
  fetchProjectsFromDB,
  fetchProjectRowsFromDB,
} = require('./projectQueries');

// Import operation modules
const { createProject } = require('./projectCreate');
const { updateProject, deleteProject } = require('./projectUpdate');
const {
  addTechsToProject,
  removeTechsFromProject,
  addContributorsToProject,
  removeContributorsFromProject,
} = require('./projectManagement');

const logger = createLogger('PROJECT_SERVICE');

/**
 * Get all projects with pagination and filtering (with caching)
 */
const getAllProjects = async (options = {}) => {
  try {
    const page = parseInt(options.page, 10) || 1;
    const pageSize = Math.min(parseInt(options.pageSize, 10) || 10, 100);

    // Build filters object for cache key
    const filters = buildFilters(options);

    // Try to get from cache first
    const cachedResult = await getCachedProjectList(page, pageSize, filters);
    if (cachedResult) {
      return cachedResult;
    }

    // Cache miss - fetch from database
    const where = buildWhereClause(options);

    // Try to get count from cache first
    let totalCount = await getCachedProjectCount(filters);
    let count;
    let rows;

    if (totalCount === null) {
      // Fetch count and rows from database
      const result = await fetchProjectsFromDB(options, where);
      count = result.count;
      rows = result.rows;
      totalCount = count;
      // Cache the count for future use
      await cacheProjectCount(totalCount, filters);
    } else {
      count = totalCount;
      // Fetch only the rows (count is cached)
      rows = await fetchProjectRowsFromDB(options, where);
    }

    const totalPages = Math.ceil(count / pageSize);

    const result = {
      projects: rows,
      pagination: {
        page,
        pageSize,
        totalItems: count,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };

    // Cache the result for future requests
    await cacheProjectList(page, pageSize, filters, result);

    logger.info(`Retrieved ${rows.length} projects`, { page, pageSize, total: count });

    return result;
  } catch (err) {
    logger.error(`Error retrieving projects: ${err.message}`, { error: err });
    throw new InternalServerError(`Failed to retrieve projects: ${err.message}`);
  }
};

/**
 * Get a single project by ID (with caching)
 */
const getProjectById = async (projectId) => {
  try {
    // Try to get from cache first
    const cachedProject = await getCachedProject(projectId);
    if (cachedProject) {
      return cachedProject;
    }

    // Cache miss - fetch from database
    logger.info(`Retrieving project ${projectId}`);

    const project = await Project.findByPk(projectId, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'fullname', 'email', 'profilePicture'],
        },
        {
          model: Tech,
          as: 'techs',
          attributes: ['id', 'name', 'icon'],
          through: { attributes: [] },
        },
        {
          model: User,
          as: 'contributors',
          attributes: ['id', 'fullname', 'email', 'profilePicture'],
          through: { attributes: [] },
        },
      ],
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    // Cache the project for future requests
    await cacheProject(projectId, project);

    return project;
  } catch (err) {
    if (err instanceof NotFoundError) {
      throw err;
    }

    logger.error(`Error retrieving project ${projectId}: ${err.message}`, { error: err });
    throw new InternalServerError(`Failed to retrieve project: ${err.message}`);
  }
};

module.exports = {
  // Read operations
  getAllProjects,
  getProjectById,

  // Write operations (delegated to separate modules)
  createProject,
  updateProject,
  deleteProject,

  // Management operations
  addTechsToProject,
  removeTechsFromProject,
  addContributorsToProject,
  removeContributorsFromProject,
};
