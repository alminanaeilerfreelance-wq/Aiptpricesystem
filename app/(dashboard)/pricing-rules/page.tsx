'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
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
import useDebounce from '@/hooks/useDebounce';
import { useAuth } from '@/hooks/useAuth';

export const dynamic = 'force-dynamic';

type ServiceKey = 'Trademark' | 'Patent' | 'Design' | 'Copyright' | 'Litigation';
type StatusFilter = 'all' | 'active' | 'inactive';
type FeeField = 'officialFee' | 'attorneyFee' | 'classFee';
type ColumnKey = 'country' | 'procedure' | 'officeFee' | 'attorneyFee' | 'classFee' | 'total' | 'status' | 'updatedAt';
type EditableCellField = 'country' | 'procedure' | FeeField | 'status';

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
    _id?: string;
    flagCode?: string;
    abbreviation?: string;
    name?: string;
    isActive?: boolean;
  } | null;
  procedure?: {
    _id?: string;
    name?: string;
    serviceCategory?: ServiceKey;
    serviceName?: string;
    isActive?: boolean;
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

const PlusIcon = () => (
  <SvgIcon fontSize="small" viewBox="0 0 24 24">
    <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6v-2Z" />
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

const uniqueById = <T extends { _id: string }>(items: T[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item._id || seen.has(item._id)) return false;
    seen.add(item._id);
    return true;
  });
};

const syntheticCountryId = (name: string, abbreviation: string) =>
  `selected-country-${name}-${abbreviation}`.replace(/\s+/g, '-').toLowerCase();

const syntheticProcedureId = (name: string, serviceCategory: ServiceKey) =>
  `selected-procedure-${serviceCategory}-${name}`.replace(/\s+/g, '-').toLowerCase();

const makeCountryValue = (name: string, abbreviation: string): Country | null => {
  const countryName = name.trim();
  const countryAbbreviation = abbreviation.trim().toUpperCase();
  if (!countryName && !countryAbbreviation) return null;

  return {
    _id: syntheticCountryId(countryName, countryAbbreviation),
    name: countryName,
    abbreviation: countryAbbreviation,
    flagCode: countryAbbreviation.toLowerCase(),
    isActive: true,
    createdAt: '',
    updatedAt: '',
  };
};

const makeProcedureValue = (name: string, serviceCategory: ServiceKey): Procedure | null => {
  const procedureName = name.trim();
  if (!procedureName) return null;

  return {
    _id: syntheticProcedureId(procedureName, serviceCategory),
    name: procedureName,
    serviceId: '',
    serviceName: serviceCategory,
    serviceCategory,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  };
};

