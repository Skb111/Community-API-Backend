// src/utils/validator.js
const Joi = require('joi');
const momentTz = require('moment-timezone');

const allowedLanguages = ['en', 'fr', 'es', 'de', 'it', 'pt', 'nl']; // extend as needed
const allowedAppearances = ['light', 'dark', 'system'];

// Here i define validation schemas for user input on Signup
const signupSchema = Joi.object({
  fullname: Joi.string().min(2).required().messages({
    'string.empty': 'FullName is required',
    'string.min': 'FullName must be at least 2 characters long',
  }),
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Email must be a valid email address',
  }),
  password: Joi.string().min(8).required().messages({
    'string.empty': 'Password is required',
    'string.min': 'Password must be at least 8 characters long',
  }),
});

// Here i define validation schemas for user input on Signin
const signinSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Email must be a valid email address',
  }),
  password: Joi.string().min(8).required().messages({
    'string.empty': 'Password is required',
    'string.min': 'Password must be at least 8 characters long',
  }),
});

//Here i define validation schemas for user input on Forgot Password
const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Email must be a valid email address',
  }),
});

//Here i define validation schemas for user input on Verify OTP & Reset Password
const verifyOtpSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Email must be a valid email address',
  }),
  otp: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.empty': 'OTP is required',
      'string.pattern.base': 'OTP must be a 6-digit number',
    }),
});

//Here i define validation schemas for user input on Reset Password (authenticated)
const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Email must be a valid email address',
  }),
  new_password: Joi.string().min(8).required().messages({
    'string.empty': 'New password is required',
    'string.min': 'New password must be at least 8 characters long',
  }),
});

// Here i define validate schemas for updating user profile
const updateProfileSchema = Joi.object({
  fullname: Joi.string().min(3).optional().messages({
    'string.empty': 'Fullname cannot be empty',
    'string.min': 'Fullname must be at least 3 characters long',
  }),
  email: Joi.string().email().optional().messages({
    'string.email': 'Email must be a valid email address',
  }),
})
  .min(1)
  .messages({
    'object.min': 'At least one field must be provided',
  });

const assignRoleSchema = Joi.object({
  userId: Joi.string().required().messages({
    'string.empty': 'User ID is required',
    'any.required': 'User ID is required',
  }),
  role: Joi.string().valid('USER', 'ADMIN').required().messages({
    'string.empty': 'Role is required',
    'any.required': 'Role is required',
    'any.only': 'Role must be one of: USER, ADMIN',
  }),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(8).max(72).required().messages({
    'string.empty': 'Current password is required',
    'string.max': 'Current password must not exceed 72 characters',
  }),
  newPassword: Joi.string().min(8).max(72).required().messages({
    'string.empty': 'New password is required',
    'string.min': 'New password must be at least 8 characters long',
    'string.max': 'New password must not exceed 72 characters',
  }),
});

const preferencesUpdateSchema = Joi.object({
  visibility: Joi.boolean(),
  notification: Joi.boolean(),
  newsletter: Joi.boolean(),
  appearance: Joi.string()
    .valid(...allowedAppearances)
    .messages({
      'any.only': `appearance must be one of: ${allowedAppearances.join(', ')}`,
    }),
  language: Joi.string()
    .length(2)
    .lowercase()
    .valid(...allowedLanguages)
    .messages({
      'any.only': `language must be a valid ISO 639-1 code (${allowedLanguages.join(', ')})`,
    }),
  timezone: Joi.string()
    .custom((value, helpers) => {
      if (!momentTz.tz.zone(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.invalid': 'timezone must be a valid IANA timezone (e.g., UTC, Africa/Douala)',
    }),
})
  .min(1)
  .messages({
    'object.min': 'At least one preference field must be provided',
  });

// Pagination query parameters schema
const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    'number.base': 'Page must be a number',
    'number.integer': 'Page must be an integer',
    'number.min': 'Page must be at least 1',
  }),
  pageSize: Joi.number().integer().min(1).max(100).default(10).messages({
    'number.base': 'pageSize must be a number',
    'number.integer': 'pageSize must be an integer',
    'number.min': 'pageSize must be at least 1',
    'number.max': 'pageSize must not exceed 100',
  }),
});

// Skill validation schemas
const createSkillSchema = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.empty': 'Skill name is required',
    'string.min': 'Skill name must be at least 2 characters long',
    'string.max': 'Skill name must not exceed 100 characters',
    'any.required': 'Skill name is required',
  }),
  description: Joi.string().max(500).allow('', null).optional().messages({
    'string.max': 'Description must not exceed 500 characters',
  }),
});

const updateSkillSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional().messages({
    'string.min': 'Skill name must be at least 2 characters long',
    'string.max': 'Skill name must not exceed 100 characters',
  }),
  description: Joi.string().max(500).allow('', null).optional().messages({
    'string.max': 'Description must not exceed 500 characters',
  }),
})
  .min(1)
  .messages({
    'object.min': 'At least one field must be provided',
  });

