const {
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addTechsToProject,
  removeTechsFromProject,
  addContributorsToProject,
  removeContributorsFromProject,
} = require('../services/project/projectService');
const createLogger = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  createProjectSchema,
  updateProjectSchema,
  projectQuerySchema,
  projectIdParamSchema,
  manageTechsSchema,
  manageContributorsSchema,
} = require('../utils/validator');
const { ValidationError } = require('../utils/customErrors');

const logger = createLogger('PROJECT_CONTROLLER');

/**
 * Create a new project
 * @route POST /api/v1/projects
 * @access Private
 */
const createProjectPost = asyncHandler(async (req, res) => {
  const body = req.body || {};

  // If file is uploaded, remove coverImage from body (file takes priority)
  if (req.file) {
    delete body.coverImage;
  }

  // Parse array fields from strings if needed
  if (body.techs && typeof body.techs === 'string') {
    try {
      body.techs = JSON.parse(body.techs);
    } catch (err) {
      throw new ValidationError('Invalid techs format', ['Techs must be a valid JSON array']);
    }
  }

  if (body.contributors && typeof body.contributors === 'string') {
    try {
      body.contributors = JSON.parse(body.contributors);
    } catch (err) {
      throw new ValidationError('Invalid contributors format', [
        'Contributors must be a valid JSON array',
      ]);
    }
  }

  const { error, value } = createProjectSchema.validate(body, { abortEarly: false });

  if (error) {
    const errorMessages = error.details.map((detail) => detail.message);
    logger.error(
      `validation error occurred when creating project reason=${errorMessages.join(', ')}`
    );
    throw new ValidationError('Validation failed', errorMessages);
  }

  const userId = req.user.id;

  // Handle optional file upload
  const fileBuffer = req.file?.buffer || null;
  const originalFileName = req.file?.originalname || null;
  const mimeType = req.file?.mimetype || null;

  const project = await createProject(value, userId, fileBuffer, originalFileName, mimeType);

  logger.info(`Project created successfully - Project ID: ${project.id}, User ID: ${userId}`);

  return res.status(201).json({
    success: true,
    message: 'Project created successfully',
    project,
  });
});

/**
 * Get all projects with pagination and filtering
 * @route GET /api/v1/projects
 * @access Public
 */
const getProjects = asyncHandler(async (req, res) => {
  const { error, value } = projectQuerySchema.validate(req.query, { abortEarly: false });

  if (error) {
    const errorMessages = error.details.map((detail) => detail.message);
    logger.error(
      `validation error occurred when retrieving projects reason=${errorMessages.join(', ')}`
    );
    throw new ValidationError('Validation failed', errorMessages);
  }

  const result = await getAllProjects(value);

  logger.info(`Projects retrieved successfully - Count: ${result.projects.length}`);

  return res.status(200).json({
    success: true,
    message: 'Projects retrieved successfully',
    ...result,
  });
});

/**
 * Get a single project by ID
 * @route GET /api/v1/projects/:id
 * @access Public
 */
const getProject = asyncHandler(async (req, res) => {
  const { error, value } = projectIdParamSchema.validate(req.params, { abortEarly: false });

  if (error) {
    const errorMessages = error.details.map((detail) => detail.message);
    logger.error(
      `validation error occurred when retrieving project reason=${errorMessages.join(', ')}`
    );
    throw new ValidationError('Validation failed', errorMessages);
  }

  const project = await getProjectById(value.id);

  logger.info(`Project retrieved successfully - Project ID: ${project.id}`);

  return res.status(200).json({
    success: true,
    message: 'Project retrieved successfully',
    project,
  });
});

/**
 * Update an existing project
 * @route PATCH /api/v1/projects/:id
 * @access Private (Owner only)
 */
const updateProjectPut = asyncHandler(async (req, res) => {
  // Validate project ID
  const { error: paramError, value: params } = projectIdParamSchema.validate(req.params, {
    abortEarly: false,
  });
  if (paramError) {
    const errorMessages = paramError.details.map((detail) => detail.message);
    throw new ValidationError('Validation failed', errorMessages);
  }

  const body = req.body || {};

  // If file is uploaded, remove coverImage from body (file takes priority)
  if (req.file) {
    delete body.coverImage;
  }

  // Parse array fields from strings if needed
  if (body.techs !== undefined && typeof body.techs === 'string') {
    try {
      body.techs = JSON.parse(body.techs);
    } catch (err) {
      throw new ValidationError('Invalid techs format', ['Techs must be a valid JSON array']);
    }
  }

  if (body.contributors !== undefined && typeof body.contributors === 'string') {
    try {
      body.contributors = JSON.parse(body.contributors);
    } catch (err) {
      throw new ValidationError('Invalid contributors format', [
        'Contributors must be a valid JSON array',
      ]);
    }
  }

  if (body.partners !== undefined && typeof body.partners === 'string') {
    try {
      body.partners = JSON.parse(body.partners);
    } catch (err) {
      throw new ValidationError('Invalid partners format', ['Partners must be a valid JSON array']);
    }
  }

  const { error: bodyError, value } = updateProjectSchema.validate(body, { abortEarly: false });

  if (bodyError) {
    const errorMessages = bodyError.details.map((detail) => detail.message);
    logger.error(
      `validation error occurred when updating project reason=${errorMessages.join(', ')}`
    );
    throw new ValidationError('Validation failed', errorMessages);
  }

  const userId = req.user.id;
  const projectId = params.id;

  // Handle optional file upload
  const fileBuffer = req.file?.buffer || null;
  const originalFileName = req.file?.originalname || null;
  const mimeType = req.file?.mimetype || null;

  const project = await updateProject(
    projectId,
    value,
    userId,
    fileBuffer,
    originalFileName,
    mimeType
  );

  logger.info(`Project updated successfully - Project ID: ${projectId}, User ID: ${userId}`);

  return res.status(200).json({
    success: true,
    message: 'Project updated successfully',
    project,
  });
});

