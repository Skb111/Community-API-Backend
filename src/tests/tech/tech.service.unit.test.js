const {
  getAllTechs,
  getTechById,
  createTech,
  updateTech,
  deleteTech,
  searchTechs,
  updateTechIcon,
  batchCreateTechs,
} = require('../../services/techService');
const { NotFoundError, ConflictError, InternalServerError } = require('../../utils/customErrors');

// const mockBatchCreateTechs = jest.fn();
// const mockUpdateTechIcon = jest.fn();
// Move all mock definitions inside jest.mock calls
jest.mock('../../models', () => {
  // Define mocks here
  const mockCount = jest.fn();
  const mockFindAll = jest.fn();
  const mockFindByPk = jest.fn();
  const mockFindOne = jest.fn();
  const mockCreate = jest.fn();

  const mockTransaction = {
    commit: jest.fn(),
    rollback: jest.fn(),
  };

  const mockSequelize = {
    transaction: jest.fn().mockResolvedValue(mockTransaction),
    Op: {
      iLike: 'iLike',
    },
  };

  // Export the mocks so they can be used in tests
  const moduleExports = {
    Tech: {
      count: (...args) => mockCount(...args),
      findAll: (...args) => mockFindAll(...args),
      findByPk: (...args) => mockFindByPk(...args),
      findOne: (...args) => mockFindOne(...args),
      create: (...args) => mockCreate(...args),
    },
    sequelize: mockSequelize,
    Sequelize: {
      Op: mockSequelize.Op,
    },
  };

  // Attach mocks to module exports for test access
  moduleExports._mocks = {
    mockCount,
    mockFindAll,
    mockFindByPk,
    mockFindOne,
    mockCreate,
    mockTransaction,
    mockSequelize,
  };

  return moduleExports;
});

jest.mock('../../utils/imageUploader', () => {
  const mockUploadTechIcon = jest.fn(); // Define it here

  return {
    uploadTechIcon: mockUploadTechIcon,
    _mocks: {
      mockUploadTechIcon, // Expose it for test access
    },
  };
});

jest.mock('../../cache/techCache', () => {
  const mockGetCachedTechList = jest.fn();
  const mockCacheTechList = jest.fn();
  const mockGetCachedTechCount = jest.fn();
  const mockCacheTechCount = jest.fn();
  const mockGetCachedTech = jest.fn();
  const mockCacheTech = jest.fn();
  const mockGetCachedTechNameLookup = jest.fn();
  const mockCacheTechNameLookup = jest.fn();
  const mockInvalidateAllTechCaches = jest.fn();
  const mockInvalidateTechNameCache = jest.fn();

  const moduleExports = {
    getCachedTechList: (...args) => mockGetCachedTechList(...args),
    cacheTechList: (...args) => mockCacheTechList(...args),
    getCachedTechCount: (...args) => mockGetCachedTechCount(...args),
    cacheTechCount: (...args) => mockCacheTechCount(...args),
    getCachedTech: (...args) => mockGetCachedTech(...args),
    cacheTech: (...args) => mockCacheTech(...args),
    getCachedTechNameLookup: (...args) => mockGetCachedTechNameLookup(...args),
    cacheTechNameLookup: (...args) => mockCacheTechNameLookup(...args),
    invalidateAllTechCaches: (...args) => mockInvalidateAllTechCaches(...args),
    invalidateTechNameCache: (...args) => mockInvalidateTechNameCache(...args),
  };

  // Attach mocks to module exports for test access
  moduleExports._mocks = {
    mockGetCachedTechList,
    mockCacheTechList,
    mockGetCachedTechCount,
    mockCacheTechCount,
    mockGetCachedTech,
    mockCacheTech,
    mockGetCachedTechNameLookup,
    mockCacheTechNameLookup,
    mockInvalidateAllTechCaches,
    mockInvalidateTechNameCache,
  };

  return moduleExports;
});

