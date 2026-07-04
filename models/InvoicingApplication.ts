import mongoose, { Document, Model, Types } from 'mongoose';
import { serviceModuleTypes, type ServiceModuleType } from '@/types/invoicing';

export interface IInvoicingApplication extends Document {
  moduleType: ServiceModuleType;
  clientId: Types.ObjectId;
  countryId: Types.ObjectId;
  aiptReferenceId?: Types.ObjectId;
  aiptReference?: string;
  classNo?: number;
  filingNumber?: string;
  applicationName: string;
  allowDuplicateFilingNumber: boolean;
  markImage?: string;
  status: 'Active' | 'Abandon' | 'Cancel';
  createdAt: Date;
  updatedAt: Date;
}

const invoicingApplicationSchema = new mongoose.Schema<IInvoicingApplication>(
  {
    moduleType: { type: String, enum: serviceModuleTypes, required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: true, index: true },
    aiptReferenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReferenceNumber' },
    aiptReference: { type: String, trim: true, uppercase: true, index: true },
    classNo: { type: Number, min: 1, max: 45 },
    filingNumber: { type: String, trim: true, index: true },
    applicationName: { type: String, required: true, trim: true, index: true },
    allowDuplicateFilingNumber: { type: Boolean, default: false },
    markImage: { type: String, trim: true },
    status: { type: String, enum: ['Active', 'Abandon', 'Cancel'], default: 'Active', index: true },
  },
  { timestamps: true }
);

invoicingApplicationSchema.index({ moduleType: 1, filingNumber: 1 });
invoicingApplicationSchema.index({ moduleType: 1, countryId: 1, aiptReference: 1 });
invoicingApplicationSchema.index(
  { moduleType: 1, aiptReferenceId: 1 },
  { unique: true, partialFilterExpression: { aiptReferenceId: { $exists: true } } }
);

const InvoicingApplication: Model<IInvoicingApplication> =
  (mongoose.models.InvoicingApplication as Model<IInvoicingApplication>) ||
  mongoose.model<IInvoicingApplication>('InvoicingApplication', invoicingApplicationSchema);

export default InvoicingApplication;
