/**
 * @file tests/blog/blog.update.unit.test.js
 * @description Unit tests for blogUpdate module
 */

const {
  updateBlog,
  deleteBlog,
  updateBlogCoverImage,
  uploadCoverImage,
} = require('../../services/blog/blogUpdate');
const { NotFoundError, ForbiddenError, InternalServerError } = require('../../utils/customErrors');

// Mock dependencies
const mockFindBlogWithAuthor = jest.fn();
const mockCheckBlogPermission = jest.fn();
const mockReloadBlogWithAuthor = jest.fn();
const mockInvalidateBlogCache = jest.fn();
const mockInvalidateAllBlogCaches = jest.fn();
const mockUploadBlogCoverImage = jest.fn();

jest.mock('../../services/blog/blogHelpers', () => ({
  findBlogWithAuthor: (...args) => mockFindBlogWithAuthor(...args),
  checkBlogPermission: (...args) => mockCheckBlogPermission(...args),
  reloadBlogWithAuthor: (...args) => mockReloadBlogWithAuthor(...args),
}));

jest.mock('../../cache/blogCache', () => ({
  invalidateBlogCache: (...args) => mockInvalidateBlogCache(...args),
  invalidateAllBlogCaches: (...args) => mockInvalidateAllBlogCaches(...args),
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

describe('BLOG_UPDATE', () => {
  const mockBlog = {
    id: 'blog-123',
    title: 'Original Title',
    description: 'Original Description',
    coverImage: null,
    topic: 'Technology',
    featured: false,
    createdBy: 'user-123',
    updatedAt: new Date('2025-01-01'),
    save: jest.fn().mockResolvedValue(true),
    destroy: jest.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------
  // updateBlog Tests
  // ----------------------------
  describe('updateBlog', () => {
    it('✅ should update blog title successfully', async () => {
      const updates = { title: 'Updated Title' };
      const blogInstance = { ...mockBlog };
      const updatedBlog = { ...blogInstance, title: 'Updated Title' };

      mockFindBlogWithAuthor.mockResolvedValueOnce(blogInstance);
      mockCheckBlogPermission.mockImplementationOnce(() => {}); // No error
      mockReloadBlogWithAuthor.mockResolvedValueOnce({
        ...updatedBlog,
        author: { id: 'user-123', fullname: 'John Doe' },
      });
      mockInvalidateBlogCache.mockResolvedValueOnce();
      mockInvalidateAllBlogCaches.mockResolvedValueOnce();

      const result = await updateBlog('blog-123', updates, 'user-123', false);

      expect(mockFindBlogWithAuthor).toHaveBeenCalledWith('blog-123');
      expect(mockCheckBlogPermission).toHaveBeenCalledWith(blogInstance, 'user-123', false);
      expect(blogInstance.title).toBe('Updated Title');
      expect(blogInstance.save).toHaveBeenCalled();
      expect(mockInvalidateBlogCache).toHaveBeenCalledWith('blog-123');
      expect(mockInvalidateAllBlogCaches).toHaveBeenCalled();
      expect(result).toHaveProperty('title', 'Updated Title');
    });

    it('✅ should update multiple fields', async () => {
      const updates = {
        title: 'New Title',
        description: 'New Description',
        topic: 'Science',
      };
      const blogInstance = { ...mockBlog };
      const updatedBlog = { ...blogInstance, ...updates };

      mockFindBlogWithAuthor.mockResolvedValueOnce(blogInstance);
      mockCheckBlogPermission.mockImplementationOnce(() => {});
      mockReloadBlogWithAuthor.mockResolvedValueOnce({
        ...updatedBlog,
        author: { id: 'user-123', fullname: 'John Doe' },
      });
      mockInvalidateBlogCache.mockResolvedValueOnce();
      mockInvalidateAllBlogCaches.mockResolvedValueOnce();

      const result = await updateBlog('blog-123', updates, 'user-123', false);

      expect(blogInstance.title).toBe('New Title');
      expect(blogInstance.description).toBe('New Description');
      expect(blogInstance.topic).toBe('Science');
      expect(result).toHaveProperty('title', 'New Title');
    });

    it('✅ should allow admin to update featured status', async () => {
      const updates = { featured: true };
      const blogInstance = { ...mockBlog };

      mockFindBlogWithAuthor.mockResolvedValueOnce(blogInstance);
      mockCheckBlogPermission.mockImplementationOnce(() => {});
      mockReloadBlogWithAuthor.mockResolvedValueOnce({
        ...blogInstance,
        featured: true,
        author: { id: 'user-123', fullname: 'John Doe' },
      });
      mockInvalidateBlogCache.mockResolvedValueOnce();
      mockInvalidateAllBlogCaches.mockResolvedValueOnce();

      const result = await updateBlog('blog-123', updates, 'admin-123', true);

      expect(blogInstance.featured).toBe(true);
      expect(result).toHaveProperty('featured', true);
    });

    it('❌ should not allow non-admin to update featured status', async () => {
      const updates = { featured: true };
      const blogInstance = { ...mockBlog };

      mockFindBlogWithAuthor.mockResolvedValueOnce(blogInstance);
      mockCheckBlogPermission.mockImplementationOnce(() => {});
      mockReloadBlogWithAuthor.mockResolvedValueOnce({
        ...blogInstance,
        author: { id: 'user-123', fullname: 'John Doe' },
      });
      mockInvalidateBlogCache.mockResolvedValueOnce();
      mockInvalidateAllBlogCaches.mockResolvedValueOnce();

      await updateBlog('blog-123', updates, 'user-123', false);

      // Featured should not be updated
      expect(blogInstance.featured).toBe(false);
    });

    it('✅ should set coverImage to null when provided as null', async () => {
      const updates = { coverImage: null };
      const blogInstance = { ...mockBlog };

      mockFindBlogWithAuthor.mockResolvedValueOnce(blogInstance);
      mockCheckBlogPermission.mockImplementationOnce(() => {});
      mockReloadBlogWithAuthor.mockResolvedValueOnce({
        ...blogInstance,
        coverImage: null,
        author: { id: 'user-123', fullname: 'John Doe' },
      });
      mockInvalidateBlogCache.mockResolvedValueOnce();
      mockInvalidateAllBlogCaches.mockResolvedValueOnce();

      await updateBlog('blog-123', updates, 'user-123', false);

      expect(blogInstance.coverImage).toBe(null);
    });

    it('❌ should throw NotFoundError when blog does not exist', async () => {
      mockFindBlogWithAuthor.mockRejectedValueOnce(new NotFoundError('Blog not found'));

      await expect(updateBlog('non-existent', {}, 'user-123', false)).rejects.toThrow(
        NotFoundError
      );
      expect(mockBlog.save).not.toHaveBeenCalled();
    });

    it('❌ should throw ForbiddenError when user lacks permission', async () => {
      mockFindBlogWithAuthor.mockResolvedValueOnce(mockBlog);
      mockCheckBlogPermission.mockImplementationOnce(() => {
        throw new ForbiddenError('You do not have permission to modify this blog');
      });

      await expect(updateBlog('blog-123', {}, 'other-user', false)).rejects.toThrow(ForbiddenError);
      expect(mockBlog.save).not.toHaveBeenCalled();
    });

    it('⚠️ should wrap unexpected errors in InternalServerError', async () => {
      const blogInstance = { ...mockBlog };
      blogInstance.save.mockRejectedValueOnce(new Error('Database error'));

      mockFindBlogWithAuthor.mockResolvedValueOnce(blogInstance);
      mockCheckBlogPermission.mockImplementationOnce(() => {});

      await expect(updateBlog('blog-123', { title: 'New' }, 'user-123', false)).rejects.toThrow(
        InternalServerError
      );
    });
  });

  // ----------------------------
  // deleteBlog Tests
  // ----------------------------
  describe('deleteBlog', () => {
    it('✅ should delete blog successfully', async () => {
      const blogInstance = { ...mockBlog };
      mockFindBlogWithAuthor.mockResolvedValueOnce(blogInstance);
      mockCheckBlogPermission.mockImplementationOnce(() => {});
      mockInvalidateBlogCache.mockResolvedValueOnce();
      mockInvalidateAllBlogCaches.mockResolvedValueOnce();

      const result = await deleteBlog('blog-123', 'user-123', false);

      expect(mockFindBlogWithAuthor).toHaveBeenCalledWith('blog-123', false);
      expect(mockCheckBlogPermission).toHaveBeenCalledWith(blogInstance, 'user-123', false);
      expect(blogInstance.destroy).toHaveBeenCalled();
      expect(mockInvalidateBlogCache).toHaveBeenCalledWith('blog-123');
      expect(mockInvalidateAllBlogCaches).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('✅ should allow admin to delete any blog', async () => {
      const blogInstance = { ...mockBlog };
      mockFindBlogWithAuthor.mockResolvedValueOnce(blogInstance);
      mockCheckBlogPermission.mockImplementationOnce(() => {});
      mockInvalidateBlogCache.mockResolvedValueOnce();
      mockInvalidateAllBlogCaches.mockResolvedValueOnce();

      const result = await deleteBlog('blog-123', 'admin-123', true);

      expect(mockCheckBlogPermission).toHaveBeenCalledWith(blogInstance, 'admin-123', true);
      expect(result).toBe(true);
    });

    it('❌ should throw NotFoundError when blog does not exist', async () => {
      const blogInstance = { ...mockBlog };
      mockFindBlogWithAuthor.mockRejectedValueOnce(new NotFoundError('Blog not found'));

      await expect(deleteBlog('non-existent', 'user-123', false)).rejects.toThrow(NotFoundError);
      expect(blogInstance.destroy).not.toHaveBeenCalled();
    });

    it('❌ should throw ForbiddenError when user lacks permission', async () => {
      const blogInstance = { ...mockBlog };
      mockFindBlogWithAuthor.mockResolvedValueOnce(blogInstance);
      mockCheckBlogPermission.mockImplementationOnce(() => {
        throw new ForbiddenError('You do not have permission to modify this blog');
      });

      await expect(deleteBlog('blog-123', 'other-user', false)).rejects.toThrow(ForbiddenError);
      expect(blogInstance.destroy).not.toHaveBeenCalled();
    });

    it('⚠️ should wrap unexpected errors in InternalServerError', async () => {
      const blogInstance = { ...mockBlog };
      blogInstance.destroy.mockRejectedValueOnce(new Error('Database error'));
      mockFindBlogWithAuthor.mockResolvedValueOnce(blogInstance);
      mockCheckBlogPermission.mockImplementationOnce(() => {});

      await expect(deleteBlog('blog-123', 'user-123', false)).rejects.toThrow(InternalServerError);
    });
  });

  // ----------------------------
  // updateBlogCoverImage Tests
  // ----------------------------
  describe('updateBlogCoverImage', () => {
    const fileBuffer = Buffer.from('fake image data');
    const originalFileName = 'cover.jpg';
    const mimeType = 'image/jpeg';
    const coverImageUrl = 'devbyte-profile-pictures/blog_cover_blog-123_1234567890.jpg';

    it('✅ should update cover image successfully', async () => {
      const blogInstance = { ...mockBlog, coverImage: null };

      mockFindBlogWithAuthor.mockResolvedValueOnce(blogInstance);
      mockCheckBlogPermission.mockImplementationOnce(() => {});
      mockUploadBlogCoverImage.mockResolvedValueOnce(coverImageUrl);
      mockReloadBlogWithAuthor.mockResolvedValueOnce({
        ...blogInstance,
        coverImage: coverImageUrl,
        author: { id: 'user-123', fullname: 'John Doe' },
      });
      mockInvalidateBlogCache.mockResolvedValueOnce();
      mockInvalidateAllBlogCaches.mockResolvedValueOnce();

      const result = await updateBlogCoverImage(
        'blog-123',
        fileBuffer,
        originalFileName,
        mimeType,
        'user-123',
        false
      );

      expect(mockFindBlogWithAuthor).toHaveBeenCalledWith('blog-123', false);
      expect(mockCheckBlogPermission).toHaveBeenCalledWith(blogInstance, 'user-123', false);
      expect(mockUploadBlogCoverImage).toHaveBeenCalledWith({
        fileBuffer,
        originalFileName,
        mimeType,
        blogId: 'blog-123',
        oldImageUrl: null,
      });
      expect(blogInstance.coverImage).toBe(coverImageUrl);
      expect(blogInstance.save).toHaveBeenCalled();
      expect(mockInvalidateBlogCache).toHaveBeenCalledWith('blog-123');
      expect(mockInvalidateAllBlogCaches).toHaveBeenCalled();
      expect(result).toHaveProperty('coverImage', coverImageUrl);
    });

    it('✅ should delete old cover image when updating', async () => {
      const blogWithCover = { ...mockBlog, coverImage: 'old-image.jpg' };

      mockFindBlogWithAuthor.mockResolvedValueOnce(blogWithCover);
      mockCheckBlogPermission.mockImplementationOnce(() => {});
      mockUploadBlogCoverImage.mockResolvedValueOnce(coverImageUrl);
      mockReloadBlogWithAuthor.mockResolvedValueOnce({
        ...blogWithCover,
        coverImage: coverImageUrl,
        author: { id: 'user-123', fullname: 'John Doe' },
      });
      mockInvalidateBlogCache.mockResolvedValueOnce();
      mockInvalidateAllBlogCaches.mockResolvedValueOnce();

      await updateBlogCoverImage(
        'blog-123',
        fileBuffer,
        originalFileName,
        mimeType,
        'user-123',
        false
      );

      expect(mockUploadBlogCoverImage).toHaveBeenCalledWith(
        expect.objectContaining({
          oldImageUrl: 'old-image.jpg',
        })
      );
    });

    it('❌ should throw NotFoundError when blog does not exist', async () => {
      mockFindBlogWithAuthor.mockRejectedValueOnce(new NotFoundError('Blog not found'));

      await expect(
        updateBlogCoverImage(
          'non-existent',
          fileBuffer,
          originalFileName,
          mimeType,
          'user-123',
          false
        )
      ).rejects.toThrow(NotFoundError);
      expect(mockUploadBlogCoverImage).not.toHaveBeenCalled();
    });

    it('❌ should throw ForbiddenError when user lacks permission', async () => {
      const blogInstance = { ...mockBlog };
      mockFindBlogWithAuthor.mockResolvedValueOnce(blogInstance);
      mockCheckBlogPermission.mockImplementationOnce(() => {
        throw new ForbiddenError('You do not have permission to modify this blog');
      });

      await expect(
        updateBlogCoverImage(
          'blog-123',
          fileBuffer,
          originalFileName,
          mimeType,
          'other-user',
          false
        )
      ).rejects.toThrow(ForbiddenError);
      expect(mockUploadBlogCoverImage).not.toHaveBeenCalled();
    });

    it('⚠️ should wrap unexpected errors in InternalServerError', async () => {
      mockFindBlogWithAuthor.mockResolvedValueOnce(mockBlog);
      mockCheckBlogPermission.mockImplementationOnce(() => {});
      mockUploadBlogCoverImage.mockRejectedValueOnce(new Error('Upload error'));

      await expect(
        updateBlogCoverImage('blog-123', fileBuffer, originalFileName, mimeType, 'user-123', false)
      ).rejects.toThrow(InternalServerError);
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
  });
});
