// -------------------------------------------------------
// STEP 1: Mock service dependencies BEFORE controller import
// -------------------------------------------------------
const mockGetAllTechs = jest.fn();
const mockGetTechById = jest.fn();
const mockCreateTech = jest.fn();
const mockUpdateTech = jest.fn();
const mockDeleteTech = jest.fn();
const mockSearchTechs = jest.fn();
const mockBatchCreateTechs = jest.fn();
const mockUpdateTechIcon = jest.fn();
const mockBatchCreateTechsValidate = jest.fn();

jest.mock('../../services/techService', () => ({
  getAllTechs: mockGetAllTechs,
  getTechById: mockGetTechById,
  createTech: mockCreateTech,
  updateTech: mockUpdateTech,
  deleteTech: mockDeleteTech,
  searchTechs: mockSearchTechs,
  batchCreateTechs: mockBatchCreateTechs,
  updateTechIcon: mockUpdateTechIcon,
}));

// -------------------------------------------------------
// STEP 2: Mock logger
// -------------------------------------------------------
jest.mock('../../utils/logger', () => {
  return jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }));
});

// -------------------------------------------------------
// STEP 3: Mock asyncHandler (transparent in tests)
// -------------------------------------------------------
jest.mock('../../middleware/errorHandler', () => ({
  asyncHandler: (fn) => fn,
}));

// -------------------------------------------------------
// STEP 4: Mock validator schemas (Joi schemas)
// -------------------------------------------------------
const mockCreateTechValidate = jest.fn();
const mockUpdateTechValidate = jest.fn();
const mockTechSearchQueryValidate = jest.fn();

jest.mock('../../utils/validator', () => {
  const actual = jest.requireActual('../../utils/validator');
  return {
    ...actual,
    createTechSchema: {
      validate: (...args) => mockCreateTechValidate(...args),
    },
    updateTechSchema: {
      validate: (...args) => mockUpdateTechValidate(...args),
    },
    techSearchQuerySchema: {
      validate: (...args) => mockTechSearchQueryValidate(...args),
    },
    batchCreateTechsSchema: {
      validate: (...args) => mockBatchCreateTechsValidate(...args),
    },
  };
});

// -------------------------------------------------------
// STEP 5: Mock Validator utility
// -------------------------------------------------------
const mockValidatorValidate = jest.fn();

jest.mock('../../utils/index', () => ({
  validate: (...args) => mockValidatorValidate(...args),
}));

// -------------------------------------------------------
// STEP 6: Import controller after mocks
// -------------------------------------------------------
const {
  getAllTechsController,
  getTechByIdController,
  createTechController,
  updateTechController,
  deleteTechController,
  batchCreateTechsController,
  updateTechIconController,
} = require('../../controllers/techController');
const {
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} = require('../../utils/customErrors');

