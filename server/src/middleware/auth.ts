import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../types/api';
import { User } from '../models';
import { verifyAccessToken, extractTokenFromHeader } from '../utils/jwt';
import { AuthenticationError, AuthorizationError } from '../utils/errors';
import { ERROR_MESSAGES, USER_ROLES } from '../utils/constants';
import redisClient from '../config/redis';
import { REDIS_KEYS } from '../utils/constants';

/**
 * Authentication middleware - verifies JWT token
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from header
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      throw new AuthenticationError(ERROR_MESSAGES.TOKEN_REQUIRED);
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    // Check if token is blacklisted (user logged out)
    const isBlacklisted = await redisClient.exists(`blacklist:${token}`);
    if (isBlacklisted) {
      throw new AuthenticationError(ERROR_MESSAGES.TOKEN_INVALID);
    }

    // Get user from database
    const user = await User.findById(decoded.userId);

    if (!user) {
      throw new AuthenticationError(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id as Types.ObjectId;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token
 */
export const optionalAuthenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (token) {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.userId);

      if (user) {
        req.user = user;
        req.userId = user._id as Types.ObjectId;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

/**
 * Authorization middleware - checks user role
 */
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AuthenticationError(ERROR_MESSAGES.UNAUTHORIZED);
      }

      if (!roles.includes(req.user.role)) {
        throw new AuthorizationError(ERROR_MESSAGES.PERMISSION_DENIED);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Admin only middleware
 */
export const adminOnly = authorize(USER_ROLES.ADMIN);

/**
 * Moderator and admin middleware
 */
export const moderatorOrAdmin = authorize(USER_ROLES.MODERATOR, USER_ROLES.ADMIN);

/**
 * Check if user is room participant
 */
export const checkRoomParticipant = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AuthenticationError(ERROR_MESSAGES.UNAUTHORIZED);
    }

    const { roomId } = req.params;
    const Room = (await import('../models')).Room;

    const room = await Room.findById(roomId);

    if (!room) {
      throw new AuthorizationError(ERROR_MESSAGES.ROOM_NOT_FOUND);
    }

    if (!room.isParticipant(req.user._id as Types.ObjectId)) {
      throw new AuthorizationError(ERROR_MESSAGES.NOT_ROOM_MEMBER);
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user is room admin
 */
export const checkRoomAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AuthenticationError(ERROR_MESSAGES.UNAUTHORIZED);
    }

    const { roomId } = req.params;
    const Room = (await import('../models')).Room;

    const room = await Room.findById(roomId);

    if (!room) {
      throw new AuthorizationError(ERROR_MESSAGES.ROOM_NOT_FOUND);
    }

    if (!room.isAdmin(req.user._id as Types.ObjectId)) {
      throw new AuthorizationError(ERROR_MESSAGES.PERMISSION_DENIED);
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Rate limiting check using Redis
 */
export const rateLimitCheck = (identifier: string, maxRequests: number, windowMs: number) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = REDIS_KEYS.RATE_LIMIT(`${identifier}:${req.ip}`);
      const current = await redisClient.get(key);

      if (current && parseInt(current) >= maxRequests) {
        throw new AuthorizationError('Too many requests, please try again later');
      }

      if (!current) {
        await redisClient.set(key, '1', Math.floor(windowMs / 1000));
      } else {
        await redisClient.set(key, (parseInt(current) + 1).toString(), Math.floor(windowMs / 1000));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};