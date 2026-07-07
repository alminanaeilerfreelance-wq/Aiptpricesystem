'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import {
  Box,
  Button,
  CircularProgress,
  Backdrop,
  Grow,
  Skeleton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import SearchSelect from '@/components/common/SearchSelect';
import InvoiceTable from '@/components/invoicing/invoice-table';
import { showErrorToast, showSuccessToast, showWarningToast } from '@/components/feedback/heroToast';
import { clientsService } from '@/services/clients.service';
import companyDetailsService, { CompanyDetail } from '@/services/company-details.service';
import { createServiceRecord, updateServiceRecord } from '@/actions/invoicing-actions';
import { useAuthContext } from '@/context/AuthContext';
import Topbar from '@/components/layout/Topbar';

type OptionId = { _id: string };
type ClientOption = OptionId & {
  name: string;
  companyName?: string;
  address?: string;
  assignedId?: string;
  notes?: string;
};
type ServiceOption = OptionId & { name: string; category: string };
type CountryOption = OptionId & { name: string; abbreviation: string };
type ProcedureOption = OptionId & {
  name: string;
  serviceCategory: string;
  serviceName?: string;
  description?: string;
  countryName?: string;
};
type ApplicationOption = OptionId & {
  referenceNo: string;
  countryId?: string;
  countryName?: string;
  serviceType?: string;
  applicationName?: string;
  filingNumber?: string;
  classNo?: number;
  markImage?: string;
  imageUrl?: string;
  applicationId?: string | null;
};
type BankOption = OptionId & {
  bankName: string;
  logoUrl?: string;
  bankHeader?: string;
  bankDescription?: string;
  accountName?: string;
  accountNumber?: string;
  iban?: string;
  swift?: string;
  currency?: string;
};
type PricingRuleOption = OptionId & {
  clientId?: string;
  clientName?: string;
  procedureName: string;
  countryName: string;
  countryAbbreviation: string;
  officialFee: number;
  attorneyFee: number;
  classFee?: number;
  serviceCategory: string;
  country?: { _id?: string; name: string; abbreviation: string } | null;
  procedure?: { _id?: string; name: string } | null;
};
type SavedInvoice = {
  id: string;
  clientId: string;
  serviceId?: string;
  countryId: string;
  procedureId?: string;
  bankId?: string;
  invoiceNumber: string;
  invoiceDate: string;
  clientReference?: string;
  toAddress?: string;
  subject?: string;
  applicationIds?: string[];
  items?: InvoiceItem[];
  currency?: string;
  vatable?: boolean;
  vatPercentage?: number;
  status?: string;
  pdfAccessToken?: string;
};

type CurrencyOption = { value: string; code: string; name: string; symbol: string };
type VatableOption = { value: boolean; label: string };

interface InvoiceItem {
  id: string;
  pricingRuleId?: string;
  countryId?: string;
  procedureId?: string;
  item: string;
  country: string;
  procedure: string;
  officialFee: number;
  attorneyFee: number;
  quantity: number;
  vatPercentage: number;
  vatAmount: number;
  total: number;
}

const shellSx = {
  minHeight: 'calc(100vh - 64px)',
  p: { xs: 2, md: 3 },
  color: '#0F172A',
  background: '#FFFFFF',
};

const fieldSx = {
  '& .MuiInputBase-root': {
    minHeight: 34,
    color: '#0F172A',
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: '#CBD5E1',
  },
  '& .MuiInputBase-input': {
    py: 0.65,
    fontSize: 13,
  },
  '& .MuiInputLabel-root': {
    color: '#334155',
    fontSize: 13,
    fontWeight: 700,
  },
  '& .MuiFormHelperText-root': {
    color: '#B91C1C',
    mx: 0,
  },
};

const darkTableHeaderSx = {
  bgcolor: '#0B1739',
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  py: 0.85,
  borderColor: '#1E293B',
};

const dialogTitleSx = {
  bgcolor: '#0B1739',
  color: '#FFFFFF',
  fontWeight: 800,
  py: 1.5,
};