// -------------------------------------------------------
// STEP 7: Helpers
// -------------------------------------------------------
const mockRequest = (overrides = {}) => ({
  user: { id: 'user-123', email: 'admin@example.com', role: 'ADMIN' },
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

describe('TECH_CONTROLLER', () => {
  const mockTech = {
    id: 'tech-123',
    name: 'React',
    icon: 'react-icon.png',
    description: 'JavaScript library for building user interfaces',
    createdBy: 'user-456',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ======================================================
  // getAllTechsController TESTS
  // ======================================================
  describe('getAllTechsController', () => {
    it('returns 200 with paginated techs when validation passes', async () => {
      const req = mockRequest({ query: { page: '1', pageSize: '10' } });
      const res = mockResponse();

      mockTechSearchQueryValidate.mockReturnValue({
        error: null,
        value: { page: 1, pageSize: 10, search: '' },
      });

      const mockResult = {
        success: true,
        data: [mockTech],
        pagination: {
          page: 1,
          pageSize: 10,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
          search: '',
        },
      };

      mockGetAllTechs.mockResolvedValue(mockResult);

      await getAllTechsController(req, res);

      expect(mockTechSearchQueryValidate).toHaveBeenCalledWith(req.query, { abortEarly: false });
      expect(mockGetAllTechs).toHaveBeenCalledWith({ page: 1, pageSize: 10, search: '' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Techs retrieved successfully',
        ...mockResult,
      });
    });

    it('includes search parameter when provided', async () => {
      const req = mockRequest({ query: { page: '1', pageSize: '10', search: 'react' } });
      const res = mockResponse();

      mockTechSearchQueryValidate.mockReturnValue({
        error: null,
        value: { page: 1, pageSize: 10, search: 'react' },
      });

      const mockResult = {
        success: true,
        data: [mockTech],
        pagination: {
          page: 1,
          pageSize: 10,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
          search: 'react',
        },
      };

      mockGetAllTechs.mockResolvedValue(mockResult);

      await getAllTechsController(req, res);

      expect(mockGetAllTechs).toHaveBeenCalledWith({ page: 1, pageSize: 10, search: 'react' });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('uses default pagination values when query params are missing', async () => {
      const req = mockRequest({ query: {} });
      const res = mockResponse();

      mockTechSearchQueryValidate.mockReturnValue({
        error: null,
        value: { page: 1, pageSize: 10, search: '' },
      });

      const mockResult = {
        success: true,
        data: [],
        pagination: {
          page: 1,
          pageSize: 10,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
          search: '',
        },
      };

      mockGetAllTechs.mockResolvedValue(mockResult);

      await getAllTechsController(req, res);

      expect(mockGetAllTechs).toHaveBeenCalledWith({ page: 1, pageSize: 10, search: '' });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('throws ValidationError when query validation fails', async () => {
      const req = mockRequest({ query: { page: 'invalid' } });
      const res = mockResponse();

      mockTechSearchQueryValidate.mockReturnValue({
        error: { details: [{ message: 'Page must be a number' }] },
        value: null,
      });

      await expect(getAllTechsController(req, res)).rejects.toThrow(ValidationError);
      expect(mockGetAllTechs).not.toHaveBeenCalled();
    });

    it('propagates service errors', async () => {
      const req = mockRequest({ query: { page: '1', pageSize: '10' } });
      const res = mockResponse();

      mockTechSearchQueryValidate.mockReturnValue({
        error: null,
        value: { page: 1, pageSize: 10, search: '' },
      });

      const serviceError = new Error('Database error');
      mockGetAllTechs.mockRejectedValue(serviceError);

      await expect(getAllTechsController(req, res)).rejects.toThrow('Database error');
      expect(mockGetAllTechs).toHaveBeenCalled();
    });
  });

  // ======================================================
  // getTechByIdController TESTS
  // ======================================================
  describe('getTechByIdController', () => {
    it('returns 200 with tech data when tech exists', async () => {
      const req = mockRequest({ params: { id: 'tech-123' } });
      const res = mockResponse();

      mockGetTechById.mockResolvedValue(mockTech);

      await getTechByIdController(req, res);

      expect(mockGetTechById).toHaveBeenCalledWith('tech-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Tech retrieved successfully',
        tech: mockTech,
      });
    });

    it('throws NotFoundError when tech does not exist', async () => {
      const req = mockRequest({ params: { id: 'tech-999' } });
      const res = mockResponse();

      const notFoundError = new NotFoundError('Tech not found');
      mockGetTechById.mockRejectedValue(notFoundError);

      await expect(getTechByIdController(req, res)).rejects.toThrow(NotFoundError);
      expect(mockGetTechById).toHaveBeenCalledWith('tech-999');
    });

    it('propagates service errors', async () => {
      const req = mockRequest({ params: { id: 'tech-123' } });
      const res = mockResponse();

      const serviceError = new Error('Database error');
      mockGetTechById.mockRejectedValue(serviceError);

      await expect(getTechByIdController(req, res)).rejects.toThrow('Database error');
      expect(mockGetTechById).toHaveBeenCalledWith('tech-123');
    });
  });

  // ======================================================
  // createTechController TESTS
  // ======================================================
  describe('createTechController', () => {
    const techData = {
      name: 'Vue.js',
      icon: 'vue-icon.png',
      description: 'Progressive JavaScript Framework',
    };

    it('returns 201 with created tech when validation passes', async () => {
      const req = mockRequest({ body: techData });
      const res = mockResponse();

      mockValidatorValidate.mockReturnValue({ _value: techData });

      const createdTech = {
        ...mockTech,
        ...techData,
        id: 'tech-new',
        createdBy: 'user-123',
      };
      mockCreateTech.mockResolvedValue(createdTech);

      await createTechController(req, res);

      expect(mockValidatorValidate).toHaveBeenCalledWith(
        expect.objectContaining({ validate: expect.any(Function) }),
        techData
      );
      expect(mockCreateTech).toHaveBeenCalledWith(techData, 'user-123');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Tech created successfully',
        tech: createdTech,
      });
    });

    it('creates tech without user (null createdBy)', async () => {
      const req = mockRequest({ body: techData, user: null });
      const res = mockResponse();

      mockValidatorValidate.mockReturnValue({ _value: techData });

      const createdTech = {
        ...mockTech,
        ...techData,
        createdBy: null,
      };
      mockCreateTech.mockResolvedValue(createdTech);

      await createTechController(req, res);

      expect(mockCreateTech).toHaveBeenCalledWith(techData, null);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('creates tech with minimal required data', async () => {
      const minimalData = { name: 'Node.js' };
      const req = mockRequest({ body: minimalData });
      const res = mockResponse();

      mockValidatorValidate.mockReturnValue({ _value: minimalData });

      const createdTech = {
        ...mockTech,
        ...minimalData,
        icon: null,
        description: null,
      };
      mockCreateTech.mockResolvedValue(createdTech);

      await createTechController(req, res);

      expect(mockCreateTech).toHaveBeenCalledWith(minimalData, 'user-123');
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('throws ValidationError when request body validation fails', async () => {
      const req = mockRequest({ body: { name: '' } }); // Invalid: empty name
      const res = mockResponse();

      const validationError = new ValidationError('Validation failed', ['Name is required']);
      mockValidatorValidate.mockImplementation(() => {
        throw validationError;
      });

      await expect(createTechController(req, res)).rejects.toThrow(ValidationError);
      expect(mockCreateTech).not.toHaveBeenCalled();
    });

    it('throws ConflictError when tech name already exists', async () => {
      const req = mockRequest({ body: techData });
      const res = mockResponse();

      mockValidatorValidate.mockReturnValue({ _value: techData });

      const conflictError = new ConflictError(`Tech with name "${techData.name}" already exists`);
      mockCreateTech.mockRejectedValue(conflictError);

      await expect(createTechController(req, res)).rejects.toThrow(ConflictError);
      expect(mockCreateTech).toHaveBeenCalledWith(techData, 'user-123');
    });

    it('propagates service errors', async () => {
      const req = mockRequest({ body: techData });
      const res = mockResponse();

      mockValidatorValidate.mockReturnValue({ _value: techData });

      const serviceError = new Error('Database error');
      mockCreateTech.mockRejectedValue(serviceError);

      await expect(createTechController(req, res)).rejects.toThrow('Database error');
      expect(mockCreateTech).toHaveBeenCalled();
    });
  });

  // ======================================================
  // updateTechController TESTS
  // ======================================================
  describe('updateTechController', () => {
    const updateData = {
      name: 'React.js',
      description: 'Updated description',
    };

    it('returns 200 with updated tech when validation passes', async () => {
      const req = mockRequest({
        params: { id: 'tech-123' },
        body: updateData,
      });
      const res = mockResponse();

      mockValidatorValidate.mockReturnValue({ _value: updateData });

      const updatedTech = {
        ...mockTech,
        ...updateData,
      };
      mockUpdateTech.mockResolvedValue(updatedTech);

      await updateTechController(req, res);

      expect(mockValidatorValidate).toHaveBeenCalledWith(
        expect.objectContaining({ validate: expect.any(Function) }),
        updateData
      );
      expect(mockUpdateTech).toHaveBeenCalledWith('tech-123', updateData, 'user-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Tech updated successfully',
        tech: updatedTech,
      });
    });

    it('handles partial updates', async () => {
      const partialData = { description: 'New description only' };
      const req = mockRequest({
        params: { id: 'tech-123' },
        body: partialData,
      });
      const res = mockResponse();

      mockValidatorValidate.mockReturnValue({ _value: partialData });

      const updatedTech = {
        ...mockTech,
        description: 'New description only',
      };
      mockUpdateTech.mockResolvedValue(updatedTech);

      await updateTechController(req, res);

      expect(mockUpdateTech).toHaveBeenCalledWith('tech-123', partialData, 'user-123');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('updates tech without user (null updatedBy)', async () => {
      const req = mockRequest({
        params: { id: 'tech-123' },
        body: updateData,
        user: null,
      });
      const res = mockResponse();

      mockValidatorValidate.mockReturnValue({ _value: updateData });

      mockUpdateTech.mockResolvedValue({ ...mockTech, ...updateData });

      await updateTechController(req, res);

      expect(mockUpdateTech).toHaveBeenCalledWith('tech-123', updateData, null);
    });

    it('throws NotFoundError when tech does not exist', async () => {
      const req = mockRequest({
        params: { id: 'tech-999' },
        body: updateData,
      });
      const res = mockResponse();

      mockValidatorValidate.mockReturnValue({ _value: updateData });

      const notFoundError = new NotFoundError('Tech not found');
      mockUpdateTech.mockRejectedValue(notFoundError);

      await expect(updateTechController(req, res)).rejects.toThrow(NotFoundError);
      expect(mockUpdateTech).toHaveBeenCalledWith('tech-999', updateData, 'user-123');
    });

    it('throws ConflictError when new name already exists', async () => {
      const req = mockRequest({
        params: { id: 'tech-123' },
        body: { name: 'ExistingName' },
      });
      const res = mockResponse();

      mockValidatorValidate.mockReturnValue({ _value: { name: 'ExistingName' } });

      const conflictError = new ConflictError('Tech with name "ExistingName" already exists');
      mockUpdateTech.mockRejectedValue(conflictError);

      await expect(updateTechController(req, res)).rejects.toThrow(ConflictError);
      expect(mockUpdateTech).toHaveBeenCalled();
    });

    it('throws ValidationError when request body validation fails', async () => {
      const req = mockRequest({
        params: { id: 'tech-123' },
        body: { name: '' }, // Invalid: empty name
      });
      const res = mockResponse();

      const validationError = new ValidationError('Validation failed', ['Name cannot be empty']);
      mockValidatorValidate.mockImplementation(() => {
        throw validationError;
      });

      await expect(updateTechController(req, res)).rejects.toThrow(ValidationError);
      expect(mockUpdateTech).not.toHaveBeenCalled();
    });

    it('propagates service errors', async () => {
      const req = mockRequest({
        params: { id: 'tech-123' },
        body: updateData,
      });
      const res = mockResponse();

      mockValidatorValidate.mockReturnValue({ _value: updateData });

      const serviceError = new Error('Database error');
      mockUpdateTech.mockRejectedValue(serviceError);

      await expect(updateTechController(req, res)).rejects.toThrow('Database error');
      expect(mockUpdateTech).toHaveBeenCalled();
    });
  });

  // ======================================================
  // deleteTechController TESTS
  // ======================================================
  describe('deleteTechController', () => {
    it('returns 200 when tech is deleted successfully', async () => {
      const req = mockRequest({ params: { id: 'tech-123' } });
      const res = mockResponse();

      mockDeleteTech.mockResolvedValue(true);

      await deleteTechController(req, res);

      expect(mockDeleteTech).toHaveBeenCalledWith('tech-123', 'user-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Tech deleted successfully',
      });
    });

    it('deletes tech without user (null deletedBy)', async () => {
      const req = mockRequest({
        params: { id: 'tech-123' },
        user: null,
      });
      const res = mockResponse();

      mockDeleteTech.mockResolvedValue(true);

      await deleteTechController(req, res);

      expect(mockDeleteTech).toHaveBeenCalledWith('tech-123', null);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('throws NotFoundError when tech does not exist', async () => {
      const req = mockRequest({ params: { id: 'tech-999' } });
      const res = mockResponse();

      const notFoundError = new NotFoundError('Tech not found');
      mockDeleteTech.mockRejectedValue(notFoundError);

      await expect(deleteTechController(req, res)).rejects.toThrow(NotFoundError);
      expect(mockDeleteTech).toHaveBeenCalledWith('tech-999', 'user-123');
    });

    it('propagates service errors', async () => {
      const req = mockRequest({ params: { id: 'tech-123' } });
      const res = mockResponse();

      const serviceError = new Error('Database error');
      mockDeleteTech.mockRejectedValue(serviceError);

      await expect(deleteTechController(req, res)).rejects.toThrow('Database error');
      expect(mockDeleteTech).toHaveBeenCalledWith('tech-123', 'user-123');
    });
  });

  // ======================================================
  // Edge Cases
  // ======================================================
  describe('Edge Cases', () => {
    it('handles empty search string in getAllTechsController', async () => {
      const req = mockRequest({ query: { search: '' } });
      const res = mockResponse();

      mockTechSearchQueryValidate.mockReturnValue({
        error: null,
        value: { page: 1, pageSize: 10, search: '' },
      });

      mockGetAllTechs.mockResolvedValue({
        success: true,
        data: [],
        pagination: {
          page: 1,
          pageSize: 10,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
          search: '',
        },
      });

      await getAllTechsController(req, res);

      expect(mockGetAllTechs).toHaveBeenCalledWith({
        page: 1,
        pageSize: 10,
        search: '',
      });
    });

    it('handles whitespace in search string', async () => {
      const req = mockRequest({ query: { search: '  react  ' } });
      const res = mockResponse();

      mockTechSearchQueryValidate.mockReturnValue({
        error: null,
        value: { page: 1, pageSize: 10, search: '  react  ' },
      });

      mockGetAllTechs.mockResolvedValue({
        success: true,
        data: [mockTech],
        pagination: {
          page: 1,
          pageSize: 10,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
          search: '  react  ',
        },
      });

      await getAllTechsController(req, res);

      expect(mockGetAllTechs).toHaveBeenCalledWith({
        page: 1,
        pageSize: 10,
        search: '  react  ',
      });
    });

    it('handles missing optional fields in create', async () => {
      const minimalTech = { name: 'Minimal Tech' };
      const req = mockRequest({ body: minimalTech });
      const res = mockResponse();

      mockValidatorValidate.mockReturnValue({ _value: minimalTech });

      const createdTech = {
        ...mockTech,
        ...minimalTech,
        icon: null,
        description: null,
      };
      mockCreateTech.mockResolvedValue(createdTech);

      await createTechController(req, res);

      expect(mockCreateTech).toHaveBeenCalledWith(minimalTech, 'user-123');
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('handles empty update body (no changes)', async () => {
      const req = mockRequest({
        params: { id: 'tech-123' },
        body: {},
      });
      const res = mockResponse();

      mockValidatorValidate.mockReturnValue({ _value: {} });

      mockUpdateTech.mockResolvedValue(mockTech);

      await updateTechController(req, res);

      expect(mockUpdateTech).toHaveBeenCalledWith('tech-123', {}, 'user-123');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('handles deletion of non-existent tech', async () => {
      const req = mockRequest({ params: { id: 'non-existent-id' } });
      const res = mockResponse();

      const notFoundError = new NotFoundError('Tech not found');
      mockDeleteTech.mockRejectedValue(notFoundError);

      await expect(deleteTechController(req, res)).rejects.toThrow(NotFoundError);
      expect(mockDeleteTech).toHaveBeenCalledWith('non-existent-id', 'user-123');
    });
  });

  // ======================================================
  // batchCreateTechsController TESTS
  // ======================================================
  describe('batchCreateTechsController', () => {
    const batchTechsData = [
      { name: 'React', description: 'UI library' },
      { name: 'Node.js', description: 'Runtime' },
    ];

    const mockBatchResult = {
      success: true,
      created: [
        { id: 'tech-1', name: 'React', description: 'UI library', createdBy: 'user-123' },
        { id: 'tech-2', name: 'Node.js', description: 'Runtime', createdBy: 'user-123' },
      ],
      skipped: [],
      errors: [],
      summary: {
        total: 2,
        created: 2,
        skipped: 0,
        errors: 0,
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('returns 201 when batch creating techs successfully', async () => {
      const req = mockRequest({
        body: batchTechsData,
      });
      const res = mockResponse();

      mockBatchCreateTechsValidate.mockReturnValue({
        error: null,
        value: batchTechsData,
      });

      mockBatchCreateTechs.mockResolvedValue(mockBatchResult);

      await batchCreateTechsController(req, res);

      expect(mockBatchCreateTechsValidate).toHaveBeenCalledWith(batchTechsData, {
        abortEarly: false,
      });
      expect(mockBatchCreateTechs).toHaveBeenCalledWith(batchTechsData, 'user-123');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Techs batch created successfully',
        ...mockBatchResult,
      });
    });

    it('handles mixed results with duplicates and errors', async () => {
      const req = mockRequest({
        body: batchTechsData,
      });
      const res = mockResponse();

      mockBatchCreateTechsValidate.mockReturnValue({
        error: null,
        value: batchTechsData,
      });

      const mixedResult = {
        ...mockBatchResult,
        created: [mockBatchResult.created[0]],
        skipped: [{ index: 1, name: 'Node.js', reason: 'Already exists' }],
        summary: { total: 2, created: 1, skipped: 1, errors: 0 },
      };

      mockBatchCreateTechs.mockResolvedValue(mixedResult);

      await batchCreateTechsController(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json.mock.calls[0][0].summary.created).toBe(1);
      expect(res.json.mock.calls[0][0].summary.skipped).toBe(1);
    });

    it('throws ValidationError when batch data validation fails', async () => {
      const req = mockRequest({
        body: [{ name: '' }], // Invalid: empty name
      });
      const res = mockResponse();

      mockBatchCreateTechsValidate.mockReturnValue({
        error: { details: [{ message: 'Name cannot be empty' }] },
        value: null,
      });

      await expect(batchCreateTechsController(req, res)).rejects.toThrow(ValidationError);
      expect(mockBatchCreateTechs).not.toHaveBeenCalled();
    });

    it('throws ValidationError when batch is empty', async () => {
      const req = mockRequest({
        body: [],
      });
      const res = mockResponse();

      mockBatchCreateTechsValidate.mockReturnValue({
        error: { details: [{ message: 'At least one tech is required' }] },
        value: null,
      });

      await expect(batchCreateTechsController(req, res)).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when batch exceeds size limit', async () => {
      const largeBatch = Array(101).fill({ name: 'Tech' });
      const req = mockRequest({
        body: largeBatch,
      });
      const res = mockResponse();

      mockBatchCreateTechsValidate.mockReturnValue({
        error: { details: [{ message: 'Cannot create more than 100 techs at once' }] },
        value: null,
      });

      await expect(batchCreateTechsController(req, res)).rejects.toThrow(ValidationError);
    });

    it('handles service errors', async () => {
      const req = mockRequest({
        body: batchTechsData,
      });
      const res = mockResponse();

      mockBatchCreateTechsValidate.mockReturnValue({
        error: null,
        value: batchTechsData,
      });

      const serviceError = new Error('Database connection failed');
      mockBatchCreateTechs.mockRejectedValue(serviceError);

      await expect(batchCreateTechsController(req, res)).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('creates techs without user (null createdBy)', async () => {
      const req = mockRequest({
        body: batchTechsData,
        user: null,
      });
      const res = mockResponse();

      mockBatchCreateTechsValidate.mockReturnValue({
        error: null,
        value: batchTechsData,
      });

      mockBatchCreateTechs.mockResolvedValue(mockBatchResult);

      await batchCreateTechsController(req, res);

      expect(mockBatchCreateTechs).toHaveBeenCalledWith(batchTechsData, null);
    });
  });

  // ======================================================
  // updateTechIconController TESTS
  // ======================================================
  describe('updateTechIconController', () => {
    const mockFile = {
      buffer: Buffer.from('fake-image'),
      originalname: 'icon.png',
      mimetype: 'image/png',
    };

    const mockTech = {
      id: 'tech-123',
      name: 'React',
      icon: 'new-icon-url.png',
      createdBy: 'user-456',
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('returns 200 when updating icon successfully', async () => {
      const req = mockRequest({
        params: { id: 'tech-123' },
        file: mockFile,
        user: { id: 'user-123', hasRole: jest.fn().mockReturnValue(true) },
      });
      const res = mockResponse();

      mockUpdateTechIcon.mockResolvedValue(mockTech);

      await updateTechIconController(req, res);

      expect(mockUpdateTechIcon).toHaveBeenCalledWith(
        'tech-123',
        mockFile.buffer,
        mockFile.originalname,
        mockFile.mimetype,
        'user-123',
        true
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Tech icon updated successfully',
        tech: mockTech,
      });
    });

    it('returns 200 when creator (non-admin) updates icon', async () => {
      const req = mockRequest({
        params: { id: 'tech-123' },
        file: mockFile,
        user: {
          id: 'user-456', // Same as createdBy
          hasRole: jest.fn().mockReturnValue(false), // Not admin
        },
      });
      const res = mockResponse();

      mockUpdateTechIcon.mockResolvedValue(mockTech);

      await updateTechIconController(req, res);

      expect(mockUpdateTechIcon).toHaveBeenCalledWith(
        'tech-123',
        mockFile.buffer,
        mockFile.originalname,
        mockFile.mimetype,
        'user-456',
        false
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('throws ValidationError when no file is uploaded', async () => {
      const req = mockRequest({
        params: { id: 'tech-123' },
        file: null, // No file
        user: { id: 'user-123', hasRole: jest.fn().mockReturnValue(true) },
      });
      const res = mockResponse();

      await expect(updateTechIconController(req, res)).rejects.toThrow(ValidationError);
      expect(mockUpdateTechIcon).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when tech does not exist', async () => {
      const req = mockRequest({
        params: { id: 'tech-999' },
        file: mockFile,
        user: { id: 'user-123', hasRole: jest.fn().mockReturnValue(true) },
      });
      const res = mockResponse();

      const notFoundError = new NotFoundError('Tech not found');
      mockUpdateTechIcon.mockRejectedValue(notFoundError);

      await expect(updateTechIconController(req, res)).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when non-admin non-creator tries to update', async () => {
      const req = mockRequest({
        params: { id: 'tech-123' },
        file: mockFile,
        user: {
          id: 'user-999', // Different user
          hasRole: jest.fn().mockReturnValue(false), // Not admin
        },
      });
      const res = mockResponse();

      const forbiddenError = new ForbiddenError(
        'You do not have permission to update this tech icon'
      );
      mockUpdateTechIcon.mockRejectedValue(forbiddenError);

      await expect(updateTechIconController(req, res)).rejects.toThrow(ForbiddenError);
    });

    it('handles upload service errors', async () => {
      const req = mockRequest({
        params: { id: 'tech-123' },
        file: mockFile,
        user: { id: 'user-123', hasRole: jest.fn().mockReturnValue(true) },
      });
      const res = mockResponse();

      const uploadError = new Error('Failed to upload to storage');
      mockUpdateTechIcon.mockRejectedValue(uploadError);

      await expect(updateTechIconController(req, res)).rejects.toThrow(
        'Failed to upload to storage'
      );
    });

    it('handles missing user gracefully', async () => {
      const req = mockRequest({
        params: { id: 'tech-123' },
        file: mockFile,
        user: null, // No user
      });
      const res = mockResponse();

      // This should throw an error since user.id is required
      await expect(updateTechIconController(req, res)).rejects.toThrow();
    });
  });

  // ======================================================
  // Edge Cases for New Features
  // ======================================================
  describe('Edge Cases for Batch and Icon Features', () => {
    it('handles batch with special characters in names', async () => {
      const specialTechs = [
        { name: 'C#', description: 'C Sharp' },
        { name: 'C++', description: 'C Plus Plus' },
        { name: '.NET', description: 'Dot NET' },
      ];

      const req = mockRequest({ body: specialTechs });
      const res = mockResponse();

      mockBatchCreateTechsValidate.mockReturnValue({
        error: null,
        value: specialTechs,
      });

      mockBatchCreateTechs.mockResolvedValue({
        success: true,
        created: specialTechs.map((t, i) => ({ ...t, id: `tech-${i}` })),
        skipped: [],
        errors: [],
        summary: { total: 3, created: 3, skipped: 0, errors: 0 },
      });

      await batchCreateTechsController(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('handles batch with very long descriptions', async () => {
      const longDesc = 'A'.repeat(2000); // Max length
      const techsData = [{ name: 'Test Tech', description: longDesc }];

      const req = mockRequest({ body: techsData });
      const res = mockResponse();

      mockBatchCreateTechsValidate.mockReturnValue({
        error: null,
        value: techsData,
      });

      await batchCreateTechsController(req, res);

      expect(mockBatchCreateTechs).toHaveBeenCalled();
    });

    it('handles icon update with different file extensions', async () => {
      const testCases = [
        { filename: 'icon.jpg', mimetype: 'image/jpeg' },
        { filename: 'icon.png', mimetype: 'image/png' },
        { filename: 'icon.gif', mimetype: 'image/gif' },
        { filename: 'icon.webp', mimetype: 'image/webp' },
        { filename: 'icon.svg', mimetype: 'image/svg+xml' },
      ];

      for (const testCase of testCases) {
        const req = mockRequest({
          params: { id: 'tech-123' },
          file: {
            buffer: Buffer.from('data'),
            originalname: testCase.filename,
            mimetype: testCase.mimetype,
          },
          user: { id: 'user-123', hasRole: jest.fn().mockReturnValue(true) },
        });
        const res = mockResponse();

        mockUpdateTechIcon.mockResolvedValue({
          id: 'tech-123',
          name: 'React',
          icon: `new-${testCase.filename}`,
        });

        await updateTechIconController(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        jest.clearAllMocks();
      }
    });

    it('handles batch creation with partial success', async () => {
      const techsData = [
        { name: 'Success1' },
        { name: '' }, // Should error
        { name: 'Success2' },
        { name: 'Success1' }, // Duplicate in same batch
        { name: 'Success3' },
      ];

      const req = mockRequest({ body: techsData });
      const res = mockResponse();

      mockBatchCreateTechsValidate.mockReturnValue({
        error: null,
        value: techsData,
      });

      const result = {
        success: true,
        created: [
          { id: 'tech-1', name: 'Success1' },
          { id: 'tech-2', name: 'Success2' },
          { id: 'tech-3', name: 'Success3' },
        ],
        skipped: [{ index: 3, name: 'Success1', reason: 'Duplicate in batch' }],
        errors: [{ index: 1, name: '', error: 'Name is required' }],
        summary: { total: 5, created: 3, skipped: 1, errors: 1 },
      };

      mockBatchCreateTechs.mockResolvedValue(result);

      await batchCreateTechsController(req, res);

      expect(res.json.mock.calls[0][0].summary.created).toBe(3);
      expect(res.json.mock.calls[0][0].summary.errors).toBe(1);
    });

    it('handles icon update when tech has no existing icon', async () => {
      const req = mockRequest({
        params: { id: 'tech-123' },
        file: {
          buffer: Buffer.from('data'),
          originalname: 'icon.png',
          mimetype: 'image/png',
        },
        user: { id: 'user-123', hasRole: jest.fn().mockReturnValue(true) },
      });
      const res = mockResponse();

      mockUpdateTechIcon.mockResolvedValue({
        id: 'tech-123',
        name: 'React',
        icon: 'first-icon.png', // First icon
        createdBy: 'user-123',
      });

      await updateTechIconController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].tech.icon).toBe('first-icon.png');
    });

    it('handles icon update when replacing existing icon', async () => {
      const req = mockRequest({
        params: { id: 'tech-123' },
        file: {
          buffer: Buffer.from('new-data'),
          originalname: 'new-icon.png',
          mimetype: 'image/png',
        },
        user: { id: 'user-123', hasRole: jest.fn().mockReturnValue(true) },
      });
      const res = mockResponse();

      mockUpdateTechIcon.mockResolvedValue({
        id: 'tech-123',
        name: 'React',
        icon: 'new-icon.png', // Replaced icon
        createdBy: 'user-123',
      });

      await updateTechIconController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].tech.icon).toBe('new-icon.png');
    });
  });
});
