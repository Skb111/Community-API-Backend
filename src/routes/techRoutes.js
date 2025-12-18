const express = require('express');
const {
  getAllTechsController,
  getTechByIdController,
  createTechController,
  updateTechController,
  deleteTechController,
} = require('../controllers/techController');
const { authenticateJWT, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Techs
 *   description: Technology catalog management
 */

/**
 * @swagger
 * /api/v1/techs:
 *   get:
 *     summary: Get all techs with pagination and search
 *     description: Retrieve a paginated list of all techs in the system, with optional search by name.
 *     tags: [Techs]
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
 *         description: Number of techs per page (max 100)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for tech name
 *     responses:
 *       200:
 *         description: Techs retrieved successfully
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
 *                   example: Techs retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                         example: 123e4567-e89b-12d3-a456-426614174000
 *                       name:
 *                         type: string
 *                         example: React
 *                       icon:
 *                         type: string
 *                         nullable: true
 *                         example: bucketName/imageName.extension
 *                       description:
 *                         type: string
 *                         nullable: true
 *                         example: JavaScript library for UIs
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: 2025-01-15T10:30:00.000Z
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         example: 2025-01-20T14:45:00.000Z
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
 *                     search:
 *                       type: string
 *                       example: react
 *       400:
 *         description: Bad request - Invalid query parameters
 */
router.get('/', getAllTechsController);

/**
 * @swagger
 * /api/v1/techs/{id}:
 *   get:
 *     summary: Get a single tech by ID
 *     description: Retrieve detailed information about a specific tech.
 *     tags: [Techs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Tech ID
 *     responses:
 *       200:
 *         description: Tech retrieved successfully
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
 *                   example: Tech retrieved successfully
 *                 tech:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                       example: 123e4567-e89b-12d3-a456-426614174000
 *                     name:
 *                       type: string
 *                       example: React
 *                     icon:
 *                       type: string
 *                       nullable: true
 *                       example: bucketName/imageName.extension
 *                     description:
 *                       type: string
 *                       nullable: true
 *                       example: JavaScript library for UIs
 *                     createdBy:
 *                       type: string
 *                       format: uuid
 *                       example: 123e4567-e89b-12d3-a456-426614174001
 *                     creator:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         username:
 *                           type: string
 *                         email:
 *                           type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Tech not found
 */
router.get('/:id', getTechByIdController);

/**
 * @swagger
 * /api/v1/techs:
 *   post:
 *     summary: Create a new tech
 *     description: Create a new technology entry (admin only).
 *     tags: [Techs]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: React
 *               icon:
 *                 type: string
 *                 example: bucketName/imageName.extension
 *               description:
 *                 type: string
 *                 example: JavaScript library for UIs
 *     responses:
 *       201:
 *         description: Tech created successfully
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
 *                   example: Tech created successfully
 *                 tech:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                       example: 123e4567-e89b-12d3-a456-426614174000
 *                     name:
 *                       type: string
 *                       example: React
 *                     icon:
 *                       type: string
 *                       nullable: true
 *                       example: bucketName/imageName.extension
 *                     description:
 *                       type: string
 *                       nullable: true
 *                       example: JavaScript library for UIs
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad request - Invalid input data
 *       409:
 *         description: Conflict - Tech with this name already exists
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       403:
 *         description: Forbidden - User is not an admin
 */
router.post('/', authenticateJWT, requireAdmin, createTechController);

/**
 * @swagger
 * /api/v1/techs/{id}:
 *   patch:
 *     summary: Update a tech
 *     description: Update an existing technology entry (admin only).
 *     tags: [Techs]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Tech ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: React.js
 *               icon:
 *                 type: string
 *                 example: bucketName/new-image.extension
 *               description:
 *                 type: string
 *                 example: JavaScript library for building user interfaces
 *     responses:
 *       200:
 *         description: Tech updated successfully
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
 *                   example: Tech updated successfully
 *                 tech:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                     icon:
 *                       type: string
 *                     description:
 *                       type: string
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad request - Invalid input data
 *       404:
 *         description: Tech not found
 *       409:
 *         description: Conflict - Tech with this name already exists
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       403:
 *         description: Forbidden - User is not an admin
 */
router.patch('/:id', authenticateJWT, requireAdmin, updateTechController);

/**
 * @swagger
 * /api/v1/techs/{id}:
 *   delete:
 *     summary: Delete a tech
 *     description: Delete a technology entry (admin only). Checks for active relations before deletion.
 *     tags: [Techs]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Tech ID
 *     responses:
 *       200:
 *         description: Tech deleted successfully
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
 *                   example: Tech deleted successfully
 *       400:
 *         description: Bad request - Tech has active relations
 *       404:
 *         description: Tech not found
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       403:
 *         description: Forbidden - User is not an admin
 */
router.delete('/:id', authenticateJWT, requireAdmin, deleteTechController);

module.exports = router;
