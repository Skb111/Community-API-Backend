// src/utils/index.js
const customErrors = require('./customErrors');

class Validator {
  /**
   * Validate request body against a Joi schema
   * @param {Object} schema - Joi schema
   * @param {Object} data - req.body
   * @returns {Object} { value?, errorResponse? }
   */
  static validate(schema, data) {
    const { error, value } = schema.validate(data, { abortEarly: false });

    if (error) {
      const errorMessages = error.details.map((err) => err.message);
      throw new customErrors.ValidationError('Validation failed', errorMessages);
    }

    return { _value: value };
  }
}

const toList = (v, d = []) =>
  (v || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .concat(d);

module.exports = Validator;
module.exports.customErrors = customErrors;
module.exports.toList = toList;
