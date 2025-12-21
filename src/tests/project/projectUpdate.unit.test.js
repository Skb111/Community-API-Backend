/**
 * @file tests/services/projectUpdate.unit.test.js
 * @description Unit tests for project update and delete operations
 */
// Mock dependencies
jest.mock('../../utils/imageUploader', () => ({
  uploadProjectCoverImage: jest.fn(),
  deleteImage: jest.fn(),
  extractObjectKeyFromUrl: jest.fn(),
}));

let mockTransaction;
let mockSequelize;
let mockProjectFindByPk;
let mockProjectUpdate;
let mockProjectClassDestroy;
let mockSetTechs;
let mockSetContributors;
let mockTechFindAll;
let mockUserFindAll;
let _mockProjectDestroy;

jest.mock('../../models', () => {
  mockTransaction = {
    commit: jest.fn(),
    rollback: jest.fn(),
  };

  mockSequelize = {
    transaction: jest.fn(() => mockTransaction),
  };

  mockProjectFindByPk = jest.fn();
  mockProjectUpdate = jest.fn();
  _mockProjectDestroy = jest.fn();
  mockProjectClassDestroy = jest.fn(); // Static method
  mockSetTechs = jest.fn();
  mockSetContributors = jest.fn();
  mockTechFindAll = jest.fn();
  mockUserFindAll = jest.fn();

  return {
    Project: {
      sequelize: mockSequelize,
      findByPk: (...args) => mockProjectFindByPk(...args),
      destroy: (...args) => mockProjectClassDestroy(...args),
    },
    Tech: {
      findAll: (...args) => mockTechFindAll(...args),
    },
    User: {
      findAll: (...args) => mockUserFindAll(...args),
    },
    ProjectTech: {},
    ProjectContributor: {},
  };
});

