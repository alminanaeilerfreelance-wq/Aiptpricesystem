import mongoose, { Document, Model } from 'mongoose';

export interface IClientQuotationServiceItem {
  procedureId?: mongoose.Types.ObjectId;
  procedureName: string;
  classType: 'single' | 'multi';
  numberOfClasses: number;
  additionalFeePerClass: number;
  officialFee: number;
  additionalClassFees: number;
  totalOfficialFees: number;
  attorneyFee: number;
  officeFee: number;
  otherFees: number;
  discount: number;
  totalAmount: number;
  grandTotal: number;
}

export interface IClientQuotation extends Document {
  quotationNo: string;
  associateId?: mongoose.Types.ObjectId;
  associateSnapshot?: {
    associteName?: string;
    email?: string;
    associteType?: string;
    contact?: string;
    address?: string;
    notes?: string;
  };
  inquiryProjects: string[];
  services: IClientQuotationServiceItem[];
  totalOfficialFees: number;
  totalAttorneyFees: number;
  totalOfficeFees: number;
  totalOtherFees: number;
  totalDiscount: number;
  grandTotal: number;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const serviceItemSchema = new mongoose.Schema<IClientQuotationServiceItem>(
  {
    procedureId: { type: mongoose.Schema.Types.ObjectId, ref: 'Procedure' },
    procedureName: { type: String, required: true, trim: true },
    classType: { type: String, enum: ['single', 'multi'], default: 'single' },
    numberOfClasses: { type: Number, default: 1 },
    additionalFeePerClass: { type: Number, default: 0 },
    officialFee: { type: Number, default: 0 },
    additionalClassFees: { type: Number, default: 0 },
    totalOfficialFees: { type: Number, default: 0 },
    attorneyFee: { type: Number, default: 0 },
    officeFee: { type: Number, default: 0 },
    otherFees: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
  },
  { _id: false }
);

const clientQuotationSchema = new mongoose.Schema<IClientQuotation>(
  {
    quotationNo: { type: String, unique: true },
    associateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Associte' },
    associateSnapshot: {
      associteName: { type: String, trim: true },
      email: { type: String, trim: true },
      associteType: { type: String, trim: true },
      contact: { type: String, trim: true },
      address: { type: String, trim: true },
      notes: { type: String, trim: true },
    },
    inquiryProjects: [{ type: String, required: true, trim: true }],
    services: [serviceItemSchema],
    totalOfficialFees: { type: Number, default: 0 },
    totalAttorneyFees: { type: Number, default: 0 },
    totalOfficeFees: { type: Number, default: 0 },
    totalOtherFees: { type: Number, default: 0 },
    totalDiscount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    status: { type: String, enum: ['Draft', 'Submitted', 'Approved', 'Rejected'], default: 'Draft' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

clientQuotationSchema.pre('save', async function (next) {
  if (!this.quotationNo) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('ClientQuotation').countDocuments();
    this.quotationNo = `CQ-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

clientQuotationSchema.index({ quotationNo: 1 });
clientQuotationSchema.index({ associateId: 1 });
clientQuotationSchema.index({ inquiryProjects: 1 });
clientQuotationSchema.index({ createdAt: -1 });

const ClientQuotation: Model<IClientQuotation> =
  (mongoose.models.ClientQuotation as Model<IClientQuotation>) ||
  mongoose.model<IClientQuotation>('ClientQuotation', clientQuotationSchema);

export default ClientQuotation;
