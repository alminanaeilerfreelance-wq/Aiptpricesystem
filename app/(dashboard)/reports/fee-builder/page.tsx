'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
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
  Typography,
} from '@mui/material';
import Topbar from '@/components/layout/Topbar';
import { showSuccessToast } from '@/components/feedback/heroToast';
import { PricingRule, pricingRulesService } from '@/services/pricing-rules.service';
import { Country, countriesService } from '@/services/countries.service';

export const dynamic = 'force-dynamic';

type ServiceKey = 'Trademark' | 'Patent' | 'Design' | 'Copyright' | 'Litigation';
type StatusFilter = 'all' | 'active' | 'inactive';
type FeeField = 'officialFee' | 'attorneyFee';
type ColumnKey = 'country' | 'procedure' | 'officeFee' | 'attorneyFee' | 'total' | 'status' | 'updatedAt';
type PrintOrientation = 'portrait' | 'landscape';
type PaperFormat = 'A4' | 'A3' | 'Letter';

interface PricingRuleRow extends PricingRule {
  status?: string;
  country?: {
    flagCode?: string;
    abbreviation?: string;
    name?: string;
  } | null;
}

interface FeeDraftValues {
  officialFee: string;
  attorneyFee: string;
}

interface RowValidation {
  officialFee?: string;
  attorneyFee?: string;
}

interface CountryFeeRow {
  key: string;
  countryName: string;
  countryAbbreviation: string;
  flagRule: PricingRuleRow;
  rules: PricingRuleRow[];
  rulesByProcedure: Record<string, PricingRuleRow>;
  isActive: boolean;
  updatedAt: string;
}

interface FeeBuilderDraft {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  selectedService: ServiceKey;
  editedFees: Record<string, FeeDraftValues>;
  rowOrder: string[];
  columnVisibility: Record<ColumnKey, boolean>;
  fontFamily: string;
  rowHeight: number;
  columnWidth: number;
  flagWidth: number;
  flagHeight: number;
  headerColor: string;
  rowColor: string;
  fontColor?: string;
  highlightColor?: string;
  printOrientation?: PrintOrientation;
  paperFormat?: PaperFormat;
  selectedCountry?: string;
  columnOrder?: string[];
  columnWidths?: Record<string, number>;
  rowHeights?: Record<string, number>;
}

interface AuditEntry {
  id: string;
  at: string;
  action: string;
}

const SERVICES: ServiceKey[] = ['Trademark', 'Patent', 'Design', 'Copyright', 'Litigation'];
const FONT_OPTIONS = ['Arial', 'Times New Roman', 'Calibri', 'Verdana', 'Tahoma', 'Georgia', 'Courier New'];
const DRAFT_STORAGE_KEY = 'fee-builder-pricing-rule-drafts';
const AUTOSAVE_STORAGE_KEY = 'fee-builder-pricing-rule-autosave';
const PRICING_RULE_PAGE_SIZE = 100;
const OPTION_PAGE_SIZE = 100;
const DEFAULT_ROW_HEIGHT = 22;
const DEFAULT_COLUMN_WIDTH = 72;
const DEFAULT_FLAG_WIDTH = 26;
const DEFAULT_FLAG_HEIGHT = 16;
const DEFAULT_FONT_COLOR = '#111827';
const DEFAULT_HIGHLIGHT_COLOR = '#FFF2CC';
const PAPER_FORMATS: PaperFormat[] = ['A4', 'A3', 'Letter'];
const PRINT_ORIENTATIONS: PrintOrientation[] = ['landscape', 'portrait'];

const COLUMN_LABELS: Record<ColumnKey, string> = {
  country: 'Country',
  procedure: 'Procedure',
  officeFee: 'Office Fee',
  attorneyFee: 'Attorney Fee',
  total: 'Total',
  status: 'Status',
  updatedAt: 'Updated',
};

const DEFAULT_COLUMNS: Record<ColumnKey, boolean> = {
  country: true,
  procedure: true,
  officeFee: true,
  attorneyFee: true,
  total: true,
  status: true,
  updatedAt: true,
};

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const formatMoney = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });

