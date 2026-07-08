import mongoose, { Document, Model, Types } from 'mongoose';

export const paymentStatuses = ['Unpaid', 'Pending', 'Paid', 'Cancelled'] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export interface IPayment extends Document {
  paymentRef: string;
  country: Types.ObjectId;
  countryFlag?: string;
  invoice: Types.ObjectId;
  invoiceNumber: string;
  procedure: string;
  amount: number;
  bank: Types.ObjectId;
  user?: Types.ObjectId;
  datePayment: Date;
  status: PaymentStatus;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new mongoose.Schema<IPayment>(
  {
    paymentRef: { type: String, required: true, unique: true, trim: true, index: true },
    country: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: true, index: true },
    countryFlag: { type: String, trim: true },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    invoiceNumber: { type: String, required: true, trim: true, index: true },
    procedure: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    bank: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    datePayment: { type: Date, required: true, default: Date.now, index: true },
    status: { type: String, enum: paymentStatuses, default: 'Pending', index: true },
    cancellationReason: { type: String, trim: true },
  },
  { timestamps: true }
);

paymentSchema.index({ invoice: 1, status: 1 });

const Payment: Model<IPayment> =
  (mongoose.models.Payment as Model<IPayment>) || mongoose.model<IPayment>('Payment', paymentSchema);

export default Payment;
