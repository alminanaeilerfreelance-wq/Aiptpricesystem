export type FeeBuilderServiceKey = 'Trademark' | 'Patent' | 'Design' | 'Copyright' | 'Litigation';

export type FeeBuilderColumnKey =
  | 'country'
  | 'procedure'
  | 'officeFee'
  | 'attorneyFee'
  | 'total'
  | 'status'
  | 'updatedAt';

export type FeeBuilderPrintOrientation = 'portrait' | 'landscape';
export type FeeBuilderPaperFormat = 'A4' | 'A3' | 'Letter';
export type FeeBuilderTableMode = 'quotation' | 'all';

export interface FeeBuilderDraftValues {
  officialFee: string;
  attorneyFee: string;
}

export interface FeeBuilderDraft {
  id: string;
  name: string;
  draftDate?: string;
  createdAt: string;
  updatedAt: string;
  selectedService: FeeBuilderServiceKey;
  tableMode?: FeeBuilderTableMode;
  editedFees: Record<string, FeeBuilderDraftValues>;
  rowOrder: string[];
  columnVisibility: Record<FeeBuilderColumnKey, boolean>;
  fontFamily: string;
  rowHeight: number;
  columnWidth: number;
  flagWidth: number;
  flagHeight: number;
  headerColor: string;
  rowColor: string;
  fontColor?: string;
  highlightColor?: string;
  printOrientation?: FeeBuilderPrintOrientation;
  paperFormat?: FeeBuilderPaperFormat;
  selectedCountry?: string;
  selectedContinent?: string;
  selectedProcedure?: string;
  selectedRuleIds?: string[];
  columnOrder?: string[];
  columnWidths?: Record<string, number>;
  rowHeights?: Record<string, number>;
  hiddenRowKeys?: string[];
  hiddenProcedureColumns?: string[];
}

export const FEE_BUILDER_AUTOSAVE_STORAGE_KEY = 'fee-builder-pricing-rule-autosave';

export const readFeeBuilderAutosave = (): FeeBuilderDraft | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(FEE_BUILDER_AUTOSAVE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const writeFeeBuilderAutosave = (draft: FeeBuilderDraft) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FEE_BUILDER_AUTOSAVE_STORAGE_KEY, JSON.stringify(draft));
};
