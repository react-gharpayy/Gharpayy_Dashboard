import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IIntegrationKey extends Document {
  key: string;
  label?: string;
  createdBy?: mongoose.Types.ObjectId;
  rotatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const IntegrationKeySchema = new Schema<IIntegrationKey>(
  {
    key: { type: String, required: true, unique: true, index: true },
    label: { type: String, default: 'Gharpayy CRM Integration' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rotatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const IntegrationKey: Model<IIntegrationKey> =
  mongoose.models.IntegrationKey ||
  mongoose.model<IIntegrationKey>('IntegrationKey', IntegrationKeySchema);

export default IntegrationKey;
