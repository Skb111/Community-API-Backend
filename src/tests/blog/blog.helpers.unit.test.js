/**
 * @file tests/blog/blog.helpers.unit.test.js
 * @description Unit tests for blogHelpers module
 */

const {
  checkBlogPermission,
  findBlogWithAuthor,
  reloadBlogWithAuthor,
  reloadBlogWithFullAuthor,
} = require('../../services/blog/blogHelpers');
const { NotFoundError, ForbiddenError } = require('../../utils/customErrors');

// Mock models
const mockBlogFindByPk = jest.fn();

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

describe('BLOG_HELPERS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------
  // checkBlogPermission Tests
  // ----------------------------
  describe('checkBlogPermission', () => {
    it('✅ should allow access when user is the author', () => {
      const blog = { createdBy: 'user-123' };
      const userId = 'user-123';
      const isAdmin = false;

      expect(() => checkBlogPermission(blog, userId, isAdmin)).not.toThrow();
    });

    it('✅ should allow access when user is admin', () => {
      const blog = { createdBy: 'user-456' };
      const userId = 'user-123';
      const isAdmin = true;

      expect(() => checkBlogPermission(blog, userId, isAdmin)).not.toThrow();
    });

    it('✅ should allow access when user is ROOT (admin)', () => {
      const blog = { createdBy: 'user-456' };
      const userId = 'user-123';
      const isAdmin = true;

      expect(() => checkBlogPermission(blog, userId, isAdmin)).not.toThrow();
    });

    it('❌ should throw ForbiddenError when user is not author and not admin', () => {
      const blog = { createdBy: 'user-456' };
      const userId = 'user-123';
      const isAdmin = false;

      expect(() => checkBlogPermission(blog, userId, isAdmin)).toThrow(ForbiddenError);
      expect(() => checkBlogPermission(blog, userId, isAdmin)).toThrow(
        'You do not have permission to modify this blog'
      );
    });
  });

  // ----------------------------
  // findBlogWithAuthor Tests
  // ----------------------------
  describe('findBlogWithAuthor', () => {
    const mockBlog = {
      id: 'blog-123',
      title: 'Test Blog',
      createdBy: 'user-123',
      author: {
        id: 'user-123',
        fullname: 'John Doe',
        email: 'john@example.com',
      },
    };

    it('✅ should find blog with author when blog exists and includeAuthor is true', async () => {
      mockBlogFindByPk.mockResolvedValueOnce(mockBlog);

      const result = await findBlogWithAuthor('blog-123', true);

      expect(mockBlogFindByPk).toHaveBeenCalledWith('blog-123', {
        include: [
          {
            model: expect.any(Object),
            as: 'author',
            attributes: ['id', 'fullname', 'email', 'profilePicture'],
          },
        ],
      });
      expect(result).toEqual(mockBlog);
    });

    it('✅ should find blog without author when includeAuthor is false', async () => {
      const blogWithoutAuthor = { ...mockBlog, author: undefined };
      mockBlogFindByPk.mockResolvedValueOnce(blogWithoutAuthor);

      const result = await findBlogWithAuthor('blog-123', false);

      expect(mockBlogFindByPk).toHaveBeenCalledWith('blog-123', {
        include: [],
      });
      expect(result).toEqual(blogWithoutAuthor);
    });

    it('❌ should throw NotFoundError when blog does not exist', async () => {
      mockBlogFindByPk.mockResolvedValueOnce(null);

      await expect(findBlogWithAuthor('non-existent', true)).rejects.toThrow(NotFoundError);
      await expect(findBlogWithAuthor('non-existent', true)).rejects.toThrow('Blog not found');
    });

    it('✅ should default includeAuthor to true when not provided', async () => {
      mockBlogFindByPk.mockResolvedValueOnce(mockBlog);

      await findBlogWithAuthor('blog-123');

      expect(mockBlogFindByPk).toHaveBeenCalledWith('blog-123', {
        include: [
          {
            model: expect.any(Object),
            as: 'author',
            attributes: ['id', 'fullname', 'email', 'profilePicture'],
          },
        ],
      });
    });
  });

  // ----------------------------
  // reloadBlogWithAuthor Tests
  // ----------------------------
  describe('reloadBlogWithAuthor', () => {
    it('✅ should reload blog with author information', async () => {
      const blogData = {
        id: 'blog-123',
        title: 'Test Blog',
      };
      const mockBlog = {
        ...blogData,
        reload: jest.fn().mockResolvedValue({
          ...blogData,
          author: {
            id: 'user-123',
            fullname: 'John Doe',
            email: 'john@example.com',
          },
        }),
      };

      const result = await reloadBlogWithAuthor(mockBlog);

      expect(mockBlog.reload).toHaveBeenCalledWith({
        include: [
          {
            model: expect.any(Object),
            as: 'author',
            attributes: ['id', 'fullname', 'email', 'profilePicture'],
          },
        ],
      });
      expect(result).toHaveProperty('author');
    });
  });

  // ----------------------------
  // reloadBlogWithFullAuthor Tests
  // ----------------------------
  describe('reloadBlogWithFullAuthor', () => {
    it('✅ should reload blog with full author information', async () => {
      const blogData = {
        id: 'blog-123',
        title: 'Test Blog',
      };
      const mockBlog = {
        ...blogData,
        reload: jest.fn().mockResolvedValue({
          ...blogData,
          author: {
            id: 'user-123',
            fullname: 'John Doe',
            email: 'john@example.com',
            profilePicture: 'profile.jpg',
          },
        }),
      };

      const result = await reloadBlogWithFullAuthor(mockBlog);

      expect(mockBlog.reload).toHaveBeenCalledWith({
        include: [
          {
            model: expect.any(Object),
            as: 'author',
            attributes: ['id', 'fullname', 'email', 'profilePicture'],
          },
        ],
      });
      expect(result).toHaveProperty('author');
      expect(result.author).toHaveProperty('profilePicture');
    });
  });
});
