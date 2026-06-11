'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamicImport from 'next/dynamic';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  SvgIcon,
  Stack,
  Tab,
  Tabs,
  TextField,
  IconButton,
  Tooltip,
  Popover,
  Typography,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  GlobalStyles,
} from '@mui/material';
import { EmptyState, MuiDataTable } from '@/components/ui';
import type { MuiDataTableColumn } from '@/components/ui';
import clientQuotationsService, { ClientQuotation, ClientQuotationServiceItem } from '@/services/client-quotations.service';
import { clientsService, Client } from '@/services/clients.service';
import inquiresService, { Inquire } from '@/services/inquires.service';
import requirementsService from '@/services/requirements.service';
import { pricingRulesService, PricingRule } from '@/services/pricing-rules.service';
import companyDetailsService, { CompanyDetail } from '@/services/company-details.service';
import { usePermission } from '@/hooks/usePermission';
import Topbar from '@/components/layout/Topbar';
import { showErrorToast, showSuccessToast, showWarningToast } from '@/components/feedback/heroToast';
import { useSettingsContext } from '@/context/SettingsContext';

const ReactQuill = dynamicImport(() => import('react-quill-new'), {
  ssr: false,
});

type ServiceCategory = 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
type ClassType = 'single' | 'multi';
type ClientQuotationStatus = ClientQuotation['status'];

interface RequirementOption {
  _id: string;
  countryId?: string;
  countryName: string;
  serviceCategory?: ServiceCategory;
  title?: string;
  requirements: string;
}

interface InquiryCountryOption {
  _id: string;
  name: string;
  abbreviation?: string;
}

interface RequirementsState {
  loading: boolean;
  error: string;
  countryNames: string;
  serviceCategory: string;
  items: RequirementOption[];
}

interface ServiceDraft {
  procedureName: string;
  countryName: string;
  classType: ClassType;
  numberOfClasses: number;
  additionalFeePerClass: number;
  officialFee: number;
  attorneyFee: number;
  otherFees: number;
  vatFee: number; // stored as VAT percent
  discount: number;
}

interface RequirementEditorData {
  country: string;
  countryName: string;
  serviceCategory: ServiceCategory | '';
  title: string;
  requirements: string;
}

type RequirementAutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface RequirementAutosaveEntry {
  status: RequirementAutosaveStatus;
  message?: string;
  savedAt?: string;
}

interface InvoiceServiceTableColors {
  headerBg: string;
  headerText: string;
  subHeaderBg: string;
  subHeaderText: string;
  borderColor: string;
  rowBg: string;
  altRowBg: string;
  rowText: string;
  countryColText: string;
  totalRowBg: string;
  totalRowText: string;
  procedureColText: string;
  officialColText: string;
  attorneyColText: string;
  discountColText: string;
  vatColText: string;
  totalColText: string;
}

const defaultServiceDraft: ServiceDraft = {
  procedureName: '',
  countryName: '',
  classType: 'single',
  numberOfClasses: 1,
  additionalFeePerClass: 0,
  officialFee: 0,
  attorneyFee: 0,
  otherFees: 0,
  vatFee: 0,
  discount: 0,
};

const defaultRequirementEditorData: RequirementEditorData = {
  country: '',
  countryName: '',
  serviceCategory: '',
  title: '',
  requirements: '',
};

const REQUIREMENT_AUTOSAVE_DELAY_MS = 1200;

const requirementEditorModules = {
  table: true,
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline'],
    ['link', 'blockquote', 'code-block'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['clean'],
  ],
};

const requirementTableToolbarHandlers = {
  insertTable(this: any) {
    this.quill.getModule('table')?.insertTable(3, 3);
  },
  insertRowAbove(this: any) {
    this.quill.getModule('table')?.insertRowAbove();
  },
  insertRowBelow(this: any) {
    this.quill.getModule('table')?.insertRowBelow();
  },
  insertColumnLeft(this: any) {
    this.quill.getModule('table')?.insertColumnLeft();
  },
  insertColumnRight(this: any) {
    this.quill.getModule('table')?.insertColumnRight();
  },
  deleteRow(this: any) {
    this.quill.getModule('table')?.deleteRow();
  },
  deleteColumn(this: any) {
    this.quill.getModule('table')?.deleteColumn();
  },
  deleteTable(this: any) {
    this.quill.getModule('table')?.deleteTable();
  },
};

const requirementCartEditorModulesCache = new Map<string, any>();

const getRequirementCartToolbarId = (requirementId: string) => `requirement-cart-toolbar-${requirementId}`;

const getRequirementCartEditorModules = (requirementId: string): any => {
  const toolbarSelector = `#${getRequirementCartToolbarId(requirementId)}`;
  const cached = requirementCartEditorModulesCache.get(toolbarSelector);
  if (cached) return cached;

  const modules = {
    table: true,
    toolbar: {
      container: toolbarSelector,
      handlers: requirementTableToolbarHandlers,
    },
  };
  requirementCartEditorModulesCache.set(toolbarSelector, modules);
  return modules;
};

const RequirementCartToolbar = ({ toolbarId }: { toolbarId: string }) => (
  <Box id={toolbarId} className="requirement-cart-toolbar">
    <span className="ql-formats">
      <select className="ql-header" defaultValue="" aria-label="Heading">
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
        <option value="">Normal</option>
      </select>
      <button type="button" className="ql-bold" aria-label="Bold" />
      <button type="button" className="ql-italic" aria-label="Italic" />
      <button type="button" className="ql-underline" aria-label="Underline" />
      <button type="button" className="ql-link" aria-label="Link" />
      <button type="button" className="ql-list" value="ordered" aria-label="Numbered list" />
      <button type="button" className="ql-list" value="bullet" aria-label="Bullet list" />
    </span>
    <span className="ql-formats requirement-cart-table-tools">
      <button type="button" className="ql-insertTable" aria-label="Insert table">Table</button>
      <button type="button" className="ql-insertRowAbove" aria-label="Insert row above">Row Up</button>
      <button type="button" className="ql-insertRowBelow" aria-label="Insert row below">Row Down</button>
      <button type="button" className="ql-insertColumnLeft" aria-label="Insert column left">Col Left</button>
      <button type="button" className="ql-insertColumnRight" aria-label="Insert column right">Col Right</button>
      <button type="button" className="ql-deleteRow" aria-label="Delete row">Del Row</button>
      <button type="button" className="ql-deleteColumn" aria-label="Delete column">Del Col</button>
      <button type="button" className="ql-deleteTable" aria-label="Delete table">Del Table</button>
      <button type="button" className="ql-clean" aria-label="Clear formatting" />
    </span>
  </Box>
);

const defaultInvoiceServiceTableColors: InvoiceServiceTableColors = {
  headerBg: '#EEF2FF',
  headerText: '#111827',
  subHeaderBg: '#F8FAFC',
  subHeaderText: '#6B7280',
  borderColor: '#D1D5DB',
  rowBg: '#FFFFFF',
  altRowBg: '#F8FAFC',
  rowText: '#111827',
  countryColText: '#111827',
  totalRowBg: '#E5E7EB',
  totalRowText: '#111827',
  procedureColText: '#111827',
  officialColText: '#0F172A',
  attorneyColText: '#0F172A',
  discountColText: '#0F172A',
  vatColText: '#0F172A',
  totalColText: '#0F172A',
};

const INVOICE_TABLE_COLOR_STORAGE_KEY = 'aipt.clientQuotation.invoiceTableColors.v1';
const INVOICE_CELL_COLOR_STORAGE_KEY = 'aipt.clientQuotation.invoiceCellColors.v1';
const CLIENT_QUOTATION_REPORT_TITLE = 'CLIENT QUOTATION REPORT';
const REPORT_PDF_FONT = 'times';
const REPORT_CSS_FONT_STACK = '"Times New Roman", Times, serif';

const toCurrency = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const stripHtml = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const sanitizeHtml = (value: string) => value
  .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
  .replace(/\son\w+="[^"]*"/gi, '')
  .replace(/\son\w+='[^']*'/gi, '')
  .replace(/javascript:/gi, '');

const getInquireProcedureNames = (inquiry: Inquire | null | undefined): string[] => {
  if (!inquiry) return [];
  if (Array.isArray(inquiry.procedureIds) && inquiry.procedureIds.length > 0) {
    return inquiry.procedureIds
      .map((procedure) => (typeof procedure === 'string' ? procedure : procedure?.name || ''))
      .filter(Boolean);
  }
  const fallback =
    typeof inquiry.procedureId === 'string'
      ? inquiry.procedureId
      : inquiry.procedureId?.name || '';
  return fallback ? [fallback] : [];
};

const getInquireProcedureLabel = (inquiry: Inquire | null | undefined): string =>
  getInquireProcedureNames(inquiry).join(', ');

const normalizeProcedureName = (value: string): string => value.trim().toLowerCase();

const getQuotationInquiryId = (quotation: ClientQuotation): string => {
  if (typeof quotation.inquiryId === 'object') return quotation.inquiryId?._id || '';
  return quotation.inquiryId || '';
};

const SERVICE_COLOR_MAP: Record<ServiceCategory, string> = {
  Trademark: '#2563EB',
  Patent: '#16A34A',
  Design: '#9333EA',
  Copyright: '#F59E0B',
  Litigation: '#DC2626',
};

const STATUS_COLOR_MAP: Record<ClientQuotationStatus, { color: string; bg: string }> = {
  Draft: { color: '#64748B', bg: '#F1F5F9' },
  Submitted: { color: '#B45309', bg: '#FEF3C7' },
  Approved: { color: '#15803D', bg: '#DCFCE7' },
  Rejected: { color: '#B91C1C', bg: '#FEE2E2' },
};

const getCompanyDetailForQuotation = (
  quotation: ClientQuotation | null | undefined,
  companyDetails: CompanyDetail[]
): CompanyDetail | null => {
  if (!quotation || companyDetails.length === 0) return null;

  const serviceCategory =
    (quotation.serviceCategory || quotation.inquirySnapshot?.serviceCategory || 'Trademark')
      .trim()
      .toLowerCase();
  const inquiryCountryNames = new Set(
    (quotation.inquirySnapshot?.countryNames || [])
      .map((country) => String(country || '').trim().toLowerCase())
      .filter(Boolean)
  );

  const exactMatch = companyDetails.find((company) => {
    const companyCountry = String(company.countryName || '').trim().toLowerCase();
    const companyService = String(company.serviceCategory || '').trim().toLowerCase();
    return inquiryCountryNames.has(companyCountry) && companyService === serviceCategory;
  });
  if (exactMatch) return exactMatch;

  const countryMatch = companyDetails.find((company) =>
    inquiryCountryNames.has(String(company.countryName || '').trim().toLowerCase())
  );
  if (countryMatch) return countryMatch;

  const serviceMatch = companyDetails.find(
    (company) => String(company.serviceCategory || '').trim().toLowerCase() === serviceCategory
  );
  if (serviceMatch) return serviceMatch;

  return companyDetails[0] || null;
};

const toPdfFileName = (value: string) =>
  value.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'client-quotation-invoice';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const imageUrlToDataUrl = async (url?: string): Promise<string | null> => {
  if (!url) return null;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const getDataUrlImageFormat = (dataUrl: string): 'PNG' | 'JPEG' =>
  dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg') ? 'JPEG' : 'PNG';

const normalizeHexColor = (color: string, fallback = '#FFFFFF') => {
  const value = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    const red = value.charAt(1);
    const green = value.charAt(2);
    const blue = value.charAt(3);
    return `#${red}${red}${green}${green}${blue}${blue}`.toUpperCase();
  }
  return fallback;
};

const hexToRgbTuple = (color: string): [number, number, number] => {
  const hex = normalizeHexColor(color).replace('#', '');
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
};

const getReadableTextColor = (hexColor: string): string => {
  const [red, green, blue] = hexToRgbTuple(hexColor);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.63 ? '#111827' : '#F9FAFB';
};

const getInvoiceExportCellColors = (
  cellKey: string,
  defaultBg: string,
  defaultText: string,
  customColors: Record<string, string>
) => {
  const hasCustomColor = Object.prototype.hasOwnProperty.call(customColors, cellKey);
  const backgroundColor = normalizeHexColor(hasCustomColor ? customColors[cellKey] : defaultBg);
  const textColor = normalizeHexColor(hasCustomColor ? getReadableTextColor(backgroundColor) : defaultText, '#111827');
  return { backgroundColor, textColor };
};

const EyeIcon = () => (
  <SvgIcon fontSize="small" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M12 5c-5 0-9.27 3.11-11 7c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7m0 11a4 4 0 1 1 0-8a4 4 0 0 1 0 8m0-2.5A1.5 1.5 0 1 0 12 10a1.5 1.5 0 0 0 0 3.5"
    />
  </SvgIcon>
);

const NoteIcon = () => (
  <SvgIcon fontSize="small" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M3 17.25V21h3.75l11-11l-3.75-3.75zM20.71 7.04a1 1 0 0 0 0-1.41L18.37 3.29a1 1 0 0 0-1.41 0l-1.83 1.83l3.75 3.75z"
    />
  </SvgIcon>
);

const TrashIcon = () => (
  <SvgIcon fontSize="small" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M9 3h6l1 2h4v2H4V5h4zm1 6h2v9h-2zm4 0h2v9h-2zM7 9h2v9H7zm-1 12h12a2 2 0 0 0 2-2V8H4v11a2 2 0 0 0 2 2"
    />
  </SvgIcon>
);

const CheckIcon = () => (
  <SvgIcon fontSize="small" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M9 16.17L4.83 12l-1.42 1.41L9 19L21 7l-1.41-1.41z"
    />
  </SvgIcon>
);

const CloseIcon = () => (
  <SvgIcon fontSize="small" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M18.3 5.71L12 12l6.3 6.29l-1.41 1.41L10.59 13.41L4.29 19.7L2.88 18.29L9.17 12L2.88 5.71L4.29 4.3l6.3 6.29l6.3-6.29z"
    />
  </SvgIcon>
);

const PdfIcon = () => (
  <SvgIcon fontSize="small" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2m7 1.5V8h4.5zM7 13v5h1.2v-1.7h.8c1.1 0 1.9-.7 1.9-1.7S10.1 13 9 13zm1.2 1h.7c.5 0 .8.2.8.6s-.3.7-.8.7h-.7zm3.5-1v5h1.8c1.5 0 2.5-1 2.5-2.5S15 13 13.5 13zm1.2 1h.5c.9 0 1.4.6 1.4 1.5s-.5 1.5-1.4 1.5h-.5zm4-1v5h1.2v-1.9h1.6v-1h-1.6V14h1.9v-1z"
    />
  </SvgIcon>
);

const SettingsIcon = () => (
  <SvgIcon fontSize="small" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M19.14 12.94a7.4 7.4 0 0 0 .05-.94a7.4 7.4 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.6 7.6 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54a7.6 7.6 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.48a.5.5 0 0 0 .12.64l2.03 1.58a7.4 7.4 0 0 0-.05.94c0 .32.02.63.05.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.39 1.05.71 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.8a.5.5 0 0 0 .49-.42l.36-2.54c.58-.23 1.13-.55 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5"
    />
  </SvgIcon>
);

const computeAttorneyFeeAfterDiscount = (attorneyFee: number, discountAmount: number): number =>
  attorneyFee - discountAmount;

const computeVatAmount = (attorneyFeeAfterDiscount: number, vatPercent: number): number =>
  attorneyFeeAfterDiscount * (vatPercent / 100);

const getQuotationCountryNames = (quotation: ClientQuotation | null | undefined): string =>
  quotation?.inquirySnapshot?.countryNames?.join(', ') || '';

const getInquiryCountryOptions = (inquiry: Inquire | null | undefined): InquiryCountryOption[] =>
  Array.isArray(inquiry?.countryIds)
    ? inquiry.countryIds
        .flatMap((country: any): InquiryCountryOption[] => {
          if (!country || typeof country === 'string') return [];
          return [{
            _id: String(country._id || ''),
            name: String(country.name || '').trim(),
            abbreviation: String(country.abbreviation || '').trim().toUpperCase(),
          }];
        })
        .filter((country) => Boolean(country._id && country.name))
    : [];

const getInquiryReferenceSuffix = (referenceNo?: string): string =>
  String(referenceNo || '').replace(/^\d{5}/, '').trim().toUpperCase();

const isInternationalInquiryReference = (
  inquiry: Inquire | null | undefined,
  countries: InquiryCountryOption[]
): boolean => getInquiryReferenceSuffix(inquiry?.referenceNo) === 'INT' || countries.length > 1;

const getRequirementOptionLabel = (requirement: Pick<RequirementOption, 'title' | 'requirements'>): string =>
  requirement.title?.trim() || stripHtml(requirement.requirements || '').slice(0, 120) || 'Untitled Requirement';

const getRequirementSnapshotEntries = (quotation: ClientQuotation | null | undefined) => {
  const selectedRequirements = quotation?.requirementSnapshot?.selectedRequirements;
  if (Array.isArray(selectedRequirements) && selectedRequirements.length > 0) {
    return selectedRequirements;
  }

  if (quotation?.requirementSnapshot?.requirements) {
    return [
      {
        countryName: quotation.requirementSnapshot.countryName || getQuotationCountryNames(quotation),
        title: quotation.requirementSnapshot.title || '',
        requirements: quotation.requirementSnapshot.requirements,
      },
    ];
  }

  return [];
};

const getReferenceId = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && '_id' in value) {
    return String((value as { _id?: unknown })._id || '');
  }
  return '';
};

const getQuotationRequirementIds = (quotation: ClientQuotation): string[] => {
  const ids = Array.isArray(quotation.requirementIds)
    ? quotation.requirementIds.map((requirement) => getReferenceId(requirement)).filter(Boolean)
    : [];

  if (ids.length > 0) return ids;

  const legacyRequirementId = getReferenceId(quotation.requirementId);
  return legacyRequirementId ? [legacyRequirementId] : [];
};

const getServiceCountryName = (
  service: ClientQuotationServiceItem,
  quotation: ClientQuotation | null | undefined
): string =>
  String(
    service.countryName ||
      quotation?.requirementSnapshot?.countryName ||
      getQuotationCountryNames(quotation) ||
      ''
  ).trim();

const getServiceDiscountAmount = (service: ClientQuotationServiceItem): number =>
  Math.max(0, Number(service.discount || 0));

const getServiceVatAmount = (service: ClientQuotationServiceItem): number => {
  const attorneyFee = Math.max(0, Number(service.attorneyFee || 0));
  const discountAmount = getServiceDiscountAmount(service);
  const vatPercent = Math.max(0, Number(service.vatFee || 0));
  return computeVatAmount(computeAttorneyFeeAfterDiscount(attorneyFee, discountAmount), vatPercent);
};

const formatVatPercentLabel = (vatPercent: number): string => {
  const normalizedVat = Math.round(Math.max(0, vatPercent) * 100) / 100;
  return Number.isInteger(normalizedVat)
    ? String(normalizedVat)
    : normalizedVat.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
};

const getInvoiceVatHeaderLabel = (quotation: ClientQuotation | null | undefined): string => {
  const vatPercents = (quotation?.services || [])
    .map((service) => Number(service.vatFee || 0))
    .filter((vatPercent) => Number.isFinite(vatPercent) && vatPercent > 0);

  if (vatPercents.length === 0) return 'VAT';

  const declaredVat = vatPercents[0];
  const hasSingleDeclaredVat = vatPercents.every(
    (vatPercent) => Math.abs(vatPercent - declaredVat) < 0.001
  );

  return hasSingleDeclaredVat ? `VAT (${formatVatPercentLabel(declaredVat)}%)` : 'VAT (Mixed)';
};

const getRequirementCountryName = (quotation: ClientQuotation | null | undefined): string =>
  String(
    quotation?.requirementSnapshot?.countryName ||
      Array.from(
        new Set(
          getRequirementSnapshotEntries(quotation)
            .map((requirement) => requirement.countryName || '')
            .filter(Boolean)
        )
      ).join(', ') ||
      getQuotationCountryNames(quotation) ||
      ''
  ).trim();

const getRequirementDisplayRows = (quotation: ClientQuotation | null | undefined) =>
  getRequirementSnapshotEntries(quotation).map((requirement) => {
    const requirementsHtml = sanitizeHtml(requirement.requirements || '');
    return {
      countryName: requirement.countryName || getRequirementCountryName(quotation) || '-',
      title: requirement.title?.trim() || 'Requirement',
      requirementsHtml,
      requirementsText: stripHtml(requirementsHtml) || 'No requirement details available.',
    };
  });

const getServiceDetailsStats = (quotation: ClientQuotation) => {
  const serviceItems = quotation.services || [];
  const countries = new Set(
    serviceItems
      .map((service) => getServiceCountryName(service, quotation))
      .filter(Boolean)
  );

  return {
    serviceCount: serviceItems.length,
    countryCount: countries.size || (getQuotationCountryNames(quotation) ? 1 : 0),
    grandTotal: quotation.grandTotal || 0,
  };
};

