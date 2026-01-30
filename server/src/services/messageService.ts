import { Types } from 'mongoose';
import { Message, Room, User } from '../models';
import { SendMessageDTO, UpdateMessageDTO } from '../types/api';
import { NotFoundError, BadRequestError, AuthorizationError } from '../utils/errors';
import { ERROR_MESSAGES, MESSAGE_TYPES, REDIS_KEYS } from '../utils/constants';
import { parsePagination, formatPaginationResponse } from '../utils/helpers';
import redisClient from '../config/redis';
import logger from '../utils/logger';

class MessageService {
  /**
   * Send a message
   */
  async sendMessage(userId: Types.ObjectId, data: SendMessageDTO) {
    try {
      const roomId = new Types.ObjectId(data.roomId);

      // Check if room exists
      const room = await Room.findById(roomId);
      if (!room) {
        throw new NotFoundError(ERROR_MESSAGES.ROOM_NOT_FOUND);
      }

      // Check if user is participant
      if (!room.isParticipant(userId)) {
        throw new AuthorizationError(ERROR_MESSAGES.NOT_ROOM_MEMBER);
      }

      // Create message
      const message = await Message.create({
        room: roomId,
        sender: userId,
        content: data.content,
        type: data.type || MESSAGE_TYPES.TEXT,
        replyTo: data.replyTo ? new Types.ObjectId(data.replyTo) : undefined,
        readBy: [userId], // Sender has read their own message
      });

      // Populate sender details
      await message.populate('sender', 'username email avatar');
      
      if (message.replyTo) {
        await message.populate('replyTo');
      }

      // Update room's last message
      room.lastMessage = message._id as Types.ObjectId;
      room.updatedAt = new Date();
      await room.save();

      // Clear unread count for sender in Redis
      await redisClient.del(REDIS_KEYS.UNREAD_COUNT(userId.toString(), roomId.toString()));

      logger.info(`Message sent in room ${roomId}: ${message._id}`);
      return message;
    } catch (error) {
      logger.error('Send message error:', error);
      throw error;
    }
  }

