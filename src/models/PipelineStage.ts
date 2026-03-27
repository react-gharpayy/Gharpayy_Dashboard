import mongoose, { Schema, Document } from 'mongoose';

export interface IPipelineStage extends Document {
  key: string;
  label: string;
  color: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const PipelineStageSchema: Schema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    label: { type: String, required: true, trim: true },
    color: { type: String, required: true, trim: true },
    order: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

if (mongoose.models.PipelineStage) {
  delete mongoose.models.PipelineStage;
}

export default mongoose.model<IPipelineStage>('PipelineStage', PipelineStageSchema);
