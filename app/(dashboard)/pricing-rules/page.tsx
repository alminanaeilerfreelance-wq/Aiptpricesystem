'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  SvgIcon,
} from '@mui/material';
import Topbar from '@/components/layout/Topbar';
import { showSuccessToast } from '@/components/feedback/heroToast';
import { CreatePricingRuleDto, pricingRulesService } from '@/services/pricing-rules.service';
import { Country, countriesService } from '@/services/countries.service';
import { Procedure, proceduresService } from '@/services/procedures.service';

export const dynamic = 'force-dynamic';

type ServiceKey = 'Trademark' | 'Patent' | 'Design' | 'Copyright' | 'Litigation';
type StatusFilter = 'all' | 'active' | 'inactive';
type FeeField = 'officialFee' | 'attorneyFee' | 'classFee';
type ColumnKey = 'country' | 'procedure' | 'officeFee' | 'attorneyFee' | 'classFee' | 'total' | 'status' | 'updatedAt';

interface PricingRuleRow {
  _id: string;
  serviceCategory: ServiceKey;
  procedureName: string;
  countryName: string;
  countryAbbreviation: string;
  officialFee: number;
  attorneyFee: number;
  classFee: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  isNew?: boolean;
  country?: {
    flagCode?: string;
    abbreviation?: string;
    name?: string;
  } | null;
}

interface EditableRule {
  serviceCategory: ServiceKey;
  procedureName: string;
  countryName: string;
  countryAbbreviation: string;
  officialFee: string;
  attorneyFee: string;
  classFee: string;
  isActive: boolean;
}

interface RowValidation {
  countryName?: string;
  countryAbbreviation?: string;
  procedureName?: string;
  officialFee?: string;
  attorneyFee?: string;
  classFee?: string;
}

interface PricingRulesDraft {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  selectedService: ServiceKey;
  editedRows: Record<string, EditableRule>;
  rowOrder: string[];
  columnVisibility: Record<ColumnKey, boolean>;
  fontFamily: string;
  rowHeight: number;
  columnWidth: number;
  flagWidth: number;
  flagHeight: number;
  headerColor: string;
  rowColor: string;
}

interface AuditEntry {
  id: string;
  at: string;
  action: string;
}

const SERVICES: ServiceKey[] = ['Trademark', 'Patent', 'Design', 'Copyright', 'Litigation'];
const FONT_OPTIONS = ['Arial', 'Times New Roman', 'Calibri', 'Verdana', 'Tahoma', 'Georgia', 'Courier New'];
const DRAFT_STORAGE_KEY = 'pricing-rules-excel-drafts';
const AUTOSAVE_STORAGE_KEY = 'pricing-rules-excel-autosave';

const COLUMN_LABELS: Record<ColumnKey, string> = {
  country: 'Country',
  procedure: 'Procedure',
  officeFee: 'Office Fee',
  attorneyFee: 'Attorney Fee',
  classFee: 'Class Fee',
  total: 'Total',
  status: 'Status',
  updatedAt: 'Updated',
};

const DEFAULT_COLUMNS: Record<ColumnKey, boolean> = {
  country: true,
  procedure: true,
  officeFee: true,
  attorneyFee: true,
  classFee: true,
  total: true,
  status: true,
  updatedAt: true,
};

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const EyeIcon = () => (
  <SvgIcon fontSize="small" viewBox="0 0 24 24">
    <path d="M12 5C6.5 5 2.4 9.6 1.3 12c1.1 2.4 5.2 7 10.7 7s9.6-4.6 10.7-7C21.6 9.6 17.5 5 12 5Zm0 12c-2.8 0-5.1-2.3-5.1-5S9.2 7 12 7s5.1 2.3 5.1 5-2.3 5-5.1 5Zm0-2.1A2.9 2.9 0 1 0 12 9a2.9 2.9 0 0 0 0 5.8Z" />
  </SvgIcon>
);

const EditIcon = () => (
  <SvgIcon fontSize="small" viewBox="0 0 24 24">
    <path d="M4 17.3V21h3.7L18.8 9.9l-3.7-3.7L4 17.3Zm18-11.1c0-.4-.2-.8-.4-1.1l-2.7-2.7a1.5 1.5 0 0 0-2.1 0l-1.5 1.5 3.7 3.7 1.5-1.5c.3-.3.5-.7.5-1.1Z" />
  </SvgIcon>
);

const SaveIcon = () => (
  <SvgIcon fontSize="small" viewBox="0 0 24 24">
    <path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4ZM7 5h9v5H7V5Zm10 16H7v-6h10v6Z" />
  </SvgIcon>
);

const TrashIcon = () => (
  <SvgIcon fontSize="small" viewBox="0 0 24 24">
    <path d="M6 19c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V7H6v12ZM8 4l1-1h6l1 1h4v2H4V4h4Z" />
  </SvgIcon>
);

const formatMoney = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });

const normalizeNumberInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const readStoredArray = <T,>(key: string): T[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const readStoredDraft = (key: string): PricingRulesDraft | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const toEditableRule = (rule: PricingRuleRow): EditableRule => ({
  serviceCategory: rule.serviceCategory,
  procedureName: rule.procedureName,
  countryName: rule.countryName,
  countryAbbreviation: rule.countryAbbreviation,
  officialFee: String(rule.officialFee ?? 0),
  attorneyFee: String(rule.attorneyFee ?? 0),
  classFee: String(rule.classFee ?? 0),
  isActive: rule.isActive,
});

const makeDefaultRuleForm = (serviceCategory: ServiceKey): EditableRule => ({
  serviceCategory,
  procedureName: '',
  countryName: '',
  countryAbbreviation: '',
  officialFee: '0',
  attorneyFee: '0',
  classFee: '0',
  isActive: true,
});

export default function PricingRulesPage() {
  const [selectedService, setSelectedService] = useState<ServiceKey>('Trademark');
  const [pricingRules, setPricingRules] = useState<PricingRuleRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [countries, setCountries] = useState<Country[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [rowEdits, setRowEdits] = useState<Record<string, EditableRule>>({});
  const [dirtyRows, setDirtyRows] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, RowValidation>>({});
  const [rowOrder, setRowOrder] = useState<string[]>([]);
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>(DEFAULT_COLUMNS);
  const [fontFamily, setFontFamily] = useState('Calibri');
  const [rowHeight, setRowHeight] = useState(38);
  const [columnWidth, setColumnWidth] = useState(132);
  const [flagWidth, setFlagWidth] = useState(28);
  const [flagHeight, setFlagHeight] = useState(18);
  const [headerColor, setHeaderColor] = useState('#EAF2FF');
  const [rowColor, setRowColor] = useState('#FFFFFF');
  const [drafts, setDrafts] = useState<PricingRulesDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState('');
  const [draftName, setDraftName] = useState('');
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createCountryId, setCreateCountryId] = useState('');
  const [createForm, setCreateForm] = useState<EditableRule>(() => makeDefaultRuleForm('Trademark'));
  const [createErrors, setCreateErrors] = useState<RowValidation>({});
  const [editingRule, setEditingRule] = useState<PricingRuleRow | null>(null);
  const [editCountryId, setEditCountryId] = useState('');
  const [editForm, setEditForm] = useState<EditableRule>(() => makeDefaultRuleForm('Trademark'));
  const [editErrors, setEditErrors] = useState<RowValidation>({});
  const [viewingRule, setViewingRule] = useState<PricingRuleRow | null>(null);
  const [advancedAnchor, setAdvancedAnchor] = useState<HTMLElement | null>(null);
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const addAudit = (action: string) => {
    setAuditLog((current) => [
      { id: makeId('audit'), at: new Date().toISOString(), action },
      ...current,
    ].slice(0, 50));
  };

  const buildDraftSnapshot = (name: string, id = activeDraftId || makeId('draft')): PricingRulesDraft => ({
    id,
    name,
    createdAt: drafts.find((draft) => draft.id === id)?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    selectedService,
    editedRows: rowEdits,
    rowOrder,
    columnVisibility,
    fontFamily,
    rowHeight,
    columnWidth,
    flagWidth,
    flagHeight,
    headerColor,
    rowColor,
  });

  const applyDraft = (draft: PricingRulesDraft) => {
    setActiveDraftId(draft.id);
    setDraftName(draft.name);
    setSelectedService(draft.selectedService);
    setRowEdits(draft.editedRows || {});
    setRowOrder(draft.rowOrder || []);
    setColumnVisibility({ ...DEFAULT_COLUMNS, ...(draft.columnVisibility || {}) });
    setFontFamily(draft.fontFamily || 'Calibri');
    setRowHeight(draft.rowHeight || 38);
    setColumnWidth(draft.columnWidth || 132);
    setFlagWidth(draft.flagWidth || 28);
    setFlagHeight(draft.flagHeight || 18);
    setHeaderColor(draft.headerColor || '#EAF2FF');
    setRowColor(draft.rowColor || '#FFFFFF');
    setDirtyRows({});
    setRowErrors({});
    setPage(0);
    addAudit(`Draft Loaded: ${draft.name}`);
  };

  useEffect(() => {
    const storedDrafts = readStoredArray<PricingRulesDraft>(DRAFT_STORAGE_KEY);
    const autosave = readStoredDraft(AUTOSAVE_STORAGE_KEY);
    setDrafts(storedDrafts);
    if (autosave) applyDraft(autosave);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      AUTOSAVE_STORAGE_KEY,
      JSON.stringify(buildDraftSnapshot(draftName || 'Autosaved Pricing Rules', activeDraftId || 'autosave'))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hydrated,
    selectedService,
    rowEdits,
    rowOrder,
    columnVisibility,
    fontFamily,
    rowHeight,
    columnWidth,
    flagWidth,
    flagHeight,
    headerColor,
    rowColor,
    draftName,
    activeDraftId,
  ]);

  useEffect(() => {
    let active = true;

    const loadOptions = async () => {
      try {
        const [countriesResponse, procedureResponses] = await Promise.all([
          countriesService.list({ page: 1, limit: 100 }),
          Promise.all(SERVICES.map((category) => proceduresService.list({ category, page: 1, limit: 100 }))),
        ]);

        if (!active) return;

        setCountries(countriesResponse.countries || []);
        setProcedures(procedureResponses.flatMap((response) => response.procedures || []));
      } catch (err) {
        if (!active) return;
        setCountries([]);
        setProcedures([]);
        setError(err instanceof Error ? err.message : 'Failed to load countries and procedures');
      }
    };

    loadOptions();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadPricingRules = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await pricingRulesService.list({
          category: selectedService,
          search: search.trim() || undefined,
          status: statusFilter,
          page: page + 1,
          limit: rowsPerPage,
        });

        if (!active) return;

        const nextRules = (response.pricingRules || []) as PricingRuleRow[];
        setPricingRules((current) => {
          const unsavedRows = current.filter((rule) => rule.isNew);
          return [...unsavedRows, ...nextRules];
        });
        setTotalRows(response.total || 0);
        setRowEdits((current) => {
          const next = { ...current };
          nextRules.forEach((rule) => {
            if (!next[rule._id]) next[rule._id] = toEditableRule(rule);
          });
          return next;
        });
      } catch (err) {
        if (!active) return;
        setPricingRules((current) => current.filter((rule) => rule.isNew));
        setTotalRows(0);
        setError(err instanceof Error ? err.message : 'Failed to load pricing rules');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadPricingRules();

    return () => {
      active = false;
    };
  }, [page, rowsPerPage, search, selectedService, statusFilter]);

  const orderedRules = useMemo(() => {
    const orderMap = new Map(rowOrder.map((id, index) => [id, index]));
    return [...pricingRules].sort((a, b) => {
      const aIndex = orderMap.get(a._id);
      const bIndex = orderMap.get(b._id);
      if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex;
      if (aIndex !== undefined) return -1;
      if (bIndex !== undefined) return 1;
      return 0;
    });
  }, [pricingRules, rowOrder]);

  const getEdit = (rule: PricingRuleRow) => rowEdits[rule._id] || toEditableRule(rule);

  const getRowTotal = (rule: PricingRuleRow) => {
    const edit = getEdit(rule);
    const officialFee = normalizeNumberInput(edit.officialFee);
    const attorneyFee = normalizeNumberInput(edit.attorneyFee);
    const classFee = normalizeNumberInput(edit.classFee);
    if (
      officialFee === null ||
      attorneyFee === null ||
      classFee === null ||
      officialFee < 0 ||
      attorneyFee < 0 ||
      classFee < 0
    ) {
      return null;
    }
    return officialFee + attorneyFee + classFee;
  };

  const validateEditableRule = (edit: EditableRule) => {
    const nextErrors: RowValidation = {};
    const officialFee = normalizeNumberInput(edit.officialFee);
    const attorneyFee = normalizeNumberInput(edit.attorneyFee);
    const classFee = normalizeNumberInput(edit.classFee);

    if (!edit.countryName.trim()) nextErrors.countryName = 'Country is required';
    if (!edit.countryAbbreviation.trim()) nextErrors.countryAbbreviation = 'Code is required';
    if (!edit.procedureName.trim()) nextErrors.procedureName = 'Procedure is required';

    if (!edit.officialFee.trim()) nextErrors.officialFee = 'Office Fee is required';
    else if (officialFee === null) nextErrors.officialFee = 'Office Fee must be a number';
    else if (officialFee < 0) nextErrors.officialFee = 'Office Fee cannot be negative';

    if (!edit.attorneyFee.trim()) nextErrors.attorneyFee = 'Attorney Fee is required';
    else if (attorneyFee === null) nextErrors.attorneyFee = 'Attorney Fee must be a number';
    else if (attorneyFee < 0) nextErrors.attorneyFee = 'Attorney Fee cannot be negative';

    if (!edit.classFee.trim()) nextErrors.classFee = 'Class Fee is required';
    else if (classFee === null) nextErrors.classFee = 'Class Fee must be a number';
    else if (classFee < 0) nextErrors.classFee = 'Class Fee cannot be negative';

    return {
      nextErrors,
      isValid: Object.keys(nextErrors).length === 0,
      payload: {
        serviceCategory: edit.serviceCategory,
        countryName: edit.countryName.trim(),
        countryAbbreviation: edit.countryAbbreviation.trim().toUpperCase(),
        procedureName: edit.procedureName.trim(),
        officialFee: officialFee ?? 0,
        attorneyFee: attorneyFee ?? 0,
        classFee: classFee ?? 0,
        isActive: edit.isActive,
      } satisfies CreatePricingRuleDto,
    };
  };

  const validateRow = (rule: PricingRuleRow) => {
    const validation = validateEditableRule(getEdit(rule));
    setRowErrors((current) => ({ ...current, [rule._id]: validation.nextErrors }));
    return validation;
  };

  const updateEdit = (rule: PricingRuleRow, patch: Partial<EditableRule>) => {
    setRowEdits((current) => ({
      ...current,
      [rule._id]: {
        ...getEdit(rule),
        ...patch,
      },
    }));
    setDirtyRows((current) => ({ ...current, [rule._id]: true }));
    setRowErrors((current) => ({ ...current, [rule._id]: {} }));
  };

  const openCreateDialog = () => {
    setCreateForm(makeDefaultRuleForm(selectedService));
    setCreateCountryId('');
    setCreateErrors({});
    setCreateDialogOpen(true);
    addAudit('Add Rule Modal Opened');
  };

  const createPricingRule = async () => {
    const validation = validateEditableRule(createForm);
    setCreateErrors(validation.nextErrors);
    if (!validation.isValid) return;

    try {
      const created = (await pricingRulesService.create(validation.payload)) as PricingRuleRow;
      if (created.serviceCategory === selectedService) {
        setPricingRules((current) => [created, ...current]);
        setRowEdits((current) => ({ ...current, [created._id]: toEditableRule(created) }));
        setRowOrder((current) => [created._id, ...current.filter((id) => id !== created._id)]);
        setTotalRows((current) => current + 1);
      }
      setCreateDialogOpen(false);
      setCreateForm(makeDefaultRuleForm(selectedService));
      setCreateCountryId('');
      setCreateErrors({});
      addAudit(`Row Added: ${created.countryName} / ${created.procedureName}`);
      showSuccessToast('Pricing rule added');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add pricing rule');
    }
  };

  const editRow = (rule: PricingRuleRow) => {
    const edit = getEdit(rule);
    const country = countries.find((item) => item.name === edit.countryName || item.abbreviation === edit.countryAbbreviation);
    setEditingRule(rule);
    setEditForm(edit);
    setEditCountryId(country?._id || '');
    setEditErrors({});
    addAudit(`Edit Modal Opened: ${rule.countryName || 'Pricing Rule'}`);
  };

  const updateRow = async () => {
    if (!editingRule) return;
    const validation = validateEditableRule(editForm);
    setEditErrors(validation.nextErrors);
    if (!validation.isValid) return;

    try {
      const updated = await pricingRulesService.update(editingRule._id, validation.payload);
      const updatedRow = updated as PricingRuleRow;
      setPricingRules((current) =>
        current.map((item) => (item._id === editingRule._id ? { ...item, ...updatedRow } : item))
      );
      setRowEdits((current) => ({ ...current, [editingRule._id]: toEditableRule(updatedRow) }));
      setDirtyRows((current) => ({ ...current, [editingRule._id]: false }));
      setRowErrors((current) => ({ ...current, [editingRule._id]: {} }));
      setEditingRule(null);
      setEditErrors({});
      setEditCountryId('');
      addAudit(`Row Updated: ${updatedRow.countryName} / ${updatedRow.procedureName}`);
      showSuccessToast('Pricing rule updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update pricing rule');
    }
  };

  const deleteRow = async (rule: PricingRuleRow) => {
    const confirmed = window.confirm('Delete this pricing rule?');
    if (!confirmed) return;

    try {
      if (!rule.isNew) await pricingRulesService.delete(rule._id);
      setPricingRules((current) => current.filter((item) => item._id !== rule._id));
      setRowEdits((current) => {
        const next = { ...current };
        delete next[rule._id];
        return next;
      });
      setDirtyRows((current) => {
        const next = { ...current };
        delete next[rule._id];
        return next;
      });
      setRowOrder((current) => current.filter((id) => id !== rule._id));
      if (!rule.isNew) setTotalRows((current) => Math.max(0, current - 1));
      addAudit(`Row Deleted: ${rule.countryName || 'New Rule'}`);
      showSuccessToast('Pricing rule deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete pricing rule');
    }
  };

  const handleRowDrop = (targetRowId: string) => {
    if (!draggedRowId || draggedRowId === targetRowId) return;
    const ids = orderedRules.map((rule) => rule._id);
    const fromIndex = ids.indexOf(draggedRowId);
    const toIndex = ids.indexOf(targetRowId);
    if (fromIndex < 0 || toIndex < 0) return;
    const nextIds = [...ids];
    const [moved] = nextIds.splice(fromIndex, 1);
    nextIds.splice(toIndex, 0, moved);
    setRowOrder(nextIds);
    setDraggedRowId(null);
    addAudit('Row Order Saved');
    showSuccessToast('Row order saved');
  };

  const saveDraft = () => {
    const name = draftName.trim() || `Pricing Rules Draft ${new Date().toLocaleString()}`;
    const snapshot = buildDraftSnapshot(name);
    const nextDrafts = [snapshot, ...drafts.filter((draft) => draft.id !== snapshot.id)];
    setDrafts(nextDrafts);
    setActiveDraftId(snapshot.id);
    setDraftName(snapshot.name);
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(nextDrafts));
    addAudit(`Draft Saved: ${snapshot.name}`);
    showSuccessToast('Draft saved');
  };

  const createNewDraft = () => {
    setActiveDraftId('');
    setDraftName(`Pricing Rules Draft ${new Date().toLocaleString()}`);
    setRowEdits(Object.fromEntries(pricingRules.map((rule) => [rule._id, toEditableRule(rule)])));
    setDirtyRows({});
    setRowErrors({});
    setRowOrder(pricingRules.map((rule) => rule._id));
    setColumnVisibility(DEFAULT_COLUMNS);
    setFontFamily('Calibri');
    setRowHeight(38);
    setColumnWidth(132);
    setFlagWidth(28);
    setFlagHeight(18);
    setHeaderColor('#EAF2FF');
    setRowColor('#FFFFFF');
    addAudit('New Draft Created');
  };

  const deleteDraft = (draftId: string) => {
    const nextDrafts = drafts.filter((draft) => draft.id !== draftId);
    setDrafts(nextDrafts);
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(nextDrafts));
    if (activeDraftId === draftId) setActiveDraftId('');
    addAudit('Draft Deleted');
  };

  const exportRows = () =>
    orderedRules.map((rule) => {
      const edit = getEdit(rule);
      return {
        ID: rule.isNew ? '' : rule._id,
        Service: edit.serviceCategory,
        Country: edit.countryName,
        Code: edit.countryAbbreviation,
        Procedure: edit.procedureName,
        'Office Fee': edit.officialFee,
        'Attorney Fee': edit.attorneyFee,
        'Class Fee': edit.classFee,
        Total: getRowTotal(rule) === null ? '' : getRowTotal(rule),
        Status: edit.isActive ? 'Active' : 'Inactive',
        Updated: rule.updatedAt,
      };
    });

  const exportCsv = () => {
    const rows = exportRows();
    const headers = Object.keys(rows[0] || {
      ID: '',
      Service: '',
      Country: '',
      Code: '',
      Procedure: '',
      'Office Fee': '',
      'Attorney Fee': '',
      'Class Fee': '',
      Total: '',
      Status: '',
      Updated: '',
    });
    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((header) => `"${String(row[header as keyof typeof row] ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pricing-rules-${selectedService.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    addAudit('CSV Export Generated');
  };

  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const worksheet = XLSX.utils.json_to_sheet(exportRows());
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, selectedService);
    XLSX.writeFile(workbook, `pricing-rules-${selectedService.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    addAudit('Excel Export Generated');
    showSuccessToast('Excel exported');
  };

  const exportDraftJson = () => {
    const snapshot = buildDraftSnapshot(draftName.trim() || 'Exported Pricing Rules Draft');
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${snapshot.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'pricing-rules-draft'}.json`;
    link.click();
    URL.revokeObjectURL(url);
    addAudit('Draft JSON Exported');
  };

  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith('.json')) {
        const draft = JSON.parse(text) as PricingRulesDraft;
        if (!draft.editedRows || !draft.columnVisibility) throw new Error('Invalid draft file');
        applyDraft({ ...draft, id: draft.id || makeId('draft-import') });
        showSuccessToast('Draft imported');
      } else {
        const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
        const headers = headerLine.split(',').map((item) => item.replace(/^"|"$/g, '').trim());
        const idIndex = headers.findIndex((header) => /^(id|rule id)$/i.test(header));
        const officeIndex = headers.findIndex((header) => /office fee|official fee/i.test(header));
        const attorneyIndex = headers.findIndex((header) => /attorney fee/i.test(header));
        const classIndex = headers.findIndex((header) => /class fee/i.test(header));
        if (idIndex < 0 || officeIndex < 0 || attorneyIndex < 0) {
          throw new Error('CSV must include ID, Office Fee, and Attorney Fee columns');
        }
        const nextEdits: Record<string, EditableRule> = {};
        lines.forEach((line) => {
          const cells = line.match(/("([^"]|"")*"|[^,]+)/g)?.map((cell) => cell.replace(/^"|"$/g, '').replace(/""/g, '"')) || [];
          const id = cells[idIndex];
          const row = pricingRules.find((rule) => rule._id === id);
          if (id && row) {
            nextEdits[id] = {
              ...getEdit(row),
              officialFee: cells[officeIndex] || '',
              attorneyFee: cells[attorneyIndex] || '',
              classFee: classIndex >= 0 ? cells[classIndex] || '0' : getEdit(row).classFee,
            };
          }
        });
        setRowEdits((current) => ({ ...current, ...nextEdits }));
        setDirtyRows((current) => ({
          ...current,
          ...Object.fromEntries(Object.keys(nextEdits).map((id) => [id, true])),
        }));
        addAudit(`Imported File: ${file.name}`);
        showSuccessToast('Import completed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      event.target.value = '';
    }
  };

  const getFlagSrc = (rule: PricingRuleRow) => {
    const edit = getEdit(rule);
    const flagCode = (rule.country?.flagCode || edit.countryAbbreviation || '').toLowerCase();
    return flagCode ? `https://flagcdn.com/w80/${flagCode}.png` : '';
  };

  const renderEditableText = (
    rule: PricingRuleRow,
    field: keyof Pick<EditableRule, 'countryName' | 'countryAbbreviation' | 'procedureName'>,
    label: string,
    minWidth = 110
  ) => {
    const edit = getEdit(rule);
    return <Typography sx={{ fontSize: 13, lineHeight: 1.2, minWidth }}>{edit[field] || '-'}</Typography>;
  };

  const renderFeeInput = (rule: PricingRuleRow, field: FeeField, label: string) => {
    const edit = getEdit(rule);
    const value = normalizeNumberInput(edit[field]) ?? 0;
    return <Typography title={label} sx={{ fontSize: 13, textAlign: 'right' }}>{formatMoney(value)}</Typography>;
  };

  const filteredCreateProcedures = useMemo(
    () => procedures.filter((procedure) => procedure.serviceCategory === createForm.serviceCategory),
    [createForm.serviceCategory, procedures]
  );
  const filteredEditProcedures = useMemo(
    () => procedures.filter((procedure) => procedure.serviceCategory === editForm.serviceCategory),
    [editForm.serviceCategory, procedures]
  );
  const viewingEdit = viewingRule ? getEdit(viewingRule) : null;
  const viewingTotal = viewingRule ? getRowTotal(viewingRule) : null;
  const visibleColumnCount = Object.values(columnVisibility).filter(Boolean).length + 1;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F5F7FA' }}>
      <Topbar title="Pricing Rules" />

      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Paper
          sx={{
            borderRadius: 1,
            overflow: 'hidden',
            border: '1px solid #D7DDE7',
            boxShadow: '0 10px 28px rgba(15, 23, 42, 0.08)',
          }}
        >
          <Box sx={{ p: 1.5, borderBottom: '1px solid #D7DDE7', bgcolor: '#FFFFFF' }}>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1, alignItems: 'center' }}>
              <TextField
                size="small"
                label="Search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: { xs: '100%', sm: 240 } }}
              />
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Filter</InputLabel>
                <Select
                  label="Filter"
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as StatusFilter);
                    setPage(0);
                  }}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
              <Button variant="contained" onClick={openCreateDialog}>Add Rule</Button>
              <Button variant="outlined" onClick={() => importInputRef.current?.click()}>Import</Button>
              <Button variant="outlined" onClick={(event) => setExportAnchor(event.currentTarget)}>Export</Button>
              <Button variant="outlined" onClick={(event) => setAdvancedAnchor(event.currentTarget)}>Tools</Button>
              <Button variant="contained" onClick={saveDraft}>Save Draft</Button>
              <Button variant="outlined" onClick={createNewDraft}>New Draft</Button>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Font</InputLabel>
                <Select label="Font" value={fontFamily} onChange={(event) => setFontFamily(event.target.value)}>
                  {FONT_OPTIONS.map((font) => (
                    <MenuItem key={font} value={font}>{font}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                type="number"
                label="Row Height"
                value={rowHeight}
                onChange={(event) => setRowHeight(Math.max(30, Number(event.target.value) || 38))}
                sx={{ width: 120 }}
              />
              <TextField
                size="small"
                type="number"
                label="Column Width"
                value={columnWidth}
                onChange={(event) => setColumnWidth(Math.max(96, Number(event.target.value) || 132))}
                sx={{ width: 128 }}
              />
              <TextField
                size="small"
                type="number"
                label="Flag Width"
                value={flagWidth}
                onChange={(event) => setFlagWidth(Math.max(16, Number(event.target.value) || 28))}
                sx={{ width: 112 }}
              />
              <TextField
                size="small"
                type="number"
                label="Flag Height"
                value={flagHeight}
                onChange={(event) => setFlagHeight(Math.max(12, Number(event.target.value) || 18))}
                sx={{ width: 116 }}
              />
            </Stack>
          </Box>

          <Tabs
            value={selectedService}
            onChange={(_event: React.SyntheticEvent, value: ServiceKey) => {
              setSelectedService(value);
              setPage(0);
              setRowOrder([]);
            }}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 44,
              borderBottom: '1px solid #D7DDE7',
              bgcolor: '#F8FAFC',
              '& .MuiTab-root': {
                minHeight: 44,
                fontWeight: 800,
                textTransform: 'none',
              },
            }}
          >
            {SERVICES.map((service) => (
              <Tab key={service} value={service} label={service} />
            ))}
          </Tabs>

          {error && (
            <Alert severity="warning" onClose={() => setError('')} sx={{ borderRadius: 0 }}>
              {error}
            </Alert>
          )}

          <TableContainer sx={{ maxHeight: 'calc(100vh - 280px)', bgcolor: '#FFFFFF' }}>
            <Table
              stickyHeader
              size="small"
              sx={{
                minWidth: 1120,
                borderCollapse: 'collapse',
                fontFamily,
                '& th': {
                  bgcolor: headerColor,
                  color: '#111827',
                  fontFamily,
                  fontWeight: 800,
                  border: '1px solid #C8D0DC',
                  borderBottom: '1px solid #C8D0DC',
                  py: 0.75,
                  whiteSpace: 'nowrap',
                },
                '& td': {
                  bgcolor: rowColor,
                  fontFamily,
                  border: '1px solid #E1E6EF',
                  borderBottom: '1px solid #E1E6EF',
                  py: 0,
                  height: rowHeight,
                },
                '& tbody tr': {
                  borderBottom: 0,
                },
                '& tbody tr:hover td': {
                  bgcolor: '#F8FBFF',
                },
              }}
            >
              <TableHead>
                <TableRow>
                  {columnVisibility.country && <TableCell sx={{ minWidth: 250 }}>Country</TableCell>}
                  {columnVisibility.procedure && <TableCell sx={{ minWidth: columnWidth }}>Procedure</TableCell>}
                  {columnVisibility.officeFee && <TableCell sx={{ minWidth: columnWidth }}>Office Fee</TableCell>}
                  {columnVisibility.attorneyFee && <TableCell sx={{ minWidth: columnWidth }}>Attorney Fee</TableCell>}
                  {columnVisibility.classFee && <TableCell sx={{ minWidth: columnWidth }}>Class Fee</TableCell>}
                  {columnVisibility.total && <TableCell sx={{ minWidth: columnWidth }}>Total</TableCell>}
                  {columnVisibility.status && <TableCell sx={{ minWidth: 120 }}>Status</TableCell>}
                  {columnVisibility.updatedAt && <TableCell sx={{ minWidth: 150 }}>Updated</TableCell>}
                  <TableCell sx={{ minWidth: 210 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orderedRules.map((rule) => {
                  const edit = getEdit(rule);
                  const total = getRowTotal(rule);
                  const errors = rowErrors[rule._id] || {};
                  const validationMessage = Object.values(errors).filter(Boolean)[0] || '';
                  const flagSrc = getFlagSrc(rule);

                  return (
                    <TableRow
                      key={rule._id}
                      draggable
                      onDragStart={() => setDraggedRowId(rule._id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleRowDrop(rule._id)}
                      sx={{ cursor: 'grab' }}
                    >
                      {columnVisibility.country && (
                        <TableCell>
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                            {flagSrc ? (
                              <Box
                                component="img"
                                src={flagSrc}
                                alt={edit.countryName || 'Country flag'}
                                onError={(event) => {
                                  event.currentTarget.style.display = 'none';
                                }}
                                sx={{
                                  width: flagWidth,
                                  height: flagHeight,
                                  objectFit: 'cover',
                                  border: '1px solid #CBD5E1',
                                }}
                              />
                            ) : null}
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              {renderEditableText(rule, 'countryName', 'Country', 150)}
                              <Typography sx={{ fontSize: 11, color: '#64748B', lineHeight: 1.2 }}>
                                {edit.countryAbbreviation || '-'}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                      )}
                      {columnVisibility.procedure && (
                        <TableCell>{renderEditableText(rule, 'procedureName', 'Procedure', columnWidth)}</TableCell>
                      )}
                      {columnVisibility.officeFee && <TableCell>{renderFeeInput(rule, 'officialFee', 'Office Fee')}</TableCell>}
                      {columnVisibility.attorneyFee && <TableCell>{renderFeeInput(rule, 'attorneyFee', 'Attorney Fee')}</TableCell>}
                      {columnVisibility.classFee && <TableCell>{renderFeeInput(rule, 'classFee', 'Class Fee')}</TableCell>}
                      {columnVisibility.total && (
                        <TableCell sx={{ textAlign: 'right', fontWeight: 900, px: 1 }}>
                          {total === null ? '-' : formatMoney(total)}
                        </TableCell>
                      )}
                      {columnVisibility.status && (
                        <TableCell>
                          <Typography sx={{ fontSize: 12, fontWeight: 800, color: edit.isActive ? '#047857' : '#B91C1C' }}>
                            {edit.isActive ? 'Active' : 'Inactive'}
                          </Typography>
                        </TableCell>
                      )}
                      {columnVisibility.updatedAt && (
                        <TableCell>
                          <Typography sx={{ fontSize: 12, color: '#475569' }}>
                            {rule.isNew ? 'New' : rule.updatedAt ? new Date(rule.updatedAt).toLocaleDateString() : '-'}
                          </Typography>
                        </TableCell>
                      )}
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Stack direction="row" spacing={0.5}>
                            <Tooltip title="View">
                              <IconButton size="small" onClick={() => setViewingRule(rule)} aria-label="View pricing rule">
                                <EyeIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit">
                              <IconButton size="small" onClick={() => editRow(rule)} aria-label="Edit pricing rule">
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton size="small" color="error" onClick={() => deleteRow(rule)} aria-label="Delete pricing rule">
                                <TrashIcon />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                          {validationMessage && (
                            <Typography sx={{ fontSize: 10, color: '#DC2626', lineHeight: 1.1 }}>
                              {validationMessage}
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {!loading && orderedRules.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={visibleColumnCount} sx={{ py: 4, textAlign: 'center', color: '#64748B' }}>
                      No pricing rules found.
                    </TableCell>
                  </TableRow>
                )}

                {loading && (
                  <TableRow>
                    <TableCell colSpan={visibleColumnCount} sx={{ py: 4, textAlign: 'center', color: '#64748B' }}>
                      Loading pricing rules...
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={totalRows}
            page={page}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[10, 25, 50, 100]}
            onPageChange={(_, nextPage) => setPage(nextPage)}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(Number(event.target.value));
              setPage(0);
            }}
            sx={{ borderTop: '1px solid #D7DDE7', bgcolor: '#FFFFFF' }}
          />
        </Paper>
      </Box>

      <input ref={importInputRef} type="file" accept=".csv,.json" style={{ display: 'none' }} onChange={importFile} />

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add Pricing Rule</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2, pt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Service</InputLabel>
              <Select
                label="Service"
                value={createForm.serviceCategory}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    serviceCategory: event.target.value as ServiceKey,
                    procedureName: '',
                  }))
                }
              >
                {SERVICES.map((service) => (
                  <MenuItem key={service} value={service}>{service}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={createForm.isActive ? 'active' : 'inactive'}
                onChange={(event) => setCreateForm((current) => ({ ...current, isActive: event.target.value === 'active' }))}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small" error={Boolean(createErrors.countryName)}>
              <InputLabel>Country</InputLabel>
              <Select
                label="Country"
                value={createCountryId}
                onChange={(event) => {
                  const country = countries.find((item) => item._id === event.target.value);
                  setCreateCountryId(event.target.value);
                  setCreateForm((current) => ({
                    ...current,
                    countryName: country?.name || '',
                    countryAbbreviation: country?.abbreviation || '',
                  }));
                }}
              >
                {countries.map((country) => (
                  <MenuItem key={country._id} value={country._id}>
                    {country.name}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>{createErrors.countryName || ' '}</FormHelperText>
            </FormControl>
            <TextField
              size="small"
              label="Country Code"
              value={createForm.countryAbbreviation}
              error={Boolean(createErrors.countryAbbreviation)}
              helperText={createErrors.countryAbbreviation}
              disabled
            />
            <FormControl fullWidth size="small" error={Boolean(createErrors.procedureName)} sx={{ gridColumn: { md: '1 / -1' } }}>
              <InputLabel>Procedure</InputLabel>
              <Select
                label="Procedure"
                value={createForm.procedureName}
                onChange={(event) => setCreateForm((current) => ({ ...current, procedureName: event.target.value }))}
              >
                {filteredCreateProcedures.map((procedure) => (
                  <MenuItem key={procedure._id} value={procedure.name}>
                    {procedure.name}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                {createErrors.procedureName || `${filteredCreateProcedures.length} procedures for ${createForm.serviceCategory}`}
              </FormHelperText>
            </FormControl>
            <TextField
              size="small"
              type="number"
              label="Office Fee"
              value={createForm.officialFee}
              error={Boolean(createErrors.officialFee)}
              helperText={createErrors.officialFee}
              onChange={(event) => setCreateForm((current) => ({ ...current, officialFee: event.target.value }))}
            />
            <TextField
              size="small"
              type="number"
              label="Attorney Fee"
              value={createForm.attorneyFee}
              error={Boolean(createErrors.attorneyFee)}
              helperText={createErrors.attorneyFee}
              onChange={(event) => setCreateForm((current) => ({ ...current, attorneyFee: event.target.value }))}
            />
            <TextField
              size="small"
              type="number"
              label="Class Fee"
              value={createForm.classFee}
              error={Boolean(createErrors.classFee)}
              helperText={createErrors.classFee}
              onChange={(event) => setCreateForm((current) => ({ ...current, classFee: event.target.value }))}
            />
            <TextField
              size="small"
              label="Total"
              value={(() => {
                const officialFee = normalizeNumberInput(createForm.officialFee);
                const attorneyFee = normalizeNumberInput(createForm.attorneyFee);
                const classFee = normalizeNumberInput(createForm.classFee);
                if (officialFee === null || attorneyFee === null || classFee === null) return '-';
                if (officialFee < 0 || attorneyFee < 0 || classFee < 0) return '-';
                return formatMoney(officialFee + attorneyFee + classFee);
              })()}
              disabled
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createPricingRule}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(viewingRule)} onClose={() => setViewingRule(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Pricing Rule Details</DialogTitle>
        <DialogContent>
          {viewingRule && viewingEdit && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5, pt: 1 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Service</Typography>
                <Typography sx={{ fontWeight: 800 }}>{viewingEdit.serviceCategory}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Status</Typography>
                <Typography sx={{ fontWeight: 800, color: viewingEdit.isActive ? '#047857' : '#B91C1C' }}>
                  {viewingEdit.isActive ? 'Active' : 'Inactive'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Country</Typography>
                <Typography sx={{ fontWeight: 800 }}>{viewingEdit.countryName}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Country Code</Typography>
                <Typography sx={{ fontWeight: 800 }}>{viewingEdit.countryAbbreviation}</Typography>
              </Box>
              <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
                <Typography variant="caption" color="text.secondary">Procedure</Typography>
                <Typography sx={{ fontWeight: 800 }}>{viewingEdit.procedureName}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Office Fee</Typography>
                <Typography sx={{ fontWeight: 800 }}>{formatMoney(normalizeNumberInput(viewingEdit.officialFee) ?? 0)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Attorney Fee</Typography>
                <Typography sx={{ fontWeight: 800 }}>{formatMoney(normalizeNumberInput(viewingEdit.attorneyFee) ?? 0)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Class Fee</Typography>
                <Typography sx={{ fontWeight: 800 }}>{formatMoney(normalizeNumberInput(viewingEdit.classFee) ?? 0)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Total</Typography>
                <Typography sx={{ fontWeight: 900 }}>{viewingTotal === null ? '-' : formatMoney(viewingTotal)}</Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewingRule(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(editingRule)} onClose={() => setEditingRule(null)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Pricing Rule</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2, pt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Service</InputLabel>
              <Select
                label="Service"
                value={editForm.serviceCategory}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    serviceCategory: event.target.value as ServiceKey,
                    procedureName: '',
                  }))
                }
              >
                {SERVICES.map((service) => (
                  <MenuItem key={service} value={service}>{service}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={editForm.isActive ? 'active' : 'inactive'}
                onChange={(event) => setEditForm((current) => ({ ...current, isActive: event.target.value === 'active' }))}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small" error={Boolean(editErrors.countryName)}>
              <InputLabel>Country</InputLabel>
              <Select
                label="Country"
                value={editCountryId}
                onChange={(event) => {
                  const country = countries.find((item) => item._id === event.target.value);
                  setEditCountryId(event.target.value);
                  setEditForm((current) => ({
                    ...current,
                    countryName: country?.name || '',
                    countryAbbreviation: country?.abbreviation || '',
                  }));
                }}
              >
                {countries.map((country) => (
                  <MenuItem key={country._id} value={country._id}>
                    {country.name}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>{editErrors.countryName || ' '}</FormHelperText>
            </FormControl>
            <TextField
              size="small"
              label="Country Code"
              value={editForm.countryAbbreviation}
              error={Boolean(editErrors.countryAbbreviation)}
              helperText={editErrors.countryAbbreviation}
              disabled
            />
            <FormControl fullWidth size="small" error={Boolean(editErrors.procedureName)} sx={{ gridColumn: { md: '1 / -1' } }}>
              <InputLabel>Procedure</InputLabel>
              <Select
                label="Procedure"
                value={editForm.procedureName}
                onChange={(event) => setEditForm((current) => ({ ...current, procedureName: event.target.value }))}
              >
                {filteredEditProcedures.map((procedure) => (
                  <MenuItem key={procedure._id} value={procedure.name}>
                    {procedure.name}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                {editErrors.procedureName || `${filteredEditProcedures.length} procedures for ${editForm.serviceCategory}`}
              </FormHelperText>
            </FormControl>
            <TextField
              size="small"
              type="number"
              label="Office Fee"
              value={editForm.officialFee}
              error={Boolean(editErrors.officialFee)}
              helperText={editErrors.officialFee}
              onChange={(event) => setEditForm((current) => ({ ...current, officialFee: event.target.value }))}
            />
            <TextField
              size="small"
              type="number"
              label="Attorney Fee"
              value={editForm.attorneyFee}
              error={Boolean(editErrors.attorneyFee)}
              helperText={editErrors.attorneyFee}
              onChange={(event) => setEditForm((current) => ({ ...current, attorneyFee: event.target.value }))}
            />
            <TextField
              size="small"
              type="number"
              label="Class Fee"
              value={editForm.classFee}
              error={Boolean(editErrors.classFee)}
              helperText={editErrors.classFee}
              onChange={(event) => setEditForm((current) => ({ ...current, classFee: event.target.value }))}
            />
            <TextField
              size="small"
              label="Total"
              value={(() => {
                const officialFee = normalizeNumberInput(editForm.officialFee);
                const attorneyFee = normalizeNumberInput(editForm.attorneyFee);
                const classFee = normalizeNumberInput(editForm.classFee);
                if (officialFee === null || attorneyFee === null || classFee === null) return '-';
                if (officialFee < 0 || attorneyFee < 0 || classFee < 0) return '-';
                return formatMoney(officialFee + attorneyFee + classFee);
              })()}
              disabled
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingRule(null)}>Cancel</Button>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={updateRow}>Update</Button>
        </DialogActions>
      </Dialog>

      <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}>
        <MenuItem onClick={() => { setExportAnchor(null); exportExcel(); }}>Excel (.xlsx)</MenuItem>
        <MenuItem onClick={() => { setExportAnchor(null); exportCsv(); }}>CSV (.csv)</MenuItem>
        <MenuItem onClick={() => { setExportAnchor(null); exportDraftJson(); }}>Draft JSON</MenuItem>
      </Menu>

      <Menu
        anchorEl={advancedAnchor}
        open={Boolean(advancedAnchor)}
        onClose={() => setAdvancedAnchor(null)}
        slotProps={{ paper: { sx: { width: { xs: 'calc(100vw - 32px)', sm: 460 }, maxWidth: '100%', p: 1 } } }}
      >
        <Box sx={{ p: 1 }} onClick={(event) => event.stopPropagation()}>
          <Typography sx={{ fontWeight: 900, mb: 1 }}>Column Visibility</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.5 }}>
            {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map((column) => (
              <FormControlLabel
                key={column}
                control={
                  <Checkbox
                    size="small"
                    checked={columnVisibility[column]}
                    onChange={(event) =>
                      setColumnVisibility((current) => ({ ...current, [column]: event.target.checked }))
                    }
                  />
                }
                label={COLUMN_LABELS[column]}
              />
            ))}
          </Box>

          <Divider sx={{ my: 1.5 }} />

          <Typography sx={{ fontWeight: 900, mb: 1 }}>Style Template</Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <TextField
              fullWidth
              size="small"
              type="color"
              label="Header Color"
              value={headerColor}
              onChange={(event) => setHeaderColor(event.target.value)}
            />
            <TextField
              fullWidth
              size="small"
              type="color"
              label="Row Color"
              value={rowColor}
              onChange={(event) => setRowColor(event.target.value)}
            />
          </Stack>

          <Divider sx={{ my: 1.5 }} />

          <Typography sx={{ fontWeight: 900, mb: 1 }}>Drafts</Typography>
          <TextField
            fullWidth
            size="small"
            label="Draft Name"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            sx={{ mb: 1 }}
          />
          <List dense disablePadding sx={{ maxHeight: 180, overflow: 'auto', border: '1px solid #E2E8F0', borderRadius: 1 }}>
            {drafts.map((draft) => (
              <ListItemButton key={draft.id} sx={{ alignItems: 'flex-start', gap: 1 }}>
                <ListItemText
                  primary={draft.name}
                  secondary={`${draft.selectedService} - ${new Date(draft.updatedAt).toLocaleString()}`}
                />
                <Stack direction="row" spacing={0.5}>
                  <Button size="small" onClick={() => applyDraft(draft)}>Load</Button>
                  <Button size="small" color="error" onClick={() => deleteDraft(draft.id)}>Delete</Button>
                </Stack>
              </ListItemButton>
            ))}
            {drafts.length === 0 && (
              <Box sx={{ p: 1.5, color: '#64748B' }}>No saved drafts.</Box>
            )}
          </List>

          <Divider sx={{ my: 1.5 }} />

          <Typography sx={{ fontWeight: 900, mb: 1 }}>Audit</Typography>
          <List dense disablePadding sx={{ maxHeight: 160, overflow: 'auto' }}>
            {auditLog.map((entry) => (
              <ListItemButton key={entry.id} sx={{ px: 0 }}>
                <ListItemText primary={entry.action} secondary={new Date(entry.at).toLocaleString()} />
              </ListItemButton>
            ))}
            {auditLog.length === 0 && (
              <Box sx={{ color: '#64748B' }}>No changes recorded.</Box>
            )}
          </List>
        </Box>
      </Menu>
    </Box>
  );
}