const currencyOptions: CurrencyOption[] = [
  { value: 'USD', code: 'USD', name: 'US Dollar', symbol: '$' },
  { value: 'SAR', code: 'SAR', name: 'Saudi Riyal', symbol: 'SAR' },
  { value: 'AED', code: 'AED', name: 'UAE Dirham', symbol: 'AED' },
  { value: 'BHD', code: 'BHD', name: 'Bahraini Dinar', symbol: 'BHD' },
  { value: 'KWD', code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'KWD' },
  { value: 'QAR', code: 'QAR', name: 'Qatari Riyal', symbol: 'QAR' },
  { value: 'OMR', code: 'OMR', name: 'Omani Rial', symbol: 'OMR' },
  { value: 'EUR', code: 'EUR', name: 'Euro', symbol: '€' },
  { value: 'GBP', code: 'GBP', name: 'British Pound', symbol: '£' },
  { value: 'JPY', code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { value: 'CNY', code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { value: 'HKD', code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { value: 'SGD', code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { value: 'AUD', code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { value: 'CAD', code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { value: 'CHF', code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { value: 'INR', code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { value: 'PKR', code: 'PKR', name: 'Pakistani Rupee', symbol: 'PKR' },
  { value: 'EGP', code: 'EGP', name: 'Egyptian Pound', symbol: 'EGP' },
  { value: 'TRY', code: 'TRY', name: 'Turkish Lira', symbol: 'TRY' },
  { value: 'ZAR', code: 'ZAR', name: 'South African Rand', symbol: 'ZAR' },
];

const vatableOptions: VatableOption[] = [
  { value: false, label: 'No' },
  { value: true, label: 'Yes' },
];

function getJson<T>(url: string): Promise<T> {
  return fetch(url, { credentials: 'same-origin' }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data as T;
  });
}

const valueOrDash = (value: string | number | null | undefined) => String(value ?? '').trim() || '-';

const resolveReportAssetUrl = (url: string): string => {
  if (!url || url.startsWith('data:') || /^https?:\/\//i.test(url)) return url;
  if (typeof window !== 'undefined' && url.startsWith('/')) return `${window.location.origin}${url}`;
  return url;
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Unable to read image file.'));
    reader.readAsDataURL(blob);
  });

const getReportImageDataUrl = async (url: string): Promise<string> => {
  const resolvedUrl = resolveReportAssetUrl(url);
  if (!resolvedUrl) return '';
  if (resolvedUrl.startsWith('data:')) return resolvedUrl;

  const response = await fetch(resolvedUrl);
  if (!response.ok) return '';

  const blob = await response.blob();
  if (blob.type && !blob.type.toLowerCase().startsWith('image/')) return '';
  return blobToDataUrl(blob);
};

const getReportImageLayout = async (
  url: string,
  maxWidth: number,
  maxHeight: number
): Promise<{ dataUrl: string; width: number; height: number } | null> => {
  const dataUrl = await getReportImageDataUrl(url);
  if (!dataUrl) return null;

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth || maxWidth;
      const height = image.naturalHeight || maxHeight;
      const scale = Math.min(maxWidth / width, maxHeight / height, 1);
      resolve({ dataUrl, width: width * scale, height: height * scale });
    };
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
};

const getReportPdfImageFormat = (dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' => {
  if (/^data:image\/png/i.test(dataUrl)) return 'PNG';
  if (/^data:image\/webp/i.test(dataUrl)) return 'WEBP';
  return 'JPEG';
};

const getReportCompanyLines = (company: CompanyDetail | null | undefined): string[] => {
  const lines = [
    valueOrDash(company?.companyName || 'IP LAW FIRM'),
    company?.address ? String(company.address).trim() : '',
    company?.contact ? `Phone: ${String(company.contact).trim()}` : '',
    company?.email ? String(company.email).trim() : '',
  ];
  return lines.filter((line) => line && line !== '-');
};

const getReportCompanyLogoUrl = (company: CompanyDetail | null | undefined): string =>
  String(company?.logoUrl || '').trim();

const getReportFooterLines = (company: CompanyDetail | null | undefined): [string, string] => [
  `Thank you for your business with ${valueOrDash(company?.companyName || 'AIPT')}.`,
  'If you have questions, please contact us at the details above.',
];

const toInvoicePdfFileName = (invoiceNumber: string, clientName: string) =>
  `${invoiceNumber || 'invoice'}-${clientName || 'client'}`
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'invoice';

const buildInvoicePdfUrl = (invoiceId: string | null | undefined, token?: string, inline = true) => {
  if (!invoiceId || typeof window === 'undefined') return '';
  const params = new URLSearchParams();
  if (token) params.set('t', token);
  if (inline) params.set('download', '0');
  const query = params.toString();
  return `${window.location.origin}/api/invoices/${invoiceId}/pdf${query ? `?${query}` : ''}`;
};

function clientLabel(client: ClientOption) {
  const name = client.companyName?.trim() || client.name?.trim() || 'Unnamed Client';
  return client.assignedId ? `${name} - ${client.assignedId}` : name;
}

function servicePrefix(service?: ServiceOption | null) {
  const key = service?.category || service?.name || '';
  if (/trademark/i.test(key)) return 'TM';
  if (/patent/i.test(key)) return 'P';
  if (/design/i.test(key)) return 'D';
  if (/copyright/i.test(key)) return 'C';
  if (/litigation/i.test(key)) return 'L';
   if (/others/i.test(key)) return 'O';
  return 'O';
}

function getServiceKind(service?: ServiceOption | null) {
  const key = `${service?.category || ''} ${service?.name || ''}`;
  if (/trademark/i.test(key)) return 'trademark';
  if (/patent/i.test(key)) return 'patent';
  if (/design/i.test(key)) return 'design';
  if (/copyright/i.test(key)) return 'copyright';
  return 'other';
}

function buildInvoiceSubject(
  service: ServiceOption | null,
  procedure: ProcedureOption | null,
  applications: ApplicationOption[],
  country: CountryOption | null
) {
  if (!procedure || applications.length === 0) return procedure?.name || '';
  const app = applications[0];
  const countryText = country ? `${country.name}${country.abbreviation ? ` (${country.abbreviation})` : ''}` : '';
  const applicationName = app.applicationName || app.referenceNo || 'application';
  const filingNumber = app.filingNumber || '-';
  const kind = getServiceKind(service);

  if (kind === 'trademark') {
    return `${procedure.name} of the mark ${applicationName}${app.classNo ? ` in class ${app.classNo}` : ''} with filing no. ${filingNumber} for ----- in ${countryText}.`;
  }

  if (kind === 'patent') {
    return `${procedure.name} of a patent application ${applicationName} with filing no. ${filingNumber} for ----- in ${countryText}.`;
  }

  if (kind === 'design') {
    return `${procedure.name} of a patent application ${applicationName} with filing no. ${filingNumber} for ----- in ${countryText}.`;
  }

  if (kind === 'copyright') {
    return `${procedure.name} of a patent application ${applicationName} with filing no. ${filingNumber} for ----- in ${countryText}.`;
  }

  return `${procedure.name} of application ${applicationName} with filing no. ${filingNumber} for ----- in ${countryText}.`;
}

const getPrimaryTrademarkApplication = (applications: ApplicationOption[], service?: ServiceOption | null) =>
  applications.find(
    (application) =>
      /trademark/i.test(application.serviceType || '') ||
      /trademark/i.test(service?.category || '') ||
      /trademark/i.test(service?.name || '')
  ) || null;

const getPrimaryMarkImage = (applications: ApplicationOption[], service?: ServiceOption | null) => {
  const application = getPrimaryTrademarkApplication(applications, service);
  return application?.markImage || application?.imageUrl || '';
};

function calculateRow(item: InvoiceItem, vatable: boolean, vatPercentage: number): InvoiceItem {
  const quantity = Math.max(Number(item.quantity || 1), 1);
  const officialFee = Math.max(Number(item.officialFee || 0), 0);
  const attorneyFee = Math.max(Number(item.attorneyFee || 0), 0);
  const vatRate = vatable ? Math.min(Math.max(Number(vatPercentage || 0), 0), 100) : 0;
  const vatAmount = vatable ? attorneyFee * quantity * (vatRate / 100) : 0;
  const total = officialFee * quantity + attorneyFee * quantity + vatAmount;

  return { ...item, quantity, officialFee, attorneyFee, vatPercentage: vatRate, vatAmount, total };
}

function InvoiceDocumentPreview({
  client,
  bank,
  invoiceDate,
  invoiceNumber,
  clientReference,
  applications,
  toAddress,
  subject,
  items,
  totals,
  currency,
  onlinePdfUrl,
  service,
}: {
  client: ClientOption | null;
  bank: BankOption | null;
  invoiceDate: string;
  invoiceNumber: string;
  clientReference: string;
  applications: ApplicationOption[];
  toAddress: string;
  subject: string;
  items: InvoiceItem[];
  totals: { totalVat: number; grandTotal: number };
  currency: string;
  onlinePdfUrl: string;
  service: ServiceOption | null;
}) {
  const applicationNo = applications.map((app) => app.referenceNo || app.filingNumber).filter(Boolean).join(', ') || '-';
  const markImage = getPrimaryMarkImage(applications, service);
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    let mounted = true;
    async function buildQr() {
      if (!onlinePdfUrl) {
        setQrDataUrl('');
        return;
      }
      try {
        const nextQr = await QRCode.toDataURL(onlinePdfUrl, { margin: 1, width: 220 });
        if (mounted) setQrDataUrl(nextQr);
      } catch {
        if (mounted) setQrDataUrl('');
      }
    }
    buildQr();
    return () => {
      mounted = false;
    };
  }, [onlinePdfUrl]);

  return (
    <Paper
      sx={{
        maxWidth: 980,
        mx: 'auto',
        p: { xs: 2, md: 4 },
        borderRadius: 2,
        border: '1px solid #D8E0F3',
        boxShadow: '0 16px 50px rgba(15, 23, 42, 0.08)',
        color: '#071A5F',
      }}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 220px' }, gap: 2, alignItems: 'start' }}>
        <Box>
          <Typography sx={{ fontSize: 36, fontWeight: 950, letterSpacing: 0, color: '#081A5B' }}>INVOICE</Typography>
          <Box sx={{ width: 84, height: 4, bgcolor: '#2A59FF', mt: 1 }} />
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          {bank?.logoUrl ? (
            <Box component="img" src={bank.logoUrl} alt="Bank logo" sx={{ maxWidth: 86, maxHeight: 64, objectFit: 'contain', mb: 1 }} />
          ) : (
            <Typography sx={{ fontSize: 12, fontWeight: 900 }}>BANK LOGO</Typography>
          )}
          <Typography sx={{ fontSize: 34, fontWeight: 950, color: '#081A5B', mt: 2 }}>{bank?.bankHeader || 'HEADER'}</Typography>
          <Typography sx={{ fontSize: 22, color: '#2A59FF' }}>{bank?.bankDescription || 'ADDRESS'}</Typography>
          <Box sx={{ width: 68, height: 2, bgcolor: '#2A59FF', mx: 'auto', my: 2 }} />
          <Typography sx={{ fontSize: 14, fontWeight: 800 }}>ADDRESS</Typography>
          <Typography sx={{ fontSize: 13 }}>{bank?.bankDescription || '-'}</Typography>
        </Box>
        <Box sx={{ border: '2px solid #081A5B', borderRadius: 2, overflow: 'hidden', textAlign: 'center' }}>
          <Typography sx={{ bgcolor: '#081A5B', color: '#fff', py: 1, fontWeight: 900, fontSize: 12 }}>SCAN TO VIEW INVOICE</Typography>
          <Box sx={{ p: 2, display: 'grid', placeItems: 'center' }}>
            {qrDataUrl ? (
              <Box
                component="img"
                src={qrDataUrl}
                alt="Scan to view invoice PDF"
                sx={{ width: 132, height: 132, objectFit: 'contain', bgcolor: '#FFFFFF', border: '8px solid #fff', outline: '1px solid #CBD5E1' }}
              />
            ) : (
              <Box sx={{ width: 132, height: 132, display: 'grid', placeItems: 'center', bgcolor: '#F8FAFC', border: '1px dashed #CBD5E1' }}>
                <Typography sx={{ fontSize: 11, color: '#64748B', textAlign: 'center' }}>Save invoice first</Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mt: 4 }}>
        <Paper variant="outlined" sx={{ p: 2.5, borderColor: '#C7D2FE', borderRadius: 2 }}>
          <Typography sx={{ display: 'inline-block', bgcolor: '#081A5B', color: '#fff', px: 2, py: 0.75, borderRadius: 0.75, fontWeight: 900 }}>
            BILLED TO
          </Typography>
          <Typography sx={{ mt: 2.5, fontWeight: 900 }}>{client ? clientLabel(client) : '-'}</Typography>
          <Typography sx={{ mt: 2 }}>{toAddress || '-'}</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2.5, borderColor: '#C7D2FE', borderRadius: 2 }}>
          {[
            ['Invoice Date', invoiceDate || '-'],
            ['Invoice No', invoiceNumber || '-'],
            ['Application No', applicationNo],
            ['Client Reference', clientReference || '-'],
          ].map(([label, value]) => (
            <Box key={label} sx={{ display: 'grid', gridTemplateColumns: '150px 20px 1fr', py: 0.85 }}>
              <Typography sx={{ fontWeight: 900 }}>{label}</Typography>
              <Typography sx={{ fontWeight: 900 }}>:</Typography>
              <Typography>{value}</Typography>
            </Box>
          ))}
        </Paper>
      </Box>

      <Paper variant="outlined" sx={{ p: 2.5, borderColor: '#C7D2FE', borderRadius: 2, mt: 2 }}>
        <Typography sx={{ display: 'inline-block', bgcolor: '#081A5B', color: '#fff', px: 2, py: 0.75, borderRadius: 0.75, fontWeight: 900 }}>
          SUBJECT
        </Typography>
        <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: markImage ? { xs: '1fr', sm: '132px 1fr' } : '1fr', gap: 2, alignItems: 'center' }}>
          {markImage && (
            <Box
              component="img"
              src={markImage}
              alt="Trademark mark"
              sx={{ width: 132, height: 86, objectFit: 'contain', border: '1px solid #D8E0F3', borderRadius: 1, bgcolor: '#FFFFFF' }}
            />
          )}
          <Typography sx={{ whiteSpace: 'pre-wrap' }}>{subject || '-'}</Typography>
        </Box>
      </Paper>

      <TableContainer sx={{ mt: 3, border: '1px solid #D8E0F3', borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              {['Procedure', 'Official Fee', 'Attorney Fee', 'Qty', 'VAT', 'Total'].map((header) => (
                <TableCell key={header} sx={{ bgcolor: '#081A5B', color: '#fff', fontWeight: 900 }}>{header}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell sx={{ maxWidth: 330 }}>{item.procedure}</TableCell>
                <TableCell>{item.officialFee.toFixed(2)}</TableCell>
                <TableCell>{item.attorneyFee.toFixed(2)}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>{item.vatAmount.toFixed(2)}</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>{item.total.toFixed(2)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={4} />
              <TableCell sx={{ fontWeight: 900 }}>Totals</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>{currency} {totals.grandTotal.toFixed(2)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4, mt: 3, alignItems: 'center' }}>
        <Paper variant="outlined" sx={{ borderColor: '#C7D2FE', borderRadius: 2, overflow: 'hidden' }}>
          <Typography sx={{ bgcolor: '#081A5B', color: '#fff', px: 2, py: 1, fontWeight: 900 }}>BANK DETAILS</Typography>
          <Box sx={{ p: 2 }}>
            {[
              ['Bank Name', bank?.bankName],
              ['Account Name', bank?.accountName],
              ['Account Number', bank?.accountNumber],
              ['IBAN', bank?.iban],
              ['SWIFT', bank?.swift],
            ].map(([label, value]) => (
              <Box key={label} sx={{ display: 'grid', gridTemplateColumns: '140px 18px 1fr', py: 0.25 }}>
                <Typography>{label}</Typography>
                <Typography>:</Typography>
                <Typography>{value || '-'}</Typography>
              </Box>
            ))}
          </Box>
        </Paper>
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: 28, fontFamily: 'cursive' }}>Signature</Typography>
          <Box sx={{ width: 260, height: 2, bgcolor: '#2A59FF', mx: 'auto', my: 1 }} />
          <Typography sx={{ fontWeight: 900 }}>Mohammad Saleh Alotaishan</Typography>
          <Typography>Signature</Typography>
        </Box>
      </Box>
    </Paper>
  );
}

export default function ClientInvoiceCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get('id');
  const pageMode = searchParams.get('mode') === 'view' ? 'view' : searchParams.get('mode') === 'edit' ? 'edit' : 'create';
  const readOnly = pageMode === 'view';
  const activeInvoiceId = invoiceId;
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [procedures, setProcedures] = useState<ProcedureOption[]>([]);
  const [applications, setApplications] = useState<ApplicationOption[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [client, setClient] = useState<ClientOption | null>(null);
  const [service, setService] = useState<ServiceOption | null>(null);
  const [country, setCountry] = useState<CountryOption | null>(null);
  const [procedure, setProcedure] = useState<ProcedureOption | null>(null);
  const [selectedApplications, setSelectedApplications] = useState<ApplicationOption[]>([]);
  const [bank, setBank] = useState<BankOption | null>(null);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [pdfAccessToken, setPdfAccessToken] = useState('');
  const [clientReference, setClientReference] = useState('');
  const [toAddress, setToAddress] = useState('');
  // application text removed per UI update
  const [subject, setSubject] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [vatable, setVatable] = useState(false);
  const [vatPercentage, setVatPercentage] = useState(5);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [priceRuleDialogOpen, setPriceRuleDialogOpen] = useState(false);
  const [creatingPriceRule, setCreatingPriceRule] = useState(false);
  const [priceRuleDraft, setPriceRuleDraft] = useState({
    officialFee: '0',
    attorneyFee: '0',
    classFee: '0',
  });
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [clientDraft, setClientDraft] = useState({
    assignedId: '',
    name: '',
    // companyName removed per UI request
    email: '',
    phone: '',
    country: '',
    address: '',
    type: 'Direct',
  });
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [createdInvoicesOpen, setCreatedInvoicesOpen] = useState(false);
  const [procedureDialogOpen, setProcedureDialogOpen] = useState(false);
  const [creatingProcedure, setCreatingProcedure] = useState(false);
  const [procedureDraft, setProcedureDraft] = useState({
    name: '',
    description: '',
  });
  const [imageEditOpen, setImageEditOpen] = useState(false);
  const [imageEditSource, setImageEditSource] = useState('');
  const [imageEditAppId, setImageEditAppId] = useState<string | null>(null);
  const [imageSaving, setImageSaving] = useState(false);
  const [pendingApplicationIds, setPendingApplicationIds] = useState<string[]>([]);
  const { user } = useAuthContext();

  const selectedImageApplication = selectedApplications.find((app) => app._id === imageEditAppId) || null;

  const isTrademarkApplication = (application: ApplicationOption) =>
    /trademark/i.test(application.serviceType || '') ||
    /trademark/i.test(service?.category || '') ||
    /trademark/i.test(service?.name || '');

  const openImageEditModal = (application: ApplicationOption) => {
    setImageEditAppId(application._id);
    setImageEditSource(application.markImage || application.imageUrl || '');
    setImageEditOpen(true);
  };

  const closeImageEditModal = () => {
    setImageEditOpen(false);
    setImageEditAppId(null);
    setImageEditSource('');
  };

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageEditSource(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const saveImageUpdate = () => {
    if (!imageEditAppId) return;
    const currentApp = selectedApplications.find((a) => a._id === imageEditAppId) || null;
    (async () => {
      setImageSaving(true);
      try {
        if (currentApp) {
          const moduleType = (service?.category || service?.name || 'Trademark') as any;
          const payload = {
            moduleType,
            clientId: client?._id || '',
            countryId: country?._id || '',
            aiptReferenceId: imageEditAppId,
            aiptReference: currentApp.referenceNo || '',
            classNo: currentApp.classNo,
            filingNumber: currentApp.filingNumber || '',
            applicationName: currentApp.applicationName || currentApp.referenceNo || '',
            allowDuplicateFilingNumber: false,
            markImage: imageEditSource,
          } as any;

          if (currentApp.applicationId) {
            await updateServiceRecord(currentApp.applicationId, payload);
          } else {
            await createServiceRecord(payload);
          }
        }
        setSelectedApplications((current) =>
          current.map((app) => (app._id === imageEditAppId ? { ...app, markImage: imageEditSource, imageUrl: imageEditSource } : app))
        );
        closeImageEditModal();
        showSuccessToast('Trademark registration image updated.');
      } catch (err) {
        showErrorToast(err instanceof Error ? err.message : 'Failed to save trademark image.');
      } finally {
        setImageSaving(false);
      }
    })();
  };

  useEffect(() => {
    let mounted = true;
    async function loadLookups() {
      try {
        setLoading(true);
        const [clientData, serviceData, countryData, procedureData, bankData] = await Promise.all([
          getJson<{ clients: ClientOption[] }>('/api/clients?all=true&limit=100'),
          getJson<{ services: ServiceOption[] }>('/api/services?limit=100'),
          getJson<{ countries: CountryOption[] }>('/api/countries?limit=100'),
          getJson<{ procedures: ProcedureOption[] }>('/api/procedures?all=true'),
          getJson<{ banks: BankOption[] }>('/api/banks'),
        ]);
        if (!mounted) return;
        setClients(clientData.clients || []);
        setServices(serviceData.services || []);
        setCountries(countryData.countries || []);
        setProcedures(procedureData.procedures || []);
        setBanks(bankData.banks || []);
      } catch (error) {
        showErrorToast(error instanceof Error ? error.message : 'Failed to load invoice data.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadLookups();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!invoiceId || loading) return;
    let mounted = true;

    async function loadInvoice() {
      try {
        const data = await getJson<{ invoice: SavedInvoice }>(`/api/invoices/${invoiceId}`);
        if (!mounted) return;
        const invoice = data.invoice;
        const nextClient = clients.find((item) => item._id === invoice.clientId) || null;
        const nextService = services.find((item) => item._id === invoice.serviceId) || null;
        const nextCountry = countries.find((item) => item._id === invoice.countryId) || null;
        const nextProcedure = procedures.find((item) => item._id === invoice.procedureId) || null;
        const nextBank = banks.find((item) => item._id === invoice.bankId) || null;

        setClient(nextClient);
        setService(nextService);
        setCountry(nextCountry);
        setProcedure(nextProcedure);
        setBank(nextBank);
        setInvoiceNumber(invoice.invoiceNumber || '');
        setPdfAccessToken(invoice.pdfAccessToken || '');
        setInvoiceDate(invoice.invoiceDate ? invoice.invoiceDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
        setClientReference(invoice.clientReference || '');
        setToAddress(invoice.toAddress || '');
        setSubject(invoice.subject || '');
        setCurrency(invoice.currency || nextBank?.currency || 'USD');
        setVatable(Boolean(invoice.vatable));
        setVatPercentage(Number(invoice.vatPercentage ?? 0));
        setItems(
          (invoice.items || []).map((item, index) => ({
            ...item,
            id: item.id || `${invoice.id}-item-${index}`,
          }))
        );
        setPendingApplicationIds(invoice.applicationIds || []);
      } catch (error) {
        showErrorToast(error instanceof Error ? error.message : 'Failed to load invoice.');
      }
    }

    loadInvoice();
    return () => {
      mounted = false;
    };
  }, [banks, clients, countries, invoiceId, loading, procedures, services]);

  useEffect(() => {
    if (invoiceId) return;
    setToAddress(client?.address || '');
  }, [client, invoiceId]);

  useEffect(() => {
    if (invoiceId) return;
    setSubject(buildInvoiceSubject(service, procedure, selectedApplications, country));
  }, [country, invoiceId, procedure, selectedApplications, service]);

  useEffect(() => {
    if (bank?.currency) setCurrency(bank.currency);
  }, [bank]);

  useEffect(() => {
    let mounted = true;
    async function loadApplications() {
      if (!invoiceId) setSelectedApplications([]);
      if (!client || !country) {
        setApplications([]);
        return;
      }
      try {
        setApplicationsLoading(true);
        const serviceType = (service?.category || service?.name || '').trim();
        const params = new URLSearchParams({ clientId: client._id, countryId: country._id, serviceType });
        const data = await getJson<{ applications: ApplicationOption[] }>(`/api/applications?${params.toString()}`);
        let nextApplications = data.applications || [];
        if (invoiceId && pendingApplicationIds.length > 0) {
          const savedParams = new URLSearchParams({ ids: pendingApplicationIds.join(',') });
          const savedData = await getJson<{ applications: ApplicationOption[] }>(`/api/applications?${savedParams.toString()}`);
          const byId = new Map<string, ApplicationOption>();
          [...nextApplications, ...(savedData.applications || [])].forEach((application) => {
            byId.set(application._id, application);
          });
          nextApplications = Array.from(byId.values());
        }
        if (mounted) setApplications(nextApplications);
      } catch (error) {
        showErrorToast(error instanceof Error ? error.message : 'Failed to load applications.');
      } finally {
        if (mounted) setApplicationsLoading(false);
      }
    }
    loadApplications();
    return () => {
      mounted = false;
    };
  }, [client, country, invoiceId, pendingApplicationIds, service]);

  useEffect(() => {
    if (pendingApplicationIds.length === 0 || applications.length === 0) return;
    const selected = applications.filter(
      (application) =>
        pendingApplicationIds.includes(application._id) ||
        (application.applicationId ? pendingApplicationIds.includes(application.applicationId) : false)
    );
    setSelectedApplications(selected);
  }, [applications, pendingApplicationIds]);

  // removed application text updater

  useEffect(() => {
    let mounted = true;
    async function generateNumber() {
      if (invoiceId) return;
      if (!client || !service || !country || !invoiceDate) {
        setInvoiceNumber('');
        return;
      }
      try {
        const params = new URLSearchParams({
          clientId: client._id,
          serviceId: service._id,
          countryId: country._id,
          invoiceDate,
        });
        const data = await getJson<{ invoiceNumber: string }>(`/api/invoices/next-number?${params.toString()}`);
        if (mounted) setInvoiceNumber(data.invoiceNumber);
      } catch (error) {
        showErrorToast(error instanceof Error ? error.message : 'Failed to generate invoice number.');
      }
    }
    generateNumber();
    return () => {
      mounted = false;
    };
  }, [client, country, invoiceDate, invoiceId, service]);

  useEffect(() => {
    setItems((current) => current.map((item) => calculateRow(item, vatable, vatPercentage)));
  }, [vatable, vatPercentage]);

  const filteredItems = useMemo(() => {
    const query = itemSearch.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      [item.item, item.country, item.procedure].some((value) => value.toLowerCase().includes(query))
    );
  }, [itemSearch, items]);

  const pagedItems = filteredItems.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const totals = useMemo(
    () => ({
      subtotalOfficialFee: items.reduce((sum, item) => sum + item.officialFee * item.quantity, 0),
      subtotalAttorneyFee: items.reduce((sum, item) => sum + item.attorneyFee * item.quantity, 0),
      totalVat: items.reduce((sum, item) => sum + item.vatAmount, 0),
      grandTotal: items.reduce((sum, item) => sum + item.total, 0),
    }),
    [items]
  );
  const selectedCurrency = useMemo(
    () => currencyOptions.find((option) => option.value === currency) || null,
    [currency]
  );

  const selectedVatableOption = useMemo(
    () => vatableOptions.find((option) => option.value === vatable) || vatableOptions[0],
    [vatable]
  );

  const methodOptions = useMemo(() => {
    if (!service) return procedures;
    const sid = String((service as any)._id || service._id || '');
    return procedures.filter((p) => {
      const pSvcId = String((p as any).serviceId || (p as any).serviceId || '');
      return (
        (pSvcId && pSvcId === sid) ||
        String((p as any).serviceCategory || '').toLowerCase() === String(service.category || '').toLowerCase() ||
        String((p as any).serviceName || '').toLowerCase() === String(service.name || '').toLowerCase()
      );
    });
  }, [procedures, service]);

  const selectedContextIsComplete = () => {
    if (!client) return 'Client is required.';
    if (!service) return 'Project is required.';
    if (!country) return 'Country is required.';
    if (!procedure) return 'Method is required.';
    return '';
  };

  const findMatchingPricingRule = async () => {
    const validationError = selectedContextIsComplete();
    if (validationError || !client || !service || !country || !procedure) {
      throw new Error(validationError || 'Complete the invoice selections first.');
    }

    const params = new URLSearchParams({
      category: service.category,
      country: country.abbreviation || country.name,
      clientId: client._id,
      status: 'active',
      limit: '100',
    });
    const data = await getJson<{ pricingRules: PricingRuleOption[] }>(`/api/pricing-rules?${params.toString()}`);
    const matching = (data.pricingRules || []).filter(
      (rule) => rule.procedureName.toLowerCase() === procedure.name.toLowerCase()
    );

    return (
      matching.find((rule) => String(rule.clientId || '') === client._id) ||
      matching.find((rule) => !rule.clientId) ||
      null
    );
  };

  const addPricingRuleToItems = (rule: PricingRuleOption) => {
    if (!country || !procedure) return;

    const duplicate = items.some(
      (item) => item.countryId === country._id && item.procedureId === procedure._id
    );
    if (duplicate && !window.confirm('This country and method already exists. Add it again?')) return;

    setItems((current) => [
      ...current,
      calculateRow(
        {
          id: crypto.randomUUID(),
          pricingRuleId: rule._id,
          countryId: country._id,
          procedureId: procedure._id,
          item: `${country.name} - ${procedure.name}`,
          country: rule.countryName || country.name,
          procedure: rule.procedureName || procedure.name,
          officialFee: Number(rule.officialFee || 0),
          attorneyFee: Number(rule.attorneyFee || 0),
          quantity: 1,
          vatPercentage: vatable ? vatPercentage : 0,
          vatAmount: 0,
          total: 0,
        },
        vatable,
        vatPercentage
      ),
    ]);
    showSuccessToast('Pricing rule added to invoice items.');
  };

  const handleNewItem = async () => {
    const validationError = selectedContextIsComplete();
    if (validationError) {
      showWarningToast(validationError);
      return;
    }

    try {
      const rule = await findMatchingPricingRule();
      if (rule) {
        addPricingRuleToItems(rule);
        return;
      }

      setPriceRuleDraft({ officialFee: '0', attorneyFee: '0', classFee: '0' });
      setPriceRuleDialogOpen(true);
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : 'Failed to check pricing rules.');
    }
  };

  const createPriceRuleAndAddItem = async () => {
    if (!client || !service || !country || !procedure) {
      showWarningToast('Complete the invoice selections first.');
      return;
    }

    const officialFee = Number(priceRuleDraft.officialFee);
    const attorneyFee = Number(priceRuleDraft.attorneyFee);
    const classFee = Number(priceRuleDraft.classFee);
    if (![officialFee, attorneyFee, classFee].every((value) => Number.isFinite(value) && value >= 0)) {
      showWarningToast('Fees must be non-negative numbers.');
      return;
    }

    try {
      setCreatingPriceRule(true);
      const response = await fetch('/api/pricing-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          clientId: client._id,
          serviceCategory: service.category,
          countryId: country._id,
          procedureId: procedure._id,
          officialFee,
          attorneyFee,
          classFee,
          isActive: true,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to create pricing rule.');

      setPriceRuleDialogOpen(false);
      addPricingRuleToItems(data as PricingRuleOption);
      showSuccessToast('Pricing rule created.');
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : 'Failed to create pricing rule.');
    } finally {
      setCreatingPriceRule(false);
    }
  };

  const generateFees = handleNewItem;

  const createClientAndSelect = async () => {
    if (!clientDraft.name.trim()) {
      showWarningToast('Client name is required.');
      return;
    }

    try {
      setCreatingClient(true);
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          assignedId: clientDraft.assignedId.trim() || undefined,
          name: clientDraft.name.trim(),
          email: clientDraft.email.trim() || undefined,
          phone: clientDraft.phone.trim() || undefined,
          country: clientDraft.country.trim() || undefined,
          address: clientDraft.address.trim() || undefined,
          type: clientDraft.type,
          isActive: true,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.details || 'Failed to create client.');

      const createdClient = data as ClientOption;
      setClients((current) => [createdClient, ...current.filter((item) => item._id !== createdClient._id)]);
      setClient(createdClient);
      setClientDialogOpen(false);
      setClientDraft({ assignedId: '', name: '', email: '', phone: '', country: '', address: '', type: 'Direct' });
      setValidationErrors((current) => ({ ...current, client: '' }));
      showSuccessToast('Client created and selected.');
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : 'Failed to create client.');
    } finally {
      setCreatingClient(false);
    }
  };

  const updateClientAndSelect = async () => {
    if (!editingClientId) return;
    if (!clientDraft.name.trim()) {
      showWarningToast('Client name is required.');
      return;
    }

    try {
      setCreatingClient(true);
      const payload = {
        assignedId: clientDraft.assignedId.trim() || undefined,
        name: clientDraft.name.trim(),
        email: clientDraft.email.trim() || undefined,
        phone: clientDraft.phone.trim() || undefined,
        country: clientDraft.country.trim() || undefined,
        address: clientDraft.address.trim() || undefined,
        type: clientDraft.type,
        isActive: true,
      } as any;

      const updated = await clientsService.update(editingClientId, payload);
      setClients((current) => [updated, ...current.filter((item) => item._id !== updated._id)]);
      setClient(updated as ClientOption);
      setClientDialogOpen(false);
      setEditingClientId(null);
      setClientDraft({ assignedId: '', name: '', email: '', phone: '', country: '', address: '', type: 'Direct' });
      setValidationErrors((current) => ({ ...current, client: '' }));
      showSuccessToast('Client updated and selected.');
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : 'Failed to update client.');
    } finally {
      setCreatingClient(false);
    }
  };

  const createProcedureAndSelect = async () => {
    if (!procedureDraft.name.trim()) {
      showWarningToast('Procedure name is required.');
      return;
    }
    if (!service) {
      showWarningToast('Select a project first.');
      return;
    }

    try {
      setCreatingProcedure(true);
      const response = await fetch('/api/procedures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name: procedureDraft.name.trim(),
          description: procedureDraft.description.trim() || undefined,
          serviceId: service._id,
          countryId: country?._id,
          isActive: true,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to create procedure.');

      const createdProcedure = data as ProcedureOption;
      setProcedures((current) => [createdProcedure, ...current.filter((item) => item._id !== createdProcedure._id)]);
      setProcedure(createdProcedure);
      setProcedureDialogOpen(false);
      setProcedureDraft({ name: '', description: '' });
      setValidationErrors((current) => ({ ...current, procedure: '' }));
      showSuccessToast('Procedure created and selected.');
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : 'Failed to create procedure.');
    } finally {
      setCreatingProcedure(false);
    }
  };

  const updateItem = (id: string, updates: Partial<InvoiceItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? calculateRow({ ...item, ...updates }, vatable, vatPercentage) : item))
    );
  };

  const resetInvoiceForm = () => {
    setClient(null);
    setService(null);
    setCountry(null);
    setProcedure(null);
    setSelectedApplications([]);
    setPendingApplicationIds([]);
    setBank(null);
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setInvoiceNumber('');
    setPdfAccessToken('');
    setClientReference('');
    setToAddress('');
    setSubject('');
    setCurrency('USD');
    setVatable(false);
    setVatPercentage(5);
    setItems([]);
    setItemSearch('');
    setPage(0);
    setValidationErrors({});
  };

  const getValidationErrors = (confirming: boolean) => {
    const errors: Record<string, string> = {};
    if (!client) errors.client = 'Client is required.';
    else if (!String(client.assignedId || '').trim()) errors.client = 'Assigned ID is required on the client profile.';
    if (!service) errors.service = 'Service is required.';
    if (!country) errors.country = 'Country is required.';
    if (!procedure) errors.procedure = 'Method is required.';
    if (!invoiceDate) errors.invoiceDate = 'Date of invoice is required.';
    if (!invoiceNumber) errors.invoiceNumber = 'Invoice number is required.';
    if (!subject.trim()) errors.subject = 'Subject is required.';
    if (items.length === 0) errors.items = 'At least one invoice item is required.';
    if (!bank) errors.bank = 'Bank is required.';
    if (!Number.isFinite(Number(vatPercentage)) || vatPercentage < 0 || vatPercentage > 100) {
      errors.vatPercentage = 'VAT percentage must be between 0 and 100.';
    } else if (vatable && Number(vatPercentage) <= 0) {
      errors.vatPercentage = 'VAT percentage is required when invoice is vatable.';
    }
    return errors;
  };

  const saveInvoice = async (status: 'Draft' | 'Confirmed') => {
    const nextValidationErrors = getValidationErrors(status === 'Confirmed');
    setValidationErrors(nextValidationErrors);
    const firstError = Object.values(nextValidationErrors)[0];
    if (firstError) {
      showWarningToast(firstError);
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(invoiceId ? `/api/invoices/${invoiceId}` : '/api/invoices', {
        method: invoiceId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          clientId: client?._id,
          serviceId: service?._id,
          countryId: country?._id,
          procedureId: procedure?._id,
          clientReference,
          invoiceDate,
          invoiceNumber,
          toAddress,
          applicationIds: selectedApplications.map((item) => item._id),
          subject,
          method: procedure?.name,
          clientName: client ? clientLabel(client) : '',
          items,
          bankId: bank?._id,
          bankName: bank?.bankName,
          currency,
          vatable,
          vatPercentage,
          ...totals,
          status,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to save invoice.');
      showSuccessToast(invoiceId ? 'Invoice updated successfully.' : status === 'Confirmed' ? 'Invoice created successfully.' : 'Invoice save draft successfully.');
      const savedInvoice = data.invoice as SavedInvoice | undefined;
      if (!invoiceId && status === 'Confirmed' && savedInvoice?.id) {
        router.replace(`/admin/invoice/create-new?id=${savedInvoice.id}&mode=view`);
        return;
      }
      resetInvoiceForm();
      if (invoiceId) router.replace('/admin/invoice/create-new');
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : 'Failed to save invoice.');
    } finally {
      setSaving(false);
    }
  };

  const downloadInvoicePdf = async () => {
    if (!client) {
      showWarningToast('Client details are required to generate the invoice PDF.');
      return;
    }

    try {
      setDownloadingPdf(true);
      const [jsPDF, autoTable] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
      const doc = new jsPDF.jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 28;
      const invoiceNo = invoiceNumber || 'DRAFT';
      const onlinePdfUrl = buildInvoicePdfUrl(activeInvoiceId, pdfAccessToken, true) || (typeof window !== 'undefined' ? window.location.href : '');
      const qrDataUrl = onlinePdfUrl ? await QRCode.toDataURL(onlinePdfUrl, { margin: 1, width: 180 }) : '';
      const markImage = getPrimaryMarkImage(selectedApplications, service);
      const recipientText = toAddress || clientLabel(client);
      const aiptRef = selectedApplications.map((app) => app.referenceNo).filter(Boolean).join(', ');
      const applicationRef = selectedApplications
        .map((app) => app.applicationName || app.filingNumber || app.referenceNo)
        .filter(Boolean)
        .join(', ');
      const approvedBy = user?.name || '—';
      const ownerName = user?.name || '—';

      let companyDetails: CompanyDetail[] = [];
      try {
        const response = await companyDetailsService.list({ page: 1, limit: 10 });
        companyDetails = response.companyDetails || [];
      } catch {
        companyDetails = [];
      }

      const company = companyDetails.find((detail) => detail.isActive !== false) || companyDetails[0] || null;
      const companyLines = getReportCompanyLines(company);
      const footerLines = getReportFooterLines(company);
      let logoLayout: { dataUrl: string; width: number; height: number } | null = null;
      let markImageLayout: { dataUrl: string; width: number; height: number } | null = null;
      try {
        logoLayout = await getReportImageLayout(getReportCompanyLogoUrl(company), 140, 70);
      } catch {
        logoLayout = null;
      }
      try {
        markImageLayout = markImage ? await getReportImageLayout(markImage, 92, 62) : null;
      } catch {
        markImageLayout = null;
      }

      const headerY = margin;
      if (logoLayout) {
        try {
          doc.addImage(logoLayout.dataUrl, getReportPdfImageFormat(logoLayout.dataUrl), margin, headerY, logoLayout.width, logoLayout.height);
        } catch {
          // ignore image rendering issues
        }
      }

      const headerTextX = margin + (logoLayout ? logoLayout.width + 16 : 0);
      const headerTextY = headerY + 16;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(companyLines[0] || 'AIPT', headerTextX, headerTextY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const detailTextY = headerTextY + 16;
      companyLines.slice(1).forEach((line, index) => {
        doc.text(line, headerTextX, detailTextY + index * 12);
      });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24);
      doc.text('INVOICE', pageWidth - margin, headerY + 24, { align: 'right' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Invoice No: ${invoiceNo}`, pageWidth - margin, headerY + 40, { align: 'right' });
      doc.text(`Date: ${invoiceDate || new Date().toISOString().slice(0, 10)}`, pageWidth - margin, headerY + 54, { align: 'right' });
      if (qrDataUrl) {
        doc.addImage(qrDataUrl, 'PNG', pageWidth - margin - 68, headerY + 66, 68, 68);
        doc.setFontSize(7);
        doc.text('Scan to view online PDF', pageWidth - margin, headerY + 144, { align: 'right' });
      }

      const sectionTop = headerY + Math.max(logoLayout?.height || 0, 70) + 20;
      const recipientLeftX = margin;
      const recipientWidth = pageWidth * 0.55 - margin;
      const infoLeftX = pageWidth * 0.55;
      const infoWidth = pageWidth - margin - infoLeftX;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('BILL TO', recipientLeftX, sectionTop);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(recipientText, recipientLeftX, sectionTop + 14, { maxWidth: recipientWidth });

      const infoRows: Array<[string, string]> = [
        ['AIPT Ref', aiptRef || '-'],
        ['Application Ref', applicationRef || '-'],
        ['Subject', subject || '-'],
        ['Approved By', approvedBy],
        ['Owner Name', ownerName],
      ];

      infoRows.forEach(([label, value], index) => {
        const rowY = sectionTop + index * 14;
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, infoLeftX, rowY);
        doc.setFont('helvetica', 'normal');
        doc.text(value, infoLeftX + 76, rowY);
      });

      const tableStartY = sectionTop + infoRows.length * 14 + 18;
      autoTable.default(doc, {
        head: [[
          'Item',
          'Procedure',
          'Official Fee',
          'Attorney Fee',
          'Qty',
          'VAT %',
          'VAT Amount',
          'Total',
        ]],
        body: items.map((item) => [
          item.item,
          item.procedure,
          item.officialFee.toFixed(2),
          item.attorneyFee.toFixed(2),
          String(item.quantity),
          item.vatPercentage.toFixed(2),
          item.vatAmount.toFixed(2),
          item.total.toFixed(2),
        ]),
        startY: tableStartY,
        styles: { fontSize: 9 },
        headStyles: { fillColor: '#0B1739', textColor: '#FFFFFF' },
        alternateRowStyles: { fillColor: '#F8FAFC' },
        foot: [[
          '',
          '',
          '',
          '',
          '',
          'Totals',
          totals.totalVat.toFixed(2),
          totals.grandTotal.toFixed(2),
        ]],
        footStyles: { fillColor: '#E2E8F0', textColor: '#0F172A' },
        theme: 'striped',
      });

      const finalY = (doc as any).lastAutoTable?.finalY || tableStartY + 20;
      const notesY = finalY + 24;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Notes', margin, notesY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const notesText = subject ? subject : clientReference ? clientReference : 'No notes provided.';
      if (markImageLayout) {
        try {
          doc.addImage(markImageLayout.dataUrl, getReportPdfImageFormat(markImageLayout.dataUrl), margin, notesY + 16, markImageLayout.width, markImageLayout.height);
        } catch {
          // ignore image rendering issues
        }
      }
      doc.text(notesText, margin + (markImageLayout ? 108 : 0), notesY + 18, {
        maxWidth: pageWidth - margin * 2 - (markImageLayout ? 108 : 0),
      });

      const bankLines = [
        bank?.bankName || '-',
        bank?.accountName ? `Account Name: ${bank.accountName}` : '',
        bank?.accountNumber ? `Account No: ${bank.accountNumber}` : '',
        bank?.iban ? `IBAN: ${bank.iban}` : '',
        bank?.swift ? `SWIFT: ${bank.swift}` : '',
      ].filter(Boolean);
      const bankY = notesY + (markImageLayout ? 92 : 48);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Bank Details', margin, bankY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      bankLines.forEach((line, index) => {
        doc.text(line, margin, bankY + 14 + index * 12);
      });

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      const footerY = doc.internal.pageSize.getHeight() - 30;
      doc.text(footerLines[0], margin, footerY);
      doc.text(footerLines[1], margin, footerY + 12);

      doc.save(`${toInvoicePdfFileName(invoiceNo, clientLabel(client))}.pdf`);
      showSuccessToast('Invoice PDF downloaded.');
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : 'Failed to generate PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const downloadFormattedInvoicePdf = async () => {
    if (!client) {
      showWarningToast('Client details are required to generate the invoice PDF.');
      return;
    }

    try {
      setDownloadingPdf(true);
      const [jsPDF, autoTable] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
      const doc = new jsPDF.jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 22;
      const navy = '#071A5F';
      const accent = '#2A59FF';
      const border = '#C9D4F4';
      const soft = '#EEF3FF';
      const invoiceNo = invoiceNumber || 'DRAFT';
      const onlinePdfUrl = buildInvoicePdfUrl(activeInvoiceId, pdfAccessToken, true) || (typeof window !== 'undefined' ? window.location.href : '');
      const qrDataUrl = onlinePdfUrl ? await QRCode.toDataURL(onlinePdfUrl, { margin: 1, width: 180 }) : '';
      const markImage = getPrimaryMarkImage(selectedApplications, service);
      const applicationNo = selectedApplications.map((app) => app.referenceNo || app.filingNumber).filter(Boolean).join(', ') || '-';
      const applicationRef = selectedApplications
        .map((app) => app.applicationName || app.filingNumber || app.referenceNo)
        .filter(Boolean)
        .join(', ');

      let bankLogoLayout: { dataUrl: string; width: number; height: number } | null = null;
      let markImageLayout: { dataUrl: string; width: number; height: number } | null = null;
      try {
        bankLogoLayout = await getReportImageLayout(bank?.logoUrl || '', 108, 52);
      } catch {
        bankLogoLayout = null;
      }
      try {
        markImageLayout = markImage ? await getReportImageLayout(markImage, 94, 64) : null;
      } catch {
        markImageLayout = null;
      }

      doc.setTextColor(navy);
      doc.setDrawColor(border);
      doc.setLineWidth(0.8);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(28);
      doc.text('INVOICE', margin, 54);
      doc.setDrawColor(accent);
      doc.setLineWidth(2.2);
      doc.line(margin, 68, margin + 50, 68);

      if (bankLogoLayout) {
        try {
          doc.addImage(
            bankLogoLayout.dataUrl,
            getReportPdfImageFormat(bankLogoLayout.dataUrl),
            (pageWidth - bankLogoLayout.width) / 2,
            26,
            bankLogoLayout.width,
            bankLogoLayout.height
          );
        } catch {
          // Ignore image rendering issues.
        }
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('BANK LOGO', pageWidth / 2, 48, { align: 'center' });
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(25);
      doc.text(bank?.bankHeader || 'HEADER', pageWidth / 2, 94, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(13);
      doc.setTextColor(accent);
      doc.text(bank?.bankDescription || 'ADDRESS', pageWidth / 2, 116, {
        align: 'center',
        maxWidth: 260,
      });
      doc.setTextColor(navy);
      doc.setDrawColor(accent);
      doc.setLineWidth(1);
      doc.line(pageWidth / 2 - 28, 129, pageWidth / 2 + 28, 129);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('ADDRESS', pageWidth / 2, 149, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(bank?.bankDescription || '-', pageWidth / 2, 164, { align: 'center', maxWidth: 220 });

      const qrX = pageWidth - margin - 120;
      doc.setFillColor(navy);
      doc.roundedRect(qrX, 24, 120, 18, 4, 4, 'F');
      doc.setTextColor('#FFFFFF');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('SCAN TO VIEW INVOICE', qrX + 60, 36, { align: 'center' });
      doc.setTextColor(navy);
      doc.setDrawColor(navy);
      doc.roundedRect(qrX, 24, 120, 142, 4, 4);
      if (qrDataUrl) {
        doc.addImage(qrDataUrl, 'PNG', qrX + 18, 54, 84, 84);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.text(activeInvoiceId ? 'Online PDF' : 'Save invoice first', qrX + 60, 152, { align: 'center' });
      }

      const pill = (label: string, x: number, y: number, width: number) => {
        doc.setFillColor(navy);
        doc.roundedRect(x, y, width, 20, 3, 3, 'F');
        doc.setTextColor('#FFFFFF');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(label, x + 8, y + 13);
        doc.setTextColor(navy);
      };

      const card = (x: number, y: number, width: number, height: number) => {
        doc.setDrawColor(border);
        doc.setFillColor('#FFFFFF');
        doc.roundedRect(x, y, width, height, 5, 5, 'FD');
      };

      const metaRow = (label: string, value: string, x: number, y: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(label, x, y);
        doc.text(':', x + 92, y);
        doc.setFont('helvetica', 'normal');
        doc.text(value || '-', x + 116, y, { maxWidth: 130 });
      };

      const cardTop = 190;
      const colGap = 12;
      const cardWidth = (pageWidth - margin * 2 - colGap) / 2;
      card(margin, cardTop, cardWidth, 112);
      pill('BILLED TO', margin + 14, cardTop + 16, 66);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(doc.splitTextToSize(clientLabel(client), cardWidth - 36), margin + 16, cardTop + 62);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(doc.splitTextToSize(toAddress || '-', cardWidth - 36), margin + 16, cardTop + 88);

      const metaX = margin + cardWidth + colGap;
      card(metaX, cardTop, cardWidth, 112);
      metaRow('Invoice Date', invoiceDate || new Date().toISOString().slice(0, 10), metaX + 22, cardTop + 36);
      metaRow('Invoice No', invoiceNo, metaX + 22, cardTop + 60);
      metaRow('Application No', applicationNo || applicationRef || '-', metaX + 22, cardTop + 84);
      metaRow('Client Reference', clientReference || '-', metaX + 22, cardTop + 108);

      const subjectTop = 318;
      card(margin, subjectTop, pageWidth - margin * 2, 84);
      pill('SUBJECT', margin + 14, subjectTop + 14, 58);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      if (markImageLayout) {
        try {
          doc.addImage(markImageLayout.dataUrl, getReportPdfImageFormat(markImageLayout.dataUrl), margin + 16, subjectTop + 42, markImageLayout.width, markImageLayout.height);
        } catch {
          // Ignore image rendering issues.
        }
      }
      const subjectTextX = margin + 16 + (markImageLayout ? 108 : 0);
      const subjectTextWidth = pageWidth - margin * 2 - 40 - (markImageLayout ? 108 : 0);
      doc.text(doc.splitTextToSize(subject || '-', subjectTextWidth), subjectTextX, subjectTop + 54);

      autoTable.default(doc, {
        head: [['Procedure', 'Official Fee', 'Attorney Fee', 'Qty', `VAT (${vatPercentage || 0}%)`, 'Total']],
        body: items.map((item) => [
          item.procedure,
          item.officialFee.toFixed(2),
          item.attorneyFee.toFixed(2),
          String(item.quantity),
          item.vatAmount.toFixed(2),
          item.total.toFixed(2),
        ]),
        startY: 422,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 9, textColor: navy, lineColor: border, lineWidth: 0.5 },
        headStyles: { fillColor: navy, textColor: '#FFFFFF', fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { cellWidth: 190, halign: 'left' },
          1: { halign: 'center' },
          2: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'center', fontStyle: 'bold' },
        },
        foot: [['', '', '', 'Totals', totals.totalVat.toFixed(2), totals.grandTotal.toFixed(2)]],
        footStyles: { fillColor: soft, textColor: navy, fontStyle: 'bold', halign: 'center' },
        theme: 'grid',
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 488;
      const bankY = Math.min(Math.max(finalY + 18, 608), 656);
      card(margin, bankY, 230, 96);
      doc.setFillColor(navy);
      doc.rect(margin, bankY, 230, 18, 'F');
      doc.setTextColor('#FFFFFF');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('BANK DETAILS', margin + 10, bankY + 12);
      doc.setTextColor(navy);
      [
        ['Bank Name', bank?.bankName || '-'],
        ['Account Name', bank?.accountName || '-'],
        ['Account Number', bank?.accountNumber || '-'],
        ['IBAN', bank?.iban || '-'],
        ['SWIFT', bank?.swift || '-'],
      ].forEach(([label, value], index) => {
        const y = bankY + 35 + index * 12;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(label, margin + 10, y);
        doc.text(':', margin + 96, y);
        doc.text(value, margin + 116, y, { maxWidth: 100 });
      });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Signature', pageWidth - 170, bankY + 48, { align: 'center' });
      doc.setDrawColor(navy);
      doc.line(pageWidth - 240, bankY + 70, pageWidth - 100, bankY + 70);
      doc.setFont('helvetica', 'bold');
      doc.text('Mohammad Saleh Alotaishan', pageWidth - 170, bankY + 86, { align: 'center' });

      doc.setFillColor(soft);
      doc.setDrawColor(border);
      doc.roundedRect(margin, pageHeight - 72, pageWidth - margin * 2, 44, 5, 5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Thank you for your business!', margin + 14, pageHeight - 47);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('We appreciate your trust and look forward to working with you again.', margin + 14, pageHeight - 31);
      doc.setFillColor(navy);
      doc.rect(0, pageHeight - 14, pageWidth, 14, 'F');

      doc.save(`${toInvoicePdfFileName(invoiceNo, clientLabel(client))}.pdf`);
      showSuccessToast('Invoice PDF downloaded.');
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : 'Failed to generate PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const confirmDisabled = Boolean(Object.keys(getValidationErrors(true)).length) || saving;
  const onlineInvoicePdfUrl = buildInvoicePdfUrl(activeInvoiceId, pdfAccessToken, true);

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#fff' }}>
      <Topbar
        title={pageMode === 'view' ? 'View Invoice' : pageMode === 'edit' ? 'Edit Invoice' : 'Client Invoice'}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Invoice', href: '/admin/invoice' },
          { label: pageMode === 'view' ? 'View' : pageMode === 'edit' ? 'Edit' : 'Create New' },
        ]}
      />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: { xs: 2, md: 3 }, mt: 2 }}>
        <Button size="small" variant="outlined" onClick={() => setCreatedInvoicesOpen(true)}>
          Created Invoices
        </Button>
      </Box>
      {readOnly && (
        <Box sx={shellSx}>
          <InvoiceDocumentPreview
            client={client}
            bank={bank}
            invoiceDate={invoiceDate}
            invoiceNumber={invoiceNumber}
            clientReference={clientReference}
            applications={selectedApplications}
            toAddress={toAddress}
            subject={subject}
            items={items}
            totals={totals}
            currency={currency}
            onlinePdfUrl={onlineInvoicePdfUrl}
            service={service}
          />
          <Box sx={{ maxWidth: 980, mx: 'auto', mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button variant="outlined" onClick={() => router.back()}>Back</Button>
            <Button variant="contained" color="success" disabled={items.length === 0 || downloadingPdf} onClick={downloadFormattedInvoicePdf}>
              {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}
            </Button>
          </Box>
        </Box>
      )}
      <Box sx={{ ...shellSx, display: readOnly ? 'none' : 'block' }}>
	      <Box sx={{ display: 'none' }}>
        <Typography variant="h5" sx={{ fontSize: 18, fontWeight: 500 }}>
          ▦ Client <Box component="span" sx={{ fontSize: 13 }}>Invoice</Box>
        </Typography>
        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 4, opacity: 0.85 }}>
          {['RECEIVABLES', 'COMPLETED PROJECTS', 'PAID INVOICES'].map((label) => (
            <Typography key={label} variant="caption" sx={{ color: '#fff' }}>
              {label} ▂▃▄▅▆▇
            </Typography>
          ))}
	      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>
          Client <Box component="span" sx={{ fontSize: 13, color: '#475569' }}>Invoice</Box>
        </Typography>
        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 4 }}>
          {['RECEIVABLES', 'COMPLETED PROJECTS', 'PAID INVOICES'].map((label) => (
            <Typography key={label} variant="caption" sx={{ color: '#475569' }}>
              {label}
            </Typography>
          ))}
        </Box>
      </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 1.5 }}>
        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>
            <SearchSelect
              label="Client"
              options={clients}
              value={client}
              onChange={(value) => {
                setClient(value as ClientOption | null);
                setClientReference('');
                setValidationErrors((current) => ({ ...current, client: '' }));
              }}
              getOptionLabel={clientLabel}
              getOptionValue={(option) => option._id}
              loading={loading}
              error={Boolean(validationErrors.client)}
              helperText={validationErrors.client}
            />
          </Box>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  setEditingClientId(null);
                  setClientDraft({ assignedId: '', name: '', email: '', phone: '', country: '', address: '', type: 'Direct' });
                  setClientDialogOpen(true);
                }}
                sx={{ minHeight: 34 }}
              >
                New
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  if (!client) return;
                  setEditingClientId(client._id || null);
                  setClientDraft({
                    assignedId: (client as any).assignedId || '',
                    name: client.name || '',
                    email: (client as any).email || '',
                    phone: (client as any).phone || '',
                    country: (client as any).country || '',
                    address: client.address || '',
                    type: (client as any).type || 'Direct',
                  });
                  setClientDialogOpen(true);
                }}
                sx={{ minHeight: 34 }}
                disabled={!client}
              >
                Edit
              </Button>
            </Box>
        </Box>
        <SearchSelect
          label="Services"
          options={services}
          value={service}
          onChange={(value) => {
            setService(value as ServiceOption | null);
            setProcedure(null);
            setValidationErrors((current) => ({ ...current, service: '' }));
          }}
          getOptionLabel={(option) => option.name}
          getOptionValue={(option) => option._id}
          loading={loading}
          error={Boolean(validationErrors.service)}
          helperText={validationErrors.service}
        />
        <SearchSelect
          label="Country"
          options={countries}
          value={country}
          onChange={(value) => {
            setCountry(value as CountryOption | null);
            setValidationErrors((current) => ({ ...current, country: '' }));
          }}
          getOptionLabel={(option) => `${option.name} (${option.abbreviation})`}
          getOptionValue={(option) => option._id}
          loading={loading}
          error={Boolean(validationErrors.country)}
          helperText={validationErrors.country}
        />

        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>
            <SearchSelect
              label="Method"
              options={methodOptions}
              value={procedure}
              onChange={(value) => {
                setProcedure(value as ProcedureOption | null);
                setValidationErrors((current) => ({ ...current, procedure: '' }));
              }}
              getOptionLabel={(option) =>
                `${option.name}${option.countryName ? ` (${option.countryName})` : ''} • ${option.serviceName || option.serviceCategory}`
              }
              getOptionValue={(option) => option._id}
              loading={loading}
              error={Boolean(validationErrors.procedure)}
              helperText={validationErrors.procedure}
              placeholder="Select a procedure"
            />
          </Box>
          <Button size="small" variant="outlined" onClick={() => setProcedureDialogOpen(true)} sx={{ minHeight: 34 }}>
            New
          </Button>
        </Box>
        <TextField
          label="Application Reference"
          size="small"
          value={clientReference}
          onChange={(event) => setClientReference(event.target.value)}
          sx={fieldSx}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="Date of Invoice"
          size="small"
          type="date"
          value={invoiceDate}
          onChange={(event) => setInvoiceDate(event.target.value)}
          sx={fieldSx}
          error={Boolean(validationErrors.invoiceDate)}
          helperText={validationErrors.invoiceDate}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        <Box sx={{ display: { xs: 'none', md: 'block' } }} />
        <Box sx={{ display: { xs: 'none', md: 'block' } }} />
        <TextField
          label="Invoice Number"
          size="small"
          value={invoiceNumber || `${servicePrefix(service)} ${new Date(invoiceDate).getFullYear()}-`}
          sx={fieldSx}
          error={Boolean(validationErrors.invoiceNumber)}
          helperText={validationErrors.invoiceNumber}
          slotProps={{ input: { readOnly: true }, inputLabel: { shrink: true } }}
        />
      </Box>

      <TextField
        label="To"
        multiline
        minRows={3}
        value={toAddress}
        sx={{ ...fieldSx, mt: 1.5, width: '100%' }}
        slotProps={{ input: { readOnly: true }, inputLabel: { shrink: true } }}
      />

      <SearchSelect
        label="Application"
        multiple
        disabled={!client || !country}
        options={applications}
        value={selectedApplications}
        onChange={(value) => setSelectedApplications((value as ApplicationOption[]) || [])}
        getOptionLabel={(option) => option.referenceNo}
        getOptionValue={(option) => option._id}
        placeholder="Select AIPT references"
      />
      {/* application text removed per request */}

      {selectedApplications.length > 0 && (
        <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1 }}>
          {selectedApplications.map((application) => {
            const imageSrc = application.markImage || application.imageUrl || '';
            const showImageControls = isTrademarkApplication(application);
            return (
              <Paper
                key={application._id}
                sx={{ p: 1, border: '1px solid #E2E8F0', borderRadius: 1.5, boxShadow: 'none', bgcolor: '#F8FAFC', transition: 'transform 120ms ease', '&:hover': { transform: 'translateY(-4px)' } }}
              >
                {showImageControls ? (
                  imageSrc ? (
                    <Box
                      component="img"
                      src={imageSrc}
                      alt={application.referenceNo}
                      onClick={() => openImageEditModal(application)}
                      sx={{
                          width: '100%',
                          height: 56,
                        objectFit: 'contain',
                        bgcolor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: 1,
                        cursor: 'pointer',
                      }}
                    />
                  ) : (
                    <Box
                      onClick={() => openImageEditModal(application)}
                      sx={{
                          width: '100%',
                          height: 56,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: '#FFFFFF',
                        border: '1px dashed #CBD5E1',
                        borderRadius: 1,
                        cursor: 'pointer',
                      }}
                    >
                      <Typography sx={{ color: '#94A3B8', fontSize: 12 }}>
                        Click to edit image
                      </Typography>
                    </Box>
                  )
                ) : null}
                <Typography sx={{ mt: 0.75, fontSize: 12, fontWeight: 800, color: '#0F172A' }}>
                  {application.referenceNo}
                </Typography>
                {(application.applicationName || application.filingNumber) && (
                  <Typography sx={{ fontSize: 11, color: '#64748B' }}>
                    {[application.applicationName, application.filingNumber].filter(Boolean).join(' | ')}
                  </Typography>
                )}
              </Paper>
            );
          })}
        </Box>
      )}

      <TextField
        label="Subject"
        multiline
        minRows={3}
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
        sx={{ ...fieldSx, mt: 1.5, width: '100%' }}
        error={Boolean(validationErrors.subject)}
        helperText={validationErrors.subject}
        slotProps={{ inputLabel: { shrink: true } }}
      />

      <Box sx={{ display: 'flex', gap: 0.75, mt: 1.5 }}>
        {!readOnly && <Button size="small" variant="contained" onClick={handleNewItem}>New Item</Button>}
        {!readOnly && <Button size="small" variant="contained" onClick={generateFees}>Generate Fees</Button>}
      </Box>
      {validationErrors.items && (
        <Typography sx={{ mt: 0.75, color: '#B91C1C', fontSize: 12 }}>
          {validationErrors.items}
        </Typography>
      )}

      <Paper sx={{ mt: 1.5, bgcolor: '#FFFFFF', borderRadius: 2, border: '1px solid #E2E8F0', boxShadow: 'none' }}>
        <Box sx={{ p: 0.5, display: 'flex', justifyContent: 'space-between', gap: 1 }}>
          <TextField
            size="small"
            value={itemSearch}
            onChange={(event) => setItemSearch(event.target.value)}
            placeholder="Search"
            sx={{ ...fieldSx, width: 180 }}
          />
          <TextField select size="small" value={rowsPerPage} onChange={(e) => setRowsPerPage(Number(e.target.value))} sx={{ ...fieldSx, width: 70 }}>
            {[10, 15, 25, 50].map((value) => <option key={value} value={value}>{value}</option>)}
          </TextField>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Procedure', 'Official Fee', 'Attorney Fee', 'Quantity', 'VAT %', 'VAT Amount', 'Total', 'Action'].map((header) => (
                  <TableCell key={header} sx={darkTableHeaderSx}>{header}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ color: '#64748B', textAlign: 'center', py: 2, borderColor: '#E2E8F0' }}>
                    No data available in table
                  </TableCell>
                </TableRow>
              ) : (
                pagedItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell sx={{ color: '#0F172A' }}>{item.procedure}</TableCell>
                    <TableCell><TextField size="small" type="number" value={item.officialFee} onChange={(e) => updateItem(item.id, { officialFee: Number(e.target.value) })} sx={fieldSx} /></TableCell>
                    <TableCell><TextField size="small" type="number" value={item.attorneyFee} onChange={(e) => updateItem(item.id, { attorneyFee: Number(e.target.value) })} sx={fieldSx} /></TableCell>
                    <TableCell><TextField size="small" type="number" value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) })} sx={fieldSx} /></TableCell>
                    <TableCell sx={{ color: '#0F172A' }}>{item.vatPercentage.toFixed(2)}</TableCell>
                    <TableCell sx={{ color: '#0F172A' }}>{item.vatAmount.toFixed(2)}</TableCell>
                    <TableCell sx={{ color: '#0F172A' }}>{item.total.toFixed(2)}</TableCell>
                    <TableCell>
                      <IconButton size="small" color="error" onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))}>
                        <Box component="span" sx={{ fontSize: 16, fontWeight: 800 }}>x</Box>
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={filteredItems.length}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10, 15, 25, 50]}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={(event) => {
            setPage(0);
            setRowsPerPage(Number(event.target.value));
          }}
        sx={{ color: '#0F172A' }}
        />
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 0.5fr 0.5fr' }, gap: 2, mt: 2 }}>
        <SearchSelect
          label="Bank"
          options={banks}
          value={bank}
          onChange={(value) => setBank(value as BankOption | null)}
          getOptionLabel={(option) => option.bankName}
          getOptionValue={(option) => option._id}
          loading={loading}
          error={Boolean(validationErrors.bank)}
          helperText={validationErrors.bank}
        />
        <SearchSelect
          label="Currency"
          options={currencyOptions}
          value={selectedCurrency}
          onChange={(value) => setCurrency((value as CurrencyOption | null)?.value || 'USD')}
          getOptionLabel={(option) => `${option.code} - ${option.name} (${option.symbol})`}
          getOptionValue={(option) => option.value}
        />
        <SearchSelect
          label="Vatable"
          options={vatableOptions}
          value={selectedVatableOption}
          onChange={(value) => setVatable(Boolean((value as VatableOption | null)?.value))}
          getOptionLabel={(option) => option.label}
          getOptionValue={(option) => String(option.value)}
        />
        <TextField
          label="Vat Percentage"
          size="small"
          type="number"
          value={vatPercentage}
          onChange={(event) => {
            setVatPercentage(Number(event.target.value));
            setValidationErrors((current) => ({ ...current, vatPercentage: '' }));
          }}
          sx={fieldSx}
          error={Boolean(validationErrors.vatPercentage)}
          helperText={validationErrors.vatPercentage || 'Auto-calculates VAT amount in the cart table'}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Box>

      {bank && (
        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#475569' }}>
          {[
            bank.accountName && `Account: ${bank.accountName}`,
            bank.accountNumber && `No: ${bank.accountNumber}`,
            bank.iban && `IBAN: ${bank.iban}`,
            bank.swift && `SWIFT: ${bank.swift}`,
          ].filter(Boolean).join(' | ') || bank.bankDescription}
        </Typography>
      )}

        <Box sx={{ display: 'flex', gap: 0.75, mt: 1.5, flexWrap: 'wrap' }}>
        {!readOnly && <Button size="small" variant="contained" onClick={() => saveInvoice('Draft')} disabled={saving}>Save Draft</Button>}
        {!readOnly && (
          <Button size="small" variant="contained" onClick={() => setConfirmDialogOpen(true)} disabled={confirmDisabled} startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}>
            Confirm
          </Button>
        )}
        <Button
          size="small"
          variant="contained"
          color="success"
          disabled={items.length === 0 || downloadingPdf}
          onClick={downloadFormattedInvoicePdf}
        >
          {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}
        </Button>
        <Button size="small" variant="outlined" color="inherit" onClick={() => router.back()}>{readOnly ? 'Back' : 'Cancel'}</Button>
        <Typography sx={{ ml: 'auto', alignSelf: 'center', fontWeight: 700 }}>
          Grand Total: {currency} {totals.grandTotal.toFixed(2)}
        </Typography>
      </Box>

      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={dialogTitleSx}>Confirm Invoice</DialogTitle>
        <DialogContent sx={{ bgcolor: '#FFFFFF', pt: 2.5 }}>
          <Box sx={{ display: 'grid', gap: 1.25 }}>
            <Typography><strong>Client:</strong> {client ? clientLabel(client) : '-'}</Typography>
            <Typography><strong>Invoice No:</strong> {invoiceNumber || '-'}</Typography>
            <Typography><strong>Invoice Date:</strong> {invoiceDate}</Typography>
            <Typography><strong>Grand Total:</strong> {currency} {totals.grandTotal.toFixed(2)}</Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#FFFFFF', px: 3, pb: 2 }}>
          <Button size="small" variant="outlined" onClick={() => setConfirmDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button size="small" variant="contained" onClick={async () => { await saveInvoice('Confirmed'); setConfirmDialogOpen(false); }} disabled={saving}>
            {saving ? 'Saving...' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={createdInvoicesOpen}
        onClose={() => setCreatedInvoicesOpen(false)}
        fullWidth
        maxWidth="xl"
        slotProps={{ paper: { sx: { borderRadius: 1.5, overflow: 'hidden', height: { xs: '92vh', md: '88vh' } } } }}
      >
        <DialogTitle sx={{ ...dialogTitleSx, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Box>
            <Typography sx={{ fontWeight: 900, fontSize: 18 }}>Created Invoices</Typography>
            <Typography sx={{ color: '#CBD5E1', fontSize: 12 }}>
              Search, filter, sort, open, and download invoice records.
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ bgcolor: '#F8FAFC', p: 2, minHeight: 560 }}>
          <InvoiceTable showActions={true} showToolbar={true} />
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#FFFFFF', px: 3, pb: 2 }}>
          <Button size="small" variant="outlined" onClick={() => setCreatedInvoicesOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={clientDialogOpen} onClose={() => setClientDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={dialogTitleSx}>{editingClientId ? 'Edit Client' : 'Create Client'}</DialogTitle>
        <DialogContent sx={{ bgcolor: '#FFFFFF', pt: 2.5 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            <TextField
              label="Assigned ID"
              size="small"
              value={clientDraft.assignedId}
              onChange={(event) => setClientDraft((current) => ({ ...current, assignedId: event.target.value }))}
              sx={fieldSx}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Client Name"
              size="small"
              value={clientDraft.name}
              onChange={(event) => setClientDraft((current) => ({ ...current, name: event.target.value }))}
              sx={fieldSx}
              required
              slotProps={{ inputLabel: { shrink: true } }}
            />
            {/* Company Name removed per request */}
            <TextField
              label="Email"
              size="small"
              type="email"
              value={clientDraft.email}
              onChange={(event) => setClientDraft((current) => ({ ...current, email: event.target.value }))}
              sx={fieldSx}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Phone"
              size="small"
              value={clientDraft.phone}
              onChange={(event) => setClientDraft((current) => ({ ...current, phone: event.target.value }))}
              sx={fieldSx}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Country"
              size="small"
              value={clientDraft.country}
              onChange={(event) => setClientDraft((current) => ({ ...current, country: event.target.value }))}
              sx={fieldSx}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Type"
              size="small"
              select
              value={clientDraft.type}
              onChange={(event) => setClientDraft((current) => ({ ...current, type: event.target.value }))}
              sx={fieldSx}
              slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
            >
              <option value="Direct">Direct</option>
              <option value="Agent">Agent</option>
            </TextField>
            <TextField
              label="Address"
              size="small"
              multiline
              minRows={3}
              value={clientDraft.address}
              onChange={(event) => setClientDraft((current) => ({ ...current, address: event.target.value }))}
              sx={{ ...fieldSx, gridColumn: { xs: 'auto', sm: '1 / -1' } }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#F8FAFC', px: 3, pb: 2 }}>
          <Button size="small" variant="outlined" color="inherit" onClick={() => setClientDialogOpen(false)} disabled={creatingClient}>
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={editingClientId ? updateClientAndSelect : createClientAndSelect}
            disabled={creatingClient}
          >
            {creatingClient ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={procedureDialogOpen} onClose={() => setProcedureDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={dialogTitleSx}>Create Procedure</DialogTitle>
        <DialogContent sx={{ bgcolor: '#FFFFFF', pt: 2.5 }}>
          <Box sx={{ display: 'grid', gap: 1.5 }}>
            <TextField
              label="Procedure Name"
              size="small"
              value={procedureDraft.name}
              onChange={(event) => setProcedureDraft((current) => ({ ...current, name: event.target.value }))}
              sx={fieldSx}
              required
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Service"
              size="small"
              value={service?.name || 'Select a project first'}
              sx={fieldSx}
              slotProps={{ input: { readOnly: true }, inputLabel: { shrink: true } }}
            />
            <TextField
              label="Country"
              size="small"
              value={country?.name || 'Optional'}
              sx={fieldSx}
              slotProps={{ input: { readOnly: true }, inputLabel: { shrink: true } }}
            />
            <TextField
              label="Description"
              size="small"
              multiline
              minRows={3}
              value={procedureDraft.description}
              onChange={(event) => setProcedureDraft((current) => ({ ...current, description: event.target.value }))}
              sx={fieldSx}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#F8FAFC', px: 3, pb: 2 }}>
          <Button size="small" variant="outlined" color="inherit" onClick={() => setProcedureDialogOpen(false)} disabled={creatingProcedure}>
            Cancel
          </Button>
          <Button size="small" variant="contained" onClick={createProcedureAndSelect} disabled={creatingProcedure}>
            {creatingProcedure ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={priceRuleDialogOpen}
        onClose={() => {
          if (!creatingPriceRule) setPriceRuleDialogOpen(false);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={dialogTitleSx}>
          Create Pricing Rule
        </DialogTitle>
        <DialogContent sx={{ bgcolor: '#FFFFFF', pt: 2.5 }}>
          <Typography sx={{ color: '#334155', fontSize: 13, mb: 2 }}>
            No price rule was found for this client, procedure, and country. Add the fees below to create the rule and add it to this invoice.
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            <TextField
              label="Client"
              size="small"
              value={client ? clientLabel(client) : ''}
              sx={fieldSx}
              slotProps={{ inputLabel: { shrink: true }, input: { readOnly: true } }}
            />
            <TextField
              label="Country"
              size="small"
              value={country?.name || ''}
              sx={fieldSx}
              slotProps={{ inputLabel: { shrink: true }, input: { readOnly: true } }}
            />
            <TextField
              label="Procedure"
              size="small"
              value={procedure?.name || ''}
              sx={fieldSx}
              slotProps={{ inputLabel: { shrink: true }, input: { readOnly: true } }}
            />
            <TextField
              label="Project"
              size="small"
              value={service?.category || service?.name || ''}
              sx={fieldSx}
              slotProps={{ inputLabel: { shrink: true }, input: { readOnly: true } }}
            />
            <TextField
              label="Official Fee"
              size="small"
              type="number"
              value={priceRuleDraft.officialFee}
              onChange={(event) => setPriceRuleDraft((current) => ({ ...current, officialFee: event.target.value }))}
              sx={fieldSx}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Attorney Fee"
              size="small"
              type="number"
              value={priceRuleDraft.attorneyFee}
              onChange={(event) => setPriceRuleDraft((current) => ({ ...current, attorneyFee: event.target.value }))}
              sx={fieldSx}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Class Fee"
              size="small"
              type="number"
              value={priceRuleDraft.classFee}
              onChange={(event) => setPriceRuleDraft((current) => ({ ...current, classFee: event.target.value }))}
              sx={fieldSx}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#F8FAFC', px: 3, pb: 2 }}>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={() => setPriceRuleDialogOpen(false)}
            disabled={creatingPriceRule}
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={createPriceRuleAndAddItem}
            disabled={creatingPriceRule}
          >
            {creatingPriceRule ? 'Saving...' : 'Create and Add'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={imageEditOpen} onClose={closeImageEditModal} fullWidth maxWidth="sm">
        <DialogTitle sx={dialogTitleSx}>Edit Trademark Registration</DialogTitle>
        <DialogContent sx={{ bgcolor: '#FFFFFF', pt: 2.5 }}>
          {selectedImageApplication ? (
            <Box sx={{ display: 'grid', gap: 1.5 }}>
              <Box
                sx={{
                  width: '100%',
                  minHeight: 220,
                  bgcolor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 1,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {imageEditSource ? (
                  <Box
                    component="img"
                    src={imageEditSource}
                    alt="Trademark registration"
                    sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <Typography sx={{ color: '#64748B' }}>No image selected</Typography>
                )}
              </Box>
              <Button variant="outlined" component="label" size="small">
                Upload Image
                <input hidden accept="image/*" type="file" onChange={handleImageFileChange} disabled={imageSaving} />
              </Button>
              <TextField
                label="Image URL"
                size="small"
                fullWidth
                value={imageEditSource}
                onChange={(event) => setImageEditSource(event.target.value)}
                sx={fieldSx}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Box>
          ) : (
            <Typography sx={{ color: '#64748B' }}>No trademark registration selected.</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#F8FAFC', px: 3, pb: 2 }}>
          <Button size="small" variant="outlined" color="inherit" onClick={closeImageEditModal}>
            Cancel
          </Button>
          <Button size="small" variant="contained" onClick={saveImageUpdate} disabled={!selectedImageApplication || imageSaving}>
            {imageSaving ? 'Saving...' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
}