const validateServiceFees = (
  service: Pick<
    ServiceDraft,
    | 'officialFee'
    | 'attorneyFee'
    | 'discount'
    | 'vatFee'
    | 'classType'
    | 'numberOfClasses'
    | 'additionalFeePerClass'
  >
): string[] => {
  const errors: string[] = [];
  const officialFee = Number(service.officialFee);
  const attorneyFee = Number(service.attorneyFee);
  const discount = Number(service.discount || 0);
  const vatPercent = Number(service.vatFee || 0);
  const numberOfClasses = Number(service.numberOfClasses || 1);
  const additionalFeePerClass = Number(service.additionalFeePerClass || 0);

  if (!Number.isFinite(officialFee)) errors.push('Official Fee must be a number.');
  else if (officialFee < 0) errors.push('Official Fee cannot be negative.');

  if (!Number.isFinite(attorneyFee)) errors.push('Attorney Fee must be a number.');
  else if (attorneyFee < 0) errors.push('Attorney Fee cannot be negative.');

  if (!Number.isFinite(discount)) errors.push('Discount must be a number.');
  else if (discount < 0) errors.push('Discount cannot be negative.');
  else if (discount > attorneyFee) errors.push('Discount cannot be greater than Attorney Fee.');

  if (!Number.isFinite(vatPercent)) errors.push('VAT must be a number.');
  else if (vatPercent < 0) errors.push('VAT cannot be negative.');
  else if (vatPercent > 100) errors.push('VAT cannot be greater than 100.');

  if (service.classType === 'multi') {
    if (!Number.isFinite(numberOfClasses) || numberOfClasses < 1) {
      errors.push('Number of Classes is required for multi class and must be at least 1.');
    }
    if (!Number.isFinite(additionalFeePerClass) || additionalFeePerClass < 0) {
      errors.push('Additional Fee Per Class is required for multi class and cannot be negative.');
    }
  }

  return errors;
};

const computeClientRow = (service: ServiceDraft, _category: ServiceCategory): ClientQuotationServiceItem => {
  const classType: ClassType = service.classType === 'multi' ? 'multi' : 'single';
  const numberOfClasses =
    classType === 'multi' ? Math.max(1, Math.floor(Number(service.numberOfClasses || 1))) : 1;
  const additionalFeePerClass =
    classType === 'multi' ? Math.max(0, Number(service.additionalFeePerClass || 0)) : 0;
  const additionalClassFees = additionalFeePerClass * numberOfClasses;
  const officialFee = Math.max(0, Number(service.officialFee || 0));
  const attorneyFee = Math.max(0, Number(service.attorneyFee || 0));
  const otherFees = Math.max(0, Number(service.otherFees || 0));
  const discountAmount = Math.max(0, Number(service.discount || 0));
  const vatPercent = Math.max(0, Number(service.vatFee || 0));
  const totalOfficialFees = officialFee + (classType === 'multi' ? additionalClassFees : 0);
  const attorneyFeeAfterDiscount = computeAttorneyFeeAfterDiscount(attorneyFee, discountAmount);
  const vatAmount = computeVatAmount(attorneyFeeAfterDiscount, vatPercent);
  const totalAmount = totalOfficialFees + attorneyFeeAfterDiscount + vatAmount;
  const grandTotal = totalAmount;

  return {
    procedureName: service.procedureName.trim(),
    countryName: service.countryName.trim(),
    classType,
    numberOfClasses,
    additionalFeePerClass,
    officialFee,
    additionalClassFees,
    totalOfficialFees,
    attorneyFee,
    otherFees,
    vatFee: vatPercent,
    discount: discountAmount,
    totalAmount,
    grandTotal,
  };
};

const toServiceDraftFromRow = (
  service: ClientQuotationServiceItem,
  _category: ServiceCategory
): ServiceDraft => {
  return {
    procedureName: String(service.procedureName || '').trim(),
    countryName: String(service.countryName || '').trim(),
    classType: service.classType === 'multi' ? 'multi' : 'single',
    numberOfClasses: Math.max(1, Number(service.numberOfClasses || 1)),
    additionalFeePerClass: Math.max(0, Number(service.additionalFeePerClass || 0)),
    officialFee: Math.max(0, Number(service.officialFee || 0)),
    attorneyFee: Math.max(0, Number(service.attorneyFee || 0)),
    otherFees: Math.max(0, Number(service.otherFees || 0)),
    vatFee: Math.max(0, Number(service.vatFee || 0)),
    discount: Math.max(0, Number(service.discount || 0)),
  };
};

