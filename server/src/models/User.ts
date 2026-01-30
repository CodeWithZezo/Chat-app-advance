import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser } from '../types/models';
import { USER_ROLES, USER_STATUS } from '../utils/constants';

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [20, 'Username cannot exceed 20 characters'],
      match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'],
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Don't include password in queries by default
    },
    firstName: {
      type: String,
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    avatar: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
      default: '',
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.USER,
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.OFFLINE,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
userSchema.index({ email: 1, username: 1 });
userSchema.index({ status: 1, lastSeen: -1 });

// Virtual for full name
userSchema.virtual('fullName').get(function (this: IUser) {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.firstName || this.lastName || this.username;
});

// Pre-save middleware to hash password
userSchema.pre('save', async function (next) {
  // Only hash password if it's modified
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (
  this: IUser,
  candidatePassword: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

// Override toJSON to exclude sensitive data
userSchema.methods.toJSON = function (this: IUser) {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

// Static method to find by email or username
userSchema.statics.findByEmailOrUsername = function (identifier: string) {
  return this.findOne({
    $or: [{ email: identifier.toLowerCase() }, { username: identifier.toLowerCase() }],
  }).select('+password');
};

// Static method to get online users
userSchema.statics.getOnlineUsers = function () {
  return this.find({ status: { $ne: USER_STATUS.OFFLINE } }).select(
    'username email avatar status lastSeen'
  );
};

// Pre-remove middleware to cleanup related data
userSchema.pre('remove', async function (next) {
  try {
    // Remove user from all rooms
    const Room = mongoose.model('Room');
    await Room.updateMany(
      { participants: this._id },
      { $pull: { participants: this._id, admins: this._id } }
    );

    // Mark user's messages as deleted
    const Message = mongoose.model('Message');
    await Message.updateMany({ sender: this._id }, { isDeleted: true, deletedAt: new Date() });

    next();
  } catch (error) {
    next(error as Error);
  }
});

const User = mongoose.model<IUser>('User', userSchema);

export default User;