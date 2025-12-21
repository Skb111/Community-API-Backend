/**
 * @file tests/services/projectManagement.unit.test.js
 * @description Unit tests for project management operations (techs and contributors)
 */
// Mock dependencies
let mockTransaction;
let mockSequelize;
let mockProjectFindByPk;
let mockTechFindAll;
let mockUserFindAll;
let mockAddTechs;
let mockProjectTechDestroy;
let mockAddContributors;
let mockProjectContributorDestroy;

jest.mock('../../models', () => {
  mockTransaction = {
    commit: jest.fn(),
    rollback: jest.fn(),
  };

  mockSequelize = {
    transaction: jest.fn(() => mockTransaction),
  };

  mockProjectFindByPk = jest.fn();
  mockTechFindAll = jest.fn();
  mockUserFindAll = jest.fn();
  mockAddTechs = jest.fn();
  mockProjectTechDestroy = jest.fn();
  mockAddContributors = jest.fn();
  mockProjectContributorDestroy = jest.fn();

  return {
    Project: {
      sequelize: mockSequelize,
      findByPk: (...args) => mockProjectFindByPk(...args),
    },
    Tech: {
      findAll: (...args) => mockTechFindAll(...args),
    },
    User: {
      findAll: (...args) => mockUserFindAll(...args),
    },
    ProjectTech: {
      destroy: (...args) => mockProjectTechDestroy(...args),
    },
    ProjectContributor: {
      destroy: (...args) => mockProjectContributorDestroy(...args),
    },
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
  addTechsToProject,
  removeTechsFromProject,
  addContributorsToProject,
  removeContributorsFromProject,
} = require('../../services/project/projectManagement');
const { NotFoundError, ForbiddenError } = require('../../utils/customErrors');

describe('PROJECT_MANAGEMENT', () => {
  const mockProject = {
    id: 'project-123',
    title: 'Test Project',
    createdBy: 'user-123',
    addTechs: mockAddTechs,
    addContributors: mockAddContributors,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSequelize.transaction.mockReturnValue(mockTransaction);
  });

  describe('addTechsToProject', () => {
    it('✅ should add techs to project successfully', async () => {
      mockProjectFindByPk.mockResolvedValue(mockProject);
      mockTechFindAll.mockResolvedValue([
        { id: 'tech-1', name: 'React' },
        { id: 'tech-2', name: 'Node.js' },
      ]);

      await addTechsToProject('project-123', ['tech-1', 'tech-2'], 'user-123');

      expect(mockProjectFindByPk).toHaveBeenCalledWith('project-123', {
        transaction: mockTransaction,
      });
      expect(mockTechFindAll).toHaveBeenCalledWith({
        where: { id: ['tech-1', 'tech-2'] },
        transaction: mockTransaction,
      });
      expect(mockAddTechs).toHaveBeenCalledWith(
        [
          { id: 'tech-1', name: 'React' },
          { id: 'tech-2', name: 'Node.js' },
        ],
        { transaction: mockTransaction }
      );
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('❌ should throw NotFoundError when project does not exist', async () => {
      mockProjectFindByPk.mockResolvedValue(null);

      await expect(addTechsToProject('non-existent', ['tech-1'], 'user-123')).rejects.toThrow(
        NotFoundError
      );
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it('❌ should throw ForbiddenError when user is not owner', async () => {
      const project = { ...mockProject, createdBy: 'other-user' };
      mockProjectFindByPk.mockResolvedValue(project);

      await expect(addTechsToProject('project-123', ['tech-1'], 'user-123')).rejects.toThrow(
        ForbiddenError
      );
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it('❌ should throw NotFoundError when techs do not exist', async () => {
      mockProjectFindByPk.mockResolvedValue(mockProject);
      mockTechFindAll.mockResolvedValue([{ id: 'tech-1' }]);

      await expect(
        addTechsToProject('project-123', ['tech-1', 'tech-999'], 'user-123')
      ).rejects.toThrow(NotFoundError);
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });

  describe('removeTechsFromProject', () => {
    it('✅ should remove techs from project successfully', async () => {
      mockProjectFindByPk.mockResolvedValue(mockProject);
      mockProjectTechDestroy.mockResolvedValue(2); // 2 rows deleted

      await removeTechsFromProject('project-123', ['tech-1', 'tech-2'], 'user-123');

      expect(mockProjectFindByPk).toHaveBeenCalledWith('project-123', {
        transaction: mockTransaction,
      });
      expect(mockProjectTechDestroy).toHaveBeenCalledWith({
        where: {
          projectId: 'project-123',
          techId: ['tech-1', 'tech-2'],
        },
        transaction: mockTransaction,
      });
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('✅ should handle non-existent techs gracefully', async () => {
      mockProjectFindByPk.mockResolvedValue(mockProject);
      mockProjectTechDestroy.mockResolvedValue(1); // Only one existed

      await removeTechsFromProject('project-123', ['tech-1', 'tech-999'], 'user-123');

      expect(mockProjectTechDestroy).toHaveBeenCalled();
      // Should not throw error for non-existent techs
    });

    it('❌ should throw NotFoundError when project does not exist', async () => {
      mockProjectFindByPk.mockResolvedValue(null);

      await expect(removeTechsFromProject('non-existent', ['tech-1'], 'user-123')).rejects.toThrow(
        NotFoundError
      );
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it('❌ should throw ForbiddenError when user is not owner', async () => {
      const project = { ...mockProject, createdBy: 'other-user' };
      mockProjectFindByPk.mockResolvedValue(project);

      await expect(removeTechsFromProject('project-123', ['tech-1'], 'user-123')).rejects.toThrow(
        ForbiddenError
      );
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });

  describe('addContributorsToProject', () => {
    it('✅ should add contributors to project successfully', async () => {
      mockProjectFindByPk.mockResolvedValue(mockProject);
      mockUserFindAll.mockResolvedValue([
        { id: 'user-456', fullname: 'Jane Doe' },
        { id: 'user-789', fullname: 'Bob Smith' },
      ]);

      await addContributorsToProject('project-123', ['user-456', 'user-789'], 'user-123');

      expect(mockProjectFindByPk).toHaveBeenCalledWith('project-123', {
        transaction: mockTransaction,
      });
      expect(mockUserFindAll).toHaveBeenCalledWith({
        where: { id: ['user-456', 'user-789'] },
        transaction: mockTransaction,
      });
      expect(mockAddContributors).toHaveBeenCalledWith(
        [
          { id: 'user-456', fullname: 'Jane Doe' },
          { id: 'user-789', fullname: 'Bob Smith' },
        ],
        { transaction: mockTransaction }
      );
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('✅ should filter out creator from contributors', async () => {
      mockProjectFindByPk.mockResolvedValue(mockProject);
      mockUserFindAll.mockResolvedValue([{ id: 'user-456' }]);

      await addContributorsToProject(
        'project-123',
        ['user-123', 'user-456'], // Includes creator
        'user-123'
      );

      expect(mockUserFindAll).toHaveBeenCalledWith({
        where: { id: ['user-456'] }, // Creator filtered out
        transaction: mockTransaction,
      });
      expect(mockAddContributors).toHaveBeenCalledWith([{ id: 'user-456' }], {
        transaction: mockTransaction,
      });
    });

    it('✅ should return early when no valid contributors', async () => {
      mockProjectFindByPk.mockResolvedValue(mockProject);

      await addContributorsToProject(
        'project-123',
        ['user-123'], // Only creator
        'user-123'
      );

      expect(mockUserFindAll).not.toHaveBeenCalled();
      expect(mockAddContributors).not.toHaveBeenCalled();
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('❌ should throw NotFoundError when contributors do not exist', async () => {
      mockProjectFindByPk.mockResolvedValue(mockProject);
      mockUserFindAll.mockResolvedValue([{ id: 'user-456' }]);

      await expect(
        addContributorsToProject('project-123', ['user-456', 'user-999'], 'user-123')
      ).rejects.toThrow(NotFoundError);
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });

  describe('removeContributorsFromProject', () => {
    it('✅ should remove contributors from project successfully', async () => {
      mockProjectFindByPk.mockResolvedValue(mockProject);
      mockProjectContributorDestroy.mockResolvedValue(2);

      await removeContributorsFromProject('project-123', ['user-456', 'user-789'], 'user-123');

      expect(mockProjectFindByPk).toHaveBeenCalledWith('project-123', {
        transaction: mockTransaction,
      });
      expect(mockProjectContributorDestroy).toHaveBeenCalledWith({
        where: {
          projectId: 'project-123',
          userId: ['user-456', 'user-789'],
        },
        transaction: mockTransaction,
      });
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('✅ should filter out creator from removal list', async () => {
      mockProjectFindByPk.mockResolvedValue(mockProject);
      mockProjectContributorDestroy.mockResolvedValue(1);

      await removeContributorsFromProject(
        'project-123',
        ['user-123', 'user-456'], // Includes creator
        'user-123'
      );

      expect(mockProjectContributorDestroy).toHaveBeenCalledWith({
        where: {
          projectId: 'project-123',
          userId: ['user-456'], // Creator filtered out
        },
        transaction: mockTransaction,
      });
    });

    it('✅ should return early when no valid contributors to remove', async () => {
      mockProjectFindByPk.mockResolvedValue(mockProject);

      await removeContributorsFromProject(
        'project-123',
        ['user-123'], // Only creator
        'user-123'
      );

      expect(mockProjectContributorDestroy).not.toHaveBeenCalled();
      expect(mockTransaction.commit).toHaveBeenCalled();
    });
  });
});
