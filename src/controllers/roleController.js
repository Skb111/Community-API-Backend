// controllers/roleController.js
const roleService = require('../services/roleService');
const { assignRoleSchema } = require('../utils/validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { ValidationError } = require('../utils/customErrors');
const createLogger = require('../utils/logger');

const logger = createLogger('ROLE_CONTROLLER');

class RoleController {
  // POST /api/v1/roles/assign
  assignRole = asyncHandler(async (req, res) => {
    const body = req.body || {};
    const { error, value } = assignRoleSchema.validate(body, { abortEarly: false });

    if (error) {
      const errorMessages = error.details.map((detail) => detail.message);
      logger.error(
        `validation error occurred when assigning role reason=${errorMessages.join(', ')}`
      );
      throw new ValidationError('Validation failed', errorMessages);
    }

    // Get caller ID from authenticated user
    const callerId = req.user.id;

    // Assign the role
    const result = await roleService.assignRole(callerId, value.userId, value.role);

    logger.info(`Role assignment success: ${value.userId} -> ${value.role}`);
    return res.status(200).json(result);
  });
}

module.exports = new RoleController();
