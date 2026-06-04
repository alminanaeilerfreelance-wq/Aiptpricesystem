import mongoose, { Document, Model } from 'mongoose';

export interface IFeeBuilderDraft extends Document {
  name: string;
  draftDate?: string;
  selectedService: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
  tableMode?: 'quotation' | 'all';
  selectedCountry?: string;
  selectedContinent?: string;
  selectedProcedure?: string;
  selectedRuleIds: string[];
  editedFees: Record<string, { officialFee: string; attorneyFee: string }>;
  rowOrder: string[];
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;
  columnWidths: Record<string, number>;
  rowHeights: Record<string, number>;
  fontFamily: string;
  rowHeight: number;
  columnWidth: number;
  flagWidth: number;
  flagHeight: number;
  headerColor: string;
  rowColor: string;
  fontColor?: string;
  highlightColor?: string;
  printOrientation?: 'portrait' | 'landscape';
  paperFormat?: 'A4' | 'A3' | 'Letter';
  createdByUserId: string;
  createdByName?: string;
  createdByEmail?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const mixedDefault = () => ({});

const feeBuilderDraftSchema = new mongoose.Schema<IFeeBuilderDraft>(
  {
    name: { type: String, required: true, trim: true },
    draftDate: { type: String, trim: true },
    selectedService: {
      type: String,
      enum: ['Trademark', 'Patent', 'Copyright', 'Design', 'Litigation'],
      default: 'Trademark',
      required: true,
    },
    tableMode: { type: String, enum: ['quotation', 'all'], default: 'all' },
    selectedCountry: { type: String, trim: true },
    selectedContinent: { type: String, trim: true },
    selectedProcedure: { type: String, trim: true },
    selectedRuleIds: { type: [String], default: [] },
    editedFees: { type: mongoose.Schema.Types.Mixed, default: mixedDefault },
    rowOrder: { type: [String], default: [] },
    columnOrder: { type: [String], default: [] },
    columnVisibility: { type: mongoose.Schema.Types.Mixed, default: mixedDefault },
    columnWidths: { type: mongoose.Schema.Types.Mixed, default: mixedDefault },
    rowHeights: { type: mongoose.Schema.Types.Mixed, default: mixedDefault },
    fontFamily: { type: String, default: 'Calibri' },
    rowHeight: { type: Number, default: 22 },
    columnWidth: { type: Number, default: 72 },
    flagWidth: { type: Number, default: 26 },
    flagHeight: { type: Number, default: 16 },
    headerColor: { type: String, default: '#EAF2FF' },
    rowColor: { type: String, default: '#FFFFFF' },
    fontColor: { type: String, default: '#111827' },
    highlightColor: { type: String, default: '#FFF2CC' },
    printOrientation: { type: String, enum: ['portrait', 'landscape'], default: 'landscape' },
    paperFormat: { type: String, enum: ['A4', 'A3', 'Letter'], default: 'A4' },
    createdByUserId: { type: String, required: true, index: true },
    createdByName: { type: String, trim: true },
    createdByEmail: { type: String, trim: true, lowercase: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

feeBuilderDraftSchema.index({ createdByUserId: 1, updatedAt: -1 });
feeBuilderDraftSchema.index({ createdByUserId: 1, selectedContinent: 1, selectedCountry: 1 });

feeBuilderDraftSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret.__v;
    return ret;
  },
});

const FeeBuilderDraft: Model<IFeeBuilderDraft> =
  (mongoose.models.FeeBuilderDraft as Model<IFeeBuilderDraft>) ||
  mongoose.model<IFeeBuilderDraft>('FeeBuilderDraft', feeBuilderDraftSchema);

export default FeeBuilderDraft;