// Add skill to user schema
const addSkillToUserSchema = Joi.object({
  skillId: Joi.string().uuid().required().messages({
    'string.empty': 'Skill ID is required',
    'string.guid': 'Skill ID must be a valid UUID',
    'any.required': 'Skill ID is required',
  }),
});

// Batch create skills schema
const batchCreateSkillsSchema = Joi.object({
  skills: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().min(2).max(100).required().messages({
          'string.empty': 'Skill name is required',
          'string.min': 'Skill name must be at least 2 characters long',
          'string.max': 'Skill name must not exceed 100 characters',
          'any.required': 'Skill name is required',
        }),
        description: Joi.string().max(500).allow('', null).optional().messages({
          'string.max': 'Description must not exceed 500 characters',
        }),
      })
    )
    .min(1)
    .max(50)
    .required()
    .messages({
      'array.min': 'At least one skill must be provided',
      'array.max': 'Maximum 50 skills can be created at once',
      'any.required': 'Skills array is required',
    }),
});

// Blog validation schemas
const createBlogSchema = Joi.object({
  title: Joi.string().min(1).max(255).trim().required().messages({
    'string.empty': 'Title is required',
    'string.min': 'Title cannot be empty',
    'string.max': 'Title must not exceed 255 characters',
    'any.required': 'Title is required',
  }),
  description: Joi.string().min(1).max(1000).trim().required().messages({
    'string.empty': 'Description is required',
    'string.min': 'Description cannot be empty',
    'string.max': 'Description must not exceed 1000 characters',
    'any.required': 'Description is required',
  }),
  coverImage: Joi.string().trim().allow('', null).optional().messages({
    'string.base': 'Cover image must be a string',
  }),
  topic: Joi.string().max(100).trim().allow('', null).optional().messages({
    'string.max': 'Topic must not exceed 100 characters',
  }),
  featured: Joi.boolean().default(false).optional().messages({
    'boolean.base': 'Featured must be a boolean',
  }),
});

const updateBlogSchema = Joi.object({
  title: Joi.string().min(1).max(255).trim().optional().messages({
    'string.empty': 'Title cannot be empty',
    'string.min': 'Title cannot be empty',
    'string.max': 'Title must not exceed 255 characters',
  }),
  description: Joi.string().min(1).max(1000).trim().optional().messages({
    'string.empty': 'Description cannot be empty',
    'string.min': 'Description cannot be empty',
    'string.max': 'Description must not exceed 1000 characters',
  }),
  coverImage: Joi.string().trim().allow('', null).optional().messages({
    'string.base': 'Cover image must be a string',
  }),
  topic: Joi.string().max(100).trim().allow('', null).optional().messages({
    'string.max': 'Topic must not exceed 100 characters',
  }),
  featured: Joi.boolean().optional().messages({
    'boolean.base': 'Featured must be a boolean',
  }),
})
  .min(1)
  .messages({
    'object.min': 'At least one field must be provided',
  });

const blogQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    'number.base': 'Page must be a number',
    'number.integer': 'Page must be an integer',
    'number.min': 'Page must be at least 1',
  }),
  pageSize: Joi.number().integer().min(1).max(100).default(10).messages({
    'number.base': 'pageSize must be a number',
    'number.integer': 'pageSize must be an integer',
    'number.min': 'pageSize must be at least 1',
    'number.max': 'pageSize must not exceed 100',
  }),
  featured: Joi.boolean().optional().messages({
    'boolean.base': 'Featured must be a boolean',
  }),
  topic: Joi.string().trim().optional().messages({
    'string.base': 'Topic must be a string',
  }),
  createdBy: Joi.string().uuid().optional().messages({
    'string.guid': 'createdBy must be a valid UUID',
  }),
});

const blogIdParamSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    'string.empty': 'Blog ID is required',
    'string.guid': 'Blog ID must be a valid UUID',
    'any.required': 'Blog ID is required',
  }),
});

const techSchema = Joi.object({
  name: Joi.string().min(1).max(255).required().messages({
    'string.base': 'Tech name must be a string',
    'string.empty': 'Tech name cannot be empty',
    'string.min': 'Tech name must be at least 1 character',
    'string.max': 'Tech name cannot exceed 255 characters',
    'any.required': 'Tech name is required',
  }),
  icon: Joi.string().uri().allow('', null).max(500).optional().messages({
    'string.max': 'Icon path cannot exceed 500 characters',
  }),
  description: Joi.string().max(2000).allow('', null).optional().messages({
    'string.max': 'Description cannot exceed 2000 characters',
  }),
});

const createTechSchema = techSchema;
const updateTechSchema = techSchema;

// Add search query schema
const techSearchQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().allow('').optional(),
});

module.exports = {
  signupSchema,
  signinSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema,
  updateProfileSchema,
  assignRoleSchema,
  changePasswordSchema,
  preferencesUpdateSchema,
  paginationQuerySchema,
  createSkillSchema,
  updateSkillSchema,
  addSkillToUserSchema,
  batchCreateSkillsSchema,
  createBlogSchema,
  updateBlogSchema,
  blogQuerySchema,
  blogIdParamSchema,
  createTechSchema,
  updateTechSchema,
  techSearchQuerySchema,
};
