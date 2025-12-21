/**
 * @file tests/controllers/projectController.unit.test.js
 * @description Unit tests for project controller
 */

// -------------------------------------------------------
// STEP 1: Mock service dependencies BEFORE controller import
// -------------------------------------------------------
const mockCreateProject = jest.fn();
const mockGetAllProjects = jest.fn();
const mockGetProjectById = jest.fn();
const mockUpdateProject = jest.fn();
const mockDeleteProject = jest.fn();
const mockAddTechsToProject = jest.fn();
const mockRemoveTechsFromProject = jest.fn();
const mockAddContributorsToProject = jest.fn();
const mockRemoveContributorsFromProject = jest.fn();

jest.mock('../../services/project/projectService', () => ({
  createProject: mockCreateProject,
  getAllProjects: mockGetAllProjects,
  getProjectById: mockGetProjectById,
  updateProject: mockUpdateProject,
  deleteProject: mockDeleteProject,
  addTechsToProject: mockAddTechsToProject,
  removeTechsFromProject: mockRemoveTechsFromProject,
  addContributorsToProject: mockAddContributorsToProject,
  removeContributorsFromProject: mockRemoveContributorsFromProject,
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
// STEP 3: Mock asyncHandler
// -------------------------------------------------------
jest.mock('../../middleware/errorHandler', () => ({
  asyncHandler: (fn) => fn,
}));

// -------------------------------------------------------
// STEP 4: Mock validator schemas
// -------------------------------------------------------
const mockCreateProjectValidate = jest.fn();
const mockUpdateProjectValidate = jest.fn();
const mockProjectQueryValidate = jest.fn();
const mockProjectIdParamValidate = jest.fn();
const mockManageTechsValidate = jest.fn();
const mockManageContributorsValidate = jest.fn();

jest.mock('../../utils/validator', () => ({
  createProjectSchema: {
    validate: (...args) => mockCreateProjectValidate(...args),
  },
  updateProjectSchema: {
    validate: (...args) => mockUpdateProjectValidate(...args),
  },
  projectQuerySchema: {
    validate: (...args) => mockProjectQueryValidate(...args),
  },
  projectIdParamSchema: {
    validate: (...args) => mockProjectIdParamValidate(...args),
  },
  manageTechsSchema: {
    validate: (...args) => mockManageTechsValidate(...args),
  },
  manageContributorsSchema: {
    validate: (...args) => mockManageContributorsValidate(...args),
  },
}));

// -------------------------------------------------------
// STEP 5: Import controller after mocks
// -------------------------------------------------------
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
} = require('../../controllers/projectController');
const { ValidationError } = require('../../utils/customErrors');

// -------------------------------------------------------
// STEP 6: Helpers
// -------------------------------------------------------
const mockRequest = (overrides = {}) => ({
  user: { id: 'user-123', email: 'test@example.com' },
  file: null,
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

// -------------------------------------------------------
// TEST SUITE
// -------------------------------------------------------
describe('ProjectController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ======================================================
  // createProjectPost TESTS
  // ======================================================
  describe('createProjectPost', () => {
    it('✅ should create project successfully without file', async () => {
      const req = mockRequest({
        body: {
          title: 'Test Project',
          description: 'Test description',
          techs: ['tech-1', 'tech-2'],
          contributors: ['user-456'],
        },
      });
      const res = mockResponse();

      const mockCreatedProject = {
        id: 'project-123',
        title: 'Test Project',
        description: 'Test description',
        createdBy: 'user-123',
        techs: [
          { id: 'tech-1', name: 'React' },
          { id: 'tech-2', name: 'Node.js' },
        ],
        contributors: [{ id: 'user-456', fullname: 'Jane Doe' }],
      };

      mockCreateProjectValidate.mockReturnValue({
        error: null,
        value: req.body,
      });
      mockCreateProject.mockResolvedValue(mockCreatedProject);

      await createProjectPost(req, res);

      expect(mockCreateProject).toHaveBeenCalledWith(req.body, 'user-123', null, null, null);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Project created successfully',
        project: mockCreatedProject,
      });
    });

    it('✅ should create project with cover image file', async () => {
      const req = mockRequest({
        body: {
          title: 'Test Project',
        },
        file: {
          buffer: Buffer.from('fake image data'),
          originalname: 'cover.jpg',
          mimetype: 'image/jpeg',
        },
      });
      const res = mockResponse();

      const mockCreatedProject = {
        id: 'project-123',
        title: 'Test Project',
        coverImage: 'https://minio/project_cover_project-123_1234567890.jpg',
      };

      mockCreateProjectValidate.mockReturnValue({
        error: null,
        value: { title: 'Test Project' }, // coverImage removed from body
      });
      mockCreateProject.mockResolvedValue(mockCreatedProject);

      await createProjectPost(req, res);

      expect(mockCreateProject).toHaveBeenCalledWith(
        { title: 'Test Project' },
        'user-123',
        Buffer.from('fake image data'),
        'cover.jpg',
        'image/jpeg'
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('✅ should parse array fields from JSON strings', async () => {
      const req = mockRequest({
        body: {
          title: 'Test Project',
          techs: '["tech-1", "tech-2"]', // JSON string
          contributors: '["user-456"]',
        },
      });
      const res = mockResponse();

      const mockCreatedProject = {
        id: 'project-123',
        title: 'Test Project',
      };

      mockCreateProjectValidate.mockReturnValue({
        error: null,
        value: {
          title: 'Test Project',
          techs: ['tech-1', 'tech-2'], // Should be parsed
          contributors: ['user-456'],
        },
      });
      mockCreateProject.mockResolvedValue(mockCreatedProject);

      await createProjectPost(req, res);

      expect(mockCreateProject).toHaveBeenCalledWith(
        {
          title: 'Test Project',
          techs: ['tech-1', 'tech-2'],
          contributors: ['user-456'],
        },
        'user-123',
        null,
        null,
        null
      );
    });

    it('❌ should throw ValidationError for invalid JSON arrays', async () => {
      const req = mockRequest({
        body: {
          title: 'Test Project',
          techs: 'invalid-json', // Invalid JSON
        },
      });
      const res = mockResponse();

      await expect(createProjectPost(req, res)).rejects.toThrow(ValidationError);
      expect(mockCreateProject).not.toHaveBeenCalled();
    });

    it('❌ should throw ValidationError when schema validation fails', async () => {
      const req = mockRequest({
        body: { title: '' }, // Invalid - empty title
      });
      const res = mockResponse();

      mockCreateProjectValidate.mockReturnValue({
        error: {
          details: [{ message: 'Title is required' }],
        },
        value: null,
      });

      await expect(createProjectPost(req, res)).rejects.toThrow(ValidationError);
      expect(mockCreateProject).not.toHaveBeenCalled();
    });
  });

  // ======================================================
  // getProjects TESTS
  // ======================================================
  describe('getProjects', () => {
    it('✅ should get projects with pagination', async () => {
      const req = mockRequest({
        query: { page: '1', pageSize: '10', featured: 'true' },
      });
      const res = mockResponse();

      const mockProjectsResult = {
        projects: [
          { id: 'project-1', title: 'Project 1' },
          { id: 'project-2', title: 'Project 2' },
        ],
        pagination: {
          page: 1,
          pageSize: 10,
          totalItems: 2,
          totalPages: 1,
        },
      };

      mockProjectQueryValidate.mockReturnValue({
        error: null,
        value: { page: 1, pageSize: 10, featured: true },
      });
      mockGetAllProjects.mockResolvedValue(mockProjectsResult);

      await getProjects(req, res);

      expect(mockGetAllProjects).toHaveBeenCalledWith({
        page: 1,
        pageSize: 10,
        featured: true,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Projects retrieved successfully',
        ...mockProjectsResult,
      });
    });

    it('❌ should throw ValidationError for invalid query parameters', async () => {
      const req = mockRequest({
        query: { page: 'invalid' }, // Invalid page
      });
      const res = mockResponse();

      mockProjectQueryValidate.mockReturnValue({
        error: {
          details: [{ message: 'Page must be a number' }],
        },
        value: null,
      });

      await expect(getProjects(req, res)).rejects.toThrow(ValidationError);
      expect(mockGetAllProjects).not.toHaveBeenCalled();
    });
  });

  // ======================================================
  // getProject TESTS
  // ======================================================
  describe('getProject', () => {
    it('✅ should get single project by ID', async () => {
      const req = mockRequest({
        params: { id: 'project-123' },
      });
      const res = mockResponse();

      const mockProject = {
        id: 'project-123',
        title: 'Test Project',
        creator: { id: 'user-123', fullname: 'John Doe' },
      };

      mockProjectIdParamValidate.mockReturnValue({
        error: null,
        value: { id: 'project-123' },
      });
      mockGetProjectById.mockResolvedValue(mockProject);

      await getProject(req, res);

      expect(mockGetProjectById).toHaveBeenCalledWith('project-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Project retrieved successfully',
        project: mockProject,
      });
    });

    it('❌ should throw ValidationError for invalid project ID', async () => {
      const req = mockRequest({
        params: { id: 'invalid-uuid' },
      });
      const res = mockResponse();

      mockProjectIdParamValidate.mockReturnValue({
        error: {
          details: [{ message: 'Project ID must be a valid UUID' }],
        },
        value: null,
      });

      await expect(getProject(req, res)).rejects.toThrow(ValidationError);
      expect(mockGetProjectById).not.toHaveBeenCalled();
    });
  });

  // ======================================================
  // updateProjectPut TESTS
  // ======================================================
  describe('updateProjectPut', () => {
    it('✅ should update project successfully', async () => {
      const req = mockRequest({
        params: { id: 'project-123' },
        body: {
          title: 'Updated Project',
          description: 'Updated description',
        },
        user: { id: 'user-123' },
      });
      const res = mockResponse();

      const mockUpdatedProject = {
        id: 'project-123',
        title: 'Updated Project',
        description: 'Updated description',
      };

      mockProjectIdParamValidate.mockReturnValue({
        error: null,
        value: { id: 'project-123' },
      });
      mockUpdateProjectValidate.mockReturnValue({
        error: null,
        value: req.body,
      });
      mockUpdateProject.mockResolvedValue(mockUpdatedProject);

      await updateProjectPut(req, res);

      expect(mockUpdateProject).toHaveBeenCalledWith(
        'project-123',
        req.body,
        'user-123',
        null,
        null,
        null
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Project updated successfully',
        project: mockUpdatedProject,
      });
    });

    it('✅ should update project with cover image file', async () => {
      const req = mockRequest({
        params: { id: 'project-123' },
        body: {
          title: 'Updated Project',
        },
        user: { id: 'user-123' },
        file: {
          buffer: Buffer.from('fake image data'),
          originalname: 'new-cover.jpg',
          mimetype: 'image/jpeg',
        },
      });
      const res = mockResponse();

      const mockUpdatedProject = {
        id: 'project-123',
        title: 'Updated Project',
        coverImage: 'https://minio/new-cover.jpg',
      };

      mockProjectIdParamValidate.mockReturnValue({
        error: null,
        value: { id: 'project-123' },
      });
      mockUpdateProjectValidate.mockReturnValue({
        error: null,
        value: { title: 'Updated Project' },
      });
      mockUpdateProject.mockResolvedValue(mockUpdatedProject);

      await updateProjectPut(req, res);

      expect(mockUpdateProject).toHaveBeenCalledWith(
        'project-123',
        { title: 'Updated Project' },
        'user-123',
        Buffer.from('fake image data'),
        'new-cover.jpg',
        'image/jpeg'
      );
    });

    it('❌ should throw ValidationError for invalid project ID', async () => {
      const req = mockRequest({
        params: { id: 'invalid-uuid' },
        body: { title: 'Updated' },
      });
      const res = mockResponse();

      mockProjectIdParamValidate.mockReturnValue({
        error: {
          details: [{ message: 'Project ID must be a valid UUID' }],
        },
        value: null,
      });

      await expect(updateProjectPut(req, res)).rejects.toThrow(ValidationError);
      expect(mockUpdateProject).not.toHaveBeenCalled();
    });

    it('❌ should throw ValidationError for invalid update data', async () => {
      const req = mockRequest({
        params: { id: 'project-123' },
        body: { title: '' }, // Invalid empty title
      });
      const res = mockResponse();

      mockProjectIdParamValidate.mockReturnValue({
        error: null,
        value: { id: 'project-123' },
      });
      mockUpdateProjectValidate.mockReturnValue({
        error: {
          details: [{ message: 'Title cannot be empty' }],
        },
        value: null,
      });

      await expect(updateProjectPut(req, res)).rejects.toThrow(ValidationError);
      expect(mockUpdateProject).not.toHaveBeenCalled();
    });
  });

  // ======================================================
  // deleteProjectDelete TESTS
  // ======================================================
  describe('deleteProjectDelete', () => {
    it('✅ should delete project successfully', async () => {
      const req = mockRequest({
        params: { id: 'project-123' },
        user: { id: 'user-123' },
      });
      const res = mockResponse();

      mockProjectIdParamValidate.mockReturnValue({
        error: null,
        value: { id: 'project-123' },
      });
      mockDeleteProject.mockResolvedValue({ success: true });

      await deleteProjectDelete(req, res);

      expect(mockDeleteProject).toHaveBeenCalledWith('project-123', 'user-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Project deleted successfully',
      });
    });

    it('❌ should throw ValidationError for invalid project ID', async () => {
      const req = mockRequest({
        params: { id: 'invalid-uuid' },
      });
      const res = mockResponse();

      mockProjectIdParamValidate.mockReturnValue({
        error: {
          details: [{ message: 'Project ID must be a valid UUID' }],
        },
        value: null,
      });

      await expect(deleteProjectDelete(req, res)).rejects.toThrow(ValidationError);
      expect(mockDeleteProject).not.toHaveBeenCalled();
    });
  });

  // ======================================================
  // Management Endpoints TESTS
  // ======================================================
  describe('addTechs', () => {
    it('✅ should add techs to project successfully', async () => {
      const req = mockRequest({
        params: { id: 'project-123' },
        body: { techIds: ['tech-1', 'tech-2'] },
        user: { id: 'user-123' },
      });
      const res = mockResponse();

      const mockUpdatedProject = {
        id: 'project-123',
        techs: [
          { id: 'tech-1', name: 'React' },
          { id: 'tech-2', name: 'Node.js' },
        ],
      };

      mockProjectIdParamValidate.mockReturnValue({
        error: null,
        value: { id: 'project-123' },
      });
      mockManageTechsValidate.mockReturnValue({
        error: null,
        value: { techIds: ['tech-1', 'tech-2'] },
      });
      mockAddTechsToProject.mockResolvedValue(mockUpdatedProject);

      await addTechs(req, res);

      expect(mockAddTechsToProject).toHaveBeenCalledWith(
        'project-123',
        ['tech-1', 'tech-2'],
        'user-123'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Techs added successfully',
        project: mockUpdatedProject,
      });
    });
  });

  describe('removeTechs', () => {
    it('✅ should remove techs from project successfully', async () => {
      const req = mockRequest({
        params: { id: 'project-123' },
        body: { techIds: ['tech-1'] },
        user: { id: 'user-123' },
      });
      const res = mockResponse();

      const mockUpdatedProject = {
        id: 'project-123',
        techs: [],
      };

      mockProjectIdParamValidate.mockReturnValue({
        error: null,
        value: { id: 'project-123' },
      });
      mockManageTechsValidate.mockReturnValue({
        error: null,
        value: { techIds: ['tech-1'] },
      });
      mockRemoveTechsFromProject.mockResolvedValue(mockUpdatedProject);

      await removeTechs(req, res);

      expect(mockRemoveTechsFromProject).toHaveBeenCalledWith(
        'project-123',
        ['tech-1'],
        'user-123'
      );
    });
  });

  describe('addContributors', () => {
    it('✅ should add contributors to project successfully', async () => {
      const req = mockRequest({
        params: { id: 'project-123' },
        body: { userIds: ['user-456', 'user-789'] },
        user: { id: 'user-123' },
      });
      const res = mockResponse();

      const mockUpdatedProject = {
        id: 'project-123',
        contributors: [
          { id: 'user-456', fullname: 'Jane Doe' },
          { id: 'user-789', fullname: 'Bob Smith' },
        ],
      };

      mockProjectIdParamValidate.mockReturnValue({
        error: null,
        value: { id: 'project-123' },
      });
      mockManageContributorsValidate.mockReturnValue({
        error: null,
        value: { userIds: ['user-456', 'user-789'] },
      });
      mockAddContributorsToProject.mockResolvedValue(mockUpdatedProject);

      await addContributors(req, res);

      expect(mockAddContributorsToProject).toHaveBeenCalledWith(
        'project-123',
        ['user-456', 'user-789'],
        'user-123'
      );
    });
  });

  describe('removeContributors', () => {
    it('✅ should remove contributors from project successfully', async () => {
      const req = mockRequest({
        params: { id: 'project-123' },
        body: { userIds: ['user-456'] },
        user: { id: 'user-123' },
      });
      const res = mockResponse();

      const mockUpdatedProject = {
        id: 'project-123',
        contributors: [],
      };

      mockProjectIdParamValidate.mockReturnValue({
        error: null,
        value: { id: 'project-123' },
      });
      mockManageContributorsValidate.mockReturnValue({
        error: null,
        value: { userIds: ['user-456'] },
      });
      mockRemoveContributorsFromProject.mockResolvedValue(mockUpdatedProject);

      await removeContributors(req, res);

      expect(mockRemoveContributorsFromProject).toHaveBeenCalledWith(
        'project-123',
        ['user-456'],
        'user-123'
      );
    });
  });
});
