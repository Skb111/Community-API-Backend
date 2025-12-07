/**
 * @file tests/blog/blog.controller.unit.test.js
 * @description Unit tests for blogController module
 */

// Mock service dependencies BEFORE controller import
const mockCreateBlog = jest.fn();
const mockGetAllBlogs = jest.fn();
const mockGetBlogById = jest.fn();
const mockUpdateBlog = jest.fn();
const mockDeleteBlog = jest.fn();
const mockUpdateBlogCoverImage = jest.fn();

jest.mock('../../services/blog/blogService', () => ({
  createBlog: mockCreateBlog,
  getAllBlogs: mockGetAllBlogs,
  getBlogById: mockGetBlogById,
  updateBlog: mockUpdateBlog,
  deleteBlog: mockDeleteBlog,
  updateBlogCoverImage: mockUpdateBlogCoverImage,
}));

// Mock logger
jest.mock('../../utils/logger', () => {
  return jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }));
});

// Mock asyncHandler
jest.mock('../../middleware/errorHandler', () => ({
  asyncHandler: (fn) => fn,
}));

// Mock validator schemas
const mockCreateBlogValidate = jest.fn();
const mockUpdateBlogValidate = jest.fn();
const mockBlogQueryValidate = jest.fn();
const mockBlogIdParamValidate = jest.fn();

jest.mock('../../utils/validator', () => {
  const actual = jest.requireActual('../../utils/validator');
  return {
    ...actual,
    createBlogSchema: {
      validate: (...args) => mockCreateBlogValidate(...args),
    },
    updateBlogSchema: {
      validate: (...args) => mockUpdateBlogValidate(...args),
    },
    blogQuerySchema: {
      validate: (...args) => mockBlogQueryValidate(...args),
    },
    blogIdParamSchema: {
      validate: (...args) => mockBlogIdParamValidate(...args),
    },
  };
});

// Import controller after mocks
const {
  createBlogPost,
  getBlogPosts,
  getBlogPost,
  updateBlogPost,
  deleteBlogPost,
  updateCoverImage,
} = require('../../controllers/blogController');
const { ValidationError } = require('../../utils/customErrors');

