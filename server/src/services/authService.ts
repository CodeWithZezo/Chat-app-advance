import { Types } from 'mongoose';
import { User } from '../models';
import { RegisterDTO, LoginDTO, AuthResponse } from '../types/api';
import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../utils/errors';
import { ERROR_MESSAGES, SUCCESS_MESSAGES, REDIS_KEYS } from '../utils/constants';
import { generateTokens, verifyRefreshToken, TokenPayload } from '../utils/jwt';
import redisClient from '../config/redis';
import logger from '../utils/logger';

class AuthService {
  /**
   * Register a new user
   */
  async register(data: RegisterDTO): Promise<AuthResponse> {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email: data.email.toLowerCase() }, { username: data.username.toLowerCase() }],
      });

      if (existingUser) {
        if (existingUser.email === data.email.toLowerCase()) {
          throw new ConflictError('Email already exists');
        }
        throw new ConflictError('Username already exists');
      }

      // Create new user
      const user = await User.create({
        username: data.username.toLowerCase(),
        email: data.email.toLowerCase(),
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
      });

      // Generate tokens
      const tokenPayload: TokenPayload = {
        userId: user._id as Types.ObjectId,
        email: user.email,
        role: user.role,
      };

      const { accessToken, refreshToken } = generateTokens(tokenPayload);

      // Store refresh token in Redis
      await redisClient.set(
        REDIS_KEYS.USER_SESSION(user._id.toString()),
        refreshToken,
        7 * 24 * 60 * 60 // 7 days
      );

      logger.info(`User registered: ${user.email}`);

      return {
        user: user.toJSON(),
        token: accessToken,
        refreshToken,
      };
    } catch (error) {
      logger.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Login user
   */
  async login(data: LoginDTO): Promise<AuthResponse> {
    try {
      // Find user by email or username
      const user = await User.findOne({
        $or: [
          { email: data.identifier.toLowerCase() },
          { username: data.identifier.toLowerCase() },
        ],
      }).select('+password');

      if (!user) {
        throw new AuthenticationError(ERROR_MESSAGES.INVALID_CREDENTIALS);
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(data.password);

      if (!isPasswordValid) {
        throw new AuthenticationError(ERROR_MESSAGES.INVALID_CREDENTIALS);
      }

      // Generate tokens
      const tokenPayload: TokenPayload = {
        userId: user._id as Types.ObjectId,
        email: user.email,
        role: user.role,
      };

      const { accessToken, refreshToken } = generateTokens(tokenPayload);

      // Store refresh token in Redis
      await redisClient.set(
        REDIS_KEYS.USER_SESSION(user._id.toString()),
        refreshToken,
        7 * 24 * 60 * 60 // 7 days
      );

      // Update last seen
      user.lastSeen = new Date();
      await user.save();

      logger.info(`User logged in: ${user.email}`);

      return {
        user: user.toJSON(),
        token: accessToken,
        refreshToken,
      };
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(userId: Types.ObjectId, token: string): Promise<void> {
    try {
      // Remove refresh token from Redis
      await redisClient.del(REDIS_KEYS.USER_SESSION(userId.toString()));

      // Blacklist the current access token
      await redisClient.set(`blacklist:${token}`, '1', 60 * 60 * 24); // 24 hours

      logger.info(`User logged out: ${userId}`);
    } catch (error) {
      logger.error('Logout error:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      // Verify refresh token
      const decoded = verifyRefreshToken(refreshToken);

      // Check if refresh token exists in Redis
      const storedToken = await redisClient.get(
        REDIS_KEYS.USER_SESSION(decoded.userId.toString())
      );

      if (!storedToken || storedToken !== refreshToken) {
        throw new AuthenticationError('Invalid refresh token');
      }

      // Get user
      const user = await User.findById(decoded.userId);

      if (!user) {
        throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      // Generate new access token
      const tokenPayload: TokenPayload = {
        userId: user._id as Types.ObjectId,
        email: user.email,
        role: user.role,
      };

      const { accessToken } = generateTokens(tokenPayload);

      logger.info(`Token refreshed for user: ${user.email}`);

      return { accessToken };
    } catch (error) {
      logger.error('Refresh token error:', error);
      throw error;
    }
  }

  /**
   * Verify user email
   */
  async verifyEmail(userId: Types.ObjectId): Promise<void> {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      user.isEmailVerified = true;
      await user.save();

      logger.info(`Email verified for user: ${user.email}`);
    } catch (error) {
      logger.error('Email verification error:', error);
      throw error;
    }
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: Types.ObjectId,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      const user = await User.findById(userId).select('+password');

      if (!user) {
        throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      // Verify current password
      const isPasswordValid = await user.comparePassword(currentPassword);

      if (!isPasswordValid) {
        throw new AuthenticationError('Current password is incorrect');
      }

      // Check if new password is same as current
      if (currentPassword === newPassword) {
        throw new ValidationError('New password must be different from current password');
      }

      // Update password
      user.password = newPassword;
      await user.save();

      // Invalidate all sessions
      await redisClient.del(REDIS_KEYS.USER_SESSION(userId.toString()));

      logger.info(`Password changed for user: ${user.email}`);
    } catch (error) {
      logger.error('Change password error:', error);
      throw error;
    }
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(userId: Types.ObjectId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      return user.toJSON();
    } catch (error) {
      logger.error('Get current user error:', error);
      throw error;
    }
  }
}

export default new AuthService();