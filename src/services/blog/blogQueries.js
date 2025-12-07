/**
 * Database query operations for blogs
 * Separated from blogService for modularity
 */

const { Blog, User } = require('../../models');
const { Op } = require('sequelize');

/**
 * Build where clause from filter options
 * @param {Object} options - Filter options
 * @returns {Object} Sequelize where clause
 */
const buildWhereClause = (options) => {
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
  return where;
};

/**
 * Build filters object for cache key
 * @param {Object} options - Query options
 * @returns {Object} Filters object
 */
const buildFilters = (options) => {
  const filters = {};
  if (options.featured !== undefined) {
    filters.featured = options.featured === 'true' || options.featured === true;
  }
  if (options.topic) {
    filters.topic = options.topic;
  }
  if (options.createdBy) {
    filters.createdBy = options.createdBy;
  }
  return filters;
};

/**
 * Fetch blogs with pagination from database
 * @param {Object} options - Query options
 * @param {Object} where - Where clause
 * @returns {Promise<Object>} Query result with count and rows
 */
const fetchBlogsFromDB = async (options, where) => {
  const page = parseInt(options.page, 10) || 1;
  const pageSize = Math.min(parseInt(options.pageSize, 10) || 10, 100);
  const offset = (page - 1) * pageSize;

  const result = await Blog.findAndCountAll({
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

  return {
    count: result.count,
    rows: result.rows,
    page,
    pageSize,
  };
};

/**
 * Fetch blogs rows only (when count is cached)
 * @param {Object} options - Query options
 * @param {Object} where - Where clause
 * @returns {Promise<Array>} Blog rows
 */
const fetchBlogRowsFromDB = async (options, where) => {
  const page = parseInt(options.page, 10) || 1;
  const pageSize = Math.min(parseInt(options.pageSize, 10) || 10, 100);
  const offset = (page - 1) * pageSize;

  const rows = await Blog.findAll({
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

  return rows;
};

/**
 * Count blogs with filters
 * @param {Object} where - Where clause
 * @returns {Promise<number>} Total count
 */
const countBlogs = async (where) => {
  return await Blog.count({ where });
};

module.exports = {
  buildWhereClause,
  buildFilters,
  fetchBlogsFromDB,
  fetchBlogRowsFromDB,
  countBlogs,
};