// Helper functions
const mockRequest = (overrides = {}) => ({
  user: { id: 'user-123', hasRole: jest.fn().mockReturnValue(false) },
  file: {
    buffer: Buffer.from('fake-image-data'),
    originalname: 'cover.jpg',
    mimetype: 'image/jpeg',
  },
  body: {},
  query: {},
  params: {},
  ...overrides,
});

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('BlogController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------
  // createBlogPost Tests
  // ----------------------------
  describe('createBlogPost', () => {
    const mockBlog = {
      id: 'blog-123',
      title: 'Test Blog',
      description: 'Test Description',
      createdBy: 'user-123',
      author: { id: 'user-123', fullname: 'John Doe' },
    };

    it('✅ should create blog successfully without file', async () => {
      const req = mockRequest({
        body: {
          title: 'Test Blog',
          description: 'Test Description',
        },
        file: undefined, // Explicitly no file
      });
      const res = mockResponse();

      mockCreateBlogValidate.mockReturnValue({
        error: null,
        value: { title: 'Test Blog', description: 'Test Description' },
      });
      mockCreateBlog.mockResolvedValue(mockBlog);

      await createBlogPost(req, res);

      expect(mockCreateBlogValidate).toHaveBeenCalledWith(req.body, { abortEarly: false });
      expect(mockCreateBlog).toHaveBeenCalledWith(
        { title: 'Test Blog', description: 'Test Description' },
        'user-123',
        null,
        null,
        null
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Blog post created successfully',
        blog: mockBlog,
      });
    });

    it('✅ should create blog with file upload', async () => {
      const req = mockRequest({
        body: {
          title: 'Test Blog',
          description: 'Test Description',
        },
        file: {
          buffer: Buffer.from('fake-image-data'),
          originalname: 'cover.jpg',
          mimetype: 'image/jpeg',
        },
      });
      const res = mockResponse();

      mockCreateBlogValidate.mockReturnValue({
        error: null,
        value: { title: 'Test Blog', description: 'Test Description' },
      });
      mockCreateBlog.mockResolvedValue(mockBlog);

      await createBlogPost(req, res);

      expect(mockCreateBlog).toHaveBeenCalledWith(
        { title: 'Test Blog', description: 'Test Description' },
        'user-123',
        req.file.buffer,
        'cover.jpg',
        'image/jpeg'
      );
    });

    it('✅ should remove coverImage from body when file is uploaded', async () => {
      const req = mockRequest({
        body: {
          title: 'Test Blog',
          description: 'Test Description',
          coverImage: 'https://example.com/image.jpg',
        },
        file: {
          buffer: Buffer.from('fake-image-data'),
          originalname: 'cover.jpg',
          mimetype: 'image/jpeg',
        },
      });
      const res = mockResponse();

      mockCreateBlogValidate.mockReturnValue({
        error: null,
        value: { title: 'Test Blog', description: 'Test Description' },
      });
      mockCreateBlog.mockResolvedValue(mockBlog);

      await createBlogPost(req, res);

      // coverImage should be removed from validated value
      expect(mockCreateBlogValidate).toHaveBeenCalledWith(
        expect.not.objectContaining({ coverImage: 'https://example.com/image.jpg' }),
        { abortEarly: false }
      );
    });

    it('❌ should throw ValidationError when validation fails', async () => {
      const req = mockRequest({
        body: { title: '', description: '' },
      });
      const res = mockResponse();

      mockCreateBlogValidate.mockReturnValue({
        error: {
          details: [
            { message: 'Title cannot be empty' },
            { message: 'Description cannot be empty' },
          ],
        },
        value: null,
      });

      await expect(createBlogPost(req, res)).rejects.toThrow(ValidationError);
      expect(mockCreateBlog).not.toHaveBeenCalled();
    });
  });

  // ----------------------------
  // getBlogPosts Tests
  // ----------------------------
  describe('getBlogPosts', () => {
    const mockResult = {
      blogs: [
        {
          id: 'blog-1',
          title: 'Blog 1',
          author: { id: 'user-123', fullname: 'John Doe' },
        },
      ],
      pagination: {
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };

    it('✅ should return blogs successfully', async () => {
      const req = mockRequest({
        query: { page: '1', pageSize: '10' },
      });
      const res = mockResponse();

      mockBlogQueryValidate.mockReturnValue({
        error: null,
        value: { page: 1, pageSize: 10 },
      });
      mockGetAllBlogs.mockResolvedValue(mockResult);

      await getBlogPosts(req, res);

      expect(mockBlogQueryValidate).toHaveBeenCalledWith(req.query, { abortEarly: false });
      expect(mockGetAllBlogs).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Blogs retrieved successfully',
        ...mockResult,
      });
    });

    it('❌ should throw ValidationError when query validation fails', async () => {
      const req = mockRequest({
        query: { page: '0' },
      });
      const res = mockResponse();

      mockBlogQueryValidate.mockReturnValue({
        error: {
          details: [{ message: 'Page must be at least 1' }],
        },
        value: null,
      });

      await expect(getBlogPosts(req, res)).rejects.toThrow(ValidationError);
      expect(mockGetAllBlogs).not.toHaveBeenCalled();
    });
  });

  // ----------------------------
  // getBlogPost Tests
  // ----------------------------
  describe('getBlogPost', () => {
    const mockBlog = {
      id: 'blog-123',
      title: 'Test Blog',
      author: { id: 'user-123', fullname: 'John Doe' },
    };

    it('✅ should return blog successfully', async () => {
      const req = mockRequest({
        params: { id: 'blog-123' },
      });
      const res = mockResponse();

      mockBlogIdParamValidate.mockReturnValue({
        error: null,
        value: { id: 'blog-123' },
      });
      mockGetBlogById.mockResolvedValue(mockBlog);

      await getBlogPost(req, res);

      expect(mockBlogIdParamValidate).toHaveBeenCalledWith(req.params);
      expect(mockGetBlogById).toHaveBeenCalledWith('blog-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Blog retrieved successfully',
        blog: mockBlog,
      });
    });

    it('❌ should throw ValidationError when param validation fails', async () => {
      const req = mockRequest({
        params: { id: 'invalid-uuid' },
      });
      const res = mockResponse();

      mockBlogIdParamValidate.mockReturnValue({
        error: {
          details: [{ message: 'ID must be a valid UUID' }],
        },
        value: null,
      });

      await expect(getBlogPost(req, res)).rejects.toThrow(ValidationError);
      expect(mockGetBlogById).not.toHaveBeenCalled();
    });
  });

  // ----------------------------
  // updateBlogPost Tests
  // ----------------------------
  describe('updateBlogPost', () => {
    const mockUpdatedBlog = {
      id: 'blog-123',
      title: 'Updated Title',
      description: 'Updated Description',
      author: { id: 'user-123', fullname: 'John Doe' },
    };

    it('✅ should update blog successfully', async () => {
      const req = mockRequest({
        params: { id: 'blog-123' },
        body: { title: 'Updated Title' },
        user: { id: 'user-123', hasRole: jest.fn().mockReturnValue(false) },
      });
      const res = mockResponse();

      mockBlogIdParamValidate.mockReturnValue({
        error: null,
        value: { id: 'blog-123' },
      });
      mockUpdateBlogValidate.mockReturnValue({
        error: null,
        value: { title: 'Updated Title' },
      });
      mockUpdateBlog.mockResolvedValue(mockUpdatedBlog);

      await updateBlogPost(req, res);

      expect(mockBlogIdParamValidate).toHaveBeenCalledWith(req.params);
      expect(mockUpdateBlogValidate).toHaveBeenCalledWith(req.body, { abortEarly: false });
      expect(mockUpdateBlog).toHaveBeenCalledWith(
        'blog-123',
        { title: 'Updated Title' },
        'user-123',
        false
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Blog post updated successfully',
        blog: mockUpdatedBlog,
      });
    });

    it('✅ should pass isAdmin=true when user is admin', async () => {
      const req = mockRequest({
        params: { id: 'blog-123' },
        body: { title: 'Updated Title' },
        user: { id: 'admin-123', hasRole: jest.fn().mockReturnValue(true) },
      });
      const res = mockResponse();

      mockBlogIdParamValidate.mockReturnValue({
        error: null,
        value: { id: 'blog-123' },
      });
      mockUpdateBlogValidate.mockReturnValue({
        error: null,
        value: { title: 'Updated Title' },
      });
      mockUpdateBlog.mockResolvedValue(mockUpdatedBlog);

      await updateBlogPost(req, res);

      expect(mockUpdateBlog).toHaveBeenCalledWith(
        'blog-123',
        { title: 'Updated Title' },
        'admin-123',
        true
      );
    });

    it('❌ should throw ValidationError when param validation fails', async () => {
      const req = mockRequest({
        params: { id: 'invalid-uuid' },
        body: { title: 'Updated Title' },
      });
      const res = mockResponse();

      mockBlogIdParamValidate.mockReturnValue({
        error: {
          details: [{ message: 'ID must be a valid UUID' }],
        },
        value: null,
      });

      await expect(updateBlogPost(req, res)).rejects.toThrow(ValidationError);
      expect(mockUpdateBlog).not.toHaveBeenCalled();
    });

    it('❌ should throw ValidationError when body validation fails', async () => {
      const req = mockRequest({
        params: { id: 'blog-123' },
        body: { title: '' },
      });
      const res = mockResponse();

      mockBlogIdParamValidate.mockReturnValue({
        error: null,
        value: { id: 'blog-123' },
      });
      mockUpdateBlogValidate.mockReturnValue({
        error: {
          details: [{ message: 'Title cannot be empty' }],
        },
        value: null,
      });

      await expect(updateBlogPost(req, res)).rejects.toThrow(ValidationError);
      expect(mockUpdateBlog).not.toHaveBeenCalled();
    });
  });

  // ----------------------------
  // deleteBlogPost Tests
  // ----------------------------
  describe('deleteBlogPost', () => {
    it('✅ should delete blog successfully', async () => {
      const req = mockRequest({
        params: { id: 'blog-123' },
        user: { id: 'user-123', hasRole: jest.fn().mockReturnValue(false) },
      });
      const res = mockResponse();

      mockBlogIdParamValidate.mockReturnValue({
        error: null,
        value: { id: 'blog-123' },
      });
      mockDeleteBlog.mockResolvedValue(true);

      await deleteBlogPost(req, res);

      expect(mockBlogIdParamValidate).toHaveBeenCalledWith(req.params);
      expect(mockDeleteBlog).toHaveBeenCalledWith('blog-123', 'user-123', false);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Blog post deleted successfully',
      });
    });

    it('❌ should throw ValidationError when param validation fails', async () => {
      const req = mockRequest({
        params: { id: 'invalid-uuid' },
      });
      const res = mockResponse();

      mockBlogIdParamValidate.mockReturnValue({
        error: {
          details: [{ message: 'ID must be a valid UUID' }],
        },
        value: null,
      });

      await expect(deleteBlogPost(req, res)).rejects.toThrow(ValidationError);
      expect(mockDeleteBlog).not.toHaveBeenCalled();
    });
  });

  // ----------------------------
  // updateCoverImage Tests
  // ----------------------------
  describe('updateCoverImage', () => {
    const mockUpdatedBlog = {
      id: 'blog-123',
      title: 'Test Blog',
      coverImage: 'devbyte-profile-pictures/blog_cover_blog-123_1234567890.jpg',
      author: { id: 'user-123', fullname: 'John Doe' },
    };

    it('✅ should update cover image successfully', async () => {
      const req = mockRequest({
        params: { id: 'blog-123' },
        file: {
          buffer: Buffer.from('fake-image-data'),
          originalname: 'cover.jpg',
          mimetype: 'image/jpeg',
        },
        user: { id: 'user-123', hasRole: jest.fn().mockReturnValue(false) },
      });
      const res = mockResponse();

      mockBlogIdParamValidate.mockReturnValue({
        error: null,
        value: { id: 'blog-123' },
      });
      mockUpdateBlogCoverImage.mockResolvedValue(mockUpdatedBlog);

      await updateCoverImage(req, res);

      expect(mockBlogIdParamValidate).toHaveBeenCalledWith(req.params);
      expect(mockUpdateBlogCoverImage).toHaveBeenCalledWith(
        'blog-123',
        req.file.buffer,
        'cover.jpg',
        'image/jpeg',
        'user-123',
        false
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Cover image updated successfully',
        blog: mockUpdatedBlog,
      });
    });

    it('❌ should throw ValidationError when no file is uploaded', async () => {
      const req = mockRequest({
        params: { id: 'blog-123' },
        file: undefined,
      });
      const res = mockResponse();

      mockBlogIdParamValidate.mockReturnValue({
        error: null,
        value: { id: 'blog-123' },
      });

      await expect(updateCoverImage(req, res)).rejects.toThrow(ValidationError);
      await expect(updateCoverImage(req, res)).rejects.toThrow('No file uploaded');
      expect(mockUpdateBlogCoverImage).not.toHaveBeenCalled();
    });

    it('❌ should throw ValidationError when param validation fails', async () => {
      const req = mockRequest({
        params: { id: 'invalid-uuid' },
        file: {
          buffer: Buffer.from('fake-image-data'),
          originalname: 'cover.jpg',
          mimetype: 'image/jpeg',
        },
      });
      const res = mockResponse();

      mockBlogIdParamValidate.mockReturnValue({
        error: {
          details: [{ message: 'ID must be a valid UUID' }],
        },
        value: null,
      });

      await expect(updateCoverImage(req, res)).rejects.toThrow(ValidationError);
      expect(mockUpdateBlogCoverImage).not.toHaveBeenCalled();
    });
  });
});
