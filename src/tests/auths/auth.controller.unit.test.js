// tests/auth.controller.unit.test.js
jest.mock('../../utils/redisClient', () => ({
  client: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    quit: jest.fn(),
  },
  disconnect: jest.fn(),
}));

jest.mock('../../services/otpService', () => ({
  generateOtp: jest.fn(),
  saveOtpForEmail: jest.fn(),
  getOtpForEmail: jest.fn(),
  deleteOtpForEmail: jest.fn(),
}));

jest.mock('../../services/emailService', () => ({
  sendOtpEmail: jest.fn(),
}));

// Mock asyncHandler (transparent in tests)
jest.mock('../../middleware/errorHandler', () => ({
  asyncHandler: (fn) => fn,
}));

// Mock validator schemas (Joi schemas)
const mockSignupValidate = jest.fn();
const mockSigninValidate = jest.fn();
const mockForgotPasswordValidate = jest.fn();
const mockVerifyOtpValidate = jest.fn();
const mockResetPasswordValidate = jest.fn();

jest.mock('../../utils/validator', () => {
  const actual = jest.requireActual('../../utils/validator');
  return {
    ...actual,
    signupSchema: {
      validate: (...args) => mockSignupValidate(...args),
    },
    signinSchema: {
      validate: (...args) => mockSigninValidate(...args),
    },
    forgotPasswordSchema: {
      validate: (...args) => mockForgotPasswordValidate(...args),
    },
    verifyOtpSchema: {
      validate: (...args) => mockVerifyOtpValidate(...args),
    },
    resetPasswordSchema: {
      validate: (...args) => mockResetPasswordValidate(...args),
    },
  };
});

const mockSetAuthCookies = jest.fn();
jest.mock('../../utils/cookies', () => ({
  setAuthCookies: mockSetAuthCookies,
  clearAuthCookies: jest.fn(),
  cfg: { ACCESS_COOKIE: 'access_token' },
}));

jest.mock('../../utils/authCookieConfig', () => ({
  REFRESH_COOKIE: 'refresh_token',
}));

const mockAuthService = {
  signup: jest.fn(),
  signin: jest.fn(),
  findUserByEmail: jest.fn(),
  updatePasswordByEmail: jest.fn().mockResolvedValue(),
  resetPassword: jest.fn(),
  refresh: jest.fn(),
};

jest.mock('../../services/authService', () => mockAuthService);

const {
  generateOtp,
  saveOtpForEmail,
  getOtpForEmail,
  deleteOtpForEmail,
} = require('../../services/otpService');
const { sendOtpEmail } = require('../../services/emailService');
const authService = require('../../services/authService');
const authController = require('../../controllers/authController');
const { ValidationError } = require('../../utils/customErrors');

// Helper for mock response
const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  return res;
};

