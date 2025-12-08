/**
 * @file tests/blog/blog.int.test.js
 * @description Integration tests for blog endpoints
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
let adminUser;
let regularUser;

describe('Blog Controller (integration)', () => {
  beforeAll(async () => {
    testManager = getTestContainersManager();

    // Start containers + env + Redis + MinIO + DB
    await testManager.setup({
      createUsers: true,
    });

    app = testManager.app;
    testManager.getModels();

    // Create agents for different users
    adminAgent = request.agent(app);
    userAgent = request.agent(app);

    // Get test users
    adminUser = testManager.getUser('ADMIN');
    regularUser = testManager.getUser('USER');

    // Sign in as admin
    const adminLoginRes = await adminAgent.post('/api/v1/auth/signin').send({
      email: adminUser.email,
      password: 'AdminPassword123!',
    });
    expect([200, 201]).toContain(adminLoginRes.status);

    // Sign in as regular user
    const userLoginRes = await userAgent.post('/api/v1/auth/signin').send({
      email: regularUser.email,
      password: 'UserPassword123!',
    });
    expect([200, 201]).toContain(userLoginRes.status);
  });

  afterAll(async () => {
    await testManager.teardown();
    resetTestContainersManager();
    jest.restoreAllMocks();
  });

  // ----------------------------
  // POST /api/v1/blogs Tests
  // ----------------------------
  describe('POST /api/v1/blogs', () => {
    it('✅ should create blog successfully with valid data', async () => {
      const blogData = {
        title: 'Test Blog Post',
        description: 'This is a test blog post description',
        topic: 'Technology',
        featured: false,
      };

      const res = await adminAgent.post('/api/v1/blogs').send(blogData);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Blog post created successfully',
          blog: expect.objectContaining({
            title: blogData.title,
            description: blogData.description,
            topic: blogData.topic,
            featured: false,
            author: expect.objectContaining({
              id: adminUser.id,
              fullname: adminUser.fullname,
              email: adminUser.email,
            }),
          }),
        })
      );
      expect(res.body.blog).toHaveProperty('id');
      expect(res.body.blog).toHaveProperty('createdAt');
      expect(res.body.blog).toHaveProperty('updatedAt');
    });

    it('✅ should create blog with cover image file upload', async () => {
      const blogData = {
        title: 'Blog with Cover Image',
        description: 'This blog has a cover image',
      };
      const img = Buffer.from('89504E470D0A1A0A', 'hex'); // tiny png-like bytes

      const res = await adminAgent
        .post('/api/v1/blogs')
        .field('title', blogData.title)
        .field('description', blogData.description)
        .attach('coverImage', img, { filename: 'cover.png', contentType: 'image/png' });

      expect(res.status).toBe(201);
      expect(res.body.blog).toHaveProperty('coverImage');
      expect(res.body.blog.coverImage).toBeTruthy();
    });

    it('✅ should create blog with cover image URL', async () => {
      const blogData = {
        title: 'Blog with Cover URL',
        description: 'This blog has a cover image URL',
        coverImage: 'https://example.com/image.jpg',
      };

      const res = await adminAgent.post('/api/v1/blogs').send(blogData);

      expect(res.status).toBe(201);
      expect(res.body.blog.coverImage).toBe(blogData.coverImage);
    });

    it('❌ should return 400 when title is missing', async () => {
      const blogData = {
        description: 'This blog has no title',
      };

      const res = await adminAgent.post('/api/v1/blogs').send(blogData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('❌ should return 400 when description is missing', async () => {
      const blogData = {
        title: 'Blog without description',
      };

      const res = await adminAgent.post('/api/v1/blogs').send(blogData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('❌ should return 401 when not authenticated', async () => {
      const blogData = {
        title: 'Test Blog',
        description: 'Test Description',
      };

      const res = await request(app).post('/api/v1/blogs').send(blogData);

      expect([401, 403]).toContain(res.status);
    });
  });

  // ----------------------------
  // GET /api/v1/blogs Tests
  // ----------------------------
  describe('GET /api/v1/blogs', () => {
    beforeEach(async () => {
      // Create some test blogs
      const { Blog } = testManager.getModels();
      await Blog.destroy({ where: {}, force: true });

      // Create blogs with different properties
      await Blog.create({
        title: 'Featured Blog',
        description: 'This is a featured blog',
        createdBy: adminUser.id,
        featured: true,
        topic: 'Technology',
      });

      await Blog.create({
        title: 'Regular Blog',
        description: 'This is a regular blog',
        createdBy: adminUser.id,
        featured: false,
        topic: 'Science',
      });

      await Blog.create({
        title: 'Another Tech Blog',
        description: 'Another technology blog',
        createdBy: adminUser.id,
        featured: false,
        topic: 'Technology',
      });
    });

    it('✅ should return paginated blogs with default pagination', async () => {
      const res = await request(app).get('/api/v1/blogs');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Blogs retrieved successfully',
          blogs: expect.any(Array),
          pagination: expect.objectContaining({
            page: 1,
            pageSize: 10,
            totalItems: expect.any(Number),
            totalPages: expect.any(Number),
            hasNextPage: expect.any(Boolean),
            hasPreviousPage: expect.any(Boolean),
          }),
        })
      );
    });

    it('✅ should return blogs with custom pagination', async () => {
      const res = await request(app).get('/api/v1/blogs?page=1&pageSize=2');

      expect(res.status).toBe(200);
      expect(res.body.pagination).toEqual(
        expect.objectContaining({
          page: 1,
          pageSize: 2,
        })
      );
      expect(res.body.blogs.length).toBeLessThanOrEqual(2);
    });

    it('✅ should filter blogs by featured status', async () => {
      const res = await request(app).get('/api/v1/blogs?featured=true');

      expect(res.status).toBe(200);
      expect(res.body.blogs.every((blog) => blog.featured === true)).toBe(true);
    });

    it('✅ should filter blogs by topic', async () => {
      const res = await request(app).get('/api/v1/blogs?topic=Technology');

      expect(res.status).toBe(200);
      expect(res.body.blogs.length).toBeGreaterThan(0);
      // All blogs should have Technology in topic (case-insensitive partial match)
      res.body.blogs.forEach((blog) => {
        expect(blog.topic.toLowerCase()).toContain('technology');
      });
    });

    it('✅ should filter blogs by createdBy', async () => {
      const res = await request(app).get(`/api/v1/blogs?createdBy=${adminUser.id}`);

      expect(res.status).toBe(200);
      expect(res.body.blogs.every((blog) => blog.createdBy === adminUser.id)).toBe(true);
    });

    it('✅ should return 400 for invalid page number', async () => {
      const res = await request(app).get('/api/v1/blogs?page=0');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('✅ should return 400 for invalid pageSize (too high)', async () => {
      const res = await request(app).get('/api/v1/blogs?pageSize=101');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ----------------------------
  // GET /api/v1/blogs/:id Tests
  // ----------------------------
  describe('GET /api/v1/blogs/:id', () => {
    let testBlog;

    beforeEach(async () => {
      const { Blog } = testManager.getModels();
      testBlog = await Blog.create({
        title: 'Single Blog Test',
        description: 'This is a test for single blog retrieval',
        createdBy: adminUser.id,
        topic: 'Testing',
      });
    });

    it('✅ should return blog by ID', async () => {
      const res = await request(app).get(`/api/v1/blogs/${testBlog.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Blog retrieved successfully',
          blog: expect.objectContaining({
            id: testBlog.id,
            title: testBlog.title,
            description: testBlog.description,
            author: expect.objectContaining({
              id: adminUser.id,
              fullname: adminUser.fullname,
              email: adminUser.email,
            }),
          }),
        })
      );
    });

    it('❌ should return 404 when blog does not exist', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app).get(`/api/v1/blogs/${fakeId}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('❌ should return 400 for invalid UUID format', async () => {
      const res = await request(app).get('/api/v1/blogs/invalid-uuid');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ----------------------------
  // PATCH /api/v1/blogs/:id Tests
  // ----------------------------
  describe('PATCH /api/v1/blogs/:id', () => {
    let testBlog;

    beforeEach(async () => {
      const { Blog } = testManager.getModels();
      testBlog = await Blog.create({
        title: 'Blog to Update',
        description: 'Original description',
        createdBy: adminUser.id,
        topic: 'Original Topic',
      });
    });

    it('✅ should update blog successfully by author', async () => {
      const updates = {
        title: 'Updated Title',
        description: 'Updated description',
      };

      const res = await adminAgent.patch(`/api/v1/blogs/${testBlog.id}`).send(updates);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Blog post updated successfully',
          blog: expect.objectContaining({
            id: testBlog.id,
            title: updates.title,
            description: updates.description,
          }),
        })
      );
    });

    it('✅ should allow admin to update featured status', async () => {
      const updates = {
        featured: true,
      };

      const res = await adminAgent.patch(`/api/v1/blogs/${testBlog.id}`).send(updates);

      expect(res.status).toBe(200);
      expect(res.body.blog.featured).toBe(true);
    });

    it('❌ should return 403 when non-author tries to update', async () => {
      const updates = {
        title: 'Unauthorized Update',
      };

      const res = await userAgent.patch(`/api/v1/blogs/${testBlog.id}`).send(updates);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('❌ should return 404 when blog does not exist', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await adminAgent.patch(`/api/v1/blogs/${fakeId}`).send({ title: 'New Title' });

      expect(res.status).toBe(404);
    });

    it('❌ should return 400 for invalid update data', async () => {
      const res = await adminAgent.patch(`/api/v1/blogs/${testBlog.id}`).send({ title: '' });

      expect(res.status).toBe(400);
    });
  });

  // ----------------------------
  // DELETE /api/v1/blogs/:id Tests
  // ----------------------------
  describe('DELETE /api/v1/blogs/:id', () => {
    let testBlog;

    beforeEach(async () => {
      const { Blog } = testManager.getModels();
      testBlog = await Blog.create({
        title: 'Blog to Delete',
        description: 'This blog will be deleted',
        createdBy: adminUser.id,
      });
    });

    it('✅ should delete blog successfully by author', async () => {
      const res = await adminAgent.delete(`/api/v1/blogs/${testBlog.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: 'Blog post deleted successfully',
      });

      // Verify blog is deleted
      const { Blog } = testManager.getModels();
      const deletedBlog = await Blog.findByPk(testBlog.id);
      expect(deletedBlog).toBeNull();
    });

    it('❌ should return 403 when non-author tries to delete', async () => {
      const { Blog } = testManager.getModels();
      const userBlog = await Blog.create({
        title: 'User Blog',
        description: 'User blog',
        createdBy: regularUser.id,
      });

      await adminAgent.delete(`/api/v1/blogs/${userBlog.id}`);

      // Admin should be able to delete any blog, but let's test with user trying to delete admin's blog
      const adminBlog = await Blog.create({
        title: 'Admin Blog',
        description: 'Admin blog',
        createdBy: adminUser.id,
      });

      const userDeleteRes = await userAgent.delete(`/api/v1/blogs/${adminBlog.id}`);
      expect(userDeleteRes.status).toBe(403);
    });

    it('❌ should return 404 when blog does not exist', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await adminAgent.delete(`/api/v1/blogs/${fakeId}`);

      expect(res.status).toBe(404);
    });
  });

  // ----------------------------
  // PATCH /api/v1/blogs/:id/cover-image Tests
  // ----------------------------
  describe('PATCH /api/v1/blogs/:id/cover-image', () => {
    let testBlog;

    beforeEach(async () => {
      const { Blog } = testManager.getModels();
      testBlog = await Blog.create({
        title: 'Blog for Cover Image',
        description: 'This blog will have its cover image updated',
        createdBy: adminUser.id,
      });
    });

    it('✅ should update cover image successfully', async () => {
      const img = Buffer.from('89504E470D0A1A0A', 'hex'); // tiny png-like bytes

      const res = await adminAgent
        .patch(`/api/v1/blogs/${testBlog.id}/cover-image`)
        .attach('coverImage', img, { filename: 'cover.png', contentType: 'image/png' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Cover image updated successfully',
          blog: expect.objectContaining({
            id: testBlog.id,
            coverImage: expect.any(String),
          }),
        })
      );
      expect(res.body.blog.coverImage).toBeTruthy();
    });

    it('❌ should return 400 when no file is uploaded', async () => {
      const res = await adminAgent.patch(`/api/v1/blogs/${testBlog.id}/cover-image`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('❌ should return 403 when non-author tries to update cover image', async () => {
      const { Blog } = testManager.getModels();
      const adminBlog = await Blog.create({
        title: 'Admin Blog',
        description: 'Admin blog',
        createdBy: adminUser.id,
      });

      const img = Buffer.from('89504E470D0A1A0A', 'hex');
      const res = await userAgent
        .patch(`/api/v1/blogs/${adminBlog.id}/cover-image`)
        .attach('coverImage', img, { filename: 'cover.png', contentType: 'image/png' });

      expect(res.status).toBe(403);
    });

    it('❌ should return 404 when blog does not exist', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const img = Buffer.from('89504E470D0A1A0A', 'hex');

      const res = await adminAgent
        .patch(`/api/v1/blogs/${fakeId}/cover-image`)
        .attach('coverImage', img, { filename: 'cover.png', contentType: 'image/png' });

      expect(res.status).toBe(404);
    });
  });
});
