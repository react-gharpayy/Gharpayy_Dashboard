import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILeadPasteCapture extends Document {
  rawText: string;
  source?: string;
  page?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdByName?: string;
  createdByRole?: string;
  createdAt: Date;
}

const leadPasteCaptureSchema = new Schema<ILeadPasteCapture>({
  rawText: { type: String, required: true },
  source: { type: String },
  page: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdByName: { type: String },
  createdByRole: { type: String },
  createdAt: { type: Date, default: Date.now, index: true },
});

if (mongoose.models.LeadPasteCapture) {
  delete mongoose.models.LeadPasteCapture;
}

const LeadPasteCapture: Model<ILeadPasteCapture> = mongoose.model<ILeadPasteCapture>(
  'LeadPasteCapture',
  leadPasteCaptureSchema
);

export default LeadPasteCapture;
