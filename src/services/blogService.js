// services/blogService.js
const createLogger = require('../utils/logger');
const {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  InternalServerError,
} = require('../utils/customErrors');
const { uploadBlogCoverImage } = require('../utils/imageUploader');
const { Blog, User } = require('../models');
const { Op } = require('sequelize');

const logger = createLogger('BLOG_SERVICE');

/**
 * Create a new blog post
 * @param {Object} blogData - Blog data (title, description, body, coverImage, topic, featured)
 * @param {string} userId - ID of the user creating the blog
 * @param {Buffer} fileBuffer - Optional file buffer for cover image
 * @param {string} originalFileName - Optional original file name
 * @param {string} mimeType - Optional file MIME type
 * @returns {Object} Created blog object
 */
const createBlog = async (blogData, userId, fileBuffer = null, originalFileName = null, mimeType = null) => {
  try {
    logger.info(`Creating blog post by user ${userId}`, { title: blogData.title });

    // Verify user exists
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Create blog first (data is already validated and trimmed by controller)
    const blog = await Blog.create({
      title: blogData.title,
      description: blogData.description || null,
      body: blogData.body,
      coverImage: blogData.coverImage || null,
      topic: blogData.topic || null,
      featured: blogData.featured || false,
      createdBy: userId,
    });

    // If file is provided, upload it to MinIO and update blog
    if (fileBuffer && originalFileName && mimeType) {
      const coverImageUrl = await uploadCoverImage(blog, fileBuffer, originalFileName, mimeType);
      blog.coverImage = coverImageUrl;
      await blog.save();
    }

    // Reload with author information
    await blog.reload({
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'fullname', 'email', 'profilePicture'],
        },
      ],
    });

    logger.info(`Blog post created successfully`, { blogId: blog.id });

    return blog;
  } catch (err) {
    if (
      err instanceof ValidationError ||
      err instanceof NotFoundError
    ) {
      throw err;
    }

    logger.error(`Error creating blog: ${err.message}`, { userId, error: err });
    throw new InternalServerError(`Failed to create blog: ${err.message}`);
  }
};

/**
 * Get all blogs with pagination and filtering
 * @param {Object} options - Query options (page, pageSize, featured, topic, createdBy)
 * @returns {Object} Paginated blogs with metadata
 */
const getAllBlogs = async (options = {}) => {
  try {
    const page = parseInt(options.page, 10) || 1;
    const pageSize = Math.min(parseInt(options.pageSize, 10) || 10, 100);
    const offset = (page - 1) * pageSize;

    // Build where clause
    const where = {};
    if (options.featured !== undefined) {
      where.featured = options.featured === 'true' || options.featured === true;
    }
    if (options.topic) {
      where.topic = { [Op.iLike]: `%${options.topic}%` };
    }
    if (options.createdBy) {
      where.createdBy = options.createdBy;
    }

    // Build query
    const { count, rows } = await Blog.findAndCountAll({
      where,
      limit: pageSize,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'fullname', 'email', 'profilePicture'],
        },
      ],
    });

    const totalPages = Math.ceil(count / pageSize);

    logger.info(`Retrieved ${rows.length} blogs`, { page, pageSize, total: count });

    return {
      blogs: rows,
      pagination: {
        page,
        pageSize,
        totalItems: count,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  } catch (err) {
    logger.error(`Error retrieving blogs: ${err.message}`, { error: err });
    throw new InternalServerError(`Failed to retrieve blogs: ${err.message}`);
  }
};

/**
 * Get a single blog by ID
 * @param {string} blogId - ID of the blog
 * @returns {Object} Blog object
 */
const getBlogById = async (blogId) => {
  try {
    logger.info(`Retrieving blog ${blogId}`);

    const blog = await Blog.findByPk(blogId, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'fullname', 'email'],
        },
      ],
    });

    if (!blog) {
      throw new NotFoundError('Blog not found');
    }

    return blog;
  } catch (err) {
    if (err instanceof NotFoundError) {
      throw err;
    }

    logger.error(`Error retrieving blog ${blogId}: ${err.message}`, { error: err });
    throw new InternalServerError(`Failed to retrieve blog: ${err.message}`);
  }
};

/**
 * Update a blog post
 * @param {string} blogId - ID of the blog to update
 * @param {Object} updates - Fields to update
 * @param {string} userId - ID of the user making the update
 * @param {boolean} isAdmin - Whether the user is an admin
 * @returns {Object} Updated blog object
 */
