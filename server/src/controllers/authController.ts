import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/api';
import authService from '../services/authService';
import { successResponse, createdResponse } from '../utils/apiResponse';
import { HTTP_STATUS, SUCCESS_MESSAGES } from '../utils/constants';
import asyncHandler from '../utils/asyncHandler';
import { extractTokenFromHeader } from '../utils/jwt';

class AuthController {
  /**
   * @route   POST /api/auth/register
   * @desc    Register a new user
   * @access  Public
   */
  register = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const result = await authService.register(req.body);

    return createdResponse(res, result, SUCCESS_MESSAGES.USER_REGISTERED);
  });

  /**
   * @route   POST /api/auth/login
   * @desc    Login user
   * @access  Public
   */
  login = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const result = await authService.login(req.body);

    return successResponse(res, result, SUCCESS_MESSAGES.USER_LOGGED_IN);
  });

  /**
   * @route   POST /api/auth/logout
   * @desc    Logout user
   * @access  Private
   */
  logout = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (req.userId && token) {
      await authService.logout(req.userId, token);
    }

    return successResponse(res, null, SUCCESS_MESSAGES.USER_LOGGED_OUT);
  });

  /**
   * @route   POST /api/auth/refresh
   * @desc    Refresh access token
   * @access  Public
   */
  refreshToken = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { refreshToken } = req.body;
    const result = await authService.refreshToken(refreshToken);

    return successResponse(res, result, 'Token refreshed successfully');
  });

  /**
   * @route   GET /api/auth/me
   * @desc    Get current user
   * @access  Private
   */
  getCurrentUser = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const user = await authService.getCurrentUser(req.userId);

    return successResponse(res, user);
  });

  /**
   * @route   POST /api/auth/change-password
   * @desc    Change user password
   * @access  Private
   */
  changePassword = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { currentPassword, newPassword } = req.body;

    if (!req.userId) {
      return successResponse(res, null);
    }

    await authService.changePassword(req.userId, currentPassword, newPassword);

    return successResponse(res, null, 'Password changed successfully');
  });

  /**
   * @route   POST /api/auth/verify-email
   * @desc    Verify user email
   * @access  Private
   */
  verifyEmail = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    await authService.verifyEmail(req.userId);

    return successResponse(res, null, 'Email verified successfully');
  });
}

export default new AuthController();