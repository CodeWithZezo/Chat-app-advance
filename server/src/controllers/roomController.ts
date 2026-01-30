import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/api';
import roomService from '../services/roomService';
import { successResponse, createdResponse } from '../utils/apiResponse';
import { SUCCESS_MESSAGES } from '../utils/constants';
import asyncHandler from '../utils/asyncHandler';
import { Types } from 'mongoose';

class RoomController {
  /**
   * @route   POST /api/rooms
   * @desc    Create a new room
   * @access  Private
   */
  createRoom = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const room = await roomService.createRoom(req.userId, req.body);
    return createdResponse(res, room, SUCCESS_MESSAGES.ROOM_CREATED);
  });

  /**
   * @route   GET /api/rooms
   * @desc    Get user's rooms
   * @access  Private
   */
  getUserRooms = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await roomService.getUserRooms(req.userId, page, limit);
    return successResponse(res, result);
  });

  /**
   * @route   GET /api/rooms/:roomId
   * @desc    Get room by ID
   * @access  Private
   */
  getRoomById = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const roomId = new Types.ObjectId(req.params.roomId);
    const room = await roomService.getRoomById(roomId, req.userId);
    return successResponse(res, room);
  });

  /**
   * @route   POST /api/rooms/direct/:userId
   * @desc    Get or create direct message room
   * @access  Private
   */
  getOrCreateDirectRoom = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      if (!req.userId) {
        return successResponse(res, null);
      }

      const otherUserId = new Types.ObjectId(req.params.userId);
      const room = await roomService.getOrCreateDirectRoom(req.userId, otherUserId);
      return successResponse(res, room);
    }
  );

  /**
   * @route   PUT /api/rooms/:roomId
   * @desc    Update room details
   * @access  Private
   */
  updateRoom = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const roomId = new Types.ObjectId(req.params.roomId);
    const room = await roomService.updateRoom(roomId, req.userId, req.body);
    return successResponse(res, room, SUCCESS_MESSAGES.ROOM_UPDATED);
  });

  /**
   * @route   DELETE /api/rooms/:roomId
   * @desc    Delete/deactivate room
   * @access  Private
   */
  deleteRoom = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const roomId = new Types.ObjectId(req.params.roomId);
    await roomService.deleteRoom(roomId, req.userId);
    return successResponse(res, null, SUCCESS_MESSAGES.ROOM_DELETED);
  });

  /**
   * @route   POST /api/rooms/:roomId/participants
   * @desc    Add participants to room
   * @access  Private
   */
  addParticipants = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const roomId = new Types.ObjectId(req.params.roomId);
    const room = await roomService.addParticipants(roomId, req.userId, req.body);
    return successResponse(res, room, 'Participants added successfully');
  });

  /**
   * @route   DELETE /api/rooms/:roomId/participants/:participantId
   * @desc    Remove participant from room
   * @access  Private
   */
  removeParticipant = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      if (!req.userId) {
        return successResponse(res, null);
      }

      const roomId = new Types.ObjectId(req.params.roomId);
      const participantId = new Types.ObjectId(req.params.participantId);
      const room = await roomService.removeParticipant(roomId, req.userId, participantId);
      return successResponse(res, room, 'Participant removed successfully');
    }
  );

  /**
   * @route   POST /api/rooms/:roomId/leave
   * @desc    Leave room
   * @access  Private
   */
  leaveRoom = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const roomId = new Types.ObjectId(req.params.roomId);
    await roomService.leaveRoom(roomId, req.userId);
    return successResponse(res, null, SUCCESS_MESSAGES.ROOM_LEFT);
  });

  /**
   * @route   POST /api/rooms/:roomId/admins/:userId
   * @desc    Make user admin
   * @access  Private
   */
  makeAdmin = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const roomId = new Types.ObjectId(req.params.roomId);
    const targetUserId = new Types.ObjectId(req.params.userId);
    const room = await roomService.makeAdmin(roomId, req.userId, targetUserId);
    return successResponse(res, room, 'User promoted to admin');
  });

  /**
   * @route   DELETE /api/rooms/:roomId/admins/:userId
   * @desc    Remove admin privileges
   * @access  Private
   */
  removeAdmin = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const roomId = new Types.ObjectId(req.params.roomId);
    const targetUserId = new Types.ObjectId(req.params.userId);
    const room = await roomService.removeAdmin(roomId, req.userId, targetUserId);
    return successResponse(res, room, 'Admin privileges removed');
  });

  /**
   * @route   GET /api/rooms/:roomId/participants
   * @desc    Get room participants
   * @access  Private
   */
  getRoomParticipants = asyncHandler(
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      if (!req.userId) {
        return successResponse(res, null);
      }

      const roomId = new Types.ObjectId(req.params.roomId);
      const result = await roomService.getRoomParticipants(roomId, req.userId);
      return successResponse(res, result);
    }
  );

  /**
   * @route   GET /api/rooms/search
   * @desc    Search rooms
   * @access  Private
   */
  searchRooms = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return successResponse(res, null);
    }

    const query = req.query.q as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await roomService.searchRooms(req.userId, query, page, limit);
    return successResponse(res, result);
  });
}

export default new RoomController();