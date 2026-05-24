import mongoose, { Document, Model } from 'mongoose';

export interface IQuotationFees {
  governmentFee: number;
  serviceFee: number;
  classFee: number;
  procedureFee: number;
}

export interface IQuotation extends Document {
  quotationNo: string;
  clientId?: mongoose.Types.ObjectId;
  clientName: string;
  clientEmail?: string;
  clientType?: string;
  service: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
  procedure: string;
  country: string;
  numberOfClasses: number;
  requirementIds: mongoose.Types.ObjectId[];
  fees: IQuotationFees;
  multiplier: number;
  subtotal: number;
  total: number;
  currency: string;
  status: 'Draft' | 'Pending' | 'Approved' | 'Rejected';
  validDays: number;
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  approvedBy?: mongoose.Types.ObjectId;
  approvalDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const quotationSchema = new mongoose.Schema<IQuotation>(
  {
    quotationNo: { type: String, unique: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    clientName: { type: String, required: true, trim: true },
    clientEmail: { type: String, trim: true },
    clientType: { type: String },
    service: {
      type: String,
      enum: ['Trademark', 'Patent', 'Copyright', 'Design', 'Litigation'],
      required: true,
    },
    procedure: { type: String, required: true },
    country: { type: String, required: true },
    numberOfClasses: { type: Number, default: 1 },
    requirementIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Requirement' }],
    fees: {
      governmentFee: { type: Number, default: 0 },
      serviceFee: { type: Number, default: 0 },
      classFee: { type: Number, default: 0 },
      procedureFee: { type: Number, default: 0 },
    },
    multiplier: { type: Number, default: 1 },
    subtotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    currency: { type: String, default: 'SAR' },
    status: { type: String, enum: ['Draft', 'Pending', 'Approved', 'Rejected'], default: 'Draft' },
    validDays: { type: Number, default: 30 },
    notes: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvalDate: { type: Date },
  },
  { timestamps: true }
);

quotationSchema.pre('save', async function (next) {
  if (!this.quotationNo) {
    const year = new Date().getFullYear();
    // Use a retry loop to handle the unique constraint race condition
    let attempts = 0;
    while (attempts < 5) {
      const count = await mongoose.model('Quotation').countDocuments();
      const candidate = `QT-${year}-${String(count + 1).padStart(4, '0')}`;
      const exists = await mongoose.model('Quotation').exists({ quotationNo: candidate });
      if (!exists) {
        this.quotationNo = candidate;
        break;
      }
      attempts++;
    }
    if (!this.quotationNo) {
      // Fallback: append timestamp millis to guarantee uniqueness
      const count = await mongoose.model('Quotation').countDocuments();
      this.quotationNo = `QT-${year}-${String(count + 1).padStart(4, '0')}-${Date.now() % 10000}`;
    }
  }
  next();
});

quotationSchema.index({ clientId: 1 });
quotationSchema.index({ status: 1 });
quotationSchema.index({ createdAt: -1 });

const Quotation: Model<IQuotation> =
  (mongoose.models.Quotation as Model<IQuotation>) ||
  mongoose.model<IQuotation>('Quotation', quotationSchema);

export default Quotation;
