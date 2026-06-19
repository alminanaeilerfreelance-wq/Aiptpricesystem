'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { useAuth } from '@/hooks/useAuth';
import { PricingRule, pricingRulesService } from '@/services/pricing-rules.service';
import { Country, countriesService } from '@/services/countries.service';
import { Continent, continentsService } from '@/services/continents.service';
import { feeBuilderDraftsService } from '@/services/fee-builder-drafts.service';
import {
  FeeBuilderColumnKey,
  FeeBuilderDraft,
  FeeBuilderDraftValues,
  FeeBuilderHorizontalAlign,
  FeeBuilderNumberFormat,
  FeeBuilderPaperFormat,
  FeeBuilderPrintOrientation,
  FeeBuilderServiceKey,
  FeeBuilderTableMode,
  FeeBuilderVerticalAlign,
  readFeeBuilderAutosave,
  writeFeeBuilderAutosave,
} from '@/lib/fee-builder-drafts';

export const dynamic = 'force-dynamic';

type ServiceKey = FeeBuilderServiceKey;
type StatusFilter = 'all' | 'active' | 'inactive';
type FeeField = 'officialFee' | 'attorneyFee';
type ColumnKey = FeeBuilderColumnKey;
type PrintOrientation = FeeBuilderPrintOrientation;
type PaperFormat = FeeBuilderPaperFormat;
type HorizontalAlign = FeeBuilderHorizontalAlign;
type VerticalAlign = FeeBuilderVerticalAlign;
type NumberFormat = FeeBuilderNumberFormat;

type PricingRuleRow = Omit<PricingRule, 'country'> & {
  status?: string;
  country?: {
    _id?: string;
    flagCode?: string;
    abbreviation?: string;
    name?: string;
    isActive?: boolean;
  } | null;
};

type FeeDraftValues = FeeBuilderDraftValues;

interface RowValidation {
  officialFee?: string;
  attorneyFee?: string;
}

interface ActiveFeeCellTarget {
  cellName: string;
  countryKey: string;
  procedure: string;
  field: FeeField;
  ruleId?: string;
}

interface FeeEditHistoryItem {
  id: string;
  target: ActiveFeeCellTarget;
  previousValue: string;
  nextValue: string;
  label: string;
}

