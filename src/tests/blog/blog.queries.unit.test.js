/**
 * @file tests/blog/blog.queries.unit.test.js
 * @description Unit tests for blogQueries module
 */

const {
  buildWhereClause,
  buildFilters,
  fetchBlogsFromDB,
  fetchBlogRowsFromDB,
  countBlogs,
} = require('../../services/blog/blogQueries');
const { Op } = require('sequelize');

// Mock models
const mockFindAndCountAll = jest.fn();
const mockFindAll = jest.fn();
const mockCount = jest.fn();

jest.mock('../../models', () => ({
  Blog: {
    findAndCountAll: (...args) => mockFindAndCountAll(...args),
    findAll: (...args) => mockFindAll(...args),
    count: (...args) => mockCount(...args),
  },
  User: {},
}));

describe('BLOG_QUERIES', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------
  // buildWhereClause Tests
  // ----------------------------
  describe('buildWhereClause', () => {
    it('✅ should return empty object when no options provided', () => {
      const result = buildWhereClause({});
      expect(result).toEqual({});
    });

    it('✅ should build where clause with featured filter (true)', () => {
      const result = buildWhereClause({ featured: true });
      expect(result).toEqual({ featured: true });
    });

    it('✅ should build where clause with featured filter (string "true")', () => {
      const result = buildWhereClause({ featured: 'true' });
      expect(result).toEqual({ featured: true });
    });

    it('✅ should build where clause with featured filter (false)', () => {
      const result = buildWhereClause({ featured: false });
      expect(result).toEqual({ featured: false });
    });

    it('✅ should build where clause with topic filter', () => {
      const result = buildWhereClause({ topic: 'Technology' });
      expect(result).toEqual({
        topic: { [Op.iLike]: '%Technology%' },
      });
    });

    it('✅ should build where clause with createdBy filter', () => {
      const userId = 'user-123';
      const result = buildWhereClause({ createdBy: userId });
      expect(result).toEqual({ createdBy: userId });
    });

    it('✅ should build where clause with multiple filters', () => {
      const result = buildWhereClause({
        featured: true,
        topic: 'Technology',
        createdBy: 'user-123',
      });
      expect(result).toEqual({
        featured: true,
        topic: { [Op.iLike]: '%Technology%' },
        createdBy: 'user-123',
      });
    });
  });

  // ----------------------------
  // buildFilters Tests
  // ----------------------------
  describe('buildFilters', () => {
    it('✅ should return empty object when no options provided', () => {
      const result = buildFilters({});
      expect(result).toEqual({});
    });

    it('✅ should build filters with featured (true)', () => {
      const result = buildFilters({ featured: true });
      expect(result).toEqual({ featured: true });
    });

    it('✅ should build filters with featured (string "true")', () => {
      const result = buildFilters({ featured: 'true' });
      expect(result).toEqual({ featured: true });
    });

    it('✅ should build filters with topic', () => {
      const result = buildFilters({ topic: 'Technology' });
      expect(result).toEqual({ topic: 'Technology' });
    });

    it('✅ should build filters with createdBy', () => {
      const result = buildFilters({ createdBy: 'user-123' });
      expect(result).toEqual({ createdBy: 'user-123' });
    });

    it('✅ should build filters with multiple options', () => {
      const result = buildFilters({
        featured: true,
        topic: 'Technology',
        createdBy: 'user-123',
      });
      expect(result).toEqual({
        featured: true,
        topic: 'Technology',
        createdBy: 'user-123',
      });
    });
  });

  // ----------------------------
  // fetchBlogsFromDB Tests
  // ----------------------------
  describe('fetchBlogsFromDB', () => {
    const mockBlogs = [
      {
        id: 'blog-1',
        title: 'Blog 1',
        createdBy: 'user-123',
        author: { id: 'user-123', fullname: 'John Doe' },
      },
      {
        id: 'blog-2',
        title: 'Blog 2',
        createdBy: 'user-123',
        author: { id: 'user-123', fullname: 'John Doe' },
      },
    ];

    it('✅ should fetch blogs with default pagination', async () => {
      mockFindAndCountAll.mockResolvedValueOnce({
        count: 2,
        rows: mockBlogs,
      });

      const result = await fetchBlogsFromDB({}, {});

      expect(mockFindAndCountAll).toHaveBeenCalledWith({
        where: {},
        limit: 10,
        offset: 0,
        order: [['createdAt', 'DESC']],
        include: [
          {
            model: expect.any(Object),
            as: 'author',
            attributes: ['id', 'fullname', 'email', 'profilePicture'],
          },
        ],
      });
      expect(result).toEqual({
        count: 2,
        rows: mockBlogs,
        page: 1,
        pageSize: 10,
      });
    });

    it('✅ should fetch blogs with custom pagination', async () => {
      mockFindAndCountAll.mockResolvedValueOnce({
        count: 25,
        rows: mockBlogs,
      });

      const result = await fetchBlogsFromDB({ page: 2, pageSize: 10 }, {});

      expect(mockFindAndCountAll).toHaveBeenCalledWith({
        where: {},
        limit: 10,
        offset: 10,
        order: [['createdAt', 'DESC']],
        include: [
          {
            model: expect.any(Object),
            as: 'author',
            attributes: ['id', 'fullname', 'email', 'profilePicture'],
          },
        ],
      });
      expect(result).toEqual({
        count: 25,
        rows: mockBlogs,
        page: 2,
        pageSize: 10,
      });
    });

    it('✅ should cap pageSize at 100', async () => {
      mockFindAndCountAll.mockResolvedValueOnce({
        count: 200,
        rows: mockBlogs,
      });

      await fetchBlogsFromDB({ page: 1, pageSize: 200 }, {});

      expect(mockFindAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 100,
        })
      );
    });

    it('✅ should apply where clause filters', async () => {
      const where = { featured: true, topic: { [Op.iLike]: '%Tech%' } };
      mockFindAndCountAll.mockResolvedValueOnce({
        count: 1,
        rows: [mockBlogs[0]],
      });

      await fetchBlogsFromDB({ page: 1, pageSize: 10 }, where);

      expect(mockFindAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where,
        })
      );
    });
  });

  // ----------------------------
  // fetchBlogRowsFromDB Tests
  // ----------------------------
  describe('fetchBlogRowsFromDB', () => {
    const mockBlogs = [
      {
        id: 'blog-1',
        title: 'Blog 1',
        author: { id: 'user-123', fullname: 'John Doe' },
      },
    ];

    it('✅ should fetch blog rows with default pagination', async () => {
      mockFindAll.mockResolvedValueOnce(mockBlogs);

      const result = await fetchBlogRowsFromDB({}, {});

      expect(mockFindAll).toHaveBeenCalledWith({
        where: {},
        limit: 10,
        offset: 0,
        order: [['createdAt', 'DESC']],
        include: [
          {
            model: expect.any(Object),
            as: 'author',
            attributes: ['id', 'fullname', 'email', 'profilePicture'],
          },
        ],
      });
      expect(result).toEqual(mockBlogs);
    });

    it('✅ should fetch blog rows with custom pagination', async () => {
      mockFindAll.mockResolvedValueOnce(mockBlogs);

      const result = await fetchBlogRowsFromDB({ page: 3, pageSize: 5 }, {});

      expect(mockFindAll).toHaveBeenCalledWith({
        where: {},
        limit: 5,
        offset: 10,
        order: [['createdAt', 'DESC']],
        include: [
          {
            model: expect.any(Object),
            as: 'author',
            attributes: ['id', 'fullname', 'email', 'profilePicture'],
          },
        ],
      });
      expect(result).toEqual(mockBlogs);
    });

    it('✅ should apply where clause filters', async () => {
      const where = { createdBy: 'user-123' };
      mockFindAll.mockResolvedValueOnce(mockBlogs);

      await fetchBlogRowsFromDB({ page: 1, pageSize: 10 }, where);

      expect(mockFindAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where,
        })
      );
    });
  });

  // ----------------------------
  // countBlogs Tests
  // ----------------------------
  describe('countBlogs', () => {
    it('✅ should count blogs with empty where clause', async () => {
      mockCount.mockResolvedValueOnce(10);

      const result = await countBlogs({});

      expect(mockCount).toHaveBeenCalledWith({ where: {} });
      expect(result).toBe(10);
    });

    it('✅ should count blogs with filters', async () => {
      const where = { featured: true };
      mockCount.mockResolvedValueOnce(5);

      const result = await countBlogs(where);

      expect(mockCount).toHaveBeenCalledWith({ where });
      expect(result).toBe(5);
    });
  });
});
