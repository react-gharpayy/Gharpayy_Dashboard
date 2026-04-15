import mongoose, { Schema, Document } from 'mongoose';

export interface IProperty extends Document {
  pgId?: number;          // ← ADD
  name?: string;
  city?: string;
  area?: string;
  address?: string;
  description?: string;
  photos: string[];
  ownerId?: mongoose.Types.ObjectId;
  isActive: boolean;
  rating?: number;
  genderAllowed: 'any' | 'male' | 'female';
  isVerified: boolean;
  priceRange?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PropertySchema: Schema = new Schema(
  {
    pgId: { type: Number, unique: true, sparse: true },  // ← ADD
    name: { type: String },
    city: { type: String },
    area: { type: String },
    address: { type: String },
    description: { type: String },
    photos: [{ type: String }],
    ownerId: { type: Schema.Types.ObjectId, ref: 'Owner' },
    isActive: { type: Boolean, default: true },
    rating: { type: Number, default: 0 },
    genderAllowed: { type: String, enum: ['any', 'male', 'female'], default: 'any' },
    isVerified: { type: Boolean, default: false },
    priceRange: { type: String },
    singlePrice: { type: Number },
    doublePrice: { type: Number },
    triplePrice: { type: Number },
    food: { type: String, enum: ['veg', 'non-veg', 'both'] },
    propertyType: { type: String, enum: ['pg', 'coliving'], default: 'pg' },
  },
  { timestamps: true }
);

export default mongoose.models.Property || mongoose.model<IProperty>('Property', PropertySchema);