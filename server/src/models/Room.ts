import mongoose, { Schema, Types } from 'mongoose';
import { IRoom } from '../types/models';
import { ROOM_TYPES } from '../utils/constants';

const roomSchema = new Schema<IRoom>(
  {
    name: {
      type: String,
      trim: true,
      maxlength: [100, 'Room name cannot exceed 100 characters'],
    },
    type: {
      type: String,
      enum: Object.values(ROOM_TYPES),
      required: [true, 'Room type is required'],
      default: ROOM_TYPES.GROUP,
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    avatar: {
      type: String,
      default: null,
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    admins: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required'],
    },
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
roomSchema.index({ participants: 1 });
roomSchema.index({ type: 1, isActive: 1 });
roomSchema.index({ createdBy: 1 });
roomSchema.index({ updatedAt: -1 });

// Compound index for direct message rooms (ensure uniqueness)
roomSchema.index(
  { type: 1, participants: 1 },
  {
    unique: true,
    partialFilterExpression: { type: ROOM_TYPES.DIRECT },
  }
);

// Virtual for participant count
roomSchema.virtual('participantCount').get(function (this: IRoom) {
  return this.participants.length;
});

// Validation: Direct rooms must have exactly 2 participants
roomSchema.pre('validate', function (next) {
  if (this.type === ROOM_TYPES.DIRECT && this.participants.length !== 2) {
    next(new Error('Direct message rooms must have exactly 2 participants'));
  } else {
    next();
  }
});

// Validation: Group/Channel rooms must have a name
roomSchema.pre('validate', function (next) {
  if (
    (this.type === ROOM_TYPES.GROUP || this.type === ROOM_TYPES.CHANNEL) &&
    !this.name
  ) {
    next(new Error('Group and channel rooms must have a name'));
  } else {
    next();
  }
});

// Ensure creator is in participants and admins
roomSchema.pre('save', function (next) {
  if (this.isNew) {
    // Add creator to participants if not already there
    if (!this.participants.includes(this.createdBy)) {
      this.participants.push(this.createdBy);
    }

    // Add creator to admins
    if (!this.admins.includes(this.createdBy)) {
      this.admins.push(this.createdBy);
    }
  }
  next();
});

// Method to add participant
roomSchema.methods.addParticipant = async function (
  this: IRoom,
  userId: Types.ObjectId
): Promise<void> {
  if (!this.participants.includes(userId)) {
    this.participants.push(userId);
    await this.save();
  }
};

// Method to remove participant
roomSchema.methods.removeParticipant = async function (
  this: IRoom,
  userId: Types.ObjectId
): Promise<void> {
  this.participants = this.participants.filter(
    (id) => id.toString() !== userId.toString()
  );
  
  // Also remove from admins if present
  this.admins = this.admins.filter((id) => id.toString() !== userId.toString());
  
  await this.save();
};

// Method to check if user is participant
roomSchema.methods.isParticipant = function (
  this: IRoom,
  userId: Types.ObjectId
): boolean {
  return this.participants.some((id) => id.toString() === userId.toString());
};

// Method to check if user is admin
roomSchema.methods.isAdmin = function (this: IRoom, userId: Types.ObjectId): boolean {
  return this.admins.some((id) => id.toString() === userId.toString());
};

// Method to make user admin
roomSchema.methods.makeAdmin = async function (
  this: IRoom,
  userId: Types.ObjectId
): Promise<void> {
  if (this.isParticipant(userId) && !this.isAdmin(userId)) {
    this.admins.push(userId);
    await this.save();
  }
};

// Method to remove admin privileges
roomSchema.methods.removeAdmin = async function (
  this: IRoom,
  userId: Types.ObjectId
): Promise<void> {
  // Cannot remove creator as admin
  if (userId.toString() === this.createdBy.toString()) {
    throw new Error('Cannot remove creator as admin');
  }

  this.admins = this.admins.filter((id) => id.toString() !== userId.toString());
  await this.save();
};

// Static method to find direct room between two users
roomSchema.statics.findDirectRoom = function (
  userId1: Types.ObjectId,
  userId2: Types.ObjectId
) {
  return this.findOne({
    type: ROOM_TYPES.DIRECT,
    participants: { $all: [userId1, userId2] },
  });
};

// Static method to find user's rooms
roomSchema.statics.findUserRooms = function (userId: Types.ObjectId) {
  return this.find({
    participants: userId,
    isActive: true,
  })
    .populate('participants', 'username email avatar status')
    .populate('lastMessage')
    .sort({ updatedAt: -1 });
};

// Pre-remove middleware to cleanup messages
roomSchema.pre('remove', async function (next) {
  try {
    const Message = mongoose.model('Message');
    await Message.deleteMany({ room: this._id });
    next();
  } catch (error) {
    next(error as Error);
  }
});

const Room = mongoose.model<IRoom>('Room', roomSchema);

export default Room;