import { NextFunction, Request, Response } from 'express';
import { expressjwt } from 'express-jwt';
import config from '../config/config';

// JWT authentication middleware
export const authenticate = expressjwt({
  secret: config.jwtSecret,
  algorithms: ['HS256']
});

// Error handler for JWT authentication
export const handleJwtError = (err: unknown, req: Request, res: Response, next: NextFunction): void => {
  const authError = err as { name?: string };
  if (authError.name === 'UnauthorizedError') {
    // insert islogged = false for authError.inner?.name === TokenExpiredError
    res.status(401).json({
      status: 'error',
      message: 'Invalid token. Please log in again.'
    });
  } else {
    next(err);
  }
};