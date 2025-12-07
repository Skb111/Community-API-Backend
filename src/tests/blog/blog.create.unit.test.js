/**
 * @file tests/blog/blog.create.unit.test.js
 * @description Unit tests for blogCreate module
 */

const { createBlog, uploadCoverImage } = require('../../services/blog/blogCreate');
const { ValidationError, NotFoundError, InternalServerError } = require('../../utils/customErrors');

// Mock dependencies
const mockUserFindByPk = jest.fn();
const mockBlogCreate = jest.fn();
const mockBlogSave = jest.fn();
const mockReloadBlogWithFullAuthor = jest.fn();
const mockInvalidateAllBlogCaches = jest.fn();
const mockUploadBlogCoverImage = jest.fn();

jest.mock('../../models', () => ({
  Blog: {
    create: (...args) => mockBlogCreate(...args),
  },
  User: {
    findByPk: (...args) => mockUserFindByPk(...args),
  },
}));

jest.mock('../../cache/blogCache', () => ({
  invalidateAllBlogCaches: (...args) => mockInvalidateAllBlogCaches(...args),
}));

jest.mock('../../services/blog/blogHelpers', () => ({
  reloadBlogWithFullAuthor: (...args) => mockReloadBlogWithFullAuthor(...args),
}));

jest.mock('../../utils/imageUploader', () => ({
  uploadBlogCoverImage: (...args) => mockUploadBlogCoverImage(...args),
}));

jest.mock('../../utils/logger', () =>
  jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }))
);

