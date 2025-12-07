const {
  createBlog,
  getAllBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  updateBlogCoverImage,
} = require('../services/blogService');
const createLogger = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  createBlogSchema,
  updateBlogSchema,
  blogQuerySchema,
  blogIdParamSchema,
} = require('../utils/validator');
const { ValidationError } = require('../utils/customErrors');

const logger = createLogger('BLOG_CONTROLLER');

/**
 * Create a new blog post
 * @route POST /api/v1/blogs
 * @access Private
 */
const createBlogPost = asyncHandler(async (req, res) => {
  const body = req.body || {};
  
  // If file is uploaded, remove coverImage from body (file takes priority)
  if (req.file) {
    delete body.coverImage;
  }
  
  const { error, value } = createBlogSchema.validate(body, { abortEarly: false });

  if (error) {
    const errorMessages = error.details.map((detail) => detail.message);
    logger.error(
      `validation error occurred when creating blog post reason=${errorMessages.join(', ')}`
    );
    throw new ValidationError('Validation failed', errorMessages);
  }

  const userId = req.user.id;
  
  // Handle optional file upload
  const fileBuffer = req.file?.buffer || null;
  const originalFileName = req.file?.originalname || null;
  const mimeType = req.file?.mimetype || null;

  const blog = await createBlog(value, userId, fileBuffer, originalFileName, mimeType);

  logger.info(`Blog post created successfully - Blog ID: ${blog.id}, User ID: ${userId}`);

  return res.status(201).json({
    success: true,
    message: 'Blog post created successfully',
    blog,
  });
});

/**
 * Get all blogs with pagination and filtering
 * @route GET /api/v1/blogs
 * @access Public
 */
const getBlogPosts = asyncHandler(async (req, res) => {
  const { error, value } = blogQuerySchema.validate(req.query, { abortEarly: false });

  if (error) {
    const errorMessages = error.details.map((detail) => detail.message);
    logger.error(
      `validation error occurred when retrieving blogs reason=${errorMessages.join(', ')}`
    );
    throw new ValidationError('Validation failed', errorMessages);
  }

  const result = await getAllBlogs(value);

  logger.info(`Blogs retrieved successfully - Count: ${result.blogs.length}`);

  return res.status(200).json({
    success: true,
    message: 'Blogs retrieved successfully',
    ...result,
  });
});

/**
 * Get a single blog by ID
 * @route GET /api/v1/blogs/:id
 * @access Public
 */
const getBlogPost = asyncHandler(async (req, res) => {
  const { error, value } = blogIdParamSchema.validate(req.params);

  if (error) {
    logger.error(
      `validation error occurred when retrieving blog reason=${error.message}`
    );
    throw new ValidationError(error.details[0].message);
  }

  const blog = await getBlogById(value.id);

  logger.info(`Blog retrieved successfully - Blog ID: ${value.id}`);

  return res.status(200).json({
    success: true,
    message: 'Blog retrieved successfully',
    blog,
  });
});

/**
 * Update a blog post
 * @route PATCH /api/v1/blogs/:id
 * @access Private (Author or Admin)
 */
const updateBlogPost = asyncHandler(async (req, res) => {
  // Validate params
  const paramValidation = blogIdParamSchema.validate(req.params);
  if (paramValidation.error) {
    logger.error(
      `validation error occurred when updating blog (params) reason=${paramValidation.error.message}`
    );
    throw new ValidationError(paramValidation.error.details[0].message);
  }

  // Validate body
  const body = req.body || {};
  const { error, value } = updateBlogSchema.validate(body, { abortEarly: false });

  if (error) {
    const errorMessages = error.details.map((detail) => detail.message);
    logger.error(
      `validation error occurred when updating blog (body) reason=${errorMessages.join(', ')}`
    );
    throw new ValidationError('Validation failed', errorMessages);
  }

  const userId = req.user.id;
  const isAdmin = req.user.hasRole('ADMIN') || req.user.hasRole('ROOT');
  const blog = await updateBlog(paramValidation.value.id, value, userId, isAdmin);

  logger.info(
    `Blog post updated successfully - Blog ID: ${paramValidation.value.id}, User ID: ${userId}`
  );

  return res.status(200).json({
    success: true,
    message: 'Blog post updated successfully',
    blog,
  });
});

/**
 * Delete a blog post
 * @route DELETE /api/v1/blogs/:id
 * @access Private (Author or Admin)
 */
const deleteBlogPost = asyncHandler(async (req, res) => {
  const { error, value } = blogIdParamSchema.validate(req.params);

  if (error) {
    logger.error(
      `validation error occurred when deleting blog reason=${error.message}`
    );
    throw new ValidationError(error.details[0].message);
  }

  const userId = req.user.id;
  const isAdmin = req.user.hasRole('ADMIN') || req.user.hasRole('ROOT');

  await deleteBlog(value.id, userId, isAdmin);

  logger.info(`Blog post deleted successfully - Blog ID: ${value.id}, User ID: ${userId}`);

  return res.status(200).json({
    success: true,
    message: 'Blog post deleted successfully',
  });
});

/**
 * Update blog cover image
 * @route PATCH /api/v1/blogs/:id/cover-image
 * @access Private (Author or Admin)
 */
const updateCoverImage = asyncHandler(async (req, res) => {
  // Validate params
  const paramValidation = blogIdParamSchema.validate(req.params);
  if (paramValidation.error) {
    logger.error(
      `validation error occurred when updating cover image (params) reason=${paramValidation.error.message}`
    );
    throw new ValidationError(paramValidation.error.details[0].message);
  }

  // Validate file upload
  if (!req.file) {
    throw new ValidationError('No file uploaded. Please provide a cover image.');
  }

  const userId = req.user.id;
  const isAdmin = req.user.hasRole('ADMIN') || req.user.hasRole('ROOT');
  const fileBuffer = req.file.buffer;
  const originalFileName = req.file.originalname;
  const mimeType = req.file.mimetype; // Already validated by multer middleware

  const blog = await updateBlogCoverImage(
    paramValidation.value.id,
    fileBuffer,
    originalFileName,
    mimeType,
    userId,
    isAdmin
  );

  logger.info(
    `Cover image updated successfully - Blog ID: ${paramValidation.value.id}, User ID: ${userId}`
  );

  return res.status(200).json({
    success: true,
    message: 'Cover image updated successfully',
    blog,
  });
});

module.exports = {
  createBlogPost,
  getBlogPosts,
  getBlogPost,
  updateBlogPost,
  deleteBlogPost,
  updateCoverImage,
};
