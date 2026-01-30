import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/api';
import messageService from '../services/messageService';
import { successResponse, createdResponse, noContentResponse } from '../utils/apiResponse';
import { SUCCESS_MESSAGES } from '../utils/constants';
import asyncHandler from '../utils/asyncHandler';
import { Types } from 'mongoose';

class MessageController {
  /**
   * @route   POST /api/messages
   * @desc    Send a message
   * @access  Private
   */
  
  sendMessage = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const message = await messageService.sendMessage(req.userId, req.body);
    return createdResponse(res, message, SUCCESS_MESSAGES.MESSAGE_SENT);
  });

  /**
   * @route   GET /api/messages/room/:roomId
   * @desc    Get room messages
   * @access  Private
   */
  getRoomMessages = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const roomId = new Types.ObjectId(req.params.roomId);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const before = req.query.before as string;
    const after = req.query.after as string;

    const result = await messageService.getRoomMessages(
      roomId,
      req.userId,
      page,
      limit,
      before,
      after
    );
    return successResponse(res, result);
  });

  /**
   * @route   GET /api/messages/:messageId
   * @desc    Get message by ID
   * @access  Private
   */
  getMessageById = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const messageId = new Types.ObjectId(req.params.messageId);
    const message = await messageService.getMessageById(messageId, req.userId);
    return successResponse(res, message);
  });

  /**
   * @route   PUT /api/messages/:messageId
   * @desc    Update message
   * @access  Private
   */
  updateMessage = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const messageId = new Types.ObjectId(req.params.messageId);
    const message = await messageService.updateMessage(messageId, req.userId, req.body);
    return successResponse(res, message, SUCCESS_MESSAGES.MESSAGE_UPDATED);
  });

  /**
   * @route   DELETE /api/messages/:messageId
   * @desc    Delete message
   * @access  Private
   */
  deleteMessage = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const messageId = new Types.ObjectId(req.params.messageId);
    await messageService.deleteMessage(messageId, req.userId);
    return successResponse(res, null, SUCCESS_MESSAGES.MESSAGE_DELETED);
  });

  /**
   * @route   POST /api/messages/:messageId/read
   * @desc    Mark message as read
   * @access  Private
   */
  markMessageAsRead = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const messageId = new Types.ObjectId(req.params.messageId);
    await messageService.markMessageAsRead(messageId, req.userId);
    return successResponse(res, null, 'Message marked as read');
  });

  /**
   * @route   POST /api/messages/room/:roomId/read
   * @desc    Mark all messages in room as read
   * @access  Private
   */
  markRoomAsRead = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const roomId = new Types.ObjectId(req.params.roomId);
    await messageService.markRoomAsRead(roomId, req.userId);
    return successResponse(res, null, 'All messages marked as read');
  });

  /**
   * @route   GET /api/messages/room/:roomId/unread
   * @desc    Get unread messages count for room
   * @access  Private
   */
  getUnreadCount = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const roomId = new Types.ObjectId(req.params.roomId);
    const count = await messageService.getUnreadCount(roomId, req.userId);
    return successResponse(res, { count });
  });

  /**
   * @route   GET /api/messages/unread
   * @desc    Get total unread messages count
   * @access  Private
   */
  getTotalUnreadCount = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      if (!req.userId) {
        return successResponse(res, null);
      }

      const count = await messageService.getTotalUnreadCount(req.userId);
      return successResponse(res, { count });
    }
  );

  /**
   * @route   GET /api/messages/room/:roomId/search
   * @desc    Search messages in room
   * @access  Private
   */
  searchMessages = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const roomId = new Types.ObjectId(req.params.roomId);
    const query = req.query.q as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await messageService.searchMessages(roomId, req.userId, query, page, limit);
    return successResponse(res, result);
  });

  /**
   * @route   GET /api/messages/:messageId/receipts
   * @desc    Get message read receipts
   * @access  Private
   */
  getMessageReadReceipts = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      if (!req.userId) {
        return successResponse(res, null);
      }

      const messageId = new Types.ObjectId(req.params.messageId);
      const receipts = await messageService.getMessageReadReceipts(messageId, req.userId);
      return successResponse(res, receipts);
    }
  );
}

export default new MessageController();