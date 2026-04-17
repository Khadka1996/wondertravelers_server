// src/middleware/validate.middleware.js
import { z } from 'zod';
import { logger } from '../utils/logger.util.js';

/**
 * Validation middleware for Zod schemas
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {string} target - What to validate: 'body', 'query', 'params', or 'headers'
 * @returns {Function} Express middleware function
 */
export const validate = (schema, target = 'body') => (req, res, next) => {
  try {
    // Get data based on target
    let data;
    switch (target) {
      case 'body':
        data = req.body;
        break;
      case 'query':
        data = req.query;
        break;
      case 'params':
        data = req.params;
        break;
      case 'headers':
        // Convert headers to lowercase keys for case-insensitive matching
        data = Object.keys(req.headers).reduce((acc, key) => {
          acc[key.toLowerCase()] = req.headers[key];
          return acc;
        }, {});
        break;
      default:
        data = {};
    }

    // Validate the data
    const result = schema.safeParse(data);

    if (!result.success) {
      const issues = result.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }));

      logger.warn('Validation failed', {
        issues,
        target,
        path: req.path,
        method: req.method,
        requestId: req.id || req.requestId,
      });

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: issues,
        target,
        requestId: req.id || req.requestId,
      });
    }

    // Attach validated data to request object for easy access
    req.validated = result.data;
    
    // For headers validation, we might want to attach to specific property
    if (target === 'headers') {
      req.validatedHeaders = result.data;
    }

    logger.debug('Validation passed', {
      target,
      path: req.path,
      requestId: req.id || req.requestId,
    });

    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }));

      logger.error('Zod validation error', {
        issues,
        target,
        path: req.path,
        error: error.message,
        requestId: req.id || req.requestId,
      });

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: issues,
        target,
        requestId: req.id || req.requestId,
      });
    }

    // Handle other unexpected errors
    logger.error('Validation middleware unexpected error', {
      error: error.message,
      stack: error.stack,
      target,
      path: req.path,
      requestId: req.id || req.requestId,
    });

    next(error);
  }
};

/**
 * Combined validation for multiple targets
 * @param {Object} schemas - Object with schema for each target
 * @param {z.ZodSchema} schemas.body - Body schema
 * @param {z.ZodSchema} schemas.query - Query schema
 * @param {z.ZodSchema} schemas.params - Params schema
 * @param {z.ZodSchema} schemas.headers - Headers schema
 * @returns {Function} Express middleware function
 */
export const validateMultiple = (schemas = {}) => {
  return (req, res, next) => {
    try {
      const errors = [];
      const validatedData = {};

      // Validate body if schema provided
      if (schemas.body) {
        const result = schemas.body.safeParse(req.body);
        if (result.success) {
          validatedData.body = result.data;
        } else {
          errors.push(...result.error.issues.map(issue => ({
            target: 'body',
            path: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })));
        }
      }

      // Validate query if schema provided
      if (schemas.query) {
        const result = schemas.query.safeParse(req.query);
        if (result.success) {
          validatedData.query = result.data;
        } else {
          errors.push(...result.error.issues.map(issue => ({
            target: 'query',
            path: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })));
        }
      }

      // Validate params if schema provided
      if (schemas.params) {
        const result = schemas.params.safeParse(req.params);
        if (result.success) {
          validatedData.params = result.data;
        } else {
          errors.push(...result.error.issues.map(issue => ({
            target: 'params',
            path: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })));
        }
      }

      // Validate headers if schema provided
      if (schemas.headers) {
        const headers = Object.keys(req.headers).reduce((acc, key) => {
          acc[key.toLowerCase()] = req.headers[key];
          return acc;
        }, {});
        
        const result = schemas.headers.safeParse(headers);
        if (result.success) {
          validatedData.headers = result.data;
        } else {
          errors.push(...result.error.issues.map(issue => ({
            target: 'headers',
            path: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })));
        }
      }

      // If there are validation errors, return them
      if (errors.length > 0) {
        logger.warn('Multiple validations failed', {
          errors,
          path: req.path,
          method: req.method,
          requestId: req.id || req.requestId,
        });

        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors,
          requestId: req.id || req.requestId,
        });
      }

      // Attach all validated data to request object
      req.validated = validatedData;

      logger.debug('Multiple validations passed', {
        path: req.path,
        validatedTargets: Object.keys(validatedData),
        requestId: req.id || req.requestId,
      });

      next();
    } catch (error) {
      logger.error('validateMultiple unexpected error', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        requestId: req.id || req.requestId,
      });
      next(error);
    }
  };
};

/**
 * Simple validation wrapper for quick validations
 * Useful for inline validations in controllers
 */
export const validateInline = (schema, data) => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));
    throw new Error(JSON.stringify({ validationErrors: errors }));
  }
  return result.data;
};