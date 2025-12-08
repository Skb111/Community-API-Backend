/**
 * @file tests/blog/blog.service.unit.test.js
 * @description Unit tests for blogService module
 */

const { getAllBlogs, getBlogById } = require('../../services/blog/blogService');
const { NotFoundError, InternalServerError } = require('../../utils/customErrors');

// Mock dependencies
const mockGetCachedBlog = jest.fn();
const mockCacheBlog = jest.fn();
const mockGetCachedBlogList = jest.fn();
const mockCacheBlogList = jest.fn();
const mockGetCachedBlogCount = jest.fn();
const mockCacheBlogCount = jest.fn();
const mockBuildWhereClause = jest.fn();
const mockBuildFilters = jest.fn();
const mockFetchBlogsFromDB = jest.fn();
const mockFetchBlogRowsFromDB = jest.fn();
const mockBlogFindByPk = jest.fn();

jest.mock('../../cache/blogCache', () => ({
  getCachedBlog: (...args) => mockGetCachedBlog(...args),
  cacheBlog: (...args) => mockCacheBlog(...args),
  getCachedBlogList: (...args) => mockGetCachedBlogList(...args),
  cacheBlogList: (...args) => mockCacheBlogList(...args),
  getCachedBlogCount: (...args) => mockGetCachedBlogCount(...args),
  cacheBlogCount: (...args) => mockCacheBlogCount(...args),
}));

jest.mock('../../services/blog/blogQueries', () => ({
  buildWhereClause: (...args) => mockBuildWhereClause(...args),
  buildFilters: (...args) => mockBuildFilters(...args),
  fetchBlogsFromDB: (...args) => mockFetchBlogsFromDB(...args),
  fetchBlogRowsFromDB: (...args) => mockFetchBlogRowsFromDB(...args),
}));

jest.mock('../../models', () => ({
  Blog: {
    findByPk: (...args) => mockBlogFindByPk(...args),
  },
  User: {},
}));

jest.mock('../../utils/logger', () =>
  jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }))
);