describe('AuthController', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------- SIGNUP ----------------
  describe('signup', () => {
    it('should return 201 on success', async () => {
      const req = {
        body: { fullname: 'John Doe', email: 'john@example.com', password: 'password123' },
      };
      const res = mockResponse();

      mockSignupValidate.mockReturnValue({
        error: null,
        value: { fullname: 'John Doe', email: 'john@example.com', password: 'password123' },
      });
      authService.signup.mockResolvedValue({
        success: true,
        message: 'ok',
        tokens: { accessToken: 'a', refreshToken: 'r' },
      });

      await authController.signup(req, res);

      expect(mockSignupValidate).toHaveBeenCalledWith(
        { fullname: 'John Doe', email: 'john@example.com', password: 'password123' },
        { abortEarly: false }
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'ok' });
    });

    it('should throw ValidationError on validation error', async () => {
      const req = { body: { fullname: '', email: 'bademail', password: '123' } };
      const res = mockResponse();

      mockSignupValidate.mockReturnValue({
        error: {
          details: [
            { message: 'FullName is required' },
            { message: 'Email must be a valid email address' },
            { message: 'Password must be at least 8 characters long' },
          ],
        },
        value: null,
      });

      await expect(authController.signup(req, res)).rejects.toThrow(ValidationError);
    });
  });

  // ---------------- SIGNIN ----------------
  describe('signin', () => {
    it('should return 200 on success', async () => {
      const req = { body: { email: 'john@example.com', password: 'password123' } };
      const res = mockResponse();

      mockSigninValidate.mockReturnValue({
        error: null,
        value: { email: 'john@example.com', password: 'password123' },
      });
      authService.signin.mockResolvedValue({ success: true, message: 'ok' });

      await authController.signin(req, res);

      expect(mockSigninValidate).toHaveBeenCalledWith(
        { email: 'john@example.com', password: 'password123' },
        { abortEarly: false }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'ok' });
    });

    it('should throw ValidationError on validation error', async () => {
      const req = { body: { email: 'notanemail', password: '123' } };
      const res = mockResponse();

      mockSigninValidate.mockReturnValue({
        error: {
          details: [
            { message: 'Email must be a valid email address' },
            { message: 'Password must be at least 8 characters long' },
          ],
        },
        value: null,
      });

      await expect(authController.signin(req, res)).rejects.toThrow(ValidationError);
    });
  });

  // ---------------- FORGOT PASSWORD ----------------
  describe('forgotPassword', () => {
    it('should send OTP and return 200 even if email does not exist', async () => {
      const req = { body: { email: 'john@example.com' } };
      const res = mockResponse();

      mockForgotPasswordValidate.mockReturnValue({
        error: null,
        value: { email: 'john@example.com' },
      });
      authService.findUserByEmail.mockResolvedValue(null); // user not found

      await authController.forgotPassword(req, res);

      expect(mockForgotPasswordValidate).toHaveBeenCalledWith(
        { email: 'john@example.com' },
        { abortEarly: false }
      );
      expect(authService.findUserByEmail).toHaveBeenCalledWith('john@example.com');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'An OTP has been sent to your email successfully',
      });
    });

    it('should generate and send OTP when user exists', async () => {
      const req = { body: { email: 'user@example.com' } };
      const res = mockResponse();

      const mockUser = { id: 1, email: 'user@example.com' };
      const mockOtp = '123456';

      mockForgotPasswordValidate.mockReturnValue({
        error: null,
        value: { email: 'user@example.com' },
      });
      authService.findUserByEmail.mockResolvedValue(mockUser);
      generateOtp.mockReturnValue(mockOtp);
      saveOtpForEmail.mockResolvedValue();
      sendOtpEmail.mockResolvedValue();

      await authController.forgotPassword(req, res);

      expect(generateOtp).toHaveBeenCalled();
      expect(saveOtpForEmail).toHaveBeenCalledWith('user@example.com', mockOtp);
      expect(sendOtpEmail).toHaveBeenCalledWith('user@example.com', mockOtp);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'An OTP has been sent to your email successfully',
        })
      );
    });

    it('should throw ValidationError on validation error', async () => {
      const req = { body: { email: 'invalid-email' } };
      const res = mockResponse();

      mockForgotPasswordValidate.mockReturnValue({
        error: {
          details: [{ message: 'Email must be a valid email address' }],
        },
        value: null,
      });

      await expect(authController.forgotPassword(req, res)).rejects.toThrow(ValidationError);
    });
  });

  // verify otp
  describe('verifyOtp', () => {
    it('should throw ValidationError when validation fails', async () => {
      const req = { body: { email: 'invalid-email', otp: '123456' } };
      const res = mockResponse();

      mockVerifyOtpValidate.mockReturnValue({
        error: {
          details: [{ message: 'Email must be a valid email address' }],
        },
        value: null,
      });

      await expect(authController.verifyOtp(req, res)).rejects.toThrow(ValidationError);
      expect(getOtpForEmail).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when OTP is invalid or expired', async () => {
      const req = { body: { email: 'john@example.com', otp: '000000' } };
      const res = mockResponse();

      mockVerifyOtpValidate.mockReturnValue({
        error: null,
        value: {
          email: 'john@example.com',
          otp: '000000',
        },
      });
      getOtpForEmail.mockResolvedValue(null); // Expired or not found

      await expect(authController.verifyOtp(req, res)).rejects.toThrow(ValidationError);
      expect(mockVerifyOtpValidate).toHaveBeenCalledWith(
        { email: 'john@example.com', otp: '000000' },
        { abortEarly: false }
      );
      expect(getOtpForEmail).toHaveBeenCalledWith('john@example.com');
      expect(deleteOtpForEmail).not.toHaveBeenCalled();
    });

    it('should verify OTP successfully when valid', async () => {
      const req = { body: { email: 'john@example.com', otp: '123456' } };
      const res = mockResponse();

      mockVerifyOtpValidate.mockReturnValue({
        error: null,
        value: {
          email: 'john@example.com',
          otp: '123456',
        },
      });
      getOtpForEmail.mockResolvedValue('123456');
      deleteOtpForEmail.mockResolvedValue();

      await authController.verifyOtp(req, res);

      expect(mockVerifyOtpValidate).toHaveBeenCalledWith(
        { email: 'john@example.com', otp: '123456' },
        { abortEarly: false }
      );
      expect(getOtpForEmail).toHaveBeenCalledWith('john@example.com');
      expect(deleteOtpForEmail).toHaveBeenCalledWith('john@example.com');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Verified otp successfully',
      });
    });
  });

  // ---------------- RESET PASSWORD ----------------
  describe('resetPassword', () => {
    it('should return 200 when password is reset successfully', async () => {
      const req = {
        body: {
          email: 'john@example.com',
          new_password: 'newPassword123',
        },
      };
      const res = mockResponse();

      mockResetPasswordValidate.mockReturnValue({
        error: null,
        value: {
          email: 'john@example.com',
          new_password: 'newPassword123',
        },
      });
      mockAuthService.resetPassword.mockResolvedValue(true);

      await authController.resetPassword(req, res);

      expect(mockResetPasswordValidate).toHaveBeenCalledWith(
        {
          email: 'john@example.com',
          new_password: 'newPassword123',
        },
        { abortEarly: false }
      );
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith({
        email: 'john@example.com',
        newPassword: 'newPassword123',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password reset successfully',
      });
    });

    it('should throw ValidationError when validation fails', async () => {
      const req = {
        body: {
          email: 'invalid-email',
          new_password: '',
        },
      };
      const res = mockResponse();

      mockResetPasswordValidate.mockReturnValue({
        error: {
          details: [
            { message: 'Email must be a valid email address' },
            { message: 'New password is required' },
          ],
        },
        value: null,
      });

      await expect(authController.resetPassword(req, res)).rejects.toThrow(ValidationError);
      expect(mockAuthService.resetPassword).not.toHaveBeenCalled();
    });

    it('should propagate service errors', async () => {
      const req = {
        body: {
          email: 'nonexistent@example.com',
          new_password: 'newPassword123',
        },
      };
      const res = mockResponse();

      mockResetPasswordValidate.mockReturnValue({
        error: null,
        value: {
          email: 'nonexistent@example.com',
          new_password: 'newPassword123',
        },
      });

      const error = new Error('User not found');
      error.statusCode = 404;
      mockAuthService.resetPassword.mockRejectedValue(error);

      await expect(authController.resetPassword(req, res)).rejects.toThrow('User not found');
    });
  });

  // ---------------- REFRESH TOKEN ----------------
  describe('refresh', () => {
    const mockUser = {
      id: 'user-uuid-123',
      fullname: 'John Doe',
      email: 'john@example.com',
      role: 'USER',
    };

    const mockTokens = {
      accessToken: 'new-access-jwt',
      refreshToken: 'new-refresh-jwt',
    };

    const mockRefreshResult = {
      success: true,
      message: 'Tokens refreshed',
      tokens: mockTokens,
      user: mockUser,
    };

    it('should refresh tokens successfully when valid refresh token is provided', async () => {
      const req = {
        cookies: {
          refresh_token: 'valid-refresh-token',
        },
      };
      const res = mockResponse();

      authService.refresh.mockResolvedValue(mockRefreshResult);

      await authController.refresh(req, res);

      expect(authService.refresh).toHaveBeenCalledWith('valid-refresh-token');
      expect(mockSetAuthCookies).toHaveBeenCalledWith(res, mockTokens);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Tokens refreshed',
      });
      expect(res.status).not.toHaveBeenCalled(); // 200 by default
    });

    it('should throw UnauthorizedError when refresh token cookie is missing', async () => {
      const req = { cookies: {} };
      const res = mockResponse();

      const { UnauthorizedError } = require('../../utils/customErrors');
      await expect(authController.refresh(req, res)).rejects.toThrow(UnauthorizedError);
      expect(authService.refresh).not.toHaveBeenCalled();
      expect(mockSetAuthCookies).not.toHaveBeenCalled();
    });

    it('should propagate service errors', async () => {
      const req = {
        cookies: { refresh_token: 'invalid-token' },
      };
      const res = mockResponse();

      const error = new Error('Invalid or expired refresh token');
      error.statusCode = 401;
      authService.refresh.mockRejectedValue(error);

      await expect(authController.refresh(req, res)).rejects.toThrow(
        'Invalid or expired refresh token'
      );
      expect(mockSetAuthCookies).not.toHaveBeenCalled();
    });
  });
});
