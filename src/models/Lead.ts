import { number } from 'framer-motion';
import mongoose, { Schema, Document } from 'mongoose';

export interface ILead extends Document {
  name: string;
  phone: string;
  email?: string;
  status: string;
  source: string;
  zone: string;
  firstResponseTimeMin?: number;
  assignedMemberId?: mongoose.Types.ObjectId;
  assignmentStatus?: 'pending' | 'accepted';
  assignmentRequestedById?: mongoose.Types.ObjectId;
  assignmentRequestedAt?: Date;
  assignmentAcceptedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  propertyId?: mongoose.Types.ObjectId;
  preferredLocation?: string;
  budget?: number;
  moveInDate?: string;
  profession?: string;
  roomType?: string;
  needPreference?: string;
  specialRequests?: string;
  notes?: string;
  parsedMetadata?: Record<string, any>;
  leadScore: number;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    status: { type: String, default: 'new' },
    source: { type: String, required: true },
    zone: { type: String, required: true },
    firstResponseTimeMin: { type: Number },
    assignedMemberId: { type: Schema.Types.ObjectId, ref: 'User' },
    assignmentStatus: { type: String, enum: ['pending', 'accepted'], default: 'accepted' },
    assignmentRequestedById: { type: Schema.Types.ObjectId, ref: 'User' },
    assignmentRequestedAt: { type: Date },
    assignmentAcceptedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property' },
    preferredLocation: { type: String },
    budget: { type: Number},
    moveInDate: { type: String },
    profession: { type: String },
    roomType: { type: String },
    needPreference: { type: String },
    specialRequests: { type: String },
    notes: { type: String },
    parsedMetadata: { type: Schema.Types.Mixed },
    leadScore: { type: Number, default: 0 },
  },
  { timestamps: true }
);

if (mongoose.models.Lead) {
  delete mongoose.models.Lead;
}

export default mongoose.model<ILead>('Lead', LeadSchema);