const readStoredArray = <T,>(key: string): T[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const readStoredDraft = (key: string): FeeBuilderDraft | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const normalizeNumberInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const makeCountryKey = (rule: PricingRuleRow) =>
  `${rule.countryName || 'Unknown'}::${rule.countryAbbreviation || ''}`.toLowerCase();

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export default function FeeReportBuilderPage() {
  const [selectedService, setSelectedService] = useState<ServiceKey>('Trademark');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [countries, setCountries] = useState<Country[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRuleRow[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [editedFees, setEditedFees] = useState<Record<string, FeeDraftValues>>({});
  const [dirtyRows, setDirtyRows] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, RowValidation>>({});
  const [rowOrder, setRowOrder] = useState<string[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>(DEFAULT_COLUMNS);
  const [fontFamily, setFontFamily] = useState('Calibri');
  const [rowHeight, setRowHeight] = useState(DEFAULT_ROW_HEIGHT);
  const [columnWidth, setColumnWidth] = useState(DEFAULT_COLUMN_WIDTH);
  const [flagWidth, setFlagWidth] = useState(DEFAULT_FLAG_WIDTH);
  const [flagHeight, setFlagHeight] = useState(DEFAULT_FLAG_HEIGHT);
  const [headerColor, setHeaderColor] = useState('#EAF2FF');
  const [rowColor, setRowColor] = useState('#FFFFFF');
  const [fontColor, setFontColor] = useState(DEFAULT_FONT_COLOR);
  const [highlightColor, setHighlightColor] = useState(DEFAULT_HIGHLIGHT_COLOR);
  const [printOrientation, setPrintOrientation] = useState<PrintOrientation>('landscape');
  const [paperFormat, setPaperFormat] = useState<PaperFormat>('A4');
  const [drafts, setDrafts] = useState<FeeBuilderDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState('');
  const [draftName, setDraftName] = useState('');
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [advancedAnchor, setAdvancedAnchor] = useState<HTMLElement | null>(null);
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimersRef = useRef<Record<string, number>>({});
  const columnResizeRef = useRef<{ procedure: string; startX: number; startWidth: number } | null>(null);
  const rowResizeRef = useRef<{ rowKey: string; startY: number; startHeight: number } | null>(null);

  const addAudit = (action: string) => {
    setAuditLog((current) => [
      { id: makeId('audit'), at: new Date().toISOString(), action },
      ...current,
    ].slice(0, 40));
  };

  const buildDraftSnapshot = (name: string, id = activeDraftId || makeId('draft')): FeeBuilderDraft => ({
    id,
    name,
    createdAt: drafts.find((draft) => draft.id === id)?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    selectedService,
    selectedCountry,
    editedFees,
    rowOrder,
    columnOrder,
    columnWidths,
    rowHeights,
    columnVisibility,
    fontFamily,
    rowHeight,
    columnWidth,
    flagWidth,
    flagHeight,
    headerColor,
    rowColor,
    fontColor,
    highlightColor,
    printOrientation,
    paperFormat,
  });

  const applyDraft = (draft: FeeBuilderDraft) => {
    setActiveDraftId(draft.id);
    setDraftName(draft.name);
    setSelectedService(draft.selectedService);
    setSelectedCountry(draft.selectedCountry || '');
    setEditedFees(draft.editedFees || {});
    setRowOrder(draft.rowOrder || []);
    setColumnOrder(draft.columnOrder || []);
    setColumnWidths(draft.columnWidths || {});
    setRowHeights(draft.rowHeights || {});
    setColumnVisibility({ ...DEFAULT_COLUMNS, ...(draft.columnVisibility || {}) });
    setFontFamily(draft.fontFamily || 'Calibri');
    setRowHeight(draft.rowHeight || DEFAULT_ROW_HEIGHT);
    setColumnWidth(draft.columnWidth || DEFAULT_COLUMN_WIDTH);
    setFlagWidth(draft.flagWidth || DEFAULT_FLAG_WIDTH);
    setFlagHeight(draft.flagHeight || DEFAULT_FLAG_HEIGHT);
    setHeaderColor(draft.headerColor || '#EAF2FF');
    setRowColor(draft.rowColor || '#FFFFFF');
    setFontColor(draft.fontColor || DEFAULT_FONT_COLOR);
    setHighlightColor(draft.highlightColor || DEFAULT_HIGHLIGHT_COLOR);
    setPrintOrientation(draft.printOrientation || 'landscape');
    setPaperFormat(draft.paperFormat || 'A4');
    setDirtyRows({});
    setRowErrors({});
    setPage(0);
    addAudit(`Draft Loaded: ${draft.name}`);
  };

  useEffect(() => {
    const storedDrafts = readStoredArray<FeeBuilderDraft>(DRAFT_STORAGE_KEY);
    const autosave = readStoredDraft(AUTOSAVE_STORAGE_KEY);
    setDrafts(storedDrafts);
    if (autosave) {
      applyDraft(autosave);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      AUTOSAVE_STORAGE_KEY,
      JSON.stringify(buildDraftSnapshot(draftName || 'Autosaved Draft', activeDraftId || 'autosave'))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hydrated,
    selectedService,
    selectedCountry,
    editedFees,
    rowOrder,
    columnOrder,
    columnWidths,
    rowHeights,
    columnVisibility,
    fontFamily,
    rowHeight,
    columnWidth,
    flagWidth,
    flagHeight,
    headerColor,
    rowColor,
    fontColor,
    highlightColor,
    printOrientation,
    paperFormat,
    draftName,
    activeDraftId,
  ]);

  useEffect(() => {
    let active = true;

    const loadCountries = async () => {
      try {
        const firstResponse = await countriesService.list({ page: 1, limit: OPTION_PAGE_SIZE });
        const total = firstResponse.total || 0;
        const pageCount = Math.ceil(total / OPTION_PAGE_SIZE);
        const remainingResponses =
          pageCount > 1
            ? await Promise.all(
                Array.from({ length: pageCount - 1 }, (_item, index) =>
                  countriesService.list({ page: index + 2, limit: OPTION_PAGE_SIZE })
                )
              )
            : [];

        if (!active) return;

        setCountries([
          ...(firstResponse.countries || []),
          ...remainingResponses.flatMap((response) => response.countries || []),
        ]);
      } catch (err) {
        if (!active) return;
        setCountries([]);
        setError(err instanceof Error ? err.message : 'Failed to load countries');
      }
    };

    loadCountries();

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
        const baseParams = {
          category: selectedService,
          country: selectedCountry || undefined,
          search: search.trim() || undefined,
          status: statusFilter,
          limit: PRICING_RULE_PAGE_SIZE,
        };
        const firstResponse = await pricingRulesService.list({
          ...baseParams,
          page: 1,
        });

        const total = firstResponse.total || 0;
        const pageCount = Math.ceil(total / PRICING_RULE_PAGE_SIZE);
        const remainingResponses =
          pageCount > 1
            ? await Promise.all(
                Array.from({ length: pageCount - 1 }, (_item, index) =>
                  pricingRulesService.list({
                    ...baseParams,
                    page: index + 2,
                  })
                )
              )
            : [];

        if (!active) return;

        const nextRules = [
          ...(firstResponse.pricingRules || []),
          ...remainingResponses.flatMap((response) => response.pricingRules || []),
        ] as PricingRuleRow[];
        setPricingRules(nextRules);
        setEditedFees((current) => {
          const next = { ...current };
          nextRules.forEach((rule) => {
            if (!next[rule._id]) {
              next[rule._id] = {
                officialFee: String(rule.officialFee ?? 0),
                attorneyFee: String(rule.attorneyFee ?? 0),
              };
            }
          });
          return next;
        });
      } catch (err) {
        if (!active) return;
        setPricingRules([]);
        setError(err instanceof Error ? err.message : 'Failed to load pricing rules');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadPricingRules();

    return () => {
      active = false;
    };
  }, [search, selectedCountry, selectedService, statusFilter]);

  useEffect(
    () => () => {
      Object.values(autoSaveTimersRef.current).forEach((timer) => window.clearTimeout(timer));
    },
    []
  );

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (columnResizeRef.current) {
        const { procedure, startWidth, startX } = columnResizeRef.current;
        const nextWidth = Math.max(58, startWidth + event.clientX - startX);
        setColumnWidths((current) => ({ ...current, [procedure]: nextWidth }));
      }

      if (rowResizeRef.current) {
        const { rowKey, startHeight, startY } = rowResizeRef.current;
        const nextHeight = Math.max(18, startHeight + event.clientY - startY);
        setRowHeights((current) => ({ ...current, [rowKey]: nextHeight }));
      }
    };

    const handleMouseUp = () => {
      columnResizeRef.current = null;
      rowResizeRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const sortedPricingRules = useMemo(
    () =>
      [...pricingRules].sort((a, b) => {
        const countrySort = a.countryName.localeCompare(b.countryName, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
        if (countrySort !== 0) return countrySort;
        return a.procedureName.localeCompare(b.procedureName, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      }),
    [pricingRules]
  );

  const procedureColumns = useMemo(
    () => {
      const baseColumns = Array.from(new Set(sortedPricingRules.map((rule) => rule.procedureName).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
      );
      const orderMap = new Map(columnOrder.map((procedure, index) => [procedure, index]));

      return baseColumns.sort((a, b) => {
        const aIndex = orderMap.get(a);
        const bIndex = orderMap.get(b);
        if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex;
        if (aIndex !== undefined) return -1;
        if (bIndex !== undefined) return 1;
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
      });
    },
    [columnOrder, sortedPricingRules]
  );

  const countryRows = useMemo<CountryFeeRow[]>(() => {
    const groupedRows = new Map<string, CountryFeeRow>();

    sortedPricingRules.forEach((rule) => {
      const key = makeCountryKey(rule);
      const existing = groupedRows.get(key);
      if (existing) {
        existing.rules.push(rule);
        existing.rulesByProcedure[rule.procedureName] = rule;
        existing.isActive = existing.isActive || rule.isActive;
        if (!existing.updatedAt || new Date(rule.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
          existing.updatedAt = rule.updatedAt;
        }
        if (!existing.flagRule.country && rule.country) {
          existing.flagRule = rule;
        }
      } else {
        groupedRows.set(key, {
          key,
          countryName: rule.countryName,
          countryAbbreviation: rule.countryAbbreviation,
          flagRule: rule,
          rules: [rule],
          rulesByProcedure: { [rule.procedureName]: rule },
          isActive: rule.isActive,
          updatedAt: rule.updatedAt,
        });
      }
    });

    const orderMap = new Map(rowOrder.map((id, index) => [id, index]));
    return Array.from(groupedRows.values()).sort((a, b) => {
      const aIndex = orderMap.get(a.key);
      const bIndex = orderMap.get(b.key);
      if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex;
      if (aIndex !== undefined) return -1;
      if (bIndex !== undefined) return 1;
      return a.countryName.localeCompare(b.countryName, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [rowOrder, sortedPricingRules]);

  const pagedCountryRows = useMemo(
    () => countryRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [countryRows, page, rowsPerPage]
  );

  const getFeeValue = (rule: PricingRuleRow, field: FeeField) =>
    editedFees[rule._id]?.[field] ?? String(rule[field] ?? 0);

  const getRowTotal = (rule: PricingRuleRow) => {
    const officeFee = normalizeNumberInput(getFeeValue(rule, 'officialFee'));
    const attorneyFee = normalizeNumberInput(getFeeValue(rule, 'attorneyFee'));
    if (officeFee === null || attorneyFee === null || officeFee < 0 || attorneyFee < 0) return null;
    return officeFee + attorneyFee;
  };

  const validateFeeValues = (ruleId: string, officialValue: string, attorneyValue: string) => {
    const nextErrors: RowValidation = {};
    const officialFee = normalizeNumberInput(officialValue);
    const attorneyFee = normalizeNumberInput(attorneyValue);

    if (!officialValue.trim()) nextErrors.officialFee = 'Office Fee is required';
    else if (officialFee === null) nextErrors.officialFee = 'Office Fee must be a number';
    else if (officialFee < 0) nextErrors.officialFee = 'Office Fee cannot be negative';

    if (!attorneyValue.trim()) nextErrors.attorneyFee = 'Attorney Fee is required';
    else if (attorneyFee === null) nextErrors.attorneyFee = 'Attorney Fee must be a number';
    else if (attorneyFee < 0) nextErrors.attorneyFee = 'Attorney Fee cannot be negative';

    setRowErrors((current) => ({ ...current, [ruleId]: nextErrors }));

    return {
      isValid: Object.keys(nextErrors).length === 0,
      officialFee: officialFee ?? 0,
      attorneyFee: attorneyFee ?? 0,
    };
  };

  const clearAutoSaveTimer = (ruleId: string) => {
    const timer = autoSaveTimersRef.current[ruleId];
    if (timer) window.clearTimeout(timer);
    delete autoSaveTimersRef.current[ruleId];
  };

  const saveRuleFees = async (
    rule: PricingRuleRow,
    officialValue: string,
    attorneyValue: string,
    options: { quiet?: boolean } = {}
  ) => {
    clearAutoSaveTimer(rule._id);
    const validation = validateFeeValues(rule._id, officialValue, attorneyValue);
    if (!validation.isValid) return;

    try {
      const updated = await pricingRulesService.update(rule._id, {
        officialFee: validation.officialFee,
        attorneyFee: validation.attorneyFee,
      });
      setPricingRules((current) =>
        current.map((item) => (item._id === rule._id ? ({ ...item, ...updated } as PricingRuleRow) : item))
      );
      setEditedFees((current) => ({
        ...current,
        [rule._id]: {
          officialFee: String(validation.officialFee),
          attorneyFee: String(validation.attorneyFee),
        },
      }));
      setDirtyRows((current) => ({ ...current, [rule._id]: false }));
      setRowErrors((current) => ({ ...current, [rule._id]: {} }));
      addAudit(`Row Saved: ${rule.countryName} / ${rule.procedureName}`);
      if (!options.quiet) showSuccessToast('Row saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save row');
    }
  };

  const updateFee = (rule: PricingRuleRow, field: FeeField, value: string) => {
    const nextFees = {
      officialFee: field === 'officialFee' ? value : getFeeValue(rule, 'officialFee'),
      attorneyFee: field === 'attorneyFee' ? value : getFeeValue(rule, 'attorneyFee'),
    };
    setEditedFees((current) => ({
      ...current,
      [rule._id]: nextFees,
    }));
    setDirtyRows((current) => ({ ...current, [rule._id]: true }));
    setRowErrors((current) => ({ ...current, [rule._id]: { ...current[rule._id], [field]: undefined } }));
    clearAutoSaveTimer(rule._id);
    autoSaveTimersRef.current[rule._id] = window.setTimeout(() => {
      saveRuleFees(rule, nextFees.officialFee, nextFees.attorneyFee, { quiet: true });
    }, 900);
  };

  const saveRow = (rule: PricingRuleRow) =>
    saveRuleFees(rule, getFeeValue(rule, 'officialFee'), getFeeValue(rule, 'attorneyFee'));

  const saveDraft = () => {
    const name = draftName.trim() || `Draft ${new Date().toLocaleString()}`;
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
    const nextEditedFees = Object.fromEntries(
      pricingRules.map((rule) => [
        rule._id,
        {
          officialFee: String(rule.officialFee ?? 0),
          attorneyFee: String(rule.attorneyFee ?? 0),
        },
      ])
    );
    setActiveDraftId('');
    setDraftName(`Draft ${new Date().toLocaleString()}`);
    setSelectedCountry('');
    setEditedFees(nextEditedFees);
    setDirtyRows({});
    setRowErrors({});
    setRowOrder(Array.from(new Set(pricingRules.map((rule) => makeCountryKey(rule)))));
    setColumnOrder([]);
    setColumnWidths({});
    setRowHeights({});
    setColumnVisibility(DEFAULT_COLUMNS);
    setFontFamily('Calibri');
    setRowHeight(DEFAULT_ROW_HEIGHT);
    setColumnWidth(DEFAULT_COLUMN_WIDTH);
    setFlagWidth(DEFAULT_FLAG_WIDTH);
    setFlagHeight(DEFAULT_FLAG_HEIGHT);
    setHeaderColor('#EAF2FF');
    setRowColor('#FFFFFF');
    setFontColor(DEFAULT_FONT_COLOR);
    setHighlightColor(DEFAULT_HIGHLIGHT_COLOR);
    setPrintOrientation('landscape');
    setPaperFormat('A4');
    addAudit('New Draft Created');
  };

  const deleteDraft = (draftId: string) => {
    const nextDrafts = drafts.filter((draft) => draft.id !== draftId);
    setDrafts(nextDrafts);
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(nextDrafts));
    if (activeDraftId === draftId) setActiveDraftId('');
    addAudit('Draft Deleted');
  };

  const handleRowDrop = (targetRowId: string) => {
    if (!draggedRowId || draggedRowId === targetRowId) return;
    const ids = countryRows.map((row) => row.key);
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

  const handleColumnDrop = (targetProcedure: string) => {
    if (!draggedColumn || draggedColumn === targetProcedure) return;
    const fromIndex = procedureColumns.indexOf(draggedColumn);
    const toIndex = procedureColumns.indexOf(targetProcedure);
    if (fromIndex < 0 || toIndex < 0) return;
    const nextColumns = [...procedureColumns];
    const [moved] = nextColumns.splice(fromIndex, 1);
    nextColumns.splice(toIndex, 0, moved);
    setColumnOrder(nextColumns);
    setDraggedColumn(null);
    addAudit('Column Order Saved');
    showSuccessToast('Column order saved');
  };

  const getProcedureColumnWidth = (procedure: string) => Math.max(58, columnWidths[procedure] || columnWidth);

  const getCountryRowHeight = (rowKey: string) => Math.max(18, rowHeights[rowKey] || rowHeight);

  const startColumnResize = (event: React.MouseEvent<HTMLElement>, procedure: string) => {
    event.preventDefault();
    event.stopPropagation();
    columnResizeRef.current = {
      procedure,
      startX: event.clientX,
      startWidth: getProcedureColumnWidth(procedure),
    };
  };

  const startRowResize = (event: React.MouseEvent<HTMLElement>, rowKey: string) => {
    event.preventDefault();
    event.stopPropagation();
    rowResizeRef.current = {
      rowKey,
      startY: event.clientY,
      startHeight: getCountryRowHeight(rowKey),
    };
  };

  const exportRows = () =>
    countryRows.flatMap((countryRow) =>
      procedureColumns
        .map((procedure) => countryRow.rulesByProcedure[procedure])
        .filter((rule): rule is PricingRuleRow => Boolean(rule))
        .map((rule) => ({
          ID: rule._id,
          Service: rule.serviceCategory,
          Country: rule.countryName,
          Code: rule.countryAbbreviation,
          Procedure: rule.procedureName,
          'Office Fee': getFeeValue(rule, 'officialFee'),
          'Attorney Fee': getFeeValue(rule, 'attorneyFee'),
          Total: getRowTotal(rule) === null ? '' : getRowTotal(rule),
          Status: rule.isActive ? 'Active' : 'Inactive',
          Updated: rule.updatedAt,
        }))
    );

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

  const exportExcel = () => {
    const html = buildStyledTableHtml();
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pricing-rules-${selectedService.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
    URL.revokeObjectURL(url);
    addAudit('Styled Excel Export Generated');
    showSuccessToast('Styled Excel exported');
  };

  const openPrintView = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Print window was blocked. Allow popups and try again.');
      return;
    }

    printWindow.document.write(buildStyledTableHtml(true));
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
    addAudit('Print View Opened');
  };

  const exportDraftJson = () => {
    const snapshot = buildDraftSnapshot(draftName.trim() || 'Exported Draft');
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${snapshot.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'draft'}.json`;
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
        const draft = JSON.parse(text) as FeeBuilderDraft;
        if (!draft.editedFees || !draft.columnVisibility) throw new Error('Invalid draft file');
        applyDraft({ ...draft, id: draft.id || makeId('draft-import') });
        showSuccessToast('Draft imported');
      } else {
        const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
        const headers = headerLine.split(',').map((item) => item.replace(/^"|"$/g, '').trim());
        const idIndex = headers.findIndex((header) => /^(id|rule id)$/i.test(header));
        const officialIndex = headers.findIndex((header) => /office fee|official fee/i.test(header));
        const attorneyIndex = headers.findIndex((header) => /attorney fee/i.test(header));
        if (idIndex < 0 || officialIndex < 0 || attorneyIndex < 0) {
          throw new Error('CSV must include ID, Office Fee, and Attorney Fee columns');
        }
        const nextFees: Record<string, FeeDraftValues> = {};
        lines.forEach((line) => {
          const cells = line.match(/("([^"]|"")*"|[^,]+)/g)?.map((cell) => cell.replace(/^"|"$/g, '').replace(/""/g, '"')) || [];
          const id = cells[idIndex];
          if (id) {
            nextFees[id] = {
              officialFee: cells[officialIndex] || '',
              attorneyFee: cells[attorneyIndex] || '',
            };
          }
        });
        setEditedFees((current) => ({ ...current, ...nextFees }));
        setDirtyRows((current) => ({
          ...current,
          ...Object.fromEntries(Object.keys(nextFees).map((id) => [id, true])),
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
    const flagCode = (rule.country?.flagCode || rule.countryAbbreviation || '').toLowerCase();
    return flagCode ? `https://flagcdn.com/w80/${flagCode}.png` : '';
  };

  const visibleFeeColumnCount = [columnVisibility.officeFee, columnVisibility.attorneyFee, columnVisibility.total].filter(Boolean).length;
  const showProcedureColumns = columnVisibility.procedure && visibleFeeColumnCount > 0;
  const visibleColumnCount = Math.max(
    1,
    (columnVisibility.country ? 3 : 0) +
      (showProcedureColumns ? procedureColumns.length * visibleFeeColumnCount : 0)
  );
  const countryNameWidth = Math.max(178, Math.min(240, columnWidth * 2.5));
  const rowNumberWidth = 34;
  const flagColumnWidth = Math.max(32, flagWidth + 8);
  const tableMinWidth =
    (columnVisibility.country ? rowNumberWidth + flagColumnWidth + countryNameWidth : 0) +
    (showProcedureColumns
      ? procedureColumns.reduce((total, procedure) => total + visibleFeeColumnCount * getProcedureColumnWidth(procedure), 0)
      : 0);
  const usesDefaultHeaderColor = headerColor === '#EAF2FF';
  const usesDefaultRowColor = rowColor === '#FFFFFF';
  const excelHeaderColor = usesDefaultHeaderColor
    ? selectedService === 'Patent' || selectedService === 'Design'
      ? '#DCE7C0'
      : '#F2BD88'
    : headerColor;
  const excelSubHeaderColor = usesDefaultHeaderColor
    ? selectedService === 'Patent' || selectedService === 'Design'
      ? '#E7EED3'
      : '#F7CA9B'
    : headerColor;
  const excelRowColor = usesDefaultRowColor ? '#74BFD0' : rowColor;
  const excelAltRowColor = usesDefaultRowColor ? '#69B6C8' : rowColor;
  const excelHoverColor = usesDefaultRowColor ? '#8BD5DF' : rowColor;
  const lastVisibleFeeColumn: FeeField | 'total' = columnVisibility.total
    ? 'total'
    : columnVisibility.attorneyFee
      ? 'attorneyFee'
      : 'officialFee';

  function buildStyledTableHtml(forPrint = false) {
    const title = `${selectedService} Pricing Rules`;
    const cssFontFamily = `"${fontFamily.replace(/"/g, '')}", Arial, sans-serif`;
    const procedureHeaderHtml = showProcedureColumns
      ? procedureColumns
          .map(
            (procedure) => `
              <th class="main-header procedure-header" colspan="${visibleFeeColumnCount}" style="width:${visibleFeeColumnCount * getProcedureColumnWidth(procedure)}px">
                ${escapeHtml(procedure)}
              </th>`
          )
          .join('')
      : '';

    const feeHeaderHtml = showProcedureColumns
      ? procedureColumns
          .map(
            (procedure) => {
              const procedureWidth = getProcedureColumnWidth(procedure);
              return `
              ${
                columnVisibility.officeFee
                  ? `<th class="sub-header ${lastVisibleFeeColumn === 'officialFee' ? 'group-end' : ''}" style="width:${procedureWidth}px">Official<br>Fees (US$)</th>`
                  : ''
              }
              ${
                columnVisibility.attorneyFee
                  ? `<th class="sub-header ${lastVisibleFeeColumn === 'attorneyFee' ? 'group-end' : ''}" style="width:${procedureWidth}px">Attorney<br>Fees (US$)</th>`
                  : ''
              }
              ${columnVisibility.total ? `<th class="sub-header total-header group-end" style="width:${procedureWidth}px">TOTAL<br>(US$)</th>` : ''}
            `;
            }
          )
          .join('')
      : '';

    const bodyHtml = countryRows
      .map((countryRow, rowIndex) => {
        const flagSrc = getFlagSrc(countryRow.flagRule);
        const rowBackground = rowIndex % 2 === 0 ? excelRowColor : excelAltRowColor;
        const currentRowHeight = getCountryRowHeight(countryRow.key);
        const feeCells = showProcedureColumns
          ? procedureColumns
              .map((procedure) => {
                const rule = countryRow.rulesByProcedure[procedure];
                const total = rule ? getRowTotal(rule) : null;
                const official = rule ? escapeHtml(getFeeValue(rule, 'officialFee')) : 'N/A';
                const attorney = rule ? escapeHtml(getFeeValue(rule, 'attorneyFee')) : 'N/A';
                const totalText = rule ? (total === null ? '-' : formatMoney(total)) : 'N/A';
                const procedureWidth = getProcedureColumnWidth(procedure);

                return `
                  ${
                    columnVisibility.officeFee
                      ? `<td class="fee-cell ${lastVisibleFeeColumn === 'officialFee' ? 'group-end' : ''}" style="width:${procedureWidth}px">${official}</td>`
                      : ''
                  }
                  ${
                    columnVisibility.attorneyFee
                      ? `<td class="fee-cell ${lastVisibleFeeColumn === 'attorneyFee' ? 'group-end' : ''}" style="width:${procedureWidth}px">${attorney}</td>`
                      : ''
                  }
                  ${columnVisibility.total ? `<td class="fee-cell total-cell group-end" style="width:${procedureWidth}px">${escapeHtml(totalText)}</td>` : ''}
                `;
              })
              .join('')
          : '';

        return `
          <tr style="background:${rowBackground}; height:${currentRowHeight}px">
            ${
              columnVisibility.country
                ? `
                  <td class="row-number" style="width:${rowNumberWidth}px">${rowIndex + 1}</td>
                  <td class="flag-cell" style="width:${flagColumnWidth}px">
                    ${
                      flagSrc
                        ? `<img src="${escapeHtml(flagSrc)}" width="${flagWidth}" height="${flagHeight}" alt="${escapeHtml(countryRow.countryName)}">`
                        : '-'
                    }
                  </td>
                  <td class="country-cell group-end" style="width:${countryNameWidth}px">${escapeHtml(countryRow.countryName)}</td>
                `
                : ''
            }
            ${feeCells}
          </tr>
        `;
      })
      .join('');

    return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: ${paperFormat} ${printOrientation}; margin: 8mm; }
      body {
        margin: ${forPrint ? '0' : '12px'};
        color: ${fontColor};
        font-family: ${cssFontFamily};
        background: #ffffff;
      }
      table {
        border-collapse: collapse;
        table-layout: fixed;
        border: 2px solid #111827;
        color: ${fontColor};
        font-family: ${cssFontFamily};
      }
      th,
      td {
        border: 1px solid #1F2937;
        color: ${fontColor};
        font-family: ${cssFontFamily};
        height: ${rowHeight}px;
        line-height: 1.05;
        padding: 0 3px;
        text-align: center;
        vertical-align: middle;
        white-space: nowrap;
        font-size: 12px;
      }
      th {
        font-weight: 900;
      }
      .main-header {
        background: ${excelHeaderColor};
        height: 31px;
        font-size: 13px;
      }
      .country-header {
        height: 74px;
      }
      .sub-header {
        background: ${excelSubHeaderColor};
        height: 43px;
        font-size: 12px;
      }
      .row-number,
      .country-cell,
      .total-cell {
        font-weight: 900;
      }
      .flag-cell {
        padding: 0;
      }
      .flag-cell img {
        display: inline-block;
        object-fit: cover;
        border: 1px solid #1F2937;
        vertical-align: middle;
      }
      .group-end {
        border-right: 2px solid #111827;
      }
      .total-cell {
        background: ${highlightColor};
      }
      .total-header {
        background: ${excelSubHeaderColor};
      }
      @media print {
        body { margin: 0; }
        table { width: auto; }
      }
    </style>
  </head>
  <body>
    <table>
      <thead>
        <tr>
          ${
            columnVisibility.country
              ? `<th class="main-header country-header group-end" colspan="3" rowspan="${showProcedureColumns ? 2 : 1}" style="width:${rowNumberWidth + flagColumnWidth + countryNameWidth}px">Country</th>`
              : ''
          }
          ${procedureHeaderHtml}
        </tr>
        ${showProcedureColumns ? `<tr>${feeHeaderHtml}</tr>` : ''}
      </thead>
      <tbody>
        ${bodyHtml || `<tr><td colspan="${visibleColumnCount}">No pricing rules found.</td></tr>`}
      </tbody>
    </table>
  </body>
</html>`;
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F5F7FA' }}>
      <Topbar title="IP Services Fee Builder" />

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
              <FormControl size="small" sx={{ minWidth: 170 }}>
                <InputLabel>Country</InputLabel>
                <Select
                  label="Country"
                  value={selectedCountry}
                  onChange={(event) => {
                    setSelectedCountry(event.target.value);
                    setPage(0);
                    setRowOrder([]);
                    setColumnOrder([]);
                  }}
                >
                  <MenuItem value="">All Countries</MenuItem>
                  {selectedCountry && !countries.some((country) => country.name === selectedCountry) && (
                    <MenuItem value={selectedCountry}>{selectedCountry}</MenuItem>
                  )}
                  {countries.map((country) => (
                    <MenuItem key={country._id} value={country.name}>
                      {country.name} ({country.abbreviation})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Service</InputLabel>
                <Select
                  label="Service"
                  value={selectedService}
                  onChange={(event) => {
                    setSelectedService(event.target.value as ServiceKey);
                    setPage(0);
                    setRowOrder([]);
                    setColumnOrder([]);
                  }}
                >
                  {SERVICES.map((service) => (
                    <MenuItem key={service} value={service}>{service}</MenuItem>
                  ))}
                </Select>
              </FormControl>
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
                onChange={(event) => setRowHeight(Math.max(18, Number(event.target.value) || DEFAULT_ROW_HEIGHT))}
                sx={{ width: 120 }}
              />
              <TextField
                size="small"
                type="number"
                label="Column Width"
                value={columnWidth}
                onChange={(event) => setColumnWidth(Math.max(58, Number(event.target.value) || DEFAULT_COLUMN_WIDTH))}
                sx={{ width: 128 }}
              />
              <TextField
                size="small"
                type="number"
                label="Flag Width"
                value={flagWidth}
                onChange={(event) => setFlagWidth(Math.max(16, Number(event.target.value) || DEFAULT_FLAG_WIDTH))}
                sx={{ width: 112 }}
              />
              <TextField
                size="small"
                type="number"
                label="Flag Height"
                value={flagHeight}
                onChange={(event) => setFlagHeight(Math.max(10, Number(event.target.value) || DEFAULT_FLAG_HEIGHT))}
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
              setColumnOrder([]);
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

          <TableContainer sx={{ maxHeight: 'calc(100vh - 280px)', bgcolor: '#FFFFFF', overflow: 'auto' }}>
            <Table
              stickyHeader
              size="small"
              sx={{
                minWidth: Math.max(320, tableMinWidth),
                borderCollapse: 'collapse',
                tableLayout: 'fixed',
                fontFamily,
                border: '2px solid #111827',
                '& th': {
                  color: fontColor,
                  fontFamily,
                  fontWeight: 900,
                  border: '1px solid #111827',
                  lineHeight: 1.05,
                  px: 0.4,
                  py: 0.45,
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                },
                '& td': {
                  fontFamily,
                  color: fontColor,
                  border: '1px solid #1F2937',
                  py: 0,
                  height: rowHeight,
                  lineHeight: 1.1,
                },
                '& thead tr:first-of-type th': {
                  top: 0,
                  zIndex: 3,
                },
                '& thead tr:nth-of-type(2) th': {
                  top: 31,
                  zIndex: 2,
                },
                '& tbody tr': { borderBottom: 0 },
              }}
            >
              <TableHead>
                <TableRow>
                  {columnVisibility.country && (
                    <TableCell
                      rowSpan={showProcedureColumns ? 2 : 1}
                      colSpan={3}
                      sx={{
                        width: rowNumberWidth + flagColumnWidth + countryNameWidth,
                        height: 74,
                        bgcolor: excelHeaderColor,
                        borderRight: '2px solid #111827',
                        fontSize: 13,
                        verticalAlign: 'middle',
                      }}
                    >
                      Country
                    </TableCell>
                  )}
                  {showProcedureColumns &&
                    procedureColumns.map((procedure) => (
                      <TableCell
                        key={procedure}
                        draggable
                        onDragStart={() => setDraggedColumn(procedure)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => handleColumnDrop(procedure)}
                        colSpan={visibleFeeColumnCount}
                        sx={{
                          width: visibleFeeColumnCount * getProcedureColumnWidth(procedure),
                          bgcolor: excelHeaderColor,
                          fontSize: 13,
                          height: 31,
                          borderRight: '2px solid #111827',
                          cursor: 'grab',
                          opacity: draggedColumn === procedure ? 0.65 : 1,
                          position: 'relative',
                        }}
                      >
                        {procedure}
                        <Box
                          onMouseDown={(event) => startColumnResize(event, procedure)}
                          sx={{
                            position: 'absolute',
                            top: 0,
                            right: -3,
                            width: 7,
                            height: '100%',
                            cursor: 'col-resize',
                            zIndex: 4,
                          }}
                        />
                      </TableCell>
                    ))}
                </TableRow>
                {showProcedureColumns && (
                  <TableRow>
                    {procedureColumns.map((procedure) => (
                      <React.Fragment key={`${procedure}-fees`}>
                        {columnVisibility.officeFee && (
                          <TableCell
                            sx={{
                              width: getProcedureColumnWidth(procedure),
                              height: 43,
                              bgcolor: excelSubHeaderColor,
                              fontSize: 12,
                              borderRight: lastVisibleFeeColumn === 'officialFee' ? '2px solid #111827' : '1px solid #111827',
                            }}
                          >
                            Official<br />Fees (US$)
                          </TableCell>
                        )}
                        {columnVisibility.attorneyFee && (
                          <TableCell
                            sx={{
                              width: getProcedureColumnWidth(procedure),
                              height: 43,
                              bgcolor: excelSubHeaderColor,
                              fontSize: 12,
                              borderRight: lastVisibleFeeColumn === 'attorneyFee' ? '2px solid #111827' : '1px solid #111827',
                            }}
                          >
                            Attorney<br />Fees (US$)
                          </TableCell>
                        )}
                        {columnVisibility.total && (
                          <TableCell
                            sx={{
                              width: getProcedureColumnWidth(procedure),
                              height: 43,
                              bgcolor: excelSubHeaderColor,
                              fontSize: 12,
                              borderRight: '2px solid #111827',
                            }}
                          >
                            TOTAL<br />(US$)
                          </TableCell>
                        )}
                      </React.Fragment>
                    ))}
                  </TableRow>
                )}
              </TableHead>
              <TableBody>
                {pagedCountryRows.map((countryRow, rowIndex) => {
                  const flagSrc = getFlagSrc(countryRow.flagRule);
                  const currentRowHeight = getCountryRowHeight(countryRow.key);

                  return (
                    <TableRow
                      key={countryRow.key}
                      draggable
                      onDragStart={() => setDraggedRowId(countryRow.key)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleRowDrop(countryRow.key)}
                      sx={{
                        cursor: 'grab',
                        '& td': {
                          bgcolor: rowIndex % 2 === 0 ? excelRowColor : excelAltRowColor,
                          height: currentRowHeight,
                        },
                        '&:hover td': {
                          bgcolor: excelHoverColor,
                        },
                      }}
                    >
                      {columnVisibility.country && (
                        <>
                          <TableCell
                            sx={{
                              width: rowNumberWidth,
                              px: 0.25,
                              textAlign: 'center',
                              fontWeight: 900,
                              fontSize: 12,
                              position: 'relative',
                            }}
                          >
                            {page * rowsPerPage + rowIndex + 1}
                            <Box
                              onMouseDown={(event) => startRowResize(event, countryRow.key)}
                              sx={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                bottom: -3,
                                height: 7,
                                cursor: 'row-resize',
                                zIndex: 3,
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ width: flagColumnWidth, px: 0.25, textAlign: 'center' }}>
                            {flagSrc ? (
                              <Box
                                component="img"
                                src={flagSrc}
                                alt={countryRow.countryName}
                                onError={(event) => {
                                  event.currentTarget.style.display = 'none';
                                }}
                                sx={{
                                  width: flagWidth,
                                  height: flagHeight,
                                  objectFit: 'cover',
                                  display: 'inline-block',
                                  border: '1px solid #1F2937',
                                  verticalAlign: 'middle',
                                }}
                              />
                            ) : (
                              <Typography sx={{ fontSize: 11, fontWeight: 900, color: 'inherit' }}>-</Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ width: countryNameWidth, px: 0.45, borderRight: '2px solid #111827' }}>
                            <Typography sx={{ fontSize: 13, fontWeight: 900, lineHeight: 1.05, color: 'inherit' }}>
                              {countryRow.countryName}
                            </Typography>
                          </TableCell>
                        </>
                      )}
                      {showProcedureColumns &&
                        procedureColumns.map((procedure) => {
                          const rule = countryRow.rulesByProcedure[procedure];
                          const total = rule ? getRowTotal(rule) : null;
                          const errors = rule ? rowErrors[rule._id] || {} : {};
                          const procedureWidth = getProcedureColumnWidth(procedure);

                          return (
                            <React.Fragment key={`${countryRow.key}-${procedure}`}>
                              {columnVisibility.officeFee && (
                                <TableCell
                                  sx={{
                                    width: procedureWidth,
                                    px: 0.25,
                                    textAlign: 'center',
                                    borderRight: lastVisibleFeeColumn === 'officialFee' ? '2px solid #111827' : '1px solid #1F2937',
                                  }}
                                >
                                  {rule ? (
                                    <Box
                                      component="input"
                                      value={getFeeValue(rule, 'officialFee')}
                                      onChange={(event) => updateFee(rule, 'officialFee', event.target.value)}
                                      onBlur={(event) => {
                                        saveRuleFees(rule, event.target.value, getFeeValue(rule, 'attorneyFee'));
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key === 'Enter') event.currentTarget.blur();
                                      }}
                                      title={errors.officialFee || 'Official Fees'}
                                      inputMode="decimal"
                                      style={{
                                        width: '100%',
                                        height: Math.max(18, currentRowHeight - 2),
                                        border: errors.officialFee ? '1px solid #DC2626' : '0',
                                        outline: 'none',
                                        background: 'transparent',
                                        color: fontColor,
                                        fontFamily,
                                        fontSize: 12,
                                        fontWeight: 800,
                                        padding: 0,
                                        textAlign: 'center',
                                      }}
                                    />
                                  ) : (
                                    <Typography sx={{ fontSize: 12, fontWeight: 800, color: 'inherit' }}>N/A</Typography>
                                  )}
                                </TableCell>
                              )}
                              {columnVisibility.attorneyFee && (
                                <TableCell
                                  sx={{
                                    width: procedureWidth,
                                    px: 0.25,
                                    textAlign: 'center',
                                    borderRight: lastVisibleFeeColumn === 'attorneyFee' ? '2px solid #111827' : '1px solid #1F2937',
                                  }}
                                >
                                  {rule ? (
                                    <Box
                                      component="input"
                                      value={getFeeValue(rule, 'attorneyFee')}
                                      onChange={(event) => updateFee(rule, 'attorneyFee', event.target.value)}
                                      onBlur={(event) => {
                                        saveRuleFees(rule, getFeeValue(rule, 'officialFee'), event.target.value);
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key === 'Enter') event.currentTarget.blur();
                                      }}
                                      title={errors.attorneyFee || 'Attorney Fees'}
                                      inputMode="decimal"
                                      style={{
                                        width: '100%',
                                        height: Math.max(18, currentRowHeight - 2),
                                        border: errors.attorneyFee ? '1px solid #DC2626' : '0',
                                        outline: 'none',
                                        background: 'transparent',
                                        color: fontColor,
                                        fontFamily,
                                        fontSize: 12,
                                        fontWeight: 800,
                                        padding: 0,
                                        textAlign: 'center',
                                      }}
                                    />
                                  ) : (
                                    <Typography sx={{ fontSize: 12, fontWeight: 800, color: 'inherit' }}>N/A</Typography>
                                  )}
                                </TableCell>
                              )}
                              {columnVisibility.total && (
                                <TableCell sx={{ width: procedureWidth, px: 0.25, textAlign: 'center', bgcolor: `${highlightColor} !important`, borderRight: '2px solid #111827' }}>
                                  <Typography sx={{ fontSize: 12, fontWeight: 900, color: 'inherit' }}>
                                    {rule ? (total === null ? '-' : formatMoney(total)) : 'N/A'}
                                  </Typography>
                                </TableCell>
                              )}
                            </React.Fragment>
                          );
                        })}
                    </TableRow>
                  );
                })}

                {!loading && countryRows.length === 0 && (
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
            count={countryRows.length}
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

      <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}>
        <MenuItem onClick={() => { setExportAnchor(null); exportExcel(); }}>Styled Excel (.xls)</MenuItem>
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
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <TextField
              fullWidth
              size="small"
              type="color"
              label="Font Color"
              value={fontColor}
              onChange={(event) => setFontColor(event.target.value)}
            />
            <TextField
              fullWidth
              size="small"
              type="color"
              label="Highlight"
              value={highlightColor}
              onChange={(event) => setHighlightColor(event.target.value)}
            />
          </Stack>

          <Divider sx={{ my: 1.5 }} />

          <Typography sx={{ fontWeight: 900, mb: 1 }}>Print Tools</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1, mb: 1 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Format</InputLabel>
              <Select
                label="Format"
                value={paperFormat}
                onChange={(event) => setPaperFormat(event.target.value as PaperFormat)}
              >
                {PAPER_FORMATS.map((format) => (
                  <MenuItem key={format} value={format}>{format}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Orientation</InputLabel>
              <Select
                label="Orientation"
                value={printOrientation}
                onChange={(event) => setPrintOrientation(event.target.value as PrintOrientation)}
              >
                {PRINT_ORIENTATIONS.map((orientation) => (
                  <MenuItem key={orientation} value={orientation}>
                    {orientation.charAt(0).toUpperCase() + orientation.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Button fullWidth variant="outlined" onClick={openPrintView}>
            View / Print
          </Button>

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