  /**
   * Get room messages with pagination
   */
  async getRoomMessages(
    roomId: Types.ObjectId,
    userId: Types.ObjectId,
    page = 1,
    limit = 50,
    before?: string,
    after?: string
  ) {
    try {
      // Check if room exists and user is participant
      const room = await Room.findById(roomId);
      if (!room) {
        throw new NotFoundError(ERROR_MESSAGES.ROOM_NOT_FOUND);
      }

      if (!room.isParticipant(userId)) {
        throw new AuthorizationError(ERROR_MESSAGES.NOT_ROOM_MEMBER);
      }

      const { skip, limit: parsedLimit } = parsePagination(page, limit);

      // Build query
      const query: any = {
        room: roomId,
        isDeleted: false,
      };

      // Handle cursor-based pagination
      if (before) {
        const beforeMessage = await Message.findById(before);
        if (beforeMessage) {
          query.createdAt = { $lt: beforeMessage.createdAt };
        }
      }

      if (after) {
        const afterMessage = await Message.findById(after);
        if (afterMessage) {
          query.createdAt = { $gt: afterMessage.createdAt };
        }
      }

      // Get messages
      const messages = await Message.find(query)
        .populate('sender', 'username email avatar')
        .populate({
          path: 'replyTo',
          populate: { path: 'sender', select: 'username avatar' },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit);

      const total = await Message.countDocuments({
        room: roomId,
        isDeleted: false,
      });

      return formatPaginationResponse(messages, total, page, parsedLimit);
    } catch (error) {
      logger.error('Get room messages error:', error);
      throw error;
    }
  }

  /**
   * Get message by ID
   */
  async getMessageById(messageId: Types.ObjectId, userId: Types.ObjectId) {
    try {
      const message = await Message.findById(messageId)
        .populate('sender', 'username email avatar')
        .populate('replyTo');

      if (!message) {
        throw new NotFoundError(ERROR_MESSAGES.MESSAGE_NOT_FOUND);
      }

      // Check if user is in the room
      const room = await Room.findById(message.room);
      if (!room || !room.isParticipant(userId)) {
        throw new AuthorizationError(ERROR_MESSAGES.NOT_ROOM_MEMBER);
      }

      return message;
    } catch (error) {
      logger.error('Get message by ID error:', error);
      throw error;
    }
  }

  /**
   * Update message
   */
  async updateMessage(messageId: Types.ObjectId, userId: Types.ObjectId, data: UpdateMessageDTO) {
    try {
      const message = await Message.findById(messageId);

      if (!message) {
        throw new NotFoundError(ERROR_MESSAGES.MESSAGE_NOT_FOUND);
      }

      // Only sender can update message
      if (message.sender.toString() !== userId.toString()) {
        throw new AuthorizationError('Only message sender can update the message');
      }

      // Cannot update deleted messages
      if (message.isDeleted) {
        throw new BadRequestError('Cannot update deleted message');
      }

      // Cannot update file messages
      if (message.type !== MESSAGE_TYPES.TEXT) {
        throw new BadRequestError('Only text messages can be edited');
      }

      message.content = data.content;
      message.isEdited = true;
      await message.save();

      await message.populate('sender', 'username email avatar');

      logger.info(`Message updated: ${message._id}`);
      return message;
    } catch (error) {
      logger.error('Update message error:', error);
      throw error;
    }
  }

  /**
   * Delete message (soft delete)
   */
  async deleteMessage(messageId: Types.ObjectId, userId: Types.ObjectId) {
    try {
      const message = await Message.findById(messageId);

      if (!message) {
        throw new NotFoundError(ERROR_MESSAGES.MESSAGE_NOT_FOUND);
      }

      // Check if user is sender or room admin
      const room = await Room.findById(message.room);
      const isSender = message.sender.toString() === userId.toString();
      const isAdmin = room?.isAdmin(userId);

      if (!isSender && !isAdmin) {
        throw new AuthorizationError('Only message sender or room admin can delete messages');
      }

      message.isDeleted = true;
      message.deletedAt = new Date();
      await message.save();

      logger.info(`Message deleted: ${message._id}`);
    } catch (error) {
      logger.error('Delete message error:', error);
      throw error;
    }
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead(messageId: Types.ObjectId, userId: Types.ObjectId) {
    try {
      const message = await Message.findById(messageId);

      if (!message) {
        throw new NotFoundError(ERROR_MESSAGES.MESSAGE_NOT_FOUND);
      }

      // Check if user is in the room
      const room = await Room.findById(message.room);
      if (!room || !room.isParticipant(userId)) {
        throw new AuthorizationError(ERROR_MESSAGES.NOT_ROOM_MEMBER);
      }

      await message.markAsRead(userId);

      logger.info(`Message marked as read: ${message._id} by user ${userId}`);
    } catch (error) {
      logger.error('Mark message as read error:', error);
      throw error;
    }
  }

  /**
   * Mark all messages in room as read
   */
  async markRoomAsRead(roomId: Types.ObjectId, userId: Types.ObjectId) {
    try {
      // Check if room exists and user is participant
      const room = await Room.findById(roomId);
      if (!room) {
        throw new NotFoundError(ERROR_MESSAGES.ROOM_NOT_FOUND);
      }

      if (!room.isParticipant(userId)) {
        throw new AuthorizationError(ERROR_MESSAGES.NOT_ROOM_MEMBER);
      }

      // Mark all unread messages as read
      await Message.updateMany(
        {
          room: roomId,
          sender: { $ne: userId },
          readBy: { $ne: userId },
          isDeleted: false,
        },
        {
          $addToSet: { readBy: userId },
        }
      );

      // Clear unread count in Redis
      await redisClient.del(REDIS_KEYS.UNREAD_COUNT(userId.toString(), roomId.toString()));

      logger.info(`Room marked as read: ${roomId} by user ${userId}`);
    } catch (error) {
      logger.error('Mark room as read error:', error);
      throw error;
    }
  }

  /**
   * Get unread messages count for a room
   */
  async getUnreadCount(roomId: Types.ObjectId, userId: Types.ObjectId): Promise<number> {
    try {
      // Try to get from Redis cache first
      const cachedCount = await redisClient.get(
        REDIS_KEYS.UNREAD_COUNT(userId.toString(), roomId.toString())
      );

      if (cachedCount !== null) {
        return parseInt(cachedCount, 10);
      }

      // Calculate from database
      const count = await Message.countDocuments({
        room: roomId,
        sender: { $ne: userId },
        readBy: { $ne: userId },
        isDeleted: false,
      });

      // Cache for 5 minutes
      await redisClient.set(
        REDIS_KEYS.UNREAD_COUNT(userId.toString(), roomId.toString()),
        count.toString(),
        300
      );

      return count;
    } catch (error) {
      logger.error('Get unread count error:', error);
      return 0;
    }
  }

  /**
   * Get total unread messages count for user
   */
  async getTotalUnreadCount(userId: Types.ObjectId): Promise<number> {
    try {
      // Get all user's rooms
      const rooms = await Room.find({
        participants: userId,
        isActive: true,
      }).select('_id');

      const roomIds = rooms.map((room) => room._id);

      // Count unread messages across all rooms
      const count = await Message.countDocuments({
        room: { $in: roomIds },
        sender: { $ne: userId },
        readBy: { $ne: userId },
        isDeleted: false,
      });

      return count;
    } catch (error) {
      logger.error('Get total unread count error:', error);
      return 0;
    }
  }

  /**
   * Search messages in a room
   */
  async searchMessages(
    roomId: Types.ObjectId,
    userId: Types.ObjectId,
    query: string,
    page = 1,
    limit = 20
  ) {
    try {
      // Check if room exists and user is participant
      const room = await Room.findById(roomId);
      if (!room) {
        throw new NotFoundError(ERROR_MESSAGES.ROOM_NOT_FOUND);
      }

      if (!room.isParticipant(userId)) {
        throw new AuthorizationError(ERROR_MESSAGES.NOT_ROOM_MEMBER);
      }

      const { skip, limit: parsedLimit } = parsePagination(page, limit);

      const searchRegex = new RegExp(query, 'i');

      const messages = await Message.find({
        room: roomId,
        content: searchRegex,
        isDeleted: false,
      })
        .populate('sender', 'username email avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit);

      const total = await Message.countDocuments({
        room: roomId,
        content: searchRegex,
        isDeleted: false,
      });

      return formatPaginationResponse(messages, total, page, parsedLimit);
    } catch (error) {
      logger.error('Search messages error:', error);
      throw error;
    }
  }

  /**
   * Send file message
   */
  async sendFileMessage(
    userId: Types.ObjectId,
    roomId: Types.ObjectId,
    fileUrl: string,
    fileName: string,
    fileSize: number,
    messageType: string
  ) {
    try {
      // Check if room exists
      const room = await Room.findById(roomId);
      if (!room) {
        throw new NotFoundError(ERROR_MESSAGES.ROOM_NOT_FOUND);
      }

      // Check if user is participant
      if (!room.isParticipant(userId)) {
        throw new AuthorizationError(ERROR_MESSAGES.NOT_ROOM_MEMBER);
      }

      // Create message
      const message = await Message.create({
        room: roomId,
        sender: userId,
        content: fileName, // Store filename as content
        type: messageType,
        fileUrl,
        fileName,
        fileSize,
        readBy: [userId],
      });

      await message.populate('sender', 'username email avatar');

      // Update room's last message
      room.lastMessage = message._id as Types.ObjectId;
      room.updatedAt = new Date();
      await room.save();

      logger.info(`File message sent in room ${roomId}: ${message._id}`);
      return message;
    } catch (error) {
      logger.error('Send file message error:', error);
      throw error;
    }
  }

  /**
   * Get message read receipts
   */
  async getMessageReadReceipts(messageId: Types.ObjectId, userId: Types.ObjectId) {
    try {
      const message = await Message.findById(messageId).populate('readBy', 'username email avatar');

      if (!message) {
        throw new NotFoundError(ERROR_MESSAGES.MESSAGE_NOT_FOUND);
      }

      // Check if user is in the room
      const room = await Room.findById(message.room);
      if (!room || !room.isParticipant(userId)) {
        throw new AuthorizationError(ERROR_MESSAGES.NOT_ROOM_MEMBER);
      }

      return {
        messageId: message._id,
        readBy: message.readBy,
        readCount: message.readBy.length,
      };
    } catch (error) {
      logger.error('Get message read receipts error:', error);
      throw error;
    }
  }
}

export default new MessageService();