/**
 * Delete a project
 * @route DELETE /api/v1/projects/:id
 * @access Private (Owner only)
 */
const deleteProjectDelete = asyncHandler(async (req, res) => {
  const { error, value } = projectIdParamSchema.validate(req.params, { abortEarly: false });

  if (error) {
    const errorMessages = error.details.map((detail) => detail.message);
    logger.error(
      `validation error occurred when deleting project reason=${errorMessages.join(', ')}`
    );
    throw new ValidationError('Validation failed', errorMessages);
  }

  const userId = req.user.id;
  const projectId = value.id;

  await deleteProject(projectId, userId);

  logger.info(`Project deleted successfully - Project ID: ${projectId}, User ID: ${userId}`);

  return res.status(200).json({
    success: true,
    message: 'Project deleted successfully',
  });
});

/**
 * Add techs to project
 * @route POST /api/v1/projects/:id/techs
 * @access Private (Owner only)
 */
const addTechs = asyncHandler(async (req, res) => {
  // Validate project ID
  const { error: paramError, value: params } = projectIdParamSchema.validate(req.params, {
    abortEarly: false,
  });
  if (paramError) {
    const errorMessages = paramError.details.map((detail) => detail.message);
    throw new ValidationError('Validation failed', errorMessages);
  }

  // Validate request body
  const { error: bodyError, value: body } = manageTechsSchema.validate(req.body, {
    abortEarly: false,
  });
  if (bodyError) {
    const errorMessages = bodyError.details.map((detail) => detail.message);
    throw new ValidationError('Validation failed', errorMessages);
  }

  const userId = req.user.id;
  const projectId = params.id;

  const project = await addTechsToProject(projectId, body.techIds, userId);

  logger.info(
    `Techs added to project - Project ID: ${projectId}, Techs: ${body.techIds}, User ID: ${userId}`
  );

  return res.status(200).json({
    success: true,
    message: 'Techs added successfully',
    project,
  });
});

/**
 * Remove techs from project
 * @route DELETE /api/v1/projects/:id/techs
 * @access Private (Owner only)
 */
const removeTechs = asyncHandler(async (req, res) => {
  // Validate project ID
  const { error: paramError, value: params } = projectIdParamSchema.validate(req.params, {
    abortEarly: false,
  });
  if (paramError) {
    const errorMessages = paramError.details.map((detail) => detail.message);
    throw new ValidationError('Validation failed', errorMessages);
  }

  // Validate request body
  const { error: bodyError, value: body } = manageTechsSchema.validate(req.body, {
    abortEarly: false,
  });
  if (bodyError) {
    const errorMessages = bodyError.details.map((detail) => detail.message);
    throw new ValidationError('Validation failed', errorMessages);
  }

  const userId = req.user.id;
  const projectId = params.id;

  const project = await removeTechsFromProject(projectId, body.techIds, userId);

  logger.info(
    `Techs removed from project - Project ID: ${projectId}, Techs: ${body.techIds}, User ID: ${userId}`
  );

  return res.status(200).json({
    success: true,
    message: 'Techs removed successfully',
    project,
  });
});

/**
 * Add contributors to project
 * @route POST /api/v1/projects/:id/contributors
 * @access Private (Owner only)
 */
const addContributors = asyncHandler(async (req, res) => {
  // Validate project ID
  const { error: paramError, value: params } = projectIdParamSchema.validate(req.params, {
    abortEarly: false,
  });
  if (paramError) {
    const errorMessages = paramError.details.map((detail) => detail.message);
    throw new ValidationError('Validation failed', errorMessages);
  }

  // Validate request body
  const { error: bodyError, value: body } = manageContributorsSchema.validate(req.body, {
    abortEarly: false,
  });
  if (bodyError) {
    const errorMessages = bodyError.details.map((detail) => detail.message);
    throw new ValidationError('Validation failed', errorMessages);
  }

  const userId = req.user.id;
  const projectId = params.id;

  const project = await addContributorsToProject(projectId, body.userIds, userId);

  logger.info(
    `Contributors added to project - Project ID: ${projectId}, Contributors: ${body.userIds}, User ID: ${userId}`
  );

  return res.status(200).json({
    success: true,
    message: 'Contributors added successfully',
    project,
  });
});

/**
 * Remove contributors from project
 * @route DELETE /api/v1/projects/:id/contributors
 * @access Private (Owner only)
 */
const removeContributors = asyncHandler(async (req, res) => {
  // Validate project ID
  const { error: paramError, value: params } = projectIdParamSchema.validate(req.params, {
    abortEarly: false,
  });
  if (paramError) {
    const errorMessages = paramError.details.map((detail) => detail.message);
    throw new ValidationError('Validation failed', errorMessages);
  }

  // Validate request body
  const { error: bodyError, value: body } = manageContributorsSchema.validate(req.body, {
    abortEarly: false,
  });
  if (bodyError) {
    const errorMessages = bodyError.details.map((detail) => detail.message);
    throw new ValidationError('Validation failed', errorMessages);
  }

  const userId = req.user.id;
  const projectId = params.id;

  const project = await removeContributorsFromProject(projectId, body.userIds, userId);

  logger.info(
    `Contributors removed from project - Project ID: ${projectId}, Contributors: ${body.userIds}, User ID: ${userId}`
  );

  return res.status(200).json({
    success: true,
    message: 'Contributors removed successfully',
    project,
  });
});

module.exports = {
  createProjectPost,
  getProjects,
  getProject,
  updateProjectPut,
  deleteProjectDelete,
  addTechs,
  removeTechs,
  addContributors,
  removeContributors,
};
