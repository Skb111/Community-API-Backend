const { Op } = require('sequelize');
const { Project, User, Tech } = require('../../models');

/**
 * Build where clause for project queries
 */
const buildWhereClause = (options) => {
  const where = {};

  if (options.createdBy) {
    where.createdBy = options.createdBy;
  }

  if (options.featured !== undefined) {
    where.featured = options.featured === 'true' || options.featured === true;
  }

  if (options.search) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${options.search}%` } },
      { description: { [Op.iLike]: `%${options.search}%` } },
    ];
  }

  return where;
};

/**
 * Build filters object for cache key
 */
const buildFilters = (options) => {
  const filters = {};

  if (options.createdBy) filters.createdBy = options.createdBy;
  if (options.tech) filters.tech = options.tech;
  if (options.featured !== undefined) filters.featured = options.featured;
  if (options.search) filters.search = options.search;

  return filters;
};

/**
 * Fetch projects from database with joins
 */
const fetchProjectsFromDB = async (options, where) => {
  const page = parseInt(options.page, 10) || 1;
  const pageSize = Math.min(parseInt(options.pageSize, 10) || 10, 100);
  const offset = (page - 1) * pageSize;

  // Base include options
  const include = [
    {
      model: User,
      as: 'creator',
      attributes: ['id', 'fullname', 'email', 'profilePicture'],
    },
    {
      model: Tech,
      as: 'techs',
      attributes: ['id', 'name', 'icon'],
      through: { attributes: [] },
    },
    {
      model: User,
      as: 'contributors',
      attributes: ['id', 'fullname', 'email', 'profilePicture'],
      through: { attributes: [] },
    },
  ];

  // Add tech filter if specified
  if (options.tech) {
    include[1].where = { id: options.tech }; // Filter techs
  }

  // Query options
  const queryOptions = {
    where,
    include,
    distinct: true,
    order: [['createdAt', 'DESC']],
  };

  // Only apply pagination if not counting
  if (options.countOnly !== true) {
    queryOptions.limit = pageSize;
    queryOptions.offset = offset;
  }

  const { count, rows } = await Project.findAndCountAll(queryOptions);

  return { count, rows };
};

/**
 * Fetch project rows only (when count is cached)
 */
const fetchProjectRowsFromDB = async (options, where) => {
  const page = parseInt(options.page, 10) || 1;
  const pageSize = Math.min(parseInt(options.pageSize, 10) || 10, 100);
  const offset = (page - 1) * pageSize;

  const include = [
    {
      model: User,
      as: 'creator',
      attributes: ['id', 'fullname', 'email', 'profilePicture'],
    },
    {
      model: Tech,
      as: 'techs',
      attributes: ['id', 'name', 'icon'],
      through: { attributes: [] },
    },
    {
      model: User,
      as: 'contributors',
      attributes: ['id', 'fullname', 'email', 'profilePicture'],
      through: { attributes: [] },
    },
  ];

  // Add tech filter if specified
  if (options.tech) {
    include[1].where = { id: options.tech };
  }

  const projects = await Project.findAll({
    where,
    include,
    limit: pageSize,
    offset,
    order: [['createdAt', 'DESC']],
  });

  return projects;
};

module.exports = {
  buildWhereClause,
  buildFilters,
  fetchProjectsFromDB,
  fetchProjectRowsFromDB,
};