jest.mock('../../cache/projectCache', () => ({
  invalidateAllProjectCaches: jest.fn(),
  invalidateProjectCache: jest.fn(),
  invalidateUserProjectCaches: jest.fn(),
  invalidateTechProjectCaches: jest.fn(),
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
  updateProject,
  deleteProject,
  updateProjectTechs,
  updateProjectContributors,
} = require('../../services/project/projectUpdate');
const {
  uploadProjectCoverImage,
  deleteImage,
  extractObjectKeyFromUrl,
} = require('../../utils/imageUploader');
const { NotFoundError, ForbiddenError } = require('../../utils/customErrors');

describe('PROJECT_UPDATE', () => {
  const mockProject = {
    id: 'project-123',
    title: 'Test Project',
    description: 'Test description',
    coverImage: 'old-cover.jpg',
    createdBy: 'user-123',
    update: mockProjectUpdate,
    setTechs: mockSetTechs,
    setContributors: mockSetContributors,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSequelize.transaction.mockReturnValue(mockTransaction);
    mockProjectUpdate.mockResolvedValue(mockProject);
  });

  describe('updateProject', () => {
    const mockUpdateData = {
      coverImage: 'updated-cover.jpg',
      title: 'Updated Project',
      description: 'Updated description',
      featured: true,
    };

    it('✅ should update project successfully', async () => {
      mockProjectFindByPk.mockResolvedValue(mockProject);

      await updateProject('project-123', mockUpdateData, 'user-123');

      expect(mockProjectFindByPk).toHaveBeenCalledWith('project-123', {
        transaction: mockTransaction,
      });
      expect(mockProjectUpdate).toHaveBeenCalledWith(mockUpdateData, {
        transaction: mockTransaction,
      });
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('❌ should throw NotFoundError when project does not exist', async () => {
      mockProjectFindByPk.mockResolvedValue(null);

      await expect(updateProject('non-existent', mockUpdateData, 'user-123')).rejects.toThrow(
        NotFoundError
      );
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it('❌ should throw ForbiddenError when user is not owner', async () => {
      const project = { ...mockProject, createdBy: 'other-user' };
      mockProjectFindByPk.mockResolvedValue(project);

      await expect(updateProject('project-123', mockUpdateData, 'user-123')).rejects.toThrow(
        ForbiddenError
      );
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it('✅ should update project with new cover image', async () => {
      mockProjectFindByPk.mockResolvedValue(mockProject);
      uploadProjectCoverImage.mockResolvedValue('new-cover.jpg');

      await updateProject(
        'project-123',
        mockUpdateData,
        'user-123',
        Buffer.from('image'),
        'cover.jpg',
        'image/jpeg'
      );

      expect(uploadProjectCoverImage).toHaveBeenCalledWith({
        fileBuffer: Buffer.from('image'),
        originalFileName: 'cover.jpg',
        mimeType: 'image/jpeg',
        projectId: 'project-123',
        oldImageUrl: 'old-cover.jpg',
      });
      expect(mockProjectUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ coverImage: 'new-cover.jpg' }),
        { transaction: mockTransaction }
      );
    });

    it('✅ should remove cover image when set to null', async () => {
      mockProjectFindByPk.mockResolvedValue(mockProject);
      extractObjectKeyFromUrl.mockReturnValue('old-cover-key');

      const updateDataWithNullCover = { ...mockUpdateData, coverImage: null };

      await updateProject('project-123', updateDataWithNullCover, 'user-123');

      expect(deleteImage).toHaveBeenCalledWith('old-cover-key', 'cover image');
      expect(mockProjectUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ coverImage: null }),
        { transaction: mockTransaction }
      );
    });

    it('✅ should update techs when provided', async () => {
      mockProjectFindByPk.mockResolvedValue(mockProject);
      mockTechFindAll.mockResolvedValue([{ id: 'tech-1' }, { id: 'tech-2' }]);

      const updateDataWithTechs = { ...mockUpdateData, techs: ['tech-1', 'tech-2'] };

      await updateProject('project-123', updateDataWithTechs, 'user-123');

      expect(mockTechFindAll).toHaveBeenCalledWith({
        where: { id: ['tech-1', 'tech-2'] },
        transaction: mockTransaction,
      });
      expect(mockSetTechs).toHaveBeenCalledWith([{ id: 'tech-1' }, { id: 'tech-2' }], {
        transaction: mockTransaction,
      });
    });

    it('✅ should remove all techs when empty array provided', async () => {
      mockProjectFindByPk.mockResolvedValue(mockProject);

      const updateDataWithEmptyTechs = { ...mockUpdateData, techs: [] };

      await updateProject('project-123', updateDataWithEmptyTechs, 'user-123');

      expect(mockSetTechs).toHaveBeenCalledWith([], { transaction: mockTransaction });
      expect(mockTechFindAll).not.toHaveBeenCalled();
    });

    it('✅ should update contributors when provided', async () => {
      mockProjectFindByPk.mockResolvedValue(mockProject);
      mockUserFindAll.mockResolvedValue([{ id: 'user-456' }]);

      const updateDataWithContributors = { ...mockUpdateData, contributors: ['user-456'] };

      await updateProject('project-123', updateDataWithContributors, 'user-123');

      expect(mockUserFindAll).toHaveBeenCalledWith({
        where: { id: ['user-456'] },
        transaction: mockTransaction,
      });
      expect(mockSetContributors).toHaveBeenCalledWith([{ id: 'user-456' }], {
        transaction: mockTransaction,
      });
    });
  });

  describe('deleteProject', () => {
    it('✅ should delete project successfully', async () => {
      // Create a mock project WITH destroy method
      const mockProjectWithDestroy = {
        ...mockProject,
        destroy: jest.fn().mockResolvedValue(true), // Instance destroy method
      };

      mockProjectFindByPk.mockResolvedValue(mockProjectWithDestroy);
      extractObjectKeyFromUrl.mockReturnValue('old-cover-key');

      await deleteProject('project-123', 'user-123');

      expect(mockProjectFindByPk).toHaveBeenCalledWith('project-123', {
        transaction: mockTransaction,
      });
      expect(deleteImage).toHaveBeenCalledWith('old-cover-key', 'cover image');
      expect(mockProjectWithDestroy.destroy).toHaveBeenCalledWith({
        transaction: mockTransaction,
      });
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('❌ should throw NotFoundError when project does not exist', async () => {
      mockProjectFindByPk.mockResolvedValue(null);

      await expect(deleteProject('non-existent', 'user-123')).rejects.toThrow(NotFoundError);
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it('❌ should throw ForbiddenError when user is not owner', async () => {
      const project = { ...mockProject, createdBy: 'other-user' };
      mockProjectFindByPk.mockResolvedValue(project);

      await expect(deleteProject('project-123', 'user-123')).rejects.toThrow(ForbiddenError);
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it('✅ should handle project without cover image', async () => {
      // Create a mock project WITHOUT cover image but WITH destroy method
      const projectWithoutCover = {
        ...mockProject,
        coverImage: null,
        destroy: jest.fn().mockResolvedValue(true),
      };

      mockProjectFindByPk.mockResolvedValue(projectWithoutCover);

      await deleteProject('project-123', 'user-123');

      expect(deleteImage).not.toHaveBeenCalled();
      expect(projectWithoutCover.destroy).toHaveBeenCalledWith({
        transaction: mockTransaction,
      });
    });
  });

  describe('updateProjectTechs', () => {
    it('✅ should not update when techs is undefined', async () => {
      await updateProjectTechs(mockProject, undefined, mockTransaction);

      expect(mockTechFindAll).not.toHaveBeenCalled();
      expect(mockSetTechs).not.toHaveBeenCalled();
    });

    it('✅ should remove all techs when empty array', async () => {
      await updateProjectTechs(mockProject, [], mockTransaction);

      expect(mockSetTechs).toHaveBeenCalledWith([], { transaction: mockTransaction });
      expect(mockTechFindAll).not.toHaveBeenCalled();
    });

    it('✅ should set new techs when array provided', async () => {
      mockTechFindAll.mockResolvedValue([{ id: 'tech-1' }, { id: 'tech-2' }]);

      await updateProjectTechs(mockProject, ['tech-1', 'tech-2'], mockTransaction);

      expect(mockTechFindAll).toHaveBeenCalledWith({
        where: { id: ['tech-1', 'tech-2'] },
        transaction: mockTransaction,
      });
      expect(mockSetTechs).toHaveBeenCalledWith([{ id: 'tech-1' }, { id: 'tech-2' }], {
        transaction: mockTransaction,
      });
    });

    it('❌ should throw NotFoundError when techs do not exist', async () => {
      mockTechFindAll.mockResolvedValue([{ id: 'tech-1' }]);

      await expect(
        updateProjectTechs(mockProject, ['tech-1', 'tech-999'], mockTransaction)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateProjectContributors', () => {
    it('✅ should not update when contributors is undefined', async () => {
      await updateProjectContributors(mockProject, undefined, 'user-123', mockTransaction);

      expect(mockUserFindAll).not.toHaveBeenCalled();
      expect(mockSetContributors).not.toHaveBeenCalled();
    });

    it('✅ should remove all contributors when empty array', async () => {
      await updateProjectContributors(mockProject, [], 'user-123', mockTransaction);

      expect(mockSetContributors).toHaveBeenCalledWith([], { transaction: mockTransaction });
      expect(mockUserFindAll).not.toHaveBeenCalled();
    });

    it('✅ should filter out creator from contributors', async () => {
      mockUserFindAll.mockResolvedValue([{ id: 'user-456' }]);

      await updateProjectContributors(
        mockProject,
        ['user-123', 'user-456'],
        'user-123',
        mockTransaction
      );

      expect(mockUserFindAll).toHaveBeenCalledWith({
        where: { id: ['user-456'] },
        transaction: mockTransaction,
      });
      expect(mockSetContributors).toHaveBeenCalledWith([{ id: 'user-456' }], {
        transaction: mockTransaction,
      });
    });
  });

  describe('Cover image removal through updateProject', () => {
    it('✅ should delete image when coverImage set to null', async () => {
      mockProjectFindByPk.mockResolvedValue(mockProject);
      extractObjectKeyFromUrl.mockReturnValue('old-key');

      await updateProject('project-123', { coverImage: null, title: 'Updated' }, 'user-123');

      expect(deleteImage).toHaveBeenCalledWith('old-key', 'cover image');
      expect(mockProjectUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ coverImage: null }),
        { transaction: mockTransaction }
      );
    });

    it('✅ should delete image when coverImage set to empty string', async () => {
      mockProjectFindByPk.mockResolvedValue(mockProject);
      extractObjectKeyFromUrl.mockReturnValue('old-key');

      await updateProject('project-123', { coverImage: '', title: 'Updated' }, 'user-123');

      expect(deleteImage).toHaveBeenCalledWith('old-key', 'cover image');
      expect(mockProjectUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ coverImage: null }),
        { transaction: mockTransaction }
      );
    });
  });
});
