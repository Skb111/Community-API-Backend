const createLogger = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');
const { ValidationError } = require('../utils/customErrors');
const {
  getAllTechs,
  getTechById,
  createTech,
  updateTech,
  deleteTech,
} = require('../services/techService');
const Validator = require('../utils/index');
const {
  createTechSchema,
  updateTechSchema,
  techSearchQuerySchema,
  batchCreateTechsSchema,
} = require('../utils/validator');
const { batchCreateTechs, updateTechIcon } = require('../services/techService');

const logger = createLogger('TECH_CONTROLLER');

/**
 * Get all techs with pagination and search
 * @route GET /api/v1/techs
 * @access Public
 */
const getAllTechsController = asyncHandler(async (req, res) => {
  // Validate query parameters
  const { error, value } = techSearchQuerySchema.validate(req.query, { abortEarly: false });
  if (error) {
    const errorMessages = error.details.map((detail) => detail.message);
    logger.error(
      `validation error occurred when retrieving techs reason=${errorMessages.join(', ')}`
    );
    throw new ValidationError('Validation failed', errorMessages);
  }

  const { page, pageSize, search } = value;

  // Get paginated techs
  const result = await getAllTechs({ page, pageSize, search });

  logger.info(`Retrieved techs list - page ${page}, pageSize ${pageSize}, search "${search}"`);

  return res.status(200).json({
    success: true,
    message: 'Techs retrieved successfully',
    ...result,
  });
});

/**
 * Get a single tech by ID
 * @route GET /api/v1/techs/:id
 * @access Public
 */
const getTechByIdController = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const tech = await getTechById(id);

  return res.status(200).json({
    success: true,
    message: 'Tech retrieved successfully',
    tech,
  });
});

/**
 * Create a new tech
 * @route POST /api/v1/techs
 * @access Private (Admin only)
 */
const createTechController = asyncHandler(async (req, res) => {
  // Validate request body
  const { _value } = Validator.validate(createTechSchema, req.body);

  // Set creator to current user (admin creating the tech)
  const createdBy = req.user?.id || null;
  const tech = await createTech(_value, createdBy);

  logger.info(`Tech created: ${tech.id} - ${tech.name} by user: ${createdBy}`);

  return res.status(201).json({
    success: true,
    message: 'Tech created successfully',
    tech,
  });
});

/**
 * Update an existing tech
 * @route PATCH /api/v1/techs/:id
 * @access Private (Admin only)
 */
const updateTechController = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Validate request body
  const { _value } = Validator.validate(updateTechSchema, req.body);

  // Set updater to current user
  const updatedBy = req.user?.id || null;
  const tech = await updateTech(id, _value, updatedBy);

  logger.info(`Tech updated: ${id} - ${tech.name} by user: ${updatedBy}`);

  return res.status(200).json({
    success: true,
    message: 'Tech updated successfully',
    tech,
  });
});

/**
 * Delete a tech
 * @route DELETE /api/v1/techs/:id
 * @access Private (Admin only)
 */
const deleteTechController = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Set deleter to current user
  const deletedBy = req.user?.id || null;
  await deleteTech(id, deletedBy);

  logger.info(`Tech deleted: ${id} by user: ${deletedBy}`);

  return res.status(200).json({
    success: true,
    message: 'Tech deleted successfully',
  });
});

/**
 * Batch create multiple techs
 * @route POST /api/v1/techs/batch
 * @access Private (Admin only)
 */
const batchCreateTechsController = asyncHandler(async (req, res) => {
  // Validate request body
  const { error, value } = batchCreateTechsSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errorMessages = error.details.map((detail) => detail.message);
    logger.error(
      `validation error occurred when batch creating techs reason=${errorMessages.join(', ')}`
    );
    throw new ValidationError('Validation failed', errorMessages);
  }

  // Set creator to current user
  const createdBy = req.user?.id || null;
  const result = await batchCreateTechs(value, createdBy);

  logger.info(
    `Batch created techs: ${result.summary.created} created, ${result.summary.skipped} skipped by user: ${createdBy}`
  );

  return res.status(201).json({
    success: true,
    message: 'Techs batch created successfully',
    ...result,
  });
});

/**
 * Upload/update tech icon
 * @route PATCH /api/v1/techs/:id/icon
 * @access Private (Admin or creator only)
 */
const updateTechIconController = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if file was uploaded
  if (!req.file) {
    throw new ValidationError('Icon file is required');
  }

  // Get file info from multer
  const { buffer, originalname, mimetype } = req.file;

  // Set updater info
  const updatedBy = req.user.id;
  const isAdmin = req.user.hasRole('ADMIN') || req.user.hasRole('ROOT');

  // Update tech icon
  const tech = await updateTechIcon(id, buffer, originalname, mimetype, updatedBy, isAdmin);

  logger.info(`Tech icon updated: ${id} - ${tech.name} by user: ${updatedBy}`);

  return res.status(200).json({
    success: true,
    message: 'Tech icon updated successfully',
    tech,
  });
});

module.exports = {
  getAllTechsController,
  getTechByIdController,
  createTechController,
  updateTechController,
  deleteTechController,
  batchCreateTechsController,
  updateTechIconController,
};