jest.mock('../../utils/logger', () =>
  jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }))
);

describe('TECH_SERVICE', () => {
  // Get mocks from the mocked modules
  let models;
  let cache;
  let imageUploader;

  beforeAll(() => {
    models = require('../../models');
    cache = require('../../cache/techCache');
    imageUploader = require('../../utils/imageUploader');
  });

  const baseTech = {
    id: 'tech-123',
    name: 'React',
    icon: 'react-icon.png',
    description: 'JavaScript library for building user interfaces',
    createdBy: 'user-456',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    save: jest.fn().mockResolvedValue(),
    update: jest.fn().mockResolvedValue(),
    destroy: jest.fn().mockResolvedValue(),
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  // ---------------------------
  // getAllTechs
  // ---------------------------
  describe('getAllTechs', () => {
    const mockTechs = [baseTech];

    it('returns paginated techs from cache when available', async () => {
      const cachedResult = {
        success: true,
        data: mockTechs,
        pagination: { page: 1, pageSize: 10, totalItems: 1 },
      };
      cache._mocks.mockGetCachedTechList.mockResolvedValueOnce(cachedResult);

      const result = await getAllTechs({ page: 1, pageSize: 10 });

      expect(cache._mocks.mockGetCachedTechList).toHaveBeenCalledWith(1, 10, '');
      expect(result).toEqual(cachedResult);
      expect(models._mocks.mockCount).not.toHaveBeenCalled(); // Cache hit, no DB call
    });

    it('fetches from database when cache miss', async () => {
      cache._mocks.mockGetCachedTechList.mockResolvedValueOnce(null); // Cache miss
      cache._mocks.mockGetCachedTechCount.mockResolvedValueOnce(null); // Count cache miss
      models._mocks.mockCount.mockResolvedValueOnce(1);
      models._mocks.mockFindAll.mockResolvedValueOnce(mockTechs);

      const result = await getAllTechs({ page: 1, pageSize: 10 });

      expect(cache._mocks.mockGetCachedTechList).toHaveBeenCalledWith(1, 10, '');
      expect(models._mocks.mockCount).toHaveBeenCalledWith({ where: {} });
      expect(cache._mocks.mockCacheTechCount).toHaveBeenCalledWith(1, '');
      expect(models._mocks.mockFindAll).toHaveBeenCalledWith({
        where: {},
        limit: 10,
        offset: 0,
        order: [['name', 'ASC']],
      });
      expect(cache._mocks.mockCacheTechList).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockTechs);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.totalItems).toBe(1);
    });

    it('searches techs by name', async () => {
      cache._mocks.mockGetCachedTechList.mockResolvedValueOnce(null);
      cache._mocks.mockGetCachedTechCount.mockResolvedValueOnce(null);
      models._mocks.mockCount.mockResolvedValueOnce(1);
      models._mocks.mockFindAll.mockResolvedValueOnce(mockTechs);

      const result = await getAllTechs({ search: 'react', page: 1, pageSize: 10 });

      expect(cache._mocks.mockGetCachedTechList).toHaveBeenCalledWith(1, 10, 'react');
      expect(models._mocks.mockCount).toHaveBeenCalledWith({
        where: {
          name: {
            iLike: '%react%',
          },
        },
      });
      expect(result.pagination.search).toBe('react');
    });

    it('uses cached count when available', async () => {
      const mockTechs = [baseTech];

      // Cache miss for list, but cache hit for count
      cache._mocks.mockGetCachedTechList.mockResolvedValueOnce(null);
      cache._mocks.mockGetCachedTechCount.mockResolvedValueOnce(25); // Cache hit for count

      // Mock the database calls that will still happen
      models._mocks.mockFindAll.mockResolvedValueOnce(mockTechs);

      const result = await getAllTechs({ page: 1, pageSize: 10 });

      expect(cache._mocks.mockGetCachedTechList).toHaveBeenCalledWith(1, 10, '');
      expect(cache._mocks.mockGetCachedTechCount).toHaveBeenCalledWith('');
      expect(models._mocks.mockCount).not.toHaveBeenCalled(); // Should use cached count
      expect(models._mocks.mockFindAll).toHaveBeenCalled(); // Should still fetch data from DB

      // Verify the result uses the cached count
      expect(result.pagination.totalItems).toBe(25);
      expect(result.pagination.totalPages).toBe(3); // 25/10 = 2.5 -> ceil = 3
    });

    it('throws InternalServerError on database error', async () => {
      cache._mocks.mockGetCachedTechList.mockResolvedValueOnce(null);
      models._mocks.mockCount.mockRejectedValueOnce(new Error('DB error'));

      await expect(getAllTechs({})).rejects.toThrow(InternalServerError);
    });
  });

  // ---------------------------
  // getTechById
  // ---------------------------
  describe('getTechById', () => {
    it('returns tech from cache when available', async () => {
      cache._mocks.mockGetCachedTech.mockResolvedValueOnce(baseTech);

      const result = await getTechById('tech-123');

      expect(cache._mocks.mockGetCachedTech).toHaveBeenCalledWith('tech-123');
      expect(result).toEqual(baseTech);
      expect(models._mocks.mockFindByPk).not.toHaveBeenCalled(); // Cache hit
    });

    it('fetches from database when cache miss', async () => {
      cache._mocks.mockGetCachedTech.mockResolvedValueOnce(null); // Cache miss
      models._mocks.mockFindByPk.mockResolvedValueOnce(baseTech);

      const result = await getTechById('tech-123');

      expect(cache._mocks.mockGetCachedTech).toHaveBeenCalledWith('tech-123');
      expect(models._mocks.mockFindByPk).toHaveBeenCalledWith('tech-123', {
        include: [
          {
            association: 'creator',
            attributes: ['fullname', 'email', 'profilePicture'],
          },
        ],
      });
      expect(cache._mocks.mockCacheTech).toHaveBeenCalledWith('tech-123', baseTech);
      expect(result).toEqual(baseTech);
    });

    it('throws NotFoundError when tech not found', async () => {
      cache._mocks.mockGetCachedTech.mockResolvedValueOnce(null);
      models._mocks.mockFindByPk.mockResolvedValueOnce(null);

      await expect(getTechById('tech-999')).rejects.toThrow(NotFoundError);
    });

    it('throws InternalServerError on database error', async () => {
      cache._mocks.mockGetCachedTech.mockResolvedValueOnce(null);
      models._mocks.mockFindByPk.mockRejectedValueOnce(new Error('DB error'));

      await expect(getTechById('tech-123')).rejects.toThrow(InternalServerError);
    });
  });

  // ---------------------------
  // createTech
  // ---------------------------
  describe('createTech', () => {
    const techData = {
      name: 'Vue.js',
      icon: 'vue-icon.png',
      description: 'Progressive JavaScript Framework',
    };

    it('creates a new tech successfully', async () => {
      cache._mocks.mockGetCachedTechNameLookup.mockResolvedValueOnce(null); // No existing name in cache
      models._mocks.mockFindOne.mockResolvedValueOnce(null); // No existing tech in DB
      models._mocks.mockCreate.mockResolvedValueOnce(baseTech);

      const result = await createTech(techData, 'user-456');

      expect(models._mocks.mockSequelize.transaction).toHaveBeenCalled();
      expect(cache._mocks.mockGetCachedTechNameLookup).toHaveBeenCalledWith('Vue.js');
      expect(models._mocks.mockFindOne).toHaveBeenCalledWith({
        where: { name: 'Vue.js' },
        transaction: models._mocks.mockTransaction,
      });
      expect(models._mocks.mockCreate).toHaveBeenCalledWith(
        {
          name: 'Vue.js',
          icon: 'vue-icon.png',
          description: 'Progressive JavaScript Framework',
          createdBy: 'user-456',
        },
        { transaction: models._mocks.mockTransaction }
      );
      expect(cache._mocks.mockCacheTech).toHaveBeenCalledWith('tech-123', baseTech);
      expect(cache._mocks.mockCacheTechNameLookup).toHaveBeenCalledWith('Vue.js', 'tech-123');
      expect(cache._mocks.mockInvalidateAllTechCaches).toHaveBeenCalled();
      expect(models._mocks.mockTransaction.commit).toHaveBeenCalled();
      expect(result).toEqual(baseTech);
    });

    it('throws ConflictError when tech name exists (cache hit)', async () => {
      cache._mocks.mockGetCachedTechNameLookup.mockResolvedValueOnce('existing-tech-id');
      models._mocks.mockFindByPk.mockResolvedValueOnce(baseTech); // Tech exists

      await expect(createTech(techData, 'user-456')).rejects.toThrow(ConflictError);

      expect(models._mocks.mockTransaction.rollback).toHaveBeenCalled();
      expect(models._mocks.mockCreate).not.toHaveBeenCalled();
    });

    it('throws ConflictError when tech name exists (cache miss)', async () => {
      cache._mocks.mockGetCachedTechNameLookup.mockResolvedValueOnce(null);
      models._mocks.mockFindOne.mockResolvedValueOnce(baseTech); // Tech exists in DB

      await expect(createTech(techData, 'user-456')).rejects.toThrow(ConflictError);

      expect(cache._mocks.mockCacheTechNameLookup).toHaveBeenCalledWith('Vue.js', 'tech-123');
      expect(models._mocks.mockTransaction.rollback).toHaveBeenCalled();
      expect(models._mocks.mockCreate).not.toHaveBeenCalled();
    });

    it('rolls back transaction on error', async () => {
      cache._mocks.mockGetCachedTechNameLookup.mockResolvedValueOnce(null);
      models._mocks.mockFindOne.mockResolvedValueOnce(null);
      models._mocks.mockCreate.mockRejectedValueOnce(new Error('DB error'));

      await expect(createTech(techData, 'user-456')).rejects.toThrow(InternalServerError);

      expect(models._mocks.mockTransaction.rollback).toHaveBeenCalled();
      expect(models._mocks.mockTransaction.commit).not.toHaveBeenCalled();
    });
  });

  // ---------------------------
  // updateTech
  // ---------------------------
  describe('updateTech', () => {
    const updateData = {
      name: 'React.js',
      description: 'Updated description',
    };

    it('updates tech successfully without name change', async () => {
      const tech = { ...baseTech, name: 'React' };
      models._mocks.mockFindByPk.mockResolvedValueOnce(tech);

      const updatedTech = { ...tech, ...updateData, name: 'React' }; // Name unchanged
      tech.update.mockResolvedValueOnce(updatedTech);

      const result = await updateTech('tech-123', updateData, 'user-456');

      expect(models._mocks.mockSequelize.transaction).toHaveBeenCalled();
      expect(models._mocks.mockFindByPk).toHaveBeenCalledWith('tech-123', {
        transaction: models._mocks.mockTransaction,
      });
      expect(tech.update).toHaveBeenCalledWith(updateData, {
        transaction: models._mocks.mockTransaction,
      });
      expect(cache._mocks.mockCacheTech).toHaveBeenCalledWith('tech-123', updatedTech);
      expect(cache._mocks.mockInvalidateAllTechCaches).toHaveBeenCalled();
      expect(models._mocks.mockTransaction.commit).toHaveBeenCalled();
      expect(result).toEqual(updatedTech);
    });

    it('updates tech with name change when new name is available', async () => {
      const tech = { ...baseTech, name: 'React' };
      models._mocks.mockFindByPk.mockResolvedValueOnce(tech);
      cache._mocks.mockGetCachedTechNameLookup.mockResolvedValueOnce(null); // New name not in cache
      models._mocks.mockFindOne.mockResolvedValueOnce(null); // New name not in DB

      const updatedTech = { ...tech, ...updateData, name: 'React.js' };
      tech.update.mockResolvedValueOnce(updatedTech);

      await updateTech('tech-123', updateData, 'user-456');

      expect(cache._mocks.mockGetCachedTechNameLookup).toHaveBeenCalledWith('React.js');
      expect(models._mocks.mockFindOne).toHaveBeenCalledWith({
        where: { name: 'React.js' },
        transaction: models._mocks.mockTransaction,
      });
      expect(cache._mocks.mockInvalidateTechNameCache).toHaveBeenCalledWith('React');
      expect(cache._mocks.mockCacheTechNameLookup).toHaveBeenCalledWith('React.js', 'tech-123');
    });

    it('throws ConflictError when new name already exists', async () => {
      const tech = { ...baseTech, name: 'React' };
      models._mocks.mockFindByPk.mockResolvedValueOnce(tech);
      cache._mocks.mockGetCachedTechNameLookup.mockResolvedValueOnce('other-tech-id');

      const otherTech = { ...baseTech, id: 'other-tech-id' };
      models._mocks.mockFindByPk.mockResolvedValueOnce(otherTech);

      await expect(updateTech('tech-123', { name: 'Vue.js' }, 'user-456')).rejects.toThrow(
        ConflictError
      );

      expect(models._mocks.mockTransaction.rollback).toHaveBeenCalled();
      expect(tech.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when tech not found', async () => {
      models._mocks.mockFindByPk.mockResolvedValueOnce(null);

      await expect(updateTech('tech-999', updateData, 'user-456')).rejects.toThrow(NotFoundError);

      expect(models._mocks.mockTransaction.rollback).toHaveBeenCalled();
    });
  });

  // ---------------------------
  // deleteTech
  // ---------------------------
  describe('deleteTech', () => {
    it('soft deletes tech successfully', async () => {
      const tech = {
        ...baseTech,
        deletedAt: null,
        save: jest.fn().mockResolvedValue(),
      };
      models._mocks.mockFindByPk.mockResolvedValueOnce(tech);

      const result = await deleteTech('tech-123', 'user-456');

      expect(models._mocks.mockFindByPk).toHaveBeenCalledWith('tech-123');
      expect(tech.deletedAt).toBeInstanceOf(Date);
      expect(tech.save).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('throws NotFoundError when tech not found', async () => {
      models._mocks.mockFindByPk.mockResolvedValueOnce(null);

      await expect(deleteTech('tech-999', 'user-456')).rejects.toThrow(NotFoundError);
    });

    it('throws InternalServerError on save error', async () => {
      const tech = {
        ...baseTech,
        save: jest.fn().mockRejectedValue(new Error('Save failed')),
      };
      models._mocks.mockFindByPk.mockResolvedValueOnce(tech);

      await expect(deleteTech('tech-123', 'user-456')).rejects.toThrow(InternalServerError);
    });
  });

  // ---------------------------
  // searchTechs
  // ---------------------------
  describe('searchTechs', () => {
    const mockTechs = [
      { id: 'tech-1', name: 'React', icon: 'react.png' },
      { id: 'tech-2', name: 'React Native', icon: 'react-native.png' },
    ];

    it('returns empty array for empty search term', async () => {
      const result = await searchTechs('');
      expect(result).toEqual([]);
      expect(models._mocks.mockFindAll).not.toHaveBeenCalled();
    });

    it('searches techs by name', async () => {
      models._mocks.mockFindAll.mockResolvedValueOnce(mockTechs);

      const result = await searchTechs('react', 5);

      expect(models._mocks.mockFindAll).toHaveBeenCalledWith({
        where: {
          name: {
            iLike: '%react%',
          },
        },
        limit: 5,
        order: [['name', 'ASC']],
        attributes: ['id', 'name', 'icon'],
      });
      expect(result).toEqual(mockTechs);
    });

    it('throws InternalServerError on database error', async () => {
      models._mocks.mockFindAll.mockRejectedValueOnce(new Error('DB error'));

      await expect(searchTechs('react')).rejects.toThrow(InternalServerError);
    });
  });

  // ---------------------------
  // Edge Cases
  // ---------------------------
  describe('Edge Cases', () => {
    it('handles last page in getAllTechs', async () => {
      cache._mocks.mockGetCachedTechList.mockResolvedValueOnce(null);
      cache._mocks.mockGetCachedTechCount.mockResolvedValueOnce(30); // 30 total items
      models._mocks.mockFindAll.mockResolvedValueOnce([baseTech]);

      const result = await getAllTechs({ page: 3, pageSize: 10 });

      expect(result.pagination.totalPages).toBe(3); // 30/10 = 3 pages
      expect(result.pagination.hasNextPage).toBe(false); // Page 3 is last
      expect(result.pagination.hasPreviousPage).toBe(true);
    });

    it('handles createTech with minimal data', async () => {
      const minimalData = { name: 'Node.js' };
      cache._mocks.mockGetCachedTechNameLookup.mockResolvedValueOnce(null);
      models._mocks.mockFindOne.mockResolvedValueOnce(null);
      models._mocks.mockCreate.mockResolvedValueOnce({
        ...baseTech,
        name: 'Node.js',
        icon: null,
        description: null,
      });

      const result = await createTech(minimalData, 'user-456');

      expect(models._mocks.mockCreate).toHaveBeenCalledWith(
        {
          name: 'Node.js',
          icon: undefined,
          description: undefined,
          createdBy: 'user-456',
        },
        { transaction: models._mocks.mockTransaction }
      );
      expect(result.name).toBe('Node.js');
    });

    it('handles updateTech with partial data', async () => {
      const tech = { ...baseTech, update: jest.fn().mockResolvedValue(baseTech) };
      models._mocks.mockFindByPk.mockResolvedValueOnce(tech);

      const partialData = { description: 'New description' };
      await updateTech('tech-123', partialData, 'user-456');

      expect(tech.update).toHaveBeenCalledWith(
        {
          name: undefined,
          icon: undefined,
          description: 'New description',
        },
        { transaction: models._mocks.mockTransaction }
      );
    });
  });

  // ---------------------------
  // batchCreateTechs
  // ---------------------------
  describe('batchCreateTechs', () => {
    const techsData = [
      { name: 'React', description: 'UI library' },
      { name: 'Node.js', description: 'Runtime' },
      { name: 'MongoDB', description: 'Database' },
    ];

    const mockCreatedTechs = [
      { id: 'tech-1', name: 'React', description: 'UI library', createdBy: 'user-123' },
      { id: 'tech-2', name: 'Node.js', description: 'Runtime', createdBy: 'user-123' },
    ];

    beforeEach(() => {
      jest.clearAllMocks();
      models._mocks.mockSequelize.transaction.mockResolvedValue(models._mocks.mockTransaction);
    });

    it('creates multiple techs successfully', async () => {
      // Mock no existing techs in cache
      cache._mocks.mockGetCachedTechNameLookup
        .mockResolvedValueOnce(null) // React not in cache
        .mockResolvedValueOnce(null) // Node.js not in cache
        .mockResolvedValueOnce(null); // MongoDB not in cache

      // Mock no existing techs in DB
      models._mocks.mockFindOne
        .mockResolvedValueOnce(null) // React not in DB
        .mockResolvedValueOnce(null) // Node.js not in DB
        .mockResolvedValueOnce(null); // MongoDB not in DB

      // Mock creation
      models._mocks.mockCreate
        .mockResolvedValueOnce(mockCreatedTechs[0])
        .mockResolvedValueOnce(mockCreatedTechs[1])
        .mockResolvedValueOnce({
          id: 'tech-3',
          name: 'MongoDB',
          description: 'Database',
          createdBy: 'user-123',
        });

      const result = await batchCreateTechs(techsData, 'user-123');

      // Verify transaction was started
      expect(models._mocks.mockSequelize.transaction).toHaveBeenCalled();

      // Verify cache checks
      expect(cache._mocks.mockGetCachedTechNameLookup).toHaveBeenCalledTimes(3);
      expect(cache._mocks.mockGetCachedTechNameLookup).toHaveBeenCalledWith('React');
      expect(cache._mocks.mockGetCachedTechNameLookup).toHaveBeenCalledWith('Node.js');
      expect(cache._mocks.mockGetCachedTechNameLookup).toHaveBeenCalledWith('MongoDB');

      // Verify DB checks
      expect(models._mocks.mockFindOne).toHaveBeenCalledTimes(3);

      // Verify creations
      expect(models._mocks.mockCreate).toHaveBeenCalledTimes(3);

      // Verify caching
      expect(cache._mocks.mockCacheTech).toHaveBeenCalledTimes(3);
      expect(cache._mocks.mockCacheTechNameLookup).toHaveBeenCalledTimes(3);

      // Verify cache invalidation
      expect(cache._mocks.mockInvalidateAllTechCaches).toHaveBeenCalled();

      // Verify transaction commit
      expect(models._mocks.mockTransaction.commit).toHaveBeenCalled();

      // Verify result structure
      expect(result.success).toBe(true);
      expect(result.created).toHaveLength(3);
      expect(result.skipped).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.summary.total).toBe(3);
      expect(result.summary.created).toBe(3);
    });

    // ... rest of batchCreateTechs tests ...
  });

  // ---------------------------
  // updateTechIcon
  // ---------------------------
  describe('updateTechIcon', () => {
    const mockFileBuffer = Buffer.from('fake-image-data');
    const mockTech = {
      id: 'tech-123',
      name: 'React',
      icon: 'old-icon.png',
      createdBy: 'user-456',
      save: jest.fn().mockResolvedValue(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
      models._mocks.mockSequelize.transaction.mockResolvedValue(models._mocks.mockTransaction);
    });

    it('updates icon successfully as admin', async () => {
      // Mock tech exists
      models._mocks.mockFindByPk.mockResolvedValue(mockTech);

      // Mock successful upload
      imageUploader._mocks.mockUploadTechIcon.mockResolvedValue('new-icon-url.png');

      // Mock successful save
      mockTech.save.mockResolvedValue();

      const result = await updateTechIcon(
        'tech-123',
        mockFileBuffer,
        'icon.png',
        'image/png',
        'user-123',
        true // isAdmin
      );

      // Verify transaction was started
      expect(models._mocks.mockSequelize.transaction).toHaveBeenCalled();

      // Verify tech was fetched
      expect(models._mocks.mockFindByPk).toHaveBeenCalledWith('tech-123', {
        transaction: models._mocks.mockTransaction,
      });

      // Verify upload was called
      expect(imageUploader._mocks.mockUploadTechIcon).toHaveBeenCalledWith({
        fileBuffer: mockFileBuffer,
        originalFileName: 'icon.png',
        mimeType: 'image/png',
        techId: 'tech-123',
        oldImageUrl: 'old-icon.png',
      });

      // Verify tech was saved with new icon
      expect(mockTech.save).toHaveBeenCalledWith({ transaction: models._mocks.mockTransaction });
      expect(mockTech.icon).toBe('new-icon-url.png');

      // Verify caching
      expect(cache._mocks.mockCacheTech).toHaveBeenCalledWith('tech-123', mockTech);
      expect(cache._mocks.mockInvalidateAllTechCaches).toHaveBeenCalled();

      // Verify transaction commit
      expect(models._mocks.mockTransaction.commit).toHaveBeenCalled();

      expect(result).toEqual(mockTech);
    });

    // ... rest of updateTechIcon tests ...
  });
});
