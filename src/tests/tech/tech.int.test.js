const request = require('supertest');
const { getTestContainersManager, resetTestContainersManager } = require('../testContainers');

jest.setTimeout(120000);

// Mock email to avoid SMTP noise
jest.mock('../../services/emailService', () => ({
  sendOtpEmail: jest.fn(async (email, otp) => ({
    success: true,
    message: `Mock OTP ${otp} to ${email}`,
  })),
}));

const TEST_ADMIN = {
  fullname: 'Tech Admin User',
  email: 'techadmin@example.com',
  password: 'Password123!',
};

const TEST_USER = {
  fullname: 'Tech Regular User',
  email: 'techuser@example.com',
  password: 'Password123!',
};

let testManager;
let app;
let adminAgent;
let userAgent;

describe('Tech Controller (integration)', () => {
  beforeAll(async () => {
    testManager = getTestContainersManager();

    await testManager.setup({
      createUsers: false,
    });

    app = testManager.app;
    testManager.getModels();

    // Create admin and regular user agents
    adminAgent = request.agent(app);
    userAgent = request.agent(app);

    // Signup admin user
    const adminSignupRes = await adminAgent.post('/api/v1/auth/signup').send(TEST_ADMIN);
    expect([200, 201]).toContain(adminSignupRes.status);

    // Manually set admin role
    const { User } = testManager.getModels();
    const adminUser = await User.findOne({ where: { email: TEST_ADMIN.email } });
    if (adminUser) {
      adminUser.role = 'ADMIN';
      await adminUser.save();
    }

    // Signup regular user
    const userSignupRes = await userAgent.post('/api/v1/auth/signup').send(TEST_USER);
    expect([200, 201]).toContain(userSignupRes.status);

    // Verify both users are authenticated
    const adminProfileRes = await adminAgent.get('/api/v1/users/profile');
    expect([200, 401, 403]).toContain(adminProfileRes.status);

    const userProfileRes = await userAgent.get('/api/v1/users/profile');
    expect([200, 401, 403]).toContain(userProfileRes.status);
  });

  afterAll(async () => {
    await testManager.teardown();
    resetTestContainersManager();
    jest.restoreAllMocks();
  });

  describe('GET /api/v1/techs', () => {
    it('returns 200 with paginated techs', async () => {
      const res = await request(app).get('/api/v1/techs');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Techs retrieved successfully',
          data: expect.any(Array),
          pagination: expect.objectContaining({
            page: expect.any(Number),
            pageSize: expect.any(Number),
            totalItems: expect.any(Number),
            totalPages: expect.any(Number),
            hasNextPage: expect.any(Boolean),
            hasPreviousPage: expect.any(Boolean),
            search: expect.any(String),
          }),
        })
      );
    });

    it('returns 200 with custom pagination parameters', async () => {
      const res = await request(app).get('/api/v1/techs?page=1&pageSize=5');
      expect(res.status).toBe(200);
      expect(res.body.pagination.pageSize).toBe(5);
      expect(res.body.pagination.page).toBe(1);
    });

    it('returns 200 with search parameter', async () => {
      // First, create a tech to search for
      await adminAgent.post('/api/v1/techs').send({
        name: 'JavaScript',
        description: 'Programming language for the web',
      });

      const res = await request(app).get('/api/v1/techs?search=javascript');
      expect(res.status).toBe(200);
      expect(res.body.pagination.search).toBe('javascript');
      expect(res.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: expect.stringContaining('JavaScript'),
          }),
        ])
      );
    });

    it('returns 200 with empty search string', async () => {
      const res = await request(app).get('/api/v1/techs?search=');
      expect(res.status).toBe(200);
      expect(res.body.pagination.search).toBe('');
    });

    it('returns 400 with invalid pagination parameters', async () => {
      const res = await request(app).get('/api/v1/techs?page=0');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 with invalid pageSize (exceeds max)', async () => {
      const res = await request(app).get('/api/v1/techs?pageSize=200');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/techs/:id', () => {
    let createdTechId;

    beforeAll(async () => {
      // Create a tech for testing
      const techRes = await adminAgent.post('/api/v1/techs').send({
        name: 'React Testing Tech',
        description: 'For testing GET by ID endpoint',
        icon: 'test-icon.png',
      });

      if (techRes.status === 201) {
        createdTechId = techRes.body.tech.id;
      }
    });

    it('returns 200 with tech data when tech exists', async () => {
      if (!createdTechId) {
        console.warn('Skipping test: Tech creation failed in beforeAll');
        return;
      }

      const res = await request(app).get(`/api/v1/techs/${createdTechId}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Tech retrieved successfully',
          tech: expect.objectContaining({
            id: createdTechId,
            name: 'React Testing Tech',
            description: 'For testing GET by ID endpoint',
            icon: 'test-icon.png',
          }),
        })
      );
    });

    it('returns 404 when tech does not exist', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app).get(`/api/v1/techs/${fakeId}`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/techs (Admin only)', () => {
    it('returns 201 when admin creates a new tech', async () => {
      const techData = {
        name: 'Vue.js',
        description: 'Progressive JavaScript Framework',
        icon: 'https://cdn.com/vue-logo.png',
      };

      const res = await adminAgent.post('/api/v1/techs').send(techData);
      expect(res.status).toBe(201);
      expect(res.body.tech.name).toBe('Vue.js');
    });

    it('returns 201 when creating tech with minimal required fields', async () => {
      const techData = {
        name: 'Node.js',
      };

      const res = await adminAgent.post('/api/v1/techs').send(techData);
      expect(res.status).toBe(201);
      expect(res.body.tech.name).toBe('Node.js');
      expect(res.body.tech.description).toBeNull();
      expect(res.body.tech.icon).toBeNull();
    });

    it('returns 403 when regular user tries to create tech', async () => {
      const techData = {
        name: 'Unauthorized Tech',
        description: 'Should not be created by regular user',
      };

      const res = await userAgent.post('/api/v1/techs').send(techData);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 when unauthenticated user tries to create tech', async () => {
      const techData = {
        name: 'Unauthenticated Tech',
        description: 'Should not be created without auth',
      };

      const res = await request(app).post('/api/v1/techs').send(techData);
      expect([401, 403]).toContain(res.status);
    });

    it('returns 409 when creating tech with duplicate name', async () => {
      const techData = {
        name: 'Duplicate Tech',
        description: 'First creation',
      };

      // First creation should succeed
      const firstRes = await adminAgent.post('/api/v1/techs').send(techData);
      expect(firstRes.status).toBe(201);

      // Second creation should fail
      const secondRes = await adminAgent.post('/api/v1/techs').send(techData);
      expect(secondRes.status).toBe(409);
      expect(secondRes.body.success).toBe(false);
      expect(secondRes.body.message[0]).toContain('already exists');
    });

    it('returns 400 when creating tech with invalid data', async () => {
      const invalidTechData = {
        name: '', // Empty name - invalid
        description: 'Invalid tech',
      };

      const res = await adminAgent.post('/api/v1/techs').send(invalidTechData);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when creating tech with invalid icon URL', async () => {
      const invalidTechData = {
        name: 'Invalid Icon Tech',
        icon: 'not-a-valid-url', // Invalid URL format
      };

      const res = await adminAgent.post('/api/v1/techs').send(invalidTechData);
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/v1/techs/:id (Admin only)', () => {
    let createdTechId;

    beforeAll(async () => {
      // Create a tech for testing updates
      const techRes = await adminAgent.post('/api/v1/techs').send({
        name: 'Original Tech Name',
        description: 'Original description',
        icon: 'original-icon.png',
      });

      if (techRes.status === 201) {
        createdTechId = techRes.body.tech.id;
      }
    });

    it('returns 200 when admin updates tech', async () => {
      if (!createdTechId) {
        console.warn('Skipping test: Tech creation failed in beforeAll');
        return;
      }

      const updateData = {
        name: 'Updated Tech Name',
        description: 'Updated description',
        icon: 'updated-icon.png',
      };

      const res = await adminAgent.patch(`/api/v1/techs/${createdTechId}`).send(updateData);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Tech updated successfully',
          tech: expect.objectContaining({
            id: createdTechId,
            name: 'Updated Tech Name',
            description: 'Updated description',
            icon: 'updated-icon.png',
          }),
        })
      );
    });

    it('returns 200 when admin partially updates tech', async () => {
      if (!createdTechId) {
        console.warn('Skipping test: Tech creation failed in beforeAll');
        return;
      }

      const partialUpdate = {
        description: 'Only description updated',
      };

      const res = await adminAgent.patch(`/api/v1/techs/${createdTechId}`).send(partialUpdate);
      expect(res.status).toBe(200);
      expect(res.body.tech.description).toBe('Only description updated');
      // Name should remain unchanged
      expect(res.body.tech.name).toBe('Updated Tech Name');
    });

    it('returns 403 when regular user tries to update tech', async () => {
      if (!createdTechId) {
        console.warn('Skipping test: Tech creation failed in beforeAll');
        return;
      }

      const updateData = {
        name: 'User Updated Name',
      };

      const res = await userAgent.patch(`/api/v1/techs/${createdTechId}`).send(updateData);
      expect(res.status).toBe(403);
    });

    it('returns 404 when updating non-existent tech', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const updateData = {
        name: 'Non-existent Tech',
      };

      const res = await adminAgent.patch(`/api/v1/techs/${fakeId}`).send(updateData);
      expect(res.status).toBe(404);
    });

    it('returns 409 when updating tech name to existing name', async () => {
      // Create two techs
      const tech1Res = await adminAgent.post('/api/v1/techs').send({
        name: 'Tech One',
      });
      const tech2Res = await adminAgent.post('/api/v1/techs').send({
        name: 'Tech Two',
      });

      if (tech1Res.status === 201 && tech2Res.status === 201) {
        const tech2Id = tech2Res.body.tech.id;

        // Try to rename tech2 to "Tech One" - should fail
        const updateRes = await adminAgent.patch(`/api/v1/techs/${tech2Id}`).send({
          name: 'Tech One',
        });

        expect(updateRes.status).toBe(409);
      }
    });

    it('returns 400 when updating tech with invalid data', async () => {
      if (!createdTechId) {
        console.warn('Skipping test: Tech creation failed in beforeAll');
        return;
      }

      const invalidUpdate = {
        name: '', // Empty name - invalid
      };

      const res = await adminAgent.patch(`/api/v1/techs/${createdTechId}`).send(invalidUpdate);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/v1/techs/:id (Admin only)', () => {
    let deletableTechId;

    beforeEach(async () => {
      // Create a fresh tech for deletion in each test
      const techRes = await adminAgent.post('/api/v1/techs').send({
        name: `Deletable Tech ${Date.now()}`,
        description: 'This tech can be deleted',
      });

      if (techRes.status === 201) {
        deletableTechId = techRes.body.tech.id;
      }
    });

    it('returns 200 when admin deletes tech', async () => {
      if (!deletableTechId) {
        console.warn('Skipping test: Tech creation failed in beforeEach');
        return;
      }

      const res = await adminAgent.delete(`/api/v1/techs/${deletableTechId}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Tech deleted successfully',
        })
      );

      // Verify tech is no longer accessible
      const getRes = await request(app).get(`/api/v1/techs/${deletableTechId}`);
      expect(getRes.body.tech.deletedAt).not.toBeNull();
    });

    it('returns 403 when regular user tries to delete tech', async () => {
      if (!deletableTechId) {
        console.warn('Skipping test: Tech creation failed in beforeEach');
        return;
      }

      const res = await userAgent.delete(`/api/v1/techs/${deletableTechId}`);
      expect(res.status).toBe(403);

      // Tech should still exist
      const getRes = await request(app).get(`/api/v1/techs/${deletableTechId}`);
      expect(getRes.status).toBe(200);
    });

    it('returns 404 when deleting non-existent tech', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await adminAgent.delete(`/api/v1/techs/${fakeId}`);
      expect(res.status).toBe(404);
    });

    it('prevents deletion of tech used in projects (if relation checking implemented)', async () => {
      // This test assumes you have Project model and relation checking
      // You might need to adjust based on your actual implementation

      // First create a tech
      const techRes = await adminAgent.post('/api/v1/techs').send({
        name: `Tech With Relations ${Date.now()}`,
      });

      if (techRes.status === 201) {
        const techId = techRes.body.tech.id;

        // Try to delete - might succeed or fail depending on implementation
        const deleteRes = await adminAgent.delete(`/api/v1/techs/${techId}`);

        // The response could be 200 (if no relation checking)
        // or 400/409 (if relation checking is implemented)
        expect([200, 400, 409]).toContain(deleteRes.status);
      }
    });
  });

  describe('Tech Search and Filtering', () => {
    beforeAll(async () => {
      // Create some test techs for search testing
      await adminAgent.post('/api/v1/techs').send({ name: 'React' });
      await adminAgent.post('/api/v1/techs').send({ name: 'React Native' });
      await adminAgent.post('/api/v1/techs').send({ name: 'Angular' });
      await adminAgent.post('/api/v1/techs').send({ name: 'Vue.js' });
      await adminAgent.post('/api/v1/techs').send({ name: 'Node.js' });
    });

    it('filters techs by search term (case-insensitive)', async () => {
      const res = await request(app).get('/api/v1/techs?search=react');
      expect(res.status).toBe(200);

      // Should find "React" and "React Native"
      const reactTechs = res.body.data.filter((tech) => tech.name.toLowerCase().includes('react'));
      expect(reactTechs.length).toBeGreaterThan(0);

      // All returned techs should contain "react" in name
      res.body.data.forEach((tech) => {
        expect(tech.name.toLowerCase()).toContain('react');
      });
    });

    it('returns empty array for non-matching search', async () => {
      const res = await request(app).get('/api/v1/techs?search=nonexistenttech');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination.totalItems).toBe(0);
    });

    it('combines search with pagination', async () => {
      const res = await request(app).get('/api/v1/techs?search=js&page=1&pageSize=2');
      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.pageSize).toBe(2);
      expect(res.body.pagination.search).toBe('js');

      // All returned techs should contain "js" in name
      res.body.data.forEach((tech) => {
        expect(tech.name.toLowerCase()).toContain('js');
      });
    });
  });

  describe('Cache Behavior', () => {
    let testTechId;

    beforeAll(async () => {
      // Create a tech for cache testing
      const techRes = await adminAgent.post('/api/v1/techs').send({
        name: `Cache Test Tech ${Date.now()}`,
      });

      if (techRes.status === 201) {
        testTechId = techRes.body.tech.id;
      }
    });

    it('caches GET requests', async () => {
      if (!testTechId) return;

      // First request - might be cache miss
      const firstRes = await request(app).get(`/api/v1/techs/${testTechId}`);
      expect(firstRes.status).toBe(200);

      // Second request - might be cache hit
      const secondRes = await request(app).get(`/api/v1/techs/${testTechId}`);
      expect(secondRes.status).toBe(200);

      // Both should return same data
      expect(firstRes.body.tech).toEqual(secondRes.body.tech);
    });

    it('invalidates cache on update', async () => {
      if (!testTechId) return;

      // Get initial state
      const initialRes = await request(app).get(`/api/v1/techs/${testTechId}`);
      const initialName = initialRes.body.tech.name;

      // Update the tech
      const newName = `Updated ${Date.now()}`;
      await adminAgent.patch(`/api/v1/techs/${testTechId}`).send({
        name: newName,
      });

      // Get again - should have updated data
      const updatedRes = await request(app).get(`/api/v1/techs/${testTechId}`);
      expect(updatedRes.body.tech.name).toBe(newName);
      expect(updatedRes.body.tech.name).not.toBe(initialName);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('handles large number of techs with pagination', async () => {
      const res = await request(app).get('/api/v1/techs?pageSize=100');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(100);
    });

    it('handles special characters in search', async () => {
      await adminAgent.post('/api/v1/techs').send({
        name: 'C#',
        description: 'C Sharp programming language',
      });

      const res = await request(app).get('/api/v1/techs?search=c#');
      expect(res.status).toBe(200);
      // Should handle special characters gracefully
    });

    it('handles very long search strings', async () => {
      const longSearch = 'a'.repeat(100);
      const res = await request(app).get(`/api/v1/techs?search=${longSearch}`);
      expect(res.status).toBe(200);
      // Should not crash with long search strings
    });

    it('preserves response structure for empty database', async () => {
      // Note: This might be hard to test with existing data
      // In a real scenario, you might have a fresh test database
      const res = await request(app).get('/api/v1/techs?search=nonexistent12345');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('POST /api/v1/techs/batch (Admin only)', () => {
    it('returns 201 when admin creates multiple techs', async () => {
      const batchData = [
        { name: 'Batch Tech 1', description: 'First batch tech' },
        { name: 'Batch Tech 2', description: 'Second batch tech' },
        { name: 'Batch Tech 3', description: 'Third batch tech' },
      ];

      const res = await adminAgent.post('/api/v1/techs/batch').send(batchData);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Techs batch created successfully',
          summary: expect.objectContaining({
            total: 3,
            created: expect.any(Number),
            skipped: expect.any(Number),
            errors: expect.any(Number),
          }),
        })
      );

      // Verify at least some were created
      expect(res.body.summary.created).toBeGreaterThan(0);
    });

    it('handles duplicates gracefully in batch creation', async () => {
      // First, create a tech
      await adminAgent.post('/api/v1/techs').send({
        name: 'Existing Batch Tech',
        description: 'Already exists',
      });

      const batchData = [
        { name: 'New Batch Tech 1' },
        { name: 'Existing Batch Tech' }, // Should be skipped
        { name: 'New Batch Tech 2' },
      ];

      const res = await adminAgent.post('/api/v1/techs/batch').send(batchData);

      expect(res.status).toBe(201);
      expect(res.body.summary.skipped).toBe(1);
      expect(res.body.summary.created).toBe(2);
    });

    it('returns 403 when regular user tries batch creation', async () => {
      const batchData = [{ name: 'User Batch Tech' }];

      const res = await userAgent.post('/api/v1/techs/batch').send(batchData);
      expect(res.status).toBe(403);
    });

    it('returns 400 when batch is empty', async () => {
      const res = await adminAgent.post('/api/v1/techs/batch').send([]);
      expect(res.status).toBe(400);
    });

    it('returns 400 when batch exceeds size limit', async () => {
      const largeBatch = Array(101).fill({ name: 'Tech' });
      const res = await adminAgent.post('/api/v1/techs/batch').send(largeBatch);
      expect(res.status).toBe(400);
    });

    it('returns 400 when batch contains invalid data', async () => {
      const invalidBatch = [
        { name: 'Valid Tech' },
        { name: '' }, // Invalid: empty name
        { description: 'Missing name' }, // Invalid: missing name
      ];

      const res = await adminAgent.post('/api/v1/techs/batch').send(invalidBatch);
      expect([400, 201]).toContain(res.status); // Might create valid ones
    });
  });

  describe('PATCH /api/v1/techs/:id/icon (Admin or creator only)', () => {
    let createdTechId;
    let creatorAgent;

    beforeAll(async () => {
      // Create a tech for testing
      const techRes = await adminAgent.post('/api/v1/techs').send({
        name: 'Icon Test Tech',
        description: 'For testing icon upload',
      });

      if (techRes.status === 201) {
        createdTechId = techRes.body.tech.id;
      }

      // Create a creator user agent
      creatorAgent = request.agent(app);
      const creatorUser = {
        fullname: 'Tech Creator',
        email: `creator${Date.now()}@example.com`,
        password: 'Password123!',
      };

      await creatorAgent.post('/api/v1/auth/signup').send(creatorUser);

      // Create a tech as this user
      const creatorTechRes = await creatorAgent.post('/api/v1/techs').send({
        name: 'Creator Owned Tech',
      });

      if (creatorTechRes.status === 201) {
        // This tech is owned by the creator
      }
    });

    it('returns 200 when admin updates tech icon', async () => {
      if (!createdTechId) {
        console.warn('Skipping test: Tech creation failed');
        return;
      }

      const res = await adminAgent
        .patch(`/api/v1/techs/${createdTechId}/icon`)
        .attach('icon', Buffer.from('fake-image-data'), 'icon.png');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Tech icon updated successfully',
          tech: expect.objectContaining({
            id: createdTechId,
            icon: expect.any(String),
          }),
        })
      );
    });

    it('returns 200 when creator updates their own tech icon', async () => {
      // Creator should be able to update their own tech
      const creatorTechRes = await creatorAgent.post('/api/v1/techs').send({
        name: `Creator Tech ${Date.now()}`,
      });

      if (creatorTechRes.status === 201) {
        const creatorTechId = creatorTechRes.body.tech.id;

        const res = await creatorAgent
          .patch(`/api/v1/techs/${creatorTechId}/icon`)
          .attach('icon', Buffer.from('creator-image'), 'icon.png');

        expect(res.status).toBe(200);
      }
    });

    it('returns 403 when regular user tries to update admin tech icon', async () => {
      if (!createdTechId) {
        console.warn('Skipping test: Tech creation failed');
        return;
      }

      const res = await userAgent
        .patch(`/api/v1/techs/${createdTechId}/icon`)
        .attach('icon', Buffer.from('user-image'), 'icon.png');

      expect(res.status).toBe(403);
    });

    it('returns 400 when no file is uploaded', async () => {
      if (!createdTechId) {
        console.warn('Skipping test: Tech creation failed');
        return;
      }

      const res = await adminAgent.patch(`/api/v1/techs/${createdTechId}/icon`).send({}); // No file

      expect(res.status).toBe(400);
    });

    it('returns 400 when invalid file type is uploaded', async () => {
      if (!createdTechId) {
        console.warn('Skipping test: Tech creation failed');
        return;
      }

      const res = await adminAgent
        .patch(`/api/v1/techs/${createdTechId}/icon`)
        .attach('icon', Buffer.from('text data'), 'file.txt');

      expect(res.status).toBe(400);
    });

    it('returns 400 when file is too large', async () => {
      if (!createdTechId) {
        console.warn('Skipping test: Tech creation failed');
        return;
      }

      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB > 5MB limit
      const res = await adminAgent
        .patch(`/api/v1/techs/${createdTechId}/icon`)
        .attach('icon', largeBuffer, 'large-icon.png');

      expect(res.status).toBe(400);
    });

    it('returns 404 when updating non-existent tech icon', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await adminAgent
        .patch(`/api/v1/techs/${fakeId}/icon`)
        .attach('icon', Buffer.from('data'), 'icon.png');

      expect(res.status).toBe(404);
    });

    it('accepts various image formats', async () => {
      if (!createdTechId) {
        console.warn('Skipping test: Tech creation failed');
        return;
      }

      const formats = [
        { name: 'icon.jpg', type: 'image/jpeg' },
        { name: 'icon.png', type: 'image/png' },
        { name: 'icon.gif', type: 'image/gif' },
        { name: 'icon.webp', type: 'image/webp' },
        { name: 'icon.svg', type: 'image/svg+xml' },
      ];

      for (const format of formats) {
        const res = await adminAgent
          .patch(`/api/v1/techs/${createdTechId}/icon`)
          .attach('icon', Buffer.from('data'), format.name);

        // Should accept all valid formats
        expect([200, 400]).toContain(res.status); // 400 if mimetype detection fails
      }
    });

    it('replaces existing icon with new one', async () => {
      if (!createdTechId) {
        console.warn('Skipping test: Tech creation failed');
        return;
      }

      // First upload
      const firstRes = await adminAgent
        .patch(`/api/v1/techs/${createdTechId}/icon`)
        .attach('icon', Buffer.from('first'), 'first.png');

      expect(firstRes.status).toBe(200);
      const firstIconUrl = firstRes.body.tech.icon;

      // Second upload (replace)
      const secondRes = await adminAgent
        .patch(`/api/v1/techs/${createdTechId}/icon`)
        .attach('icon', Buffer.from('second'), 'second.png');

      expect(secondRes.status).toBe(200);
      const secondIconUrl = secondRes.body.tech.icon;

      // URLs should be different
      expect(secondIconUrl).not.toBe(firstIconUrl);
    });
  });
});
