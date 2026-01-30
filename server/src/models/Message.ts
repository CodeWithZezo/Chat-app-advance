import mongoose, { Schema, Types } from 'mongoose';
import { IMessage } from '../types/models';
import { MESSAGE_TYPES } from '../utils/constants';

const messageSchema = new Schema<IMessage>(
  {
    room: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room is required'],
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender is required'],
      index: true,
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
      maxlength: [5000, 'Message cannot exceed 5000 characters'],
    },
    type: {
      type: String,
      enum: Object.values(MESSAGE_TYPES),
      default: MESSAGE_TYPES.TEXT,
    },
    fileUrl: {
      type: String,
      default: null,
    },
    fileName: {
      type: String,
      default: null,
    },
    fileSize: {
      type: Number,
      default: null,
    },
    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isEdited: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
messageSchema.index({ room: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ room: 1, isDeleted: 1, createdAt: -1 });

// Virtual for read count
messageSchema.virtual('readCount').get(function (this: IMessage) {
  return this.readBy.length;
});

// Validation: File messages must have fileUrl
messageSchema.pre('validate', function (next) {
  if (
    (this.type === MESSAGE_TYPES.IMAGE ||
      this.type === MESSAGE_TYPES.FILE ||
      this.type === MESSAGE_TYPES.AUDIO ||
      this.type === MESSAGE_TYPES.VIDEO) &&
    !this.fileUrl
  ) {
    next(new Error('File URL is required for file messages'));
  } else {
    next();
  }
});

// Method to mark message as read by user
messageSchema.methods.markAsRead = async function (
  this: IMessage,
  userId: Types.ObjectId
): Promise<void> {
  if (!this.readBy.includes(userId)) {
    this.readBy.push(userId);
    await this.save();
  }
};

// Method to check if message is read by user
messageSchema.methods.isReadBy = function (
  this: IMessage,
  userId: Types.ObjectId
): boolean {
  return this.readBy.some((id) => id.toString() === userId.toString());
};

// Post-save middleware to update room's lastMessage
messageSchema.post('save', async function (doc) {
  try {
    const Room = mongoose.model('Room');
    await Room.findByIdAndUpdate(doc.room, {
      lastMessage: doc._id,
      updatedAt: new Date(),
    });
  } catch (error) {
    // Log error but don't throw
    console.error('Error updating room lastMessage:', error);
  }
});

// Static method to get room messages with pagination
messageSchema.statics.getRoomMessages = function (
  roomId: Types.ObjectId,
  page: number = 1,
  limit: number = 50
) {
  const skip = (page - 1) * limit;

  return this.find({
    room: roomId,
    isDeleted: false,
  })
    .populate('sender', 'username email avatar')
    .populate('replyTo')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get unread messages count for user in a room
messageSchema.statics.getUnreadCount = async function (
  roomId: Types.ObjectId,
  userId: Types.ObjectId
): Promise<number> {
  return this.countDocuments({
    room: roomId,
    sender: { $ne: userId },
    readBy: { $ne: userId },
    isDeleted: false,
  });
};

// Static method to mark all messages in a room as read by user
messageSchema.statics.markRoomAsRead = async function (
  roomId: Types.ObjectId,
  userId: Types.ObjectId
): Promise<void> {
  await this.updateMany(
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
};

// Static method to search messages
messageSchema.statics.searchMessages = function (
  roomId: Types.ObjectId,
  searchTerm: string,
  page: number = 1,
  limit: number = 20
) {
  const skip = (page - 1) * limit;

  return this.find({
    room: roomId,
    content: { $regex: searchTerm, $options: 'i' },
    isDeleted: false,
  })
    .populate('sender', 'username email avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Override toJSON to handle deleted messages
messageSchema.methods.toJSON = function (this: IMessage) {
  const obj = this.toObject();
  
  if (obj.isDeleted) {
    obj.content = 'This message has been deleted';
    obj.fileUrl = null;
    obj.fileName = null;
    obj.fileSize = null;
  }
  
  delete obj.__v;
  return obj;
};

const Message = mongoose.model<IMessage>('Message', messageSchema);

export default Message;