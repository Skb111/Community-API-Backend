const express = require('express');
const {
  createBlogPost,
  getBlogPosts,
  getBlogPost,
  updateBlogPost,
  deleteBlogPost,
  updateCoverImage,
} = require('../controllers/blogController');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { handleMulterUpload } = require('../middleware/uploadMiddleware');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ValidationError:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of validation error messages
 *           example: ["Title cannot be empty", "Description cannot be empty"]
 *     Blog:
 *       type: object
 *       required:
 *         - title
 *         - body
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the blog post
 *           example: 123e4567-e89b-12d3-a456-426614174000
 *         title:
 *           type: string
 *           description: Title of the blog post
 *           example: "Getting Started with Node.js"
 *         description:
 *           type: string
 *           description: Short description or excerpt of the blog post
 *           nullable: true
 *           example: "Learn the basics of Node.js development"
 *         body:
 *           type: string
 *           description: Full content of the blog post
 *           example: "Node.js is a powerful JavaScript runtime..."
 *         coverImage:
 *           type: string
 *           format: uri
 *           description: URL to the cover image
 *           nullable: true
 *           example: "https://example.com/images/blog-cover.jpg"
 *         topic:
 *           type: string
 *           description: Topic or category of the blog post
 *           nullable: true
 *           example: "Technology"
 *         featured:
 *           type: boolean
 *           description: Whether the blog post is featured
 *           default: false
 *           example: true
 *         createdBy:
 *           type: string
 *           format: uuid
 *           description: ID of the user who created the blog post
 *           example: 123e4567-e89b-12d3-a456-426614174000
 *         author:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               format: uuid
 *             fullname:
 *               type: string
 *             email:
 *               type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2025-01-15T10:30:00.000Z
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: 2025-01-20T14:45:00.000Z
 *     BlogCreate:
 *       type: object
 *       required:
 *         - title
 *         - body
 *       properties:
 *         title:
 *           type: string
 *           minLength: 1
 *           maxLength: 255
 *           example: "Getting Started with Node.js"
 *         description:
 *           type: string
 *           nullable: true
 *           example: "Learn the basics of Node.js development"
 *         body:
 *           type: string
 *           minLength: 1
 *           example: "Node.js is a powerful JavaScript runtime..."
 *         coverImage:
 *           type: string
 *           format: uri
 *           nullable: true
 *           example: "https://example.com/images/blog-cover.jpg"
 *         topic:
 *           type: string
 *           nullable: true
 *           example: "Technology"
 *         featured:
 *           type: boolean
 *           default: false
 *           example: false
 *     BlogUpdate:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *           minLength: 1
 *           maxLength: 255
 *           example: "Updated Title"
 *         description:
 *           type: string
 *           nullable: true
 *           example: "Updated description"
 *         body:
 *           type: string
 *           minLength: 1
 *           example: "Updated body content..."
 *         coverImage:
 *           type: string
 *           format: uri
 *           nullable: true
 *           example: "https://example.com/images/new-cover.jpg"
 *         topic:
 *           type: string
 *           nullable: true
 *           example: "Updated Topic"
 *         featured:
 *           type: boolean
 *           example: true
 */

