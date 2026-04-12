import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILeadActivity extends Document {
  leadId: string; // The ID of the lead this activity is associated with
  leadName?: string; // Preserved name for deleted cases
  userId: mongoose.Types.ObjectId; // User who performed the action
  userName: string;
  userRole: string;
  actionType:
    | 'added'
    | 'assigned'
    | 'assignment_offered'
    | 'assignment_accepted'
    | 'assignment_passed_on'
    | 'status_changed'
    | 'deleted';
  details?: Record<string, any>; // Flexible payload for "from X to Y", etc.
  createdAt: Date;
}

const leadActivitySchema = new Schema<ILeadActivity>({
  leadId: { type: String, required: true, index: true },
  leadName: { type: String },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  userRole: { type: String, required: true },
  actionType: { 
    type: String, 
    enum: ['added', 'assigned', 'assignment_offered', 'assignment_accepted', 'assignment_passed_on', 'status_changed', 'deleted'], 
    required: true 
  },
  details: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, index: true },
});

// Force Mongoose to re-compile the Schema on every HMR reload to capture new fields
if (mongoose.models.LeadActivity) {
  delete mongoose.models.LeadActivity;
}
const LeadActivity: Model<ILeadActivity> = mongoose.model<ILeadActivity>('LeadActivity', leadActivitySchema);

export default LeadActivity;
