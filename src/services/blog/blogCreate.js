// services/blogCreate.js
/**
 * Blog creation operations
 * Separated for modularity
 */

const createLogger = require('../../utils/logger');
const { ValidationError, NotFoundError, InternalServerError } = require('../../utils/customErrors');
const { Blog, User } = require('../../models');
const { invalidateAllBlogCaches } = require('../../cache/blogCache');
const { reloadBlogWithFullAuthor } = require('./blogHelpers');
const { uploadBlogCoverImage } = require('../../utils/imageUploader');

const logger = createLogger('BLOG_CREATE');

/**
 * Upload cover image for a blog post
 * @param {Object} blog - Blog object from database
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} originalFileName - Original file name
 * @param {string} mimeType - File MIME type
 * @returns {string} Cover image URL
 */
const uploadCoverImage = async (blog, fileBuffer, originalFileName, mimeType = 'image/jpeg') => {
  return uploadBlogCoverImage({
    fileBuffer,
    originalFileName,
    mimeType,
    blogId: blog.id,
    oldImageUrl: blog.coverImage,
  });
};

/**
 * Create a new blog post
 * @param {Object} blogData - Blog data (title, description, body, coverImage, topic, featured)
 * @param {string} userId - ID of the user creating the blog
 * @param {Buffer} fileBuffer - Optional file buffer for cover image
 * @param {string} originalFileName - Optional original file name
 * @param {string} mimeType - Optional file MIME type
 * @returns {Object} Created blog object
 */
const createBlog = async (
  blogData,
  userId,
  fileBuffer = null,
  originalFileName = null,
  mimeType = null
) => {
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
    await reloadBlogWithFullAuthor(blog);

    logger.info(`Blog post created successfully`, { blogId: blog.id });

    // Invalidate all blog caches since a new blog was created
    await invalidateAllBlogCaches();

    return blog;
  } catch (err) {
    if (err instanceof ValidationError || err instanceof NotFoundError) {
      throw err;
    }

    logger.error(`Error creating blog: ${err.message}`, { userId, error: err });
    throw new InternalServerError(`Failed to create blog: ${err.message}`);
  }
};

module.exports = {
  createBlog,
  uploadCoverImage,
};