/**
 * @swagger
 * /api/v1/blogs:
 *   post:
 *     summary: Create a new blog post
 *     description: |
 *       Create a new blog post with optional cover image upload. 
 *       
 *       **Two ways to provide cover image:**
 *       1. **File Upload (multipart/form-data)**: Upload an image file directly. The file will be stored in MinIO and the URL will be automatically generated.
 *       2. **URL String (application/json)**: Provide an existing image URL as a string.
 *       
 *       **File Requirements:**
 *       - Supported formats: JPEG, JPG, PNG
 *       - Maximum file size: 5MB
 *       - If a file is uploaded, it takes priority over any URL provided in the body.
 *       
 *       Requires authentication.
 *     tags: [Blog]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BlogCreate'
 *           example:
 *             title: "Getting Started with Node.js"
 *             description: "Learn the basics of Node.js development"
 *             body: "Node.js is a powerful JavaScript runtime built on Chrome's V8 JavaScript engine..."
 *             coverImage: "https://example.com/images/blog-cover.jpg"
 *             topic: "Technology"
 *             featured: false
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - body
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 description: Blog post title
 *                 example: "Getting Started with Node.js"
 *               description:
 *                 type: string
 *                 nullable: true
 *                 description: Short description or excerpt of the blog post
 *                 example: "Learn the basics of Node.js development"
 *               body:
 *                 type: string
 *                 minLength: 1
 *                 description: Full content of the blog post
 *                 example: "Node.js is a powerful JavaScript runtime built on Chrome's V8 JavaScript engine..."
 *               coverImage:
 *                 type: string
 *                 format: binary
 *                 description: |
 *                   Cover image file (JPEG or PNG, max 5MB). 
 *                   **Optional** - If provided, the file will be uploaded to MinIO and the URL will be automatically saved.
 *                   If not provided, you can set coverImage as a URL string in a separate JSON request.
 *               topic:
 *                 type: string
 *                 nullable: true
 *                 description: Topic or category of the blog post
 *                 example: "Technology"
 *               featured:
 *                 type: boolean
 *                 default: false
 *                 description: Whether the blog post should be featured
 *                 example: false
 *           encoding:
 *             coverImage:
 *               contentType: image/jpeg, image/png
 *     responses:
 *       201:
 *         description: |
 *           Blog post created successfully. 
 *           If a cover image file was uploaded, the `coverImage` field in the response will contain the MinIO URL where the image was stored.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Blog post created successfully
 *                 blog:
 *                   $ref: '#/components/schemas/Blog'
 *             example:
 *               success: true
 *               message: "Blog post created successfully"
 *               blog:
 *                 id: "123e4567-e89b-12d3-a456-426614174000"
 *                 title: "Getting Started with Node.js"
 *                 description: "Learn the basics of Node.js development"
 *                 body: "Node.js is a powerful JavaScript runtime..."
 *                 coverImage: "devbyte-profile-pictures/blog_cover_123e4567_1234567890.jpg"
 *                 topic: "Technology"
 *                 featured: false
 *                 createdBy: "123e4567-e89b-12d3-a456-426614174001"
 *                 author:
 *                   id: "123e4567-e89b-12d3-a456-426614174001"
 *                   fullname: "John Doe"
 *                   email: "john.doe@example.com"
 *                   profilePicture: "devbyte-profile-pictures/profile_picture_123e4567_1234567890.jpg"
 *                 createdAt: "2025-01-15T10:30:00.000Z"
 *                 updatedAt: "2025-01-15T10:30:00.000Z"
 *       400:
 *         description: Validation error or invalid file
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *             examples:
 *               singleError:
 *                 value:
 *                   success: false
 *                   message: ["Title is required"]
 *               multipleErrors:
 *                 value:
 *                   success: false
 *                   message: ["Title cannot be empty", "Description cannot be empty"]
 *               invalidFileType:
 *                 value:
 *                   success: false
 *                   message: ["Invalid file type. Only JPEG and PNG images are allowed."]
 *               fileTooLarge:
 *                 value:
 *                   success: false
 *                   message: ["File too large. Maximum size is 5MB."]
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Authentication required. Please provide a valid JWT token in the Authorization header.
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Failed to create blog
 */
router.post(
  '/',
  authenticateJWT,
  handleMulterUpload('coverImage'), // Optional file upload
  createBlogPost
);

/**
 * @swagger
 * /api/v1/blogs:
 *   get:
 *     summary: Get all blog posts with pagination and filtering
 *     description: Retrieve a paginated list of blog posts. Supports filtering by featured status, topic, and author. Public endpoint.
 *     tags: [Blog]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number (starts from 1)
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of blogs per page (max 100)
 *       - in: query
 *         name: featured
 *         schema:
 *           type: boolean
 *         description: Filter by featured status
 *       - in: query
 *         name: topic
 *         schema:
 *           type: string
 *         description: Filter by topic (case-insensitive partial match)
 *       - in: query
 *         name: createdBy
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by author user ID
 *     responses:
 *       200:
 *         description: Blogs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Blogs retrieved successfully
 *                 blogs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Blog'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     pageSize:
 *                       type: integer
 *                       example: 10
 *                     totalItems:
 *                       type: integer
 *                       example: 50
 *                     totalPages:
 *                       type: integer
 *                       example: 5
 *                     hasNextPage:
 *                       type: boolean
 *                       example: true
 *                     hasPreviousPage:
 *                       type: boolean
 *                       example: false
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Failed to retrieve blogs
 */