export default function PricingRulesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [selectedService, setSelectedService] = useState<ServiceKey>('Trademark');
  const [pricingRules, setPricingRules] = useState<PricingRuleRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [countryOptions, setCountryOptions] = useState<Country[]>([]);
  const [countryOptionsLoading, setCountryOptionsLoading] = useState(false);
  const [createCountryInput, setCreateCountryInput] = useState('');
  const [editCountryInput, setEditCountryInput] = useState('');
  const [createProcedureOptions, setCreateProcedureOptions] = useState<Procedure[]>([]);
  const [editProcedureOptions, setEditProcedureOptions] = useState<Procedure[]>([]);
  const [createProcedureLoading, setCreateProcedureLoading] = useState(false);
  const [editProcedureLoading, setEditProcedureLoading] = useState(false);
  const [createProcedureInput, setCreateProcedureInput] = useState('');
  const [editProcedureInput, setEditProcedureInput] = useState('');
  const [cellCountryInput, setCellCountryInput] = useState('');
  const [cellProcedureInput, setCellProcedureInput] = useState('');
  const [activeCell, setActiveCell] = useState<{ rowId: string; field: EditableCellField } | null>(null);
  const [rowEdits, setRowEdits] = useState<Record<string, EditableRule>>({});
  const [dirtyRows, setDirtyRows] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, RowValidation>>({});
  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});
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
  const [createProcedureId, setCreateProcedureId] = useState('');
  const [createForm, setCreateForm] = useState<EditableRule>(() => makeDefaultRuleForm('Trademark'));
  const [createErrors, setCreateErrors] = useState<RowValidation>({});
  const [editingRule, setEditingRule] = useState<PricingRuleRow | null>(null);
  const [editCountryId, setEditCountryId] = useState('');
  const [editProcedureId, setEditProcedureId] = useState('');
  const [editForm, setEditForm] = useState<EditableRule>(() => makeDefaultRuleForm('Trademark'));
  const [editErrors, setEditErrors] = useState<RowValidation>({});
  const [viewingRule, setViewingRule] = useState<PricingRuleRow | null>(null);
  const [advancedAnchor, setAdvancedAnchor] = useState<HTMLElement | null>(null);
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const debouncedCreateCountryInput = useDebounce(createCountryInput, 250);
  const debouncedEditCountryInput = useDebounce(editCountryInput, 250);
  const debouncedCellCountryInput = useDebounce(cellCountryInput, 250);
  const debouncedCreateProcedureInput = useDebounce(createProcedureInput, 250);
  const debouncedEditProcedureInput = useDebounce(editProcedureInput, 250);
  const debouncedCellProcedureInput = useDebounce(cellProcedureInput, 250);

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
    if (!createDialogOpen) return;
    let active = true;

    const loadCountries = async () => {
      setCountryOptionsLoading(true);
      try {
        const response = await countriesService.list({
          search: debouncedCreateCountryInput.trim() || undefined,
          page: 1,
          limit: 20,
        });

        if (!active) return;

        setCountryOptions((current) =>
          uniqueById([
            ...current.filter((country) => country._id === createCountryId || country._id === editCountryId),
            ...(response.countries || []),
          ])
        );
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to search countries');
      } finally {
        if (active) setCountryOptionsLoading(false);
      }
    };

    loadCountries();

    return () => {
      active = false;
    };
  }, [createCountryId, createDialogOpen, debouncedCreateCountryInput, editCountryId]);

  useEffect(() => {
    if (!editingRule) return;
    let active = true;

    const loadCountries = async () => {
      setCountryOptionsLoading(true);
      try {
        const response = await countriesService.list({
          search: debouncedEditCountryInput.trim() || undefined,
          page: 1,
          limit: 20,
        });

        if (!active) return;

        setCountryOptions((current) =>
          uniqueById([
            ...current.filter((country) => country._id === createCountryId || country._id === editCountryId),
            ...(response.countries || []),
          ])
        );
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to search countries');
      } finally {
        if (active) setCountryOptionsLoading(false);
      }
    };

    loadCountries();

    return () => {
      active = false;
    };
  }, [createCountryId, debouncedEditCountryInput, editCountryId, editingRule]);

  useEffect(() => {
    if (!activeCell || activeCell.field !== 'country') return;
    let active = true;

    const loadCountries = async () => {
      setCountryOptionsLoading(true);
      try {
        const response = await countriesService.list({
          search: debouncedCellCountryInput.trim() || undefined,
          page: 1,
          limit: 50,
        });

        if (!active) return;

        setCountryOptions((current) => uniqueById([...current, ...(response.countries || [])]));
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to search countries');
      } finally {
        if (active) setCountryOptionsLoading(false);
      }
    };

    loadCountries();

    return () => {
      active = false;
    };
  }, [activeCell, debouncedCellCountryInput]);

  useEffect(() => {
    if (!createDialogOpen) return;
    let active = true;

    const loadProcedures = async () => {
      setCreateProcedureLoading(true);
      try {
        const response = await proceduresService.list({
          category: createForm.serviceCategory,
          search: debouncedCreateProcedureInput.trim() || undefined,
          page: 1,
          limit: 20,
        });

        if (!active) return;

        setCreateProcedureOptions((current) =>
          uniqueById([
            ...current.filter((procedure) => procedure._id === createProcedureId),
            ...(response.procedures || []),
          ])
        );
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to search procedures');
      } finally {
        if (active) setCreateProcedureLoading(false);
      }
    };

    loadProcedures();

    return () => {
      active = false;
    };
  }, [createDialogOpen, createForm.serviceCategory, createProcedureId, debouncedCreateProcedureInput]);

  useEffect(() => {
    if (!editingRule) return;
    let active = true;

    const loadProcedures = async () => {
      setEditProcedureLoading(true);
      try {
        const response = await proceduresService.list({
          category: editForm.serviceCategory,
          search: debouncedEditProcedureInput.trim() || undefined,
          page: 1,
          limit: 20,
        });

        if (!active) return;

        setEditProcedureOptions((current) =>
          uniqueById([
            ...current.filter((procedure) => procedure._id === editProcedureId),
            ...(response.procedures || []),
          ])
        );
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to search procedures');
      } finally {
        if (active) setEditProcedureLoading(false);
      }
    };

    loadProcedures();

    return () => {
      active = false;
    };
  }, [debouncedEditProcedureInput, editForm.serviceCategory, editProcedureId, editingRule]);

  useEffect(() => {
    if (!activeCell || activeCell.field !== 'procedure') return;
    let active = true;

    const loadProcedures = async () => {
      setEditProcedureLoading(true);
      try {
        const response = await proceduresService.list({
          category: selectedService,
          search: debouncedCellProcedureInput.trim() || undefined,
          page: 1,
          limit: 50,
        });

        if (!active) return;

        setEditProcedureOptions((current) => uniqueById([...current, ...(response.procedures || [])]));
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to search procedures');
      } finally {
        if (active) setEditProcedureLoading(false);
      }
    };

    loadProcedures();

    return () => {
      active = false;
    };
  }, [activeCell, debouncedCellProcedureInput, selectedService]);

  useEffect(() => {
    let active = true;

    const loadPricingRules = async () => {
      setLoading(true);
      setError('');
      try {
        const nextRules = (await pricingRulesService.listAll({
          category: selectedService,
          search: search.trim() || undefined,
          status: statusFilter,
        })) as PricingRuleRow[];

        if (!active) return;

        setPricingRules((current) => {
          const unsavedRows = current.filter((rule) => rule.isNew);
          return [...unsavedRows, ...nextRules];
        });
        setTotalRows(nextRules.length);
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
  }, [search, selectedService, statusFilter]);

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

  const pagedRules = useMemo(() => {
    if (rowsPerPage === -1) return orderedRules;
    const start = page * rowsPerPage;
    return orderedRules.slice(start, start + rowsPerPage);
  }, [orderedRules, page, rowsPerPage]);

  useEffect(() => {
    setPage(0);
    setActiveCell(null);
  }, [search, selectedService, statusFilter]);

  useEffect(() => {
    if (rowsPerPage === -1) return;
    const lastPage = Math.max(0, Math.ceil(orderedRules.length / rowsPerPage) - 1);
    if (page > lastPage) setPage(lastPage);
  }, [orderedRules.length, page, rowsPerPage]);

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
    if (!isAdmin) return;
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

  useEffect(() => {
    if (!isAdmin) return;

    const dirtyIds = Object.entries(dirtyRows)
      .filter(([, dirty]) => dirty)
      .map(([id]) => id)
      .filter((id) => !savingRows[id]);

    if (dirtyIds.length === 0) return;

    const timers = dirtyIds.map((id) =>
      window.setTimeout(async () => {
        const rule = pricingRules.find((item) => item._id === id);
        if (!rule || rule.isNew) return;

        const validation = validateEditableRule(rowEdits[id] || toEditableRule(rule));
        setRowErrors((current) => ({ ...current, [id]: validation.nextErrors }));
        if (!validation.isValid) return;

        setSavingRows((current) => ({ ...current, [id]: true }));
        try {
          const updated = (await pricingRulesService.update(id, validation.payload)) as PricingRuleRow;
          setPricingRules((current) => current.map((item) => (item._id === id ? { ...item, ...updated } : item)));
          setRowEdits((current) => ({ ...current, [id]: toEditableRule(updated) }));
          setDirtyRows((current) => ({ ...current, [id]: false }));
          addAudit(`Autosaved: ${updated.countryName} / ${updated.procedureName}`);
          showSuccessToast('Pricing rule updated');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to autosave pricing rule');
        } finally {
          setSavingRows((current) => {
            const next = { ...current };
            delete next[id];
            return next;
          });
        }
      }, 800)
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirtyRows, isAdmin, pricingRules, rowEdits, savingRows]);

  const openCreateDialog = () => {
    if (!isAdmin) return;
    setCreateForm(makeDefaultRuleForm(selectedService));
    setCreateCountryId('');
    setCreateCountryInput('');
    setCreateProcedureId('');
    setCreateProcedureInput('');
    setCreateProcedureOptions([]);
    setCreateErrors({});
    setCreateDialogOpen(true);
    addAudit('Add Rule Modal Opened');
  };

  const createPricingRule = async () => {
    if (!isAdmin) return;
    const validation = validateEditableRule(createForm);
    setCreateErrors(validation.nextErrors);
    if (!validation.isValid) return;

    try {
      const created = (await pricingRulesService.create({
        ...validation.payload,
        ...(createCountryId ? { countryId: createCountryId } : {}),
        ...(createProcedureId ? { procedureId: createProcedureId } : {}),
      })) as PricingRuleRow;
      if (created.serviceCategory === selectedService) {
        setPricingRules((current) => [created, ...current]);
        setRowEdits((current) => ({ ...current, [created._id]: toEditableRule(created) }));
        setRowOrder((current) => [created._id, ...current.filter((id) => id !== created._id)]);
        setTotalRows((current) => current + 1);
      }
      setCreateDialogOpen(false);
      setCreateForm(makeDefaultRuleForm(selectedService));
      setCreateCountryId('');
      setCreateCountryInput('');
      setCreateProcedureId('');
      setCreateProcedureInput('');
      setCreateProcedureOptions([]);
      setCreateErrors({});
      addAudit(`Row Added: ${created.countryName} / ${created.procedureName}`);
      showSuccessToast('Pricing rule added');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add pricing rule');
    }
  };

  const editRow = (rule: PricingRuleRow) => {
    if (!isAdmin) return;
    const edit = getEdit(rule);
    const ruleCountry: Country | null = rule.country?._id
      ? {
          _id: rule.country._id,
          name: rule.country.name || edit.countryName,
          abbreviation: rule.country.abbreviation || edit.countryAbbreviation,
          flagCode: rule.country.flagCode || (rule.country.abbreviation || edit.countryAbbreviation).toLowerCase(),
          isActive: rule.country.isActive !== false,
          createdAt: '',
          updatedAt: '',
        }
      : null;
    const country =
      countryOptions.find((item) => item.name === edit.countryName || item.abbreviation === edit.countryAbbreviation) ||
      ruleCountry;
    const ruleProcedure: Procedure | null = rule.procedure?._id
      ? {
          _id: rule.procedure._id,
          name: rule.procedure.name || edit.procedureName,
          serviceId: '',
          serviceName: rule.procedure.serviceName || edit.serviceCategory,
          serviceCategory: (rule.procedure.serviceCategory || edit.serviceCategory) as ServiceKey,
          isActive: rule.procedure.isActive !== false,
          createdAt: '',
          updatedAt: '',
        }
      : null;
    const procedure =
      ruleProcedure ||
      editProcedureOptions.find(
        (item) => item.name === edit.procedureName && item.serviceCategory === edit.serviceCategory
      );

    if (country) {
      setCountryOptions((current) => uniqueById([country, ...current]));
    }
    if (procedure) {
      setEditProcedureOptions((current) => uniqueById([procedure, ...current]));
    }

    setEditingRule(rule);
    setEditForm(edit);
    setEditCountryId(country?._id || '');
    setEditCountryInput(edit.countryName);
    setEditProcedureId(procedure?._id || '');
    setEditProcedureInput(edit.procedureName);
    setEditErrors({});
    addAudit(`Edit Modal Opened: ${rule.countryName || 'Pricing Rule'}`);
  };

  const updateRow = async () => {
    if (!isAdmin) return;
    if (!editingRule) return;
    const validation = validateEditableRule(editForm);
    setEditErrors(validation.nextErrors);
    if (!validation.isValid) return;

    try {
      const updated = await pricingRulesService.update(editingRule._id, {
        ...validation.payload,
        ...(editCountryId ? { countryId: editCountryId } : {}),
        ...(editProcedureId ? { procedureId: editProcedureId } : {}),
      });
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
      setEditCountryInput('');
      setEditProcedureId('');
      setEditProcedureInput('');
      setEditProcedureOptions([]);
      addAudit(`Row Updated: ${updatedRow.countryName} / ${updatedRow.procedureName}`);
      showSuccessToast('Pricing rule updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update pricing rule');
    }
  };

  const deleteRow = async (rule: PricingRuleRow) => {
    if (!isAdmin) return;
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

  const getRuleFlagSrc = (rule: PricingRuleRow) => {
    const edit = getEdit(rule);
    const flagCode = (rule.country?.flagCode || edit.countryAbbreviation || '').toLowerCase();
    return flagCode ? `https://flagcdn.com/w80/${flagCode}.png` : '';
  };

  const exportRows = () =>
    orderedRules.map((rule) => {
      const edit = getEdit(rule);
      return {
        ID: rule.isNew ? '' : rule._id,
        Flag: getRuleFlagSrc(rule),
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
    const rows = orderedRules.map((rule) => {
      const edit = getEdit(rule);
      const total = getRowTotal(rule);
      return { rule, edit, total };
    });
    const escapeHtml = (value: unknown) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    const html = `
      <html>
        <head><meta charset="utf-8" /></head>
        <body>
          <table border="1">
            <thead>
              <tr>
                <th>Flag</th>
                <th>Service</th>
                <th>Country</th>
                <th>Code</th>
                <th>Procedure</th>
                <th>Office Fee</th>
                <th>Attorney Fee</th>
                <th>Class Fee</th>
                <th>Total</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(({ rule, edit, total }) => {
                  const flagSrc = getRuleFlagSrc(rule);
                  return `
                    <tr>
                      <td>${flagSrc ? `<img src="${escapeHtml(flagSrc)}" width="32" height="22" />` : ''}</td>
                      <td>${escapeHtml(edit.serviceCategory)}</td>
                      <td>${escapeHtml(edit.countryName)}</td>
                      <td>${escapeHtml(edit.countryAbbreviation)}</td>
                      <td>${escapeHtml(edit.procedureName)}</td>
                      <td>${escapeHtml(edit.officialFee)}</td>
                      <td>${escapeHtml(edit.attorneyFee)}</td>
                      <td>${escapeHtml(edit.classFee)}</td>
                      <td>${escapeHtml(total === null ? '' : total)}</td>
                      <td>${escapeHtml(edit.isActive ? 'Active' : 'Inactive')}</td>
                      <td>${escapeHtml(rule.updatedAt)}</td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pricing-rules-${selectedService.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
    URL.revokeObjectURL(url);
    addAudit('Excel Export Generated');
    showSuccessToast('Excel exported');
  };

  const imageToDataUrl = async (src: string) => {
    const response = await fetch(src);
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const [{ default: jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
      const autoTable = (autoTableModule as unknown as { default: (doc: unknown, options: unknown) => void }).default;
      const doc = new jsPDF({ orientation: 'landscape' });
      const flagEntries = await Promise.all(
        orderedRules.map(async (rule) => {
          const src = getRuleFlagSrc(rule);
          if (!src) return [rule._id, ''] as const;
          try {
            return [rule._id, await imageToDataUrl(src)] as const;
          } catch {
            return [rule._id, ''] as const;
          }
        })
      );
      const flagMap = new Map(flagEntries);

      doc.setFontSize(14);
      doc.text(`Pricing Rules - ${selectedService}`, 14, 14);
      autoTable(doc, {
        startY: 20,
        head: [['Flag', 'Country', 'Code', 'Procedure', 'Office', 'Attorney', 'Class', 'Total', 'Status']],
        body: orderedRules.map((rule) => {
          const edit = getEdit(rule);
          const total = getRowTotal(rule);
          return [
            '',
            edit.countryName,
            edit.countryAbbreviation,
            edit.procedureName,
            edit.officialFee,
            edit.attorneyFee,
            edit.classFee,
            total === null ? '' : String(total),
            edit.isActive ? 'Active' : 'Inactive',
          ];
        }),
        styles: { fontSize: 8, cellPadding: 2, minCellHeight: 10 },
        columnStyles: { 0: { cellWidth: 16 }, 3: { cellWidth: 52 } },
        didDrawCell: (data: { section: string; column: { index: number }; row: { index: number }; cell: { x: number; y: number } }) => {
          if (data.section !== 'body' || data.column.index !== 0) return;
          const rule = orderedRules[data.row.index];
          const image = rule ? flagMap.get(rule._id) : '';
          if (image) doc.addImage(image, 'PNG', data.cell.x + 2, data.cell.y + 2, 10, 6);
        },
      });
      doc.save(`pricing-rules-${selectedService.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`);
      addAudit('PDF Export Generated');
      showSuccessToast('PDF exported');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export PDF');
    } finally {
      setExporting(false);
    }
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
    return getRuleFlagSrc(rule);
  };

  const activateCell = (rule: PricingRuleRow, field: EditableCellField) => {
    if (!isAdmin) return;
    const edit = getEdit(rule);
    setActiveCell({ rowId: rule._id, field });
    if (field === 'country') setCellCountryInput(edit.countryName);
    if (field === 'procedure') setCellProcedureInput(edit.procedureName);
  };

  const isActiveCell = (rule: PricingRuleRow, field: EditableCellField) =>
    Boolean(isAdmin && activeCell?.rowId === rule._id && activeCell.field === field);

  const renderCountryCell = (rule: PricingRuleRow) => {
    const edit = getEdit(rule);
    const selectedCountry =
      countryOptions.find(
        (country) =>
          country._id === rule.country?._id ||
          country.name === edit.countryName ||
          country.abbreviation === edit.countryAbbreviation
      ) || makeCountryValue(edit.countryName, edit.countryAbbreviation);
    const countrySearchOptions = uniqueById([...(selectedCountry ? [selectedCountry] : []), ...countryOptions]);

    if (isActiveCell(rule, 'country')) {
      return (
        <Autocomplete
          autoHighlight
          openOnFocus
          size="small"
          options={countrySearchOptions}
          value={selectedCountry}
          inputValue={cellCountryInput}
          loading={countryOptionsLoading}
          filterOptions={(options) => options}
          isOptionEqualToValue={(option, value) => option._id === value._id}
          getOptionLabel={(option) => `${option.name}${option.abbreviation ? ` (${option.abbreviation})` : ''}`}
          onInputChange={(_event, value) => {
            setCellCountryInput(value);
          }}
          onChange={(_event, value) => {
            if (!value) return;
            updateEdit(rule, {
              countryName: value.name || '',
              countryAbbreviation: value.abbreviation || '',
            });
            setCellCountryInput(value.name || '');
            setCountryOptions((current) => uniqueById([value, ...current]));
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              autoFocus
              placeholder="Select country"
              onKeyDown={(event) => {
                if (event.key === 'Escape') setActiveCell(null);
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 0.5,
                  bgcolor: '#FFFFFF',
                  py: 0,
                },
              }}
            />
          )}
        />
      );
    }

    return (
      <Stack
        direction="row"
        spacing={1}
        onClick={() => activateCell(rule, 'country')}
        sx={{
          alignItems: 'center',
          minWidth: 0,
          cursor: isAdmin ? 'cell' : 'default',
          px: 0.5,
          py: 0.5,
          borderRadius: 0.5,
          '&:hover': isAdmin ? { bgcolor: '#EFF6FF' } : undefined,
        }}
      >
        {getFlagSrc(rule) ? (
          <Box
            component="img"
            src={getFlagSrc(rule)}
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
    );
  };

  const renderProcedureCell = (rule: PricingRuleRow) => {
    const edit = getEdit(rule);
    const selectedProcedure =
      editProcedureOptions.find(
        (procedure) =>
          procedure._id === rule.procedure?._id ||
          (procedure.name === edit.procedureName && procedure.serviceCategory === edit.serviceCategory)
      ) || makeProcedureValue(edit.procedureName, edit.serviceCategory);
    const procedureSearchOptions = uniqueById([
      ...(selectedProcedure ? [selectedProcedure] : []),
      ...editProcedureOptions.filter((procedure) => procedure.serviceCategory === edit.serviceCategory),
    ]);

    if (isActiveCell(rule, 'procedure')) {
      return (
        <Autocomplete
          autoHighlight
          openOnFocus
          size="small"
          options={procedureSearchOptions}
          value={selectedProcedure}
          inputValue={cellProcedureInput}
          loading={editProcedureLoading}
          filterOptions={(options) => options}
          isOptionEqualToValue={(option, value) => option._id === value._id}
          getOptionLabel={(option) => `${option.name}${option.serviceCategory ? ` (${option.serviceCategory})` : ''}`}
          onInputChange={(_event, value) => {
            setCellProcedureInput(value);
          }}
          onChange={(_event, value) => {
            if (!value) return;
            updateEdit(rule, {
              procedureName: value.name || '',
              serviceCategory: (value.serviceCategory || edit.serviceCategory) as ServiceKey,
            });
            setCellProcedureInput(value.name || '');
            setEditProcedureOptions((current) => uniqueById([value, ...current]));
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              autoFocus
              placeholder="Select procedure"
              onKeyDown={(event) => {
                if (event.key === 'Escape') setActiveCell(null);
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 0.5,
                  bgcolor: '#FFFFFF',
                  py: 0,
                },
              }}
            />
          )}
        />
      );
    }

    return (
      <Box
        onClick={() => activateCell(rule, 'procedure')}
        sx={{
          cursor: isAdmin ? 'cell' : 'default',
          px: 0.75,
          py: 0.5,
          borderRadius: 0.5,
          '&:hover': isAdmin ? { bgcolor: '#EFF6FF' } : undefined,
        }}
      >
        {renderEditableText(rule, 'procedureName', 'Procedure', columnWidth)}
      </Box>
    );
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
    if (isActiveCell(rule, field)) {
      return (
        <TextField
          size="small"
          type="number"
          value={edit[field]}
          autoFocus
          disabled={Boolean(savingRows[rule._id])}
          onChange={(event) => updateEdit(rule, { [field]: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setActiveCell(null);
          }}
          slotProps={{
            htmlInput: {
              'aria-label': `${label} for ${edit.countryName}`,
              min: 0,
              step: '0.01',
              style: { textAlign: 'right', fontSize: 13, padding: '5px 8px' },
            },
          }}
          sx={{
            width: '100%',
            minWidth: 96,
            '& .MuiOutlinedInput-root': {
              borderRadius: 0.5,
              bgcolor: '#FFFFFF',
            },
          }}
        />
      );
    }
    const value = normalizeNumberInput(edit[field]) ?? 0;
    return (
      <Box
        onClick={() => activateCell(rule, field)}
        sx={{
          cursor: isAdmin ? 'cell' : 'default',
          px: 0.75,
          py: 0.5,
          borderRadius: 0.5,
          '&:hover': isAdmin ? { bgcolor: '#EFF6FF' } : undefined,
        }}
      >
        <Typography title={label} sx={{ fontSize: 13, textAlign: 'right' }}>
          {formatMoney(value)}
        </Typography>
      </Box>
    );
  };

  const createCountryValue = useMemo(
    () =>
      countryOptions.find((country) => country._id === createCountryId) ||
      makeCountryValue(createForm.countryName, createForm.countryAbbreviation),
    [countryOptions, createCountryId, createForm.countryAbbreviation, createForm.countryName]
  );
  const editCountryValue = useMemo(
    () =>
      countryOptions.find((country) => country._id === editCountryId) ||
      makeCountryValue(editForm.countryName, editForm.countryAbbreviation),
    [countryOptions, editCountryId, editForm.countryAbbreviation, editForm.countryName]
  );
  const createProcedureValue = useMemo(
    () =>
      createProcedureOptions.find((procedure) => procedure._id === createProcedureId) ||
      makeProcedureValue(createForm.procedureName, createForm.serviceCategory),
    [createForm.procedureName, createForm.serviceCategory, createProcedureId, createProcedureOptions]
  );
  const editProcedureValue = useMemo(
    () =>
      editProcedureOptions.find((procedure) => procedure._id === editProcedureId) ||
      makeProcedureValue(editForm.procedureName, editForm.serviceCategory),
    [editForm.procedureName, editForm.serviceCategory, editProcedureId, editProcedureOptions]
  );
  const createCountryOptions = useMemo(
    () => uniqueById([...(createCountryValue ? [createCountryValue] : []), ...countryOptions]),
    [countryOptions, createCountryValue]
  );
  const editCountryOptions = useMemo(
    () => uniqueById([...(editCountryValue ? [editCountryValue] : []), ...countryOptions]),
    [countryOptions, editCountryValue]
  );
  const createProcedureSearchOptions = useMemo(
    () => uniqueById([...(createProcedureValue ? [createProcedureValue] : []), ...createProcedureOptions]),
    [createProcedureOptions, createProcedureValue]
  );
  const editProcedureSearchOptions = useMemo(
    () => uniqueById([...(editProcedureValue ? [editProcedureValue] : []), ...editProcedureOptions]),
    [editProcedureOptions, editProcedureValue]
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
                onChange={(event) => setSearch(event.target.value)}
                sx={{ minWidth: { xs: '100%', sm: 240 } }}
              />
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Filter</InputLabel>
                <Select
                  label="Filter"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
              {isAdmin && (
                <Button variant="contained" startIcon={<PlusIcon />} onClick={openCreateDialog}>
                  Add Rule
                </Button>
              )}
              {isAdmin && <Button variant="outlined" onClick={() => importInputRef.current?.click()}>Import</Button>}
              <Button variant="outlined" disabled={exporting} onClick={(event) => setExportAnchor(event.currentTarget)}>Export</Button>
              <Button variant="outlined" onClick={(event) => setAdvancedAnchor(event.currentTarget)}>Tools</Button>
              {isAdmin && <Button variant="contained" onClick={saveDraft}>Save Draft</Button>}
              {isAdmin && <Button variant="outlined" onClick={createNewDraft}>New Draft</Button>}
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
              <Box sx={{ flex: 1 }} />
              <Typography sx={{ color: '#475569', fontSize: 13, fontWeight: 700 }}>
                {Object.keys(savingRows).length > 0 ? 'Saving changes...' : `${totalRows} records loaded`}
              </Typography>
            </Stack>
          </Box>

          <Tabs
            value={selectedService}
            onChange={(_event: React.SyntheticEvent, value: ServiceKey) => {
              setSelectedService(value);
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
          {!isAdmin && (
            <Alert severity="info" sx={{ borderRadius: 0 }}>
              Pricing rules are view-only for this account. Only administrators can edit and autosave changes.
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
                {pagedRules.map((rule) => {
                  const edit = getEdit(rule);
                  const total = getRowTotal(rule);
                  const errors = rowErrors[rule._id] || {};
                  const validationMessage = Object.values(errors).filter(Boolean)[0] || '';

                  return (
                    <TableRow
                      key={rule._id}
                      draggable={isAdmin}
                      onDragStart={() => {
                        if (isAdmin) setDraggedRowId(rule._id);
                      }}
                      onDragOver={(event) => {
                        if (isAdmin) event.preventDefault();
                      }}
                      onDrop={() => {
                        if (isAdmin) handleRowDrop(rule._id);
                      }}
                      sx={{ cursor: isAdmin ? 'grab' : 'default' }}
                    >
                      {columnVisibility.country && (
                        <TableCell>{renderCountryCell(rule)}</TableCell>
                      )}
                      {columnVisibility.procedure && (
                        <TableCell>{renderProcedureCell(rule)}</TableCell>
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
                          {isActiveCell(rule, 'status') ? (
                            <Select
                              size="small"
                              value={edit.isActive ? 'active' : 'inactive'}
                              disabled={Boolean(savingRows[rule._id])}
                              onChange={(event) => updateEdit(rule, { isActive: event.target.value === 'active' })}
                              onClose={() => setActiveCell(null)}
                              sx={{
                                minWidth: 108,
                                '& .MuiSelect-select': {
                                  py: 0.5,
                                  fontSize: 12,
                                  fontWeight: 800,
                                  color: edit.isActive ? '#047857' : '#B91C1C',
                                },
                              }}
                            >
                              <MenuItem value="active">Active</MenuItem>
                              <MenuItem value="inactive">Inactive</MenuItem>
                            </Select>
                          ) : (
                            <Typography
                              onClick={() => activateCell(rule, 'status')}
                              sx={{
                                fontSize: 12,
                                fontWeight: 800,
                                color: edit.isActive ? '#047857' : '#B91C1C',
                                cursor: isAdmin ? 'cell' : 'default',
                                px: 0.75,
                                py: 0.5,
                                borderRadius: 0.5,
                                '&:hover': isAdmin ? { bgcolor: '#EFF6FF' } : undefined,
                              }}
                            >
                              {edit.isActive ? 'Active' : 'Inactive'}
                            </Typography>
                          )}
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
                            {isAdmin && (
                              <Tooltip title="Delete">
                                <IconButton size="small" color="error" onClick={() => deleteRow(rule)} aria-label="Delete pricing rule">
                                  <TrashIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                          {savingRows[rule._id] && (
                            <Typography sx={{ fontSize: 10, color: '#2563EB', lineHeight: 1.1 }}>
                              Autosaving...
                            </Typography>
                          )}
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
            count={orderedRules.length}
            page={page}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[
              { label: 'All', value: -1 },
              10,
              50,
              100,
              200,
            ]}
            onPageChange={(_, nextPage) => {
              setPage(nextPage);
              setActiveCell(null);
            }}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(Number(event.target.value));
              setPage(0);
              setActiveCell(null);
            }}
            labelRowsPerPage="Rows"
            sx={{
              borderTop: '1px solid #D7DDE7',
              bgcolor: '#FFFFFF',
              '& .MuiTablePagination-toolbar': {
                minHeight: 44,
              },
            }}
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
                onChange={(event) => {
                  const serviceCategory = event.target.value as ServiceKey;
                  setCreateForm((current) => ({
                    ...current,
                    serviceCategory,
                    procedureName: '',
                  }));
                  setCreateProcedureId('');
                  setCreateProcedureInput('');
                  setCreateProcedureOptions([]);
                }}
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
            <Autocomplete
              size="small"
              options={createCountryOptions}
              value={createCountryValue}
              inputValue={createCountryInput}
              loading={countryOptionsLoading}
              filterOptions={(options) => options}
              isOptionEqualToValue={(option, value) => option._id === value._id}
              getOptionLabel={(option) =>
                `${option.name}${option.abbreviation ? ` (${option.abbreviation})` : ''}`
              }
              onInputChange={(_event, value, reason) => {
                setCreateCountryInput(value);
                if (reason === 'input') {
                  setCreateCountryId('');
                  setCreateForm((current) => ({
                    ...current,
                    countryName: '',
                    countryAbbreviation: '',
                  }));
                }
              }}
              onChange={(_event, value) => {
                setCreateCountryId(value?._id || '');
                setCreateCountryInput(value?.name || '');
                setCreateForm((current) => ({
                  ...current,
                  countryName: value?.name || '',
                  countryAbbreviation: value?.abbreviation || '',
                }));
                setCreateErrors((current) => ({
                  ...current,
                  countryName: undefined,
                  countryAbbreviation: undefined,
                }));
                if (value) setCountryOptions((current) => uniqueById([value, ...current]));
              }}
              loadingText="Searching countries..."
              noOptionsText="No countries found"
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Country"
                  error={Boolean(createErrors.countryName)}
                  helperText={createErrors.countryName || ' '}
                />
              )}
            />
            <TextField
              size="small"
              label="Country Code"
              value={createForm.countryAbbreviation}
              error={Boolean(createErrors.countryAbbreviation)}
              helperText={createErrors.countryAbbreviation || ' '}
              disabled
            />
            <Autocomplete
              size="small"
              sx={{ gridColumn: { md: '1 / -1' } }}
              options={createProcedureSearchOptions}
              value={createProcedureValue}
              inputValue={createProcedureInput}
              loading={createProcedureLoading}
              filterOptions={(options) => options}
              isOptionEqualToValue={(option, value) => option._id === value._id}
              getOptionLabel={(option) =>
                `${option.name}${option.serviceCategory ? ` (${option.serviceCategory})` : ''}`
              }
              onInputChange={(_event, value, reason) => {
                setCreateProcedureInput(value);
                if (reason === 'input') {
                  setCreateProcedureId('');
                  setCreateForm((current) => ({ ...current, procedureName: '' }));
                }
              }}
              onChange={(_event, value) => {
                setCreateProcedureId(value?._id || '');
                setCreateProcedureInput(value?.name || '');
                setCreateForm((current) => ({
                  ...current,
                  procedureName: value?.name || '',
                }));
                setCreateErrors((current) => ({ ...current, procedureName: undefined }));
                if (value) setCreateProcedureOptions((current) => uniqueById([value, ...current]));
              }}
              loadingText="Searching procedures..."
              noOptionsText="No procedures found"
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Procedure"
                  error={Boolean(createErrors.procedureName)}
                  helperText={createErrors.procedureName || ' '}
                />
              )}
            />
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
                onChange={(event) => {
                  const serviceCategory = event.target.value as ServiceKey;
                  setEditForm((current) => ({
                    ...current,
                    serviceCategory,
                    procedureName: '',
                  }));
                  setEditProcedureId('');
                  setEditProcedureInput('');
                  setEditProcedureOptions([]);
                }}
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
            <Autocomplete
              size="small"
              options={editCountryOptions}
              value={editCountryValue}
              inputValue={editCountryInput}
              loading={countryOptionsLoading}
              filterOptions={(options) => options}
              isOptionEqualToValue={(option, value) => option._id === value._id}
              getOptionLabel={(option) =>
                `${option.name}${option.abbreviation ? ` (${option.abbreviation})` : ''}`
              }
              onInputChange={(_event, value, reason) => {
                setEditCountryInput(value);
                if (reason === 'input') {
                  setEditCountryId('');
                  setEditForm((current) => ({
                    ...current,
                    countryName: '',
                    countryAbbreviation: '',
                  }));
                }
              }}
              onChange={(_event, value) => {
                setEditCountryId(value?._id || '');
                setEditCountryInput(value?.name || '');
                setEditForm((current) => ({
                  ...current,
                  countryName: value?.name || '',
                  countryAbbreviation: value?.abbreviation || '',
                }));
                setEditErrors((current) => ({
                  ...current,
                  countryName: undefined,
                  countryAbbreviation: undefined,
                }));
                if (value) setCountryOptions((current) => uniqueById([value, ...current]));
              }}
              loadingText="Searching countries..."
              noOptionsText="No countries found"
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Country"
                  error={Boolean(editErrors.countryName)}
                  helperText={editErrors.countryName || ' '}
                />
              )}
            />
            <TextField
              size="small"
              label="Country Code"
              value={editForm.countryAbbreviation}
              error={Boolean(editErrors.countryAbbreviation)}
              helperText={editErrors.countryAbbreviation || ' '}
              disabled
            />
            <Autocomplete
              size="small"
              sx={{ gridColumn: { md: '1 / -1' } }}
              options={editProcedureSearchOptions}
              value={editProcedureValue}
              inputValue={editProcedureInput}
              loading={editProcedureLoading}
              filterOptions={(options) => options}
              isOptionEqualToValue={(option, value) => option._id === value._id}
              getOptionLabel={(option) =>
                `${option.name}${option.serviceCategory ? ` (${option.serviceCategory})` : ''}`
              }
              onInputChange={(_event, value, reason) => {
                setEditProcedureInput(value);
                if (reason === 'input') {
                  setEditProcedureId('');
                  setEditForm((current) => ({ ...current, procedureName: '' }));
                }
              }}
              onChange={(_event, value) => {
                setEditProcedureId(value?._id || '');
                setEditProcedureInput(value?.name || '');
                setEditForm((current) => ({
                  ...current,
                  procedureName: value?.name || '',
                }));
                setEditErrors((current) => ({ ...current, procedureName: undefined }));
                if (value) setEditProcedureOptions((current) => uniqueById([value, ...current]));
              }}
              loadingText="Searching procedures..."
              noOptionsText="No procedures found"
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Procedure"
                  error={Boolean(editErrors.procedureName)}
                  helperText={editErrors.procedureName || ' '}
                />
              )}
            />
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
        <MenuItem onClick={() => { setExportAnchor(null); exportExcel(); }}>Excel (.xls with flags)</MenuItem>
        <MenuItem onClick={() => { setExportAnchor(null); exportPdf(); }}>PDF (.pdf with flags)</MenuItem>
        <MenuItem onClick={() => { setExportAnchor(null); exportCsv(); }}>CSV (.csv)</MenuItem>
        {isAdmin && <MenuItem onClick={() => { setExportAnchor(null); exportDraftJson(); }}>Draft JSON</MenuItem>}
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
