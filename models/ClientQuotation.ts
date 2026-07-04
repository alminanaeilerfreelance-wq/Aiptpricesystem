import mongoose, { Document, Model } from 'mongoose';

export interface IClientQuotationServiceItem {
  procedureId?: mongoose.Types.ObjectId;
  procedureName: string;
  countryName?: string;
  classType: 'single' | 'multi';
  numberOfClasses: number;
  additionalFeePerClass: number;
  officialFee: number;
  additionalClassFees: number;
  totalOfficialFees: number;
  attorneyFee: number;
  officeFee: number;
  otherFees: number;
  vatFee: number;
  discount: number;
  totalAmount: number;
  grandTotal: number;
}

export interface IClientQuotationRequirementSnapshotItem {
  requirementId?: mongoose.Types.ObjectId;
  countryName?: string;
  title?: string;
  requirements?: string;
}

export interface IClientQuotation extends Document {
  quotationNo: string;
  clientId?: mongoose.Types.ObjectId;
  clientSnapshot?: {
    name?: string;
    email?: string;
    type?: string;
    country?: string;
    phone?: string;
  };
  inquiryId?: mongoose.Types.ObjectId;
  inquirySnapshot?: {
    referenceNo?: string;
    procedureName?: string;
    countryNames?: string[];
    serviceCategory?: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
  };
  requirementId?: mongoose.Types.ObjectId;
  requirementIds?: mongoose.Types.ObjectId[];
  requirementSnapshot?: {
    countryName?: string;
    title?: string;
    requirements?: string;
    selectedRequirements?: IClientQuotationRequirementSnapshotItem[];
  };
  inquiryProjects: string[];
  serviceCategory?: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
  services: IClientQuotationServiceItem[];
  totalOfficialFees: number;
  totalAttorneyFees: number;
  totalOfficeFees: number;
  totalOtherFees: number;
  totalVatFees: number;
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
    countryName: { type: String, trim: true },
    classType: { type: String, enum: ['single', 'multi'], default: 'single' },
    numberOfClasses: { type: Number, default: 1 },
    additionalFeePerClass: { type: Number, default: 0 },
    officialFee: { type: Number, default: 0 },
    additionalClassFees: { type: Number, default: 0 },
    totalOfficialFees: { type: Number, default: 0 },
    attorneyFee: { type: Number, default: 0 },
    officeFee: { type: Number, default: 0 },
    otherFees: { type: Number, default: 0 },
    vatFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
  },
  { _id: false }
);

const requirementSnapshotItemSchema = new mongoose.Schema<IClientQuotationRequirementSnapshotItem>(
  {
    requirementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement' },
    countryName: { type: String, trim: true },
    title: { type: String, trim: true },
    requirements: { type: String, trim: true },
  },
  { _id: false }
);

const clientQuotationSchema = new mongoose.Schema<IClientQuotation>(
  {
    quotationNo: { type: String, unique: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    clientSnapshot: {
      name: { type: String, trim: true },
      email: { type: String, trim: true },
      type: { type: String, trim: true },
      country: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
    inquiryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inquire' },
    inquirySnapshot: {
      referenceNo: { type: String, trim: true },
      procedureName: { type: String, trim: true },
      countryNames: [{ type: String, trim: true }],
      serviceCategory: { type: String, enum: ['Trademark', 'Patent', 'Copyright', 'Design', 'Litigation'] },
    },
    requirementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement' },
    requirementIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Requirement' }],
    requirementSnapshot: {
      countryName: { type: String, trim: true },
      title: { type: String, trim: true },
      requirements: { type: String, trim: true },
      selectedRequirements: [requirementSnapshotItemSchema],
    },
    inquiryProjects: [{ type: String, required: true, trim: true }],
    serviceCategory: { type: String, enum: ['Trademark', 'Patent', 'Copyright', 'Design', 'Litigation'] },
    services: [serviceItemSchema],
    totalOfficialFees: { type: Number, default: 0 },
    totalAttorneyFees: { type: Number, default: 0 },
    totalOfficeFees: { type: Number, default: 0 },
    totalOtherFees: { type: Number, default: 0 },
    totalVatFees: { type: Number, default: 0 },
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
    const counterName = `clientQuotation-${year}`;
    const counters = mongoose.connection.db.collection<{ _id: string; seq: number }>('counters');

    const existingCounter = await counters.findOne({ _id: counterName });
    const counter = existingCounter
      ? await counters.findOneAndUpdate(
          { _id: counterName },
          { $inc: { seq: 1 } },
          { returnDocument: 'after' }
        )
      : await (async () => {
          const latestQuotation = await (this.constructor as Model<IClientQuotation>)
            .findOne({ quotationNo: { $regex: `^CQ-${year}-\\d{4}$` } })
            .sort({ quotationNo: -1 })
            .select('quotationNo')
            .lean();

          const latestSequence = latestQuotation?.quotationNo
            ? Number(latestQuotation.quotationNo.slice(-4))
            : 0;

          return await counters.findOneAndUpdate(
            { _id: counterName },
            { $setOnInsert: { seq: latestSequence }, $inc: { seq: 1 } },
            { upsert: true, returnDocument: 'after' }
          );
        })();

    const sequence = Number(counter.value?.seq || 1);
    this.quotationNo = `CQ-${year}-${String(sequence).padStart(4, '0')}`;
  }
  next();
});

clientQuotationSchema.index({ quotationNo: 1 });
clientQuotationSchema.index({ clientId: 1 });
clientQuotationSchema.index({ inquiryProjects: 1 });
clientQuotationSchema.index({ serviceCategory: 1 });
clientQuotationSchema.index({ createdAt: -1 });

const existingClientQuotation = mongoose.models.ClientQuotation as Model<IClientQuotation> | undefined;
if (existingClientQuotation && !existingClientQuotation.schema.path('requirementIds')) {
  delete mongoose.models.ClientQuotation;
}

const ClientQuotation: Model<IClientQuotation> =
  (mongoose.models.ClientQuotation as Model<IClientQuotation>) ||
  mongoose.model<IClientQuotation>('ClientQuotation', clientQuotationSchema);

export default ClientQuotation;
