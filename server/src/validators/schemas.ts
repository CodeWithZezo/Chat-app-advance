import { z } from 'zod';
import { ROOM_TYPES, MESSAGE_TYPES } from '../utils/constants';

// Auth Validators
export const registerSchema = z.object({
  body: z.object({
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(20, 'Username cannot exceed 20 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    email: z.string().email('Invalid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      ),
    firstName: z.string().max(50).optional(),
    lastName: z.string().max(50).optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    identifier: z.string().min(1, 'Email or username is required'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().max(50).optional(),
    lastName: z.string().max(50).optional(),
    bio: z.string().max(500).optional(),
    avatar: z.string().url().optional(),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      ),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

// Room Validators
export const createRoomSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    type: z.enum([ROOM_TYPES.DIRECT, ROOM_TYPES.GROUP, ROOM_TYPES.CHANNEL]),
    description: z.string().max(500).optional(),
    participantIds: z.array(z.string()).min(1, 'At least one participant is required'),
  }),
});

export const updateRoomSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    avatar: z.string().url().optional(),
  }),
});

export const addParticipantsSchema = z.object({
  body: z.object({
    participantIds: z.array(z.string()).min(1, 'At least one participant is required'),
  }),
});

export const roomIdSchema = z.object({
  params: z.object({
    roomId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid room ID'),
  }),
});

// Message Validators
export const sendMessageSchema = z.object({
  body: z.object({
    roomId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid room ID'),
    content: z.string().min(1).max(5000, 'Message cannot exceed 5000 characters'),
    type: z
      .enum([
        MESSAGE_TYPES.TEXT,
        MESSAGE_TYPES.IMAGE,
        MESSAGE_TYPES.FILE,
        MESSAGE_TYPES.AUDIO,
        MESSAGE_TYPES.VIDEO,
      ])
      .optional(),
    replyTo: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid message ID').optional(),
  }),
});

export const updateMessageSchema = z.object({
  body: z.object({
    content: z.string().min(1).max(5000, 'Message cannot exceed 5000 characters'),
  }),
});

export const messageIdSchema = z.object({
  params: z.object({
    messageId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid message ID'),
  }),
});

// Query Validators
export const paginationSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
  }),
});

export const searchSchema = z.object({
  query: z.object({
    q: z.string().min(1, 'Search query is required'),
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
  }),
});

export const messageQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    before: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    after: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  }),
});

// File Upload Validator
export const fileUploadSchema = z.object({
  body: z.object({
    type: z.enum(['avatar', 'message', 'room']).optional(),
  }),
});

// User ID Validator
export const userIdSchema = z.object({
  params: z.object({
    userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
  }),
});