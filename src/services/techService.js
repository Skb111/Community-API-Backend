const createLogger = require('../utils/logger');
const {
  ValidationError,
  NotFoundError,
  ConflictError,
  InternalServerError,
} = require('../utils/customErrors');
const { Tech, sequelize, Sequelize } = require('../models');
const {
  getCachedTech,
  cacheTech,
  getCachedTechList,
  cacheTechList,
  getCachedTechCount,
  cacheTechCount,
  invalidateAllTechCaches,
  invalidateTechNameCache,
  getCachedTechNameLookup,
  cacheTechNameLookup,
} = require('../cache/techCache');

const logger = createLogger('TECH_SERVICE');
const Op = Sequelize.Op; // Get the Op operator

/**
 * Get all techs with pagination and search (with caching)
 * @param {Object} options - Options { page, pageSize, search }
 * @returns {Object} Paginated techs result with metadata
 */
const getAllTechs = async (options = {}) => {
  try {
    const { page = 1, pageSize = 10, search = '' } = options;

    // Try to get from cache first
    const cachedResult = await getCachedTechList(page, pageSize, search);
    if (cachedResult) {
      return cachedResult;
    }

    // Cache miss - fetch from database
    const offset = (page - 1) * pageSize;
    const whereClause = {};

    // Add search filter if provided
    if (search && search.trim() !== '') {
      whereClause.name = {
        [Op.iLike]: `%${search.trim()}%`,
      };
    }

    // Try to get count from cache first
    let totalCount = await getCachedTechCount(search);
    if (totalCount === null) {
      totalCount = await Tech.count({ where: whereClause });
      // Cache the count for future use
      await cacheTechCount(totalCount, search);
    }

    // Fetch techs from database
    const techs = await Tech.findAll({
      where: whereClause,
      limit: parseInt(pageSize, 10),
      offset: parseInt(offset, 10),
      order: [['name', 'ASC']], // Order alphabetically by name
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / pageSize);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    const result = {
      success: true,
      data: techs,
      pagination: {
        page: parseInt(page, 10),
        pageSize: parseInt(pageSize, 10),
        totalItems: totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
        search: search.trim(),
      },
    };

    // Cache the result for future requests
    await cacheTechList(page, pageSize, search, result);

    logger.info(`Retrieved ${techs.length} techs (page ${page} of ${totalPages})`);

    return result;
  } catch (error) {
    logger.error(`Error fetching techs: ${error.message}`);
    throw new InternalServerError('Failed to fetch techs');
  }
};

/**
 * Get a single tech by ID (with caching)
 * @param {string} techId - Tech UUID
 * @returns {Object} Tech object
 */
const getTechById = async (techId) => {
  try {
    // Try to get from cache first
    const cachedTech = await getCachedTech(techId);
    if (cachedTech) {
      return cachedTech;
    }

    // Cache miss - fetch from database
    const tech = await Tech.findByPk(techId, {
      include: [
        {
          association: 'creator',
          attributes: ['username', 'email', 'profilePicture'],
        },
      ],
    });

    if (!tech) {
      logger.warn(`Tech not found: ${techId}`);
      throw new NotFoundError('Tech not found');
    }

    // Cache the tech for future requests
    await cacheTech(techId, tech);

    logger.info(`Retrieved tech: ${techId} - ${tech.name}`);
    return tech;
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    logger.error(`Error fetching tech ${techId}: ${error.message}`);
    throw new InternalServerError('Failed to fetch tech');
  }
};

/**
 * Create a new tech
 * @param {Object} techData - Tech data { name, icon, description }
 * @param {string} createdBy - User ID of creator
 * @returns {Object} Created tech
 */
const createTech = async (techData, createdBy) => {
  const transaction = await sequelize.transaction();

  try {
    const { name, icon, description } = techData;

    // Check for existing tech with same name using cache first
    const existingTechId = await getCachedTechNameLookup(name);
    if (existingTechId) {
      // Cache hit - check if tech still exists
      const existingTech = await Tech.findByPk(existingTechId);
      if (existingTech) {
        throw new ConflictError(`Tech with name "${name}" already exists`);
      }
    } else {
      // Cache miss - check database
      const existingTech = await Tech.findOne({
        where: { name },
        transaction,
      });
      if (existingTech) {
        // Cache the name lookup for future duplicate checks
        await cacheTechNameLookup(name, existingTech.id);
        throw new ConflictError(`Tech with name "${name}" already exists`);
      }
    }

    // Create the tech
    const tech = await Tech.create(
      {
        name,
        icon,
        description,
        createdBy,
      },
      { transaction }
    );

    // Cache the tech
    await cacheTech(tech.id, tech);

    // Cache the name lookup
    await cacheTechNameLookup(name, tech.id);

    // Invalidate list caches
    await invalidateAllTechCaches();

    await transaction.commit();

    logger.info(`Tech created: ${tech.id} - ${tech.name} by user: ${createdBy}`);

    return tech;
  } catch (error) {
    await transaction.rollback();

    if (error instanceof ConflictError || error instanceof ValidationError) {
      throw error;
    }

    logger.error(`Error creating tech: ${error.message}`);
    throw new InternalServerError('Failed to create tech');
  }
};

/**
 * Update an existing tech
 * @param {string} techId - Tech UUID
 * @param {Object} updateData - Update data { name, icon, description }
 * @param {string} updatedBy - User ID of updater (for logging)
 * @returns {Object} Updated tech
 */
const updateTech = async (techId, updateData, updatedBy) => {
  const transaction = await sequelize.transaction();

  try {
    const tech = await Tech.findByPk(techId, { transaction });
    if (!tech) {
      throw new NotFoundError('Tech not found');
    }

    const { name, icon, description } = updateData;

    // Check if name is being changed and if new name already exists
    if (name && name !== tech.name) {
      const existingTechId = await getCachedTechNameLookup(name);
      if (existingTechId && existingTechId !== techId) {
        // Cache hit - check if tech still exists
        const existingTech = await Tech.findByPk(existingTechId, { transaction });
        if (existingTech) {
          throw new ConflictError(`Tech with name "${name}" already exists`);
        }
      } else {
        // Cache miss - check database
        const existingTech = await Tech.findOne({
          where: { name },
          transaction,
        });
        if (existingTech && existingTech.id !== techId) {
          // Cache the name lookup for future duplicate checks
          await cacheTechNameLookup(name, existingTech.id);
          throw new ConflictError(`Tech with name "${name}" already exists`);
        }
      }

      // Invalidate old name cache
      await invalidateTechNameCache(tech.name);
    }

    // Update the tech
    const updatedTech = await tech.update(
      {
        name,
        icon,
        description,
      },
      { transaction }
    );

    // Update caches
    await cacheTech(techId, updatedTech);

    if (name && name !== tech.name) {
      await cacheTechNameLookup(name, techId);
    }

    // Invalidate list caches
    await invalidateAllTechCaches();

    await transaction.commit();

    logger.info(`Tech updated: ${techId} - ${tech.name} by user: ${updatedBy}`);

    return updatedTech;
  } catch (error) {
    await transaction.rollback();

    if (
      error instanceof NotFoundError ||
      error instanceof ConflictError ||
      error instanceof ValidationError
    ) {
      throw error;
    }

    logger.error(`Error updating tech ${techId}: ${error.message}`);
    throw new InternalServerError('Failed to update tech');
  }
};

/**
 * Delete a tech (soft delete)
 * @param {string} techId - Tech UUID
 * @param {string} deletedBy - User ID of deleter (for logging)
 * @returns {boolean} True if deleted successfully
 */
const deleteTech = async (techId, deletedBy) => {
  try {
    const tech = await Tech.findByPk(techId);

    if (!tech) {
      throw new NotFoundError('Tech not found');
    }

    tech.deletedAt = new Date();
    // Soft delete the tech
    await tech.save();

    logger.info(`Tech deleted: ${techId} - ${tech.name} by user: ${deletedBy}`);

    return true;
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }

    logger.error(`Error deleting tech ${techId}: ${error.message}`);
    throw new InternalServerError('Failed to delete tech');
  }
};

/**
 * Search techs by name (with caching)
 * @param {string} searchTerm - Search term
 * @param {number} limit - Maximum results to return
 * @returns {Array} Array of matching techs
 */
const searchTechs = async (searchTerm, limit = 10) => {
  try {
    if (!searchTerm || searchTerm.trim() === '') {
      return [];
    }

    const techs = await Tech.findAll({
      where: {
        name: {
          [sequelize.Op.iLike]: `%${searchTerm.trim()}%`,
        },
      },
      limit: parseInt(limit, 10),
      order: [['name', 'ASC']],
      attributes: ['id', 'name', 'icon'],
    });

    logger.info(`Searched techs for term: "${searchTerm}", found ${techs.length} results`);

    return techs;
  } catch (error) {
    logger.error(`Error searching techs: ${error.message}`);
    throw new InternalServerError('Failed to search techs');
  }
};

module.exports = {
  getAllTechs,
  getTechById,
  createTech,
  updateTech,
  deleteTech,
  searchTechs,
};