router.get('/', getBlogPosts);

/**
 * @swagger
 * /api/v1/blogs/{id}:
 *   get:
 *     summary: Get a single blog post by ID
 *     description: Retrieve a specific blog post by its ID. Public endpoint.
 *     tags: [Blog]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Blog post ID
 *     responses:
 *       200:
 *         description: Blog retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Blog retrieved successfully
 *                 blog:
 *                   $ref: '#/components/schemas/Blog'
 *       404:
 *         description: Blog not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Blog not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Failed to retrieve blog
 */
router.get('/:id', getBlogPost);

/**
 * @swagger
 * /api/v1/blogs/{id}:
 *   patch:
 *     summary: Update a blog post
 *     description: Update a blog post. Only the author or an admin can update. Requires authentication.
 *     tags: [Blog]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Blog post ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BlogUpdate'
 *           example:
 *             title: "Updated Title"
 *             description: "Updated description"
 *             body: "Updated body content..."
 *     responses:
 *       200:
 *         description: Blog post updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Blog post updated successfully
 *                 blog:
 *                   $ref: '#/components/schemas/Blog'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *             examples:
 *               singleError:
 *                 value:
 *                   success: false
 *                   message: ["Title cannot be empty"]
 *               multipleErrors:
 *                 value:
 *                   success: false
 *                   message: ["Title cannot be empty", "Body cannot be empty"]
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Authentication required. Please provide a valid JWT token in the Authorization header.
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: You do not have permission to update this blog
 *       404:
 *         description: Blog not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Blog not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Failed to update blog
 */
router.patch('/:id', authenticateJWT, updateBlogPost);

/**
 * @swagger
 * /api/v1/blogs/{id}:
 *   delete:
 *     summary: Delete a blog post
 *     description: Delete a blog post. Only the author or an admin can delete. Requires authentication.
 *     tags: [Blog]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Blog post ID
 *     responses:
 *       200:
 *         description: Blog post deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Blog post deleted successfully
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Authentication required. Please provide a valid JWT token in the Authorization header.
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: You do not have permission to delete this blog
 *       404:
 *         description: Blog not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Blog not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Failed to delete blog
 */
router.delete('/:id', authenticateJWT, deleteBlogPost);

/**
 * @swagger
 * /api/v1/blogs/{id}/cover-image:
 *   patch:
 *     summary: Update blog cover image
 *     description: Upload or update the cover image for a blog post. Only the author or an admin can update. Requires authentication.
 *     tags: [Blog]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Blog post ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - coverImage
 *             properties:
 *               coverImage:
 *                 type: string
 *                 format: binary
 *                 description: Cover image file (JPEG or PNG, max 5MB)
 *     responses:
 *       200:
 *         description: Cover image updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Cover image updated successfully
 *                 blog:
 *                   $ref: '#/components/schemas/Blog'
 *       400:
 *         description: Validation error or invalid file
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *             examples:
 *               noFile:
 *                 value:
 *                   success: false
 *                   message: ["No file uploaded. Please provide a cover image."]
 *               invalidFileType:
 *                 value:
 *                   success: false
 *                   message: ["Invalid file type. Only JPEG and PNG images are allowed."]
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Authentication required. Please provide a valid JWT token in the Authorization header.
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: You do not have permission to update this blog
 *       404:
 *         description: Blog not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Blog not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Failed to update cover image
 */
router.patch(
  '/:id/cover-image',
  authenticateJWT,
  handleMulterUpload('coverImage'),
  updateCoverImage
);

module.exports = router;
