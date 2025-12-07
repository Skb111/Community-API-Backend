// services/blogService.js
/**
 * Blog service - Read operations with caching
 * Write operations are in blogOperations.js
 */
const createLogger = require('../../utils/logger');
const { NotFoundError, InternalServerError } = require('../../utils/customErrors');
const { Blog, User } = require('../../models');
const {
  getCachedBlog,
  cacheBlog,
  getCachedBlogList,
  cacheBlogList,
  getCachedBlogCount,
  cacheBlogCount,
} = require('../../utils/blogCache');
const {
  buildWhereClause,
  buildFilters,
  fetchBlogsFromDB,
  fetchBlogRowsFromDB,
} = require('./blogQueries');
const { createBlog, uploadCoverImage } = require('./blogCreate');
const { updateBlog, deleteBlog, updateBlogCoverImage } = require('./blogUpdate');

const logger = createLogger('BLOG_SERVICE');

/**
 * Get all blogs with pagination and filtering (with caching)
 * @param {Object} options - Query options (page, pageSize, featured, topic, createdBy)
 * @returns {Object} Paginated blogs with metadata
 */
const getAllBlogs = async (options = {}) => {
  try {
    const page = parseInt(options.page, 10) || 1;
    const pageSize = Math.min(parseInt(options.pageSize, 10) || 10, 100);

    // Build filters object for cache key
    const filters = buildFilters(options);

    // Try to get from cache first
    const cachedResult = await getCachedBlogList(page, pageSize, filters);
    if (cachedResult) {
      return cachedResult;
    }

    // Cache miss - fetch from database
    const where = buildWhereClause(options);

    // Try to get count from cache first
    let totalCount = await getCachedBlogCount(filters);
    let count;
    let rows;

    if (totalCount === null) {
      // Fetch count and rows from database
      const result = await fetchBlogsFromDB(options, where);
      count = result.count;
      rows = result.rows;
      totalCount = count;
      // Cache the count for future use
      await cacheBlogCount(totalCount, filters);
    } else {
      count = totalCount;
      // Fetch only the rows (count is cached)
      rows = await fetchBlogRowsFromDB(options, where);
    }

    const totalPages = Math.ceil(count / pageSize);

    const result = {
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

    // Cache the result for future requests
    await cacheBlogList(page, pageSize, filters, result);

    logger.info(`Retrieved ${rows.length} blogs`, { page, pageSize, total: count });

    return result;
  } catch (err) {
    logger.error(`Error retrieving blogs: ${err.message}`, { error: err });
    throw new InternalServerError(`Failed to retrieve blogs: ${err.message}`);
  }
};

/**
 * Get a single blog by ID (with caching)
 * @param {string} blogId - ID of the blog
 * @returns {Object} Blog object
 */
const getBlogById = async (blogId) => {
  try {
    // Try to get from cache first
    const cachedBlog = await getCachedBlog(blogId);
    if (cachedBlog) {
      return cachedBlog;
    }

    // Cache miss - fetch from database
    logger.info(`Retrieving blog ${blogId}`);

    const blog = await Blog.findByPk(blogId, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'fullname', 'email', 'profilePicture'],
        },
      ],
    });

    if (!blog) {
      throw new NotFoundError('Blog not found');
    }

    // Cache the blog for future requests
    await cacheBlog(blogId, blog);

    return blog;
  } catch (err) {
    if (err instanceof NotFoundError) {
      throw err;
    }

    logger.error(`Error retrieving blog ${blogId}: ${err.message}`, { error: err });
    throw new InternalServerError(`Failed to retrieve blog: ${err.message}`);
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