describe('BLOG_CREATE', () => {
  const mockUser = {
    id: 'user-123',
    fullname: 'John Doe',
    email: 'john@example.com',
  };

  const mockBlogData = {
    title: 'Test Blog',
    description: 'This is a test blog description',
    topic: 'Technology',
    featured: false,
  };

  const mockBlog = {
    id: 'blog-123',
    ...mockBlogData,
    createdBy: 'user-123',
    coverImage: null,
    save: jest.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------
  // createBlog Tests
  // ----------------------------
  describe('createBlog', () => {
    it('✅ should create blog successfully without file upload', async () => {
      mockUserFindByPk.mockResolvedValueOnce(mockUser);
      mockBlogCreate.mockResolvedValueOnce(mockBlog);
      mockReloadBlogWithFullAuthor.mockResolvedValueOnce({
        ...mockBlog,
        author: mockUser,
      });
      mockInvalidateAllBlogCaches.mockResolvedValueOnce();

      const result = await createBlog(mockBlogData, 'user-123');

      expect(mockUserFindByPk).toHaveBeenCalledWith('user-123');
      expect(mockBlogCreate).toHaveBeenCalledWith({
        title: mockBlogData.title,
        description: mockBlogData.description,
        coverImage: null,
        topic: mockBlogData.topic,
        featured: false,
        createdBy: 'user-123',
      });
      expect(mockReloadBlogWithFullAuthor).toHaveBeenCalled();
      expect(mockInvalidateAllBlogCaches).toHaveBeenCalled();
      expect(result).toHaveProperty('id', 'blog-123');
    });

    it('✅ should create blog with coverImage URL from body', async () => {
      const blogDataWithCover = {
        ...mockBlogData,
        coverImage: 'https://example.com/image.jpg',
      };
      const blogWithCover = { ...mockBlog, coverImage: 'https://example.com/image.jpg' };

      mockUserFindByPk.mockResolvedValueOnce(mockUser);
      mockBlogCreate.mockResolvedValueOnce(blogWithCover);
      mockReloadBlogWithFullAuthor.mockResolvedValueOnce({
        ...blogWithCover,
        author: mockUser,
      });
      mockInvalidateAllBlogCaches.mockResolvedValueOnce();

      const result = await createBlog(blogDataWithCover, 'user-123');

      expect(mockBlogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          coverImage: 'https://example.com/image.jpg',
        })
      );
      expect(result).toHaveProperty('coverImage', 'https://example.com/image.jpg');
    });

    it('✅ should create blog with file upload', async () => {
      const fileBuffer = Buffer.from('fake image data');
      const originalFileName = 'cover.jpg';
      const mimeType = 'image/jpeg';
      const coverImageUrl = 'devbyte-profile-pictures/blog_cover_blog-123_1234567890.jpg';

      mockUserFindByPk.mockResolvedValueOnce(mockUser);
      mockBlogCreate.mockResolvedValueOnce(mockBlog);
      mockUploadBlogCoverImage.mockResolvedValueOnce(coverImageUrl);
      mockBlogSave.mockResolvedValueOnce(true);
      mockReloadBlogWithFullAuthor.mockResolvedValueOnce({
        ...mockBlog,
        coverImage: coverImageUrl,
        author: mockUser,
      });
      mockInvalidateAllBlogCaches.mockResolvedValueOnce();

      const result = await createBlog(
        mockBlogData,
        'user-123',
        fileBuffer,
        originalFileName,
        mimeType
      );

      expect(mockUploadBlogCoverImage).toHaveBeenCalledWith({
        fileBuffer,
        originalFileName,
        mimeType,
        blogId: 'blog-123',
        oldImageUrl: null,
      });
      expect(mockBlog.save).toHaveBeenCalled();
      expect(result).toHaveProperty('coverImage', coverImageUrl);
    });

    it('✅ should handle featured flag correctly', async () => {
      const blogDataFeatured = { ...mockBlogData, featured: true };

      mockUserFindByPk.mockResolvedValueOnce(mockUser);
      mockBlogCreate.mockResolvedValueOnce({ ...mockBlog, featured: true });
      mockReloadBlogWithFullAuthor.mockResolvedValueOnce({
        ...mockBlog,
        featured: true,
        author: mockUser,
      });
      mockInvalidateAllBlogCaches.mockResolvedValueOnce();

      await createBlog(blogDataFeatured, 'user-123');

      expect(mockBlogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          featured: true,
        })
      );
    });

    it('❌ should throw NotFoundError when user does not exist', async () => {
      mockUserFindByPk.mockResolvedValueOnce(null);

      await expect(createBlog(mockBlogData, 'non-existent-user')).rejects.toThrow(NotFoundError);
      await expect(createBlog(mockBlogData, 'non-existent-user')).rejects.toThrow('User not found');
      expect(mockBlogCreate).not.toHaveBeenCalled();
    });

    it('⚠️ should wrap unexpected errors in InternalServerError', async () => {
      mockUserFindByPk.mockResolvedValueOnce(mockUser);
      mockBlogCreate.mockRejectedValueOnce(new Error('Database error'));

      await expect(createBlog(mockBlogData, 'user-123')).rejects.toThrow(InternalServerError);
    });

    it('⚠️ should propagate ValidationError', async () => {
      mockUserFindByPk.mockResolvedValueOnce(mockUser);
      const validationError = new ValidationError('Invalid data');
      mockBlogCreate.mockRejectedValueOnce(validationError);

      await expect(createBlog(mockBlogData, 'user-123')).rejects.toThrow(ValidationError);
    });
  });

  // ----------------------------
  // uploadCoverImage Tests
  // ----------------------------
  describe('uploadCoverImage', () => {
    it('✅ should upload cover image successfully', async () => {
      const fileBuffer = Buffer.from('fake image data');
      const originalFileName = 'cover.jpg';
      const mimeType = 'image/jpeg';
      const coverImageUrl = 'devbyte-profile-pictures/blog_cover_blog-123_1234567890.jpg';
      const blogWithoutCover = { ...mockBlog, coverImage: null };

      mockUploadBlogCoverImage.mockResolvedValueOnce(coverImageUrl);

      const result = await uploadCoverImage(
        blogWithoutCover,
        fileBuffer,
        originalFileName,
        mimeType
      );

      expect(mockUploadBlogCoverImage).toHaveBeenCalledWith({
        fileBuffer,
        originalFileName,
        mimeType,
        blogId: 'blog-123',
        oldImageUrl: null,
      });
      expect(result).toBe(coverImageUrl);
    });

    it('✅ should pass old image URL when blog has existing cover image', async () => {
      const blogWithCover = { ...mockBlog, coverImage: 'old-image.jpg' };
      const fileBuffer = Buffer.from('fake image data');
      const coverImageUrl = 'new-image.jpg';

      mockUploadBlogCoverImage.mockResolvedValueOnce(coverImageUrl);

      await uploadCoverImage(blogWithCover, fileBuffer, 'cover.jpg', 'image/jpeg');

      expect(mockUploadBlogCoverImage).toHaveBeenCalledWith(
        expect.objectContaining({
          oldImageUrl: 'old-image.jpg',
        })
      );
    });

    it('✅ should use default mimeType when not provided', async () => {
      const fileBuffer = Buffer.from('fake image data');
      const coverImageUrl = 'cover.jpg';

      mockUploadBlogCoverImage.mockResolvedValueOnce(coverImageUrl);

      await uploadCoverImage(mockBlog, fileBuffer, 'cover.jpg');

      expect(mockUploadBlogCoverImage).toHaveBeenCalledWith(
        expect.objectContaining({
          mimeType: 'image/jpeg',
        })
      );
    });
  });
});
