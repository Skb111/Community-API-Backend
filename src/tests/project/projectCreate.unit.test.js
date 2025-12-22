/**
 * @file tests/services/projectCreate.unit.test.js
 * @description Unit tests for project creation operations
 */

// Mock dependencies
jest.mock('../../utils/imageUploader', () => ({
  uploadProjectCoverImage: jest.fn(),
}));

// Create mock variables that will be used in the mock factory
let mockTransaction;
let mockSequelize;
let mockProjectCreate;
let mockProjectSave;
let mockUserFindByPk;
let mockTechFindAll;
let mockAddTechs;
let mockAddContributors;
let mockUserFindAll;

jest.mock('../../models', () => {
  // Initialize mocks inside the factory
  mockTransaction = {
    commit: jest.fn(),
    rollback: jest.fn(),
  };

  mockSequelize = {
    transaction: jest.fn(() => mockTransaction),
  };

  mockProjectCreate = jest.fn();
  mockProjectSave = jest.fn();
  mockUserFindByPk = jest.fn();
  mockTechFindAll = jest.fn();
  mockAddTechs = jest.fn();
  mockAddContributors = jest.fn();
  mockUserFindAll = jest.fn();

  return {
    Project: {
      sequelize: mockSequelize,
      create: (...args) => mockProjectCreate(...args),
      findByPk: jest.fn(),
      prototype: {
        addTechs: (...args) => mockAddTechs(...args),
        addContributors: (...args) => mockAddContributors(...args),
        save: (...args) => mockProjectSave(...args),
      },
    },
    User: {
      findByPk: (...args) => mockUserFindByPk(...args),
      findAll: jest.fn(),
    },
    Tech: {
      findAll: (...args) => mockTechFindAll(...args),
    },
  };
});

jest.mock('../../cache/projectCache', () => ({
  invalidateAllProjectCaches: jest.fn(),
  invalidateUserProjectCaches: jest.fn(),
}));

jest.mock('../../utils/logger', () =>
  jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  }))
);

const {
  createProject,
  uploadCoverImage,
  validateAndProcessTechs,
  validateAndProcessContributors,
} = require('../../services/project/projectCreate');
const { uploadProjectCoverImage } = require('../../utils/imageUploader');
const { NotFoundError, InternalServerError } = require('../../utils/customErrors');

