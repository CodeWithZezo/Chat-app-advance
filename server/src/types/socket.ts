import { Socket } from 'socket.io';
import { Types } from 'mongoose';
import { IUser } from './models';

// Extend Socket to include user information
export interface AuthenticatedSocket extends Socket {
  userId?: Types.ObjectId;
  user?: IUser;
}

// Socket event callback types
export type SocketCallback<T = unknown> = (response: SocketResponse<T>) => void;

export interface SocketResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Typing indicator data
export interface TypingData {
  roomId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}

// Online user data
export interface OnlineUserData {
  userId: string;
  username: string;
  avatar?: string;
  status: string;
  socketId: string;
}

// Room join/leave data
export interface RoomEventData {
  roomId: string;
  userId: string;
  username: string;
}