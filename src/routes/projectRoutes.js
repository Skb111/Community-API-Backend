const express = require('express');
const {
  createProjectPost,
  getProjects,
  getProject,
  updateProjectPut,
  deleteProjectDelete,
  addTechs,
  removeTechs,
  addContributors,
  removeContributors,
} = require('../controllers/projectController');
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
 *           example: ["Title cannot be empty"]
 *     Project:
 *       type: object
 *       required:
 *         - title
 *         - createdBy
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the project
 *           example: 123e4567-e89b-12d3-a456-426614174000
 *         title:
 *           type: string
 *           description: Title of the project
 *           example: "E-commerce Platform"
 *         description:
 *           type: string
 *           description: Detailed description of the project
 *           example: "Full-stack e-commerce application with React, Node.js, and PostgreSQL"
 *         coverImage:
 *           type: string
 *           description: URL to the cover image
 *           nullable: true
 *           example: "https://minio.example.com/projects/project_123_cover.jpg"
 *         repoLink:
 *           type: string
 *           format: uri
 *           description: Link to the project repository
 *           nullable: true
 *           example: "https://github.com/username/ecommerce-platform"
 *         featured:
 *           type: boolean
 *           description: Whether the project is featured
 *           default: false
 *           example: true
 *         createdBy:
 *           type: string
 *           format: uuid
 *           description: ID of the user who created the project
 *           example: 123e4567-e89b-12d3-a456-426614174001
 *         techs:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 format: uuid
 *               name:
 *                 type: string
 *               icon:
 *                 type: string
 *           description: Technologies used in the project
 *         contributors:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 format: uuid
 *               fullname:
 *                 type: string
 *               email:
 *                 type: string
 *               profilePicture:
 *                 type: string
 *           description: Contributors to the project
 *         creator:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               format: uuid
 *             fullname:
 *               type: string
 *             email:
 *               type: string
 *             profilePicture:
 *               type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2025-01-15T10:30:00.000Z
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: 2025-01-20T14:45:00.000Z
 *     ProjectCreate:
 *       type: object
 *       required:
 *         - title
 *       properties:
 *         title:
 *           type: string
 *           minLength: 1
 *           maxLength: 255
 *           example: "E-commerce Platform"
 *         description:
 *           type: string
 *           maxLength: 5000
 *           example: "Full-stack e-commerce application with React, Node.js, and PostgreSQL"
 *         coverImage:
 *           type: string
 *           format: uri
 *           nullable: true
 *           example: "https://example.com/images/project-cover.jpg"
 *         repoLink:
 *           type: string
 *           format: uri
 *           nullable: true
 *           example: "https://github.com/username/repo"
 *         featured:
 *           type: boolean
 *           default: false
 *           example: false
 *         techs:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *           description: Array of tech IDs
 *           example: ["123e4567-e89b-12d3-a456-426614174002", "123e4567-e89b-12d3-a456-426614174003"]
 *         contributors:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *           description: Array of user IDs (excluding creator)
 *           example: ["123e4567-e89b-12d3-a456-426614174004", "123e4567-e89b-12d3-a456-426614174005"]
 *         partners:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of partner IDs
 *           example: ["partner_corp", "partner_xyz"]
 *     ProjectUpdate:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *           minLength: 1
 *           maxLength: 255
 *           example: "Updated Project Title"
 *         description:
 *           type: string
 *           maxLength: 5000
 *           example: "Updated description..."
 *         coverImage:
 *           type: string
 *           format: uri
 *           nullable: true
 *           example: "https://example.com/images/new-cover.jpg"
 *         repoLink:
 *           type: string
 *           format: uri
 *           nullable: true
 *           example: "https://github.com/username/updated-repo"
 *         featured:
 *           type: boolean
 *           example: true
 *         techs:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *           example: ["123e4567-e89b-12d3-a456-426614174006"]
 *         contributors:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *           example: ["123e4567-e89b-12d3-a456-426614174007"]
 *         partners:
 *           type: array
 *           items:
 *             type: string
 *           example: ["partner_abc"]
 *     ManageTechsRequest:
 *       type: object
 *       required:
 *         - techIds
 *       properties:
 *         techIds:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *           description: Array of tech IDs to add/remove
 *           example: ["123e4567-e89b-12d3-a456-426614174002", "123e4567-e89b-12d3-a456-426614174003"]
 *     ManageContributorsRequest:
 *       type: object
 *       required:
 *         - userIds
 *       properties:
 *         userIds:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *           description: Array of user IDs to add/remove (excluding creator)
 *           example: ["123e4567-e89b-12d3-a456-426614174004", "123e4567-e89b-12d3-a456-426614174005"]
 */