describe('PROJECT_CREATE', () => {
  const mockUser = {
    id: 'user-123',
    fullname: 'John Doe',
    email: 'john@example.com',
  };

  const mockProject = {
    id: 'project-123',
    title: 'Test Project',
    description: 'Test description',
    coverImage: null,
    createdBy: 'user-123',
    save: mockProjectSave,
    addTechs: mockAddTechs,
    addContributors: mockAddContributors,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mockTransaction
    mockTransaction.commit.mockClear();
    mockTransaction.rollback.mockClear();
    mockSequelize.transaction.mockReturnValue(mockTransaction);

    // Setup default mock implementations
    mockProjectCreate.mockImplementation((data) => {
      return Promise.resolve({
        ...mockProject,
        ...data,
        save: mockProjectSave,
        addTechs: mockAddTechs,
        addContributors: mockAddContributors,
      });
    });

    mockProjectSave.mockResolvedValue(mockProject);
    mockAddTechs.mockResolvedValue(true);
    mockAddContributors.mockResolvedValue(true);
  });

  describe('createProject', () => {
    const mockProjectData = {
      title: 'Test Project',
      description: 'Test description',
      repoLink: 'https://github.com/test/project',
      featured: false,
      techs: ['tech-1', 'tech-2'],
    };

    const mockFileBuffer = Buffer.from('fake image data');
    const mockFileName = 'cover.jpg';

    it('✅ should create a project without cover image successfully', async () => {
      // Setup specific mocks for this test
      mockUserFindByPk.mockResolvedValue(mockUser);

      // Mock Tech.findAll to return the expected techs
      const mockTechs = [
        { id: 'tech-1', name: 'React' },
        { id: 'tech-2', name: 'Node.js' },
      ];
      mockTechFindAll.mockImplementation((options) => {
        console.log('Tech.findAll called with:', options);
        return Promise.resolve(mockTechs);
      });

      // Mock User.findAll for contributors
      mockUserFindAll.mockResolvedValue([{ id: 'user-456', fullname: 'Jane Doe' }]);

      // Call the function
      await createProject(mockProjectData, 'user-123');

      // Assertions
      expect(mockSequelize.transaction).toHaveBeenCalled();
      expect(mockUserFindByPk).toHaveBeenCalledWith('user-123', { transaction: mockTransaction });

      // Check that Project.create was called with correct data
      expect(mockProjectCreate).toHaveBeenCalledWith(
        {
          title: 'Test Project',
          description: 'Test description',
          repoLink: 'https://github.com/test/project',
          featured: false,
          createdBy: 'user-123',
        },
        { transaction: mockTransaction }
      );

      // Check that Tech.findAll was called
      expect(mockTechFindAll).toHaveBeenCalledWith({
        where: { id: ['tech-1', 'tech-2'] },
        transaction: mockTransaction,
      });

      // Check that addTechs was called
      expect(mockAddTechs).toHaveBeenCalledWith(mockTechs, { transaction: mockTransaction });

      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('✅ should create a project with cover image successfully', async () => {
      // Setup mocks
      mockUserFindByPk.mockResolvedValue(mockUser);
      mockTechFindAll.mockResolvedValue([]); // No techs in this test
      mockUserFindAll.mockResolvedValue([]); // No contributors in this test
      uploadProjectCoverImage.mockResolvedValue(
        'https://minio/project_cover_project-123_1234567890.jpg'
      );

      await createProject(
        { ...mockProjectData, techs: [], contributors: [] }, // No techs or contributors
        'user-123',
        mockFileBuffer,
        mockFileName,
        'image/jpeg'
      );

      expect(uploadProjectCoverImage).toHaveBeenCalledWith({
        fileBuffer: mockFileBuffer,
        originalFileName: mockFileName,
        mimeType: 'image/jpeg',
        projectId: 'project-123',
        oldImageUrl: null,
      });
      expect(mockProjectSave).toHaveBeenCalledWith({ transaction: mockTransaction });
    });

    it('❌ should throw NotFoundError when user does not exist', async () => {
      mockUserFindByPk.mockResolvedValue(null);

      await expect(createProject(mockProjectData, 'user-123')).rejects.toThrow(NotFoundError);
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it('❌ should throw NotFoundError when techs do not exist', async () => {
      mockUserFindByPk.mockResolvedValue(mockUser);
      mockTechFindAll.mockResolvedValue([{ id: 'tech-1' }]); // Only one tech found

      await expect(createProject(mockProjectData, 'user-123')).rejects.toThrow(NotFoundError);
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it('❌ should throw NotFoundError when contributors do not exist', async () => {
      mockUserFindByPk.mockResolvedValue(mockUser);
      mockTechFindAll.mockResolvedValue([]);
      mockUserFindAll.mockResolvedValue([]); // No contributors found

      await expect(createProject(mockProjectData, 'user-123')).rejects.toThrow(NotFoundError);
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it('⚠️ should handle database errors', async () => {
      mockUserFindByPk.mockRejectedValue(new Error('Database connection failed'));

      await expect(createProject(mockProjectData, 'user-123')).rejects.toThrow(InternalServerError);
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it('✅ should skip adding creator as contributor', async () => {
      const projectDataWithCreatorAsContributor = {
        ...mockProjectData,
        techs: [], // No techs for simplicity
        contributors: ['user-123'], // Creator is trying to add themselves
      };

      mockUserFindByPk.mockResolvedValue(mockUser);
      mockTechFindAll.mockResolvedValue([]);

      await createProject(projectDataWithCreatorAsContributor, 'user-123');

      expect(mockUserFindAll).not.toHaveBeenCalled(); // Should not be called since creator is filtered out
      expect(mockAddContributors).not.toHaveBeenCalled(); // Should not try to add creator
      expect(mockTransaction.commit).toHaveBeenCalled();
    });
  });

  describe('validateAndProcessTechs', () => {
    it('✅ should return empty array when no techs provided', async () => {
      const result = await validateAndProcessTechs([], mockTransaction);
      expect(result).toEqual([]);
      expect(mockTechFindAll).not.toHaveBeenCalled();
    });

    it('✅ should return techs when all exist', async () => {
      const mockTechs = [
        { id: 'tech-1', name: 'React' },
        { id: 'tech-2', name: 'Node.js' },
      ];
      mockTechFindAll.mockResolvedValue(mockTechs);

      const result = await validateAndProcessTechs(['tech-1', 'tech-2'], mockTransaction);

      expect(mockTechFindAll).toHaveBeenCalledWith({
        where: { id: ['tech-1', 'tech-2'] },
        transaction: mockTransaction,
      });
      expect(result).toEqual(mockTechs);
    });

    it('❌ should throw NotFoundError when some techs do not exist', async () => {
      mockTechFindAll.mockResolvedValue([{ id: 'tech-1' }]);

      await expect(
        validateAndProcessTechs(['tech-1', 'tech-999'], mockTransaction)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('validateAndProcessContributors', () => {
    it('✅ should return empty array when no contributors provided', async () => {
      const result = await validateAndProcessContributors([], 'user-123', mockTransaction);
      expect(result).toEqual([]);
    });

    it('✅ should filter out creator from contributors', async () => {
      const mockContributors = [
        { id: 'user-456', fullname: 'Jane Doe' },
        { id: 'user-789', fullname: 'Bob Smith' },
      ];

      // Mock User.findAll
      const { User } = require('../../models');
      User.findAll = jest.fn().mockResolvedValue(mockContributors);

      const result = await validateAndProcessContributors(
        ['user-123', 'user-456', 'user-789'], // Includes creator
        'user-123',
        mockTransaction
      );

      expect(User.findAll).toHaveBeenCalledWith({
        where: { id: ['user-456', 'user-789'] }, // Creator filtered out
        transaction: mockTransaction,
      });
      expect(result).toEqual(mockContributors);
    });

    it('❌ should throw NotFoundError when some contributors do not exist', async () => {
      const { User } = require('../../models');
      User.findAll = jest.fn().mockResolvedValue([{ id: 'user-456' }]);

      await expect(
        validateAndProcessContributors(['user-456', 'user-999'], 'user-123', mockTransaction)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('uploadCoverImage', () => {
    it('✅ should upload cover image using imageUploader', async () => {
      const mockFileBuffer = Buffer.from('fake image data');
      const mockProject = { id: 'project-123', coverImage: 'old-url.jpg' };

      uploadProjectCoverImage.mockResolvedValue('new-url.jpg');

      const result = await uploadCoverImage(mockProject, mockFileBuffer, 'cover.jpg', 'image/jpeg');

      expect(uploadProjectCoverImage).toHaveBeenCalledWith({
        fileBuffer: mockFileBuffer,
        originalFileName: 'cover.jpg',
        mimeType: 'image/jpeg',
        projectId: 'project-123',
        oldImageUrl: 'old-url.jpg',
      });
      expect(result).toBe('new-url.jpg');
    });
  });
});