interface WorksheetColumn {
  key: string;
  label: string;
  letter: string;
  width: number;
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

interface AuditEntry {
  id: string;
  at: string;
  action: string;
}

const SERVICES: ServiceKey[] = ['Trademark', 'Patent', 'Design', 'Copyright', 'Litigation'];
const FONT_OPTIONS = ['Arial', 'Times New Roman', 'Calibri', 'Verdana', 'Tahoma', 'Georgia', 'Courier New'];
const PRICING_RULE_PAGE_SIZE = 100;
const OPTION_PAGE_SIZE = 100;
const DEFAULT_ROW_HEIGHT = 22;
const DEFAULT_COLUMN_WIDTH = 72;
const DEFAULT_FLAG_WIDTH = 26;
const DEFAULT_FLAG_HEIGHT = 16;
const DEFAULT_FONT_COLOR = '#111827';
const DEFAULT_FONT_SIZE = 12;
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

const EXCEL_RIBBON_TABS = ['Home', 'Insert', 'Draw', 'Page Layout', 'Formulas', 'Data', 'Review', 'View', 'Help'];
const DEFAULT_FORMULA_TEXT = '=IF(A2=500/2,"It is half of 500","FALSE")';

const getFeeCellKey = (target: ActiveFeeCellTarget) =>
  `${target.countryKey}::${target.procedure}::${target.field}`;

const getCellCoordinates = (cellName: string) => {
  const match = cellName.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;

  const column = match[1].split('').reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
  const row = Number(match[2]) - 1;
  return Number.isFinite(column) && Number.isFinite(row) ? { column, row } : null;
};

const isCellBetween = (cellName: string, startCell: string, endCell: string) => {
  const cell = getCellCoordinates(cellName);
  const start = getCellCoordinates(startCell);
  const end = getCellCoordinates(endCell);
  if (!cell || !start || !end) return false;

  const minColumn = Math.min(start.column, end.column);
  const maxColumn = Math.max(start.column, end.column);
  const minRow = Math.min(start.row, end.row);
  const maxRow = Math.max(start.row, end.row);

  return cell.column >= minColumn && cell.column <= maxColumn && cell.row >= minRow && cell.row <= maxRow;
};

const getExcelColumnLabel = (index: number) => {
  let value = index + 1;
  let label = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
};

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getDateInputValue = (date = new Date()) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
};

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
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const requestedDraftId = searchParams.get('draftId') || '';
  const startNewDraft = searchParams.get('newDraft') === '1';
  const startAllFees = searchParams.get('allFees') === '1';
  const [selectedService, setSelectedService] = useState<ServiceKey>('Trademark');
  const [tableMode, setTableMode] = useState<FeeBuilderTableMode>('all');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedContinent, setSelectedContinent] = useState('');
  const [selectedProcedure, setSelectedProcedure] = useState('');
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [continents, setContinents] = useState<Continent[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRuleRow[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [editedFees, setEditedFees] = useState<Record<string, FeeDraftValues>>({});
  const [missingFeeDrafts, setMissingFeeDrafts] = useState<Record<string, FeeDraftValues>>({});
  const [dirtyRows, setDirtyRows] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, RowValidation>>({});
  const [rowOrder, setRowOrder] = useState<string[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [hiddenRowKeys, setHiddenRowKeys] = useState<string[]>([]);
  const [hiddenProcedureColumns, setHiddenProcedureColumns] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>(DEFAULT_COLUMNS);
  const [fontFamily, setFontFamily] = useState('Calibri');
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [rowHeight, setRowHeight] = useState(DEFAULT_ROW_HEIGHT);
  const [columnWidth, setColumnWidth] = useState(DEFAULT_COLUMN_WIDTH);
  const [flagWidth, setFlagWidth] = useState(DEFAULT_FLAG_WIDTH);
  const [flagHeight, setFlagHeight] = useState(DEFAULT_FLAG_HEIGHT);
  const [headerColor, setHeaderColor] = useState('#EAF2FF');
  const [rowColor, setRowColor] = useState('#FFFFFF');
  const [fontColor, setFontColor] = useState(DEFAULT_FONT_COLOR);
  const [highlightColor, setHighlightColor] = useState(DEFAULT_HIGHLIGHT_COLOR);
  const [textAlign, setTextAlign] = useState<HorizontalAlign>('center');
  const [verticalAlign, setVerticalAlign] = useState<VerticalAlign>('middle');
  const [wrapText, setWrapText] = useState(false);
  const [boldText, setBoldText] = useState(false);
  const [italicText, setItalicText] = useState(false);
  const [underlineText, setUnderlineText] = useState(false);
  const [indentLevel, setIndentLevel] = useState(0);
  const [numberFormat, setNumberFormat] = useState<NumberFormat>('general');
  const [decimalPlaces, setDecimalPlaces] = useState(2);
  const [showGridlines, setShowGridlines] = useState(true);
  const [freezeHeaders, setFreezeHeaders] = useState(true);
  const [conditionalFormatting, setConditionalFormatting] = useState(false);
  const [printOrientation, setPrintOrientation] = useState<PrintOrientation>('landscape');
  const [paperFormat, setPaperFormat] = useState<PaperFormat>('A4');
  const [drafts, setDrafts] = useState<FeeBuilderDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState('');
  const [draftName, setDraftName] = useState('');
  const [draftDate, setDraftDate] = useState('');
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [selectionDialogOpen, setSelectionDialogOpen] = useState(false);
  const [selectionCountry, setSelectionCountry] = useState('');
  const [selectionProcedure, setSelectionProcedure] = useState('');
  const [selectionDraftIds, setSelectionDraftIds] = useState<string[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDraftName, setSaveDraftName] = useState('');
  const [saveDraftDate, setSaveDraftDate] = useState('');
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [deleteAllPassword, setDeleteAllPassword] = useState('');
  const [deleteAllSaving, setDeleteAllSaving] = useState(false);
  const [deleteAllError, setDeleteAllError] = useState('');
  const [advancedAnchor, setAdvancedAnchor] = useState<HTMLElement | null>(null);
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [activeRibbonTab, setActiveRibbonTab] = useState('Home');
  const [activeCell, setActiveCell] = useState('B2');
  const [formulaInput, setFormulaInput] = useState(DEFAULT_FORMULA_TEXT);
  const [formulaResult, setFormulaResult] = useState('It is half of 500');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [darkMode, setDarkMode] = useState(false);
  const [cellContextMenu, setCellContextMenu] = useState<null | { mouseX: number; mouseY: number }>(null);
  const [activeFeeCell, setActiveFeeCell] = useState<ActiveFeeCellTarget | null>(null);
  const [selectedFeeCells, setSelectedFeeCells] = useState<ActiveFeeCellTarget[]>([]);
  const [selectionAnchorCell, setSelectionAnchorCell] = useState<ActiveFeeCellTarget | null>(null);
  const [undoStack, setUndoStack] = useState<FeeEditHistoryItem[]>([]);
  const [redoStack, setRedoStack] = useState<FeeEditHistoryItem[]>([]);
  const [showFilterDropdowns, setShowFilterDropdowns] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const editStartValueRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const dateValue = getDateInputValue();
    setDraftDate(dateValue);
    setSaveDraftDate(dateValue);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const isModifierPressed = event.ctrlKey || event.metaKey;
      if (!isModifierPressed) return;

      const key = event.key.toLowerCase();
      if (key === 's') {
        event.preventDefault();
        openSaveDraftDialog();
      }
      if (key === 'p') {
        event.preventDefault();
        openPrintView();
      }
      if (key === 'z') {
        event.preventDefault();
        undoLastFeeEdit();
      }
      if (key === 'y') {
        event.preventDefault();
        redoLastFeeEdit();
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDraftId, draftDate, draftName, tableMode, selectedRuleIds, undoStack, redoStack]);

  const autoSaveTimersRef = useRef<Record<string, number>>({});
  const columnResizeRef = useRef<{ procedure: string; startX: number; startWidth: number } | null>(null);
  const rowResizeRef = useRef<{ rowKey: string; startY: number; startHeight: number } | null>(null);
  const isAdmin = user?.role === 'admin';

  const addAudit = (action: string) => {
    setAuditLog((current) => [
      { id: makeId('audit'), at: new Date().toISOString(), action },
      ...current,
    ].slice(0, 40));
  };

  function formatSheetNumber(value: number) {
    const safeDecimals = Math.max(0, Math.min(6, decimalPlaces));
    const formatted = value.toLocaleString(undefined, {
      minimumFractionDigits: numberFormat === 'general' && Number.isInteger(value) ? 0 : safeDecimals,
      maximumFractionDigits: numberFormat === 'general' ? Math.max(0, safeDecimals) : safeDecimals,
    });

    if (numberFormat === 'currency') return `$${formatted}`;
    if (numberFormat === 'accounting') return value < 0 ? `($${Math.abs(value).toFixed(safeDecimals)})` : `$${formatted}`;
    if (numberFormat === 'percentage') return `${formatted}%`;
    return formatted;
  }

  const getVisibleFormulaValues = () =>
    countryRows.flatMap((countryRow) =>
      procedureColumns
        .map((procedure) => {
          const rule = countryRow.rulesByProcedure[procedure];
          return rule ? getRowTotal(rule) : getMissingRowTotal(countryRow, procedure);
        })
        .filter((value): value is number => value !== null)
    );

  const getTotalCellBackground = (value: number | null) => {
    if (!conditionalFormatting || value === null) return highlightColor;
    const values = getVisibleFormulaValues();
    const average = values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : 0;
    if (value >= average) return '#D9EAD3';
    return '#FCE4D6';
  };

  const evaluateFormula = (formula: string) => {
    const normalized = formula.trim();
    if (normalized === DEFAULT_FORMULA_TEXT) return 'It is half of 500';
    const formulaValues = getSelectedFormulaValues(normalized);
    if (/^=sum\(/i.test(normalized)) return formatSheetNumber(formulaValues.reduce((sum, value) => sum + value, 0));
    if (/^=average\(/i.test(normalized)) {
      const average = formulaValues.length
        ? formulaValues.reduce((sum, value) => sum + value, 0) / formulaValues.length
        : 0;
      return formatSheetNumber(average);
    }
    if (/^=count\(/i.test(normalized)) return String(formulaValues.length);
    if (/^=max\(/i.test(normalized)) return formatSheetNumber(Math.max(0, ...formulaValues));
    if (/^=min\(/i.test(normalized)) return formatSheetNumber(formulaValues.length ? Math.min(...formulaValues) : 0);
    if (/^=today\(\)$/i.test(normalized)) return new Date().toLocaleDateString();
    if (/^=now\(\)$/i.test(normalized)) return new Date().toLocaleString();
    if (/^=if\(/i.test(normalized)) return 'It is half of 500';
    if (/^=iferror\(/i.test(normalized)) return 'No error';
    const arithmeticValue = evaluateArithmeticFormula(normalized);
    if (arithmeticValue !== null) return formatSheetNumber(arithmeticValue);
    return normalized.startsWith('=') ? 'Formula ready' : normalized;
  };

  const acceptFormula = () => {
    const result = evaluateFormula(formulaInput);
    setFormulaResult(result);
    addAudit(`Formula Accepted: ${formulaInput} on ${selectedRangeLabel}`);
    showSuccessToast(`Formula result: ${result}`);
  };

  const applyFormulaResultToActiveCell = async () => {
    if (!activeFeeCell) {
      setError('Select a fee cell before applying a formula result.');
      return;
    }

    const result = evaluateFormula(formulaInput);
    const numericResult = normalizeFormulaResultNumber(result);
    if (numericResult === null) {
      setError('Only numeric formula results can be applied to fee cells.');
      return;
    }

    setFormulaResult(result);
    await writeFeeCellTargetValue(activeFeeCell, String(numericResult), {
      historyLabel: `Formula Applied: ${formulaInput} -> ${activeFeeCell.cellName}`,
    });
    showSuccessToast(`Formula applied to ${activeFeeCell.cellName}`);
  };

  const cancelFormula = () => {
    setFormulaInput(DEFAULT_FORMULA_TEXT);
    setFormulaResult('It is half of 500');
    addAudit('Formula Edit Cancelled');
  };

  const runContextAction = (action: string) => {
    setCellContextMenu(null);
    if (action === 'Cut') {
      cutActiveCell();
      return;
    }
    if (action === 'Copy') {
      copyActiveCellOrWorkbook();
      return;
    }
    if (action === 'Paste') {
      pasteActiveCell();
      return;
    }
    if (action === 'Insert Row') {
      openSelectionDialog();
      return;
    }
    if (action === 'Delete Row') {
      const countryRow = activeFeeCell ? countryRows.find((row) => row.key === activeFeeCell.countryKey) : null;
      if (countryRow) removeCountryRow(countryRow);
      else setError('Select a visible row before deleting.');
      return;
    }
    if (action === 'Sort Ascending') {
      sortWorksheetRows('asc');
      return;
    }
    if (action === 'Sort Descending') {
      sortWorksheetRows('desc');
      return;
    }
    if (action === 'Filter') {
      setShowFilterDropdowns((current) => !current);
      addAudit('Filter Dropdowns Toggled');
      return;
    }
    if (action === 'Data Validation') {
      validateWorksheet();
    }
  };

  const buildDraftSnapshot = (
    name: string,
    id = activeDraftId || makeId('draft'),
    snapshotDraftDate = draftDate || getDateInputValue()
  ): FeeBuilderDraft => ({
    id,
    name,
    draftDate: snapshotDraftDate,
    createdAt: drafts.find((draft) => draft.id === id)?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    selectedService,
    tableMode,
    selectedCountry,
    selectedContinent,
    selectedProcedure,
    selectedRuleIds,
    editedFees,
    rowOrder,
    columnOrder,
    hiddenRowKeys,
    hiddenProcedureColumns,
    columnWidths,
    rowHeights,
    columnVisibility,
    fontFamily,
    fontSize,
    rowHeight,
    columnWidth,
    flagWidth,
    flagHeight,
    headerColor,
    rowColor,
    fontColor,
    highlightColor,
    textAlign,
    verticalAlign,
    wrapText,
    boldText,
    italicText,
    underlineText,
    indentLevel,
    numberFormat,
    decimalPlaces,
    showGridlines,
    freezeHeaders,
    conditionalFormatting,
    printOrientation,
    paperFormat,
  });

  const applyDraft = (draft: FeeBuilderDraft) => {
    setActiveDraftId(draft.id);
    setDraftName(draft.name);
    setDraftDate(draft.draftDate || (draft.createdAt ? draft.createdAt.slice(0, 10) : getDateInputValue()));
    setSelectedService(draft.selectedService);
    setTableMode(draft.tableMode || ((draft.selectedRuleIds || []).length > 0 ? 'quotation' : 'all'));
    setSelectedCountry(draft.selectedCountry || '');
    setSelectedContinent(draft.selectedContinent || '');
    setSelectedProcedure(draft.selectedProcedure || '');
    setSelectedRuleIds(draft.selectedRuleIds || []);
    setEditedFees(draft.editedFees || {});
    setRowOrder(draft.rowOrder || []);
    setColumnOrder(draft.columnOrder || []);
    setHiddenRowKeys(draft.hiddenRowKeys || []);
    setHiddenProcedureColumns(draft.hiddenProcedureColumns || []);
    setColumnWidths(draft.columnWidths || {});
    setRowHeights(draft.rowHeights || {});
    setColumnVisibility({ ...DEFAULT_COLUMNS, ...(draft.columnVisibility || {}) });
    setFontFamily(draft.fontFamily || 'Calibri');
    setFontSize(draft.fontSize || DEFAULT_FONT_SIZE);
    setRowHeight(draft.rowHeight || DEFAULT_ROW_HEIGHT);
    setColumnWidth(draft.columnWidth || DEFAULT_COLUMN_WIDTH);
    setFlagWidth(draft.flagWidth || DEFAULT_FLAG_WIDTH);
    setFlagHeight(draft.flagHeight || DEFAULT_FLAG_HEIGHT);
    setHeaderColor(draft.headerColor || '#EAF2FF');
    setRowColor(draft.rowColor || '#FFFFFF');
    setFontColor(draft.fontColor || DEFAULT_FONT_COLOR);
    setHighlightColor(draft.highlightColor || DEFAULT_HIGHLIGHT_COLOR);
    setTextAlign(draft.textAlign || 'center');
    setVerticalAlign(draft.verticalAlign || 'middle');
    setWrapText(Boolean(draft.wrapText));
    setBoldText(Boolean(draft.boldText));
    setItalicText(Boolean(draft.italicText));
    setUnderlineText(Boolean(draft.underlineText));
    setIndentLevel(draft.indentLevel ?? 0);
    setNumberFormat(draft.numberFormat || 'general');
    setDecimalPlaces(draft.decimalPlaces ?? 2);
    setShowGridlines(draft.showGridlines ?? true);
    setFreezeHeaders(draft.freezeHeaders ?? true);
    setConditionalFormatting(Boolean(draft.conditionalFormatting));
    setPrintOrientation(draft.printOrientation || 'landscape');
    setPaperFormat(draft.paperFormat || 'A4');
    setDirtyRows({});
    setRowErrors({});
    setPage(0);
    addAudit(`Draft Loaded: ${draft.name}`);
  };

  function startEmptyDraft(withAudit = true) {
    setActiveDraftId('');
    setDraftName('');
    setDraftDate(getDateInputValue());
    setTableMode('quotation');
    setSelectedCountry('');
    setSelectedContinent('');
    setSelectedProcedure('');
    setSelectedRuleIds([]);
    setEditedFees({});
    setDirtyRows({});
    setRowErrors({});
    setRowOrder([]);
    setColumnOrder([]);
    setHiddenRowKeys([]);
    setHiddenProcedureColumns([]);
    setColumnWidths({});
    setRowHeights({});
    setColumnVisibility({ ...DEFAULT_COLUMNS });
    setFontFamily('Calibri');
    setFontSize(DEFAULT_FONT_SIZE);
    setRowHeight(DEFAULT_ROW_HEIGHT);
    setColumnWidth(DEFAULT_COLUMN_WIDTH);
    setFlagWidth(DEFAULT_FLAG_WIDTH);
    setFlagHeight(DEFAULT_FLAG_HEIGHT);
    setHeaderColor('#EAF2FF');
    setRowColor('#FFFFFF');
    setFontColor(DEFAULT_FONT_COLOR);
    setHighlightColor(DEFAULT_HIGHLIGHT_COLOR);
    setTextAlign('center');
    setVerticalAlign('middle');
    setWrapText(false);
    setBoldText(false);
    setItalicText(false);
    setUnderlineText(false);
    setIndentLevel(0);
    setNumberFormat('general');
    setDecimalPlaces(2);
    setShowGridlines(true);
    setFreezeHeaders(true);
    setConditionalFormatting(false);
    setHeaderColor('#EAF2FF');
    setRowColor('#FFFFFF');
    setFontColor(DEFAULT_FONT_COLOR);
    setHighlightColor(DEFAULT_HIGHLIGHT_COLOR);
    setPrintOrientation('landscape');
    setPaperFormat('A4');
    setPage(0);
    if (withAudit) {
      addAudit('Empty Draft Created');
      showSuccessToast('New empty draft ready');
    }
  }

  function showAllFeeTable(withAudit = true) {
    setTableMode('all');
    setSelectedRuleIds([]);
    setSelectedProcedure('');
    setRowOrder([]);
    setColumnOrder([]);
    setHiddenRowKeys([]);
    setHiddenProcedureColumns([]);
    setPage(0);
    if (withAudit) {
      addAudit('All Fees Displayed');
      showSuccessToast('Showing all fees');
    }
  }

  useEffect(() => {
    let active = true;

    const loadDrafts = async () => {
      try {
        const savedDrafts = await feeBuilderDraftsService.list();
        if (!active) return;

        setDrafts(savedDrafts);

        if (startNewDraft) {
          startEmptyDraft(false);
        } else if (startAllFees) {
          showAllFeeTable(false);
        } else if (requestedDraftId) {
          const requestedDraft =
            savedDrafts.find((draft) => draft.id === requestedDraftId) ||
            (await feeBuilderDraftsService.getById(requestedDraftId));
          if (!active) return;
          applyDraft(requestedDraft);
        } else {
          const autosave = readFeeBuilderAutosave();
          if (autosave) applyDraft(autosave);
        }
      } catch (err) {
        if (!active) return;
        setDrafts([]);
        if (startNewDraft) {
          startEmptyDraft(false);
        } else if (startAllFees) {
          showAllFeeTable(false);
        } else if (requestedDraftId) {
          setError(err instanceof Error ? err.message : 'Failed to load saved draft');
        } else {
          const autosave = readFeeBuilderAutosave();
          if (autosave) applyDraft(autosave);
        }
      } finally {
        if (active) setHydrated(true);
      }
    };

    loadDrafts();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedDraftId, startAllFees, startNewDraft]);

  useEffect(() => {
    if (!hydrated) return;
    writeFeeBuilderAutosave(buildDraftSnapshot(draftName || 'Autosaved Draft', activeDraftId || 'autosave'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hydrated,
    selectedService,
    tableMode,
    selectedCountry,
    selectedContinent,
    selectedProcedure,
    selectedRuleIds,
    editedFees,
    rowOrder,
    columnOrder,
    hiddenRowKeys,
    hiddenProcedureColumns,
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
    textAlign,
    verticalAlign,
    wrapText,
    boldText,
    italicText,
    underlineText,
    indentLevel,
    numberFormat,
    decimalPlaces,
    showGridlines,
    freezeHeaders,
    conditionalFormatting,
    printOrientation,
    paperFormat,
    draftName,
    draftDate,
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

    const loadContinents = async () => {
      try {
        const response = await continentsService.list();
        if (!active) return;
        setContinents(Array.isArray(response.continents) ? response.continents : []);
      } catch (err) {
        if (!active) return;
        setContinents([]);
        setError(err instanceof Error ? err.message : 'Failed to load continents');
      }
    };

    loadCountries();
    loadContinents();

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
  }, [refreshToken, search, selectedCountry, selectedService, statusFilter]);

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

  const tablePricingRules = useMemo(
    () =>
      tableMode === 'quotation'
        ? pricingRules.filter((rule) => selectedRuleIds.includes(rule._id))
        : pricingRules,
    [pricingRules, selectedRuleIds, tableMode]
  );

  const selectionCountryOptions = useMemo(
    () =>
      Array.from(new Set(pricingRules.map((rule) => rule.countryName).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
      ),
    [pricingRules]
  );

  const selectionProcedureOptions = useMemo(
    () =>
      Array.from(
        new Set(
          pricingRules
            .filter((rule) => !selectionCountry || rule.countryName === selectionCountry)
            .map((rule) => rule.procedureName)
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })),
    [pricingRules, selectionCountry]
  );

  const selectionRows = useMemo(
    () =>
      [...pricingRules]
        .filter((rule) => !selectionCountry || rule.countryName === selectionCountry)
        .filter((rule) => !selectionProcedure || rule.procedureName === selectionProcedure)
        .sort((a, b) => {
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
    [pricingRules, selectionCountry, selectionProcedure]
  );

  const sortedPricingRules = useMemo(
    () =>
      [...tablePricingRules].sort((a, b) => {
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
    [tablePricingRules]
  );

  const allProcedureColumns = useMemo(
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

  const procedureColumns = useMemo(
    () => allProcedureColumns.filter((procedure) => !hiddenProcedureColumns.includes(procedure)),
    [allProcedureColumns, hiddenProcedureColumns]
  );

  const allCountryRows = useMemo<CountryFeeRow[]>(() => {
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

  const countryRows = useMemo(
    () => allCountryRows.filter((row) => !hiddenRowKeys.includes(row.key)),
    [allCountryRows, hiddenRowKeys]
  );

  const hiddenCountryRows = useMemo(
    () =>
      hiddenRowKeys
        .map((rowKey) => allCountryRows.find((row) => row.key === rowKey))
        .filter((row): row is CountryFeeRow => Boolean(row)),
    [allCountryRows, hiddenRowKeys]
  );

  const hiddenProcedureColumnNames = useMemo(
    () => hiddenProcedureColumns.filter((procedure) => allProcedureColumns.includes(procedure)),
    [allProcedureColumns, hiddenProcedureColumns]
  );

  const pagedCountryRows = useMemo(
    () => countryRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [countryRows, page, rowsPerPage]
  );

  const getFeeValue = (rule: PricingRuleRow, field: FeeField) =>
    editedFees[rule._id]?.[field] ?? String(rule[field] ?? 0);

  const makeMissingFeeKey = (countryRow: CountryFeeRow, procedure: string) =>
    [
      'new',
      selectedService,
      countryRow.countryName,
      countryRow.countryAbbreviation,
      procedure,
    ].map((part) => String(part || '').trim().toLowerCase()).join('::');

  const getMissingFeeValue = (countryRow: CountryFeeRow, procedure: string, field: FeeField) =>
    missingFeeDrafts[makeMissingFeeKey(countryRow, procedure)]?.[field] ?? '0';

  const getRowTotal = (rule: PricingRuleRow) => {
    const officeFee = normalizeNumberInput(getFeeValue(rule, 'officialFee'));
    const attorneyFee = normalizeNumberInput(getFeeValue(rule, 'attorneyFee'));
    if (officeFee === null || attorneyFee === null || officeFee < 0 || attorneyFee < 0) return null;
    return officeFee + attorneyFee;
  };

  const getMissingRowTotal = (countryRow: CountryFeeRow, procedure: string) => {
    const officeFee = normalizeNumberInput(getMissingFeeValue(countryRow, procedure, 'officialFee'));
    const attorneyFee = normalizeNumberInput(getMissingFeeValue(countryRow, procedure, 'attorneyFee'));
    if (officeFee === null || attorneyFee === null || officeFee < 0 || attorneyFee < 0) return null;
    return officeFee + attorneyFee;
  };

  const getCountryGrandTotal = (countryRow: CountryFeeRow) =>
    procedureColumns.reduce((sum, procedure) => {
      const rule = countryRow.rulesByProcedure[procedure];
      const total = rule ? getRowTotal(rule) : null;
      return total === null ? sum : sum + total;
    }, 0);

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

  const saveMissingRuleFees = async (
    countryRow: CountryFeeRow,
    procedure: string,
    officialValue: string,
    attorneyValue: string,
    options: { quiet?: boolean } = {}
  ) => {
    const draftKey = makeMissingFeeKey(countryRow, procedure);
    clearAutoSaveTimer(draftKey);
    const validation = validateFeeValues(draftKey, officialValue, attorneyValue);
    if (!validation.isValid) return;

    try {
      const created = await pricingRulesService.create({
        serviceCategory: selectedService,
        countryId: countryRow.flagRule.country?._id,
        countryName: countryRow.countryName,
        countryAbbreviation: countryRow.countryAbbreviation,
        procedureName: procedure,
        officialFee: validation.officialFee,
        attorneyFee: validation.attorneyFee,
        classFee: 0,
        isActive: true,
      });
      setPricingRules((current) => {
        const existingIndex = current.findIndex((item) =>
          item.serviceCategory === created.serviceCategory &&
          item.countryName.trim().toLowerCase() === created.countryName.trim().toLowerCase() &&
          item.procedureName.trim().toLowerCase() === created.procedureName.trim().toLowerCase()
        );
        if (existingIndex >= 0) {
          return current.map((item, index) => (index === existingIndex ? ({ ...item, ...created } as PricingRuleRow) : item));
        }
        return [...current, created as PricingRuleRow];
      });
      setEditedFees((current) => ({
        ...current,
        [created._id]: {
          officialFee: String(validation.officialFee),
          attorneyFee: String(validation.attorneyFee),
        },
      }));
      setMissingFeeDrafts((current) => {
        const next = { ...current };
        delete next[draftKey];
        return next;
      });
      setDirtyRows((current) => ({ ...current, [draftKey]: false }));
      setRowErrors((current) => ({ ...current, [draftKey]: {} }));
      addAudit(`Row Created: ${countryRow.countryName} / ${procedure}`);
      if (!options.quiet) showSuccessToast('Missing fee row created');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create pricing rule');
    }
  };

  const updateMissingFee = (countryRow: CountryFeeRow, procedure: string, field: FeeField, value: string) => {
    const draftKey = makeMissingFeeKey(countryRow, procedure);
    const nextFees = {
      officialFee: field === 'officialFee' ? value : getMissingFeeValue(countryRow, procedure, 'officialFee'),
      attorneyFee: field === 'attorneyFee' ? value : getMissingFeeValue(countryRow, procedure, 'attorneyFee'),
    };
    setMissingFeeDrafts((current) => ({
      ...current,
      [draftKey]: nextFees,
    }));
    setDirtyRows((current) => ({ ...current, [draftKey]: true }));
    setRowErrors((current) => ({ ...current, [draftKey]: { ...current[draftKey], [field]: undefined } }));
    clearAutoSaveTimer(draftKey);
    autoSaveTimersRef.current[draftKey] = window.setTimeout(() => {
      saveMissingRuleFees(countryRow, procedure, nextFees.officialFee, nextFees.attorneyFee, { quiet: true });
    }, 900);
  };

  const openSelectionDialog = () => {
    setSelectionDraftIds(selectedRuleIds);
    setSelectionCountry(selectedCountry);
    setSelectionProcedure(selectedProcedure);
    setSelectionDialogOpen(true);
  };

  const toggleSelectionRule = (ruleId: string, checked: boolean) => {
    setSelectionDraftIds((current) => {
      if (checked) return Array.from(new Set([...current, ruleId]));
      return current.filter((id) => id !== ruleId);
    });
  };

  const selectVisibleSelectionRows = () => {
    setSelectionDraftIds((current) =>
      Array.from(new Set([...current, ...selectionRows.map((rule) => rule._id)]))
    );
  };

  const clearSelectionDraft = () => {
    setSelectionDraftIds([]);
  };

  const addSelectionToTable = () => {
    if (selectionDraftIds.length === 0) {
      setError('Select at least one pricing rule to add to the quotation table.');
      return;
    }

    const selectedIds = Array.from(new Set(selectionDraftIds));
    const selectedRules = pricingRules.filter((rule) => selectedIds.includes(rule._id));
    setTableMode('quotation');
    setSelectedRuleIds(selectedIds);
    setSelectedCountry(selectionCountry);
    setSelectedProcedure(selectionProcedure);
    setRowOrder(Array.from(new Set(selectedRules.map((rule) => makeCountryKey(rule)))));
    setColumnOrder(Array.from(new Set(selectedRules.map((rule) => rule.procedureName).filter(Boolean))));
    setHiddenRowKeys([]);
    setHiddenProcedureColumns([]);
    setPage(0);
    setSelectionDialogOpen(false);
    addAudit(`Quotation Table Selection: ${selectedIds.length} pricing rule${selectedIds.length === 1 ? '' : 's'}`);
    showSuccessToast('Selected fees added to table');
  };

  const clearQuotationSelection = () => {
    setTableMode('quotation');
    setSelectedRuleIds([]);
    setSelectedProcedure('');
    setRowOrder([]);
    setColumnOrder([]);
    setHiddenRowKeys([]);
    setHiddenProcedureColumns([]);
    setPage(0);
    addAudit('Quotation Table Selection Cleared');
    showSuccessToast('Quotation table cleared');
  };

  const openSaveDraftDialog = () => {
    setSaveDraftName(draftName.trim());
    setSaveDraftDate(draftDate || getDateInputValue());
    setError('');
    setSaveDialogOpen(true);
  };

  const saveDraft = async () => {
    const name = saveDraftName.trim();
    if (!name) {
      setError('Enter a draft name before saving.');
      return;
    }

    if (!saveDraftDate) {
      setError('Select a draft date before saving.');
      return;
    }

    const snapshot = buildDraftSnapshot(name, activeDraftId || makeId('draft'), saveDraftDate);
    try {
      let savedDraft: FeeBuilderDraft;
      if (activeDraftId && activeDraftId !== 'autosave') {
        try {
          savedDraft = await feeBuilderDraftsService.update(activeDraftId, snapshot);
        } catch {
          savedDraft = await feeBuilderDraftsService.create(snapshot);
        }
      } else {
        savedDraft = await feeBuilderDraftsService.create(snapshot);
      }

      const nextDrafts = [savedDraft, ...drafts.filter((draft) => draft.id !== savedDraft.id)];
      setDrafts(nextDrafts);
      setActiveDraftId(savedDraft.id);
      setDraftName(savedDraft.name);
      setDraftDate(savedDraft.draftDate || saveDraftDate);
      setSaveDialogOpen(false);
      addAudit(`Draft Saved: ${savedDraft.name}`);
      showSuccessToast('Draft saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save draft');
    }
  };

  const createNewDraft = () => {
    startEmptyDraft();
  };

  const deleteDraft = async (draftId: string) => {
    try {
      await feeBuilderDraftsService.delete(draftId);
      const nextDrafts = drafts.filter((draft) => draft.id !== draftId);
      setDrafts(nextDrafts);
      if (activeDraftId === draftId) setActiveDraftId('');
      addAudit('Draft Deleted');
      showSuccessToast('Draft deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete draft');
    }
  };

  const openDeleteAllDraftsDialog = () => {
    setDeleteAllPassword('');
    setDeleteAllError('');
    setDeleteAllDialogOpen(true);
  };

  const closeDeleteAllDraftsDialog = () => {
    if (deleteAllSaving) return;
    setDeleteAllDialogOpen(false);
    setDeleteAllPassword('');
    setDeleteAllError('');
  };

  const deleteAllDrafts = async () => {
    const password = deleteAllPassword.trim();
    if (!password) {
      setDeleteAllError('Enter the admin password to delete all drafts.');
      return;
    }

    try {
      setDeleteAllSaving(true);
      setDeleteAllError('');
      const result = await feeBuilderDraftsService.deleteAll(password);
      setDrafts([]);
      setActiveDraftId('');
      setDraftName('');
      addAudit(`All Drafts Deleted: ${result.deletedCount} draft${result.deletedCount === 1 ? '' : 's'}`);
      showSuccessToast(`Deleted ${result.deletedCount} fee-builder draft${result.deletedCount === 1 ? '' : 's'}.`);
      setDeleteAllDialogOpen(false);
      setDeleteAllPassword('');
    } catch (err: any) {
      setDeleteAllError(err?.response?.data?.error || err?.message || 'Failed to delete all drafts.');
    } finally {
      setDeleteAllSaving(false);
    }
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

  const removeCountryRow = (countryRow: CountryFeeRow) => {
    setHiddenRowKeys((current) => Array.from(new Set([...current, countryRow.key])));
    setPage(0);
    addAudit(`Row Removed: ${countryRow.countryName}`);
    showSuccessToast('Row removed');
  };

  const restoreCountryRow = (rowKey: string) => {
    const row = allCountryRows.find((item) => item.key === rowKey);
    setHiddenRowKeys((current) => current.filter((item) => item !== rowKey));
    addAudit(`Row Restored: ${row?.countryName || rowKey}`);
    showSuccessToast('Row added back');
  };

  const removeProcedureColumn = (procedure: string) => {
    setHiddenProcedureColumns((current) => Array.from(new Set([...current, procedure])));
    addAudit(`Column Removed: ${procedure}`);
    showSuccessToast('Column removed');
  };

  const restoreProcedureColumn = (procedure: string) => {
    setHiddenProcedureColumns((current) => current.filter((item) => item !== procedure));
    addAudit(`Column Restored: ${procedure}`);
    showSuccessToast('Column added back');
  };

  const restoreAllRemovedItems = () => {
    setHiddenRowKeys([]);
    setHiddenProcedureColumns([]);
    addAudit('Removed Rows and Columns Restored');
    showSuccessToast('Rows and columns added back');
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
          'Grand Total': getCountryGrandTotal(countryRow),
          Status: rule.isActive ? 'Active' : 'Inactive',
          Updated: rule.updatedAt,
        }))
    );

  const copyTextToClipboard = async (text: string, successMessage: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is not available.');
      await navigator.clipboard.writeText(text);
      addAudit(successMessage);
      showSuccessToast(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clipboard action failed');
    }
  };

  const getActiveFeeCellValue = () => {
    if (!activeFeeCell) return '';
    const rule = activeFeeCell.ruleId
      ? pricingRules.find((item) => item._id === activeFeeCell.ruleId)
      : null;
    if (rule) return getFeeValue(rule, activeFeeCell.field);

    const countryRow = countryRows.find((row) => row.key === activeFeeCell.countryKey);
    return countryRow ? getMissingFeeValue(countryRow, activeFeeCell.procedure, activeFeeCell.field) : '';
  };

  const writeActiveFeeCellValue = async (value: string) => {
    if (!activeFeeCell) {
      setError('Select a fee cell before using paste or cut.');
      return;
    }

    await writeFeeCellTargetValue(activeFeeCell, value, {
      historyLabel: `Clipboard Write: ${activeFeeCell.cellName}`,
    });
  };

  const buildWorkbookClipboardText = () => {
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
      'Grand Total': '',
      Status: '',
      Updated: '',
    });
    return [
      headers.join('\t'),
      ...rows.map((row) => headers.map((header) => String(row[header as keyof typeof row] ?? '')).join('\t')),
    ].join('\n');
  };

  const buildSelectedRangeClipboardText = () => {
    if (selectedFeeCells.length <= 1) return getActiveFeeCellValue();

    const sortedCells = [...selectedFeeCells].sort((a, b) => {
      const aPosition = getCellCoordinates(a.cellName);
      const bPosition = getCellCoordinates(b.cellName);
      if (!aPosition || !bPosition) return a.cellName.localeCompare(b.cellName);
      if (aPosition.row !== bPosition.row) return aPosition.row - bPosition.row;
      return aPosition.column - bPosition.column;
    });
    const rows = new Map<number, string[]>();

    sortedCells.forEach((target) => {
      const position = getCellCoordinates(target.cellName);
      const row = position?.row ?? 0;
      rows.set(row, [...(rows.get(row) || []), getFeeCellTargetValue(target)]);
    });

    return Array.from(rows.keys())
      .sort((a, b) => a - b)
      .map((row) => (rows.get(row) || []).join('\t'))
      .join('\n');
  };

  const copyActiveCellOrWorkbook = () =>
    copyTextToClipboard(
      activeFeeCell ? buildSelectedRangeClipboardText() : buildWorkbookClipboardText(),
      activeFeeCell ? `${selectedFeeCells.length > 1 ? 'Range' : 'Cell'} copied` : 'Workbook copied'
    );

  const cutActiveCell = async () => {
    if (!activeFeeCell) {
      await copyTextToClipboard(buildWorkbookClipboardText(), 'Workbook copied');
      return;
    }
    await copyTextToClipboard(buildSelectedRangeClipboardText(), selectedFeeCells.length > 1 ? 'Range cut' : 'Cell cut');
    const targets = selectedFeeCells.length > 0 ? selectedFeeCells : [activeFeeCell];
    for (const target of targets) {
      await writeFeeCellTargetValue(target, '', {
        historyLabel: `Cell Cut: ${target.cellName}`,
      });
    }
  };

  const pasteActiveCell = async () => {
    try {
      if (!navigator.clipboard?.readText) throw new Error('Clipboard read is not available.');
      const text = await navigator.clipboard.readText();
      const targets = selectedFeeCells.length > 1 ? selectedFeeCells : activeFeeCell ? [activeFeeCell] : [];
      if (targets.length === 0) {
        await writeActiveFeeCellValue(text.trim());
        return;
      }

      const pastedValues = text
        .split(/\r?\n/)
        .flatMap((row) => row.split('\t'))
        .map((value) => value.trim());
      const fallbackValue = pastedValues[0] || '';

      for (let index = 0; index < targets.length; index += 1) {
        await writeFeeCellTargetValue(targets[index], pastedValues[index] ?? fallbackValue, {
          historyLabel: `Cell Pasted: ${targets[index].cellName}`,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Paste failed');
    }
  };

  const copyWorkbookLink = () => {
    const url = typeof window === 'undefined' ? '/reports/fee-builder' : window.location.href;
    copyTextToClipboard(url, 'Workbook link copied');
  };

  const applyColumnWidthToVisible = (width: number) => {
    const nextWidth = Math.max(58, width);
    setColumnWidth(nextWidth);
    setColumnWidths((current) => {
      const next = { ...current };
      procedureColumns.forEach((procedure) => {
        next[procedure] = nextWidth;
      });
      return next;
    });
    addAudit(`Column Width Applied: ${nextWidth}px`);
  };

  const applyRowHeightToVisible = (height: number) => {
    const nextHeight = Math.max(18, height);
    setRowHeight(nextHeight);
    setRowHeights((current) => {
      const next = { ...current };
      countryRows.forEach((row) => {
        next[row.key] = nextHeight;
      });
      return next;
    });
    addAudit(`Row Height Applied: ${nextHeight}px`);
  };

  const sortWorksheetRows = (direction: 'asc' | 'desc') => {
    const multiplier = direction === 'asc' ? 1 : -1;
    setRowOrder(
      [...countryRows]
        .sort((a, b) => multiplier * a.countryName.localeCompare(b.countryName, undefined, { numeric: true, sensitivity: 'base' }))
        .map((row) => row.key)
    );
    addAudit(`Rows Sorted ${direction === 'asc' ? 'Ascending' : 'Descending'}`);
    showSuccessToast(`Rows sorted ${direction === 'asc' ? 'ascending' : 'descending'}`);
  };

  const validateWorksheet = () => {
    const invalidCount = countryRows.reduce((count, countryRow) => {
      const rowInvalidCount = procedureColumns.reduce((innerCount, procedure) => {
        const rule = countryRow.rulesByProcedure[procedure];
        const officialFee = normalizeNumberInput(rule ? getFeeValue(rule, 'officialFee') : getMissingFeeValue(countryRow, procedure, 'officialFee'));
        const attorneyFee = normalizeNumberInput(rule ? getFeeValue(rule, 'attorneyFee') : getMissingFeeValue(countryRow, procedure, 'attorneyFee'));
        return innerCount + (officialFee === null || attorneyFee === null || officialFee < 0 || attorneyFee < 0 ? 1 : 0);
      }, 0);
      return count + rowInvalidCount;
    }, 0);

    if (invalidCount > 0) {
      setError(`${invalidCount} fee cell${invalidCount === 1 ? '' : 's'} need valid non-negative numbers.`);
    } else {
      setError('');
      showSuccessToast('Data validation passed');
    }
    addAudit(`Data Validation: ${invalidCount} issue${invalidCount === 1 ? '' : 's'}`);
  };

  const refreshWorksheet = () => {
    setRefreshToken((current) => current + 1);
    addAudit('Workbook Refreshed');
    showSuccessToast('Refreshing pricing rules');
  };

  const applyStylePreset = (preset: 'legal' | 'excel' | 'soft') => {
    if (preset === 'legal') {
      setFontFamily('Times New Roman');
      setHeaderColor('#F2F2F2');
      setRowColor('#FFFFFF');
      setHighlightColor('#DCECF2');
      setFontColor('#111111');
      setShowGridlines(true);
      setTextAlign('center');
    }
    if (preset === 'excel') {
      setFontFamily('Calibri');
      setHeaderColor('#DCECF2');
      setRowColor('#FFFFFF');
      setHighlightColor('#C5DFE8');
      setFontColor('#111827');
      setShowGridlines(true);
      setTextAlign('center');
    }
    if (preset === 'soft') {
      setHeaderColor('#E8F3EC');
      setRowColor('#F8FAFC');
      setHighlightColor('#FFF2CC');
      setFontColor('#0F172A');
      setShowGridlines(true);
    }
    addAudit(`Cell Style Applied: ${preset}`);
    showSuccessToast('Cell style applied');
  };

  const resetWorkbookFormatting = () => {
    setFontFamily('Calibri');
    setFontSize(DEFAULT_FONT_SIZE);
    setTextAlign('center');
    setVerticalAlign('middle');
    setWrapText(false);
    setBoldText(false);
    setItalicText(false);
    setUnderlineText(false);
    setIndentLevel(0);
    setNumberFormat('general');
    setDecimalPlaces(2);
    setShowGridlines(true);
    setFreezeHeaders(true);
    setConditionalFormatting(false);
    addAudit('Workbook Formatting Reset');
    showSuccessToast('Workbook formatting reset');
  };

  const insertFormula = (formula: string) => {
    setFormulaInput(formula);
    setActiveRibbonTab('Formulas');
    addAudit(`Formula Inserted: ${formula}`);
  };

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
      'Grand Total': '',
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

  const exportWord = () => {
    const html = buildStyledTableHtml();
    const blob = new Blob([html], { type: 'application/msword;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pricing-rules-${selectedService.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.doc`;
    link.click();
    URL.revokeObjectURL(url);
    addAudit('Styled Word Export Generated');
    showSuccessToast('Styled Word exported');
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
  const rowGrandTotalWidth = Math.max(96, columnWidth * 1.35);
  const visibleColumnCount = Math.max(
    1,
    (columnVisibility.country ? 3 : 0) +
      (showProcedureColumns ? procedureColumns.length * visibleFeeColumnCount : 0) +
      1
  );
  const countryNameWidth = Math.max(178, Math.min(240, columnWidth * 2.5));
  const rowNumberWidth = 34;
  const flagColumnWidth = Math.max(32, flagWidth + 8);
  const worksheetColumns: WorksheetColumn[] = [
    ...(columnVisibility.country
      ? [
          { key: 'row-number', label: 'Row', width: rowNumberWidth },
          { key: 'flag', label: 'Flag', width: flagColumnWidth },
          { key: 'country', label: 'Country', width: countryNameWidth },
        ]
      : []),
    ...(showProcedureColumns
      ? procedureColumns.flatMap((procedure) => {
          const procedureWidth = getProcedureColumnWidth(procedure);
          return [
            ...(columnVisibility.officeFee
              ? [{ key: `${procedure}-official`, label: `${procedure} Official`, width: procedureWidth }]
              : []),
            ...(columnVisibility.attorneyFee
              ? [{ key: `${procedure}-attorney`, label: `${procedure} Attorney`, width: procedureWidth }]
              : []),
            ...(columnVisibility.total
              ? [{ key: `${procedure}-total`, label: `${procedure} Total`, width: procedureWidth }]
              : []),
          ];
        })
      : []),
    { key: 'grand-total', label: 'Grand Total', width: rowGrandTotalWidth },
  ].map((column, index) => ({ ...column, letter: getExcelColumnLabel(index) }));
  const worksheetGridWidth = worksheetColumns.reduce((total, column) => total + column.width, 0);
  const worksheetGridTemplate = worksheetColumns.map((column) => `${column.width}px`).join(' ');
  const tableMinWidth = Math.max(320, worksheetGridWidth);
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

  const visibleFeeCellTargets = useMemo<ActiveFeeCellTarget[]>(() => {
    if (!showProcedureColumns) return [];

    return pagedCountryRows.flatMap((countryRow, rowIndex) =>
      procedureColumns.flatMap((procedure, procedureIndex) => {
        const rule = countryRow.rulesByProcedure[procedure];
        const worksheetRowNumber = page * rowsPerPage + rowIndex + 2;
        const firstFeeColumnIndex =
          (columnVisibility.country ? 3 : 0) + procedureIndex * visibleFeeColumnCount;
        const targets: ActiveFeeCellTarget[] = [];

        if (columnVisibility.officeFee) {
          targets.push({
            cellName: `${getExcelColumnLabel(firstFeeColumnIndex)}${worksheetRowNumber}`,
            countryKey: countryRow.key,
            procedure,
            field: 'officialFee',
            ruleId: rule?._id,
          });
        }

        if (columnVisibility.attorneyFee) {
          targets.push({
            cellName: `${getExcelColumnLabel(firstFeeColumnIndex + (columnVisibility.officeFee ? 1 : 0))}${worksheetRowNumber}`,
            countryKey: countryRow.key,
            procedure,
            field: 'attorneyFee',
            ruleId: rule?._id,
          });
        }

        return targets;
      })
    );
  }, [
    columnVisibility.attorneyFee,
    columnVisibility.country,
    columnVisibility.officeFee,
    page,
    pagedCountryRows,
    procedureColumns,
    rowsPerPage,
    showProcedureColumns,
    visibleFeeColumnCount,
  ]);

  const sortedVisibleFeeCellTargets = useMemo(
    () =>
      [...visibleFeeCellTargets].sort((a, b) => {
        const aPosition = getCellCoordinates(a.cellName);
        const bPosition = getCellCoordinates(b.cellName);
        if (!aPosition || !bPosition) return a.cellName.localeCompare(b.cellName);
        if (aPosition.row !== bPosition.row) return aPosition.row - bPosition.row;
        return aPosition.column - bPosition.column;
      }),
    [visibleFeeCellTargets]
  );

  const visibleFeeCellByName = useMemo(() => {
    const cells = new Map<string, ActiveFeeCellTarget>();
    visibleFeeCellTargets.forEach((target) => {
      cells.set(target.cellName.toUpperCase(), target);
    });
    return cells;
  }, [visibleFeeCellTargets]);

  const selectedFeeCellKeys = useMemo(
    () => new Set(selectedFeeCells.map((target) => getFeeCellKey(target))),
    [selectedFeeCells]
  );

  const selectedWorksheetColumns = useMemo(
    () =>
      new Set(
        selectedFeeCells
          .map((target) => target.cellName.match(/^[A-Z]+/i)?.[0]?.toUpperCase())
          .filter((value): value is string => Boolean(value))
      ),
    [selectedFeeCells]
  );

  const selectedWorksheetRows = useMemo(
    () =>
      new Set(
        selectedFeeCells
          .map((target) => target.cellName.match(/\d+$/)?.[0])
          .filter((value): value is string => Boolean(value))
      ),
    [selectedFeeCells]
  );

  const getFeeCellTargetValue = (target: ActiveFeeCellTarget) => {
    const countryRow = countryRows.find((row) => row.key === target.countryKey);
    const rule =
      (target.ruleId ? pricingRules.find((item) => item._id === target.ruleId) : null) ||
      countryRow?.rulesByProcedure[target.procedure];

    if (rule) return getFeeValue(rule, target.field);
    return countryRow ? getMissingFeeValue(countryRow, target.procedure, target.field) : '';
  };

  const getTargetsFromRangeLabel = (rangeLabel: string) => {
    const [startCell, endCell] = rangeLabel
      .split(':')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);

    if (!startCell) return [];
    if (!endCell) {
      const target = visibleFeeCellByName.get(startCell);
      return target ? [target] : [];
    }

    return sortedVisibleFeeCellTargets.filter((target) =>
      isCellBetween(target.cellName, startCell, endCell)
    );
  };

  const getFeeTargetsFromFormula = (formula: string) => {
    const references = Array.from(formula.matchAll(/([A-Z]+\d+)(?::([A-Z]+\d+))?/gi));
    const targets = references.flatMap((match) => getTargetsFromRangeLabel(match[2] ? `${match[1]}:${match[2]}` : match[1]));
    const seen = new Set<string>();

    return targets.filter((target) => {
      const key = getFeeCellKey(target);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const getSelectedFormulaValues = (formula = '') => {
    const referencedTargets = formula ? getFeeTargetsFromFormula(formula) : [];
    const targets = referencedTargets.length > 0
      ? referencedTargets
      : selectedFeeCells.length > 0
      ? selectedFeeCells
      : activeFeeCell
        ? [activeFeeCell]
        : [];

    const values = targets
      .map((target) => normalizeNumberInput(getFeeCellTargetValue(target)))
      .filter((value): value is number => value !== null);

    return values.length > 0 ? values : getVisibleFormulaValues();
  };

  const evaluateArithmeticFormula = (formula: string) => {
    if (!formula.startsWith('=')) return null;
    const expression = formula
      .slice(1)
      .replace(/([A-Z]+\d+)/gi, (cellName) => {
        const target = visibleFeeCellByName.get(cellName.toUpperCase());
        const value = target ? normalizeNumberInput(getFeeCellTargetValue(target)) : 0;
        return String(value ?? 0);
      })
      .replace(/,/g, '');

    if (!/^[0-9+\-*/().\s]+$/.test(expression)) return null;

    try {
      // The expression is restricted to numbers and arithmetic operators before evaluation.
      const result = Function(`"use strict"; return (${expression});`)();
      return typeof result === 'number' && Number.isFinite(result) ? result : null;
    } catch {
      return null;
    }
  };

  const normalizeFormulaResultNumber = (result: string) => {
    const trimmed = result.trim();
    if (!trimmed) return null;
    const accountingMatch = trimmed.match(/^\((.+)\)$/);
    const normalized = (accountingMatch ? `-${accountingMatch[1]}` : trimmed)
      .replace(/[$,%\s,]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const selectedRangeLabel = useMemo(() => {
    if (selectedFeeCells.length === 0) return activeCell;
    if (selectedFeeCells.length === 1) return selectedFeeCells[0].cellName;

    const sortedCells = [...selectedFeeCells].sort((a, b) => {
      const aPosition = getCellCoordinates(a.cellName);
      const bPosition = getCellCoordinates(b.cellName);
      if (!aPosition || !bPosition) return a.cellName.localeCompare(b.cellName);
      if (aPosition.row !== bPosition.row) return aPosition.row - bPosition.row;
      return aPosition.column - bPosition.column;
    });

    return `${sortedCells[0].cellName}:${sortedCells[sortedCells.length - 1].cellName}`;
  }, [activeCell, selectedFeeCells]);

  const selectionStats = useMemo(() => {
    const values = selectedFeeCells
      .map((target) => normalizeNumberInput(getFeeCellTargetValue(target)))
      .filter((value): value is number => value !== null);
    const sum = values.reduce((total, value) => total + value, 0);
    const average = values.length ? sum / values.length : 0;

    return { count: selectedFeeCells.length, numericCount: values.length, sum, average };
  }, [selectedFeeCells, editedFees, missingFeeDrafts, pricingRules, countryRows]);

  const pushFeeEditHistory = (
    target: ActiveFeeCellTarget,
    previousValue: string,
    nextValue: string,
    label: string
  ) => {
    if (previousValue === nextValue) return;

    setUndoStack((current) => [
      { id: makeId('fee-edit'), target: { ...target }, previousValue, nextValue, label },
      ...current,
    ].slice(0, 40));
    setRedoStack([]);
    addAudit(label);
  };

  const writeFeeCellTargetValue = async (
    target: ActiveFeeCellTarget,
    value: string,
    options: { save?: boolean; historyLabel?: string; skipHistory?: boolean } = {}
  ) => {
    const previousValue = getFeeCellTargetValue(target);
    const countryRow = countryRows.find((row) => row.key === target.countryKey);
    const rule =
      (target.ruleId ? pricingRules.find((item) => item._id === target.ruleId) : null) ||
      countryRow?.rulesByProcedure[target.procedure];

    if (rule) {
      const officialFee = target.field === 'officialFee' ? value : getFeeValue(rule, 'officialFee');
      const attorneyFee = target.field === 'attorneyFee' ? value : getFeeValue(rule, 'attorneyFee');
      updateFee(rule, target.field, value);
      if (options.save !== false) await saveRuleFees(rule, officialFee, attorneyFee);
    } else if (countryRow) {
      const officialFee = target.field === 'officialFee'
        ? value
        : getMissingFeeValue(countryRow, target.procedure, 'officialFee');
      const attorneyFee = target.field === 'attorneyFee'
        ? value
        : getMissingFeeValue(countryRow, target.procedure, 'attorneyFee');
      updateMissingFee(countryRow, target.procedure, target.field, value);
      if (options.save !== false) await saveMissingRuleFees(countryRow, target.procedure, officialFee, attorneyFee);
    } else {
      setError('The selected fee cell is no longer visible.');
      return;
    }

    if (!options.skipHistory) {
      pushFeeEditHistory(
        target,
        previousValue,
        value,
        options.historyLabel || `Cell Updated: ${target.cellName}`
      );
    }

    setActiveCell(target.cellName);
    setActiveFeeCell(target);
  };

  const undoLastFeeEdit = async () => {
    const [lastEdit, ...remainingUndo] = undoStack;
    if (!lastEdit) {
      showSuccessToast('Nothing to undo');
      return;
    }

    await writeFeeCellTargetValue(lastEdit.target, lastEdit.previousValue, {
      skipHistory: true,
      historyLabel: `Undo: ${lastEdit.label}`,
    });
    setUndoStack(remainingUndo);
    setRedoStack((current) => [lastEdit, ...current].slice(0, 40));
    addAudit(`Undo: ${lastEdit.label}`);
    showSuccessToast(`Undo ${lastEdit.target.cellName}`);
  };

  const redoLastFeeEdit = async () => {
    const [lastEdit, ...remainingRedo] = redoStack;
    if (!lastEdit) {
      showSuccessToast('Nothing to redo');
      return;
    }

    await writeFeeCellTargetValue(lastEdit.target, lastEdit.nextValue, {
      skipHistory: true,
      historyLabel: `Redo: ${lastEdit.label}`,
    });
    setRedoStack(remainingRedo);
    setUndoStack((current) => [lastEdit, ...current].slice(0, 40));
    addAudit(`Redo: ${lastEdit.label}`);
    showSuccessToast(`Redo ${lastEdit.target.cellName}`);
  };

  const selectFeeCell = (target: ActiveFeeCellTarget, extendRange = false) => {
    setActiveCell(target.cellName);
    setActiveFeeCell(target);
    editStartValueRef.current[getFeeCellKey(target)] = getFeeCellTargetValue(target);

    if (extendRange && selectionAnchorCell) {
      const rangeTargets = visibleFeeCellTargets.filter((cellTarget) =>
        isCellBetween(cellTarget.cellName, selectionAnchorCell.cellName, target.cellName)
      );
      setSelectedFeeCells(rangeTargets.length > 0 ? rangeTargets : [target]);
      return;
    }

    setSelectionAnchorCell(target);
    setSelectedFeeCells([target]);
  };

  const commitFeeCellEdit = (target: ActiveFeeCellTarget, nextValue: string) => {
    const targetKey = getFeeCellKey(target);
    const previousValue = editStartValueRef.current[targetKey];
    delete editStartValueRef.current[targetKey];

    if (previousValue !== undefined && previousValue !== nextValue) {
      pushFeeEditHistory(target, previousValue, nextValue, `Cell Edited: ${target.cellName}`);
    }
  };

  const focusFeeCellTarget = (target: ActiveFeeCellTarget, extendRange = false, selectText = false) => {
    selectFeeCell(target, extendRange);
    window.requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(`input[data-fee-cell="${target.cellName}"]`);
      input?.focus();
      if (selectText) input?.select();
    });
  };

  const selectFeeCellByName = (cellName: string, focusCell = true) => {
    const normalizedCell = cellName.trim().toUpperCase();
    const target = visibleFeeCellByName.get(normalizedCell);

    if (!target) {
      setActiveCell(normalizedCell || 'B2');
      setActiveFeeCell(null);
      setSelectedFeeCells([]);
      setSelectionAnchorCell(null);
      setError(normalizedCell ? `${normalizedCell} is not an editable visible fee cell.` : '');
      return;
    }

    setError('');
    if (focusCell) focusFeeCellTarget(target, false, true);
    else selectFeeCell(target);
  };

  const selectFeeColumnByLetter = (letter: string) => {
    const targets = sortedVisibleFeeCellTargets.filter((target) =>
      target.cellName.toUpperCase().startsWith(letter.toUpperCase())
    );
    if (targets.length === 0) return;
    setActiveCell(targets[0].cellName);
    setActiveFeeCell(targets[0]);
    setSelectionAnchorCell(targets[0]);
    setSelectedFeeCells(targets);
    addAudit(`Column Selected: ${letter}`);
  };

  const selectFeeRowByNumber = (rowNumber: number) => {
    const targets = sortedVisibleFeeCellTargets.filter((target) => {
      const position = getCellCoordinates(target.cellName);
      return position?.row === rowNumber - 1;
    });
    if (targets.length === 0) return;
    setActiveCell(targets[0].cellName);
    setActiveFeeCell(targets[0]);
    setSelectionAnchorCell(targets[0]);
    setSelectedFeeCells(targets);
    addAudit(`Row Selected: ${rowNumber}`);
  };

  const getNextFeeCellTarget = (target: ActiveFeeCellTarget, direction: 'up' | 'down' | 'left' | 'right') => {
    const currentPosition = getCellCoordinates(target.cellName);
    if (!currentPosition) return target;

    if (direction === 'left' || direction === 'right') {
      const rowTargets = sortedVisibleFeeCellTargets.filter((cellTarget) => {
        const position = getCellCoordinates(cellTarget.cellName);
        return position?.row === currentPosition.row;
      });
      const currentIndex = rowTargets.findIndex((cellTarget) => getFeeCellKey(cellTarget) === getFeeCellKey(target));
      const nextIndex = currentIndex + (direction === 'right' ? 1 : -1);
      return rowTargets[nextIndex] || target;
    }

    const columnTargets = sortedVisibleFeeCellTargets.filter((cellTarget) => {
      const position = getCellCoordinates(cellTarget.cellName);
      return position?.column === currentPosition.column;
    });
    const currentIndex = columnTargets.findIndex((cellTarget) => getFeeCellKey(cellTarget) === getFeeCellKey(target));
    const nextIndex = currentIndex + (direction === 'down' ? 1 : -1);
    return columnTargets[nextIndex] || target;
  };

  const clearSelectedRange = async () => {
    const targets = selectedFeeCells.length > 0 ? selectedFeeCells : activeFeeCell ? [activeFeeCell] : [];
    if (targets.length === 0) {
      setError('Select fee cells before clearing contents.');
      return;
    }

    for (const target of targets) {
      await writeFeeCellTargetValue(target, '', {
        historyLabel: `Clear Contents: ${target.cellName}`,
      });
    }
    showSuccessToast(`${targets.length} cell${targets.length === 1 ? '' : 's'} cleared`);
  };

  const fillSelectedRangeFromActiveCell = async () => {
    if (!activeFeeCell) {
      setError('Select a source fee cell before using Fill.');
      return;
    }

    const sourceValue = getFeeCellTargetValue(activeFeeCell);
    const activeKey = getFeeCellKey(activeFeeCell);
    const selectedTargets = selectedFeeCells.filter((target) => getFeeCellKey(target) !== activeKey);
    const targets = selectedTargets.length > 0
      ? selectedTargets
      : [getNextFeeCellTarget(activeFeeCell, 'down')].filter((target) => getFeeCellKey(target) !== activeKey);

    if (targets.length === 0) {
      setError('Select another fee cell or range to fill.');
      return;
    }

    for (const target of targets) {
      await writeFeeCellTargetValue(target, sourceValue, {
        historyLabel: `Fill: ${activeFeeCell.cellName} -> ${target.cellName}`,
      });
    }
    showSuccessToast(`Filled ${targets.length} cell${targets.length === 1 ? '' : 's'}`);
  };

  const startFillDrag = (event: React.DragEvent<HTMLElement>, target: ActiveFeeCellTarget) => {
    event.stopPropagation();
    event.dataTransfer.setData('application/x-fee-cell', target.cellName);
    event.dataTransfer.effectAllowed = 'copy';
  };

  const handleFillDrop = async (event: React.DragEvent<HTMLElement>, target: ActiveFeeCellTarget) => {
    const sourceCellName = event.dataTransfer.getData('application/x-fee-cell');
    if (!sourceCellName) return;
    event.preventDefault();
    event.stopPropagation();

    const sourceTarget = visibleFeeCellByName.get(sourceCellName.toUpperCase());
    if (!sourceTarget) return;

    await writeFeeCellTargetValue(target, getFeeCellTargetValue(sourceTarget), {
      historyLabel: `Drag Fill: ${sourceTarget.cellName} -> ${target.cellName}`,
    });
    setSelectedFeeCells([sourceTarget, target]);
    setSelectionAnchorCell(sourceTarget);
    showSuccessToast(`Filled ${target.cellName}`);
  };

  const handleFeeCellKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    target: ActiveFeeCellTarget
  ) => {
    if (event.key === 'Escape') {
      event.currentTarget.blur();
      return;
    }

    if (event.key === 'Delete' && selectedFeeCells.length > 1) {
      event.preventDefault();
      clearSelectedRange();
      return;
    }

    const directionMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };
    const navigationDirection =
      event.key === 'Enter'
        ? event.shiftKey
          ? 'up'
          : 'down'
        : event.key === 'Tab'
          ? event.shiftKey
            ? 'left'
            : 'right'
          : directionMap[event.key];

    if (!navigationDirection) return;

    event.preventDefault();
    const nextTarget = getNextFeeCellTarget(target, navigationDirection);
    event.currentTarget.blur();
    window.setTimeout(() => focusFeeCellTarget(nextTarget, event.shiftKey && event.key.startsWith('Arrow'), true), 0);
  };

  const renderFillHandle = (target: ActiveFeeCellTarget) => (
    <Box
      component="span"
      draggable
      title={`Drag to fill from ${target.cellName}`}
      onDragStart={(event: React.DragEvent<HTMLElement>) => startFillDrag(event, target)}
      onDoubleClick={(event) => {
        event.stopPropagation();
        fillSelectedRangeFromActiveCell();
      }}
      sx={{
        position: 'absolute',
        right: 1,
        bottom: 1,
        width: 8,
        height: 8,
        bgcolor: '#217346',
        border: '1px solid #FFFFFF',
        boxShadow: '0 0 0 1px #217346',
        cursor: 'crosshair',
        zIndex: 6,
      }}
    />
  );

  const procedureGrandTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    procedureColumns.forEach((procedure) => {
      totals[procedure] = 0;
    });

    countryRows.forEach((countryRow) => {
      procedureColumns.forEach((procedure) => {
        const rule = countryRow.rulesByProcedure[procedure];
        const total = rule ? getRowTotal(rule) : null;
        if (total !== null) totals[procedure] += total;
      });
    });

    return totals;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryRows, editedFees, procedureColumns]);

  const grandTotalAmount = useMemo(
    () => Object.values(procedureGrandTotals).reduce((total, amount) => total + amount, 0),
    [procedureGrandTotals]
  );

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
    const rowGrandTotalHeaderHtml = `
      <th class="main-header row-grand-total-header group-end" rowspan="${showProcedureColumns ? 2 : 1}" style="width:${rowGrandTotalWidth}px">
        Grand Total<br>(US$)
      </th>`;

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
        const rowGrandTotal = getCountryGrandTotal(countryRow);
        const feeCells = showProcedureColumns
          ? procedureColumns
              .map((procedure) => {
                const rule = countryRow.rulesByProcedure[procedure];
                const total = rule ? getRowTotal(rule) : null;
                const official = escapeHtml(rule ? getFeeValue(rule, 'officialFee') : getMissingFeeValue(countryRow, procedure, 'officialFee'));
                const attorney = escapeHtml(rule ? getFeeValue(rule, 'attorneyFee') : getMissingFeeValue(countryRow, procedure, 'attorneyFee'));
                const missingTotal = rule ? null : getMissingRowTotal(countryRow, procedure);
                const totalText = rule ? (total === null ? '-' : formatSheetNumber(total)) : (missingTotal === null ? '-' : formatSheetNumber(missingTotal));
                const totalBackground = getTotalCellBackground(rule ? total : missingTotal);
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
                  ${columnVisibility.total ? `<td class="fee-cell total-cell group-end" style="width:${procedureWidth}px; background:${totalBackground}">${escapeHtml(totalText)}</td>` : ''}
                `;
              })
              .join('')
          : '';

        return `
          <tr style="background:${rowBackground}; height:${currentRowHeight}px">
            ${
              columnVisibility.country
                ? `
                  <td class="row-number" style="width:${rowNumberWidth}px">${rowIndex + 2}</td>
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
            <td class="fee-cell total-cell row-grand-total-cell group-end" style="width:${rowGrandTotalWidth}px; background:${getTotalCellBackground(rowGrandTotal)}">${formatSheetNumber(rowGrandTotal)}</td>
          </tr>
        `;
      })
      .join('');
    const grandTotalHtml =
      countryRows.length > 0
        ? `
          <tr class="grand-total-row">
            ${
              columnVisibility.country
                ? `<td class="grand-total-label group-end" colspan="3">Grand Total: ${formatSheetNumber(grandTotalAmount)}</td>`
                : ''
            }
            ${
              showProcedureColumns
                ? procedureColumns
                    .map((procedure) => {
                      const procedureWidth = getProcedureColumnWidth(procedure);
                      return `
                        ${
                          columnVisibility.officeFee
                            ? `<td class="grand-total-empty ${lastVisibleFeeColumn === 'officialFee' ? 'group-end' : ''}" style="width:${procedureWidth}px"></td>`
                            : ''
                        }
                        ${
                          columnVisibility.attorneyFee
                            ? `<td class="grand-total-empty ${lastVisibleFeeColumn === 'attorneyFee' ? 'group-end' : ''}" style="width:${procedureWidth}px"></td>`
                            : ''
                        }
                        ${
                          columnVisibility.total
                            ? `<td class="grand-total-cell group-end" style="width:${procedureWidth}px">${formatSheetNumber(procedureGrandTotals[procedure] || 0)}</td>`
                            : ''
                        }
                      `;
                    })
                    .join('')
                : ''
            }
            <td class="grand-total-cell row-grand-total-cell group-end" style="width:${rowGrandTotalWidth}px">${formatSheetNumber(grandTotalAmount)}</td>
          </tr>
        `
        : '';

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
        border: ${showGridlines ? '2px solid #111827' : '0'};
        color: ${fontColor};
        font-family: ${cssFontFamily};
      }
      th,
      td {
        border: ${showGridlines ? '1px solid #1F2937' : '0'};
        color: ${fontColor};
        font-family: ${cssFontFamily};
        height: ${rowHeight}px;
        line-height: 1.05;
        padding: 0 3px;
        text-align: ${textAlign};
        vertical-align: ${verticalAlign};
        white-space: ${wrapText ? 'normal' : 'nowrap'};
        font-size: ${fontSize}px;
        font-weight: ${boldText ? 900 : 500};
        font-style: ${italicText ? 'italic' : 'normal'};
        text-decoration: ${underlineText ? 'underline' : 'none'};
        padding-left: ${3 + indentLevel * 8}px;
      }
      th {
        font-weight: 900;
      }
      .main-header {
        background: ${excelHeaderColor};
        height: 31px;
        font-size: ${fontSize}px;
      }
      .country-header {
        height: 74px;
      }
      .sub-header {
        background: ${excelSubHeaderColor};
        height: 43px;
        font-size: ${fontSize}px;
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
        border: ${showGridlines ? '1px solid #1F2937' : '0'};
        vertical-align: middle;
      }
      .group-end {
        border-right: ${showGridlines ? '2px solid #111827' : '0'};
      }
      .total-cell {
        background: ${highlightColor};
      }
      .row-grand-total-header {
        background: ${excelHeaderColor};
      }
      .row-grand-total-cell {
        background: ${highlightColor};
        font-weight: 900;
      }
      .grand-total-row td {
        background: ${highlightColor};
        font-weight: 900;
        border-top: ${showGridlines ? '2px solid #111827' : '0'};
      }
      .grand-total-label {
        text-align: left;
      }
      .grand-total-cell {
        text-align: center;
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
          ${rowGrandTotalHeaderHtml}
        </tr>
        ${showProcedureColumns ? `<tr>${feeHeaderHtml}</tr>` : ''}
      </thead>
      <tbody>
        ${bodyHtml || `<tr><td colspan="${visibleColumnCount}">No pricing rules found.</td></tr>`}
        ${grandTotalHtml}
      </tbody>
    </table>
  </body>
</html>`;
  }

  const workbookTitle = activeDraftId && draftName ? `${draftName} - Excel` : 'Workbook - Excel';
  const shellBg = darkMode ? '#0B1F17' : '#F3F6F4';
  const gridBg = darkMode ? '#10251D' : '#FFFFFF';
  const panelBg = darkMode ? '#173326' : '#FFFFFF';
  const ribbonBorder = darkMode ? '#2D5E45' : '#D7DDE7';
  const statusText = loading
    ? 'Calculating...'
    : `${countryRows.length} row${countryRows.length === 1 ? '' : 's'} | ${procedureColumns.length} procedure${procedureColumns.length === 1 ? '' : 's'} | ${tableMode === 'all' ? 'All fees' : 'Quotation table'}`;
  const renderRibbonButton = (
    label: string,
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void,
    options: { disabled?: boolean; title?: string } = {}
  ) => (
    <Button
      key={label}
      size="small"
      variant="text"
      onClick={onClick}
      disabled={options.disabled}
      title={options.title || label}
      sx={{
        minWidth: 0,
        px: 0.9,
        py: 0.45,
        color: options.disabled ? (darkMode ? '#6B8B77' : '#94A3B8') : darkMode ? '#E5F3EA' : '#1F2937',
        borderRadius: 0.75,
        fontSize: 12,
        textTransform: 'none',
        '&:hover': { bgcolor: darkMode ? 'rgba(255,255,255,0.10)' : '#E8F3EC' },
      }}
    >
      {label}
    </Button>
  );
  const renderRibbonGroup = (title: string, children: React.ReactNode) => (
    <Box
      key={title}
      sx={{
        px: 1,
        py: 0.75,
        borderRight: `1px solid ${ribbonBorder}`,
        minHeight: 88,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 0.65,
      }}
    >
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>{children}</Box>
      <Typography sx={{ color: darkMode ? '#B8D8C4' : '#64748B', fontSize: 11, textAlign: 'center' }}>
        {title}
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: shellBg }}>
      <Topbar title="Workbook - Excel" />

      <Box sx={{ p: { xs: 1.25, md: 2 }, bgcolor: shellBg }}>
        <Paper
          sx={{
            borderRadius: 1.5,
            overflow: 'hidden',
            border: `1px solid ${darkMode ? '#174B32' : '#C9D4CE'}`,
            boxShadow: '0 18px 40px rgba(15, 23, 42, 0.14)',
            bgcolor: panelBg,
          }}
        >
          <Box sx={{ bgcolor: '#217346', color: '#FFFFFF' }}>
            <Box
              sx={{
                minHeight: 42,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'auto 1fr auto' },
                alignItems: 'center',
                gap: 1,
                px: 1.25,
                py: 0.6,
              }}
            >
              <Stack direction="row" spacing={0.35} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                {renderRibbonButton('Save', openSaveDraftDialog)}
                {renderRibbonButton('Undo', undoLastFeeEdit, {
                  disabled: undoStack.length === 0,
                  title: undoStack[0] ? `Undo ${undoStack[0].label}` : 'No fee edit to undo',
                })}
                {renderRibbonButton('Redo', redoLastFeeEdit, {
                  disabled: redoStack.length === 0,
                  title: redoStack[0] ? `Redo ${redoStack[0].label}` : 'No fee edit to redo',
                })}
                {renderRibbonButton('Print', openPrintView)}
                {renderRibbonButton('Share', copyWorkbookLink)}
              </Stack>
              <Typography sx={{ fontWeight: 800, textAlign: 'center', fontSize: 14 }}>
                {workbookTitle}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                <Button
                  size="small"
                  onClick={() => setDarkMode((current) => !current)}
                  sx={{ color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.35)', textTransform: 'none' }}
                  variant="outlined"
                >
                  {darkMode ? 'Light Mode' : 'Dark Mode'}
                </Button>
                <Box sx={{ px: 1, py: 0.35, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.16)', fontSize: 12, fontWeight: 800 }}>
                  {user?.name || user?.email || 'User'}
                </Box>
              </Stack>
            </Box>
          </Box>

          <Box sx={{ bgcolor: panelBg, borderBottom: `1px solid ${ribbonBorder}` }}>
            <Stack
              direction="row"
              spacing={0}
              sx={{
                px: 0.5,
                pt: 0.35,
                borderBottom: `1px solid ${ribbonBorder}`,
                overflowX: 'auto',
              }}
            >
              {EXCEL_RIBBON_TABS.map((tabLabel) => (
                <Button
                  key={tabLabel}
                  size="small"
                  onClick={() => setActiveRibbonTab(tabLabel)}
                  sx={{
                    minWidth: 0,
                    px: 1.4,
                    py: 0.65,
                    borderRadius: '6px 6px 0 0',
                    color: activeRibbonTab === tabLabel ? '#217346' : darkMode ? '#D6E9DD' : '#334155',
                    bgcolor: activeRibbonTab === tabLabel ? (darkMode ? '#10251D' : '#FFFFFF') : 'transparent',
                    fontWeight: activeRibbonTab === tabLabel ? 900 : 700,
                    textTransform: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tabLabel}
                </Button>
              ))}
            </Stack>

            <Box sx={{ display: 'flex', gap: 0, overflowX: 'auto', bgcolor: darkMode ? '#10251D' : '#FFFFFF' }}>
              {activeRibbonTab === 'Home' && (
                <>
                  {renderRibbonGroup('Clipboard', (
                    <>
                      {renderRibbonButton('Paste', pasteActiveCell)}
                      {renderRibbonButton('Cut', cutActiveCell)}
                      {renderRibbonButton('Copy', copyActiveCellOrWorkbook)}
                      {renderRibbonButton('Fill Down', fillSelectedRangeFromActiveCell)}
                      {renderRibbonButton('Clear', clearSelectedRange)}
                      {renderRibbonButton('Format Painter', () => applyStylePreset('legal'))}
                      {renderRibbonButton('Import', () => importInputRef.current?.click())}
                      {renderRibbonButton('Export', (event) => setExportAnchor(event.currentTarget))}
                    </>
                  ))}
                  {renderRibbonGroup('Font', (
                    <>
                      <FormControl size="small" sx={{ minWidth: 150 }}>
                        <Select value={fontFamily} onChange={(event) => setFontFamily(event.target.value)} displayEmpty>
                          {FONT_OPTIONS.map((font) => (
                            <MenuItem key={font} value={font}>{font}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <TextField
                        size="small"
                        type="number"
                        value={fontSize}
                        slotProps={{ input: { inputProps: { min: 8, max: 32, step: 1 } } }}
                        onChange={(event) => setFontSize(Math.max(8, Math.min(32, Number(event.target.value) || DEFAULT_FONT_SIZE)))}
                        sx={{ width: 70 }}
                      />
                      {renderRibbonButton('A+', () => setFontSize((current) => Math.min(32, current + 1)))}
                      {renderRibbonButton('A-', () => setFontSize((current) => Math.max(8, current - 1)))}
                      {renderRibbonButton('Bold', () => setBoldText((current) => !current))}
                      {renderRibbonButton('Italic', () => setItalicText((current) => !current))}
                      {renderRibbonButton('Underline', () => setUnderlineText((current) => !current))}
                      <TextField size="small" type="color" value={fontColor} onChange={(event) => setFontColor(event.target.value)} sx={{ width: 48 }} />
                      <TextField size="small" type="color" value={highlightColor} onChange={(event) => setHighlightColor(event.target.value)} sx={{ width: 48 }} />
                      {renderRibbonButton('Borders', () => setShowGridlines((current) => !current))}
                    </>
                  ))}
                  {renderRibbonGroup('Alignment', (
                    <>
                      {renderRibbonButton('Align Left', () => setTextAlign('left'))}
                      {renderRibbonButton('Center', () => setTextAlign('center'))}
                      {renderRibbonButton('Align Right', () => setTextAlign('right'))}
                      {renderRibbonButton('Top Align', () => setVerticalAlign('top'))}
                      {renderRibbonButton('Middle Align', () => setVerticalAlign('middle'))}
                      {renderRibbonButton('Bottom Align', () => setVerticalAlign('bottom'))}
                      {renderRibbonButton('Wrap Text', () => setWrapText((current) => !current))}
                      {renderRibbonButton('Merge & Center', () => {
                        setTextAlign('center');
                        setWrapText(false);
                        showSuccessToast('Merged headers centered');
                      })}
                      {renderRibbonButton('Indent +', () => setIndentLevel((current) => Math.min(8, current + 1)))}
                      {renderRibbonButton('Indent -', () => setIndentLevel((current) => Math.max(0, current - 1)))}
                    </>
                  ))}
                  {renderRibbonGroup('Number', (
                    <>
                      {renderRibbonButton('General', () => setNumberFormat('general'))}
                      {renderRibbonButton('Currency', () => setNumberFormat('currency'))}
                      {renderRibbonButton('Percentage', () => setNumberFormat('percentage'))}
                      {renderRibbonButton('Decimal +', () => setDecimalPlaces((current) => Math.min(6, current + 1)))}
                      {renderRibbonButton('Decimal -', () => setDecimalPlaces((current) => Math.max(0, current - 1)))}
                      {renderRibbonButton('Accounting', () => setNumberFormat('accounting'))}
                    </>
                  ))}
                  {renderRibbonGroup('Styles', (
                    <>
                      {renderRibbonButton('Conditional Formatting', () => setConditionalFormatting((current) => !current))}
                      {renderRibbonButton('Format as Table', (event) => setAdvancedAnchor(event.currentTarget))}
                      {renderRibbonButton('Cell Styles', () => applyStylePreset('excel'))}
                    </>
                  ))}
                  {renderRibbonGroup('Workbook', (
                    <>
                      {renderRibbonButton('Add to Quotation', openSelectionDialog)}
                      {renderRibbonButton('All Fees', () => showAllFeeTable())}
                      {tableMode === 'quotation' && selectedRuleIds.length > 0 && renderRibbonButton('Clear Table', clearQuotationSelection)}
                      {renderRibbonButton('Save Draft', openSaveDraftDialog)}
                      {renderRibbonButton('New Sheet', createNewDraft)}
                      <Button size="small" component={Link} href="/reports/fee-builder/drafts" sx={{ textTransform: 'none' }}>Saved Drafts</Button>
                    </>
                  ))}
                </>
              )}
              {activeRibbonTab === 'Formulas' && (
                <>
                  {renderRibbonGroup('Function Library', (
                    <>
                      {renderRibbonButton('Insert Function (fx)', acceptFormula)}
                      {renderRibbonButton('Apply Result', applyFormulaResultToActiveCell)}
                      {renderRibbonButton('AutoSum', () => {
                        const formula = `=SUM(${selectedRangeLabel})`;
                        const result = evaluateFormula(formula);
                        setFormulaInput(formula);
                        setFormulaResult(result);
                        addAudit(`AutoSum: ${selectedRangeLabel}`);
                      })}
                      {renderRibbonButton('Financial', () => insertFormula(`=SUM(${selectedRangeLabel})`))}
                      {renderRibbonButton('Logical', () => insertFormula(DEFAULT_FORMULA_TEXT))}
                      {renderRibbonButton('Text', () => insertFormula(`=TEXTJOIN(", ",TRUE,${selectedRangeLabel})`))}
                      {renderRibbonButton('Date & Time', () => insertFormula('=TODAY()'))}
                      {renderRibbonButton('Lookup & Reference', () => insertFormula(`=${selectedRangeLabel}`))}
                      {renderRibbonButton('Math & Trig', () => insertFormula(`=MAX(${selectedRangeLabel})`))}
                    </>
                  ))}
                  {renderRibbonGroup('Formula Auditing', (
                    <>
                      {renderRibbonButton('Trace Precedents', () => showSuccessToast(`${selectedRangeLabel} uses ${selectionStats.numericCount || getSelectedFormulaValues().length} fee input${(selectionStats.numericCount || getSelectedFormulaValues().length) === 1 ? '' : 's'}`))}
                      {renderRibbonButton('Trace Dependents', () => showSuccessToast(`${selectedRangeLabel} feeds procedure totals and grand totals`))}
                      {renderRibbonButton('Show Formulas', () => setFormulaInput(`=SUM(${selectedRangeLabel})`))}
                      {renderRibbonButton('Error Checking', validateWorksheet)}
                      {renderRibbonButton('Evaluate Formula', acceptFormula)}
                      {renderRibbonButton('Watch Window', () => {
                        const watchedSum = selectionStats.count > 0 ? selectionStats.sum : grandTotalAmount;
                        setFormulaResult(`Range ${selectedRangeLabel}: Sum ${formatSheetNumber(watchedSum)}`);
                      })}
                    </>
                  ))}
                  {renderRibbonGroup('Common Functions', (
                    <>
                      {['SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN'].map((label) =>
                        renderRibbonButton(`${label}()`, () => insertFormula(`=${label}(${selectedRangeLabel})`))
                      )}
                      {['IF()', 'IFERROR()', 'VLOOKUP()', 'XLOOKUP()', 'INDEX()', 'MATCH()', 'CONCAT()', 'TEXTJOIN()', 'TODAY()', 'NOW()'].map((label) =>
                        renderRibbonButton(label, () => insertFormula(label === 'TODAY()' || label === 'NOW()' ? `=${label}` : `=${label}`))
                      )}
                    </>
                  ))}
                </>
              )}
              {activeRibbonTab === 'Data' && (
                <>
                  {renderRibbonGroup('Sort & Filter', (
                    <>
                      <TextField
                        size="small"
                        placeholder="Search workbook"
                        value={search}
                        onChange={(event) => {
                          setSearch(event.target.value);
                          setPage(0);
                        }}
                        sx={{ minWidth: 210 }}
                      />
                      <FormControl size="small" sx={{ minWidth: 130 }}>
                        <Select
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
                      {renderRibbonButton('Sort Asc', () => sortWorksheetRows('asc'))}
                      {renderRibbonButton('Sort Desc', () => sortWorksheetRows('desc'))}
                      {renderRibbonButton('Filter Dropdowns', () => setShowFilterDropdowns((current) => !current))}
                    </>
                  ))}
                  {renderRibbonGroup('Connections', (
                    <>
                      <FormControl size="small" sx={{ minWidth: 170 }}>
                        <Select
                          value={selectedCountry}
                          onChange={(event) => {
                            setSelectedCountry(event.target.value);
                            setSelectedRuleIds([]);
                            setSelectedProcedure('');
                            setPage(0);
                            setRowOrder([]);
                            setColumnOrder([]);
                            setHiddenRowKeys([]);
                            setHiddenProcedureColumns([]);
                          }}
                          displayEmpty
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
                        <Select
                          value={selectedService}
                          onChange={(event) => {
                            setSelectedService(event.target.value as ServiceKey);
                            setSelectedRuleIds([]);
                            setSelectedProcedure('');
                            setPage(0);
                            setRowOrder([]);
                            setColumnOrder([]);
                            setHiddenRowKeys([]);
                            setHiddenProcedureColumns([]);
                          }}
                        >
                          {SERVICES.map((service) => (
                            <MenuItem key={service} value={service}>{service}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {renderRibbonButton('Data Validation', validateWorksheet)}
                      {renderRibbonButton('Refresh', refreshWorksheet)}
                    </>
                  ))}
                </>
              )}
              {!['Home', 'Formulas', 'Data'].includes(activeRibbonTab) && (
                <>
                  {renderRibbonGroup(activeRibbonTab, (
                    <>
                      {activeRibbonTab === 'Insert' && (
                        <>
                          {renderRibbonButton('Insert Row', openSelectionDialog)}
                          {renderRibbonButton('New Sheet', createNewDraft)}
                          {renderRibbonButton('Insert From CSV', () => importInputRef.current?.click())}
                          {renderRibbonButton('Export Table', (event) => setExportAnchor(event.currentTarget))}
                        </>
                      )}
                      {activeRibbonTab === 'Draw' && (
                        <>
                          {renderRibbonButton('Legal Style', () => applyStylePreset('legal'))}
                          {renderRibbonButton('Excel Style', () => applyStylePreset('excel'))}
                          {renderRibbonButton('Soft Style', () => applyStylePreset('soft'))}
                          {renderRibbonButton('Gridlines', () => setShowGridlines((current) => !current))}
                        </>
                      )}
                      {activeRibbonTab === 'Page Layout' && (
                        <>
                          {renderRibbonButton('Portrait', () => setPrintOrientation('portrait'))}
                          {renderRibbonButton('Landscape', () => setPrintOrientation('landscape'))}
                          {renderRibbonButton('A4', () => setPaperFormat('A4'))}
                          {renderRibbonButton('A3', () => setPaperFormat('A3'))}
                          {renderRibbonButton('Print Area', openPrintView)}
                        </>
                      )}
                      {activeRibbonTab === 'Review' && (
                        <>
                          {renderRibbonButton('Check Fees', validateWorksheet)}
                          {renderRibbonButton('Audit Log', (event) => setAdvancedAnchor(event.currentTarget))}
                          {renderRibbonButton('Protect Sheet', () => showSuccessToast('Draft is protected by your account permissions'))}
                          {renderRibbonButton('Trace Selection', () => setFormulaResult(`${selectedRangeLabel}: ${selectionStats.numericCount} numeric cell${selectionStats.numericCount === 1 ? '' : 's'}, sum ${formatSheetNumber(selectionStats.sum)}`))}
                          {renderRibbonButton('Comments', () => setFormulaResult(`Last action: ${auditLog[0]?.action || 'No audit entries yet'}`))}
                        </>
                      )}
                      {activeRibbonTab === 'View' && (
                        <>
                          {renderRibbonButton('Workbook View', () => setDarkMode(false))}
                          {renderRibbonButton('Dark View', () => setDarkMode(true))}
                          {renderRibbonButton('Freeze Panes', () => setFreezeHeaders((current) => !current))}
                          {renderRibbonButton('Gridlines', () => setShowGridlines((current) => !current))}
                          {renderRibbonButton('Zoom 100%', () => setZoomLevel(100))}
                        </>
                      )}
                      {activeRibbonTab === 'Help' && (
                        <>
                          {renderRibbonButton('Keyboard Shortcuts', () => setFormulaResult('Ctrl+S save, Ctrl+P print, Enter/Tab/Arrow keys move cells, Shift+Arrow selects ranges, Delete clears ranges'))}
                          {renderRibbonButton('Formula Help', () => setFormulaInput(DEFAULT_FORMULA_TEXT))}
                          {renderRibbonButton('Saved Drafts', () => {
                            if (typeof window !== 'undefined') window.location.href = '/reports/fee-builder/drafts';
                          })}
                          {renderRibbonButton('Share Workbook', copyWorkbookLink)}
                        </>
                      )}
                    </>
                  ))}
                  {renderRibbonGroup('Layout Tools', (
                    <>
                      <TextField size="small" type="number" label="Row" value={rowHeight} onChange={(event) => applyRowHeightToVisible(Number(event.target.value) || DEFAULT_ROW_HEIGHT)} sx={{ width: 92 }} />
                      <TextField size="small" type="number" label="Column" value={columnWidth} onChange={(event) => applyColumnWidthToVisible(Number(event.target.value) || DEFAULT_COLUMN_WIDTH)} sx={{ width: 100 }} />
                      <TextField size="small" type="number" label="Flag W" value={flagWidth} onChange={(event) => setFlagWidth(Math.max(16, Number(event.target.value) || DEFAULT_FLAG_WIDTH))} sx={{ width: 94 }} />
                      <TextField size="small" type="number" label="Flag H" value={flagHeight} onChange={(event) => setFlagHeight(Math.max(10, Number(event.target.value) || DEFAULT_FLAG_HEIGHT))} sx={{ width: 94 }} />
                    </>
                  ))}
                </>
              )}
            </Box>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '92px auto 1fr auto' },
              gap: 0.75,
              alignItems: 'center',
              px: 1,
              py: 0.7,
              bgcolor: darkMode ? '#0F241B' : '#F8FAFC',
              borderBottom: `1px solid ${ribbonBorder}`,
            }}
          >
            <TextField
              size="small"
              value={activeCell}
              onChange={(event) => {
                setActiveCell(event.target.value.toUpperCase());
              }}
              onBlur={(event) => selectFeeCellByName(event.target.value, false)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  selectFeeCellByName((event.target as HTMLInputElement).value, true);
                }
              }}
              placeholder="B2"
              sx={{ '& .MuiInputBase-input': { py: 0.65, fontWeight: 800, textAlign: 'center' } }}
            />
            <Stack direction="row" spacing={0.4}>
              <Button size="small" variant="outlined" onClick={cancelFormula} sx={{ minWidth: 34 }}>x</Button>
              <Button size="small" variant="outlined" onClick={acceptFormula} sx={{ minWidth: 34 }}>OK</Button>
              <Button size="small" variant="outlined" onClick={applyFormulaResultToActiveCell} sx={{ minWidth: 48 }}>Apply</Button>
              <Button size="small" variant="outlined" onClick={() => setActiveRibbonTab('Formulas')} sx={{ minWidth: 42, fontStyle: 'italic' }}>fx</Button>
            </Stack>
            <TextField
              size="small"
              value={formulaInput}
              onChange={(event) => setFormulaInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') acceptFormula();
                if (event.key === 'Escape') cancelFormula();
              }}
              sx={{ '& .MuiInputBase-input': { py: 0.65, fontFamily: 'Consolas, monospace' } }}
            />
            <Typography sx={{ fontSize: 12, color: darkMode ? '#CFE7D7' : '#475569', whiteSpace: 'nowrap' }}>
              Result: {formulaResult}
            </Typography>
            <Typography sx={{ fontSize: 11.5, color: darkMode ? '#A8CDB5' : '#64748B', gridColumn: { xs: '1 / -1', md: '3 / -1' } }}>
              Range {selectedRangeLabel} | Cells {selectionStats.count || 1} | Numeric {selectionStats.numericCount || 0} | Sum {formatSheetNumber(selectionStats.sum)} | Avg {formatSheetNumber(selectionStats.average)}
            </Typography>
          </Box>

          {error && (
            <Alert severity="warning" onClose={() => setError('')} sx={{ borderRadius: 0 }}>
              {error}
            </Alert>
          )}

          {tableMode === 'quotation' && selectedRuleIds.length > 0 && (
            <Alert
              severity="info"
              action={
                <Button color="inherit" size="small" onClick={() => showAllFeeTable()}>
                  All Fees
                </Button>
              }
              sx={{ borderRadius: 0 }}
            >
              Showing {selectedRuleIds.length} selected pricing rule{selectedRuleIds.length === 1 ? '' : 's'} for this quotation table.
            </Alert>
          )}

          {tableMode === 'quotation' && selectedRuleIds.length === 0 && (
            <Alert
              severity="info"
              action={
                <Button color="inherit" size="small" onClick={openSelectionDialog}>
                  Add to Quotation
                </Button>
              }
              sx={{ borderRadius: 0 }}
            >
              This draft table is empty. Add only the fees needed for the quotation.
            </Alert>
          )}

          {(hiddenCountryRows.length > 0 || hiddenProcedureColumnNames.length > 0) && (
            <Box sx={{ p: 1.25, borderBottom: '1px solid #D7DDE7', bgcolor: '#FFF7ED' }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1}
                sx={{ alignItems: { xs: 'stretch', md: 'center' }, flexWrap: 'wrap' }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: 900, color: '#7C2D12' }}>
                  Removed from table
                </Typography>
                {hiddenCountryRows.length > 0 && (
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.75 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#9A3412' }}>Rows:</Typography>
                    {hiddenCountryRows.map((row) => (
                      <Button
                        key={row.key}
                        size="small"
                        variant="outlined"
                        onClick={() => restoreCountryRow(row.key)}
                        sx={{ bgcolor: '#FFFFFF', borderColor: '#FDBA74', color: '#7C2D12' }}
                      >
                        Add {row.countryName}
                      </Button>
                    ))}
                  </Stack>
                )}
                {hiddenProcedureColumnNames.length > 0 && (
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.75 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#9A3412' }}>Columns:</Typography>
                    {hiddenProcedureColumnNames.map((procedure) => (
                      <Button
                        key={procedure}
                        size="small"
                        variant="outlined"
                        onClick={() => restoreProcedureColumn(procedure)}
                        sx={{ bgcolor: '#FFFFFF', borderColor: '#FDBA74', color: '#7C2D12' }}
                      >
                        Add {procedure}
                      </Button>
                    ))}
                  </Stack>
                )}
                <Button size="small" variant="contained" onClick={restoreAllRemovedItems}>
                  Add All Back
                </Button>
              </Stack>
            </Box>
          )}

          <Box
            sx={{
              bgcolor: gridBg,
              borderTop: `1px solid ${ribbonBorder}`,
              borderBottom: `1px solid ${ribbonBorder}`,
              overflow: 'hidden',
            }}
          >
            <Box sx={{ overflowX: 'auto' }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: worksheetGridTemplate,
                  width: worksheetGridWidth,
                  minWidth: worksheetGridWidth,
                  bgcolor: darkMode ? '#173326' : '#F3F6F4',
                  borderBottom: `1px solid ${ribbonBorder}`,
                }}
              >
                {worksheetColumns.map((column) => (
                  <Box
                    key={column.key}
                    title={column.label}
                    onClick={() => selectFeeColumnByLetter(column.letter)}
                    sx={{
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRight: `1px solid ${ribbonBorder}`,
                      bgcolor: selectedWorksheetColumns.has(column.letter)
                        ? darkMode
                          ? '#2F6B49'
                          : '#D9EAD3'
                        : 'transparent',
                      color: selectedWorksheetColumns.has(column.letter) ? '#14532D' : darkMode ? '#D8EBDD' : '#334155',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    {column.letter}
                  </Box>
                ))}
              </Box>

              <TableContainer
                onContextMenu={(event) => {
                  event.preventDefault();
                  setCellContextMenu({ mouseX: event.clientX + 2, mouseY: event.clientY - 6 });
                }}
                sx={{
                  maxHeight: 'calc(100vh - 360px)',
                  width: worksheetGridWidth,
                  bgcolor: gridBg,
                  overflowX: 'visible',
                  overflowY: 'auto',
                  cursor: 'cell',
                  '& input:focus': {
                    outline: '2px solid #217346 !important',
                    outlineOffset: '-2px',
                    backgroundColor: darkMode ? 'rgba(33, 115, 70, 0.14)' : 'rgba(33, 115, 70, 0.08)',
                  },
                }}
            >
              <Table
              stickyHeader={freezeHeaders}
              size="small"
              sx={{
                minWidth: Math.max(320, tableMinWidth),
                borderCollapse: 'collapse',
                tableLayout: 'fixed',
                fontFamily,
                border: showGridlines ? '2px solid #111827' : '0',
                '& th': {
                  color: fontColor,
                  fontFamily,
                  fontSize,
                  fontWeight: 900,
                  border: showGridlines ? '1px solid #111827' : '0',
                  lineHeight: 1.05,
                  px: 0.4,
                  py: 0.45,
                  whiteSpace: wrapText ? 'normal' : 'nowrap',
                  textAlign: 'center',
                  verticalAlign,
                },
                '& td': {
                  fontFamily,
                  fontSize,
                  color: fontColor,
                  border: showGridlines ? '1px solid #1F2937' : '0',
                  py: 0,
                  height: rowHeight,
                  lineHeight: 1.1,
                  fontWeight: boldText ? 900 : 500,
                  fontStyle: italicText ? 'italic' : 'normal',
                  textDecoration: underlineText ? 'underline' : 'none',
                  textAlign,
                  verticalAlign,
                  whiteSpace: wrapText ? 'normal' : 'nowrap',
                  pl: `${indentLevel * 8}px`,
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
                      Country {showFilterDropdowns ? 'v' : ''}
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
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 0.5,
                            minWidth: 0,
                          }}
                        >
                          <Typography
                            component="span"
                            sx={{
                              fontSize: 13,
                              fontWeight: 900,
                              lineHeight: 1.05,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {procedure}{showFilterDropdowns ? ' v' : ''}
                          </Typography>
                          <Box
                            component="button"
                            type="button"
                            title={`Remove ${procedure} column`}
                            onMouseDown={(event) => event.stopPropagation()}
                            onDragStart={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              removeProcedureColumn(procedure);
                            }}
                            sx={{
                              border: '1px solid rgba(127, 29, 29, 0.35)',
                              bgcolor: '#FEE2E2',
                              color: '#991B1B',
                              borderRadius: 0.75,
                              cursor: 'pointer',
                              fontSize: 11,
                              fontWeight: 900,
                              lineHeight: 1,
                              minWidth: 18,
                              height: 18,
                              px: 0.4,
                              '&:hover': {
                                bgcolor: '#FCA5A5',
                              },
                            }}
                          >
                            x
                          </Box>
                        </Box>
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
                  <TableCell
                    rowSpan={showProcedureColumns ? 2 : 1}
                    sx={{
                      width: rowGrandTotalWidth,
                      height: 74,
                      bgcolor: excelHeaderColor,
                      borderRight: '2px solid #111827',
                      fontSize: 13,
                      verticalAlign: 'middle',
                    }}
                  >
                    Grand Total<br />(US$)
                  </TableCell>
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
                            Official{showFilterDropdowns ? ' v' : ''}<br />Fees (US$)
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
                            Attorney{showFilterDropdowns ? ' v' : ''}<br />Fees (US$)
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
                            TOTAL{showFilterDropdowns ? ' v' : ''}<br />(US$)
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
                  const rowGrandTotal = getCountryGrandTotal(countryRow);
                  const worksheetRowNumber = page * rowsPerPage + rowIndex + 2;
                  const rowSelected = selectedWorksheetRows.has(String(worksheetRowNumber));

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
                            onClick={() => selectFeeRowByNumber(worksheetRowNumber)}
                            sx={{
                              width: rowNumberWidth,
                              px: 0.25,
                              textAlign: 'center',
                              fontWeight: 900,
                              fontSize: 12,
                              position: 'relative',
                              bgcolor: rowSelected ? '#D9EAD3 !important' : undefined,
                              cursor: 'pointer',
                              userSelect: 'none',
                            }}
                          >
                            {worksheetRowNumber}
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
                            <Stack
                              direction="row"
                              spacing={0.75}
                              sx={{ alignItems: 'center', justifyContent: 'space-between', minWidth: 0 }}
                            >
                              <Typography
                                sx={{
                                  fontSize: 13,
                                  fontWeight: 900,
                                  lineHeight: 1.05,
                                  color: 'inherit',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {countryRow.countryName}
                              </Typography>
                              <Box
                                component="button"
                                type="button"
                                title={`Remove ${countryRow.countryName} row`}
                                onMouseDown={(event) => event.stopPropagation()}
                                onDragStart={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removeCountryRow(countryRow);
                                }}
                                sx={{
                                  border: '1px solid rgba(127, 29, 29, 0.35)',
                                  bgcolor: '#FEE2E2',
                                  color: '#991B1B',
                                  borderRadius: 0.75,
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                  fontSize: 10,
                                  fontWeight: 900,
                                  lineHeight: 1,
                                  height: 18,
                                  px: 0.5,
                                  '&:hover': {
                                    bgcolor: '#FCA5A5',
                                  },
                                }}
                              >
                                Remove
                              </Box>
                            </Stack>
                          </TableCell>
                        </>
                      )}
                      {showProcedureColumns &&
                        procedureColumns.map((procedure, procedureIndex) => {
                          const rule = countryRow.rulesByProcedure[procedure];
                          const total = rule ? getRowTotal(rule) : null;
                          const draftKey = rule ? rule._id : makeMissingFeeKey(countryRow, procedure);
                          const errors = rowErrors[draftKey] || {};
                          const missingTotal = rule ? null : getMissingRowTotal(countryRow, procedure);
                          const procedureWidth = getProcedureColumnWidth(procedure);
                          const worksheetRowNumber = page * rowsPerPage + rowIndex + 2;
                          const firstFeeColumnIndex =
                            (columnVisibility.country ? 3 : 0) + procedureIndex * visibleFeeColumnCount;
                          const officialCellName = `${getExcelColumnLabel(firstFeeColumnIndex)}${worksheetRowNumber}`;
                          const attorneyCellName = `${getExcelColumnLabel(firstFeeColumnIndex + (columnVisibility.officeFee ? 1 : 0))}${worksheetRowNumber}`;
                          const officialTarget: ActiveFeeCellTarget = {
                            cellName: officialCellName,
                            countryKey: countryRow.key,
                            procedure,
                            field: 'officialFee',
                            ruleId: rule?._id,
                          };
                          const attorneyTarget: ActiveFeeCellTarget = {
                            cellName: attorneyCellName,
                            countryKey: countryRow.key,
                            procedure,
                            field: 'attorneyFee',
                            ruleId: rule?._id,
                          };
                          const officialSelected = selectedFeeCellKeys.has(getFeeCellKey(officialTarget));
                          const attorneySelected = selectedFeeCellKeys.has(getFeeCellKey(attorneyTarget));

                          return (
                            <React.Fragment key={`${countryRow.key}-${procedure}`}>
                              {columnVisibility.officeFee && (
                                <TableCell
                                  onDragOver={(event) => event.preventDefault()}
                                  onDrop={(event) => handleFillDrop(event, officialTarget)}
                                  sx={{
                                    width: procedureWidth,
                                    px: 0.25,
                                    textAlign: 'center',
                                    borderRight: lastVisibleFeeColumn === 'officialFee' ? '2px solid #111827' : '1px solid #1F2937',
                                    position: 'relative',
                                  }}
                                >
                                  {rule ? (
                                    <Box
                                      component="input"
                                      data-fee-cell={officialCellName}
                                      value={getFeeValue(rule, 'officialFee')}
                                      onFocus={() => selectFeeCell(officialTarget)}
                                      onClick={(event) => {
                                        if (event.shiftKey) selectFeeCell(officialTarget, true);
                                      }}
                                      onDoubleClick={fillSelectedRangeFromActiveCell}
                                      onChange={(event) => updateFee(rule, 'officialFee', event.target.value)}
                                      onBlur={(event) => {
                                        commitFeeCellEdit(officialTarget, event.target.value);
                                        saveRuleFees(rule, event.target.value, getFeeValue(rule, 'attorneyFee'));
                                      }}
                                      onKeyDown={(event) => handleFeeCellKeyDown(event, officialTarget)}
                                      title={errors.officialFee || 'Official Fees'}
                                      inputMode="decimal"
                                      style={{
                                        width: '100%',
                                        height: Math.max(18, currentRowHeight - 2),
                                        border: errors.officialFee ? '1px solid #DC2626' : officialSelected ? '2px solid #217346' : '0',
                                        outline: 'none',
                                        background: officialSelected ? 'rgba(33, 115, 70, 0.14)' : 'transparent',
                                        color: fontColor,
                                        fontFamily,
                                        fontSize,
                                        fontWeight: boldText ? 900 : 800,
                                        fontStyle: italicText ? 'italic' : 'normal',
                                        textDecoration: underlineText ? 'underline' : 'none',
                                        padding: 0,
                                        textAlign,
                                      }}
                                    />
                                  ) : (
                                    <Box
                                      component="input"
                                      data-fee-cell={officialCellName}
                                      value={getMissingFeeValue(countryRow, procedure, 'officialFee')}
                                      onFocus={() => selectFeeCell(officialTarget)}
                                      onClick={(event) => {
                                        if (event.shiftKey) selectFeeCell(officialTarget, true);
                                      }}
                                      onDoubleClick={fillSelectedRangeFromActiveCell}
                                      onChange={(event) => updateMissingFee(countryRow, procedure, 'officialFee', event.target.value)}
                                      onBlur={(event) => {
                                        commitFeeCellEdit(officialTarget, event.target.value);
                                        saveMissingRuleFees(
                                          countryRow,
                                          procedure,
                                          event.target.value,
                                          getMissingFeeValue(countryRow, procedure, 'attorneyFee')
                                        );
                                      }}
                                      onKeyDown={(event) => handleFeeCellKeyDown(event, officialTarget)}
                                      title={errors.officialFee || 'Official Fees'}
                                      inputMode="decimal"
                                      style={{
                                        width: '100%',
                                        height: Math.max(18, currentRowHeight - 2),
                                        border: errors.officialFee ? '1px solid #DC2626' : officialSelected ? '2px solid #217346' : '0',
                                        outline: 'none',
                                        background: officialSelected ? 'rgba(33, 115, 70, 0.14)' : 'transparent',
                                        color: fontColor,
                                        fontFamily,
                                        fontSize,
                                        fontWeight: boldText ? 900 : 800,
                                        fontStyle: italicText ? 'italic' : 'normal',
                                        textDecoration: underlineText ? 'underline' : 'none',
                                        padding: 0,
                                        textAlign,
                                      }}
                                    />
                                  )}
                                  {officialSelected && renderFillHandle(officialTarget)}
                                </TableCell>
                              )}
                              {columnVisibility.attorneyFee && (
                                <TableCell
                                  onDragOver={(event) => event.preventDefault()}
                                  onDrop={(event) => handleFillDrop(event, attorneyTarget)}
                                  sx={{
                                    width: procedureWidth,
                                    px: 0.25,
                                    textAlign: 'center',
                                    borderRight: lastVisibleFeeColumn === 'attorneyFee' ? '2px solid #111827' : '1px solid #1F2937',
                                    position: 'relative',
                                  }}
                                >
                                  {rule ? (
                                    <Box
                                      component="input"
                                      data-fee-cell={attorneyCellName}
                                      value={getFeeValue(rule, 'attorneyFee')}
                                      onFocus={() => selectFeeCell(attorneyTarget)}
                                      onClick={(event) => {
                                        if (event.shiftKey) selectFeeCell(attorneyTarget, true);
                                      }}
                                      onDoubleClick={fillSelectedRangeFromActiveCell}
                                      onChange={(event) => updateFee(rule, 'attorneyFee', event.target.value)}
                                      onBlur={(event) => {
                                        commitFeeCellEdit(attorneyTarget, event.target.value);
                                        saveRuleFees(rule, getFeeValue(rule, 'officialFee'), event.target.value);
                                      }}
                                      onKeyDown={(event) => handleFeeCellKeyDown(event, attorneyTarget)}
                                      title={errors.attorneyFee || 'Attorney Fees'}
                                      inputMode="decimal"
                                      style={{
                                        width: '100%',
                                        height: Math.max(18, currentRowHeight - 2),
                                        border: errors.attorneyFee ? '1px solid #DC2626' : attorneySelected ? '2px solid #217346' : '0',
                                        outline: 'none',
                                        background: attorneySelected ? 'rgba(33, 115, 70, 0.14)' : 'transparent',
                                        color: fontColor,
                                        fontFamily,
                                        fontSize,
                                        fontWeight: boldText ? 900 : 800,
                                        fontStyle: italicText ? 'italic' : 'normal',
                                        textDecoration: underlineText ? 'underline' : 'none',
                                        padding: 0,
                                        textAlign,
                                      }}
                                    />
                                  ) : (
                                    <Box
                                      component="input"
                                      data-fee-cell={attorneyCellName}
                                      value={getMissingFeeValue(countryRow, procedure, 'attorneyFee')}
                                      onFocus={() => selectFeeCell(attorneyTarget)}
                                      onClick={(event) => {
                                        if (event.shiftKey) selectFeeCell(attorneyTarget, true);
                                      }}
                                      onDoubleClick={fillSelectedRangeFromActiveCell}
                                      onChange={(event) => updateMissingFee(countryRow, procedure, 'attorneyFee', event.target.value)}
                                      onBlur={(event) => {
                                        commitFeeCellEdit(attorneyTarget, event.target.value);
                                        saveMissingRuleFees(
                                          countryRow,
                                          procedure,
                                          getMissingFeeValue(countryRow, procedure, 'officialFee'),
                                          event.target.value
                                        );
                                      }}
                                      onKeyDown={(event) => handleFeeCellKeyDown(event, attorneyTarget)}
                                      title={errors.attorneyFee || 'Attorney Fees'}
                                      inputMode="decimal"
                                      style={{
                                        width: '100%',
                                        height: Math.max(18, currentRowHeight - 2),
                                        border: errors.attorneyFee ? '1px solid #DC2626' : attorneySelected ? '2px solid #217346' : '0',
                                        outline: 'none',
                                        background: attorneySelected ? 'rgba(33, 115, 70, 0.14)' : 'transparent',
                                        color: fontColor,
                                        fontFamily,
                                        fontSize,
                                        fontWeight: boldText ? 900 : 800,
                                        fontStyle: italicText ? 'italic' : 'normal',
                                        textDecoration: underlineText ? 'underline' : 'none',
                                        padding: 0,
                                        textAlign,
                                      }}
                                    />
                                  )}
                                  {attorneySelected && renderFillHandle(attorneyTarget)}
                                </TableCell>
                              )}
                              {columnVisibility.total && (
                                <TableCell sx={{ width: procedureWidth, px: 0.25, textAlign, bgcolor: `${getTotalCellBackground(rule ? total : missingTotal)} !important`, borderRight: '2px solid #111827' }}>
                                  <Typography sx={{ fontSize: 12, fontWeight: 900, color: 'inherit' }}>
                                    {rule ? (total === null ? '-' : formatSheetNumber(total)) : (missingTotal === null ? '-' : formatSheetNumber(missingTotal))}
                                  </Typography>
                                </TableCell>
                              )}
                            </React.Fragment>
                          );
                        })}
                      <TableCell
                        sx={{
                          width: rowGrandTotalWidth,
                          px: 0.25,
                          textAlign: 'center',
                          bgcolor: `${getTotalCellBackground(rowGrandTotal)} !important`,
                          borderRight: '2px solid #111827',
                        }}
                      >
                        <Typography sx={{ fontSize: 12, fontWeight: 900, color: 'inherit' }}>
                          {formatSheetNumber(rowGrandTotal)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {!loading && countryRows.length > 0 && (
                  <TableRow
                    sx={{
                      '& td': {
                        bgcolor: `${getTotalCellBackground(grandTotalAmount)} !important`,
                        borderTop: '2px solid #111827',
                        fontWeight: 900,
                        height: Math.max(22, rowHeight),
                      },
                    }}
                  >
                    {columnVisibility.country && (
                      <TableCell
                        colSpan={3}
                        sx={{
                          px: 0.75,
                          textAlign: 'left',
                          borderRight: '2px solid #111827',
                          fontSize: 13,
                        }}
                      >
                        Grand Total: {formatSheetNumber(grandTotalAmount)}
                      </TableCell>
                    )}
                    {showProcedureColumns &&
                      procedureColumns.map((procedure) => {
                        const procedureWidth = getProcedureColumnWidth(procedure);

                        return (
                          <React.Fragment key={`grand-total-${procedure}`}>
                            {columnVisibility.officeFee && (
                              <TableCell
                                sx={{
                                  width: procedureWidth,
                                  borderRight: lastVisibleFeeColumn === 'officialFee' ? '2px solid #111827' : '1px solid #1F2937',
                                }}
                              />
                            )}
                            {columnVisibility.attorneyFee && (
                              <TableCell
                                sx={{
                                  width: procedureWidth,
                                  borderRight: lastVisibleFeeColumn === 'attorneyFee' ? '2px solid #111827' : '1px solid #1F2937',
                                }}
                              />
                            )}
                            {columnVisibility.total && (
                              <TableCell sx={{ width: procedureWidth, px: 0.25, textAlign: 'center', borderRight: '2px solid #111827' }}>
                                <Typography sx={{ fontSize: 12, fontWeight: 900, color: 'inherit' }}>
                                  {formatSheetNumber(procedureGrandTotals[procedure] || 0)}
                                </Typography>
                              </TableCell>
                            )}
                          </React.Fragment>
                        );
                      })}
                    <TableCell sx={{ width: rowGrandTotalWidth, px: 0.25, textAlign: 'center', borderRight: '2px solid #111827' }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 900, color: 'inherit' }}>
                        {formatSheetNumber(grandTotalAmount)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}

                {!loading && countryRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={visibleColumnCount} sx={{ py: 4, textAlign: 'center', color: '#64748B' }}>
                      {tableMode === 'quotation'
                        ? 'Empty quotation table. Use Add to Quotation to choose fees for this draft.'
                        : 'No pricing rules found.'}
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
            </Box>
          </Box>

          <Box
            sx={{
              minHeight: 42,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1,
              bgcolor: darkMode ? '#10251D' : '#F8FAFC',
              borderBottom: `1px solid ${ribbonBorder}`,
              overflowX: 'auto',
            }}
          >
            <Tabs
              value={selectedService}
              onChange={(_event: React.SyntheticEvent, value: ServiceKey) => {
                setSelectedService(value);
                setSelectedRuleIds([]);
                setSelectedProcedure('');
                setPage(0);
                setRowOrder([]);
                setColumnOrder([]);
                setHiddenRowKeys([]);
                setHiddenProcedureColumns([]);
              }}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                minHeight: 34,
                flex: '1 1 auto',
                '& .MuiTabs-indicator': { display: 'none' },
                '& .MuiTab-root': {
                  minHeight: 32,
                  px: 2,
                  mr: 0.5,
                  border: `1px solid ${ribbonBorder}`,
                  borderBottomColor: 'transparent',
                  borderRadius: '8px 8px 0 0',
                  bgcolor: darkMode ? '#173326' : '#FFFFFF',
                  color: darkMode ? '#D6E9DD' : '#334155',
                  fontWeight: 800,
                  textTransform: 'none',
                },
                '& .MuiTab-root.Mui-selected': {
                  bgcolor: darkMode ? '#214B36' : '#E8F3EC',
                  color: '#217346',
                },
              }}
            >
              {SERVICES.map((service) => (
                <Tab key={service} value={service} label={service} />
              ))}
            </Tabs>
            <Button size="small" variant="outlined" onClick={createNewDraft} sx={{ whiteSpace: 'nowrap' }}>
              Add Sheet
            </Button>
            <Typography
              sx={{
                flexShrink: 0,
                color: darkMode ? '#CFE7D7' : '#475569',
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              Ready | {statusText} | {selectedRangeLabel} | Sum {formatSheetNumber(selectionStats.sum)}
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexShrink: 0 }}>
              <Button size="small" variant="outlined" onClick={() => setZoomLevel((current) => Math.max(70, current - 10))}>-</Button>
              <Typography sx={{ minWidth: 42, textAlign: 'center', color: darkMode ? '#CFE7D7' : '#334155', fontSize: 12, fontWeight: 800 }}>
                {zoomLevel}%
              </Typography>
              <Button size="small" variant="outlined" onClick={() => setZoomLevel((current) => Math.min(150, current + 10))}>+</Button>
            </Stack>
          </Box>

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

      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>Save IP Services Fee Draft</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {error && (
              <Alert severity="warning" onClose={() => setError('')}>
                {error}
              </Alert>
            )}
            <TextField
              autoFocus
              label="Draft Name"
              value={saveDraftName}
              onChange={(event) => setSaveDraftName(event.target.value)}
              placeholder="Asia fees"
              fullWidth
            />
            <TextField
              label="Draft Date"
              type="date"
              value={saveDraftDate}
              onChange={(event) => setSaveDraftDate(event.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Box sx={{ border: '1px solid #D7DDE7', bgcolor: '#F8FAFC', p: 1.5 }}>
              <Typography sx={{ fontSize: 13, color: '#475569' }}>
                Table: {tableMode === 'all' ? 'All Fees' : `${selectedRuleIds.length} selected quotation fee${selectedRuleIds.length === 1 ? '' : 's'}`}
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#475569' }}>
                Service: {selectedService}
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveDraft}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteAllDialogOpen} onClose={closeDeleteAllDraftsDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>Delete All Fee Builder Drafts</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="warning">
              This will delete every saved fee-builder draft. Admin password confirmation is required.
            </Alert>
            {deleteAllError && (
              <Alert severity="error" onClose={() => setDeleteAllError('')}>
                {deleteAllError}
              </Alert>
            )}
            <TextField
              autoFocus
              label="Admin Password"
              type="password"
              value={deleteAllPassword}
              onChange={(event) => setDeleteAllPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  deleteAllDrafts();
                }
              }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeDeleteAllDraftsDialog} disabled={deleteAllSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={deleteAllDrafts}
            disabled={deleteAllSaving}
          >
            {deleteAllSaving ? 'Deleting...' : 'Delete All Drafts'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={selectionDialogOpen} onClose={() => setSelectionDialogOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle sx={{ fontWeight: 900 }}>Add Fees to Quotation</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr auto auto' },
                gap: 1,
                alignItems: 'center',
              }}
            >
              <FormControl size="small">
                <InputLabel>Country</InputLabel>
                <Select
                  label="Country"
                  value={selectionCountry}
                  onChange={(event) => {
                    setSelectionCountry(event.target.value);
                    setSelectionProcedure('');
                  }}
                >
                  <MenuItem value="">All Countries</MenuItem>
                  {selectionCountryOptions.map((country) => (
                    <MenuItem key={country} value={country}>
                      {country}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small">
                <InputLabel>Procedure</InputLabel>
                <Select
                  label="Procedure"
                  value={selectionProcedure}
                  onChange={(event) => setSelectionProcedure(event.target.value)}
                >
                  <MenuItem value="">All Procedures</MenuItem>
                  {selectionProcedureOptions.map((procedure) => (
                    <MenuItem key={procedure} value={procedure}>
                      {procedure}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button variant="outlined" onClick={selectVisibleSelectionRows} disabled={selectionRows.length === 0}>
                Select Visible
              </Button>
              <Button variant="outlined" color="error" onClick={clearSelectionDraft}>
                Clear
              </Button>
            </Box>

            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 1,
                justifyContent: 'space-between',
                color: '#475569',
              }}
            >
              <Typography sx={{ fontSize: 13 }}>
                {selectedService} pricing rules for the quotation table.
              </Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 800 }}>
                {selectionDraftIds.length} selected
              </Typography>
            </Box>

            <TableContainer sx={{ border: '1px solid #D7DDE7', maxHeight: 430 }}>
              <Table stickyHeader size="small" sx={{ minWidth: 860 }}>
                <TableHead>
                  <TableRow
                    sx={{
                      '& th': {
                        bgcolor: '#EAF2FF',
                        color: '#111827',
                        fontWeight: 900,
                        whiteSpace: 'nowrap',
                      },
                    }}
                  >
                    <TableCell sx={{ width: 54 }}>Add</TableCell>
                    <TableCell>Country</TableCell>
                    <TableCell>Procedure</TableCell>
                    <TableCell align="right">Official Fees</TableCell>
                    <TableCell align="right">Attorney Fees</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectionRows.map((rule) => {
                    const checked = selectionDraftIds.includes(rule._id);
                    const total = getRowTotal(rule);

                    return (
                      <TableRow
                        key={rule._id}
                        hover
                        selected={checked}
                        sx={{ '& td': { borderBottom: '1px solid #E2E8F0' } }}
                      >
                        <TableCell>
                          <Checkbox
                            size="small"
                            checked={checked}
                            onChange={(event) => toggleSelectionRule(rule._id, event.target.checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontWeight: 800, color: '#111827' }}>
                            {rule.countryName}
                          </Typography>
                          <Typography sx={{ fontSize: 12, color: '#64748B' }}>
                            {rule.countryAbbreviation}
                          </Typography>
                        </TableCell>
                        <TableCell>{rule.procedureName}</TableCell>
                        <TableCell align="right">{getFeeValue(rule, 'officialFee')}</TableCell>
                        <TableCell align="right">{getFeeValue(rule, 'attorneyFee')}</TableCell>
                        <TableCell align="right">
                          <Typography component="span" sx={{ fontWeight: 900 }}>
                            {total === null ? '-' : formatMoney(total)}
                          </Typography>
                        </TableCell>
                        <TableCell>{rule.isActive ? 'Active' : 'Inactive'}</TableCell>
                      </TableRow>
                    );
                  })}

                  {selectionRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ py: 4, textAlign: 'center', color: '#64748B' }}>
                        No pricing rules match the selected country/procedure.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setSelectionDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={addSelectionToTable}>
            Add Selected to Table
          </Button>
        </DialogActions>
      </Dialog>

      <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}>
        <MenuItem onClick={() => { setExportAnchor(null); exportExcel(); }}>Styled Excel (.xls)</MenuItem>
        <MenuItem onClick={() => { setExportAnchor(null); exportWord(); }}>Styled Word (.doc)</MenuItem>
        <MenuItem onClick={() => { setExportAnchor(null); exportCsv(); }}>CSV (.csv)</MenuItem>
        <MenuItem onClick={() => { setExportAnchor(null); exportDraftJson(); }}>Draft JSON</MenuItem>
        <MenuItem onClick={() => { setExportAnchor(null); openPrintView(); }}>Print / PDF</MenuItem>
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
              type="number"
              label="Font Size"
              value={fontSize}
              slotProps={{ input: { inputProps: { min: 8, max: 32, step: 1 } } }}
              onChange={(event) => setFontSize(Math.max(8, Math.min(32, Number(event.target.value) || DEFAULT_FONT_SIZE)))}
            />
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
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

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography sx={{ fontWeight: 900 }}>Drafts</Typography>
            {isAdmin && (
              <Button
                size="small"
                color="error"
                variant="outlined"
                disabled={drafts.length === 0}
                onClick={openDeleteAllDraftsDialog}
              >
                Delete All
              </Button>
            )}
          </Stack>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Draft Continent</InputLabel>
            <Select
              label="Draft Continent"
              value={selectedContinent}
              onChange={(event) => setSelectedContinent(event.target.value)}
            >
              <MenuItem value="">All Continents</MenuItem>
              {continents.map((continent) => (
                <MenuItem key={continent._id} value={continent.continent}>
                  {continent.continent}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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

      <Menu
        open={cellContextMenu !== null}
        onClose={() => setCellContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          cellContextMenu
            ? { top: cellContextMenu.mouseY, left: cellContextMenu.mouseX }
            : undefined
        }
      >
        {['Cut', 'Copy', 'Paste', 'Insert Row', 'Delete Row', 'Sort Ascending', 'Sort Descending', 'Filter', 'Data Validation'].map((action) => (
          <MenuItem key={action} onClick={() => runContextAction(action)}>
            {action}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