export default function ClientQuotationsPage() {
  const { canApprove, canReject } = usePermission();
  const { settings } = useSettingsContext();
  const [items, setItems] = useState<ClientQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingItem, setViewingItem] = useState<ClientQuotation | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [inquiries, setInquiries] = useState<Inquire[]>([]);

  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedInquiryId, setSelectedInquiryId] = useState('');
  const [selectedRequirementIds, setSelectedRequirementIds] = useState<string[]>([]);
  const [selectedRequirementCountryId, setSelectedRequirementCountryId] = useState('');
  const [requirementDraftIds, setRequirementDraftIds] = useState<string[]>([]);
  const [requirementEditorOpen, setRequirementEditorOpen] = useState(false);
  const [editingRequirementId, setEditingRequirementId] = useState<string | null>(null);
  const [requirementEditorData, setRequirementEditorData] = useState<RequirementEditorData>(
    defaultRequirementEditorData
  );
  const [requirementEditorLoading, setRequirementEditorLoading] = useState(false);
  const [requirementEditorSaving, setRequirementEditorSaving] = useState(false);
  const [requirementEditorError, setRequirementEditorError] = useState('');
  const [requirementAutosaveState, setRequirementAutosaveState] = useState<Record<string, RequirementAutosaveEntry>>({});
  const requirementAutosaveTimersRef = useRef<Record<string, number>>({});
  const [serviceDraft, setServiceDraft] = useState<ServiceDraft>(defaultServiceDraft);
  const [serviceCountrySelections, setServiceCountrySelections] = useState<string[]>([]);
  const [services, setServices] = useState<ClientQuotationServiceItem[]>([]);
  const [editingServiceIndex, setEditingServiceIndex] = useState<number | null>(null);
  const [editingServiceDraft, setEditingServiceDraft] = useState<ServiceDraft | null>(null);
  const [activeTab, setActiveTab] = useState<ServiceCategory>('Trademark');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [tableSearch, setTableSearch] = useState('');
  const [requirementsState, setRequirementsState] = useState<RequirementsState>({
    loading: false,
    error: '',
    countryNames: '',
    serviceCategory: '',
    items: [],
  });
  const [priceRuleDialogOpen, setPriceRuleDialogOpen] = useState(false);
  const [priceRulesLoading, setPriceRulesLoading] = useState(false);
  const [priceRulesError, setPriceRulesError] = useState('');
  const [priceRules, setPriceRules] = useState<PricingRule[]>([]);
  const [priceRuleCountryFilter, setPriceRuleCountryFilter] = useState('');
  const [selectedPriceRuleId, setSelectedPriceRuleId] = useState('');
  const [invoiceServiceTableColors, setInvoiceServiceTableColors] = useState<InvoiceServiceTableColors>(
    defaultInvoiceServiceTableColors
  );
  const [invoiceCellColors, setInvoiceCellColors] = useState<Record<string, string>>({});
  const [invoiceCellPickerAnchor, setInvoiceCellPickerAnchor] = useState<HTMLElement | null>(null);
  const [selectedInvoiceCell, setSelectedInvoiceCell] = useState<{ key: string; label: string } | null>(null);
  const [invoiceCellColorDraft, setInvoiceCellColorDraft] = useState('#FFFFFF');
  const [invoiceCompanyDetails, setInvoiceCompanyDetails] = useState<CompanyDetail[]>([]);
  const [invoiceCompanyLoading, setInvoiceCompanyLoading] = useState(false);
  const [invoiceCompanyError, setInvoiceCompanyError] = useState('');
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

  const canApproveClientQuotation = canApprove('client-quotations');
  const canRejectClientQuotation = canReject('client-quotations');
  const canManageClientQuotationApproval = canApproveClientQuotation || canRejectClientQuotation;

  const notifySuccess = useCallback((description: string) => {
    showSuccessToast(description);
  }, []);

  const notifyValidationError = useCallback((description: string) => {
    showWarningToast(description);
  }, []);

  const notifyApiError = useCallback((description: string) => {
    showErrorToast(description);
  }, []);

  const getApiErrorMessage = useCallback((err: any, fallback: string) => {
    const details = err?.response?.data?.details;
    if (Array.isArray(details) && details.length > 0) return details.join(' ');
    if (typeof details === 'string' && details.trim()) return details.trim();
    return err?.response?.data?.error || err?.message || fallback;
  }, []);

  const clearRequirementAutosaveTimers = useCallback(() => {
    Object.values(requirementAutosaveTimersRef.current).forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    requirementAutosaveTimersRef.current = {};
  }, []);

  const updateRequirementItem = useCallback((requirementId: string, patch: Partial<RequirementOption>) => {
    setRequirementsState((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item._id === requirementId ? { ...item, ...patch } : item
      ),
    }));
  }, []);

  const saveRequirementDraftNow = useCallback(async (requirement: RequirementOption) => {
    if (
      !requirement.countryId ||
      !requirement.serviceCategory ||
      !String(requirement.title || '').trim() ||
      !stripHtml(requirement.requirements)
    ) {
      throw new Error('Title and requirement details are required before autosave.');
    }

    const response = await requirementsService.update(requirement._id, {
      country: requirement.countryId || '',
      serviceCategory: requirement.serviceCategory as ServiceCategory,
      title: String(requirement.title || '').trim(),
      requirements: requirement.requirements,
    });
    const updatedRequirement = response.data;
    updateRequirementItem(requirement._id, {
      countryId: updatedRequirement.country?._id || requirement.countryId,
      countryName: updatedRequirement.country?.name || requirement.countryName,
      serviceCategory: updatedRequirement.serviceCategory || requirement.serviceCategory,
      title: updatedRequirement.title || '',
      requirements: updatedRequirement.requirements || '',
    });
    setRequirementAutosaveState((prev) => ({
      ...prev,
      [requirement._id]: {
        status: 'saved',
        message: 'Autosaved',
        savedAt: new Date().toISOString(),
      },
    }));
  }, [updateRequirementItem]);

  const scheduleRequirementAutosave = useCallback((requirement: RequirementOption) => {
    const requirementId = requirement._id;
    const existingTimer = requirementAutosaveTimersRef.current[requirementId];
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    if (
      !requirement.countryId ||
      !requirement.serviceCategory ||
      !String(requirement.title || '').trim() ||
      !stripHtml(requirement.requirements)
    ) {
      setRequirementAutosaveState((prev) => ({
        ...prev,
        [requirementId]: {
          status: 'error',
          message: 'Title and requirement details are required before autosave.',
        },
      }));
      return;
    }

    setRequirementAutosaveState((prev) => ({
      ...prev,
      [requirementId]: { status: 'saving', message: 'Autosaving...' },
    }));

    requirementAutosaveTimersRef.current[requirementId] = window.setTimeout(async () => {
      try {
        await saveRequirementDraftNow(requirement);
      } catch (err: any) {
        setRequirementAutosaveState((prev) => ({
          ...prev,
          [requirementId]: {
            status: 'error',
            message: err?.response?.data?.error || err?.message || 'Autosave failed.',
          },
        }));
      } finally {
        delete requirementAutosaveTimersRef.current[requirementId];
      }
    }, REQUIREMENT_AUTOSAVE_DELAY_MS);
  }, [saveRequirementDraftNow]);

  const flushSelectedRequirementAutosaves = useCallback(async () => {
    const selectedIds = new Set(selectedRequirementIds);
    const requirementsToSave = requirementsState.items.filter((item) => selectedIds.has(item._id));

    for (const requirement of requirementsToSave) {
      const existingTimer = requirementAutosaveTimersRef.current[requirement._id];
      if (existingTimer) {
        window.clearTimeout(existingTimer);
        delete requirementAutosaveTimersRef.current[requirement._id];
      }
      setRequirementAutosaveState((prev) => ({
        ...prev,
        [requirement._id]: { status: 'saving', message: 'Saving before quotation...' },
      }));
      await saveRequirementDraftNow(requirement);
    }
  }, [requirementsState.items, saveRequirementDraftNow, selectedRequirementIds]);

  const handleRequirementCartChange = useCallback((
    requirementId: string,
    patch: Partial<Pick<RequirementOption, 'title' | 'requirements'>>
  ) => {
    const currentRequirement = requirementsState.items.find((item) => item._id === requirementId);
    if (!currentRequirement) return;

    const nextRequirement = { ...currentRequirement, ...patch };
    updateRequirementItem(requirementId, patch);
    scheduleRequirementAutosave(nextRequirement);
  }, [requirementsState.items, scheduleRequirementAutosave, updateRequirementItem]);

  useEffect(() => () => {
    clearRequirementAutosaveTimers();
  }, [clearRequirementAutosaveTimers]);

  const updateInvoiceServiceTableColor = (key: keyof InvoiceServiceTableColors, value: string) => {
    setInvoiceServiceTableColors((prev) => ({ ...prev, [key]: value }));
  };

  const getContrastTextColor = (hexColor: string): string => {
    return getReadableTextColor(hexColor);
  };

  const getInvoiceCellSx = (cellKey: string, defaultBg: string, defaultText: string) => {
    const hasCustomColor = Object.prototype.hasOwnProperty.call(invoiceCellColors, cellKey);
    const backgroundColor = hasCustomColor ? invoiceCellColors[cellKey] : defaultBg;
    return {
      bgcolor: backgroundColor,
      color: hasCustomColor ? getContrastTextColor(backgroundColor) : defaultText,
      cursor: 'pointer',
      transition: 'all 0.18s ease',
      '&:hover': {
        boxShadow: 'inset 0 0 0 1px rgba(37,99,235,0.45)',
      },
    };
  };

  const openInvoiceCellPicker = (
    event: React.MouseEvent<HTMLElement>,
    cellKey: string,
    label: string,
    fallbackColor: string
  ) => {
    setSelectedInvoiceCell({ key: cellKey, label });
    setInvoiceCellColorDraft(invoiceCellColors[cellKey] || fallbackColor);
    setInvoiceCellPickerAnchor(event.currentTarget);
  };

  const closeInvoiceCellPicker = () => {
    setInvoiceCellPickerAnchor(null);
    setSelectedInvoiceCell(null);
  };

  const applyInvoiceCellColor = (colorValue: string) => {
    if (!selectedInvoiceCell) return;
    setInvoiceCellColors((prev) => ({ ...prev, [selectedInvoiceCell.key]: colorValue }));
  };

  const clearSelectedInvoiceCellColor = () => {
    if (!selectedInvoiceCell) return;
    setInvoiceCellColors((prev) => {
      const next = { ...prev };
      delete next[selectedInvoiceCell.key];
      return next;
    });
  };

  const handleSaveInvoiceDefaultDesign = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      INVOICE_TABLE_COLOR_STORAGE_KEY,
      JSON.stringify(invoiceServiceTableColors)
    );
    window.localStorage.setItem(
      INVOICE_CELL_COLOR_STORAGE_KEY,
      JSON.stringify(invoiceCellColors)
    );
    notifySuccess('Default Service Details table color design saved.');
  };

  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const rawTableColors = window.localStorage.getItem(INVOICE_TABLE_COLOR_STORAGE_KEY);
    if (rawTableColors) {
      try {
        const parsed = JSON.parse(rawTableColors) as Partial<InvoiceServiceTableColors>;
        setInvoiceServiceTableColors((prev) => ({ ...prev, ...parsed }));
      } catch {
        // ignore invalid local storage value
      }
    }

    const rawCellColors = window.localStorage.getItem(INVOICE_CELL_COLOR_STORAGE_KEY);
    if (rawCellColors) {
      try {
        const parsed = JSON.parse(rawCellColors) as Record<string, string>;
        if (parsed && typeof parsed === 'object') {
          setInvoiceCellColors(parsed);
        }
      } catch {
        // ignore invalid local storage value
      }
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [quotationRes, clientRes, inquireRes] = await Promise.all([
        clientQuotationsService.list({ page: 1, limit: 500 }),
        clientsService.list({ page: 1, limit: 1000 }),
        inquiresService.list({ page: 1, limit: 1000 }),
      ]);
      setItems(quotationRes.clientQuotations || []);
      setClients(clientRes.clients || []);
      setInquiries(inquireRes.inquires || []);
    } catch (err: any) {
      notifyApiError(getApiErrorMessage(err, 'Failed to load data.'));
    } finally {
      setLoading(false);
    }
  }, [getApiErrorMessage, notifyApiError]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!viewDialogOpen || !viewingItem) return;
    let cancelled = false;

    const loadInvoiceCompanyDetails = async () => {
      try {
        setInvoiceCompanyLoading(true);
        setInvoiceCompanyError('');

        const response = await companyDetailsService.list({ page: 1, limit: 1000 });
        if (cancelled) return;

        setInvoiceCompanyDetails(
          Array.isArray(response?.companyDetails) ? response.companyDetails : []
        );
      } catch (err: any) {
        if (cancelled) return;
        setInvoiceCompanyDetails([]);
        setInvoiceCompanyError(
          err?.response?.data?.error || err?.message || 'Failed to load company details'
        );
      } finally {
        if (!cancelled) setInvoiceCompanyLoading(false);
      }
    };

    loadInvoiceCompanyDetails().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [viewDialogOpen, viewingItem]);

  const selectedClient = useMemo(() => clients.find((c) => c._id === selectedClientId), [clients, selectedClientId]);
  const selectedInquiry = useMemo(
    () => inquiries.find((i) => i._id === selectedInquiryId),
    [inquiries, selectedInquiryId]
  );
  const usedInquiryIds = useMemo(
    () =>
      new Set(
        items
          .filter((quotation) => quotation._id !== editingId)
          .map(getQuotationInquiryId)
          .filter(Boolean)
      ),
    [editingId, items]
  );
  const availableInquiries = useMemo(
    () =>
      inquiries.filter(
        (inquiry) => !usedInquiryIds.has(inquiry._id) || inquiry._id === selectedInquiryId
      ),
    [inquiries, selectedInquiryId, usedInquiryIds]
  );
  const selectedRequirements = useMemo(() => {
    const requirementById = new Map(requirementsState.items.map((item) => [item._id, item]));
    return selectedRequirementIds
      .map((id) => requirementById.get(id))
      .filter((item): item is RequirementOption => Boolean(item));
  }, [requirementsState.items, selectedRequirementIds]);
  const selectedRequirementDrafts = useMemo(() => {
    const requirementById = new Map(requirementsState.items.map((item) => [item._id, item]));
    return requirementDraftIds
      .map((id) => requirementById.get(id))
      .filter((item): item is RequirementOption => Boolean(item));
  }, [requirementsState.items, requirementDraftIds]);
  const inquiryProcedureOptions = useMemo(
    () => Array.from(new Set(getInquireProcedureNames(selectedInquiry))).filter(Boolean),
    [selectedInquiry]
  );
  const serviceDetailProcedureOptions = useMemo(
    () => {
      const fromPricingRules = Array.from(
        new Set(
          (priceRules || [])
            .map((rule) => String(rule.procedureName || '').trim())
            .filter(Boolean)
        )
      );
      return Array.from(new Set([...inquiryProcedureOptions, ...fromPricingRules])).filter(Boolean);
    },
    [priceRules, inquiryProcedureOptions]
  );
  const inquiryCountryOptions = useMemo(
    () => getInquiryCountryOptions(selectedInquiry),
    [selectedInquiry]
  );
  const inquiryCountries = useMemo(
    () => inquiryCountryOptions.map((country) => country.name).filter(Boolean),
    [inquiryCountryOptions]
  );
  const isInternationalInquiry = useMemo(
    () => isInternationalInquiryReference(selectedInquiry, inquiryCountryOptions),
    [selectedInquiry, inquiryCountryOptions]
  );
  const availableRuleCountries = useMemo(
    () => Array.from(new Set(inquiryCountries)),
    [inquiryCountries]
  );
  const requirementCountryOptions = useMemo(
    () =>
      inquiryCountryOptions.map((country) => ({
        ...country,
        requirementCount: requirementsState.items.filter((requirement) => requirement.countryId === country._id).length,
      })),
    [inquiryCountryOptions, requirementsState.items]
  );
  const visibleRequirementOptions = useMemo(
    () =>
      selectedRequirementCountryId
        ? requirementsState.items.filter((requirement) => requirement.countryId === selectedRequirementCountryId)
        : [],
    [requirementsState.items, selectedRequirementCountryId]
  );
  const filteredPriceRules = useMemo(() => {
    const procedureFilter = serviceDraft.procedureName.trim();
    const allowedCountries = new Set(inquiryCountries.map((country) => country.trim().toLowerCase()));
    const selectedCountry = priceRuleCountryFilter.trim().toLowerCase();
    return (priceRules || []).filter((rule) => {
      const normalizedRuleProcedure = normalizeProcedureName(rule.procedureName || '');
      const normalizedRuleCountry = String(rule.countryName || '').trim().toLowerCase();
      if (allowedCountries.size > 0 && !allowedCountries.has(normalizedRuleCountry)) {
        return false;
      }
      if (selectedCountry && normalizedRuleCountry !== selectedCountry) {
        return false;
      }
      if (procedureFilter) {
        return normalizedRuleProcedure === normalizeProcedureName(procedureFilter);
      }
      return true;
    });
  }, [inquiryCountries, priceRuleCountryFilter, priceRules, serviceDraft.procedureName]);
  const selectedPriceRule = useMemo(
    () => filteredPriceRules.find((rule) => rule._id === selectedPriceRuleId) || null,
    [filteredPriceRules, selectedPriceRuleId]
  );
  const selectedInvoiceCompanyDetail = useMemo(() => {
    return getCompanyDetailForQuotation(viewingItem, invoiceCompanyDetails);
  }, [viewingItem, invoiceCompanyDetails]);

  useEffect(() => {
    if (serviceDetailProcedureOptions.length === 0) return;
    if (!serviceDraft.procedureName.trim()) {
      setServiceDraft((prev) => ({ ...prev, procedureName: serviceDetailProcedureOptions[0] || '' }));
      return;
    }
    const isValid = serviceDetailProcedureOptions.some(
      (option) => normalizeProcedureName(option) === normalizeProcedureName(serviceDraft.procedureName)
    );
    if (isValid) return;
    setServiceDraft((prev) => ({ ...prev, procedureName: serviceDetailProcedureOptions[0] || '' }));
  }, [serviceDetailProcedureOptions, serviceDraft.procedureName]);

  useEffect(() => {
    if (!priceRuleDialogOpen) return;
    if (filteredPriceRules.length === 0) {
      if (selectedPriceRuleId) setSelectedPriceRuleId('');
      return;
    }
    const exists = filteredPriceRules.some((rule) => rule._id === selectedPriceRuleId);
    if (!exists) {
      setSelectedPriceRuleId(filteredPriceRules[0]._id);
    }
  }, [filteredPriceRules, priceRuleDialogOpen, selectedPriceRuleId]);

  const serviceCategory = ((selectedInquiry?.serviceId as any)?.category || 'Trademark') as ServiceCategory;
  const inquiryProjectRef = (selectedInquiry?.referenceNo || '') as string;
  const inquiryProcedure = getInquireProcedureLabel(selectedInquiry);
  const inquiryCountry = inquiryCountries.join(', ');
  const primaryInquiryCountry = inquiryCountries[0] || '';
  const getServiceCountryTargets = useCallback((): string[] => {
    const selectedCountries = serviceCountrySelections
      .map((country) => country.trim())
      .filter(Boolean);
    if (selectedCountries.length > 0) return Array.from(new Set(selectedCountries));

    const draftCountry = serviceDraft.countryName.trim();
    if (draftCountry) return [draftCountry];

    return !isInternationalInquiry && primaryInquiryCountry ? [primaryInquiryCountry] : [];
  }, [isInternationalInquiry, primaryInquiryCountry, serviceCountrySelections, serviceDraft.countryName]);
  const resolveServiceCountryName = useCallback(
    (countryName?: string) => {
      const normalizedCountry = String(countryName || '').trim();
      if (normalizedCountry) return normalizedCountry;
      return priceRuleCountryFilter || serviceCountrySelections[0] || primaryInquiryCountry || '';
    },
    [priceRuleCountryFilter, primaryInquiryCountry, serviceCountrySelections]
  );
  useEffect(() => {
    if (!primaryInquiryCountry) return;
    setServiceDraft((prev) => (prev.countryName || isInternationalInquiry ? prev : { ...prev, countryName: primaryInquiryCountry }));
    setServiceCountrySelections((prev) => {
      const valid = prev.filter((country) => inquiryCountries.includes(country));
      if (valid.length > 0) return valid;
      return isInternationalInquiry ? [] : [primaryInquiryCountry];
    });
  }, [inquiryCountries, isInternationalInquiry, primaryInquiryCountry]);
  const serviceDraftComputedRow = useMemo(
    () => computeClientRow(serviceDraft, serviceCategory),
    [serviceDraft, serviceCategory]
  );
  const serviceDraftVatOnAttorney = useMemo(
    () => {
      const attorneyFee = Math.max(0, Number(serviceDraft.attorneyFee || 0));
      const discountAmount = Math.max(0, Number(serviceDraft.discount || 0));
      const vatPercent = Math.max(0, Number(serviceDraft.vatFee || 0));
      const attorneyAfterDiscount = computeAttorneyFeeAfterDiscount(attorneyFee, discountAmount);
      return computeVatAmount(attorneyAfterDiscount, vatPercent);
    },
    [serviceDraft.attorneyFee, serviceDraft.discount, serviceDraft.vatFee]
  );
  const showClassFeeColumns = useMemo(
    () =>
      serviceDraft.classType === 'multi' ||
      (editingServiceDraft?.classType || 'single') === 'multi' ||
      services.some((row) => row.classType === 'multi'),
    [serviceDraft.classType, editingServiceDraft?.classType, services]
  );

  const filteredItems = useMemo(
    () => items.filter((q) => (q.serviceCategory || q.inquirySnapshot?.serviceCategory) === activeTab),
    [items, activeTab]
  );
  const searchedItems = useMemo(() => {
    const query = tableSearch.trim().toLowerCase();
    if (!query) return filteredItems;
    return filteredItems.filter((row) => {
      const inquiry = (row.inquirySnapshot?.referenceNo || row.inquiryProjects?.join(', ') || '').toLowerCase();
      const service = (row.serviceCategory || row.inquirySnapshot?.serviceCategory || '').toLowerCase();
      const client = (row.clientSnapshot?.name || '').toLowerCase();
      const procedure = (row.inquirySnapshot?.procedureName || '').toLowerCase();
      const status = (row.status || '').toLowerCase();
      return inquiry.includes(query) || service.includes(query) || client.includes(query) || procedure.includes(query) || status.includes(query);
    });
  }, [filteredItems, tableSearch]);
  const pagedRows = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return searchedItems.slice(start, start + rowsPerPage);
  }, [searchedItems, page, rowsPerPage]);

  const handleDownloadInvoicePdf = async (quotation: ClientQuotation) => {
    setDownloadingPdfId(quotation._id);
    try {
      let companyDetails = invoiceCompanyDetails;
      if (companyDetails.length === 0) {
        const response = await companyDetailsService.list({ page: 1, limit: 1000 });
        companyDetails = Array.isArray(response?.companyDetails) ? response.companyDetails : [];
        setInvoiceCompanyDetails(companyDetails);
      }

      const company = getCompanyDetailForQuotation(quotation, companyDetails);
      const logoDataUrl = await imageUrlToDataUrl(settings?.logoUrl);
      const jsPDF = await import('jspdf');
      const autoTable = await import('jspdf-autotable');
      const doc = new jsPDF.jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 42;
      const invoiceNo = quotation.quotationNo || quotation._id;
      const invoiceDate = quotation.createdAt ? new Date(quotation.createdAt).toLocaleDateString() : '-';
      const serviceCategory = quotation.serviceCategory || quotation.inquirySnapshot?.serviceCategory || '-';
      const countryNames = quotation.inquirySnapshot?.countryNames?.join(', ') || '-';
      const status = quotation.status || 'Submitted';
      const serviceStats = getServiceDetailsStats(quotation);
      const vatHeaderLabel = getInvoiceVatHeaderLabel(quotation);

      doc.setFillColor(11, 23, 57);
      doc.rect(0, 0, pageWidth, 118, 'F');
      if (logoDataUrl) {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(margin, 28, 54, 54, 8, 8, 'F');
        doc.addImage(logoDataUrl, getDataUrlImageFormat(logoDataUrl), margin + 7, 35, 40, 40, undefined, 'FAST');
      } else {
        doc.setFillColor(37, 99, 235);
        doc.roundedRect(margin, 32, 44, 44, 8, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont(REPORT_PDF_FONT, 'bold');
        doc.setFontSize(20);
        doc.text('A', margin + 17, 60);
      }
      doc.setTextColor(255, 255, 255);
      doc.setFont(REPORT_PDF_FONT, 'bold');
      doc.setFontSize(18);
      doc.text(company?.companyName || 'AIP&T LAW FIRM', margin + 58, 48);
      doc.setFont(REPORT_PDF_FONT, 'normal');
      doc.setFontSize(9);
      doc.text([company?.address || 'Professional IP legal services', company?.email || '', company?.contact || ''].filter(Boolean), margin + 58, 66);
      doc.setFont(REPORT_PDF_FONT, 'bold');
      doc.setFontSize(24);
      doc.text(CLIENT_QUOTATION_REPORT_TITLE, pageWidth - margin, 50, { align: 'right' });
      doc.setFontSize(10);
      doc.text(`Quotation No: ${invoiceNo}`, pageWidth - margin, 72, { align: 'right' });
      doc.text(`Date: ${invoiceDate}`, pageWidth - margin, 88, { align: 'right' });

      const statusColor = STATUS_COLOR_MAP[status as ClientQuotationStatus] || STATUS_COLOR_MAP.Submitted;
      doc.setTextColor(15, 23, 42);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, 140, pageWidth - margin * 2, 92, 8, 8, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, 140, pageWidth - margin * 2, 92, 8, 8, 'S');

      doc.setFont(REPORT_PDF_FONT, 'bold');
      doc.setFontSize(10);
      doc.text('BILL TO', margin + 18, 162);
      doc.text('PROJECT DETAILS', pageWidth / 2 + 12, 162);
      doc.setFont(REPORT_PDF_FONT, 'normal');
      doc.setFontSize(9);
      doc.text(
        [
          quotation.clientSnapshot?.name || 'Client',
          quotation.clientSnapshot?.email || '',
          quotation.clientSnapshot?.phone || '',
          quotation.clientSnapshot?.country || '',
        ].filter(Boolean),
        margin + 18,
        180
      );
      doc.text(
        [
          `Inquiry: ${quotation.inquirySnapshot?.referenceNo || quotation.inquiryProjects?.join(', ') || '-'}`,
          `Service: ${serviceCategory}`,
          `Procedure: ${quotation.inquirySnapshot?.procedureName || '-'}`,
          `Country: ${countryNames}`,
          `Status: ${statusColor ? status : status}`,
        ],
        pageWidth / 2 + 12,
        180
      );

      const serviceSectionY = 248;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, serviceSectionY, pageWidth - margin * 2, 44, 8, 8, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, serviceSectionY, pageWidth - margin * 2, 44, 8, 8, 'S');
      doc.setFillColor(...hexToRgbTuple(invoiceServiceTableColors.headerBg));
      doc.roundedRect(margin, serviceSectionY, 5, 44, 3, 3, 'F');
      doc.setTextColor(15, 23, 42);
      doc.setFont(REPORT_PDF_FONT, 'bold');
      doc.setFontSize(13);
      doc.text('Service Details', margin + 16, serviceSectionY + 18);
      doc.setFont(REPORT_PDF_FONT, 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Professional fee breakdown by country, procedure, tax, discount, and total.', margin + 16, serviceSectionY + 32);
      doc.setFont(REPORT_PDF_FONT, 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`${serviceStats.serviceCount} service${serviceStats.serviceCount === 1 ? '' : 's'}`, pageWidth - margin - 168, serviceSectionY + 18);
      doc.text(`${serviceStats.countryCount} countr${serviceStats.countryCount === 1 ? 'y' : 'ies'}`, pageWidth - margin - 96, serviceSectionY + 18);
      doc.text(`Total ${toCurrency(serviceStats.grandTotal)}`, pageWidth - margin, serviceSectionY + 18, { align: 'right' });

      const isTrademarkInvoice = serviceCategory === 'Trademark';
      const serviceRows = (quotation.services || []).map((service) => {
        const classLabel =
          service.classType === 'multi'
            ? `Multi | ${Math.max(1, Number(service.numberOfClasses || 1))} classes`
            : 'Single';
        return [
          getServiceCountryName(service, quotation) || countryNames,
          `${service.procedureName || '-'}${isTrademarkInvoice ? `\n${classLabel}` : ''}`,
          toCurrency(service.totalOfficialFees || service.officialFee || 0),
          toCurrency(service.attorneyFee || 0),
          toCurrency(getServiceDiscountAmount(service)),
          toCurrency(getServiceVatAmount(service)),
          toCurrency(service.grandTotal || 0),
        ];
      });
      const serviceBodyRows = serviceRows.length > 0 ? serviceRows : [['No service details available.', '-', '-', '-', '-', '-', '-']];
      const tableColumns = ['country', 'procedure', 'official', 'attorney', 'discount', 'vat', 'total'];
      const borderRgb = hexToRgbTuple(invoiceServiceTableColors.borderColor);
      const applyPdfCellColors = (data: any) => {
        const columnKey = tableColumns[data.column.index] || 'procedure';
        let cellKey = '';
        let defaultBg = invoiceServiceTableColors.rowBg;
        let defaultText = invoiceServiceTableColors.rowText;

        if (data.section === 'head') {
          if (data.row.index === 0) {
            cellKey = `header-${columnKey}`;
            defaultBg = invoiceServiceTableColors.headerBg;
            defaultText = invoiceServiceTableColors.headerText;
          } else {
            cellKey = `subheader-${columnKey}`;
            defaultBg = invoiceServiceTableColors.subHeaderBg;
            defaultText = invoiceServiceTableColors.subHeaderText;
          }
        } else {
          const isGrandTotalRow = data.row.index === serviceBodyRows.length;
          if (isGrandTotalRow) {
            cellKey = `grand-${columnKey}`;
            defaultBg = invoiceServiceTableColors.totalRowBg;
            defaultText = invoiceServiceTableColors.totalRowText;
          } else {
            cellKey = `row-${data.row.index}-${columnKey}`;
            defaultBg = data.row.index % 2 === 0
              ? invoiceServiceTableColors.rowBg
              : invoiceServiceTableColors.altRowBg;
            defaultText =
              columnKey === 'country'
                ? invoiceServiceTableColors.countryColText
                : columnKey === 'procedure'
                  ? invoiceServiceTableColors.procedureColText
                  : columnKey === 'official'
                    ? invoiceServiceTableColors.officialColText
                    : columnKey === 'attorney'
                      ? invoiceServiceTableColors.attorneyColText
                      : columnKey === 'discount'
                        ? invoiceServiceTableColors.discountColText
                        : columnKey === 'vat'
                          ? invoiceServiceTableColors.vatColText
                          : invoiceServiceTableColors.totalColText;
          }
        }

        const { backgroundColor, textColor } = getInvoiceExportCellColors(
          cellKey,
          defaultBg,
          defaultText,
          invoiceCellColors
        );
        data.cell.styles.fillColor = hexToRgbTuple(backgroundColor);
        data.cell.styles.textColor = hexToRgbTuple(textColor);
      };

      autoTable.default(doc, {
        startY: serviceSectionY + 56,
        head: [
          ['Country', 'Procedure Name', 'Official Fees', 'Attorney Fees', 'Discount', vatHeaderLabel, 'Total'],
          ...(isTrademarkInvoice
            ? [['Country', 'Class Type / No. Classes', 'per mark per class', 'per mark per class', '', '', 'per mark per class']]
            : []),
        ],
        body: [
          ...serviceBodyRows,
          [
            'Grand Total',
            '',
            toCurrency(quotation.totalOfficialFees || 0),
            toCurrency(quotation.totalAttorneyFees || 0),
            toCurrency(quotation.totalDiscount || 0),
            toCurrency(quotation.totalVatFees || 0),
            toCurrency(quotation.grandTotal || 0),
          ],
        ],
        theme: 'grid',
        styles: {
          font: REPORT_PDF_FONT,
          fontSize: 8.2,
          cellPadding: { top: 7, right: 6, bottom: 7, left: 6 },
          lineColor: borderRgb,
          lineWidth: 0.35,
          overflow: 'linebreak',
          valign: 'middle',
        },
        headStyles: {
          fontStyle: 'bold',
          fontSize: 8.2,
          halign: 'center',
        },
        columnStyles: {
          0: { cellWidth: 76 },
          1: { cellWidth: 150 },
          2: { halign: 'right', cellWidth: 58 },
          3: { halign: 'right', cellWidth: 58 },
          4: { halign: 'right', cellWidth: 55 },
          5: { halign: 'right', cellWidth: 49 },
          6: { halign: 'right', cellWidth: 65 },
        },
        didParseCell: (data: any) => {
          applyPdfCellColors(data);
          if (data.section === 'head' && data.row.index === 1) {
            data.cell.styles.fontStyle = 'italic';
            data.cell.styles.fontSize = 7.5;
          }
          if (data.section === 'body' && data.column.index === 1) {
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.section === 'body' && data.column.index === 6) {
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.section === 'body' && data.row.index === serviceBodyRows.length) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 8.8;
          }
        },
        margin: { left: margin, right: margin },
      });

      const afterServicesY = ((doc as any).lastAutoTable?.finalY || 330) + 18;
      doc.setTextColor(15, 23, 42);
      doc.setFont(REPORT_PDF_FONT, 'bold');
      doc.setFontSize(12);
      doc.text('Requirement Details', margin, afterServicesY);
      const requirementRows = getRequirementDisplayRows(quotation);
      autoTable.default(doc, {
        startY: afterServicesY + 12,
        head: [['Title', 'Country', 'Description']],
        body: requirementRows.length > 0
          ? requirementRows.map((requirement) => [
              requirement.title,
              requirement.countryName,
              requirement.requirementsText,
            ])
          : [['-', countryNames || '-', 'No requirement details available.']],
        theme: 'grid',
        styles: {
          font: REPORT_PDF_FONT,
          fontSize: 8.5,
          cellPadding: 6,
          lineColor: borderRgb,
          lineWidth: 0.4,
          overflow: 'linebreak',
          valign: 'top',
        },
        headStyles: {
          fillColor: hexToRgbTuple(invoiceServiceTableColors.headerBg),
          textColor: hexToRgbTuple(invoiceServiceTableColors.headerText),
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 120 },
          1: { cellWidth: 100 },
          2: { cellWidth: pageWidth - margin * 2 - 220 },
        },
        margin: { left: margin, right: margin },
      });

      const afterRequirementY = ((doc as any).lastAutoTable?.finalY || afterServicesY) + 24;
      const termsY = Math.max(afterRequirementY, pageHeight - 130);
      doc.setTextColor(71, 85, 105);
      doc.setFont(REPORT_PDF_FONT, 'bold');
      doc.setFontSize(9);
      doc.text('Terms and Notes', margin, termsY);
      doc.setFont(REPORT_PDF_FONT, 'normal');
      doc.setFontSize(8.5);
      doc.text(
        [
          '1. This invoice is generated from the approved client quotation details.',
          '2. Official fees are subject to changes by the relevant government office.',
          '3. Thank you for choosing our firm for your intellectual property matters.',
        ],
        margin,
        termsY + 16
      );

      doc.setDrawColor(226, 232, 240);
      doc.line(margin, pageHeight - 42, pageWidth - margin, pageHeight - 42);
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      doc.text(`${company?.companyName || 'AIP&T LAW FIRM'} - ${company?.countryName || countryNames}`, margin, pageHeight - 24);
      doc.text(`Generated ${new Date().toLocaleString()}`, pageWidth - margin, pageHeight - 24, { align: 'right' });

      doc.save(`${toPdfFileName(invoiceNo)}-report.pdf`);
      showSuccessToast('Quotation report PDF downloaded successfully.');
    } catch (err: any) {
      showErrorToast(err?.message || 'Failed to download quotation report PDF.');
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const handleDownloadInvoiceWord = async (quotation: ClientQuotation) => {
    try {
      let companyDetails = invoiceCompanyDetails;
      if (companyDetails.length === 0) {
        const response = await companyDetailsService.list({ page: 1, limit: 1000 });
        companyDetails = Array.isArray(response?.companyDetails) ? response.companyDetails : [];
        setInvoiceCompanyDetails(companyDetails);
      }

      const company = getCompanyDetailForQuotation(quotation, companyDetails);
      const logoDataUrl = await imageUrlToDataUrl(settings?.logoUrl);
      const invoiceNo = quotation.quotationNo || quotation._id;
      const invoiceDate = quotation.createdAt ? new Date(quotation.createdAt).toLocaleDateString() : '-';
      const serviceCategory = quotation.serviceCategory || quotation.inquirySnapshot?.serviceCategory || '-';
      const countryNames = quotation.inquirySnapshot?.countryNames?.join(', ') || '-';
      const isTrademarkInvoice = serviceCategory === 'Trademark';
      const serviceStats = getServiceDetailsStats(quotation);
      const vatHeaderLabel = getInvoiceVatHeaderLabel(quotation);
      const requirementRows = getRequirementDisplayRows(quotation);
      const wordCellStyle = (cellKey: string, defaultBg: string, defaultText: string, align: 'left' | 'right' = 'left') => {
        const { backgroundColor, textColor } = getInvoiceExportCellColors(
          cellKey,
          defaultBg,
          defaultText,
          invoiceCellColors
        );
        return `background:${backgroundColor};color:${textColor};border:1px solid ${normalizeHexColor(invoiceServiceTableColors.borderColor, '#D1D5DB')};padding:9px 10px;text-align:${align};vertical-align:top;font-size:11px;line-height:1.35;`;
      };
      const serviceHeaderHtml = `
        <tr>
          <th style="${wordCellStyle('header-country', invoiceServiceTableColors.headerBg, invoiceServiceTableColors.headerText)}">Country</th>
          <th style="${wordCellStyle('header-procedure', invoiceServiceTableColors.headerBg, invoiceServiceTableColors.headerText)}">Procedure Name</th>
          <th style="${wordCellStyle('header-official', invoiceServiceTableColors.headerBg, invoiceServiceTableColors.headerText, 'right')}">Official Fees</th>
          <th style="${wordCellStyle('header-attorney', invoiceServiceTableColors.headerBg, invoiceServiceTableColors.headerText, 'right')}">Attorney Fees</th>
          <th style="${wordCellStyle('header-discount', invoiceServiceTableColors.headerBg, invoiceServiceTableColors.headerText, 'right')}">Discount</th>
          <th style="${wordCellStyle('header-vat', invoiceServiceTableColors.headerBg, invoiceServiceTableColors.headerText, 'right')}">${escapeHtml(vatHeaderLabel)}</th>
          <th style="${wordCellStyle('header-total', invoiceServiceTableColors.headerBg, invoiceServiceTableColors.headerText, 'right')}">Total</th>
        </tr>
        ${isTrademarkInvoice ? `
          <tr>
            <td style="${wordCellStyle('subheader-country', invoiceServiceTableColors.subHeaderBg, invoiceServiceTableColors.subHeaderText)}"><em>Country</em></td>
            <td style="${wordCellStyle('subheader-procedure', invoiceServiceTableColors.subHeaderBg, invoiceServiceTableColors.subHeaderText)}"><em>Class Type / No. Classes</em></td>
            <td style="${wordCellStyle('subheader-official', invoiceServiceTableColors.subHeaderBg, invoiceServiceTableColors.subHeaderText, 'right')}"><em>per mark per class</em></td>
            <td style="${wordCellStyle('subheader-attorney', invoiceServiceTableColors.subHeaderBg, invoiceServiceTableColors.subHeaderText, 'right')}"><em>per mark per class</em></td>
            <td style="${wordCellStyle('subheader-discount', invoiceServiceTableColors.subHeaderBg, invoiceServiceTableColors.subHeaderText, 'right')}"></td>
            <td style="${wordCellStyle('subheader-vat', invoiceServiceTableColors.subHeaderBg, invoiceServiceTableColors.subHeaderText, 'right')}"></td>
            <td style="${wordCellStyle('subheader-total', invoiceServiceTableColors.subHeaderBg, invoiceServiceTableColors.subHeaderText, 'right')}"><em>per mark per class</em></td>
          </tr>
        ` : ''}
      `;
      const servicesHtml = (quotation.services || [])
        .map((service, index) => {
          const classInfo = isTrademarkInvoice
            ? `${service.classType === 'multi' ? 'Multi' : 'Single'} | ${Math.max(1, Number(service.numberOfClasses || 1))} class${Math.max(1, Number(service.numberOfClasses || 1)) > 1 ? 'es' : ''}`
            : '';
          const baseRowBg =
            index % 2 === 0
              ? invoiceServiceTableColors.rowBg
              : invoiceServiceTableColors.altRowBg;
          return `
            <tr>
              <td style="${wordCellStyle(`row-${index}-country`, baseRowBg, invoiceServiceTableColors.countryColText)}">${escapeHtml(getServiceCountryName(service, quotation) || countryNames)}</td>
              <td style="${wordCellStyle(`row-${index}-procedure`, baseRowBg, invoiceServiceTableColors.procedureColText)}"><span class="procedure-main">${escapeHtml(service.procedureName || '-')}</span>${classInfo ? `<br/><span class="procedure-sub">${escapeHtml(classInfo)}</span>` : ''}</td>
              <td class="money" style="${wordCellStyle(`row-${index}-official`, baseRowBg, invoiceServiceTableColors.officialColText, 'right')}">${toCurrency(service.totalOfficialFees || service.officialFee || 0)}</td>
              <td class="money" style="${wordCellStyle(`row-${index}-attorney`, baseRowBg, invoiceServiceTableColors.attorneyColText, 'right')}">${toCurrency(service.attorneyFee || 0)}</td>
              <td class="money" style="${wordCellStyle(`row-${index}-discount`, baseRowBg, invoiceServiceTableColors.discountColText, 'right')}">${toCurrency(getServiceDiscountAmount(service))}</td>
              <td class="money" style="${wordCellStyle(`row-${index}-vat`, baseRowBg, invoiceServiceTableColors.vatColText, 'right')}">${toCurrency(getServiceVatAmount(service))}</td>
              <td class="money" style="${wordCellStyle(`row-${index}-total`, baseRowBg, invoiceServiceTableColors.totalColText, 'right')}"><strong>${toCurrency(service.grandTotal || 0)}</strong></td>
            </tr>
          `;
        })
        .join('');
      const requirementRowsHtml = requirementRows.length > 0
        ? requirementRows.map((requirement, index) => `
            <tr>
              <td style="${wordCellStyle(`requirement-row-${index}-title`, invoiceServiceTableColors.rowBg, invoiceServiceTableColors.procedureColText)}">${escapeHtml(requirement.title || '-')}</td>
              <td style="${wordCellStyle(`requirement-row-${index}-country`, invoiceServiceTableColors.rowBg, invoiceServiceTableColors.countryColText)}">${escapeHtml(requirement.countryName || '-')}</td>
              <td class="requirement-description" style="${wordCellStyle(`requirement-row-${index}-description`, invoiceServiceTableColors.rowBg, invoiceServiceTableColors.procedureColText)}">${requirement.requirementsHtml || 'No requirement details available.'}</td>
            </tr>
          `).join('')
        : `<tr>
            <td style="${wordCellStyle('requirement-row-title', invoiceServiceTableColors.rowBg, invoiceServiceTableColors.procedureColText)}">-</td>
            <td style="${wordCellStyle('requirement-row-country', invoiceServiceTableColors.rowBg, invoiceServiceTableColors.countryColText)}">${escapeHtml(countryNames || '-')}</td>
            <td class="requirement-description" style="${wordCellStyle('requirement-row-description', invoiceServiceTableColors.rowBg, invoiceServiceTableColors.procedureColText)}">No requirement details available.</td>
          </tr>`;
      const html = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${escapeHtml(invoiceNo)} Report</title>
            <style>
              @page { size: A4 portrait; margin: 18mm; }
              body { font-family: ${REPORT_CSS_FONT_STACK}; color: #0f172a; margin: 0; }
              .page { width: 100%; }
              .hero { background: #0b1739; color: #fff; padding: 28px; border-radius: 14px; }
              .logo { width: 54px; height: 54px; border-radius: 10px; background: #fff; object-fit: contain; }
              .mark { width: 54px; height: 54px; border-radius: 10px; background: #2563eb; color: #fff; text-align: center; font-size: 24px; font-weight: 800; line-height: 54px; }
              .hero h1 { margin: 18px 0 4px; font-size: 26px; letter-spacing: .5px; }
              .meta { color: #dbeafe; font-size: 12px; }
              .layout-table { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; }
              .layout-table td { vertical-align: top; }
              .gap-cell { width: 14px; }
              .panel { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; background: #f8fafc; }
              .panel h2 { font-size: 12px; margin: 0 0 10px; letter-spacing: .08em; text-transform: uppercase; color: #475569; }
              .section-title { font-size: 16px; margin: 0; color: #0f172a; font-weight: 800; }
              .section-note { margin: 4px 0 0; color: #64748b; font-size: 11px; }
              .section-kicker { color: #2563eb; font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 3px; }
              .service-heading { width: 100%; border-collapse: separate; border-spacing: 0; margin: 18px 0 8px; border-left: 5px solid ${normalizeHexColor(invoiceServiceTableColors.headerBg, '#EEF2FF')}; background: #f8fafc; }
              .service-heading td { padding: 12px; vertical-align: middle; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
              .service-heading td:first-child { border-left: 1px solid #e2e8f0; }
              .service-heading td:last-child { border-right: 1px solid #e2e8f0; }
              .summary-table { width: 100%; border-collapse: collapse; font-size: 10.5px; color: #334155; }
              .summary-table td { border: 1px solid #e2e8f0; padding: 6px 8px; background: #fff; text-align: center; }
              .summary-table strong { display: block; color: #0f172a; font-size: 12px; }
              p { margin: 4px 0; font-size: 12px; }
              .service-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 0; font-size: 11px; page-break-inside: avoid; border: 1px solid ${normalizeHexColor(invoiceServiceTableColors.borderColor, '#D1D5DB')}; }
              .service-table th { font-weight: 800; text-transform: uppercase; letter-spacing: .02em; }
              .service-table td, .service-table th { word-break: normal; overflow-wrap: break-word; }
              .procedure-main { font-weight: 800; color: inherit; }
              .procedure-sub { color: inherit; opacity: .78; font-size: 10px; }
              .requirement-description p { margin: 0 0 7px; }
              .requirement-description p:last-child { margin-bottom: 0; }
              .requirement-description ul, .requirement-description ol { margin: 4px 0 4px 18px; padding: 0; }
              .requirement-description table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 8px 0; }
              .requirement-description td, .requirement-description th { border: 1px solid ${normalizeHexColor(invoiceServiceTableColors.borderColor, '#D1D5DB')}; padding: 6px 8px; vertical-align: top; word-break: normal; overflow-wrap: break-word; }
              .requirement-description th { background: ${normalizeHexColor(invoiceServiceTableColors.subHeaderBg, '#F8FAFC')}; font-weight: 700; }
              .money { font-variant-numeric: tabular-nums; white-space: nowrap; }
              .footer { margin-top: 22px; color: #64748b; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
            </style>
          </head>
          <body>
            <div class="page">
              <div class="hero">
                <table class="layout-table">
                  <tr>
                    <td style="width:66px;">${logoDataUrl ? `<img class="logo" src="${logoDataUrl}" />` : '<div class="mark">A</div>'}</td>
                    <td>
                      <strong>${escapeHtml(company?.companyName || settings?.companyName || 'AIP&T LAW FIRM')}</strong>
                      <div class="meta">${escapeHtml(company?.address || settings?.companyAddress || 'Professional IP legal services')}</div>
                      <div class="meta">${escapeHtml(company?.email || settings?.companyEmail || '')} ${escapeHtml(company?.contact || settings?.companyPhone || '')}</div>
                    </td>
                  </tr>
                </table>
                <h1>${CLIENT_QUOTATION_REPORT_TITLE}</h1>
                <div class="meta">Quotation No: ${escapeHtml(invoiceNo)} | Date: ${escapeHtml(invoiceDate)} | Status: ${escapeHtml(quotation.status || 'Submitted')}</div>
              </div>
              <table class="layout-table" style="margin:18px 0;">
                <tr>
                  <td>
                    <div class="panel">
                      <h2>Bill To</h2>
                      <p><strong>${escapeHtml(quotation.clientSnapshot?.name || 'Client')}</strong></p>
                      <p>${escapeHtml(quotation.clientSnapshot?.email || '-')}</p>
                      <p>${escapeHtml(quotation.clientSnapshot?.phone || '-')}</p>
                      <p>${escapeHtml(quotation.clientSnapshot?.country || '-')}</p>
                    </div>
                  </td>
                  <td class="gap-cell"></td>
                  <td>
                    <div class="panel">
                      <h2>Project Details</h2>
                      <p><strong>Inquiry:</strong> ${escapeHtml(quotation.inquirySnapshot?.referenceNo || quotation.inquiryProjects?.join(', ') || '-')}</p>
                      <p><strong>Service:</strong> ${escapeHtml(String(serviceCategory))}</p>
                      <p><strong>Procedure:</strong> ${escapeHtml(quotation.inquirySnapshot?.procedureName || '-')}</p>
                      <p><strong>Country:</strong> ${escapeHtml(countryNames)}</p>
                    </div>
                  </td>
                </tr>
              </table>
              <table class="service-heading">
                <tr>
                  <td style="width:56%;">
                    <div class="section-kicker">Fee Schedule</div>
                    <h2 class="section-title">Service Details</h2>
                    <p class="section-note">Professional breakdown of country, procedure, official fees, attorney fees, discounts, VAT, and totals.</p>
                  </td>
                  <td>
                    <table class="summary-table">
                      <tr>
                        <td><strong>${serviceStats.serviceCount}</strong>Services</td>
                        <td><strong>${serviceStats.countryCount}</strong>Countries</td>
                        <td><strong>${toCurrency(serviceStats.grandTotal)}</strong>Grand Total</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table class="service-table">
                <colgroup>
                  <col style="width:13%;" />
                  <col style="width:27%;" />
                  <col style="width:12%;" />
                  <col style="width:12%;" />
                  <col style="width:11%;" />
                  <col style="width:10%;" />
                  <col style="width:15%;" />
                </colgroup>
                <thead>${serviceHeaderHtml}</thead>
                <tbody>
                  ${servicesHtml || `<tr><td colspan="7" style="${wordCellStyle('row-0-procedure', invoiceServiceTableColors.rowBg, invoiceServiceTableColors.procedureColText)}">No service details available.</td></tr>`}
                  <tr>
                    <td style="${wordCellStyle('grand-country', invoiceServiceTableColors.totalRowBg, invoiceServiceTableColors.totalRowText)}"><strong>Grand Total</strong></td>
                    <td style="${wordCellStyle('grand-procedure', invoiceServiceTableColors.totalRowBg, invoiceServiceTableColors.totalRowText)}"></td>
                    <td style="${wordCellStyle('grand-official', invoiceServiceTableColors.totalRowBg, invoiceServiceTableColors.totalRowText, 'right')}"><strong>${toCurrency(quotation.totalOfficialFees || 0)}</strong></td>
                    <td style="${wordCellStyle('grand-attorney', invoiceServiceTableColors.totalRowBg, invoiceServiceTableColors.totalRowText, 'right')}"><strong>${toCurrency(quotation.totalAttorneyFees || 0)}</strong></td>
                    <td style="${wordCellStyle('grand-discount', invoiceServiceTableColors.totalRowBg, invoiceServiceTableColors.totalRowText, 'right')}"><strong>${toCurrency(quotation.totalDiscount || 0)}</strong></td>
                    <td style="${wordCellStyle('grand-vat', invoiceServiceTableColors.totalRowBg, invoiceServiceTableColors.totalRowText, 'right')}"><strong>${toCurrency(quotation.totalVatFees || 0)}</strong></td>
                    <td style="${wordCellStyle('grand-total', invoiceServiceTableColors.totalRowBg, invoiceServiceTableColors.totalRowText, 'right')}"><strong>${toCurrency(quotation.grandTotal || 0)}</strong></td>
                  </tr>
                </tbody>
              </table>
              <h2 class="section-title" style="margin:18px 0 8px;">Requirement Details</h2>
              <table class="service-table">
                <colgroup>
                  <col style="width:24%;" />
                  <col style="width:20%;" />
                  <col style="width:56%;" />
                </colgroup>
                <thead>
                  <tr>
                    <th style="${wordCellStyle('requirement-header-title', invoiceServiceTableColors.headerBg, invoiceServiceTableColors.headerText)}">Title</th>
                    <th style="${wordCellStyle('requirement-header-country', invoiceServiceTableColors.headerBg, invoiceServiceTableColors.headerText)}">Country</th>
                    <th style="${wordCellStyle('requirement-header-description', invoiceServiceTableColors.headerBg, invoiceServiceTableColors.headerText)}">Description</th>
                  </tr>
                </thead>
                <tbody>
                  ${requirementRowsHtml}
                </tbody>
              </table>
              <div class="footer">
                Official fees are subject to changes by the relevant government office. Thank you for choosing our firm.
              </div>
            </div>
          </body>
        </html>
      `;
      const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${toPdfFileName(invoiceNo)}-report.doc`;
      anchor.click();
      URL.revokeObjectURL(url);
      showSuccessToast('Quotation report Word document downloaded successfully.');
    } catch (err: any) {
      showErrorToast(err?.message || 'Failed to download quotation report Word document.');
    }
  };

  const handleUpdateStatus = async (row: ClientQuotation, status: ClientQuotationStatus) => {
    const canApplyStatus =
      status === 'Approved'
        ? canApproveClientQuotation
        : status === 'Rejected'
          ? canRejectClientQuotation
          : canManageClientQuotationApproval;
    if (!canApplyStatus) {
      notifyValidationError(`You do not have permission to ${status.toLowerCase()} client quotations.`);
      return;
    }
    setStatusUpdatingId(row._id);
    try {
      await clientQuotationsService.updateStatus(row._id, status);
      notifySuccess(`Client quotation ${status.toLowerCase()} successfully.`);
      await loadData();
    } catch (err: any) {
      notifyApiError(getApiErrorMessage(err, `Failed to ${status.toLowerCase()} quotation.`));
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const columns: MuiDataTableColumn<ClientQuotation>[] = [
    { id: 'inquiry', label: 'Inquiry Project', render: (r) => r.inquirySnapshot?.referenceNo || r.inquiryProjects?.join(', ') || '-' },
    {
      id: 'service',
      label: 'Service',
      render: (r) => {
        const service = (r.serviceCategory || r.inquirySnapshot?.serviceCategory || '-') as ServiceCategory;
        const color = SERVICE_COLOR_MAP[service];
        if (!color) return service;
        return (
          <Box
            component="span"
            sx={{ px: 1.2, py: 0.4, borderRadius: 999, color, bgcolor: `${color}1A`, fontWeight: 700, fontSize: 12 }}
          >
            {service}
          </Box>
        );
      },
    },
    { id: 'procedure', label: 'Procedure', render: (r) => <span style={{ color: '#7E57C2' }}>{r.inquirySnapshot?.procedureName || '-'}</span> },
    { id: 'client', label: 'Client', render: (r) => r.clientSnapshot?.name || (typeof r.clientId === 'object' ? r.clientId?.name : '-') || '-' },
    { id: 'country', label: 'Country', render: (r) => r.inquirySnapshot?.countryNames?.join(', ') || '-' },
    { id: 'official', label: 'Official Fees', align: 'right', render: (r) => toCurrency(r.totalOfficialFees || 0) },
    ...(activeTab === 'Trademark' ? [{ id: 'classType', label: 'Class Type', render: (r: ClientQuotation) => r.services?.[0]?.classType || '-' } as MuiDataTableColumn<ClientQuotation>] : []),
    { id: 'attorney', label: 'Attorney Fees', align: 'right', render: (r) => toCurrency(r.totalAttorneyFees || 0) },
    { id: 'total', label: 'Total', align: 'right', render: (r) => toCurrency(r.grandTotal || 0) },
    {
      id: 'status',
      label: 'Status',
      render: (r) => {
        const status = (r.status || 'Submitted') as ClientQuotationStatus;
        const statusColor = STATUS_COLOR_MAP[status] || STATUS_COLOR_MAP.Submitted;
        return (
          <Box
            component="span"
            sx={{
              px: 1.2,
              py: 0.4,
              borderRadius: 999,
              color: statusColor.color,
              bgcolor: statusColor.bg,
              fontWeight: 700,
              fontSize: 12,
              whiteSpace: 'nowrap',
            }}
          >
            {status}
          </Box>
        );
      },
      sortValue: (r) => r.status || 'Submitted',
      searchValue: (r) => r.status || 'Submitted',
    },
    { id: 'date', label: 'Date', render: (r) => new Date(r.createdAt).toLocaleDateString() },
    {
      id: 'actions',
      label: 'Action',
      align: 'right',
      sortable: false,
      render: (row) => (
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Tooltip title="View">
            <IconButton size="small" onClick={() => { setViewingItem(row); setViewDialogOpen(true); }} sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } }}>
              <EyeIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download Report PDF">
            <span>
              <IconButton
                size="small"
                disabled={downloadingPdfId === row._id}
                onClick={() => handleDownloadInvoicePdf(row)}
                sx={{ bgcolor: '#0F172A', color: '#fff', '&:hover': { bgcolor: '#1E293B' }, '&.Mui-disabled': { bgcolor: 'action.disabledBackground' } }}
              >
                <PdfIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => handleOpenEdit(row)} sx={{ bgcolor: 'success.main', color: 'success.contrastText', '&:hover': { bgcolor: 'success.dark' } }}>
              <NoteIcon />
            </IconButton>
          </Tooltip>
          {canApproveClientQuotation && (
              <Tooltip title="Approve">
                <span>
                  <IconButton
                    size="small"
                    disabled={row.status === 'Approved' || statusUpdatingId === row._id}
                    onClick={() => handleUpdateStatus(row, 'Approved')}
                    sx={{ bgcolor: 'success.light', color: 'success.contrastText', '&:hover': { bgcolor: 'success.main' }, '&.Mui-disabled': { bgcolor: 'action.disabledBackground' } }}
                  >
                    <CheckIcon />
                  </IconButton>
                </span>
              </Tooltip>
          )}
          {canRejectClientQuotation && (
              <Tooltip title="Reject">
                <span>
                  <IconButton
                    size="small"
                    disabled={row.status === 'Rejected' || statusUpdatingId === row._id}
                    onClick={() => handleUpdateStatus(row, 'Rejected')}
                    sx={{ bgcolor: 'warning.main', color: 'warning.contrastText', '&:hover': { bgcolor: 'warning.dark' }, '&.Mui-disabled': { bgcolor: 'action.disabledBackground' } }}
                  >
                    <CloseIcon />
                  </IconButton>
                </span>
              </Tooltip>
          )}
          <Tooltip title="Delete">
            <IconButton size="small" onClick={() => { setDeletingId(row._id); setDeleteDialogOpen(true); }} sx={{ bgcolor: 'error.main', color: 'error.contrastText', '&:hover': { bgcolor: 'error.dark' } }}>
              <TrashIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  const resetForm = () => {
    setEditingId(null);
    setSelectedClientId('');
    setSelectedInquiryId('');
    setSelectedRequirementIds([]);
    setSelectedRequirementCountryId('');
    setRequirementDraftIds([]);
    setRequirementEditorOpen(false);
    setEditingRequirementId(null);
    setRequirementEditorData(defaultRequirementEditorData);
    setRequirementEditorLoading(false);
    setRequirementEditorSaving(false);
    setRequirementEditorError('');
    clearRequirementAutosaveTimers();
    setRequirementAutosaveState({});
    setServiceDraft(defaultServiceDraft);
    setServiceCountrySelections([]);
    setServices([]);
    setEditingServiceIndex(null);
    setEditingServiceDraft(null);
    setRequirementsState({
      loading: false,
      error: '',
      countryNames: '',
      serviceCategory: '',
      items: [],
    });
    setPriceRuleDialogOpen(false);
    setPriceRulesLoading(false);
    setPriceRulesError('');
    setPriceRules([]);
    setPriceRuleCountryFilter('');
    setSelectedPriceRuleId('');
  };

  const handleOpenCreate = () => {
    resetForm();
    setOpenForm(true);
  };

  const handleOpenEdit = (row: ClientQuotation) => {
    const quotationCountry = row.inquirySnapshot?.countryNames?.[0] || row.inquirySnapshot?.countryNames?.join(', ') || '';
    const quotationCountries = row.inquirySnapshot?.countryNames || [];
    setEditingId(row._id);
    setSelectedClientId(typeof row.clientId === 'object' ? row.clientId?._id || '' : (row.clientId || ''));
    setSelectedInquiryId(
      typeof row.inquiryId === 'object' ? row.inquiryId?._id || '' : (row.inquiryId || '')
    );
    setSelectedRequirementIds(getQuotationRequirementIds(row));
    setSelectedRequirementCountryId('');
    setRequirementDraftIds([]);
    setServices(
      Array.isArray(row.services)
        ? row.services.map((service) => ({
            ...service,
            countryName: service.countryName || quotationCountry,
          }))
        : []
    );
    setServiceDraft({ ...defaultServiceDraft, countryName: quotationCountry });
    setServiceCountrySelections(quotationCountries.length > 1 ? [] : quotationCountries.filter(Boolean));
    setEditingServiceIndex(null);
    setEditingServiceDraft(null);
    setActiveTab((row.serviceCategory || row.inquirySnapshot?.serviceCategory || 'Trademark') as ServiceCategory);
    setOpenForm(true);
  };

  const handleAddRequirementsToCart = () => {
    if (requirementDraftIds.length === 0) {
      notifyValidationError('Select at least one requirement title first.');
      return;
    }
    setSelectedRequirementIds((prev) => Array.from(new Set([...prev, ...requirementDraftIds])));
    setRequirementDraftIds([]);
  };

  const handleEditRequirementInCart = async (requirement: RequirementOption) => {
    if (requirement.countryId) {
      setSelectedRequirementCountryId(requirement.countryId);
    }
    setEditingRequirementId(requirement._id);
    setRequirementEditorData({
      country: requirement.countryId || '',
      countryName: requirement.countryName || '',
      serviceCategory: requirement.serviceCategory || serviceCategory || '',
      title: requirement.title || '',
      requirements: requirement.requirements || '',
    });
    setRequirementEditorError('');
    setRequirementEditorOpen(true);
    setRequirementEditorLoading(true);

    try {
      const response = await requirementsService.getById(requirement._id);
      setRequirementEditorData({
        country: response.data.country?._id || requirement.countryId || '',
        countryName: response.data.country?.name || requirement.countryName || '',
        serviceCategory: response.data.serviceCategory || requirement.serviceCategory || serviceCategory || '',
        title: response.data.title || '',
        requirements: response.data.requirements || '',
      });
    } catch (err: any) {
      setRequirementEditorError(
        err?.response?.data?.error || err?.message || 'Failed to load latest requirement details.'
      );
    } finally {
      setRequirementEditorLoading(false);
    }
  };

  const handleCloseRequirementEditor = () => {
    setRequirementEditorOpen(false);
    setEditingRequirementId(null);
    setRequirementEditorData(defaultRequirementEditorData);
    setRequirementEditorError('');
    setRequirementEditorLoading(false);
    setRequirementEditorSaving(false);
  };

  const handleSaveRequirementEditor = async () => {
    if (!editingRequirementId) return;
    if (
      !requirementEditorData.country ||
      !requirementEditorData.serviceCategory ||
      !requirementEditorData.title.trim() ||
      !stripHtml(requirementEditorData.requirements)
    ) {
      setRequirementEditorError('Title and requirement details are required.');
      return;
    }

    try {
      setRequirementEditorSaving(true);
      setRequirementEditorError('');
      const response = await requirementsService.update(editingRequirementId, {
        country: requirementEditorData.country,
        serviceCategory: requirementEditorData.serviceCategory as ServiceCategory,
        title: requirementEditorData.title.trim(),
        requirements: requirementEditorData.requirements,
      });
      const updatedRequirement = response.data;
      setRequirementsState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item._id === editingRequirementId
            ? {
                ...item,
                countryId: updatedRequirement.country?._id || requirementEditorData.country,
                countryName: updatedRequirement.country?.name || requirementEditorData.countryName,
                serviceCategory: updatedRequirement.serviceCategory || requirementEditorData.serviceCategory || undefined,
                title: updatedRequirement.title || '',
                requirements: updatedRequirement.requirements || '',
              }
            : item
        ),
      }));
      notifySuccess('Requirement details updated in Requirements database.');
      handleCloseRequirementEditor();
    } catch (err: any) {
      setRequirementEditorError(
        err?.response?.data?.error || err?.message || 'Failed to update requirement details.'
      );
    } finally {
      setRequirementEditorSaving(false);
    }
  };

  const handleRemoveRequirementFromCart = (requirementId: string) => {
    const existingTimer = requirementAutosaveTimersRef.current[requirementId];
    if (existingTimer) {
      window.clearTimeout(existingTimer);
      delete requirementAutosaveTimersRef.current[requirementId];
    }
    setRequirementAutosaveState((prev) => {
      const next = { ...prev };
      delete next[requirementId];
      return next;
    });
    setSelectedRequirementIds((prev) => prev.filter((id) => id !== requirementId));
    setRequirementDraftIds((prev) => prev.filter((id) => id !== requirementId));
  };

  const handleAddService = () => {
    if (!serviceDraft.procedureName.trim()) {
      notifyValidationError('Procedure is required.');
      return;
    }
    const allowedCountryNames = new Set(inquiryCountries.map((country) => country.trim().toLowerCase()));
    const countryTargets = getServiceCountryTargets();
    if (countryTargets.length === 0) {
      notifyValidationError('Select at least one service country.');
      return;
    }
    const invalidCountry = countryTargets.find(
      (country) => allowedCountryNames.size > 0 && !allowedCountryNames.has(country.trim().toLowerCase())
    );
    if (invalidCountry) {
      notifyValidationError(`Service country must match the selected inquiry countries: ${invalidCountry}`);
      return;
    }
    const feeErrors = validateServiceFees(serviceDraft);
    if (feeErrors.length > 0) {
      notifyValidationError(feeErrors[0]);
      return;
    }
    if (editingServiceIndex !== null) {
      notifyValidationError('Save or cancel current row editing before adding a new row.');
      return;
    }
    const nextDraft = {
      ...serviceDraft,
      countryName: '',
    };
    setServices((prev) => [
      ...prev,
      ...countryTargets.map((countryName) =>
        computeClientRow({ ...nextDraft, countryName }, serviceCategory)
      ),
    ]);
    setServiceDraft((prev) => ({
      ...defaultServiceDraft,
      procedureName: prev.procedureName,
      countryName: isInternationalInquiry ? '' : resolveServiceCountryName(prev.countryName),
    }));
  };

  const handleSelectServiceProcedure = (procedureName: string) => {
    const normalizedProcedure = procedureName.trim();
    setServiceDraft((prev) => ({ ...prev, procedureName: normalizedProcedure }));
  };

  const handleStartEditService = (index: number) => {
    const row = services[index];
    if (!row) return;
    setEditingServiceIndex(index);
    setEditingServiceDraft(toServiceDraftFromRow(row, serviceCategory));
  };

  const handleCancelEditService = () => {
    setEditingServiceIndex(null);
    setEditingServiceDraft(null);
  };

  const handleSaveEditService = () => {
    if (editingServiceIndex === null || !editingServiceDraft) return;
    if (!editingServiceDraft.procedureName.trim()) {
      notifyValidationError('Procedure is required.');
      return;
    }
    const allowedCountryNames = new Set(inquiryCountries.map((country) => country.trim().toLowerCase()));
    if (
      allowedCountryNames.size > 0 &&
      !allowedCountryNames.has(resolveServiceCountryName(editingServiceDraft.countryName).trim().toLowerCase())
    ) {
      notifyValidationError('Service row country must match the selected inquiry countries.');
      return;
    }
    const feeErrors = validateServiceFees(editingServiceDraft);
    if (feeErrors.length > 0) {
      notifyValidationError(feeErrors[0]);
      return;
    }

    const normalizedDraft: ServiceDraft = {
      procedureName: editingServiceDraft.procedureName.trim(),
      countryName: resolveServiceCountryName(editingServiceDraft.countryName),
      classType: editingServiceDraft.classType === 'multi' ? 'multi' : 'single',
      numberOfClasses:
        editingServiceDraft.classType === 'multi'
          ? Math.max(1, Math.floor(Number(editingServiceDraft.numberOfClasses || 1)))
          : 1,
      additionalFeePerClass:
        editingServiceDraft.classType === 'multi'
          ? Math.max(0, Number(editingServiceDraft.additionalFeePerClass || 0))
          : 0,
      officialFee: Math.max(0, Number(editingServiceDraft.officialFee || 0)),
      attorneyFee: Math.max(0, Number(editingServiceDraft.attorneyFee || 0)),
      otherFees: Math.max(0, Number(editingServiceDraft.otherFees || 0)),
      vatFee: Math.max(0, Number(editingServiceDraft.vatFee || 0)),
      discount: Math.max(0, Number(editingServiceDraft.discount || 0)),
    };

    setServices((prev) =>
      prev.map((row, index) =>
        index === editingServiceIndex ? computeClientRow(normalizedDraft, serviceCategory) : row
      )
    );
    handleCancelEditService();
  };

  const handleRemoveService = (index: number) => {
    if (editingServiceIndex === index) {
      setEditingServiceIndex(null);
      setEditingServiceDraft(null);
    } else if (editingServiceIndex !== null && editingServiceIndex > index) {
      setEditingServiceIndex(editingServiceIndex - 1);
    }
    setServices((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = async () => {
    if (!selectedClientId) {
      notifyValidationError('Client is required.');
      return;
    }
    if (!selectedInquiryId) {
      notifyValidationError('Inquiry project is required.');
      return;
    }
    if (usedInquiryIds.has(selectedInquiryId)) {
      notifyValidationError('This inquiry project already has a client quotation.');
      return;
    }
    if (editingServiceIndex !== null) {
      notifyValidationError('Save or cancel current row editing before submitting.');
      return;
    }
    if (requirementsState.items.length > 0 && selectedRequirementIds.length === 0) {
      notifyValidationError('Select at least one requirement title.');
      return;
    }
    try {
      await flushSelectedRequirementAutosaves();
    } catch (err: any) {
      notifyApiError(err?.response?.data?.error || err?.message || 'Failed to autosave requirement details.');
      return;
    }
    if (services.length === 0) {
      notifyValidationError('Add at least one service row.');
      return;
    }
    const allowedCountryNames = new Set(inquiryCountries.map((country) => country.trim().toLowerCase()));
    const invalidServiceCountry = services.find(
      (service) =>
        allowedCountryNames.size > 0 &&
        !allowedCountryNames.has(resolveServiceCountryName(service.countryName).trim().toLowerCase())
    );
    if (invalidServiceCountry) {
      notifyValidationError('Every service row country must match the selected inquiry countries.');
      return;
    }
    const rowValidationError = services
      .map((service) => validateServiceFees(toServiceDraftFromRow(service, serviceCategory)))
      .find((errors) => errors.length > 0)?.[0];
    if (rowValidationError) {
      notifyValidationError(rowValidationError);
      return;
    }

    try {
      const payload = {
        clientId: selectedClientId,
        inquiryId: selectedInquiryId,
        requirementId: selectedRequirementIds[0] || undefined,
        requirementIds: selectedRequirementIds,
        services: services.map((s) => ({
          procedureName: s.procedureName,
          countryName: resolveServiceCountryName(s.countryName),
          classType: s.classType,
          numberOfClasses: s.numberOfClasses,
          additionalFeePerClass: s.additionalFeePerClass,
          officialFee: s.officialFee,
          attorneyFee: s.attorneyFee,
          otherFees: s.otherFees,
          vatFee: s.vatFee || 0,
          discount: s.discount,
        })),
      };
      let saved: ClientQuotation;
      if (editingId) {
        saved = await clientQuotationsService.update(editingId, payload);
        notifySuccess('Client quotation updated successfully.');
      } else {
        saved = await clientQuotationsService.create(payload);
        notifySuccess('Client quotation saved successfully.');
      }
      const savedCategory = (saved.serviceCategory || saved.inquirySnapshot?.serviceCategory || serviceCategory) as ServiceCategory;
      setActiveTab(savedCategory);
      setTableSearch('');
      setOpenForm(false);
      resetForm();
      setPage(1);
      await loadData();
    } catch (err: any) {
      notifyApiError(getApiErrorMessage(err, 'Failed to save quotation.'));
    }
  };

  useEffect(() => {
    let cancelled = false;

    const fetchRequirements = async () => {
      if (!selectedInquiry) {
        clearRequirementAutosaveTimers();
        setRequirementAutosaveState({});
        setRequirementsState({
          loading: false,
          error: '',
          countryNames: '',
          serviceCategory: '',
          items: [],
        });
        setSelectedRequirementIds([]);
        setSelectedRequirementCountryId('');
        setRequirementDraftIds([]);
        return;
      }

      const selectedCountryOptions = getInquiryCountryOptions(selectedInquiry);
      const countryNames = selectedCountryOptions.map((country) => country.name).filter(Boolean).join(', ');
      const selectedServiceCategory = ((selectedInquiry.serviceId as any)?.category || '') as string;
      clearRequirementAutosaveTimers();
      setRequirementAutosaveState({});
      setRequirementsState({
        loading: true,
        error: '',
        countryNames,
        serviceCategory: selectedServiceCategory,
        items: [],
      });

      try {
        const countryIds = selectedCountryOptions.map((country) => country._id).filter(Boolean);
        const requirementsAcc: RequirementOption[] = [];
        for (const countryId of countryIds) {
          const response = await requirementsService.list({
            page: 1,
            limit: 1000,
            countryId,
            serviceCategory: (selectedServiceCategory || undefined) as ServiceCategory | undefined,
          });
          const rows = Array.isArray(response.data?.data) ? response.data.data : [];
          rows.forEach((row: any) => {
            requirementsAcc.push({
              _id: row._id,
              countryId: typeof row.country === 'string' ? row.country : row.country?._id || '',
              countryName: row.country?.name || '',
              serviceCategory: row.serviceCategory,
              title: row.title || '',
              requirements: row.requirements || '',
            });
          });
        }

        if (cancelled) return;
        setRequirementsState({
          loading: false,
          error: '',
          countryNames,
          serviceCategory: selectedServiceCategory,
          items: requirementsAcc,
        });
        setSelectedRequirementIds((prev) => {
          const availableIds = new Set(requirementsAcc.map((requirement) => requirement._id));
          return prev.filter((id) => availableIds.has(id));
        });
        setRequirementDraftIds((prev) => {
          const availableIds = new Set(requirementsAcc.map((requirement) => requirement._id));
          return prev.filter((id) => availableIds.has(id));
        });
        setSelectedRequirementCountryId((prev) => {
          const validCountryIds = new Set(selectedCountryOptions.map((country) => country._id));
          if (prev && validCountryIds.has(prev)) return prev;
          return selectedCountryOptions[0]?._id || '';
        });
      } catch {
        if (cancelled) return;
        setRequirementsState({
          loading: false,
          error: 'Failed to load requirements',
          countryNames,
          serviceCategory: selectedServiceCategory,
          items: [],
        });
        setSelectedRequirementIds([]);
        setSelectedRequirementCountryId('');
        setRequirementDraftIds([]);
      }
    };

    fetchRequirements().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [clearRequirementAutosaveTimers, selectedInquiry]);

  useEffect(() => {
    let cancelled = false;

    const fetchPriceRules = async () => {
      if (!selectedInquiry) {
        setPriceRules([]);
        setSelectedPriceRuleId('');
        setPriceRulesError('');
        return;
      }

      setPriceRulesLoading(true);
      setPriceRulesError('');
      try {
        const countryFilter = priceRuleCountryFilter || (!isInternationalInquiry ? inquiryCountries[0] : '');
        if (!countryFilter) {
          setPriceRules([]);
          setSelectedPriceRuleId('');
          return;
        }
        const response = await pricingRulesService.list({
          page: 1,
          limit: 1000,
          category: serviceCategory,
          country: countryFilter,
          status: 'active',
        });
        if (cancelled) return;
        setPriceRules(response.pricingRules || []);
        setSelectedPriceRuleId((prev) => prev || response.pricingRules?.[0]?._id || '');
      } catch (err: any) {
        if (cancelled) return;
        setPriceRules([]);
        setSelectedPriceRuleId('');
        setPriceRulesError(err.response?.data?.error || err.message || 'Failed to load price rules');
      } finally {
        if (!cancelled) setPriceRulesLoading(false);
      }
    };

    fetchPriceRules().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [inquiryCountries, isInternationalInquiry, priceRuleCountryFilter, selectedInquiry, serviceCategory]);

  const handleOpenPriceRules = () => {
    if (!selectedInquiry) {
      notifyValidationError('Select inquiry project first.');
      return;
    }
    if (!serviceDraft.procedureName.trim() && serviceDetailProcedureOptions.length > 0) {
      setServiceDraft((prev) => ({
        ...prev,
        procedureName: serviceDetailProcedureOptions[0],
      }));
    }
    setPriceRuleCountryFilter(serviceCountrySelections[0] || inquiryCountries[0] || '');
    setSelectedPriceRuleId('');
    setPriceRuleDialogOpen(true);
  };

  const handleApplyPriceRule = () => {
    if (!selectedPriceRule) {
      notifyValidationError('Select a price rule.');
      return;
    }
    if (
      serviceDraft.procedureName.trim() &&
      normalizeProcedureName(selectedPriceRule.procedureName || '') !==
        normalizeProcedureName(serviceDraft.procedureName)
    ) {
      notifyValidationError('Price rule procedure must match Service Details procedure.');
      return;
    }
    const ruleCountryName = resolveServiceCountryName(selectedPriceRule.countryName);
    setServiceDraft((prev) => ({
      ...prev,
      procedureName: selectedPriceRule.procedureName || prev.procedureName,
      countryName: ruleCountryName,
      officialFee: Math.max(0, Number(selectedPriceRule.officialFee || 0)),
      attorneyFee: Math.max(0, Number(selectedPriceRule.attorneyFee || 0)),
      additionalFeePerClass:
        prev.classType === 'multi' ? Math.max(0, Number(selectedPriceRule.classFee || 0)) : 0,
    }));
    if (ruleCountryName) {
      setServiceCountrySelections([ruleCountryName]);
      setPriceRuleCountryFilter(ruleCountryName);
    }
    setPriceRuleDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await clientQuotationsService.delete(deletingId);
      notifySuccess('Client quotation deleted successfully.');
      setDeleteDialogOpen(false);
      setDeletingId(null);
      await loadData();
    } catch (err: any) {
      notifyApiError(getApiErrorMessage(err, 'Failed to delete quotation.'));
    }
  };

  const viewingServiceStats = viewingItem ? getServiceDetailsStats(viewingItem) : null;

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <GlobalStyles
        styles={{
          '@page': {
            size: 'A4 portrait',
            margin: '12mm',
          },
          '@media print': {
            'body *': {
              visibility: 'hidden',
            },
            '.client-quotation-invoice-print, .client-quotation-invoice-print *': {
              visibility: 'visible',
              boxSizing: 'border-box',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact',
            },
            '.client-quotation-invoice-print': {
              position: 'absolute',
              left: 0,
              top: 0,
              width: '210mm',
              minHeight: '297mm',
              fontFamily: `${REPORT_CSS_FONT_STACK} !important`,
              color: '#0F172A !important',
              padding: '0 !important',
              margin: '0 !important',
              backgroundColor: '#fff !important',
              border: '0 !important',
              borderRadius: '0 !important',
              boxShadow: 'none !important',
            },
            '.client-quotation-invoice-print .invoice-print-hidden': {
              display: 'none !important',
            },
            '.client-quotation-invoice-print .MuiCard-root': {
              breakInside: 'avoid',
              pageBreakInside: 'avoid',
            },
            '.client-quotation-invoice-print .MuiTypography-root, .client-quotation-invoice-print .MuiTableCell-root': {
              fontFamily: 'inherit !important',
            },
            '.client-quotation-invoice-print .MuiTableContainer-root': {
              overflow: 'visible !important',
            },
            '.client-quotation-invoice-print table': {
              tableLayout: 'fixed',
              width: '100% !important',
            },
            '.client-quotation-invoice-print .MuiTableCell-root': {
              wordBreak: 'normal',
              overflowWrap: 'break-word',
              padding: '8px !important',
            },
            '.client-quotation-invoice-print .invoice-service-card': {
              border: '1px solid #D7DDE7 !important',
              boxShadow: 'none !important',
            },
            '.client-quotation-invoice-print .invoice-service-heading': {
              backgroundColor: '#F8FAFC !important',
              border: '1px solid #E2E8F0 !important',
              borderLeft: `5px solid ${invoiceServiceTableColors.headerBg} !important`,
            },
            '.client-quotation-invoice-print .invoice-service-table th': {
              fontSize: '10px !important',
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
            },
            '.client-quotation-invoice-print .invoice-service-table td': {
              fontSize: '10.5px !important',
            },
            '.client-quotation-invoice-print .invoice-requirements-card': {
              breakInside: 'auto !important',
              pageBreakInside: 'auto !important',
              border: '1px solid #D7DDE7 !important',
              boxShadow: 'none !important',
            },
            '.client-quotation-invoice-print .invoice-requirements-table th': {
              fontSize: '10px !important',
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
            },
            '.client-quotation-invoice-print .invoice-requirements-table td': {
              fontSize: '10.5px !important',
              verticalAlign: 'top',
            },
            '.client-quotation-invoice-print .invoice-requirement-description p': {
              margin: '0 0 6px !important',
            },
            '.client-quotation-invoice-print .invoice-requirement-description p:last-child': {
              marginBottom: '0 !important',
            },
            '.client-quotation-invoice-print .invoice-requirement-description ul, .client-quotation-invoice-print .invoice-requirement-description ol': {
              margin: '4px 0 4px 18px !important',
              padding: '0 !important',
            },
            '.client-quotation-invoice-print .invoice-requirement-description table': {
              width: '100% !important',
              borderCollapse: 'collapse !important',
              tableLayout: 'fixed',
              margin: '8px 0 !important',
            },
            '.client-quotation-invoice-print .invoice-requirement-description td, .client-quotation-invoice-print .invoice-requirement-description th': {
              border: `1px solid ${invoiceServiceTableColors.borderColor} !important`,
              padding: '6px 8px !important',
              verticalAlign: 'top',
              wordBreak: 'normal',
              overflowWrap: 'break-word',
            },
            '.client-quotation-invoice-print .invoice-requirement-description th': {
              backgroundColor: `${invoiceServiceTableColors.subHeaderBg} !important`,
              fontWeight: 700,
            },
            '.client-quotation-invoice-print .invoice-money-cell': {
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums',
            },
            '.MuiDialog-root, .MuiDialog-container, .MuiDialog-paper, .MuiDialogContent-root': {
              position: 'static !important',
              width: 'auto !important',
              maxWidth: 'none !important',
              height: 'auto !important',
              maxHeight: 'none !important',
              margin: '0 !important',
              padding: '0 !important',
              overflow: 'visible !important',
              boxShadow: 'none !important',
            },
            '.MuiDialogTitle-root, .MuiDialogActions-root, .MuiBackdrop-root': {
              display: 'none !important',
            },
          },
        }}
      />
      <Topbar
        title="Client Quotations"
        breadcrumbs={[{ label: 'Quotations' }, { label: 'Client Quotations' }]}
      />

      <Box sx={{ p: 3, flex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button variant="contained" onClick={handleOpenCreate}>+ Add Client Quotation</Button>
        </Box>

        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
          <Tab value="Trademark" label="Trademark" />
          <Tab value="Patent" label="Patent" />
          <Tab value="Design" label="Design" />
          <Tab value="Litigation" label="Litigation" />
          <Tab value="Copyright" label="Copyright" />
        </Tabs>

        {loading ? <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress /></Box> : filteredItems.length === 0 ? (
          <EmptyState title={`No ${activeTab} quotations`} description="Create a quotation to see it here" />
        ) : (
          <MuiDataTable
            rows={pagedRows}
            columns={columns}
            rowKey={(r) => r._id}
            page={page}
            rowsPerPage={rowsPerPage}
            total={searchedItems.length}
            onPageChange={setPage}
            onRowsPerPageChange={(next) => {
              setRowsPerPage(next);
              setPage(1);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
            showToolbar
            searchTerm={tableSearch}
            onSearchTermChange={(nextSearch) => {
              setTableSearch(nextSearch);
              setPage(1);
            }}
            searchPlaceholder="Search inquiry, service, procedure, client, status..."
            loading={false}
          />
        )}
      </Box>

      <Dialog open={openForm} onClose={() => { setOpenForm(false); resetForm(); }} maxWidth="lg" fullWidth>
        <DialogTitle>{editingId ? 'Edit Client Quotation' : 'Create Client Quotation'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Card variant="outlined"><CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>Client Quotations</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Autocomplete
                    options={clients}
                    getOptionKey={(option) => option._id}
                    getOptionLabel={(option) => option.name || ''}
                    isOptionEqualToValue={(option, value) => option._id === value._id}
                    value={selectedClient || null}
                    onChange={(_, value) => setSelectedClientId(value?._id || '')}
                    renderInput={(params) => <TextField {...params} label="Client *" />}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Autocomplete
                    options={availableInquiries}
                    getOptionLabel={(o) => o.referenceNo || ''}
                    value={selectedInquiry || null}
                    onChange={(_, value) => {
                      const nextInquiryCountries = Array.isArray(value?.countryIds)
                        ? value.countryIds
                            .map((country: any) => country?.name || '')
                            .filter(Boolean)
                        : [];
                      const nextIsInternational =
                        getInquiryReferenceSuffix(value?.referenceNo) === 'INT' || nextInquiryCountries.length > 1;
                      const nextClientId = typeof value?.clientId === 'object'
                        ? value.clientId?._id || ''
                        : String(value?.clientId || '');
                      setSelectedClientId(nextClientId);
                      setSelectedInquiryId(value?._id || '');
                      setSelectedRequirementIds([]);
                      setSelectedRequirementCountryId('');
                      setRequirementDraftIds([]);
                      setServiceCountrySelections(nextIsInternational ? [] : nextInquiryCountries.slice(0, 1));
                      setPriceRuleCountryFilter('');
                      setEditingServiceIndex(null);
                      setEditingServiceDraft(null);
                      const inquiryProcedureNames = getInquireProcedureNames(value || null);
                      if (!value) {
                        setServices([]);
                      }
                      setServiceDraft((p) => ({
                        ...p,
                        procedureName: inquiryProcedureNames[0] || '',
                        countryName: nextIsInternational ? '' : nextInquiryCountries[0] || '',
                      }));
                    }}
                    noOptionsText="No unused inquiry projects"
                    renderInput={(p) => <TextField {...p} label="Inquiry Project *" />}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}><TextField label="Inquiry Project" value={inquiryProjectRef} fullWidth slotProps={{ input: { readOnly: true } }} /></Grid>
                <Grid size={{ xs: 12, md: 4 }}><TextField label="Country" value={inquiryCountry} fullWidth slotProps={{ input: { readOnly: true } }} /></Grid>
                <Grid size={{ xs: 12, md: 4 }}><TextField label="Service" value={serviceCategory} fullWidth slotProps={{ input: { readOnly: true } }} /></Grid>
                <Grid size={{ xs: 12, md: 12 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 700 }}>Requirements</Typography>
                      {!selectedInquiry ? (
                        <Typography color="text.secondary">Select inquiry project to load requirements.</Typography>
                      ) : requirementsState.loading ? (
                        <Typography variant="body2" color="text.secondary">Loading requirements...</Typography>
                      ) : requirementsState.error ? (
                        <Typography variant="body2" color="error">{requirementsState.error}</Typography>
                      ) : (
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              Service: {requirementsState.serviceCategory || '-'}
                              {isInternationalInquiry ? ' | INT inquiry: select country requirements below' : ''}
                            </Typography>
                          </Grid>
                          <Grid size={{ xs: 12, md: 5 }}>
                            <Autocomplete
                              options={requirementCountryOptions}
                              value={
                                requirementCountryOptions.find(
                                  (country) => country._id === selectedRequirementCountryId
                                ) || null
                              }
                              onChange={(_, value) => {
                                setSelectedRequirementCountryId(value?._id || '');
                                setRequirementDraftIds([]);
                              }}
                              isOptionEqualToValue={(option, value) => option._id === value._id}
                              getOptionKey={(option) => option._id}
                              getOptionLabel={(option) =>
                                `${option.abbreviation ? `${option.abbreviation} - ` : ''}${option.name}`
                              }
                              renderOption={(props, option) => {
                                const optionProps = { ...props } as React.HTMLAttributes<HTMLLIElement> & {
                                  key?: React.Key;
                                };
                                delete optionProps.key;
                                return (
                                  <li {...optionProps} key={option._id}>
                                    <Box>
                                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                        {option.name}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {option.requirementCount} requirement{option.requirementCount === 1 ? '' : 's'}
                                      </Typography>
                                    </Box>
                                  </li>
                                );
                              }}
                              renderInput={(params) => <TextField {...params} label="Requirement Country *" />}
                            />
                          </Grid>
                          <Grid size={{ xs: 12, md: 7 }}>
                            <Autocomplete
                              multiple
                              disableCloseOnSelect
                              options={visibleRequirementOptions}
                              value={selectedRequirementDrafts.filter(
                                (requirement) => requirement.countryId === selectedRequirementCountryId
                              )}
                              onChange={(_, value) => setRequirementDraftIds(value.map((item) => item._id))}
                              isOptionEqualToValue={(option, value) => option._id === value._id}
                              getOptionKey={(option) => option._id}
                              getOptionLabel={getRequirementOptionLabel}
                              noOptionsText={
                                selectedRequirementCountryId
                                  ? 'No requirements for this selected country'
                                  : 'Select a country first'
                              }
                              renderInput={(params) => <TextField {...params} label="Available Requirement Titles" />}
                            />
                          </Grid>
                          <Grid size={{ xs: 12 }}>
                            <Button
                              variant="outlined"
                              onClick={handleAddRequirementsToCart}
                              disabled={requirementDraftIds.length === 0}
                            >
                              Add Selected Requirements to Quotation Cart
                            </Button>
                          </Grid>
                          <Grid size={{ xs: 12 }}>
                            {selectedRequirements.length === 0 ? (
                              <Typography variant="body2" color="text.secondary">
                                No requirements in the quotation cart yet.
                              </Typography>
                            ) : (
                              <Stack spacing={1.5}>
                                {selectedRequirements.map((requirement) => {
                                  const autosave = requirementAutosaveState[requirement._id];
                                  const toolbarId = getRequirementCartToolbarId(requirement._id);
                                  const autosaveColor =
                                    autosave?.status === 'error'
                                      ? 'error.main'
                                      : autosave?.status === 'saved'
                                        ? 'success.main'
                                        : 'text.secondary';

                                  return (
                                    <Box
                                      key={requirement._id}
                                      sx={{
                                        border: '1px solid',
                                        borderColor: autosave?.status === 'error' ? 'error.light' : 'divider',
                                        borderRadius: 1.5,
                                        p: 1.5,
                                        bgcolor: 'background.paper',
                                      }}
                                    >
                                      <Stack
                                        direction={{ xs: 'column', sm: 'row' }}
                                        spacing={1}
                                        sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mb: 1.5 }}
                                      >
                                        <Box>
                                          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                            Requirement Cart Editor
                                          </Typography>
                                          <Typography variant="caption" color="text.secondary">
                                            Country: {requirement.countryName || '-'}
                                          </Typography>
                                        </Box>
                                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                          <Typography variant="caption" sx={{ color: autosaveColor, fontWeight: 700 }}>
                                            {autosave?.message || 'Autosave ready'}
                                          </Typography>
                                          <Tooltip title="Delete requirement from cart">
                                            <IconButton
                                              size="small"
                                              onClick={() => handleRemoveRequirementFromCart(requirement._id)}
                                              sx={{ bgcolor: 'error.main', color: 'error.contrastText', '&:hover': { bgcolor: 'error.dark' } }}
                                            >
                                              <TrashIcon />
                                            </IconButton>
                                          </Tooltip>
                                        </Stack>
                                      </Stack>
                                      <TextField
                                        label="Requirement Title"
                                        value={requirement.title}
                                        onChange={(event) =>
                                          handleRequirementCartChange(requirement._id, { title: event.target.value })
                                        }
                                        fullWidth
                                        size="small"
                                        sx={{ mb: 1.5 }}
                                      />
                                      <RequirementCartToolbar toolbarId={toolbarId} />
                                      <Box className="requirement-cart-editor">
                                        <ReactQuill
                                          value={requirement.requirements || ''}
                                          onChange={(content) =>
                                            handleRequirementCartChange(requirement._id, { requirements: content })
                                          }
                                          theme="snow"
                                          modules={getRequirementCartEditorModules(requirement._id)}
                                        />
                                      </Box>
                                    </Box>
                                  );
                                })}
                              </Stack>
                            )}
                          </Grid>
                        </Grid>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </CardContent></Card>

            <Card variant="outlined"><CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>Service Details</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Autocomplete
                    options={serviceDetailProcedureOptions}
                    value={serviceDraft.procedureName}
                    onChange={(_, value) => handleSelectServiceProcedure(value || '')}
                    isOptionEqualToValue={(option, value) => option === value}
                    noOptionsText="No procedure available"
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Procedure"
                        helperText="Loaded from the inquiry and pricing rules; use Add Service to add the fee row."
                      />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Button variant="outlined" fullWidth onClick={handleOpenPriceRules}>
                    Select Price Rule
                  </Button>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Autocomplete
                    multiple
                    disableCloseOnSelect
                    options={inquiryCountries}
                    value={serviceCountrySelections.filter((country) => inquiryCountries.includes(country))}
                    onChange={(_, value) => {
                      setServiceCountrySelections(value);
                      setServiceDraft((prev) => ({
                        ...prev,
                        countryName: value.length === 1 ? value[0] : prev.countryName,
                      }));
                    }}
                    isOptionEqualToValue={(option, value) => option === value}
                    noOptionsText="Select an inquiry project first"
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={isInternationalInquiry ? 'Service Countries *' : 'Service Country *'}
                        helperText={
                          isInternationalInquiry
                            ? 'INT inquiry: choose one or more inquiry countries for this fee row.'
                            : 'Loaded from the selected inquiry.'
                        }
                      />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <FormControl fullWidth>
                    <InputLabel>Class Type</InputLabel>
                    <Select
                      value={serviceDraft.classType}
                      label="Class Type"
                      onChange={(e) =>
                        setServiceDraft((prev) => ({
                          ...prev,
                          classType: e.target.value as ClassType,
                          numberOfClasses:
                            e.target.value === 'multi' ? Math.max(1, prev.numberOfClasses || 1) : 1,
                          additionalFeePerClass:
                            e.target.value === 'multi' ? Math.max(0, prev.additionalFeePerClass || 0) : 0,
                        }))
                      }
                    >
                      <MenuItem value="single">Single</MenuItem>
                      <MenuItem value="multi">Multi</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                {serviceDraft.classType === 'multi' && (
                  <>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField
                        type="number"
                        label="Number of Classes"
                        value={serviceDraft.numberOfClasses}
                        onChange={(e) =>
                          setServiceDraft((prev) => ({
                            ...prev,
                            numberOfClasses: Math.max(1, Number(e.target.value) || 1),
                          }))
                        }
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField
                        type="number"
                        label="Additional Fee Per Class"
                        value={serviceDraft.additionalFeePerClass}
                        onChange={(e) =>
                          setServiceDraft((prev) => ({
                            ...prev,
                            additionalFeePerClass: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                        fullWidth
                      />
                    </Grid>
                  </>
                )}
                <Grid size={{ xs: 12, md: 3 }}><TextField type="number" label="Official Fees" value={serviceDraft.officialFee} onChange={(e) => setServiceDraft((p) => ({ ...p, officialFee: Math.max(0, Number(e.target.value) || 0) }))} fullWidth /></Grid>
                <Grid size={{ xs: 12, md: 3 }}><TextField type="number" label="Attorney Fees" value={serviceDraft.attorneyFee} onChange={(e) => setServiceDraft((p) => ({ ...p, attorneyFee: Math.max(0, Number(e.target.value) || 0) }))} fullWidth /></Grid>
                <Grid size={{ xs: 12, md: 3 }}><TextField type="number" label="Other Fees" value={serviceDraft.otherFees} onChange={(e) => setServiceDraft((p) => ({ ...p, otherFees: Math.max(0, Number(e.target.value) || 0) }))} fullWidth /></Grid>
                <Grid size={{ xs: 12, md: 3 }}><TextField type="number" label="Discount (Optional)" value={serviceDraft.discount} onChange={(e) => setServiceDraft((p) => ({ ...p, discount: Math.max(0, Number(e.target.value) || 0) }))} fullWidth /></Grid>
                <Grid size={{ xs: 12, md: 3 }}><TextField type="number" label="VAT (%)" value={serviceDraft.vatFee} onChange={(e) => setServiceDraft((p) => ({ ...p, vatFee: Math.max(0, Number(e.target.value) || 0) }))} fullWidth /></Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    label="Total VAT for Attorney"
                    value={toCurrency(serviceDraftVatOnAttorney)}
                    fullWidth
                    slotProps={{ input: { readOnly: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    label="Grand Total Preview"
                    value={toCurrency(serviceDraftComputedRow.grandTotal)}
                    fullWidth
                    slotProps={{ input: { readOnly: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}><Button variant="outlined" fullWidth onClick={handleAddService}>Add Service</Button></Grid>
              </Grid>

              <Box sx={{ mt: 2 }}>
                {services.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No services in cart yet.</Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Procedure</TableCell>
                          <TableCell>Country</TableCell>
                          <TableCell>Class Type</TableCell>
                          {showClassFeeColumns && <TableCell align="right">No. Classes</TableCell>}
                          {showClassFeeColumns && <TableCell align="right">Additional Fee/Class</TableCell>}
                          <TableCell align="right">Official Fees</TableCell>
                          <TableCell align="right">Attorney Fees</TableCell>
                          <TableCell align="right">Discount</TableCell>
                          <TableCell align="right">VAT</TableCell>
                          <TableCell align="right">Total</TableCell>
                          <TableCell align="right">Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {services.map((service, index) => {
                          const isEditingRow =
                            editingServiceIndex === index && editingServiceDraft !== null;
                          const rowDraft = isEditingRow
                            ? editingServiceDraft
                            : toServiceDraftFromRow(service, serviceCategory);
                          const rowPreview = computeClientRow(rowDraft, serviceCategory);
                          const rowProcedureOptions = serviceDetailProcedureOptions.includes(
                            rowDraft.procedureName
                          )
                            ? serviceDetailProcedureOptions
                            : rowDraft.procedureName
                              ? [rowDraft.procedureName, ...serviceDetailProcedureOptions]
                              : serviceDetailProcedureOptions;

                          return (
                            <TableRow key={`${service.procedureName}-${index}`}>
                              <TableCell sx={{ minWidth: 220 }}>
                                {isEditingRow ? (
                                  <TextField
                                    select
                                    size="small"
                                    value={rowDraft.procedureName}
                                    onChange={(event) =>
                                      setEditingServiceDraft((prev) =>
                                        prev ? { ...prev, procedureName: event.target.value } : prev
                                      )
                                    }
                                    fullWidth
                                  >
                                    {rowProcedureOptions.map((procedureName) => (
                                      <MenuItem key={`${procedureName}-${index}`} value={procedureName}>
                                        {procedureName}
                                      </MenuItem>
                                    ))}
                                  </TextField>
                                ) : (
                                  service.procedureName
                                )}
                              </TableCell>
                              <TableCell sx={{ minWidth: 160 }}>
                                {isEditingRow ? (
                                  <TextField
                                    select
                                    size="small"
                                    value={rowDraft.countryName}
                                    onChange={(event) =>
                                      setEditingServiceDraft((prev) =>
                                        prev ? { ...prev, countryName: event.target.value } : prev
                                      )
                                    }
                                    fullWidth
                                  >
                                    {inquiryCountries.map((country) => (
                                      <MenuItem key={`${country}-${index}`} value={country}>
                                        {country}
                                      </MenuItem>
                                    ))}
                                  </TextField>
                                ) : (
                                  resolveServiceCountryName(rowDraft.countryName) || '-'
                                )}
                              </TableCell>
                              <TableCell sx={{ minWidth: 140 }}>
                                {isEditingRow ? (
                                  <TextField
                                    select
                                    size="small"
                                    value={rowDraft.classType}
                                    onChange={(event) =>
                                      setEditingServiceDraft((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              classType: event.target.value as ClassType,
                                              numberOfClasses:
                                                event.target.value === 'multi'
                                                  ? Math.max(1, prev.numberOfClasses || 1)
                                                  : 1,
                                              additionalFeePerClass:
                                                event.target.value === 'multi'
                                                  ? Math.max(0, prev.additionalFeePerClass || 0)
                                                  : 0,
                                            }
                                          : prev
                                      )
                                    }
                                    fullWidth
                                  >
                                    <MenuItem value="single">Single</MenuItem>
                                    <MenuItem value="multi">Multi</MenuItem>
                                  </TextField>
                                ) : (
                                  service.classType === 'multi' ? 'Multi' : 'Single'
                                )}
                              </TableCell>
                              {showClassFeeColumns && (
                                <TableCell align="right" sx={{ minWidth: 120 }}>
                                  {isEditingRow ? (
                                    <TextField
                                      type="number"
                                      size="small"
                                      value={rowDraft.numberOfClasses}
                                      onChange={(event) =>
                                        setEditingServiceDraft((prev) =>
                                          prev
                                            ? {
                                                ...prev,
                                                numberOfClasses: Math.max(1, Number(event.target.value) || 1),
                                              }
                                            : prev
                                        )
                                      }
                                      slotProps={{ htmlInput: { min: 1 } }}
                                      sx={{ maxWidth: 110 }}
                                      disabled={rowDraft.classType !== 'multi'}
                                    />
                                  ) : service.classType === 'multi' ? (
                                    service.numberOfClasses
                                  ) : (
                                    '-'
                                  )}
                                </TableCell>
                              )}
                              {showClassFeeColumns && (
                                <TableCell align="right" sx={{ minWidth: 180 }}>
                                  {isEditingRow ? (
                                    rowDraft.classType === 'multi' ? (
                                      <TextField
                                        type="number"
                                        size="small"
                                        value={rowDraft.additionalFeePerClass}
                                        onChange={(event) =>
                                          setEditingServiceDraft((prev) =>
                                            prev
                                              ? {
                                                  ...prev,
                                                  additionalFeePerClass: Math.max(
                                                    0,
                                                    Number(event.target.value) || 0
                                                  ),
                                                }
                                              : prev
                                          )
                                        }
                                        slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                                        sx={{ maxWidth: 130 }}
                                      />
                                    ) : (
                                      '-'
                                    )
                                  ) : service.classType === 'multi' ? (
                                    toCurrency(service.additionalFeePerClass)
                                  ) : (
                                    '-'
                                  )}
                                </TableCell>
                              )}
                              <TableCell align="right" sx={{ minWidth: 140 }}>
                                {isEditingRow ? (
                                  <TextField
                                    type="number"
                                    size="small"
                                    value={rowDraft.officialFee}
                                    onChange={(event) =>
                                      setEditingServiceDraft((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              officialFee: Math.max(0, Number(event.target.value) || 0),
                                            }
                                          : prev
                                      )
                                    }
                                    slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                                    sx={{ maxWidth: 130 }}
                                  />
                                ) : (
                                  toCurrency(service.officialFee)
                                )}
                              </TableCell>
                              <TableCell align="right" sx={{ minWidth: 140 }}>
                                {isEditingRow ? (
                                  <TextField
                                    type="number"
                                    size="small"
                                    value={rowDraft.attorneyFee}
                                    onChange={(event) =>
                                      setEditingServiceDraft((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              attorneyFee: Math.max(0, Number(event.target.value) || 0),
                                            }
                                          : prev
                                      )
                                    }
                                    slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                                    sx={{ maxWidth: 130 }}
                                  />
                                ) : (
                                  toCurrency(service.attorneyFee)
                                )}
                              </TableCell>
                              <TableCell align="right" sx={{ minWidth: 140 }}>
                                {isEditingRow ? (
                                  <TextField
                                    type="number"
                                    size="small"
                                    value={rowDraft.discount}
                                    onChange={(event) =>
                                      setEditingServiceDraft((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              discount: Math.max(0, Number(event.target.value) || 0),
                                            }
                                          : prev
                                      )
                                    }
                                    slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                                    sx={{ maxWidth: 130 }}
                                  />
                                ) : (
                                  toCurrency(service.discount)
                                )}
                              </TableCell>
                              <TableCell align="right" sx={{ minWidth: 140 }}>
                                {isEditingRow ? (
                                  <TextField
                                    type="number"
                                    size="small"
                                    value={rowDraft.vatFee}
                                    onChange={(event) =>
                                      setEditingServiceDraft((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              vatFee: Math.max(0, Number(event.target.value) || 0),
                                            }
                                          : prev
                                      )
                                    }
                                    slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                                    sx={{ maxWidth: 130 }}
                                  />
                                ) : (
                                  toCurrency(
                                    computeVatAmount(
                                      computeAttorneyFeeAfterDiscount(
                                        Math.max(0, Number(service.attorneyFee || 0)),
                                        Math.max(0, Number(service.discount || 0))
                                      ),
                                      Math.max(0, Number(service.vatFee || 0))
                                    )
                                  )
                                )}
                              </TableCell>
                              <TableCell align="right">
                                {isEditingRow
                                  ? toCurrency(rowPreview.grandTotal)
                                  : toCurrency(service.grandTotal)}
                              </TableCell>
                              <TableCell align="right">
                                {isEditingRow ? (
                                  <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                                    <Button size="small" color="success" variant="contained" onClick={handleSaveEditService}>
                                      Save
                                    </Button>
                                    <Button size="small" onClick={handleCancelEditService}>
                                      Cancel
                                    </Button>
                                  </Stack>
                                ) : (
                                  <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                                    <Button size="small" onClick={() => handleStartEditService(index)}>
                                      Edit
                                    </Button>
                                    <Button size="small" color="error" onClick={() => handleRemoveService(index)}>
                                      Remove
                                    </Button>
                                  </Stack>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            </CardContent></Card>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpenForm(false); resetForm(); }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>{editingId ? 'Update' : 'Create'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={requirementEditorOpen}
        onClose={handleCloseRequirementEditor}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Requirement Details</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {requirementEditorError && (
              <Alert severity="error">{requirementEditorError}</Alert>
            )}
            {requirementEditorLoading ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      label="Country"
                      value={requirementEditorData.countryName || '-'}
                      fullWidth
                      slotProps={{ input: { readOnly: true } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      label="Service"
                      value={requirementEditorData.serviceCategory || '-'}
                      fullWidth
                      slotProps={{ input: { readOnly: true } }}
                    />
                  </Grid>
                </Grid>
                <TextField
                  label="Title *"
                  value={requirementEditorData.title}
                  onChange={(event) =>
                    setRequirementEditorData((prev) => ({ ...prev, title: event.target.value }))
                  }
                  fullWidth
                />
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                    Requirement Details *
                  </Typography>
                  <ReactQuill
                    value={requirementEditorData.requirements}
                    onChange={(content) =>
                      setRequirementEditorData((prev) => ({ ...prev, requirements: content }))
                    }
                    theme="snow"
                    modules={requirementEditorModules}
                  />
                </Box>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseRequirementEditor} disabled={requirementEditorSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveRequirementEditor}
            disabled={requirementEditorLoading || requirementEditorSaving}
          >
            {requirementEditorSaving ? 'Saving...' : 'Save Requirement'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={priceRuleDialogOpen} onClose={() => setPriceRuleDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Select Price Rule</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Procedure"
                  value={serviceDraft.procedureName}
                  fullWidth
                  slotProps={{ input: { readOnly: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Service"
                  value={serviceCategory}
                  fullWidth
                  slotProps={{ input: { readOnly: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  select
                  label="Country"
                  value={priceRuleCountryFilter}
                  onChange={(e) => {
                    const nextCountry = e.target.value;
                    setPriceRuleCountryFilter(nextCountry);
                    setServiceCountrySelections(nextCountry ? [nextCountry] : []);
                  }}
                  fullWidth
                >
                  {availableRuleCountries.map((country) => (
                    <MenuItem key={country} value={country}>
                      {country}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Autocomplete
                  options={filteredPriceRules}
                  value={selectedPriceRule}
                  onChange={(_, value) => setSelectedPriceRuleId(value?._id || '')}
                  getOptionLabel={(option) =>
                    `${option.procedureName} | ${option.countryName} | Official ${toCurrency(option.officialFee)}`
                  }
                  loading={priceRulesLoading}
                  renderInput={(params) => (
                    <TextField {...params} label="Price Rule *" />
                  )}
                />
              </Grid>
            </Grid>

            {priceRulesLoading ? (
              <Typography color="text.secondary">Loading price rules...</Typography>
            ) : priceRulesError ? (
              <Typography color="error">{priceRulesError}</Typography>
            ) : !filteredPriceRules.length ? (
              <Typography color="text.secondary">No price rules found for the selected filters.</Typography>
            ) : null}

            {selectedPriceRule && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    label="Official Fees"
                    value={toCurrency(selectedPriceRule.officialFee || 0)}
                    fullWidth
                    slotProps={{ input: { readOnly: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    label="Attorney Fees"
                    value={toCurrency(selectedPriceRule.attorneyFee || 0)}
                    fullWidth
                    slotProps={{ input: { readOnly: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    label="Additional Fee/Class"
                    value={toCurrency(selectedPriceRule.classFee || 0)}
                    fullWidth
                    slotProps={{ input: { readOnly: true } }}
                  />
                </Grid>
              </Grid>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPriceRuleDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleApplyPriceRule}>
            Apply Rule
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Client Quotation Report</DialogTitle>
        <DialogContent>
          {viewingItem && (
            <Box
              className="client-quotation-invoice-print"
              sx={{
                mt: 1,
                p: { xs: 2, md: 3 },
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                bgcolor: '#F8FAFC',
                fontFamily: REPORT_CSS_FONT_STACK,
              }}
            >
              <Card
                sx={{
                  mb: 2,
                  borderRadius: 2,
                  overflow: 'hidden',
                  border: '1px solid #DDE7F3',
                  bgcolor: '#0B1739',
                  color: '#fff',
                }}
              >
                <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                  <Grid container spacing={2.5} sx={{ alignItems: 'center' }}>
                    <Grid size={{ xs: 12, md: 7 }}>
                      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                        {settings?.logoUrl ? (
                          <Box
                            component="img"
                            src={settings.logoUrl}
                            alt="Company logo"
                            sx={{
                              width: 64,
                              height: 64,
                              objectFit: 'contain',
                              bgcolor: '#fff',
                              borderRadius: 2,
                              p: 1,
                            }}
                          />
                        ) : (
                          <Box
                            sx={{
                              width: 64,
                              height: 64,
                              borderRadius: 2,
                              bgcolor: '#2563EB',
                              display: 'grid',
                              placeItems: 'center',
                              fontSize: 28,
                              fontWeight: 900,
                            }}
                          >
                            A
                          </Box>
                        )}
                        <Box>
                          <Typography
                            variant="overline"
                            sx={{ letterSpacing: 1.6, color: '#BFDBFE', fontWeight: 800 }}
                          >
                            Professional Report
                          </Typography>
                          <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1.05 }}>
                            {CLIENT_QUOTATION_REPORT_TITLE}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#CBD5E1', mt: 0.75 }}>
                            {selectedInvoiceCompanyDetail?.companyName || settings?.companyName || 'AIP&T LAW FIRM'}
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
                        <Box
                          component="span"
                          sx={{
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 999,
                            fontWeight: 700,
                            fontSize: 12,
                            color: '#DBEAFE',
                            bgcolor: 'rgba(37,99,235,0.26)',
                          }}
                        >
                          {viewingItem.serviceCategory || viewingItem.inquirySnapshot?.serviceCategory || '-'}
                        </Box>
                        <Box
                          component="span"
                          sx={{
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 999,
                            fontWeight: 700,
                            fontSize: 12,
                            color: '#E9D5FF',
                            bgcolor: 'rgba(147,51,234,0.24)',
                          }}
                        >
                          Procedure: {viewingItem.inquirySnapshot?.procedureName || '-'}
                        </Box>
                      </Stack>
                    </Grid>
                    <Grid size={{ xs: 12, md: 5 }}>
                      <Box
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.08)',
                          border: '1px solid rgba(255,255,255,0.16)',
                          borderRadius: 2,
                          p: 2,
                        }}
                      >
                        <Grid container spacing={1.25}>
                          {[
                            ['Quotation No', viewingItem.quotationNo || viewingItem._id],
                            ['Date', viewingItem.createdAt ? new Date(viewingItem.createdAt).toLocaleDateString() : '-'],
                            ['Inquiry Project', viewingItem.inquirySnapshot?.referenceNo || viewingItem.inquiryProjects?.join(', ') || '-'],
                            ['Country', viewingItem.inquirySnapshot?.countryNames?.join(', ') || '-'],
                            ['Prepared By', selectedInvoiceCompanyDetail?.companyName || settings?.companyName || 'AIP&T LAW FIRM'],
                          ].map(([label, value]) => (
                            <Grid key={label} size={{ xs: 12, sm: 6 }}>
                              <Typography variant="caption" sx={{ color: '#93C5FD', fontWeight: 800 }}>
                                {label}
                              </Typography>
                              <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700 }}>
                                {value}
                              </Typography>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card variant="outlined" sx={{ borderRadius: 2, height: '100%', borderColor: '#DDE7F3' }}>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1.25 }}>
                        Company Details
                      </Typography>
                      {invoiceCompanyLoading ? (
                        <Typography variant="body2" color="text.secondary">
                          Loading company details...
                        </Typography>
                      ) : invoiceCompanyError ? (
                        <Typography variant="body2" color="error">
                          {invoiceCompanyError}
                        </Typography>
                      ) : selectedInvoiceCompanyDetail ? (
                        <Stack spacing={0.8}>
                          <Typography variant="body2"><strong>Company:</strong> {selectedInvoiceCompanyDetail.companyName || '-'}</Typography>
                          <Typography variant="body2"><strong>Continent:</strong> {selectedInvoiceCompanyDetail.continentName || '-'}</Typography>
                          <Typography variant="body2"><strong>Country:</strong> {selectedInvoiceCompanyDetail.countryName || '-'}</Typography>
                          <Typography variant="body2"><strong>Contact:</strong> {selectedInvoiceCompanyDetail.contact || '-'}</Typography>
                          <Typography variant="body2"><strong>Email:</strong> {selectedInvoiceCompanyDetail.email || '-'}</Typography>
                          <Typography variant="body2"><strong>Address:</strong> {selectedInvoiceCompanyDetail.address || '-'}</Typography>
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No company details available for this service/country.
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card variant="outlined" sx={{ borderRadius: 2, height: '100%', borderColor: '#DDE7F3' }}>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1.25 }}>
                        Client Details
                      </Typography>
                      <Stack spacing={0.8}>
                        <Typography variant="body2"><strong>Client:</strong> {viewingItem.clientSnapshot?.name || '-'}</Typography>
                        <Typography variant="body2"><strong>Email:</strong> {viewingItem.clientSnapshot?.email || '-'}</Typography>
                        <Typography variant="body2"><strong>Phone:</strong> {viewingItem.clientSnapshot?.phone || '-'}</Typography>
                        <Typography variant="body2"><strong>Type:</strong> {viewingItem.clientSnapshot?.type || '-'}</Typography>
                        <Typography variant="body2"><strong>Country:</strong> {viewingItem.clientSnapshot?.country || '-'}</Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Card
                className="invoice-service-card"
                variant="outlined"
                sx={{
                  borderRadius: 3,
                  borderColor: '#D7DDE7',
                  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
                  overflow: 'hidden',
                }}
              >
                <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                  <Stack
                    className="invoice-service-heading"
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.25}
                    sx={{
                      justifyContent: 'space-between',
                      alignItems: { sm: 'center' },
                      mb: 1.5,
                      p: 1.5,
                      border: '1px solid #E2E8F0',
                      borderLeft: `5px solid ${invoiceServiceTableColors.headerBg}`,
                      borderRadius: 2,
                      bgcolor: '#F8FAFC',
                    }}
                  >
                    <Box>
                      <Typography variant="overline" sx={{ color: '#2563EB', fontWeight: 900, letterSpacing: '0.08em' }}>
                        Fee Schedule
                      </Typography>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                        Service Details
                      </Typography>
                      <Typography className="invoice-print-hidden" variant="caption" color="text.secondary">
                        Click any header/row/column cell to set a color.
                      </Typography>
                    </Box>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
                      {viewingServiceStats && (
                        <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
                          {[
                            { label: 'Services', value: viewingServiceStats.serviceCount },
                            { label: 'Countries', value: viewingServiceStats.countryCount },
                            { label: 'Grand Total', value: toCurrency(viewingServiceStats.grandTotal) },
                          ].map((item) => (
                            <Box
                              key={item.label}
                              sx={{
                                minWidth: 92,
                                px: 1,
                                py: 0.6,
                                border: '1px solid #E2E8F0',
                                borderRadius: 1.5,
                                bgcolor: '#FFFFFF',
                                textAlign: 'center',
                              }}
                            >
                              <Typography sx={{ fontSize: 11, fontWeight: 900, color: '#0F172A', lineHeight: 1.1 }}>
                                {item.value}
                              </Typography>
                              <Typography sx={{ fontSize: 10, color: '#64748B', lineHeight: 1.1 }}>
                                {item.label}
                              </Typography>
                            </Box>
                          ))}
                        </Stack>
                      )}
                      <Button
                        className="invoice-print-hidden"
                        size="small"
                        variant="contained"
                        startIcon={<SettingsIcon />}
                        onClick={handleSaveInvoiceDefaultDesign}
                      >
                        Save Default Color Design
                      </Button>
                    </Stack>
                  </Stack>
                  <Stack spacing={2}>

                  <TableContainer
                    sx={{
                      border: '1px solid',
                      borderColor: invoiceServiceTableColors.borderColor,
                      borderRadius: 2,
                      boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
                    }}
                  >
                    <Table
                      className="invoice-service-table"
                      size="small"
                      sx={{
                        tableLayout: 'fixed',
                        '& .MuiTableCell-root': {
                          borderColor: invoiceServiceTableColors.borderColor,
                          fontSize: 12,
                          lineHeight: 1.25,
                        },
                        '& thead .MuiTableCell-root': {
                          textTransform: 'uppercase',
                          letterSpacing: '0.02em',
                          fontSize: 11,
                        },
                        '& tbody .MuiTableCell-root:nth-of-type(n+3)': {
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap',
                        },
                      }}
                    >
                      <colgroup>
                        <col style={{ width: '13%' }} />
                        <col style={{ width: '27%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '11%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '15%' }} />
                      </colgroup>
                      <TableHead sx={{ bgcolor: invoiceServiceTableColors.headerBg }}>
                        <TableRow>
                          <TableCell
                            onClick={(event) =>
                              openInvoiceCellPicker(
                                event,
                                'header-country',
                                'Header: Country',
                                invoiceServiceTableColors.headerBg
                              )
                            }
                            sx={{
                              fontWeight: 800,
                              ...getInvoiceCellSx(
                                'header-country',
                                invoiceServiceTableColors.headerBg,
                                invoiceServiceTableColors.headerText
                              ),
                            }}
                          >
                            Country
                          </TableCell>
                          <TableCell
                            onClick={(event) =>
                              openInvoiceCellPicker(
                                event,
                                'header-procedure',
                                'Header: Procedure Name',
                                invoiceServiceTableColors.headerBg
                              )
                            }
                            sx={{
                              fontWeight: 800,
                              ...getInvoiceCellSx(
                                'header-procedure',
                                invoiceServiceTableColors.headerBg,
                                invoiceServiceTableColors.headerText
                              ),
                            }}
                          >
                            Procedure Name
                          </TableCell>
                          <TableCell
                            align="right"
                            onClick={(event) =>
                              openInvoiceCellPicker(
                                event,
                                'header-official',
                                'Header: Official Fees',
                                invoiceServiceTableColors.headerBg
                              )
                            }
                            sx={{
                              fontWeight: 800,
                              ...getInvoiceCellSx(
                                'header-official',
                                invoiceServiceTableColors.headerBg,
                                invoiceServiceTableColors.headerText
                              ),
                            }}
                          >
                            Official Fees
                          </TableCell>
                          <TableCell
                            align="right"
                            onClick={(event) =>
                              openInvoiceCellPicker(
                                event,
                                'header-attorney',
                                'Header: Attorney Fees',
                                invoiceServiceTableColors.headerBg
                              )
                            }
                            sx={{
                              fontWeight: 800,
                              ...getInvoiceCellSx(
                                'header-attorney',
                                invoiceServiceTableColors.headerBg,
                                invoiceServiceTableColors.headerText
                              ),
                            }}
                          >
                            Attorney Fees
                          </TableCell>
                          <TableCell
                            align="right"
                            onClick={(event) =>
                              openInvoiceCellPicker(
                                event,
                                'header-discount',
                                'Header: Discount',
                                invoiceServiceTableColors.headerBg
                              )
                            }
                            sx={{
                              fontWeight: 800,
                              ...getInvoiceCellSx(
                                'header-discount',
                                invoiceServiceTableColors.headerBg,
                                invoiceServiceTableColors.headerText
                              ),
                            }}
                          >
                            Discount
                          </TableCell>
                          <TableCell
                            align="right"
                            onClick={(event) =>
                              openInvoiceCellPicker(
                                event,
                                'header-vat',
                                'Header: VAT',
                                invoiceServiceTableColors.headerBg
                              )
                            }
                            sx={{
                              fontWeight: 800,
                              ...getInvoiceCellSx(
                                'header-vat',
                                invoiceServiceTableColors.headerBg,
                                invoiceServiceTableColors.headerText
                              ),
                            }}
                          >
                            {getInvoiceVatHeaderLabel(viewingItem)}
                          </TableCell>
                          <TableCell
                            align="right"
                            onClick={(event) =>
                              openInvoiceCellPicker(
                                event,
                                'header-total',
                                'Header: Total',
                                invoiceServiceTableColors.headerBg
                              )
                            }
                            sx={{
                              fontWeight: 800,
                              ...getInvoiceCellSx(
                                'header-total',
                                invoiceServiceTableColors.headerBg,
                                invoiceServiceTableColors.headerText
                              ),
                            }}
                          >
                            Total
                          </TableCell>
                        </TableRow>
                        {((viewingItem.serviceCategory || viewingItem.inquirySnapshot?.serviceCategory) as ServiceCategory) === 'Trademark' && (
                          <TableRow sx={{ bgcolor: invoiceServiceTableColors.subHeaderBg }}>
                            <TableCell
                              onClick={(event) =>
                                openInvoiceCellPicker(
                                  event,
                                  'subheader-country',
                                  'Subheader: Country',
                                  invoiceServiceTableColors.subHeaderBg
                                )
                              }
                              sx={{
                                fontStyle: 'italic',
                                ...getInvoiceCellSx(
                                  'subheader-country',
                                  invoiceServiceTableColors.subHeaderBg,
                                  invoiceServiceTableColors.subHeaderText
                                ),
                              }}
                            >
                              Country
                            </TableCell>
                            <TableCell
                              onClick={(event) =>
                                openInvoiceCellPicker(
                                  event,
                                  'subheader-procedure',
                                  'Subheader: Procedure',
                                  invoiceServiceTableColors.subHeaderBg
                                )
                              }
                              sx={{
                                fontStyle: 'italic',
                                ...getInvoiceCellSx(
                                  'subheader-procedure',
                                  invoiceServiceTableColors.subHeaderBg,
                                  invoiceServiceTableColors.subHeaderText
                                ),
                              }}
                            >
                              Class Type / No. Classes
                            </TableCell>
                            <TableCell
                              align="right"
                              onClick={(event) =>
                                openInvoiceCellPicker(
                                  event,
                                  'subheader-official',
                                  'Subheader: Official Fees',
                                  invoiceServiceTableColors.subHeaderBg
                                )
                              }
                              sx={{
                                fontStyle: 'italic',
                                ...getInvoiceCellSx(
                                  'subheader-official',
                                  invoiceServiceTableColors.subHeaderBg,
                                  invoiceServiceTableColors.subHeaderText
                                ),
                              }}
                            >
                              per mark per class
                            </TableCell>
                            <TableCell
                              align="right"
                              onClick={(event) =>
                                openInvoiceCellPicker(
                                  event,
                                  'subheader-attorney',
                                  'Subheader: Attorney Fees',
                                  invoiceServiceTableColors.subHeaderBg
                                )
                              }
                              sx={{
                                fontStyle: 'italic',
                                ...getInvoiceCellSx(
                                  'subheader-attorney',
                                  invoiceServiceTableColors.subHeaderBg,
                                  invoiceServiceTableColors.subHeaderText
                                ),
                              }}
                            >
                              per mark per class
                            </TableCell>
                            <TableCell
                              align="right"
                              onClick={(event) =>
                                openInvoiceCellPicker(
                                  event,
                                  'subheader-discount',
                                  'Subheader: Discount',
                                  invoiceServiceTableColors.subHeaderBg
                                )
                              }
                              sx={{
                                fontStyle: 'italic',
                                ...getInvoiceCellSx(
                                  'subheader-discount',
                                  invoiceServiceTableColors.subHeaderBg,
                                  invoiceServiceTableColors.subHeaderText
                                ),
                              }}
                            />
                            <TableCell
                              align="right"
                              onClick={(event) =>
                                openInvoiceCellPicker(
                                  event,
                                  'subheader-vat',
                                  'Subheader: VAT',
                                  invoiceServiceTableColors.subHeaderBg
                                )
                              }
                              sx={{
                                fontStyle: 'italic',
                                ...getInvoiceCellSx(
                                  'subheader-vat',
                                  invoiceServiceTableColors.subHeaderBg,
                                  invoiceServiceTableColors.subHeaderText
                                ),
                              }}
                            />
                            <TableCell
                              align="right"
                              onClick={(event) =>
                                openInvoiceCellPicker(
                                  event,
                                  'subheader-total',
                                  'Subheader: Total',
                                  invoiceServiceTableColors.subHeaderBg
                                )
                              }
                              sx={{
                                fontStyle: 'italic',
                                ...getInvoiceCellSx(
                                  'subheader-total',
                                  invoiceServiceTableColors.subHeaderBg,
                                  invoiceServiceTableColors.subHeaderText
                                ),
                              }}
                            >
                              per mark per class
                            </TableCell>
                          </TableRow>
                        )}
                      </TableHead>
                      <TableBody>
                        {(viewingItem.services || []).map((service, index) => {
                          const isTrademark =
                            ((viewingItem.serviceCategory || viewingItem.inquirySnapshot?.serviceCategory) as ServiceCategory) ===
                            'Trademark';
                          const classInfo = isTrademark
                            ? `${service.classType === 'multi' ? 'Multi' : 'Single'} | ${Math.max(1, Number(service.numberOfClasses || 1))} class${Math.max(1, Number(service.numberOfClasses || 1)) > 1 ? 'es' : ''}`
                            : '';

                          const baseRowBg =
                            index % 2 === 0
                              ? invoiceServiceTableColors.rowBg
                              : invoiceServiceTableColors.altRowBg;

                          return (
                            <TableRow key={`${service.procedureName}-${index}`}>
                              <TableCell
                                onClick={(event) =>
                                  openInvoiceCellPicker(
                                    event,
                                    `row-${index}-country`,
                                    `Row ${index + 1}: Country`,
                                    baseRowBg
                                  )
                                }
                                sx={{
                                  ...getInvoiceCellSx(
                                    `row-${index}-country`,
                                    baseRowBg,
                                    invoiceServiceTableColors.countryColText
                                  ),
                                }}
                              >
                                {getServiceCountryName(service, viewingItem) || '-'}
                              </TableCell>
                              <TableCell
                                onClick={(event) =>
                                  openInvoiceCellPicker(
                                    event,
                                    `row-${index}-procedure`,
                                    `Row ${index + 1}: Procedure Name`,
                                    baseRowBg
                                  )
                                }
                                sx={{
                                  ...getInvoiceCellSx(
                                    `row-${index}-procedure`,
                                    baseRowBg,
                                    invoiceServiceTableColors.procedureColText
                                  ),
                                }}
                              >
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: 700, color: 'inherit' }}
                                >
                                  {service.procedureName || '-'}
                                </Typography>
                                {isTrademark && (
                                  <Typography
                                    variant="caption"
                                    sx={{ color: 'inherit', opacity: 0.85 }}
                                  >
                                    {classInfo}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell
                                align="right"
                                onClick={(event) =>
                                  openInvoiceCellPicker(
                                    event,
                                    `row-${index}-official`,
                                    `Row ${index + 1}: Official Fees`,
                                    baseRowBg
                                  )
                                }
                                sx={{
                                  ...getInvoiceCellSx(
                                    `row-${index}-official`,
                                    baseRowBg,
                                    invoiceServiceTableColors.officialColText
                                  ),
                                }}
                              >
                                {toCurrency(service.totalOfficialFees || service.officialFee || 0)}
                              </TableCell>
                              <TableCell
                                align="right"
                                onClick={(event) =>
                                  openInvoiceCellPicker(
                                    event,
                                    `row-${index}-attorney`,
                                    `Row ${index + 1}: Attorney Fees`,
                                    baseRowBg
                                  )
                                }
                                sx={{
                                  ...getInvoiceCellSx(
                                    `row-${index}-attorney`,
                                    baseRowBg,
                                    invoiceServiceTableColors.attorneyColText
                                  ),
                                }}
                              >
                                {toCurrency(service.attorneyFee || 0)}
                              </TableCell>
                              <TableCell
                                align="right"
                                onClick={(event) =>
                                  openInvoiceCellPicker(
                                    event,
                                    `row-${index}-discount`,
                                    `Row ${index + 1}: Discount`,
                                    baseRowBg
                                  )
                                }
                                sx={{
                                  ...getInvoiceCellSx(
                                    `row-${index}-discount`,
                                    baseRowBg,
                                    invoiceServiceTableColors.discountColText
                                  ),
                                }}
                              >
                                {toCurrency(getServiceDiscountAmount(service))}
                              </TableCell>
                              <TableCell
                                align="right"
                                onClick={(event) =>
                                  openInvoiceCellPicker(
                                    event,
                                    `row-${index}-vat`,
                                    `Row ${index + 1}: VAT`,
                                    baseRowBg
                                  )
                                }
                                sx={{
                                  ...getInvoiceCellSx(
                                    `row-${index}-vat`,
                                    baseRowBg,
                                    invoiceServiceTableColors.vatColText
                                  ),
                                }}
                              >
                                {toCurrency(getServiceVatAmount(service))}
                              </TableCell>
                              <TableCell
                                align="right"
                                onClick={(event) =>
                                  openInvoiceCellPicker(
                                    event,
                                    `row-${index}-total`,
                                    `Row ${index + 1}: Total`,
                                    baseRowBg
                                  )
                                }
                                sx={{
                                  ...getInvoiceCellSx(
                                    `row-${index}-total`,
                                    baseRowBg,
                                    invoiceServiceTableColors.totalColText
                                  ),
                                }}
                              >
                                {toCurrency(service.grandTotal || 0)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow sx={{ bgcolor: invoiceServiceTableColors.totalRowBg }}>
                          <TableCell
                            onClick={(event) =>
                              openInvoiceCellPicker(
                                event,
                                'grand-country',
                                'Grand Total: Country',
                                invoiceServiceTableColors.totalRowBg
                              )
                            }
                            sx={{
                              fontWeight: 800,
                              ...getInvoiceCellSx(
                                'grand-country',
                                invoiceServiceTableColors.totalRowBg,
                                invoiceServiceTableColors.totalRowText
                              ),
                            }}
                          >
                            Grand Total
                          </TableCell>
                          <TableCell
                            onClick={(event) =>
                              openInvoiceCellPicker(
                                event,
                                'grand-procedure',
                                'Grand Total: Procedure',
                                invoiceServiceTableColors.totalRowBg
                              )
                            }
                            sx={{
                              fontWeight: 800,
                              ...getInvoiceCellSx(
                                'grand-procedure',
                                invoiceServiceTableColors.totalRowBg,
                                invoiceServiceTableColors.totalRowText
                              ),
                            }}
                          />
                          <TableCell
                            align="right"
                            onClick={(event) =>
                              openInvoiceCellPicker(
                                event,
                                'grand-official',
                                'Grand Total: Official Fees',
                                invoiceServiceTableColors.totalRowBg
                              )
                            }
                            sx={{
                              fontWeight: 800,
                              ...getInvoiceCellSx(
                                'grand-official',
                                invoiceServiceTableColors.totalRowBg,
                                invoiceServiceTableColors.totalRowText
                              ),
                            }}
                          >
                            {toCurrency(viewingItem.totalOfficialFees || 0)}
                          </TableCell>
                          <TableCell
                            align="right"
                            onClick={(event) =>
                              openInvoiceCellPicker(
                                event,
                                'grand-attorney',
                                'Grand Total: Attorney Fees',
                                invoiceServiceTableColors.totalRowBg
                              )
                            }
                            sx={{
                              fontWeight: 800,
                              ...getInvoiceCellSx(
                                'grand-attorney',
                                invoiceServiceTableColors.totalRowBg,
                                invoiceServiceTableColors.totalRowText
                              ),
                            }}
                          >
                            {toCurrency(viewingItem.totalAttorneyFees || 0)}
                          </TableCell>
                          <TableCell
                            align="right"
                            onClick={(event) =>
                              openInvoiceCellPicker(
                                event,
                                'grand-discount',
                                'Grand Total: Discount',
                                invoiceServiceTableColors.totalRowBg
                              )
                            }
                            sx={{
                              fontWeight: 800,
                              ...getInvoiceCellSx(
                                'grand-discount',
                                invoiceServiceTableColors.totalRowBg,
                                invoiceServiceTableColors.totalRowText
                              ),
                            }}
                          >
                            {toCurrency(viewingItem.totalDiscount || 0)}
                          </TableCell>
                          <TableCell
                            align="right"
                            onClick={(event) =>
                              openInvoiceCellPicker(
                                event,
                                'grand-vat',
                                'Grand Total: VAT',
                                invoiceServiceTableColors.totalRowBg
                              )
                            }
                            sx={{
                              fontWeight: 800,
                              ...getInvoiceCellSx(
                                'grand-vat',
                                invoiceServiceTableColors.totalRowBg,
                                invoiceServiceTableColors.totalRowText
                              ),
                            }}
                          >
                            {toCurrency(viewingItem.totalVatFees || 0)}
                          </TableCell>
                          <TableCell
                            align="right"
                            onClick={(event) =>
                              openInvoiceCellPicker(
                                event,
                                'grand-total',
                                'Grand Total: Total',
                                invoiceServiceTableColors.totalRowBg
                              )
                            }
                            sx={{
                              fontWeight: 800,
                              ...getInvoiceCellSx(
                                'grand-total',
                                invoiceServiceTableColors.totalRowBg,
                                invoiceServiceTableColors.totalRowText
                              ),
                            }}
                          >
                            {toCurrency(viewingItem.grandTotal || 0)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                    <Popover
                      open={Boolean(invoiceCellPickerAnchor)}
                      anchorEl={invoiceCellPickerAnchor}
                      onClose={closeInvoiceCellPicker}
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                    >
                      <Box sx={{ p: 1.5, minWidth: 240 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                          Cell Color
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
                          {selectedInvoiceCell?.label || ''}
                        </Typography>
                        <TextField
                          type="color"
                          size="small"
                          value={invoiceCellColorDraft}
                          onChange={(event) => {
                            const nextColor = event.target.value;
                            setInvoiceCellColorDraft(nextColor);
                            applyInvoiceCellColor(nextColor);
                          }}
                          fullWidth
                          slotProps={{ inputLabel: { shrink: true } }}
                        />
                        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', mt: 1.25 }}>
                          <Button size="small" onClick={clearSelectedInvoiceCellColor}>
                            Clear
                          </Button>
                          <Button size="small" variant="contained" onClick={closeInvoiceCellPicker}>
                            Done
                          </Button>
                        </Stack>
                      </Box>
                    </Popover>
                  </Stack>
                </CardContent>
              </Card>

              <Card className="invoice-requirements-card" variant="outlined" sx={{ mt: 2, borderRadius: 3, borderColor: '#DDE7F3' }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1.25 }}>
                    Requirement Details
                  </Typography>
                  <TableContainer
                    sx={{
                      border: '1px solid',
                      borderColor: invoiceServiceTableColors.borderColor,
                      borderRadius: 2,
                      bgcolor: '#FFFFFF',
                    }}
                  >
                    <Table className="invoice-requirements-table" size="small" sx={{ tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: '24%' }} />
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '56%' }} />
                      </colgroup>
                      <TableHead sx={{ bgcolor: invoiceServiceTableColors.headerBg }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 800, color: invoiceServiceTableColors.headerText }}>
                            Title
                          </TableCell>
                          <TableCell sx={{ fontWeight: 800, color: invoiceServiceTableColors.headerText }}>
                            Country
                          </TableCell>
                          <TableCell sx={{ fontWeight: 800, color: invoiceServiceTableColors.headerText }}>
                            Description
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {getRequirementDisplayRows(viewingItem).length > 0 ? (
                          getRequirementDisplayRows(viewingItem).map((requirement, index) => (
                            <TableRow key={`${requirement.countryName}-${requirement.title}-${index}`}>
                              <TableCell sx={{ color: invoiceServiceTableColors.procedureColText, fontWeight: 700, verticalAlign: 'top' }}>
                                {requirement.title || '-'}
                              </TableCell>
                              <TableCell sx={{ color: invoiceServiceTableColors.countryColText, verticalAlign: 'top' }}>
                                {requirement.countryName || '-'}
                              </TableCell>
                              <TableCell sx={{ color: invoiceServiceTableColors.procedureColText, verticalAlign: 'top' }}>
                                <Box
                                  className="invoice-requirement-description"
                                  sx={{
                                    '& p': { m: 0, mb: 1 },
                                    '& p:last-of-type': { mb: 0 },
                                  }}
                                  dangerouslySetInnerHTML={{
                                    __html: requirement.requirementsHtml,
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell>-</TableCell>
                            <TableCell>{getRequirementCountryName(viewingItem) || '-'}</TableCell>
                            <TableCell>
                              <Typography variant="body2" color="text.secondary">
                                No requirement details available.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {viewingItem && (
            <>
              <Button variant="outlined" onClick={() => handleDownloadInvoicePdf(viewingItem)}>
                Download PDF Report
              </Button>
              <Button variant="outlined" onClick={() => handleDownloadInvoiceWord(viewingItem)}>
                Download Word Report
              </Button>
            </>
          )}
          <Button onClick={() => window.print()}>Print Report</Button>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Client Quotation</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this quotation?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
