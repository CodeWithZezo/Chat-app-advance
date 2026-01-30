import { Types } from 'mongoose';
import { Room, User, Message } from '../models';
import { CreateRoomDTO, UpdateRoomDTO, AddParticipantsDTO } from '../types/api';
import { NotFoundError, BadRequestError, AuthorizationError } from '../utils/errors';
import { ERROR_MESSAGES, ROOM_TYPES, REDIS_KEYS } from '../utils/constants';
import { parsePagination, formatPaginationResponse, generateDirectRoomId } from '../utils/helpers';
import redisClient from '../config/redis';
import logger from '../utils/logger';

class RoomService {
  /**
   * Create a new room (direct, group, or channel)
   */
  async createRoom(userId: Types.ObjectId, data: CreateRoomDTO) {
    try {
      // Validate participant IDs
      const participantIds = data.participantIds.map((id) => new Types.ObjectId(id));
      
      // Check if all participants exist
      const users = await User.find({ _id: { $in: participantIds } });
      if (users.length !== participantIds.length) {
        throw new BadRequestError('One or more participants not found');
      }

      // Handle direct message rooms
      if (data.type === ROOM_TYPES.DIRECT) {
        if (participantIds.length !== 1) {
          throw new BadRequestError('Direct rooms must have exactly one other participant');
        }

        // Check if direct room already exists
        const existingRoom = await Room.findOne({
          type: ROOM_TYPES.DIRECT,
          participants: { $all: [userId, participantIds[0]] },
        }).populate('participants', 'username email avatar status');

        if (existingRoom) {
          return existingRoom;
        }

        // Create direct room
        const room = await Room.create({
          type: ROOM_TYPES.DIRECT,
          participants: [userId, participantIds[0]],
          createdBy: userId,
        });

        await room.populate('participants', 'username email avatar status');
        
        // Add room to Redis for both users
        await redisClient.sAdd(REDIS_KEYS.USER_ROOMS(userId.toString()), room._id.toString());
        await redisClient.sAdd(REDIS_KEYS.USER_ROOMS(participantIds[0].toString()), room._id.toString());

        logger.info(`Direct room created: ${room._id}`);
        return room;
      }

      // Handle group/channel rooms
      if (!data.name || data.name.trim().length === 0) {
        throw new BadRequestError('Group and channel rooms must have a name');
      }

      const room = await Room.create({
        name: data.name,
        type: data.type,
        description: data.description || '',
        participants: [...participantIds, userId],
        admins: [userId],
        createdBy: userId,
      });

      await room.populate('participants', 'username email avatar status');

      // Add room to Redis for all participants
      const allParticipants = [...participantIds, userId];
      for (const participantId of allParticipants) {
        await redisClient.sAdd(REDIS_KEYS.USER_ROOMS(participantId.toString()), room._id.toString());
      }

      logger.info(`${data.type} room created: ${room._id}`);
      return room;
    } catch (error) {
      logger.error('Create room error:', error);
      throw error;
    }
  }

  /**
   * Get room by ID
   */
  async getRoomById(roomId: Types.ObjectId, userId: Types.ObjectId) {
    try {
      const room = await Room.findById(roomId)
        .populate('participants', 'username email avatar status lastSeen')
        .populate('lastMessage')
        .populate({
          path: 'lastMessage',
          populate: { path: 'sender', select: 'username avatar' },
        });

      if (!room) {
        throw new NotFoundError(ERROR_MESSAGES.ROOM_NOT_FOUND);
      }

      // Check if user is participant
      if (!room.isParticipant(userId)) {
        throw new AuthorizationError(ERROR_MESSAGES.NOT_ROOM_MEMBER);
      }

      // Get unread count
      const unreadCount = await Message.countDocuments({
        room: roomId,
        sender: { $ne: userId },
        readBy: { $ne: userId },
        isDeleted: false,
      });

      return {
        ...room.toJSON(),
        unreadCount,
      };
    } catch (error) {
      logger.error('Get room by ID error:', error);
      throw error;
    }
  }

