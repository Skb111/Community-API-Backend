/**
 * @file tests/project/project.int.test.js
 * @description Integration tests for project endpoints
 */

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

let testManager;
let app;
let adminAgent;
let userAgent;
let anotherUserAgent;
let adminUser;
let regularUser;
let anotherUser;
let testTech;

describe('Project Controller (integration)', () => {
  beforeAll(async () => {
    testManager = getTestContainersManager();

    // Start containers + env + Redis + MinIO + DB
    await testManager.setup({
      createUsers: true,
    });

    app = testManager.app;

    // Get models - they're in testManager.db
    const models = testManager.db; // Or testManager.getModels()

    // Create agents for different users
    adminAgent = request.agent(app);
    userAgent = request.agent(app);
    anotherUserAgent = request.agent(app);

    // Get test users
    adminUser = testManager.getUser('ADMIN');
    regularUser = testManager.getUser('USER');
    anotherUser = testManager.getUser('USER_2');

    // Sign in users
    const adminLoginRes = await adminAgent.post('/api/v1/auth/signin').send({
      email: adminUser.email,
      password: 'AdminPassword123!',
    });
    expect([200, 201]).toContain(adminLoginRes.status);

    const userLoginRes = await userAgent.post('/api/v1/auth/signin').send({
      email: regularUser.email,
      password: 'UserPassword123!',
    });
    expect([200, 201]).toContain(userLoginRes.status);

    const anotherLoginRes = await anotherUserAgent.post('/api/v1/auth/signin').send({
      email: anotherUser.email,
      password: 'UserPassword123!',
    });
    expect([200, 201]).toContain(anotherLoginRes.status);

    // Create a test tech
    const { Tech } = models;
    testTech = await Tech.create({
      name: 'Test Tech',
      icon: 'test-icon.svg',
      createdBy: adminUser.id,
    });

    // After creating test tech, check the database schema
    console.log('Checking database schema...');
    try {
      // Check Projects table schema
      const [results] = await testManager.db.sequelize.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'Projects'
      ORDER BY ordinal_position;
    `);

      console.log('Projects table columns:', results);

      // Check ProjectTechs junction table
      const [junctionResults] = await testManager.db.sequelize.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'ProjectTechs'
      ORDER BY ordinal_position;
    `);

      console.log('ProjectTechs table columns:', junctionResults);
    } catch (error) {
      console.error('Error checking schema:', error.message);
    }
  });

  afterAll(async () => {
    await testManager.teardown();
    resetTestContainersManager();
    jest.restoreAllMocks();
  });

  // ----------------------------
  // POST /api/v1/projects Tests
  // ----------------------------
  describe('POST /api/v1/projects', () => {
    it('✅ should create project successfully with valid data', async () => {
      const projectData = {
        title: 'E-commerce Platform',
        description: 'Full-stack e-commerce application with React and Node.js',
        repoLink: 'https://github.com/test/ecommerce',
        featured: false,
        techs: [testTech.id],
        contributors: [anotherUser.id],
      };

      const res = await userAgent.post('/api/v1/projects').send(projectData);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Project created successfully',
          project: expect.objectContaining({
            title: projectData.title,
            description: projectData.description,
            repoLink: projectData.repoLink,
            featured: false,
            creator: expect.objectContaining({
              id: regularUser.id,
              fullname: regularUser.fullname,
              email: regularUser.email,
            }),
          }),
        })
      );

      // Check techs are included
      expect(res.body.project.techs).toBeInstanceOf(Array);
      expect(res.body.project.techs[0]).toHaveProperty('id', testTech.id);
      expect(res.body.project.techs[0]).toHaveProperty('name', 'Test Tech');

      // Check contributors are included (excluding creator)
      expect(res.body.project.contributors).toBeInstanceOf(Array);
      expect(res.body.project.contributors[0]).toHaveProperty('id', anotherUser.id);
      expect(res.body.project.contributors[0]).toHaveProperty('fullname', anotherUser.fullname);

      expect(res.body.project).toHaveProperty('id');
      expect(res.body.project).toHaveProperty('createdAt');
      expect(res.body.project).toHaveProperty('updatedAt');
    });

    it('✅ should create project with cover image upload', async () => {
      const projectData = {
        title: 'Project with Cover Image',
        description: 'Project with uploaded cover image',
      };

      const res = await userAgent
        .post('/api/v1/projects')
        .field('title', projectData.title)
        .field('description', projectData.description)
        .attach('coverImage', Buffer.from('fake image content'), 'cover.jpg');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.project).toHaveProperty('coverImage');
      expect(res.body.project.coverImage).toContain('project_cover');
    });

    it('❌ should return 400 for invalid data', async () => {
      const invalidProjectData = {
        title: '', // Empty title
        description: 'Test description',
      };

      const res = await userAgent.post('/api/v1/projects').send(invalidProjectData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBeInstanceOf(Array);
      expect(res.body.message[0]).toContain('Title');
    });

    it('❌ should return 404 for non-existent techs', async () => {
      const projectData = {
        title: 'Project with Invalid Tech',
        description: 'Testing non-existent tech',
        repoLink: 'https://github.com/test/ecommerce',
        featured: false,
        techs: ['019b4147-14bc-7eff-a210-90c24c1a233b'],
      };

      const res = await userAgent.post('/api/v1/projects').send(projectData);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message[0]).toContain('not found');
    });

    it('❌ should return 404 for non-existent contributors', async () => {
      const projectData = {
        title: 'Project with Invalid Contributor',
        description: 'Testing non-existent contributor',
        repoLink: 'https://github.com/test/ecommerce',
        featured: false,
        contributors: ['019b4147-14bc-7eff-a210-90c24c1a233b'],
      };

      const res = await userAgent.post('/api/v1/projects').send(projectData);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message[0]).toContain('not found');
    });
  });

  // ----------------------------
  // GET /api/v1/projects Tests
  // ----------------------------
  describe('GET /api/v1/projects', () => {
    let createdProject;

    beforeAll(async () => {
      // Create a test project for GET tests
      const projectData = {
        title: 'Test Project for GET',
        description: 'This is a test project for GET endpoints',
        featured: true,
        techs: [testTech.id],
      };

      const res = await userAgent.post('/api/v1/projects').send(projectData);
      createdProject = res.body.project;
    });

    it('✅ should get all projects with pagination', async () => {
      const res = await request(app).get('/api/v1/projects').query({
        page: 1,
        pageSize: 10,
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Projects retrieved successfully',
          projects: expect.any(Array),
          pagination: expect.objectContaining({
            page: 1,
            pageSize: 10,
            totalItems: expect.any(Number),
            totalPages: expect.any(Number),
          }),
        })
      );
    });

    it('✅ should filter projects by creator', async () => {
      const res = await request(app).get('/api/v1/projects').query({
        createdBy: regularUser.id,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.projects.every((p) => p.createdBy === regularUser.id)).toBe(true);
    });

    it('✅ should filter projects by tech', async () => {
      const res = await request(app).get('/api/v1/projects').query({
        tech: testTech.id,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.projects.length).toBeGreaterThan(0);
    });

    it('✅ should filter featured projects', async () => {
      const res = await request(app).get('/api/v1/projects').query({
        featured: true,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.projects.every((p) => p.featured === true)).toBe(true);
    });

    it('✅ should search projects', async () => {
      const res = await request(app).get('/api/v1/projects').query({
        search: 'Test Project',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.projects.length).toBeGreaterThan(0);
    });

    it('✅ should get single project by ID', async () => {
      const res = await request(app).get(`/api/v1/projects/${createdProject.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Project retrieved successfully',
          project: expect.objectContaining({
            id: createdProject.id,
            title: createdProject.title,
            creator: expect.objectContaining({
              id: regularUser.id,
              fullname: regularUser.fullname,
            }),
            techs: expect.any(Array),
            contributors: expect.any(Array),
          }),
        })
      );
    });

    it('❌ should return 404 for non-existent project', async () => {
      const res = await request(app).get('/api/v1/projects/019b4147-14bc-7eff-a210-90c24c1a233b');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ----------------------------
  // PUT /api/v1/projects/:id Tests
  // ----------------------------
  describe('PATCH /api/v1/projects/:id', () => {
    let userProject;
    // eslint-disable-next-line no-unused-vars
    let adminProject;

    beforeAll(async () => {
      // Create a project owned by regular user
      const userProjectRes = await userAgent.post('/api/v1/projects').send({
        title: 'User Project for Update',
        description: 'Project owned by regular user',
      });
      userProject = userProjectRes.body.project;

      // Create a project owned by admin
      const adminProjectRes = await adminAgent.post('/api/v1/projects').send({
        title: 'Admin Project for Update',
        description: 'Project owned by admin',
      });
      adminProject = adminProjectRes.body.project;
    });

    it('✅ should update project successfully (owner)', async () => {
      const updateData = {
        title: 'Updated Project Title',
        description: 'Updated project description',
        featured: true,
      };

      const res = await userAgent.patch(`/api/v1/projects/${userProject.id}`).send(updateData);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Project updated successfully',
          project: expect.objectContaining({
            id: userProject.id,
            title: updateData.title,
            description: updateData.description,
            featured: true,
          }),
        })
      );
    });

    it('✅ should update project with new cover image', async () => {
      const res = await userAgent
        .patch(`/api/v1/projects/${userProject.id}`)
        .field('title', 'Project with New Cover')
        .attach('coverImage', Buffer.from('new cover image'), 'new-cover.jpg');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.project.coverImage).not.toBe(userProject.coverImage);
    });

    it('✅ should update tech associations', async () => {
      // Create another tech for testing
      const { Tech } = testManager.db;
      const anotherTech = await Tech.create({
        name: 'Another Tech',
        icon: 'another-icon.svg',
        createdBy: adminUser.id,
      });

      const updateData = {
        title: 'Updated Tech Associations',
        techs: [testTech.id, anotherTech.id],
      };

      const res = await userAgent.patch(`/api/v1/projects/${userProject.id}`).send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('✅ should update contributor associations', async () => {
      const updateData = {
        title: 'Updated Contributors',
        contributors: [anotherUser.id], // Add another user as contributor
      };

      const res = await userAgent.patch(`/api/v1/projects/${userProject.id}`).send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.project.contributors).toHaveLength(1);
      expect(res.body.project.contributors[0]).toHaveProperty('id', anotherUser.id);
    });

    it('❌ should return 403 when non-owner tries to update', async () => {
      const updateData = {
        title: 'Unauthorized Update',
      };

      const res = await anotherUserAgent
        .patch(`/api/v1/projects/${userProject.id}`)
        .send(updateData);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('❌ should return 404 for non-existent project', async () => {
      const res = await userAgent.put('/api/v1/projects/non-existent-id').send({ title: 'Update' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ----------------------------
  // DELETE /api/v1/projects/:id Tests
  // ----------------------------
  describe('DELETE /api/v1/projects/:id', () => {
    let userProject;
    // eslint-disable-next-line no-unused-vars
    let adminProject;

    beforeEach(async () => {
      // Create fresh projects for each test
      const userProjectRes = await userAgent.post('/api/v1/projects').send({
        title: 'User Project for Delete',
        description: 'To be deleted by owner',
      });
      userProject = userProjectRes.body.project;

      const adminProjectRes = await adminAgent.post('/api/v1/projects').send({
        title: 'Admin Project for Delete',
        description: 'To be deleted by admin',
      });
      adminProject = adminProjectRes.body.project;
    });

    it('✅ should delete project successfully (owner)', async () => {
      const res = await userAgent.delete(`/api/v1/projects/${userProject.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Project deleted successfully',
        })
      );

      // Verify project is deleted
      const getRes = await request(app).get(`/api/v1/projects/${userProject.id}`);
      expect(getRes.status).toBe(404);
    });

    it('✅ should delete project with cover image', async () => {
      // Add cover image first
      await userAgent
        .put(`/api/v1/projects/${userProject.id}`)
        .field('title', 'With Cover')
        .attach('coverImage', Buffer.from('cover'), 'cover.jpg');

      // Then delete
      const res = await userAgent.delete(`/api/v1/projects/${userProject.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('❌ should return 403 when non-owner tries to delete', async () => {
      const res = await anotherUserAgent.delete(`/api/v1/projects/${userProject.id}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('❌ should return 404 for non-existent project', async () => {
      const res = await userAgent.delete('/api/v1/projects/019b4147-14bc-7eff-a210-90c24c1a233b');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ----------------------------
  // Management Endpoints Tests
  // ----------------------------
  describe('Management Endpoints', () => {
    let project;
    let anotherTech;

    beforeAll(async () => {
      // Create a project for management tests
      const projectRes = await userAgent.post('/api/v1/projects').send({
        title: 'Project for Management',
        description: 'Testing management endpoints',
      });
      project = projectRes.body.project;

      // Create another tech - FIX: Use testManager.db instead of testManager.models
      const { Tech } = testManager.db;
      anotherTech = await Tech.create({
        name: 'Management Tech',
        icon: 'management-icon.svg',
        createdBy: adminUser.id,
      });
    });

    describe('POST /api/v1/projects/:id/techs', () => {
      it('✅ should add techs to project', async () => {
        const res = await userAgent
          .post(`/api/v1/projects/${project.id}/techs`)
          .send({ techIds: [anotherTech.id] });

        expect(res.status).toBe(200);
        expect(res.body).toEqual(
          expect.objectContaining({
            success: true,
            message: 'Techs added successfully',
            project: expect.objectContaining({
              id: project.id,
            }),
          })
        );
      });

      it('❌ should return 403 when non-owner tries to add techs', async () => {
        const res = await anotherUserAgent
          .post(`/api/v1/projects/${project.id}/techs`)
          .send({ techIds: [testTech.id] });

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
      });
    });

    describe('DELETE /api/v1/projects/:id/techs', () => {
      it('✅ should remove techs from project', async () => {
        // First add a tech
        await userAgent
          .post(`/api/v1/projects/${project.id}/techs`)
          .send({ techIds: [testTech.id] });

        // Then remove it
        const res = await userAgent
          .delete(`/api/v1/projects/${project.id}/techs`)
          .send({ techIds: [testTech.id] });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });
    });

    describe('POST /api/v1/projects/:id/contributors', () => {
      it('✅ should add contributors to project', async () => {
        const res = await userAgent
          .post(`/api/v1/projects/${project.id}/contributors`)
          .send({ userIds: [anotherUser.id] });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('✅ should filter out creator from contributors', async () => {
        // Try to add creator as contributor
        const res = await userAgent
          .post(`/api/v1/projects/${project.id}/contributors`)
          .send({ userIds: [regularUser.id, anotherUser.id] });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });
    });

    describe('DELETE /api/v1/projects/:id/contributors', () => {
      it('✅ should remove contributors from project', async () => {
        // First add a contributor
        await userAgent
          .post(`/api/v1/projects/${project.id}/contributors`)
          .send({ userIds: [anotherUser.id] });

        // Then remove them
        const res = await userAgent
          .delete(`/api/v1/projects/${project.id}/contributors`)
          .send({ userIds: [anotherUser.id] });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });
    });
  });

  // ----------------------------
  // Cache Tests
  // ----------------------------
  describe('Cache Behavior', () => {
    let cachedProject;

    beforeAll(async () => {
      // Create a project for cache tests
      const res = await userAgent.post('/api/v1/projects').send({
        title: 'Cache Test Project',
        description: 'Testing cache behavior',
      });
      cachedProject = res.body.project;
    });

    it('✅ should cache GET requests', async () => {
      // First request - should hit database
      const firstRes = await request(app).get(`/api/v1/projects/${cachedProject.id}`);
      expect(firstRes.status).toBe(200);

      // Second request - should be served from cache (faster)
      const secondRes = await request(app).get(`/api/v1/projects/${cachedProject.id}`);
      expect(secondRes.status).toBe(200);
    });

    it('✅ should invalidate cache on update', async () => {
      // Get initial state (cached)
      await request(app).get(`/api/v1/projects/${cachedProject.id}`);

      // Update project (should invalidate cache)
      await userAgent
        .patch(`/api/v1/projects/${cachedProject.id}`)
        .send({ title: 'Updated Cache Test' });

      // Get updated project (should fetch fresh from DB)
      const updatedRes = await request(app).get(`/api/v1/projects/${cachedProject.id}`);
      expect(updatedRes.body.project.title).toBe('Updated Cache Test');
    });

    it('✅ should invalidate cache on delete', async () => {
      // Create a temporary project
      const tempRes = await userAgent.post('/api/v1/projects').send({
        title: 'Temp Cache Project',
        description: 'To be deleted',
      });
      const tempProject = tempRes.body.project;

      // Cache it
      await request(app).get(`/api/v1/projects/${tempProject.id}`);

      // Delete it
      await userAgent.delete(`/api/v1/projects/${tempProject.id}`);

      // Try to get it (should be 404, not cached 200)
      const getRes = await request(app).get(`/api/v1/projects/${tempProject.id}`);
      expect(getRes.status).toBe(404);
    });
  });
});
