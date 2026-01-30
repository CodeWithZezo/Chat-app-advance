import { Types } from 'mongoose';
import { User } from '../models';
import { UpdateProfileDTO } from '../types/api';
import { NotFoundError, ConflictError } from '../utils/errors';
import { ERROR_MESSAGES, USER_STATUS, REDIS_KEYS } from '../utils/constants';
import { parsePagination, formatPaginationResponse } from '../utils/helpers';
import redisClient from '../config/redis';
import logger from '../utils/logger';

class UserService {
  /**
   * Get user by ID
   */
  async getUserById(userId: Types.ObjectId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      return user.toJSON();
    } catch (error) {
      logger.error('Get user by ID error:', error);
      throw error;
    }
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string) {
    try {
      const user = await User.findOne({ username: username.toLowerCase() });

      if (!user) {
        throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      return user.toJSON();
    } catch (error) {
      logger.error('Get user by username error:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: Types.ObjectId, data: UpdateProfileDTO) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      // Update fields
      if (data.firstName !== undefined) user.firstName = data.firstName;
      if (data.lastName !== undefined) user.lastName = data.lastName;
      if (data.bio !== undefined) user.bio = data.bio;
      if (data.avatar !== undefined) user.avatar = data.avatar;

      await user.save();

      logger.info(`Profile updated for user: ${user.email}`);

      return user.toJSON();
    } catch (error) {
      logger.error('Update profile error:', error);
      throw error;
    }
  }

  /**
   * Delete user account
   */
  async deleteAccount(userId: Types.ObjectId): Promise<void> {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      // Remove user
      await user.deleteOne();

      // Clean up Redis data
      await redisClient.del(REDIS_KEYS.USER_SESSION(userId.toString()));
      await redisClient.del(REDIS_KEYS.USER_ONLINE(userId.toString()));
      await redisClient.sRem(REDIS_KEYS.ONLINE_USERS, userId.toString());

      logger.info(`Account deleted for user: ${user.email}`);
    } catch (error) {
      logger.error('Delete account error:', error);
      throw error;
    }
  }

  /**
   * Search users
   */
  async searchUsers(query: string, currentUserId: Types.ObjectId, page = 1, limit = 20) {
    try {
      const { skip, limit: parsedLimit } = parsePagination(page, limit);

      const searchRegex = new RegExp(query, 'i');

      const users = await User.find({
        _id: { $ne: currentUserId }, // Exclude current user
        $or: [
          { username: searchRegex },
          { email: searchRegex },
          { firstName: searchRegex },
          { lastName: searchRegex },
        ],
      })
        .select('username email firstName lastName avatar status lastSeen')
        .skip(skip)
        .limit(parsedLimit);

      const total = await User.countDocuments({
        _id: { $ne: currentUserId },
        $or: [
          { username: searchRegex },
          { email: searchRegex },
          { firstName: searchRegex },
          { lastName: searchRegex },
        ],
      });

      return formatPaginationResponse(users, total, page, parsedLimit);
    } catch (error) {
      logger.error('Search users error:', error);
      throw error;
    }
  }

  /**
   * Get all users (with pagination)
   */
  async getAllUsers(page = 1, limit = 20) {
    try {
      const { skip, limit: parsedLimit } = parsePagination(page, limit);

      const users = await User.find()
        .select('username email firstName lastName avatar status lastSeen role createdAt')
        .skip(skip)
        .limit(parsedLimit)
        .sort({ createdAt: -1 });

      const total = await User.countDocuments();

      return formatPaginationResponse(users, total, page, parsedLimit);
    } catch (error) {
      logger.error('Get all users error:', error);
      throw error;
    }
  }

  /**
   * Get online users
   */
  async getOnlineUsers() {
    try {
      // Get online user IDs from Redis
      const onlineUserIds = await redisClient.sMembers(REDIS_KEYS.ONLINE_USERS);

      if (onlineUserIds.length === 0) {
        return [];
      }

      // Fetch user details
      const users = await User.find({
        _id: { $in: onlineUserIds },
      }).select('username email avatar status lastSeen');

      return users;
    } catch (error) {
      logger.error('Get online users error:', error);
      throw error;
    }
  }

  /**
   * Update user status
   */
  async updateStatus(userId: Types.ObjectId, status: string) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      user.status = status as typeof USER_STATUS[keyof typeof USER_STATUS];
      user.lastSeen = new Date();
      await user.save();

      // Update Redis
      if (status === USER_STATUS.OFFLINE) {
        await redisClient.sRem(REDIS_KEYS.ONLINE_USERS, userId.toString());
        await redisClient.del(REDIS_KEYS.USER_ONLINE(userId.toString()));
      } else {
        await redisClient.sAdd(REDIS_KEYS.ONLINE_USERS, userId.toString());
        await redisClient.set(
          REDIS_KEYS.USER_ONLINE(userId.toString()),
          JSON.stringify({ status, lastSeen: new Date() }),
          3600 // 1 hour
        );
      }

      logger.info(`Status updated for user ${user.email}: ${status}`);

      return user.toJSON();
    } catch (error) {
      logger.error('Update status error:', error);
      throw error;
    }
  }

  /**
   * Check if user is online
   */
  async isUserOnline(userId: Types.ObjectId): Promise<boolean> {
    try {
      return await redisClient.sIsMember(REDIS_KEYS.ONLINE_USERS, userId.toString());
    } catch (error) {
      logger.error('Check user online error:', error);
      return false;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: Types.ObjectId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      const Room = (await import('../models')).Room;
      const Message = (await import('../models')).Message;

      const [roomCount, messageCount] = await Promise.all([
        Room.countDocuments({ participants: userId, isActive: true }),
        Message.countDocuments({ sender: userId, isDeleted: false }),
      ]);

      return {
        user: user.toJSON(),
        stats: {
          totalRooms: roomCount,
          totalMessages: messageCount,
          memberSince: user.createdAt,
          lastSeen: user.lastSeen,
        },
      };
    } catch (error) {
      logger.error('Get user stats error:', error);
      throw error;
    }
  }

  /**
   * Get user contacts (users with direct messages)
   */
  async getUserContacts(userId: Types.ObjectId) {
    try {
      const Room = (await import('../models')).Room;

      // Find all direct message rooms for the user
      const rooms = await Room.find({
        type: 'direct',
        participants: userId,
        isActive: true,
      }).populate('participants', 'username email avatar status lastSeen');

      // Extract other participants (contacts)
      const contacts = rooms.map((room) => {
        const otherParticipant = room.participants.find(
          (p: any) => p._id.toString() !== userId.toString()
        );
        return otherParticipant;
      }).filter(Boolean);

      return contacts;
    } catch (error) {
      logger.error('Get user contacts error:', error);
      throw error;
    }
  }

  /**
   * Update user avatar
   */
  async updateAvatar(userId: Types.ObjectId, avatarUrl: string) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      user.avatar = avatarUrl;
      await user.save();

      logger.info(`Avatar updated for user: ${user.email}`);

      return user.toJSON();
    } catch (error) {
      logger.error('Update avatar error:', error);
      throw error;
    }
  }
}

export default new UserService();