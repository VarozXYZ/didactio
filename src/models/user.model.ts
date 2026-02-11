import mongoose, { Schema, Document } from "mongoose";

export type UserRole = "standard" | "premium" | "admin";

export interface IUser extends Document {
  name?: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ["standard", "premium", "admin"],
      default: "standard",
    },
    tokenVersion: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", userSchema);
