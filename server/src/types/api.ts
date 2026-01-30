import { Request } from 'express';
import { Types } from 'mongoose';
import { IUser } from './models';

// Extend Express Request to include authenticated user
export interface AuthRequest extends Request {
  user?: IUser;
  userId?: Types.ObjectId;
}

// Auth DTOs
export interface RegisterDTO {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginDTO {
  identifier: string; // email or username
  password: string;
}

export interface UpdateProfileDTO {
  firstName?: string;
  lastName?: string;
  bio?: string;
  avatar?: string;
}

export interface ChangePasswordDTO {
  currentPassword: string;
  newPassword: string;
}

// Room DTOs
export interface CreateRoomDTO {
  name?: string;
  type: string;
  description?: string;
  participantIds: string[];
}

export interface UpdateRoomDTO {
  name?: string;
  description?: string;
  avatar?: string;
}

export interface AddParticipantsDTO {
  participantIds: string[];
}

// Message DTOs
export interface SendMessageDTO {
  roomId: string;
  content: string;
  type?: string;
  replyTo?: string;
}

export interface UpdateMessageDTO {
  content: string;
}

// Query Parameters
export interface PaginationQuery {
  page?: string;
  limit?: string;
}

export interface SearchQuery extends PaginationQuery {
  q?: string;
}

export interface MessageQuery extends PaginationQuery {
  before?: string;
  after?: string;
}

// Response Types
export interface AuthResponse {
  user: Partial<IUser>;
  token: string;
  refreshToken: string;
}

export interface MessageResponse {
  _id: string;
  room: string;
  sender: {
    _id: string;
    username: string;
    avatar?: string;
  };
  content: string;
  type: string;
  fileUrl?: string;
  fileName?: string;
  readBy: string[];
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoomResponse {
  _id: string;
  name?: string;
  type: string;
  description?: string;
  avatar?: string;
  participants: Array<{
    _id: string;
    username: string;
    avatar?: string;
    status: string;
  }>;
  lastMessage?: MessageResponse;
  unreadCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Socket Event Payloads
export interface SocketAuthPayload {
  token: string;
}

export interface SocketMessagePayload {
  roomId: string;
  content: string;
  type?: string;
  replyTo?: string;
}

export interface SocketTypingPayload {
  roomId: string;
  isTyping: boolean;
}

export interface SocketReadPayload {
  messageId: string;
  roomId: string;
}

export interface SocketJoinRoomPayload {
  roomId: string;
}