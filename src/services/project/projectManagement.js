/**
 * Project management operations for techs and contributors
 */

const createLogger = require('../../utils/logger');
const { NotFoundError, InternalServerError, ForbiddenError } = require('../../utils/customErrors');
const { Project, User, Tech, ProjectTech, ProjectContributor } = require('../../models');
const {
  invalidateAllProjectCaches,
  invalidateProjectCache,
  invalidateUserProjectCaches,
  invalidateTechProjectCaches,
} = require('../../cache/projectCache');

const logger = createLogger('PROJECT_MANAGEMENT');

/**
 * Add techs to project
 */
const addTechsToProject = async (projectId, techIds, userId) => {
  const transaction = await Project.sequelize.transaction();

  try {
    const project = await Project.findByPk(projectId, { transaction });
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (project.createdBy !== userId) {
      throw new ForbiddenError('You are not authorized to modify this project');
    }

    // Validate techs exist
    const techs = await Tech.findAll({
      where: { id: techIds },
      transaction,
    });

    const foundIds = techs.map((tech) => tech.id);
    const missingIds = techIds.filter((id) => !foundIds.includes(id));

    if (missingIds.length > 0) {
      throw new NotFoundError(`Techs not found: ${missingIds.join(', ')}`);
    }

    // Add techs (ignore duplicates)
    await project.addTechs(techs, { transaction });

    await transaction.commit();

    // Invalidate caches
    await invalidateAllProjectCaches();
    await invalidateProjectCache(projectId);

    // Invalidate cache for each tech
    for (const techId of techIds) {
      await invalidateTechProjectCaches(techId);
    }

    logger.info(`Techs added to project`, {
      projectId,
      techIds,
      userId,
    });

    return project;
  } catch (error) {
    await transaction.rollback();

    if (error instanceof NotFoundError || error instanceof ForbiddenError) {
      throw error;
    }

    logger.error(`Error adding techs to project ${projectId}: ${error.message}`, {
      userId,
      projectId,
      techIds,
      error: error.message,
      stack: error.stack,
    });
    throw new InternalServerError(`Failed to add techs to project: ${error.message}`);
  }
};

/**
 * Remove techs from project
 */
const removeTechsFromProject = async (projectId, techIds, userId) => {
  const transaction = await Project.sequelize.transaction();

  try {
    const project = await Project.findByPk(projectId, { transaction });
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (project.createdBy !== userId) {
      throw new ForbiddenError('You are not authorized to modify this project');
    }

    // Remove techs (silently skip non-existent)
    await ProjectTech.destroy({
      where: {
        projectId,
        techId: techIds,
      },
      transaction,
    });

    await transaction.commit();

    // Invalidate caches
    await invalidateAllProjectCaches();
    await invalidateProjectCache(projectId);

    // Invalidate cache for each tech
    for (const techId of techIds) {
      await invalidateTechProjectCaches(techId);
    }

    logger.info(`Techs removed from project`, {
      projectId,
      techIds,
      userId,
    });

    return project;
  } catch (error) {
    await transaction.rollback();

    if (error instanceof NotFoundError || error instanceof ForbiddenError) {
      throw error;
    }

    logger.error(`Error removing techs from project ${projectId}: ${error.message}`, {
      userId,
      projectId,
      techIds,
      error: error.message,
      stack: error.stack,
    });
    throw new InternalServerError(`Failed to remove techs from project: ${error.message}`);
  }
};

/**
 * Add contributors to project
 */
const addContributorsToProject = async (projectId, userIds, requestUserId) => {
  const transaction = await Project.sequelize.transaction();

  try {
    const project = await Project.findByPk(projectId, { transaction });
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (project.createdBy !== requestUserId) {
      throw new ForbiddenError('You are not authorized to modify this project');
    }

    // Filter out creator from contributors
    const contributorIds = userIds.filter((id) => id !== project.createdBy);

    if (contributorIds.length === 0) {
      // No valid contributors to add
      await transaction.commit();
      return project;
    }

    // Validate contributors exist
    const contributors = await User.findAll({
      where: { id: contributorIds },
      transaction,
    });

    const foundIds = contributors.map((user) => user.id);
    const missingIds = contributorIds.filter((id) => !foundIds.includes(id));

    if (missingIds.length > 0) {
      throw new NotFoundError(`Users not found: ${missingIds.join(', ')}`);
    }

    // Add contributors (ignore duplicates)
    await project.addContributors(contributors, { transaction });

    await transaction.commit();

    // Invalidate caches
    await invalidateAllProjectCaches();
    await invalidateProjectCache(projectId);

    // Invalidate cache for each contributor
    for (const userId of contributorIds) {
      await invalidateUserProjectCaches(userId);
    }

    logger.info(`Contributors added to project`, {
      projectId,
      contributorIds,
      requestUserId,
    });

    return project;
  } catch (error) {
    await transaction.rollback();

    if (error instanceof NotFoundError || error instanceof ForbiddenError) {
      throw error;
    }

    logger.error(`Error adding contributors to project ${projectId}: ${error.message}`, {
      requestUserId,
      projectId,
      userIds,
      error: error.message,
      stack: error.stack,
    });
    throw new InternalServerError(`Failed to add contributors to project: ${error.message}`);
  }
};

/**
 * Remove contributors from project
 */
const removeContributorsFromProject = async (projectId, userIds, requestUserId) => {
  const transaction = await Project.sequelize.transaction();

  try {
    const project = await Project.findByPk(projectId, { transaction });
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (project.createdBy !== requestUserId) {
      throw new ForbiddenError('You are not authorized to modify this project');
    }

    // Filter out creator (cannot remove creator as contributor)
    const contributorIds = userIds.filter((id) => id !== project.createdBy);

    if (contributorIds.length === 0) {
      // No valid contributors to remove
      await transaction.commit();
      return project;
    }

    // Remove contributors (silently skip non-existent)
    await ProjectContributor.destroy({
      where: {
        projectId,
        userId: contributorIds,
      },
      transaction,
    });

    await transaction.commit();

    // Invalidate caches
    await invalidateAllProjectCaches();
    await invalidateProjectCache(projectId);

    // Invalidate cache for each contributor
    for (const userId of contributorIds) {
      await invalidateUserProjectCaches(userId);
    }

    logger.info(`Contributors removed from project`, {
      projectId,
      contributorIds,
      requestUserId,
    });

    return project;
  } catch (error) {
    await transaction.rollback();

    if (error instanceof NotFoundError || error instanceof ForbiddenError) {
      throw error;
    }

    logger.error(`Error removing contributors from project ${projectId}: ${error.message}`, {
      requestUserId,
      projectId,
      userIds,
      error: error.message,
      stack: error.stack,
    });
    throw new InternalServerError(`Failed to remove contributors from project: ${error.message}`);
  }
};

module.exports = {
  addTechsToProject,
  removeTechsFromProject,
  addContributorsToProject,
  removeContributorsFromProject,
};