/**
 * @swagger
 * /api/v1/projects:
 *   post:
 *     summary: Create a new project
 *     description: |
 *       Create a new project with optional cover image upload and tech/contributor associations.
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
 *       **Array Fields:**
 *       - When using multipart/form-data, array fields (techs, contributors, partners) should be sent as JSON strings.
 *       - Example: `techs=["tech_id_1", "tech_id_2"]`
 *
 *       Requires authentication.
 *     tags: [Projects]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProjectCreate'
 *           example:
 *             title: "E-commerce Platform"
 *             description: "Full-stack e-commerce application with React, Node.js, and PostgreSQL"
 *             repoLink: "https://github.com/username/ecommerce-platform"
 *             featured: false
 *             techs: ["123e4567-e89b-12d3-a456-426614174002", "123e4567-e89b-12d3-a456-426614174003"]
 *             contributors: ["123e4567-e89b-12d3-a456-426614174004"]
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 description: Project title
 *                 example: "E-commerce Platform"
 *               description:
 *                 type: string
 *                 maxLength: 5000
 *                 description: Project description
 *                 example: "Full-stack e-commerce application with React, Node.js, and PostgreSQL"
 *               coverImage:
 *                 type: string
 *                 format: binary
 *                 description: |
 *                   Cover image file (JPEG or PNG, max 5MB).
 *                   **Optional** - If provided, the file will be uploaded to MinIO and the URL will be automatically saved.
 *               repoLink:
 *                 type: string
 *                 description: Repository link
 *                 example: "https://github.com/username/ecommerce-platform"
 *               featured:
 *                 type: boolean
 *                 description: Whether the project is featured
 *                 example: false
 *               techs:
 *                 type: string
 *                 description: JSON string array of tech IDs
 *                 example: '["123e4567-e89b-12d3-a456-426614174002", "123e4567-e89b-12d3-a456-426614174003"]'
 *               contributors:
 *                 type: string
 *                 description: JSON string array of user IDs (excluding creator)
 *                 example: '["123e4567-e89b-12d3-a456-426614174004"]'
 *               partners:
 *                 type: string
 *                 description: JSON string array of partner IDs
 *                 example: '["partner_corp"]'
 *           encoding:
 *             coverImage:
 *               contentType: image/jpeg, image/png
 *     responses:
 *       201:
 *         description: Project created successfully
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
 *                   example: Project created successfully
 *                 project:
 *                   $ref: '#/components/schemas/Project'
 *             example:
 *               success: true
 *               message: "Project created successfully"
 *               project:
 *                 id: "123e4567-e89b-12d3-a456-426614174000"
 *                 title: "E-commerce Platform"
 *                 description: "Full-stack e-commerce application with React, Node.js, and PostgreSQL"
 *                 coverImage: "https://minio.example.com/projects/project_123_cover.jpg"
 *                 repoLink: "https://github.com/username/ecommerce-platform"
 *                 featured: false
 *                 createdBy: "123e4567-e89b-12d3-a456-426614174001"
 *                 techs:
 *                   - id: "123e4567-e89b-12d3-a456-426614174002"
 *                     name: "React"
 *                     icon: "react-icon.svg"
 *                   - id: "123e4567-e89b-12d3-a456-426614174003"
 *                     name: "Node.js"
 *                     icon: "nodejs-icon.svg"
 *                 contributors:
 *                   - id: "123e4567-e89b-12d3-a456-426614174004"
 *                     fullname: "Jane Doe"
 *                     email: "jane.doe@example.com"
 *                     profilePicture: "profile.jpg"
 *                 creator:
 *                   id: "123e4567-e89b-12d3-a456-426614174001"
 *                   fullname: "John Doe"
 *                   email: "john.doe@example.com"
 *                   profilePicture: "profile.jpg"
 *                 createdAt: "2025-01-15T10:30:00.000Z"
 *                 updatedAt: "2025-01-15T10:30:00.000Z"
 *       400:
 *         description: Validation error or invalid file
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - User does not have permission
 *       404:
 *         description: One or more techs/contributors not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/',
  authenticateJWT,
  handleMulterUpload('coverImage'), // Optional file upload
  createProjectPost
);

/**
 * @swagger
 * /api/v1/projects:
 *   get:
 *     summary: Get all projects with pagination and filtering
 *     description: |
 *       Retrieve a paginated list of projects with optional filtering.
 *       Public endpoint - no authentication required.
 *     tags: [Projects]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: createdBy
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by creator ID
 *       - in: query
 *         name: tech
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by tech ID
 *       - in: query
 *         name: featured
 *         schema:
 *           type: boolean
 *         description: Filter by featured status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in title and description
 *     responses:
 *       200:
 *         description: Projects retrieved successfully
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
 *                   example: Projects retrieved successfully
 *                 projects:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Project'
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
 *                       example: 25
 *                     totalPages:
 *                       type: integer
 *                       example: 3
 *                     hasNextPage:
 *                       type: boolean
 *                       example: true
 *                     hasPreviousPage:
 *                       type: boolean
 *                       example: false
 *       400:
 *         description: Validation error in query parameters
 *       500:
 *         description: Internal server error
 */
router.get('/', getProjects);

