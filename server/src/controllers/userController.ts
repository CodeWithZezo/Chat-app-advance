import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/api';
import userService from '../services/userService';
import { successResponse } from '../utils/apiResponse';
import { SUCCESS_MESSAGES } from '../utils/constants';
import asyncHandler from '../utils/asyncHandler';
import { Types } from 'mongoose';

class UserController {
  /**
   * @route   GET /api/users/me
   * @desc    Get current user profile
   * @access  Private
   */
  getProfile = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const user = await userService.getUserById(req.userId);
    return successResponse(res, user);
  });

  /**
   * @route   PUT /api/users/me
   * @desc    Update current user profile
   * @access  Private
   */
  updateProfile = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const user = await userService.updateProfile(req.userId, req.body);
    return successResponse(res, user, SUCCESS_MESSAGES.USER_UPDATED);
  });

  /**
   * @route   DELETE /api/users/me
   * @desc    Delete current user account
   * @access  Private
   */
  deleteAccount = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    await userService.deleteAccount(req.userId);
    return successResponse(res, null, SUCCESS_MESSAGES.USER_DELETED);
  });

  /**
   * @route   GET /api/users/:userId
   * @desc    Get user by ID
   * @access  Private
   */
  getUserById = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = new Types.ObjectId(req.params.userId);
    const user = await userService.getUserById(userId);
    return successResponse(res, user);
  });

  /**
   * @route   GET /api/users/username/:username
   * @desc    Get user by username
   * @access  Private
   */
  getUserByUsername = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      const { username } = req.params;
      const user = await userService.getUserByUsername(username);
      return successResponse(res, user);
    }
  );

  /**
   * @route   GET /api/users
   * @desc    Get all users (paginated)
   * @access  Private
   */
  getAllUsers = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await userService.getAllUsers(page, limit);
    return successResponse(res, result);
  });

  /**
   * @route   GET /api/users/search
   * @desc    Search users
   * @access  Private
   */
  searchUsers = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const query = req.query.q as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await userService.searchUsers(query, req.userId, page, limit);
    return successResponse(res, result);
  });

  /**
   * @route   GET /api/users/online
   * @desc    Get online users
   * @access  Private
   */
  getOnlineUsers = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const users = await userService.getOnlineUsers();
    return successResponse(res, users);
  });

  /**
   * @route   PUT /api/users/status
   * @desc    Update user status
   * @access  Private
   */
  updateStatus = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const { status } = req.body;
    const user = await userService.updateStatus(req.userId, status);
    return successResponse(res, user, 'Status updated successfully');
  });

  /**
   * @route   GET /api/users/me/stats
   * @desc    Get user statistics
   * @access  Private
   */
  getUserStats = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const stats = await userService.getUserStats(req.userId);
    return successResponse(res, stats);
  });

  /**
   * @route   GET /api/users/me/contacts
   * @desc    Get user contacts
   * @access  Private
   */
  getUserContacts = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const contacts = await userService.getUserContacts(req.userId);
    return successResponse(res, contacts);
  });

  /**
   * @route   PUT /api/users/me/avatar
   * @desc    Update user avatar
   * @access  Private
   */
  updateAvatar = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const { avatarUrl } = req.body;
    const user = await userService.updateAvatar(req.userId, avatarUrl);
    return successResponse(res, user, 'Avatar updated successfully');
  });
}

export default new UserController();