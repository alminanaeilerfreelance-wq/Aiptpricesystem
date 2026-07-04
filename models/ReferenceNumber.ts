import mongoose, { Document, Model, Schema } from 'mongoose';

export type ReferenceNumberStatus = 'Available' | 'Reserved' | 'Used' | 'Cancelled';
export type ReferenceServiceType = 'Trademark' | 'Patent' | 'Design' | 'Copyright' | 'Other' | 'Litigation';

export interface IReferenceNumber extends Document {
  referenceNo: string;
  countryId: mongoose.Types.ObjectId;
  countryName: string;
  countryCode: string;
  serviceType: ReferenceServiceType;
  serviceCode: string;
  sequence: number;
  status: ReferenceNumberStatus;
  usedBy?: mongoose.Types.ObjectId;
  usedDate?: Date;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const referenceNumberSchema = new Schema<IReferenceNumber>(
  {
    referenceNo: { type: String, unique: true, required: true, trim: true, uppercase: true },
    countryId: { type: Schema.Types.ObjectId, ref: 'Country', required: true, index: true },
    countryName: { type: String, required: true, trim: true },
    countryCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    serviceType: {
      type: String,
      enum: ['Trademark', 'Patent', 'Design', 'Copyright', 'Other', 'Litigation'],
      required: true,
      index: true,
    },
    serviceCode: { type: String, required: true, trim: true, uppercase: true },
    sequence: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ['Available', 'Reserved', 'Used', 'Cancelled'],
      default: 'Available',
      index: true,
    },
    usedBy: { type: Schema.Types.ObjectId, ref: 'Client' },
    usedDate: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

referenceNumberSchema.index({ referenceNo: 1 }, { unique: true });
referenceNumberSchema.index({ countryId: 1, serviceType: 1, sequence: 1 }, { unique: true });

const ReferenceNumber: Model<IReferenceNumber> =
  (mongoose.models.ReferenceNumber as Model<IReferenceNumber>) ||
  mongoose.model<IReferenceNumber>('ReferenceNumber', referenceNumberSchema);

export default ReferenceNumber;
