// services/blogHelpers.js
/**
 * Helper functions for blog operations
 * Separated for modularity and reusability
 */

const { Blog, User } = require('../../models');
const { NotFoundError, ForbiddenError } = require('../../utils/customErrors');

/**
 * Check if user has permission to modify blog
 * @param {Object} blog - Blog object
 * @param {string} userId - User ID
 * @param {boolean} isAdmin - Whether user is admin
 * @throws {ForbiddenError} If user doesn't have permission
 */
const checkBlogPermission = (blog, userId, isAdmin) => {
  if (blog.createdBy !== userId && !isAdmin) {
    throw new ForbiddenError('You do not have permission to modify this blog');
  }
};

/**
 * Find blog by ID with author information
 * @param {string} blogId - Blog ID
 * @param {boolean} includeAuthor - Whether to include author info
 * @returns {Promise<Object>} Blog object
 * @throws {NotFoundError} If blog not found
 */
const findBlogWithAuthor = async (blogId, includeAuthor = true) => {
  const include = includeAuthor
    ? [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'fullname', 'email', 'profilePicture'],
        },
      ]
    : [];

  const blog = await Blog.findByPk(blogId, { include });

  if (!blog) {
    throw new NotFoundError('Blog not found');
  }

  return blog;
};

/**
 * Reload blog with author information
 * @param {Object} blog - Blog object
 * @returns {Promise<Object>} Reloaded blog
 */
const reloadBlogWithAuthor = async (blog) => {
  return await blog.reload({
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'fullname', 'email', 'profilePicture'],
      },
    ],
  });
};

/**
 * Reload blog with full author information (including profilePicture)
 * @param {Object} blog - Blog object
 * @returns {Promise<Object>} Reloaded blog
 */
const reloadBlogWithFullAuthor = async (blog) => {
  return await blog.reload({
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'fullname', 'email', 'profilePicture'],
      },
    ],
  });
};

module.exports = {
  checkBlogPermission,
  findBlogWithAuthor,
  reloadBlogWithAuthor,
  reloadBlogWithFullAuthor,
};
