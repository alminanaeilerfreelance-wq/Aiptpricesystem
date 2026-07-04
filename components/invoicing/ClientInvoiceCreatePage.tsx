'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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

function calculateRow(item: InvoiceItem, vatable: boolean, vatPercentage: number): InvoiceItem {
  const quantity = Math.max(Number(item.quantity || 1), 1);
  const officialFee = Math.max(Number(item.officialFee || 0), 0);
  const attorneyFee = Math.max(Number(item.attorneyFee || 0), 0);
  const vatRate = vatable ? Math.min(Math.max(Number(vatPercentage || 0), 0), 100) : 0;
  const vatAmount = vatable ? attorneyFee * quantity * (vatRate / 100) : 0;
  const total = officialFee * quantity + attorneyFee * quantity + vatAmount;

  return { ...item, quantity, officialFee, attorneyFee, vatPercentage: vatRate, vatAmount, total };
}

export default function ClientInvoiceCreatePage() {
  const router = useRouter();
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
    setToAddress(client?.address || '');
  }, [client]);

  useEffect(() => {
    setSubject(procedure?.name || '');
  }, [procedure]);

  useEffect(() => {
    if (bank?.currency) setCurrency(bank.currency);
  }, [bank]);

  useEffect(() => {
    let mounted = true;
    async function loadApplications() {
      setSelectedApplications([]);
      if (!client || !country) {
        setApplications([]);
        return;
      }
      try {
        setApplicationsLoading(true);
        const serviceType = (service?.category || service?.name || '').trim();
        const params = new URLSearchParams({ clientId: client._id, countryId: country._id, serviceType });
        const data = await getJson<{ applications: ApplicationOption[] }>(`/api/applications?${params.toString()}`);
        if (mounted) setApplications(data.applications || []);
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
  }, [client, country]);

  // removed application text updater

  useEffect(() => {
    let mounted = true;
    async function generateNumber() {
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
  }, [client, country, invoiceDate, service]);

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

  const getValidationErrors = (confirming: boolean) => {
    const errors: Record<string, string> = {};
    if (!client) errors.client = 'Client is required.';
    if (!service) errors.service = 'Service is required.';
    if (!country) errors.country = 'Country is required.';
    if (!procedure) errors.procedure = 'Method is required.';
    if (!invoiceDate) errors.invoiceDate = 'Date of invoice is required.';
    if (!invoiceNumber) errors.invoiceNumber = 'Invoice number is required.';
    if (items.length === 0) errors.items = 'At least one invoice item is required.';
    if (!bank) errors.bank = 'Bank is required.';
    if (!Number.isFinite(Number(vatPercentage)) || vatPercentage < 0 || vatPercentage > 100) {
      errors.vatPercentage = 'VAT percentage must be between 0 and 100.';
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
      const response = await fetch('/api/invoices', {
        method: 'POST',
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
      showSuccessToast(status === 'Confirmed' ? 'Invoice created successfully.' : 'Invoice save draft successfully.');
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
      try {
        logoLayout = await getReportImageLayout(getReportCompanyLogoUrl(company), 140, 70);
      } catch {
        logoLayout = null;
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
      doc.text(notesText, margin, notesY + 14, { maxWidth: pageWidth - margin * 2 });

      const bankLines = [
        bank?.bankName || '-',
        bank?.accountName ? `Account Name: ${bank.accountName}` : '',
        bank?.accountNumber ? `Account No: ${bank.accountNumber}` : '',
        bank?.iban ? `IBAN: ${bank.iban}` : '',
        bank?.swift ? `SWIFT: ${bank.swift}` : '',
      ].filter(Boolean);
      const bankY = notesY + 48;
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

  const confirmDisabled = Boolean(Object.keys(getValidationErrors(true)).length) || saving;

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#fff' }}>
      <Topbar
        title="Client Invoice"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Invoice' },
          { label: 'Create New' },
        ]}
      />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: { xs: 2, md: 3 }, mt: 2 }}>
        <Button size="small" variant="outlined" onClick={() => setCreatedInvoicesOpen(true)}>
          Created Invoices
        </Button>
      </Box>
      <Box sx={shellSx}>
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
        slotProps={{ inputLabel: { shrink: true } }}
      />

      <Box sx={{ display: 'flex', gap: 0.75, mt: 1.5 }}>
        <Button size="small" variant="contained" onClick={handleNewItem}>New Item</Button>
        <Button size="small" variant="contained" onClick={generateFees}>Generate Fees</Button>
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
        <Button size="small" variant="contained" onClick={() => saveInvoice('Draft')} disabled={saving}>Save Draft</Button>
        <Button size="small" variant="contained" onClick={() => setConfirmDialogOpen(true)} disabled={confirmDisabled} startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}>
          Confirm
        </Button>
        <Button
          size="small"
          variant="contained"
          color="success"
          disabled={items.length === 0 || downloadingPdf}
          onClick={downloadInvoicePdf}
        >
          {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}
        </Button>
        <Button size="small" variant="outlined" color="inherit" onClick={() => router.back()}>Cancel</Button>
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

      <Dialog open={createdInvoicesOpen} onClose={() => setCreatedInvoicesOpen(false)} fullWidth maxWidth="xl">
        <DialogTitle sx={dialogTitleSx}>Created Invoices</DialogTitle>
        <DialogContent sx={{ bgcolor: '#FFFFFF', pt: 2.5, minHeight: 500 }}>
          <InvoiceTable invoiceType="Trademark" showActions={true} showToolbar={false} />
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