describe('BLOG_SERVICE', () => {
  const mockBlog = {
    id: 'blog-123',
    title: 'Test Blog',
    description: 'Test Description',
    createdBy: 'user-123',
    author: {
      id: 'user-123',
      fullname: 'John Doe',
      email: 'john@example.com',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------
  // getAllBlogs Tests
  // ----------------------------
  describe('getAllBlogs', () => {
    const mockBlogs = [mockBlog];
    const mockPaginationResult = {
      blogs: mockBlogs,
      pagination: {
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };

    it('✅ should return cached result when available', async () => {
      mockBuildFilters.mockReturnValueOnce({});
      mockGetCachedBlogList.mockResolvedValueOnce(mockPaginationResult);

      const result = await getAllBlogs({ page: 1, pageSize: 10 });

      expect(mockGetCachedBlogList).toHaveBeenCalledWith(1, 10, {});
      expect(mockFetchBlogsFromDB).not.toHaveBeenCalled();
      expect(result).toEqual(mockPaginationResult);
    });

    it('✅ should fetch from database on cache miss', async () => {
      const dbResult = {
        count: 1,
        rows: mockBlogs,
        page: 1,
        pageSize: 10,
      };

      mockBuildFilters.mockReturnValueOnce({});
      mockGetCachedBlogList.mockResolvedValueOnce(null);
      mockBuildWhereClause.mockReturnValueOnce({});
      mockGetCachedBlogCount.mockResolvedValueOnce(null);
      mockFetchBlogsFromDB.mockResolvedValueOnce(dbResult);
      mockCacheBlogCount.mockResolvedValueOnce();
      mockCacheBlogList.mockResolvedValueOnce();

      const result = await getAllBlogs({ page: 1, pageSize: 10 });

      expect(mockGetCachedBlogList).toHaveBeenCalledWith(1, 10, {});
      expect(mockFetchBlogsFromDB).toHaveBeenCalledWith({ page: 1, pageSize: 10 }, {});
      expect(mockCacheBlogCount).toHaveBeenCalledWith(1, {});
      expect(mockCacheBlogList).toHaveBeenCalledWith(1, 10, {}, expect.any(Object));
      expect(result.blogs).toEqual(mockBlogs);
      expect(result.pagination.totalItems).toBe(1);
    });

    it('✅ should use cached count when available', async () => {
      mockBuildFilters.mockReturnValueOnce({});
      mockGetCachedBlogList.mockResolvedValueOnce(null);
      mockBuildWhereClause.mockReturnValueOnce({});
      mockGetCachedBlogCount.mockResolvedValueOnce(5);
      mockFetchBlogRowsFromDB.mockResolvedValueOnce(mockBlogs);
      mockCacheBlogList.mockResolvedValueOnce();

      const result = await getAllBlogs({ page: 1, pageSize: 10 });

      expect(mockGetCachedBlogCount).toHaveBeenCalledWith({});
      expect(mockFetchBlogsFromDB).not.toHaveBeenCalled();
      expect(mockFetchBlogRowsFromDB).toHaveBeenCalledWith({ page: 1, pageSize: 10 }, {});
      expect(result.pagination.totalItems).toBe(5);
    });

    it('✅ should handle pagination correctly', async () => {
      const dbResult = {
        count: 25,
        rows: mockBlogs,
        page: 2,
        pageSize: 10,
      };

      mockBuildFilters.mockReturnValueOnce({});
      mockGetCachedBlogList.mockResolvedValueOnce(null);
      mockBuildWhereClause.mockReturnValueOnce({});
      mockGetCachedBlogCount.mockResolvedValueOnce(null);
      mockFetchBlogsFromDB.mockResolvedValueOnce(dbResult);
      mockCacheBlogCount.mockResolvedValueOnce();
      mockCacheBlogList.mockResolvedValueOnce();

      const result = await getAllBlogs({ page: 2, pageSize: 10 });

      expect(result.pagination).toEqual({
        page: 2,
        pageSize: 10,
        totalItems: 25,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      });
    });

    it('✅ should use default pagination when options not provided', async () => {
      const dbResult = {
        count: 0,
        rows: [],
        page: 1,
        pageSize: 10,
      };

      mockBuildFilters.mockReturnValueOnce({});
      mockGetCachedBlogList.mockResolvedValueOnce(null);
      mockBuildWhereClause.mockReturnValueOnce({});
      mockGetCachedBlogCount.mockResolvedValueOnce(null);
      mockFetchBlogsFromDB.mockResolvedValueOnce(dbResult);
      mockCacheBlogCount.mockResolvedValueOnce();
      mockCacheBlogList.mockResolvedValueOnce();

      const result = await getAllBlogs();

      expect(mockFetchBlogsFromDB).toHaveBeenCalledWith({}, {});
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(10);
    });

    it('✅ should cap pageSize at 100', async () => {
      const dbResult = {
        count: 200,
        rows: mockBlogs,
        page: 1,
        pageSize: 100,
      };

      mockBuildFilters.mockReturnValueOnce({});
      mockGetCachedBlogList.mockResolvedValueOnce(null);
      mockBuildWhereClause.mockReturnValueOnce({});
      mockGetCachedBlogCount.mockResolvedValueOnce(null);
      mockFetchBlogsFromDB.mockResolvedValueOnce(dbResult);
      mockCacheBlogCount.mockResolvedValueOnce();
      mockCacheBlogList.mockResolvedValueOnce();

      const result = await getAllBlogs({ page: 1, pageSize: 200 });

      // getAllBlogs caps pageSize internally, but passes original options to fetchBlogsFromDB
      // fetchBlogsFromDB also caps it internally, so we check the original value is passed
      expect(mockFetchBlogsFromDB).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 200,
        }),
        {}
      );
      // Verify the result has the capped pageSize (capped in getAllBlogs)
      expect(result.pagination.pageSize).toBe(100);
    });

    it('✅ should handle filters correctly', async () => {
      const filters = { featured: true, topic: 'Technology' };
      const dbResult = {
        count: 5,
        rows: mockBlogs,
        page: 1,
        pageSize: 10,
      };

      mockBuildFilters.mockReturnValueOnce(filters);
      mockGetCachedBlogList.mockResolvedValueOnce(null);
      mockBuildWhereClause.mockReturnValueOnce({ featured: true });
      mockGetCachedBlogCount.mockResolvedValueOnce(null);
      mockFetchBlogsFromDB.mockResolvedValueOnce(dbResult);
      mockCacheBlogCount.mockResolvedValueOnce();
      mockCacheBlogList.mockResolvedValueOnce();

      await getAllBlogs({ featured: true, topic: 'Technology' });

      expect(mockBuildFilters).toHaveBeenCalledWith({ featured: true, topic: 'Technology' });
      expect(mockBuildWhereClause).toHaveBeenCalledWith({ featured: true, topic: 'Technology' });
    });

    it('⚠️ should wrap errors in InternalServerError', async () => {
      mockBuildFilters.mockReturnValueOnce({});
      mockGetCachedBlogList.mockRejectedValueOnce(new Error('Cache error'));

      await expect(getAllBlogs()).rejects.toThrow(InternalServerError);
    });
  });

  // ----------------------------
  // getBlogById Tests
  // ----------------------------
  describe('getBlogById', () => {
    it('✅ should return cached blog when available', async () => {
      mockGetCachedBlog.mockResolvedValueOnce(mockBlog);

      const result = await getBlogById('blog-123');

      expect(mockGetCachedBlog).toHaveBeenCalledWith('blog-123');
      expect(mockBlogFindByPk).not.toHaveBeenCalled();
      expect(result).toEqual(mockBlog);
    });

    it('✅ should fetch from database on cache miss', async () => {
      mockGetCachedBlog.mockResolvedValueOnce(null);
      mockBlogFindByPk.mockResolvedValueOnce(mockBlog);
      mockCacheBlog.mockResolvedValueOnce();

      const result = await getBlogById('blog-123');

      expect(mockGetCachedBlog).toHaveBeenCalledWith('blog-123');
      expect(mockBlogFindByPk).toHaveBeenCalledWith('blog-123', {
        include: [
          {
            model: expect.any(Object),
            as: 'author',
            attributes: ['id', 'fullname', 'email', 'profilePicture'],
          },
        ],
      });
      expect(mockCacheBlog).toHaveBeenCalledWith('blog-123', mockBlog);
      expect(result).toEqual(mockBlog);
    });

    it('❌ should throw NotFoundError when blog does not exist', async () => {
      mockGetCachedBlog.mockResolvedValueOnce(null);
      mockBlogFindByPk.mockResolvedValueOnce(null);

      await expect(getBlogById('non-existent')).rejects.toThrow(NotFoundError);
      await expect(getBlogById('non-existent')).rejects.toThrow('Blog not found');
    });

    it('⚠️ should propagate NotFoundError', async () => {
      mockGetCachedBlog.mockResolvedValueOnce(null);
      mockBlogFindByPk.mockResolvedValueOnce(null);

      await expect(getBlogById('non-existent')).rejects.toThrow(NotFoundError);
    });

    it('⚠️ should wrap unexpected errors in InternalServerError', async () => {
      mockGetCachedBlog.mockResolvedValueOnce(null);
      mockBlogFindByPk.mockRejectedValueOnce(new Error('Database error'));

      await expect(getBlogById('blog-123')).rejects.toThrow(InternalServerError);
    });
  });
});