/**
 * @swagger
 * /api/v1/projects/{id}:
 *   get:
 *     summary: Get a single project by ID
 *     description: |
 *       Retrieve a single project with all its associations (techs, contributors, creator).
 *       Public endpoint - no authentication required.
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project retrieved successfully
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
 *                   example: Project retrieved successfully
 *                 project:
 *                   $ref: '#/components/schemas/Project'
 *       400:
 *         description: Invalid project ID format
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', getProject);

/**
 * @swagger
 * /api/v1/projects/{id}:
 *   patch:
 *     summary: Update a project
 *     description: |
 *       Update an existing project. Only the project creator can update it.
 *
 *       **Cover Image Handling:**
 *       - If a new file is uploaded, it replaces the existing cover image.
 *       - Old cover image is automatically deleted from MinIO.
 *       - To remove cover image, set coverImage to null or empty string.
 *
 *       **Array Fields:**
 *       - When updating techs or contributors with empty arrays, all existing associations will be removed.
 *       - To keep existing associations, omit the field.
 *
 *     tags: [Projects]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProjectUpdate'
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *               description:
 *                 type: string
 *                 maxLength: 5000
 *               coverImage:
 *                 type: string
 *                 format: binary
 *               repoLink:
 *                 type: string
 *                 format: uri
 *               featured:
 *                 type: boolean
 *               techs:
 *                 type: string
 *                 description: JSON string array of tech IDs
 *               contributors:
 *                 type: string
 *                 description: JSON string array of user IDs
 *               partners:
 *                 type: string
 *                 description: JSON string array of partner IDs
 *     responses:
 *       200:
 *         description: Project updated successfully
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
 *                   example: Project updated successfully
 *                 project:
 *                   $ref: '#/components/schemas/Project'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - User is not the project creator
 *       404:
 *         description: Project not found or referenced techs/contributors not found
 *       500:
 *         description: Internal server error
 */
router.patch(
  '/:id',
  authenticateJWT,
  handleMulterUpload('coverImage'), // Optional file upload
  updateProjectPut
);

/**
 * @swagger
 * /api/v1/projects/{id}:
 *   delete:
 *     summary: Delete a project
 *     description: |
 *       Delete a project and all its associations.
 *       Only the project creator can delete it.
 *       Cover image is automatically deleted from MinIO.
 *     tags: [Projects]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project deleted successfully
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
 *                   example: Project deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - User is not the project creator
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', authenticateJWT, deleteProjectDelete);

// Management Endpoints

/**
 * @swagger
 * /api/v1/projects/{id}/techs:
 *   post:
 *     summary: Add techs to a project
 *     description: |
 *       Add techs to an existing project.
 *       Only the project creator can modify techs.
 *       Duplicate techs are ignored.
 *     tags: [Projects]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ManageTechsRequest'
 *     responses:
 *       200:
 *         description: Techs added successfully
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
 *                   example: Techs added successfully
 *                 project:
 *                   $ref: '#/components/schemas/Project'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - User is not the project creator
 *       404:
 *         description: Project not found or techs not found
 *       500:
 *         description: Internal server error
 */
router.post('/:id/techs', authenticateJWT, addTechs);

/**
 * @swagger
 * /api/v1/projects/{id}/techs:
 *   delete:
 *     summary: Remove techs from a project
 *     description: |
 *       Remove techs from an existing project.
 *       Only the project creator can modify techs.
 *       Non-existent techs are silently ignored.
 *     tags: [Projects]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ManageTechsRequest'
 *     responses:
 *       200:
 *         description: Techs removed successfully
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
 *                   example: Techs removed successfully
 *                 project:
 *                   $ref: '#/components/schemas/Project'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - User is not the project creator
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id/techs', authenticateJWT, removeTechs);

/**
 * @swagger
 * /api/v1/projects/{id}/contributors:
 *   post:
 *     summary: Add contributors to a project
 *     description: |
 *       Add contributors to an existing project.
 *       Only the project creator can modify contributors.
 *       Duplicate contributors are ignored.
 *       Project creator cannot be added as a contributor.
 *     tags: [Projects]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ManageContributorsRequest'
 *     responses:
 *       200:
 *         description: Contributors added successfully
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
 *                   example: Contributors added successfully
 *                 project:
 *                   $ref: '#/components/schemas/Project'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - User is not the project creator
 *       404:
 *         description: Project not found or users not found
 *       500:
 *         description: Internal server error
 */
router.post('/:id/contributors', authenticateJWT, addContributors);

/**
 * @swagger
 * /api/v1/projects/{id}/contributors:
 *   delete:
 *     summary: Remove contributors from a project
 *     description: |
 *       Remove contributors from an existing project.
 *       Only the project creator can modify contributors.
 *       Non-existent contributors are silently ignored.
 *       Project creator cannot be removed as a contributor.
 *     tags: [Projects]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ManageContributorsRequest'
 *     responses:
 *       200:
 *         description: Contributors removed successfully
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
 *                   example: Contributors removed successfully
 *                 project:
 *                   $ref: '#/components/schemas/Project'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - User is not the project creator
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id/contributors', authenticateJWT, removeContributors);

module.exports = router;
