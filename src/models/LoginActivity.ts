import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILoginActivity extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  role: string;
  actionType: 'login' | 'logout';
  createdAt: Date;
}

const loginActivitySchema = new Schema<ILoginActivity>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  role: { type: String, required: true },
  actionType: { 
    type: String, 
    enum: ['login', 'logout'], 
    required: true 
  },
  createdAt: { type: Date, default: Date.now, index: true },
});

// Avoid OverwriteModelError in Next.js HMR environment
const LoginActivity: Model<ILoginActivity> = mongoose.models.LoginActivity || mongoose.model<ILoginActivity>('LoginActivity', loginActivitySchema);

export default LoginActivity;
