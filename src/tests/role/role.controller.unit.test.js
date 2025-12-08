// tests/unit/controllers/roleController.test.js
const roleController = require('../../../src/controllers/roleController');
const roleService = require('../../../src/services/roleService');
const createLogger = require('../../../src/utils/logger');
const { ValidationError } = require('../../../src/utils/customErrors');

// Mock dependencies
jest.mock('../../../src/services/roleService');
jest.mock('../../../src/utils/logger');

// Mock asyncHandler (transparent in tests)
jest.mock('../../../src/middleware/errorHandler', () => ({
  asyncHandler: (fn) => fn,
}));

// Mock validator schema
const mockAssignRoleValidate = jest.fn();
jest.mock('../../../src/utils/validator', () => {
  const actual = jest.requireActual('../../../src/utils/validator');
  return {
    ...actual,
    assignRoleSchema: {
      validate: (...args) => mockAssignRoleValidate(...args),
    },
  };
});

describe('RoleController', () => {
  let req, res, mockLogger;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };
    createLogger.mockReturnValue(mockLogger);

    // Mock request object
    req = {
      body: {
        userId: 'user-123',
        role: 'ADMIN',
      },
      user: {
        id: 'caller-456',
        email: 'admin@test.com',
        role: 'ROOT',
      },
    };

    // Mock response object
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('assignRole', () => {
    describe('Success Cases', () => {
      it('should assign role successfully with valid data', async () => {
        // Arrange
        const validatedValue = {
          userId: 'user-123',
          role: 'ADMIN',
        };

        const serviceResponse = {
          success: true,
          message: 'Role updated',
          user: {
            id: 'user-123',
            email: 'user@test.com',
            role: 'ADMIN',
          },
        };

        mockAssignRoleValidate.mockReturnValue({
          error: null,
          value: validatedValue,
        });

        roleService.assignRole.mockResolvedValue(serviceResponse);

        // Act
        await roleController.assignRole(req, res);

        // Assert
        expect(mockAssignRoleValidate).toHaveBeenCalledWith(req.body, { abortEarly: false });
        expect(roleService.assignRole).toHaveBeenCalledWith('caller-456', 'user-123', 'ADMIN');
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(serviceResponse);
      });

      it('should handle USER role assignment', async () => {
        // Arrange
        req.body.role = 'USER';
        const validatedValue = {
          userId: 'user-123',
          role: 'USER',
        };

        const serviceResponse = {
          success: true,
          message: 'Role updated',
          user: {
            id: 'user-123',
            email: 'user@test.com',
            role: 'USER',
          },
        };

        mockAssignRoleValidate.mockReturnValue({
          error: null,
          value: validatedValue,
        });

        roleService.assignRole.mockResolvedValue(serviceResponse);

        // Act
        await roleController.assignRole(req, res);

        // Assert
        expect(roleService.assignRole).toHaveBeenCalledWith('caller-456', 'user-123', 'USER');
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(serviceResponse);
      });
    });

    describe('Validation Errors', () => {
      it('should throw ValidationError when validation fails', async () => {
        // Arrange
        mockAssignRoleValidate.mockReturnValue({
          error: {
            details: [{ message: 'User ID is required' }],
          },
          value: null,
        });

        // Act & Assert
        await expect(roleController.assignRole(req, res)).rejects.toThrow(ValidationError);
        expect(mockAssignRoleValidate).toHaveBeenCalledWith(req.body, { abortEarly: false });
        expect(roleService.assignRole).not.toHaveBeenCalled();
      });

      it('should throw ValidationError for missing userId', async () => {
        // Arrange
        req.body.userId = undefined;
        mockAssignRoleValidate.mockReturnValue({
          error: {
            details: [{ message: 'User ID is required' }],
          },
          value: null,
        });

        // Act & Assert
        await expect(roleController.assignRole(req, res)).rejects.toThrow(ValidationError);
      });

      it('should throw ValidationError for invalid role', async () => {
        // Arrange
        req.body.role = 'INVALID_ROLE';
        mockAssignRoleValidate.mockReturnValue({
          error: {
            details: [{ message: 'Role must be one of: USER, ADMIN' }],
          },
          value: null,
        });

        // Act & Assert
        await expect(roleController.assignRole(req, res)).rejects.toThrow(ValidationError);
      });
    });

    describe('Service Errors', () => {
      it('should return 404 when user not found', async () => {
        // Arrange
        const validatedValue = {
          userId: 'non-existent-user',
          role: 'ADMIN',
        };

        mockAssignRoleValidate.mockReturnValue({
          error: null,
          value: validatedValue,
        });

        const serviceError = new Error('Target user not found');
        serviceError.statusCode = 404;
        roleService.assignRole.mockRejectedValue(serviceError);

        // Act & Assert
        await expect(roleController.assignRole(req, res)).rejects.toThrow('Target user not found');
      });

      it('should return 403 when trying to assign ROOT role', async () => {
        // Arrange
        req.body.role = 'ROOT';
        const validatedValue = {
          userId: 'user-123',
          role: 'ROOT',
        };

        mockAssignRoleValidate.mockReturnValue({
          error: null,
          value: validatedValue,
        });

        const serviceError = new Error(
          'ROOT role cannot be assigned. There can only be one ROOT user.'
        );
        serviceError.statusCode = 403;
        roleService.assignRole.mockRejectedValue(serviceError);

        // Act & Assert
        await expect(roleController.assignRole(req, res)).rejects.toThrow(
          'ROOT role cannot be assigned. There can only be one ROOT user.'
        );
      });

      it('should return 403 when trying to modify own role', async () => {
        // Arrange
        const validatedValue = {
          userId: 'caller-456', // Same as caller
          role: 'USER',
        };

        mockAssignRoleValidate.mockReturnValue({
          error: null,
          value: validatedValue,
        });

        const serviceError = new Error('You cannot modify your own role');
        serviceError.statusCode = 403;
        roleService.assignRole.mockRejectedValue(serviceError);

        // Act & Assert
        await expect(roleController.assignRole(req, res)).rejects.toThrow(
          'You cannot modify your own role'
        );
      });

      it('should return 403 when caller has insufficient permissions', async () => {
        // Arrange
        req.user.role = 'USER'; // Regular user trying to assign role
        const validatedValue = {
          userId: 'user-123',
          role: 'ADMIN',
        };

        mockAssignRoleValidate.mockReturnValue({
          error: null,
          value: validatedValue,
        });

        const serviceError = new Error(
          'Insufficient permissions. Only ADMIN or ROOT can assign ADMIN role.'
        );
        serviceError.statusCode = 403;
        roleService.assignRole.mockRejectedValue(serviceError);

        // Act & Assert
        await expect(roleController.assignRole(req, res)).rejects.toThrow(
          'Insufficient permissions. Only ADMIN or ROOT can assign ADMIN role.'
        );
      });

      it('should return 403 when trying to assign role higher than caller', async () => {
        // Arrange
        req.user.role = 'ADMIN'; // ADMIN trying to assign ROOT
        req.body.role = 'ROOT';
        const validatedValue = {
          userId: 'user-123',
          role: 'ROOT',
        };

        mockAssignRoleValidate.mockReturnValue({
          error: null,
          value: validatedValue,
        });

        const serviceError = new Error('Cannot assign a role higher than your own');
        serviceError.statusCode = 403;
        roleService.assignRole.mockRejectedValue(serviceError);

        // Act & Assert
        await expect(roleController.assignRole(req, res)).rejects.toThrow(
          'Cannot assign a role higher than your own'
        );
      });

      it('should return 500 for unexpected errors without statusCode', async () => {
        // Arrange
        const validatedValue = {
          userId: 'user-123',
          role: 'ADMIN',
        };

        mockAssignRoleValidate.mockReturnValue({
          error: null,
          value: validatedValue,
        });

        const serviceError = new Error('Database connection failed');
        // No statusCode set
        roleService.assignRole.mockRejectedValue(serviceError);

        // Act & Assert
        await expect(roleController.assignRole(req, res)).rejects.toThrow(
          'Database connection failed'
        );
      });
    });

    describe('Edge Cases', () => {
      it('should throw ValidationError for empty request body', async () => {
        // Arrange
        req.body = {};
        mockAssignRoleValidate.mockReturnValue({
          error: {
            details: [{ message: 'User ID is required' }, { message: 'Role is required' }],
          },
          value: null,
        });

        // Act & Assert
        await expect(roleController.assignRole(req, res)).rejects.toThrow(ValidationError);
      });

      it('should extract caller ID from req.user', async () => {
        // Arrange
        const validatedValue = {
          userId: 'user-123',
          role: 'ADMIN',
        };

        mockAssignRoleValidate.mockReturnValue({
          error: null,
          value: validatedValue,
        });

        roleService.assignRole.mockResolvedValue({
          success: true,
          message: 'Role updated',
          user: { id: 'user-123', email: 'user@test.com', role: 'ADMIN' },
        });

        // Act
        await roleController.assignRole(req, res);

        // Assert
        expect(roleService.assignRole).toHaveBeenCalledWith(
          'caller-456', // Extracted from req.user.id
          'user-123',
          'ADMIN'
        );
      });
    });
  });
});