  /**
   * Get user's rooms
   */
  async getUserRooms(userId: Types.ObjectId, page = 1, limit = 20) {
    try {
      const { skip, limit: parsedLimit } = parsePagination(page, limit);

      const rooms = await Room.find({
        participants: userId,
        isActive: true,
      })
        .populate('participants', 'username email avatar status lastSeen')
        .populate({
          path: 'lastMessage',
          populate: { path: 'sender', select: 'username avatar' },
        })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parsedLimit);

      const total = await Room.countDocuments({
        participants: userId,
        isActive: true,
      });

      // Add unread count for each room
      const roomsWithUnread = await Promise.all(
        rooms.map(async (room) => {
          const unreadCount = await Message.countDocuments({
            room: room._id,
            sender: { $ne: userId },
            readBy: { $ne: userId },
            isDeleted: false,
          });

          return {
            ...room.toJSON(),
            unreadCount,
          };
        })
      );

      return formatPaginationResponse(roomsWithUnread, total, page, parsedLimit);
    } catch (error) {
      logger.error('Get user rooms error:', error);
      throw error;
    }
  }

  /**
   * Get or create direct message room
   */
  async getOrCreateDirectRoom(userId: Types.ObjectId, otherUserId: Types.ObjectId) {
    try {
      // Check if other user exists
      const otherUser = await User.findById(otherUserId);
      if (!otherUser) {
        throw new NotFoundError('User not found');
      }

      // Find existing direct room
      const existingRoom = await Room.findOne({
        type: ROOM_TYPES.DIRECT,
        participants: { $all: [userId, otherUserId] },
      }).populate('participants', 'username email avatar status');

      if (existingRoom) {
        return existingRoom;
      }

      // Create new direct room
      return await this.createRoom(userId, {
        type: ROOM_TYPES.DIRECT,
        participantIds: [otherUserId.toString()],
      });
    } catch (error) {
      logger.error('Get or create direct room error:', error);
      throw error;
    }
  }

  /**
   * Update room details
   */
  async updateRoom(roomId: Types.ObjectId, userId: Types.ObjectId, data: UpdateRoomDTO) {
    try {
      const room = await Room.findById(roomId);

      if (!room) {
        throw new NotFoundError(ERROR_MESSAGES.ROOM_NOT_FOUND);
      }

      // Check if user is admin
      if (!room.isAdmin(userId)) {
        throw new AuthorizationError('Only room admins can update room details');
      }

      // Cannot update direct rooms
      if (room.type === ROOM_TYPES.DIRECT) {
        throw new BadRequestError('Cannot update direct message rooms');
      }

      // Update fields
      if (data.name !== undefined) room.name = data.name;
      if (data.description !== undefined) room.description = data.description;
      if (data.avatar !== undefined) room.avatar = data.avatar;

      await room.save();
      await room.populate('participants', 'username email avatar status');

      logger.info(`Room updated: ${room._id}`);
      return room;
    } catch (error) {
      logger.error('Update room error:', error);
      throw error;
    }
  }

  /**
   * Delete/deactivate room
   */
  async deleteRoom(roomId: Types.ObjectId, userId: Types.ObjectId) {
    try {
      const room = await Room.findById(roomId);

      if (!room) {
        throw new NotFoundError(ERROR_MESSAGES.ROOM_NOT_FOUND);
      }

      // Check if user is creator or admin
      if (room.createdBy.toString() !== userId.toString() && !room.isAdmin(userId)) {
        throw new AuthorizationError('Only room creator or admins can delete the room');
      }

      // Mark as inactive instead of deleting
      room.isActive = false;
      await room.save();

      // Remove from Redis
      for (const participantId of room.participants) {
        await redisClient.sRem(REDIS_KEYS.USER_ROOMS(participantId.toString()), roomId.toString());
      }

      logger.info(`Room deleted: ${room._id}`);
    } catch (error) {
      logger.error('Delete room error:', error);
      throw error;
    }
  }

  /**
   * Add participants to room
   */
  async addParticipants(roomId: Types.ObjectId, userId: Types.ObjectId, data: AddParticipantsDTO) {
    try {
      const room = await Room.findById(roomId);

      if (!room) {
        throw new NotFoundError(ERROR_MESSAGES.ROOM_NOT_FOUND);
      }

      // Check if user is admin
      if (!room.isAdmin(userId)) {
        throw new AuthorizationError('Only room admins can add participants');
      }

      // Cannot add to direct rooms
      if (room.type === ROOM_TYPES.DIRECT) {
        throw new BadRequestError('Cannot add participants to direct message rooms');
      }

      // Validate participant IDs
      const participantIds = data.participantIds.map((id) => new Types.ObjectId(id));

      // Check if all participants exist
      const users = await User.find({ _id: { $in: participantIds } });
      if (users.length !== participantIds.length) {
        throw new BadRequestError('One or more participants not found');
      }

      // Add participants
      for (const participantId of participantIds) {
        await room.addParticipant(participantId);
        await redisClient.sAdd(REDIS_KEYS.USER_ROOMS(participantId.toString()), roomId.toString());
      }

      await room.populate('participants', 'username email avatar status');

      logger.info(`Participants added to room: ${room._id}`);
      return room;
    } catch (error) {
      logger.error('Add participants error:', error);
      throw error;
    }
  }

  /**
   * Remove participant from room
   */
  async removeParticipant(roomId: Types.ObjectId, userId: Types.ObjectId, participantId: Types.ObjectId) {
    try {
      const room = await Room.findById(roomId);

      if (!room) {
        throw new NotFoundError(ERROR_MESSAGES.ROOM_NOT_FOUND);
      }

      // Check if user is admin or removing themselves
      const isSelfRemoval = userId.toString() === participantId.toString();
      if (!isSelfRemoval && !room.isAdmin(userId)) {
        throw new AuthorizationError('Only room admins can remove participants');
      }

      // Cannot remove from direct rooms
      if (room.type === ROOM_TYPES.DIRECT) {
        throw new BadRequestError('Cannot remove participants from direct message rooms');
      }

      // Cannot remove creator
      if (room.createdBy.toString() === participantId.toString()) {
        throw new BadRequestError('Cannot remove room creator');
      }

      await room.removeParticipant(participantId);
      await redisClient.sRem(REDIS_KEYS.USER_ROOMS(participantId.toString()), roomId.toString());

      await room.populate('participants', 'username email avatar status');

      logger.info(`Participant removed from room: ${room._id}`);
      return room;
    } catch (error) {
      logger.error('Remove participant error:', error);
      throw error;
    }
  }

  /**
   * Leave room
   */
  async leaveRoom(roomId: Types.ObjectId, userId: Types.ObjectId) {
    try {
      return await this.removeParticipant(roomId, userId, userId);
    } catch (error) {
      logger.error('Leave room error:', error);
      throw error;
    }
  }

  /**
   * Make user admin
   */
  async makeAdmin(roomId: Types.ObjectId, userId: Types.ObjectId, targetUserId: Types.ObjectId) {
    try {
      const room = await Room.findById(roomId);

      if (!room) {
        throw new NotFoundError(ERROR_MESSAGES.ROOM_NOT_FOUND);
      }

      // Check if user is admin
      if (!room.isAdmin(userId)) {
        throw new AuthorizationError('Only room admins can promote users');
      }

      // Cannot promote in direct rooms
      if (room.type === ROOM_TYPES.DIRECT) {
        throw new BadRequestError('Direct message rooms do not have admins');
      }

      await room.makeAdmin(targetUserId);
      await room.populate('participants', 'username email avatar status');

      logger.info(`User made admin in room: ${room._id}`);
      return room;
    } catch (error) {
      logger.error('Make admin error:', error);
      throw error;
    }
  }

  /**
   * Remove admin privileges
   */
  async removeAdmin(roomId: Types.ObjectId, userId: Types.ObjectId, targetUserId: Types.ObjectId) {
    try {
      const room = await Room.findById(roomId);

      if (!room) {
        throw new NotFoundError(ERROR_MESSAGES.ROOM_NOT_FOUND);
      }

      // Check if user is admin
      if (!room.isAdmin(userId)) {
        throw new AuthorizationError('Only room admins can demote users');
      }

      await room.removeAdmin(targetUserId);
      await room.populate('participants', 'username email avatar status');

      logger.info(`Admin removed from room: ${room._id}`);
      return room;
    } catch (error) {
      logger.error('Remove admin error:', error);
      throw error;
    }
  }

  /**
   * Get room participants
   */
  async getRoomParticipants(roomId: Types.ObjectId, userId: Types.ObjectId) {
    try {
      const room = await Room.findById(roomId).populate('participants', 'username email avatar status lastSeen');

      if (!room) {
        throw new NotFoundError(ERROR_MESSAGES.ROOM_NOT_FOUND);
      }

      // Check if user is participant
      if (!room.isParticipant(userId)) {
        throw new AuthorizationError(ERROR_MESSAGES.NOT_ROOM_MEMBER);
      }

      return {
        participants: room.participants,
        admins: room.admins,
      };
    } catch (error) {
      logger.error('Get room participants error:', error);
      throw error;
    }
  }

  /**
   * Search rooms
   */
  async searchRooms(userId: Types.ObjectId, query: string, page = 1, limit = 20) {
    try {
      const { skip, limit: parsedLimit } = parsePagination(page, limit);

      const searchRegex = new RegExp(query, 'i');

      const rooms = await Room.find({
        participants: userId,
        isActive: true,
        name: searchRegex,
      })
        .populate('participants', 'username email avatar status')
        .populate('lastMessage')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parsedLimit);

      const total = await Room.countDocuments({
        participants: userId,
        isActive: true,
        name: searchRegex,
      });

      return formatPaginationResponse(rooms, total, page, parsedLimit);
    } catch (error) {
      logger.error('Search rooms error:', error);
      throw error;
    }
  }
}

export default new RoomService();