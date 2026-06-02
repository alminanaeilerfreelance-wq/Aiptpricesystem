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

export const dynamic = 'force-dynamic';

type ServiceKey = 'Trademark' | 'Patent' | 'Design' | 'Copyright' | 'Litigation';
type StatusFilter = 'all' | 'active' | 'inactive';
type FeeField = 'officialFee' | 'attorneyFee';
type ColumnKey = 'country' | 'procedure' | 'officeFee' | 'attorneyFee' | 'total' | 'status' | 'updatedAt';

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

export default function FeeReportBuilderPage() {
  const [selectedService, setSelectedService] = useState<ServiceKey>('Trademark');
  const [pricingRules, setPricingRules] = useState<PricingRuleRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [editedFees, setEditedFees] = useState<Record<string, FeeDraftValues>>({});
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
    editedFees,
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

  const applyDraft = (draft: FeeBuilderDraft) => {
    setActiveDraftId(draft.id);
    setDraftName(draft.name);
    setSelectedService(draft.selectedService);
    setEditedFees(draft.editedFees || {});
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
    editedFees,
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

        const nextRules = response.pricingRules as PricingRuleRow[];
        setPricingRules(nextRules);
        setTotalRows(response.total || 0);
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

  const getFeeValue = (rule: PricingRuleRow, field: FeeField) =>
    editedFees[rule._id]?.[field] ?? String(rule[field] ?? 0);

  const getRowTotal = (rule: PricingRuleRow) => {
    const officeFee = normalizeNumberInput(getFeeValue(rule, 'officialFee'));
    const attorneyFee = normalizeNumberInput(getFeeValue(rule, 'attorneyFee'));
    if (officeFee === null || attorneyFee === null || officeFee < 0 || attorneyFee < 0) return null;
    return officeFee + attorneyFee;
  };

  const validateRow = (rule: PricingRuleRow) => {
    const nextErrors: RowValidation = {};
    const officialValue = getFeeValue(rule, 'officialFee');
    const attorneyValue = getFeeValue(rule, 'attorneyFee');
    const officialFee = normalizeNumberInput(officialValue);
    const attorneyFee = normalizeNumberInput(attorneyValue);

    if (!officialValue.trim()) nextErrors.officialFee = 'Office Fee is required';
    else if (officialFee === null) nextErrors.officialFee = 'Office Fee must be a number';
    else if (officialFee < 0) nextErrors.officialFee = 'Office Fee cannot be negative';

    if (!attorneyValue.trim()) nextErrors.attorneyFee = 'Attorney Fee is required';
    else if (attorneyFee === null) nextErrors.attorneyFee = 'Attorney Fee must be a number';
    else if (attorneyFee < 0) nextErrors.attorneyFee = 'Attorney Fee cannot be negative';

    setRowErrors((current) => ({ ...current, [rule._id]: nextErrors }));

    return {
      isValid: Object.keys(nextErrors).length === 0,
      officialFee: officialFee ?? 0,
      attorneyFee: attorneyFee ?? 0,
    };
  };

  const updateFee = (rule: PricingRuleRow, field: FeeField, value: string) => {
    setEditedFees((current) => ({
      ...current,
      [rule._id]: {
        officialFee: field === 'officialFee' ? value : getFeeValue(rule, 'officialFee'),
        attorneyFee: field === 'attorneyFee' ? value : getFeeValue(rule, 'attorneyFee'),
      },
    }));
    setDirtyRows((current) => ({ ...current, [rule._id]: true }));
    setRowErrors((current) => ({ ...current, [rule._id]: { ...current[rule._id], [field]: undefined } }));
  };

  const saveRow = async (rule: PricingRuleRow) => {
    const validation = validateRow(rule);
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
      showSuccessToast('Row saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save row');
    }
  };

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
    setEditedFees(nextEditedFees);
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

  const exportRows = () =>
    orderedRules.map((rule) => ({
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
    }));

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

  const visibleColumnCount = Object.values(columnVisibility).filter(Boolean).length + 1;

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
                minWidth: 980,
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
                  {columnVisibility.country && <TableCell sx={{ minWidth: 230 }}>Country</TableCell>}
                  {columnVisibility.procedure && <TableCell sx={{ minWidth: columnWidth }}>Procedure</TableCell>}
                  {columnVisibility.officeFee && <TableCell sx={{ minWidth: columnWidth }}>Office Fee</TableCell>}
                  {columnVisibility.attorneyFee && <TableCell sx={{ minWidth: columnWidth }}>Attorney Fee</TableCell>}
                  {columnVisibility.total && <TableCell sx={{ minWidth: columnWidth }}>Total</TableCell>}
                  {columnVisibility.status && <TableCell sx={{ minWidth: 110 }}>Status</TableCell>}
                  {columnVisibility.updatedAt && <TableCell sx={{ minWidth: 150 }}>Updated</TableCell>}
                  <TableCell sx={{ minWidth: 112 }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orderedRules.map((rule) => {
                  const total = getRowTotal(rule);
                  const errors = rowErrors[rule._id] || {};
                  const flagSrc = getFlagSrc(rule);
                  const validationMessage = errors.officialFee || errors.attorneyFee || '';

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
                                alt={rule.countryName}
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
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontSize: 13, fontWeight: 800, lineHeight: 1.2 }}>
                                {rule.countryName}
                              </Typography>
                              <Typography sx={{ fontSize: 11, color: '#64748B', lineHeight: 1.2 }}>
                                {rule.countryAbbreviation}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                      )}
                      {columnVisibility.procedure && (
                        <TableCell>
                          <Typography sx={{ fontSize: 13, lineHeight: 1.2 }}>{rule.procedureName}</Typography>
                        </TableCell>
                      )}
                      {columnVisibility.officeFee && (
                        <TableCell>
                          <Box
                            component="input"
                            value={getFeeValue(rule, 'officialFee')}
                            onChange={(event) => updateFee(rule, 'officialFee', event.target.value)}
                            title={errors.officialFee || 'Office Fee'}
                            inputMode="decimal"
                            style={{
                              width: '100%',
                              height: Math.max(28, rowHeight - 8),
                              border: errors.officialFee ? '1px solid #DC2626' : '0',
                              outline: 'none',
                              background: 'transparent',
                              fontFamily,
                              fontSize: 13,
                              padding: '0 6px',
                              textAlign: 'right',
                            }}
                          />
                        </TableCell>
                      )}
                      {columnVisibility.attorneyFee && (
                        <TableCell>
                          <Box
                            component="input"
                            value={getFeeValue(rule, 'attorneyFee')}
                            onChange={(event) => updateFee(rule, 'attorneyFee', event.target.value)}
                            title={errors.attorneyFee || 'Attorney Fee'}
                            inputMode="decimal"
                            style={{
                              width: '100%',
                              height: Math.max(28, rowHeight - 8),
                              border: errors.attorneyFee ? '1px solid #DC2626' : '0',
                              outline: 'none',
                              background: 'transparent',
                              fontFamily,
                              fontSize: 13,
                              padding: '0 6px',
                              textAlign: 'right',
                            }}
                          />
                        </TableCell>
                      )}
                      {columnVisibility.total && (
                        <TableCell sx={{ textAlign: 'right', fontWeight: 900, px: 1 }}>
                          {total === null ? '-' : formatMoney(total)}
                        </TableCell>
                      )}
                      {columnVisibility.status && (
                        <TableCell>
                          <Typography sx={{ fontSize: 12, fontWeight: 800, color: rule.isActive ? '#047857' : '#B91C1C' }}>
                            {rule.isActive ? 'Active' : 'Inactive'}
                          </Typography>
                        </TableCell>
                      )}
                      {columnVisibility.updatedAt && (
                        <TableCell>
                          <Typography sx={{ fontSize: 12, color: '#475569' }}>
                            {rule.updatedAt ? new Date(rule.updatedAt).toLocaleDateString() : '-'}
                          </Typography>
                        </TableCell>
                      )}
                      <TableCell>
                        <Stack spacing={0.25}>
                          <Button
                            size="small"
                            variant={dirtyRows[rule._id] ? 'contained' : 'outlined'}
                            onClick={() => saveRow(rule)}
                          >
                            Save Row
                          </Button>
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
