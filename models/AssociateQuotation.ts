import mongoose, { Document, Model } from 'mongoose';

export interface IAssociateQuotationServiceItem {
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
  totalAmount: number;
  grandTotal: number;
}

export interface IAssociateQuotation extends Document {
  quotationNo: string;
  serviceCategory: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
  countryAbbreviation: string;
  associateId?: mongoose.Types.ObjectId;
  associateSnapshot?: {
    associteName?: string;
    email?: string;
    associteType?: string;
    contact?: string;
    address?: string;
    country?: string;
    notes?: string;
  };
  inquiryProject: string;
  services: IAssociateQuotationServiceItem[];
  totalOfficialFees: number;
  totalAttorneyFees: number;
  totalOfficeFees: number;
  totalOtherFees: number;
  grandTotal: number;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const serviceItemSchema = new mongoose.Schema<IAssociateQuotationServiceItem>(
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
    totalAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
  },
  { _id: false }
);

const associateQuotationSchema = new mongoose.Schema<IAssociateQuotation>(
  {
    quotationNo: { type: String, unique: true, required: true, trim: true },
    serviceCategory: {
      type: String,
      enum: ['Trademark', 'Patent', 'Copyright', 'Design', 'Litigation'],
      required: true,
    },
    countryAbbreviation: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    associateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Associte' },
    associateSnapshot: {
      associteName: { type: String, trim: true },
      email: { type: String, trim: true },
      associteType: { type: String, trim: true },
      contact: { type: String, trim: true },
      address: { type: String, trim: true },
      country: { type: String, trim: true },
      notes: { type: String, trim: true },
    },
    inquiryProject: { type: String, required: true, trim: true },
    services: [serviceItemSchema],
    totalOfficialFees: { type: Number, default: 0 },
    totalAttorneyFees: { type: Number, default: 0 },
    totalOfficeFees: { type: Number, default: 0 },
    totalOtherFees: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    status: { type: String, enum: ['Draft', 'Submitted', 'Approved', 'Rejected'], default: 'Draft' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

associateQuotationSchema.index({ quotationNo: 1 });
associateQuotationSchema.index({ associateId: 1 });
associateQuotationSchema.index({ serviceCategory: 1 });
associateQuotationSchema.index({ countryAbbreviation: 1 });
associateQuotationSchema.index({ inquiryProject: 1 });
associateQuotationSchema.index({ createdAt: -1 });

const AssociateQuotation: Model<IAssociateQuotation> =
  (mongoose.models.AssociateQuotation as Model<IAssociateQuotation>) ||
  mongoose.model<IAssociateQuotation>('AssociateQuotation', associateQuotationSchema);

export default AssociateQuotation;
