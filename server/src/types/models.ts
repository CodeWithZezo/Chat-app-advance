import { Document, Types } from 'mongoose';
import { UserRole, UserStatus, MessageType, RoomType } from '../utils/constants';

// User Interface
export interface IUser extends Document {
  _id: Types.ObjectId;
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  bio?: string;
  role: UserRole;
  status: UserStatus;
  isEmailVerified: boolean;
  lastSeen: Date;
  createdAt: Date;
  updatedAt: Date;

  // Virtual fields
  fullName: string;

  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  toJSON(): Partial<IUser>;
}

// Message Interface
export interface IMessage extends Document {
  _id: Types.ObjectId;
  room: Types.ObjectId;
  sender: Types.ObjectId;
  content: string;
  type: MessageType;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  readBy: Types.ObjectId[];
  isEdited: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  replyTo?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  markAsRead(userId: Types.ObjectId): Promise<void>;
  isReadBy(userId: Types.ObjectId): boolean;
}

// Room Interface
export interface IRoom extends Document {
  _id: Types.ObjectId;
  name?: string;
  type: RoomType;
  description?: string;
  avatar?: string;
  participants: Types.ObjectId[];
  admins: Types.ObjectId[];
  createdBy: Types.ObjectId;
  lastMessage?: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  addParticipant(userId: Types.ObjectId): Promise<void>;
  removeParticipant(userId: Types.ObjectId): Promise<void>;
  isParticipant(userId: Types.ObjectId): boolean;
  isAdmin(userId: Types.ObjectId): boolean;
  makeAdmin(userId: Types.ObjectId): Promise<void>;
  removeAdmin(userId: Types.ObjectId): Promise<void>;
}

// Typing Status Interface
export interface ITypingStatus {
  userId: Types.ObjectId;
  roomId: Types.ObjectId;
  username: string;
  timestamp: Date;
}

// Online Status Interface
export interface IOnlineStatus {
  userId: Types.ObjectId;
  socketId: string;
  status: UserStatus;
  lastSeen: Date;
}