import mongoose, { Document, Model, Types } from 'mongoose';
import { invoiceStatuses, invoiceTypes } from '@/schemas/invoice-schema';
import type { InvoiceStatus, InvoiceType } from '@/types/invoice';

export interface IInvoiceItem {
  pricingRuleId?: Types.ObjectId;
  countryId?: Types.ObjectId;
  procedureId?: Types.ObjectId;
  item?: string;
  country?: string;
  procedure?: string;
  officialFee: number;
  attorneyFee: number;
  quantity: number;
  vatPercentage: number;
  vatAmount: number;
  total: number;
}

export interface IInvoice extends Document {
  invoiceNumber: string;
  invoiceType: InvoiceType;
  referenceNumber?: string;
  applicationNumber?: string;
  applicationName?: string;
  projectName?: string;
  method?: string;
  clientMaster?: string;
  recipient?: string;
  subject?: string;
  bankName?: string;
  clientId: Types.ObjectId;
  serviceId?: Types.ObjectId;
  countryId: Types.ObjectId;
  procedureId?: Types.ObjectId;
  clientReference?: string;
  toAddress?: string;
  applicationIds?: Types.ObjectId[];
  items?: IInvoiceItem[];
  bankId?: Types.ObjectId;
  vatable?: boolean;
  vatPercentage?: number;
  subtotalOfficialFee?: number;
  subtotalAttorneyFee?: number;
  totalVat?: number;
  grandTotal?: number;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  invoiceDate: Date;
  dueDate?: Date;
  currency: string;
  amount: number;
  vat: number;
  discount: number;
  total: number;
  status: InvoiceStatus;
  remarks?: string;
  attachment?: string;
  pdfAccessToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceSchema = new mongoose.Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true, trim: true, unique: true },
    invoiceType: { type: String, enum: invoiceTypes, required: true, index: true },
    referenceNumber: { type: String, trim: true },
    applicationNumber: { type: String, trim: true },
    applicationName: { type: String, trim: true },
    projectName: { type: String, trim: true },
    method: { type: String, trim: true },
    clientMaster: { type: String, trim: true },
    recipient: { type: String, trim: true },
    subject: { type: String, trim: true },
    bankName: { type: String, trim: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: true, index: true },
    procedureId: { type: mongoose.Schema.Types.ObjectId, ref: 'Procedure' },
    clientReference: { type: String, trim: true },
    toAddress: { type: String, trim: true },
    applicationIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ReferenceNumber' }],
    items: [
      {
        pricingRuleId: { type: mongoose.Schema.Types.ObjectId, ref: 'PricingRule' },
        countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country' },
        procedureId: { type: mongoose.Schema.Types.ObjectId, ref: 'Procedure' },
        item: { type: String, trim: true },
        country: { type: String, trim: true },
        procedure: { type: String, trim: true },
        officialFee: { type: Number, default: 0, min: 0 },
        attorneyFee: { type: Number, default: 0, min: 0 },
        quantity: { type: Number, default: 1, min: 1 },
        vatPercentage: { type: Number, default: 0, min: 0, max: 100 },
        vatAmount: { type: Number, default: 0, min: 0 },
        total: { type: Number, default: 0, min: 0 },
      },
    ],
    bankId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank' },
    vatable: { type: Boolean, default: false },
    vatPercentage: { type: Number, default: 0, min: 0, max: 100 },
    subtotalOfficialFee: { type: Number, default: 0, min: 0 },
    subtotalAttorneyFee: { type: Number, default: 0, min: 0 },
    totalVat: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, default: 0, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    invoiceDate: { type: Date, required: true, index: true },
    dueDate: { type: Date },
    currency: { type: String, required: true, trim: true, default: 'SAR' },
    amount: { type: Number, required: true, min: 0 },
    vat: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: { type: String, enum: invoiceStatuses, default: 'Draft', index: true },
    remarks: { type: String, trim: true },
    attachment: { type: String, trim: true },
    pdfAccessToken: { type: String, trim: true },
  },
  { timestamps: true, collection: 'Invoice' }
);

invoiceSchema.index({ invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ invoiceType: 1, invoiceDate: -1 });

const Invoice: Model<IInvoice> =
  (mongoose.models.Invoice as Model<IInvoice>) || mongoose.model<IInvoice>('Invoice', invoiceSchema);

export default Invoice;