const updateBlog = async (blogId, updates, userId, isAdmin = false) => {
  try {
    logger.info(`Updating blog ${blogId} by user ${userId}`);

    const blog = await Blog.findByPk(blogId, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'fullname', 'email'],
        },
      ],
    });

    if (!blog) {
      throw new NotFoundError('Blog not found');
    }

    // Check permissions: only author or admin can update
    if (blog.createdBy !== userId && !isAdmin) {
      throw new ForbiddenError('You do not have permission to update this blog');
    }

    // Only update provided fields (data is already validated and trimmed by controller)
    if (updates.title !== undefined) {
      blog.title = updates.title;
    }
    if (updates.description !== undefined) {
      blog.description = updates.description || null;
    }
    if (updates.body !== undefined) {
      blog.body = updates.body;
    }
    if (updates.coverImage !== undefined) {
      blog.coverImage = updates.coverImage || null;
    }
    if (updates.topic !== undefined) {
      blog.topic = updates.topic || null;
    }
    // Only admins can change featured status
    if (updates.featured !== undefined && isAdmin) {
      blog.featured = updates.featured;
    }

    blog.updatedAt = new Date();
    await blog.save();

    // Reload to get fresh data
    await blog.reload({
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'fullname', 'email'],
        },
      ],
    });

    logger.info(`Blog ${blogId} updated successfully`);

    return blog;
  } catch (err) {
    if (
      err instanceof NotFoundError ||
      err instanceof ValidationError ||
      err instanceof ForbiddenError
    ) {
      throw err;
    }

    logger.error(`Error updating blog ${blogId}: ${err.message}`, { error: err });
    throw new InternalServerError(`Failed to update blog: ${err.message}`);
  }
};

/**
 * Delete a blog post
 * @param {string} blogId - ID of the blog to delete
 * @param {string} userId - ID of the user making the delete request
 * @param {boolean} isAdmin - Whether the user is an admin
 * @returns {boolean} Success status
 */
const deleteBlog = async (blogId, userId, isAdmin = false) => {
  try {
    logger.info(`Deleting blog ${blogId} by user ${userId}`);

    const blog = await Blog.findByPk(blogId);

    if (!blog) {
      throw new NotFoundError('Blog not found');
    }

    // Check permissions: only author or admin can delete
    if (blog.createdBy !== userId && !isAdmin) {
      throw new ForbiddenError('You do not have permission to delete this blog');
    }

    await blog.destroy();

    logger.info(`Blog ${blogId} deleted successfully`);

    return true;
  } catch (err) {
    if (
      err instanceof NotFoundError ||
      err instanceof ForbiddenError
    ) {
      throw err;
    }

    logger.error(`Error deleting blog ${blogId}: ${err.message}`, { error: err });
    throw new InternalServerError(`Failed to delete blog: ${err.message}`);
  }
};

/**
 * Upload cover image for a blog post
 * @param {Object} blog - Blog object from database
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} originalFileName - Original file name
 * @param {string} mimeType - File MIME type (already validated by middleware)
 * @returns {string} Cover image URL
 */
const uploadCoverImage = async (
  blog,
  fileBuffer,
  originalFileName,
  mimeType = 'image/jpeg'
) => {
  // Upload image using unified image uploader
  return uploadBlogCoverImage({
    fileBuffer,
    originalFileName,
    mimeType,
    blogId: blog.id,
    oldImageUrl: blog.coverImage,
  });
};

/**
 * Update cover image for a blog post
 * @param {string} blogId - ID of the blog
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} originalFileName - Original file name
 * @param {string} mimeType - File MIME type
 * @param {string} userId - ID of the user making the update
 * @param {boolean} isAdmin - Whether the user is an admin
 * @returns {Object} Updated blog object
 */
const updateBlogCoverImage = async (
  blogId,
  fileBuffer,
  originalFileName,
  mimeType,
  userId,
  isAdmin = false
) => {
  try {
    logger.info(`Updating cover image for blog ${blogId} by user ${userId}`);

    const blog = await Blog.findByPk(blogId);

    if (!blog) {
      throw new NotFoundError('Blog not found');
    }

    // Check permissions: only author or admin can update
    if (blog.createdBy !== userId && !isAdmin) {
      throw new ForbiddenError('You do not have permission to update this blog');
    }

    // Upload new cover image
    const coverImageUrl = await uploadCoverImage(blog, fileBuffer, originalFileName, mimeType);

    // Update blog with new cover image URL
    blog.coverImage = coverImageUrl;
    blog.updatedAt = new Date();
    await blog.save();

    // Reload with author information
    await blog.reload({
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'fullname', 'email'],
        },
      ],
    });

    logger.info(`Cover image updated successfully for blog ${blogId}`);

    return blog;
  } catch (err) {
    if (
      err instanceof NotFoundError ||
      err instanceof ForbiddenError ||
      err instanceof ValidationError
    ) {
      throw err;
    }

    logger.error(`Error updating cover image for blog ${blogId}: ${err.message}`, { error: err });
    throw new InternalServerError(`Failed to update cover image: ${err.message}`);
  }
};

module.exports = {
  createBlog,
  getAllBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  uploadCoverImage,
  updateBlogCoverImage,
};
