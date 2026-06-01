'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Switch,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import Topbar from '@/components/layout/Topbar';
import { showSuccessToast } from '@/components/feedback/heroToast';

export const dynamic = 'force-dynamic';

type ServiceKey = 'Trademark' | 'Patent' | 'Design' | 'Copyright' | 'Litigation';
type FeeField = 'official' | 'attorney' | 'total';
type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'AUD' | 'NZD' | 'SGD';
type PanelKey = 'visibility' | 'style' | 'templates' | 'audit';
type Alignment = 'left' | 'center' | 'right';
type SortKey = 'manual' | 'country-asc' | 'country-desc' | 'total-asc' | 'total-desc';

interface ServiceDefinition {
  label: ServiceKey;
  headerColor: string;
  headerTextColor: string;
  accentColor: string;
  operations: string[];
}

interface CountryOption {
  code: string;
  name: string;
  flag: string;
}

interface FeeGroup {
  id: string;
  service: ServiceKey;
  label: string;
  visible: boolean;
  width: number;
}

interface FeeCell {
  official: string;
  attorney: string;
}

interface FeeRow {
  id: string;
  countryCode: string;
  countryName: string;
  flag: string;
  visible: boolean;
  height: number;
  cells: Record<string, FeeCell>;
}

interface StyleSettings {
  trademarkHeader: string;
  secondaryHeader: string;
  bodyBackground: string;
  alternateBodyBackground: string;
  borderColor: string;
  headerTextColor: string;
  bodyTextColor: string;
  fontFamily: string;
  fontSize: number;
  borderWidth: number;
  alignment: Alignment;
  showCountryCode: boolean;
  exportVisibleRowsOnly: boolean;
  exportVisibleColumnsOnly: boolean;
  includeHiddenData: boolean;
}

interface AuditEntry {
  id: string;
  at: string;
  user: string;
  action: string;
  oldValue?: string;
  newValue?: string;
}

interface SavedTemplate {
  id: string;
  name: string;
  createdAt: string;
  selectedServices: ServiceKey[];
  groups: FeeGroup[];
  style: StyleSettings;
  currency: CurrencyCode;
}

interface SavedView {
  id: string;
  name: string;
  createdAt: string;
  selectedServices: ServiceKey[];
  rowVisibility: Record<string, boolean>;
  groupVisibility: Record<string, boolean>;
  collapsedServices: ServiceKey[];
  style: StyleSettings;
}

interface ReportSnapshot {
  selectedServices: ServiceKey[];
  groups: FeeGroup[];
  rows: FeeRow[];
  style: StyleSettings;
  currency: CurrencyCode;
  collapsedServices: ServiceKey[];
}

type SheetMerge = {
  s: { r: number; c: number };
  e: { r: number; c: number };
};

const STORAGE_KEY = 'ip-fee-report-builder-autosave';
const TEMPLATE_STORAGE_KEY = 'ip-fee-report-builder-templates';
const VIEW_STORAGE_KEY = 'ip-fee-report-builder-views';

const SERVICES: Record<ServiceKey, ServiceDefinition> = {
  Trademark: {
    label: 'Trademark',
    headerColor: '#F5BF8D',
    headerTextColor: '#1F2933',
    accentColor: '#B86B20',
    operations: [
      'Registration',
      'Search',
      'Renewal',
      'Recordal of Assignment',
      'Change of Name / Address',
      'Opposition',
      'Cancellation',
      'Licensing',
    ],
  },
  Patent: {
    label: 'Patent',
    headerColor: '#DDE8C9',
    headerTextColor: '#1F2933',
    accentColor: '#5D7E2A',
    operations: ['Registration', 'Search', 'Filing', 'Examination', 'Renewal', 'Assignment', 'Licensing'],
  },
  Design: {
    label: 'Design',
    headerColor: '#DDE8C9',
    headerTextColor: '#1F2933',
    accentColor: '#5D7E2A',
    operations: ['Registration', 'Search', 'Renewal', 'Assignment'],
  },
  Copyright: {
    label: 'Copyright',
    headerColor: '#D8EAFE',
    headerTextColor: '#17324D',
    accentColor: '#1D6FB8',
    operations: ['Registration', 'Recordal', 'Assignment', 'Licensing'],
  },
  Litigation: {
    label: 'Litigation',
    headerColor: '#E9D7F7',
    headerTextColor: '#301A4D',
    accentColor: '#7C3AAC',
    operations: ['Filing', 'Opposition', 'Appeal', 'Court Proceedings', 'Enforcement'],
  },
};

const SERVICE_ORDER: ServiceKey[] = ['Trademark', 'Patent', 'Design', 'Copyright', 'Litigation'];

const COUNTRY_OPTIONS: CountryOption[] = [
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'FJ', name: 'Fiji', flag: '🇫🇯' },
  { code: 'KI', name: 'Kiribati', flag: '🇰🇮' },
  { code: 'NR', name: 'Nauru', flag: '🇳🇷' },
  { code: 'PG', name: 'Papua New Guinea', flag: '🇵🇬' },
  { code: 'WS', name: 'Samoa', flag: '🇼🇸' },
  { code: 'SB', name: 'Solomon Islands', flag: '🇸🇧' },
  { code: 'TO', name: 'Tonga', flag: '🇹🇴' },
  { code: 'TV', name: 'Tuvalu', flag: '🇹🇻' },
  { code: 'VU', name: 'Vanuatu', flag: '🇻🇺' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
];

const EXCHANGE_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.78,
  AUD: 1.52,
  NZD: 1.65,
  SGD: 1.35,
};

const DEFAULT_STYLE: StyleSettings = {
  trademarkHeader: '#F5BF8D',
  secondaryHeader: '#DDE8C9',
  bodyBackground: '#76C3D2',
  alternateBodyBackground: '#6DB9C9',
  borderColor: '#24313C',
  headerTextColor: '#111827',
  bodyTextColor: '#17212B',
  fontFamily: 'Georgia, Times New Roman, serif',
  fontSize: 12,
  borderWidth: 1,
  alignment: 'center',
  showCountryCode: false,
  exportVisibleRowsOnly: true,
  exportVisibleColumnsOnly: true,
  includeHiddenData: false,
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const makeGroupId = (service: ServiceKey, label: string) => `${service.toLowerCase()}-${slugify(label)}`;
const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getGroupLabel = (group: FeeGroup) => (
  group.service === 'Trademark' ? group.label : `${group.service} ${group.label}`
);

const createDefaultGroups = () =>
  SERVICE_ORDER.flatMap((service) =>
    SERVICES[service].operations.map((label) => ({
      id: makeGroupId(service, label),
      service,
      label,
      visible: true,
      width: label.length > 18 ? 150 : 116,
    }))
  );

const emptyCell = (): FeeCell => ({ official: '', attorney: '' });

const getCountry = (code: string) =>
  COUNTRY_OPTIONS.find((country) => country.code === code) || COUNTRY_OPTIONS[0];

const createBlankCells = (groups: FeeGroup[]) =>
  groups.reduce<Record<string, FeeCell>>((acc, group) => {
    acc[group.id] = emptyCell();
    return acc;
  }, {});

const createRow = (countryCode: string, groups: FeeGroup[], cells: Record<string, Partial<FeeCell>> = {}): FeeRow => {
  const country = getCountry(countryCode);
  const baseCells = createBlankCells(groups);
  Object.entries(cells).forEach(([groupId, value]) => {
    baseCells[groupId] = {
      official: value.official ?? '',
      attorney: value.attorney ?? '',
    };
  });

  return {
    id: makeId(`row-${countryCode.toLowerCase()}`),
    countryCode: country.code,
    countryName: country.name,
    flag: country.flag,
    visible: true,
    height: 26,
    cells: baseCells,
  };
};

const makeSampleRows = (groups: FeeGroup[]) => {
  const g = (service: ServiceKey, label: string) => makeGroupId(service, label);
  const sample: Array<[string, Record<string, Partial<FeeCell>>]> = [
    ['AU', {
      [g('Trademark', 'Registration')]: { official: '250', attorney: '750' },
      [g('Trademark', 'Search')]: { official: '0', attorney: '300' },
      [g('Trademark', 'Renewal')]: { official: '310', attorney: '750' },
      [g('Trademark', 'Recordal of Assignment')]: { official: '0', attorney: '750' },
      [g('Trademark', 'Change of Name / Address')]: { official: '0', attorney: '750' },
      [g('Patent', 'Registration')]: { official: 'Actual Fees', attorney: '2000' },
      [g('Design', 'Registration')]: { official: 'Actual Fees', attorney: '800' },
    }],
    ['NZ', {
      [g('Trademark', 'Registration')]: { official: '75', attorney: '750' },
      [g('Trademark', 'Search')]: { official: '0', attorney: '300' },
      [g('Trademark', 'Renewal')]: { official: '280', attorney: '750' },
      [g('Trademark', 'Recordal of Assignment')]: { official: '0', attorney: '750' },
      [g('Trademark', 'Change of Name / Address')]: { official: '0', attorney: '750' },
      [g('Patent', 'Registration')]: { official: 'Actual Fees', attorney: '2000' },
      [g('Design', 'Registration')]: { official: 'Actual Fees', attorney: '800' },
    }],
    ['FJ', {
      [g('Trademark', 'Registration')]: { official: '15', attorney: '1140' },
      [g('Trademark', 'Search')]: { official: '2', attorney: '600' },
      [g('Trademark', 'Renewal')]: { official: '20', attorney: '1140' },
      [g('Trademark', 'Recordal of Assignment')]: { official: '10', attorney: '1140' },
      [g('Trademark', 'Change of Name / Address')]: { official: '10', attorney: '1140' },
      [g('Patent', 'Registration')]: { official: 'Actual Cost', attorney: '3000' },
      [g('Design', 'Registration')]: { official: 'N/A', attorney: 'N/A' },
    }],
    ['KI', {
      [g('Trademark', 'Registration')]: { official: '80', attorney: '1140' },
      [g('Trademark', 'Search')]: { official: '20', attorney: '600' },
      [g('Trademark', 'Renewal')]: { official: '40', attorney: '1140' },
      [g('Trademark', 'Recordal of Assignment')]: { official: '80', attorney: '1140' },
      [g('Trademark', 'Change of Name / Address')]: { official: '40', attorney: '1140' },
      [g('Patent', 'Registration')]: { official: 'Actual Cost', attorney: '3000' },
      [g('Design', 'Registration')]: { official: 'N/A', attorney: 'N/A' },
    }],
    ['NR', {
      [g('Trademark', 'Registration')]: { official: '260', attorney: '1140' },
      [g('Trademark', 'Search')]: { official: '40', attorney: '600' },
      [g('Trademark', 'Renewal')]: { official: '220', attorney: '1140' },
      [g('Trademark', 'Recordal of Assignment')]: { official: '260', attorney: '1140' },
      [g('Trademark', 'Change of Name / Address')]: { official: '260', attorney: '1140' },
      [g('Patent', 'Registration')]: { official: 'Actual Cost', attorney: '3000' },
      [g('Design', 'Registration')]: { official: 'N/A', attorney: 'N/A' },
    }],
    ['PG', {
      [g('Trademark', 'Registration')]: { official: '205', attorney: '1140' },
      [g('Trademark', 'Search')]: { official: '20', attorney: '600' },
      [g('Trademark', 'Renewal')]: { official: '160', attorney: '1140' },
      [g('Trademark', 'Recordal of Assignment')]: { official: '80', attorney: '1140' },
      [g('Trademark', 'Change of Name / Address')]: { official: '30', attorney: '1140' },
      [g('Patent', 'Registration')]: { official: 'Actual Cost', attorney: '3000' },
      [g('Design', 'Registration')]: { official: 'Actual Fees', attorney: '1000' },
    }],
    ['WS', {
      [g('Trademark', 'Registration')]: { official: '390', attorney: '1140' },
      [g('Trademark', 'Search')]: { official: '0', attorney: '600' },
      [g('Trademark', 'Renewal')]: { official: '315', attorney: '1140' },
      [g('Trademark', 'Recordal of Assignment')]: { official: '200', attorney: '1140' },
      [g('Trademark', 'Change of Name / Address')]: { official: '195', attorney: '1140' },
      [g('Patent', 'Registration')]: { official: 'Actual Cost', attorney: '3000' },
      [g('Design', 'Registration')]: { official: 'Actual Fees', attorney: '1000' },
    }],
    ['SB', {
      [g('Trademark', 'Registration')]: { official: '360', attorney: '1140' },
      [g('Trademark', 'Search')]: { official: '10', attorney: '600' },
      [g('Trademark', 'Renewal')]: { official: '275', attorney: '1140' },
      [g('Trademark', 'Recordal of Assignment')]: { official: '240', attorney: '1140' },
      [g('Trademark', 'Change of Name / Address')]: { official: '155', attorney: '1140' },
      [g('Patent', 'Registration')]: { official: 'Actual Cost', attorney: '3000' },
      [g('Design', 'Registration')]: { official: 'N/A', attorney: 'N/A' },
    }],
    ['TO', {
      [g('Trademark', 'Registration')]: { official: '240', attorney: '1140' },
      [g('Trademark', 'Search')]: { official: '15', attorney: '600' },
      [g('Trademark', 'Renewal')]: { official: '60', attorney: '1140' },
      [g('Trademark', 'Recordal of Assignment')]: { official: '140', attorney: '1140' },
      [g('Trademark', 'Change of Name / Address')]: { official: '60', attorney: '1140' },
      [g('Patent', 'Registration')]: { official: 'Actual Cost', attorney: '3000' },
      [g('Design', 'Registration')]: { official: 'Actual Fees', attorney: '1000' },
    }],
    ['TV', {
      [g('Trademark', 'Registration')]: { official: '415', attorney: '1140' },
      [g('Trademark', 'Search')]: { official: '60', attorney: '600' },
      [g('Trademark', 'Renewal')]: { official: '435', attorney: '1140' },
      [g('Trademark', 'Recordal of Assignment')]: { official: '415', attorney: '1140' },
      [g('Trademark', 'Change of Name / Address')]: { official: '415', attorney: '1140' },
      [g('Patent', 'Registration')]: { official: 'Actual Cost', attorney: '3000' },
      [g('Design', 'Registration')]: { official: 'N/A', attorney: 'N/A' },
    }],
    ['VU', {
      [g('Trademark', 'Registration')]: { official: '665', attorney: '1140' },
      [g('Trademark', 'Search')]: { official: '30', attorney: '600' },
      [g('Trademark', 'Renewal')]: { official: '415', attorney: '1140' },
      [g('Trademark', 'Recordal of Assignment')]: { official: '265', attorney: '1140' },
      [g('Trademark', 'Change of Name / Address')]: { official: '215', attorney: '1140' },
      [g('Patent', 'Registration')]: { official: 'Actual Cost', attorney: '3000' },
      [g('Design', 'Registration')]: { official: 'N/A', attorney: 'N/A' },
    }],
  ];

  return sample.map(([countryCode, cells]) => createRow(countryCode, groups, cells));
};

const defaultGroups = createDefaultGroups();

const parseAmount = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^(n\/a|na|actual fees?|actual cost)$/i.test(trimmed)) return null;
  const cleaned = trimmed.replace(/,/g, '').replace(/[^\d.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const numberValue = Number(cleaned);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const formatAmount = (value: number | null, currency: CurrencyCode) => {
  if (value === null) return '-';
  const converted = value * EXCHANGE_RATES[currency];
  return converted.toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(converted) ? 0 : 2,
    maximumFractionDigits: 2,
  });
};

const getFieldLabel = (field: FeeField) => {
  if (field === 'official') return 'Official Fee';
  if (field === 'attorney') return 'Attorney Fee';
  return 'TOTAL';
};

const columnNameToIndex = (letters: string) =>
  letters.toUpperCase().split('').reduce((acc, char) => acc * 26 + char.charCodeAt(0) - 64, 0) - 1;

const buildFlatColumns = (groups: FeeGroup[]) =>
  groups.flatMap((group) => [
    { groupId: group.id, field: 'official' as FeeField },
    { groupId: group.id, field: 'attorney' as FeeField },
    { groupId: group.id, field: 'total' as FeeField },
  ]);

const exportFileName = () => `ip-services-fee-report-${new Date().toISOString().slice(0, 10)}`;

const readStoredArray = <T,>(key: string): T[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export default function FeeReportBuilderPage() {
  const [selectedServices, setSelectedServices] = useState<ServiceKey[]>(['Trademark', 'Patent', 'Design']);
  const [groups, setGroups] = useState<FeeGroup[]>(defaultGroups);
  const [rows, setRows] = useState<FeeRow[]>(() => makeSampleRows(defaultGroups));
  const [style, setStyle] = useState<StyleSettings>(DEFAULT_STYLE);
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [collapsedServices, setCollapsedServices] = useState<ServiceKey[]>([]);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('manual');
  const [countryToAdd, setCountryToAdd] = useState('AU');
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; groupId: string; field: 'official' | 'attorney' } | null>(null);
  const [selectedColumnId, setSelectedColumnId] = useState<string>('');
  const [panel, setPanel] = useState<PanelKey>('visibility');
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [newColumnService, setNewColumnService] = useState<ServiceKey>('Trademark');
  const [newColumnLabel, setNewColumnLabel] = useState('New Service');
  const [templateName, setTemplateName] = useState('');
  const [viewName, setViewName] = useState('');
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [views, setViews] = useState<SavedView[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [undoStack, setUndoStack] = useState<ReportSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<ReportSnapshot[]>([]);
  const [exportAnchor, setExportAnchor] = useState<null | HTMLElement>(null);
  const [alert, setAlert] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const makeSnapshot = (): ReportSnapshot => ({
    selectedServices,
    groups,
    rows,
    style,
    currency,
    collapsedServices,
  });

  const addAudit = (action: string, oldValue?: string, newValue?: string) => {
    setAuditLog((prev) => [
      {
        id: makeId('audit'),
        at: new Date().toISOString(),
        user: 'Current User',
        action,
        oldValue,
        newValue,
      },
      ...prev,
    ].slice(0, 80));
  };

  const pushHistory = (action: string, oldValue?: string, newValue?: string) => {
    setUndoStack((prev) => [...prev.slice(-24), makeSnapshot()]);
    setRedoStack([]);
    addAudit(action, oldValue, newValue);
  };

  const restoreSnapshot = (snapshot: ReportSnapshot) => {
    setSelectedServices(snapshot.selectedServices);
    setGroups(snapshot.groups);
    setRows(snapshot.rows);
    setStyle(snapshot.style);
    setCurrency(snapshot.currency);
    setCollapsedServices(snapshot.collapsedServices);
  };

  const visibleServiceSet = useMemo(() => new Set(selectedServices), [selectedServices]);
  const selectedGroups = useMemo(
    () => groups.filter((group) => visibleServiceSet.has(group.service)),
    [groups, visibleServiceSet]
  );
  const exportGroups = useMemo(
    () => selectedGroups.filter((group) => style.includeHiddenData || !style.exportVisibleColumnsOnly || group.visible),
    [selectedGroups, style.exportVisibleColumnsOnly, style.includeHiddenData]
  );
  const visibleGroups = useMemo(
    () => selectedGroups.filter((group) => group.visible),
    [selectedGroups]
  );
  const flatColumns = useMemo(() => buildFlatColumns(groups), [groups]);

  const ensureRowCells = (row: FeeRow, nextGroups = groups): FeeRow => {
    const cells = { ...row.cells };
    nextGroups.forEach((group) => {
      if (!cells[group.id]) cells[group.id] = emptyCell();
    });
    return { ...row, cells };
  };

  const evaluateFormula = (
    expression: string,
    currentRow: FeeRow,
    depth = 0
  ): number | null => {
    if (depth > 8) return null;
    const withoutEquals = expression.replace(/^=/, '').trim();
    if (!withoutEquals) return null;

    const getReferenceValue = (ref: string) => {
      const match = ref.match(/^([A-Z]+)(\d+)$/i);
      if (!match) return 0;
      const columnIndex = columnNameToIndex(match[1]);
      const rowIndex = Number(match[2]) - 1;
      const targetColumn = flatColumns[columnIndex];
      const targetRow = rows[rowIndex];
      if (!targetColumn || !targetRow) return 0;
      return getNumericValue(targetRow, targetColumn.groupId, targetColumn.field, depth + 1) ?? 0;
    };

    const calculateRange = (functionName: string, from: string, to: string) => {
      const fromMatch = from.match(/^([A-Z]+)(\d+)$/i);
      const toMatch = to.match(/^([A-Z]+)(\d+)$/i);
      if (!fromMatch || !toMatch) return '0';
      const startColumn = columnNameToIndex(fromMatch[1]);
      const endColumn = columnNameToIndex(toMatch[1]);
      const startRow = Number(fromMatch[2]) - 1;
      const endRow = Number(toMatch[2]) - 1;
      const values: number[] = [];

      for (let rowIndex = Math.min(startRow, endRow); rowIndex <= Math.max(startRow, endRow); rowIndex += 1) {
        for (let columnIndex = Math.min(startColumn, endColumn); columnIndex <= Math.max(startColumn, endColumn); columnIndex += 1) {
          const targetColumn = flatColumns[columnIndex];
          const targetRow = rows[rowIndex];
          if (targetColumn && targetRow) {
            values.push(getNumericValue(targetRow, targetColumn.groupId, targetColumn.field, depth + 1) ?? 0);
          }
        }
      }

      if (values.length === 0) return '0';
      if (functionName === 'AVERAGE') return String(values.reduce((sum, value) => sum + value, 0) / values.length);
      if (functionName === 'MIN') return String(Math.min(...values));
      if (functionName === 'MAX') return String(Math.max(...values));
      return String(values.reduce((sum, value) => sum + value, 0));
    };

    let safeExpression = withoutEquals
      .replace(/\b(SUM|AVERAGE|MIN|MAX)\(([A-Z]+\d+):([A-Z]+\d+)\)/gi, (_, fn, from, to) =>
        calculateRange(String(fn).toUpperCase(), from, to)
      )
      .replace(/([A-Z]+\d+)/gi, (ref) => String(getReferenceValue(ref)))
      .replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');

    if (!/^[\d+\-*/().\s]+$/.test(safeExpression)) return null;

    try {
      const result = Function(`"use strict"; return (${safeExpression});`)();
      return typeof result === 'number' && Number.isFinite(result) ? result : null;
    } catch {
      return null;
    }
  };

  const getNumericValue = (row: FeeRow, groupId: string, field: FeeField, depth = 0): number | null => {
    const cell = row.cells[groupId] || emptyCell();
    if (field === 'total') {
      const official = getNumericValue(row, groupId, 'official', depth + 1);
      const attorney = getNumericValue(row, groupId, 'attorney', depth + 1);
      if (official === null && attorney === null) {
        if (!cell.official && !cell.attorney) return 0;
        return null;
      }
      return (official ?? 0) + (attorney ?? 0);
    }

    const raw = cell[field];
    if (raw.trim().startsWith('=')) return evaluateFormula(raw, row, depth + 1);
    if (!raw.trim()) return 0;
    return parseAmount(raw);
  };

  const displayTotal = (row: FeeRow, groupId: string) => {
    const value = getNumericValue(row, groupId, 'total');
    if (value !== null) return formatAmount(value, currency);
    const cell = row.cells[groupId] || emptyCell();
    if (/n\/a|na/i.test(`${cell.official} ${cell.attorney}`)) return 'N/A';
    return '-';
  };

  const getRowGrandTotal = (row: FeeRow, sourceGroups = visibleGroups) =>
    sourceGroups.reduce((sum, group) => sum + (getNumericValue(row, group.id, 'total') ?? 0), 0);

  const getServiceTotal = (row: FeeRow, service: ServiceKey) =>
    visibleGroups
      .filter((group) => group.service === service)
      .reduce((sum, group) => sum + (getNumericValue(row, group.id, 'total') ?? 0), 0);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    let nextRows = rows.filter((row) => style.includeHiddenData || row.visible);

    if (normalizedSearch) {
      nextRows = nextRows.filter((row) => {
        const countryMatch = `${row.countryName} ${row.countryCode}`.toLowerCase().includes(normalizedSearch);
        const cellMatch = visibleGroups.some((group) => {
          const cell = row.cells[group.id] || emptyCell();
          return `${group.service} ${group.label} ${cell.official} ${cell.attorney} ${displayTotal(row, group.id)}`
            .toLowerCase()
            .includes(normalizedSearch);
        });
        return countryMatch || cellMatch;
      });
    }

    if (sortKey === 'country-asc') nextRows = [...nextRows].sort((a, b) => a.countryName.localeCompare(b.countryName));
    if (sortKey === 'country-desc') nextRows = [...nextRows].sort((a, b) => b.countryName.localeCompare(a.countryName));
    if (sortKey === 'total-asc') nextRows = [...nextRows].sort((a, b) => getRowGrandTotal(a) - getRowGrandTotal(b));
    if (sortKey === 'total-desc') nextRows = [...nextRows].sort((a, b) => getRowGrandTotal(b) - getRowGrandTotal(a));

    return nextRows;
  }, [rows, search, sortKey, style.includeHiddenData, visibleGroups, currency]);

  const rowsForExport = useMemo(
    () => rows.filter((row) => style.includeHiddenData || !style.exportVisibleRowsOnly || row.visible),
    [rows, style.exportVisibleRowsOnly, style.includeHiddenData]
  );

  const selectedCellValue = useMemo(() => {
    if (!selectedCell) return '';
    const row = rows.find((item) => item.id === selectedCell.rowId);
    return row?.cells[selectedCell.groupId]?.[selectedCell.field] ?? '';
  }, [rows, selectedCell]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<ReportSnapshot>;
        if (parsed.groups?.length && parsed.rows?.length) {
          setSelectedServices(parsed.selectedServices || ['Trademark', 'Patent', 'Design']);
          setGroups(parsed.groups);
          setRows(parsed.rows.map((row) => ensureRowCells(row, parsed.groups as FeeGroup[])));
          setStyle({ ...DEFAULT_STYLE, ...(parsed.style || {}) });
          setCurrency(parsed.currency || 'USD');
          setCollapsedServices(parsed.collapsedServices || []);
        }
      }
      setTemplates(readStoredArray<SavedTemplate>(TEMPLATE_STORAGE_KEY));
      setViews(readStoredArray<SavedView>(VIEW_STORAGE_KEY));
    } catch {
      setAlert('Saved report data could not be restored.');
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const snapshot = makeSnapshot();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }, [hydrated, selectedServices, groups, rows, style, currency, collapsedServices]);

  useEffect(() => {
    if (!hydrated) return undefined;
    const interval = window.setInterval(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(makeSnapshot()));
      addAudit('Auto Save');
    }, 30000);
    return () => window.clearInterval(interval);
  }, [hydrated, selectedServices, groups, rows, style, currency, collapsedServices]);

  const updateRows = (updater: (current: FeeRow[]) => FeeRow[], action: string) => {
    pushHistory(action);
    setRows((current) => updater(current).map((row) => ensureRowCells(row)));
  };

  const updateGroups = (updater: (current: FeeGroup[]) => FeeGroup[], action: string) => {
    pushHistory(action);
    setGroups((current) => {
      const nextGroups = updater(current);
      setRows((currentRows) => currentRows.map((row) => ensureRowCells(row, nextGroups)));
      return nextGroups;
    });
  };

  const handleToggleService = (service: ServiceKey, checked: boolean) => {
    pushHistory(checked ? `Service Enabled: ${service}` : `Service Disabled: ${service}`);
    setSelectedServices((current) => {
      if (checked) {
        const nextServices = Array.from(new Set([...current, service]));
        const serviceHasGroups = groups.some((group) => group.service === service);
        if (!serviceHasGroups) {
          const newGroups = SERVICES[service].operations.map((label) => ({
            id: makeGroupId(service, label),
            service,
            label,
            visible: true,
            width: label.length > 18 ? 150 : 116,
          }));
          setGroups((currentGroups) => [...currentGroups, ...newGroups]);
          setRows((currentRows) => currentRows.map((row) => ensureRowCells(row, [...groups, ...newGroups])));
        }
        return SERVICE_ORDER.filter((item) => nextServices.includes(item));
      }
      return current.filter((item) => item !== service);
    });
  };

  const updateCell = (rowId: string, groupId: string, field: 'official' | 'attorney', value: string) => {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row;
        const cell = row.cells[groupId] || emptyCell();
        return {
          ...row,
          cells: {
            ...row.cells,
            [groupId]: {
              ...cell,
              [field]: value,
            },
          },
        };
      })
    );
  };

  const commitCellEdit = (row: FeeRow, group: FeeGroup, field: 'official' | 'attorney', oldValue: string, newValue: string) => {
    if (oldValue !== newValue) {
      addAudit(
        `Cell Updated: ${row.countryName} / ${getGroupLabel(group)} / ${getFieldLabel(field)}`,
        oldValue,
        newValue
      );
    }
  };

  const handleAddRow = () => {
    const country = getCountry(countryToAdd);
    updateRows((current) => [...current, createRow(country.code, groups)], `Row Added: ${country.name}`);
    showSuccessToast('Row added');
  };

  const handleDeleteRow = (rowId: string) => {
    const row = rows.find((item) => item.id === rowId);
    updateRows((current) => current.filter((item) => item.id !== rowId), `Row Deleted: ${row?.countryName || 'Row'}`);
  };

  const handleDuplicateRow = (rowId: string) => {
    const row = rows.find((item) => item.id === rowId);
    if (!row) return;
    updateRows((current) => {
      const index = current.findIndex((item) => item.id === rowId);
      const duplicate = { ...row, id: makeId('row-copy'), countryName: `${row.countryName} Copy`, cells: { ...row.cells } };
      const nextRows = [...current];
      nextRows.splice(index + 1, 0, duplicate);
      return nextRows;
    }, `Row Duplicated: ${row.countryName}`);
  };

  const handleCopyRow = async (row: FeeRow) => {
    const values = [
      `${row.flag} ${row.countryName}`,
      ...visibleGroups.flatMap((group) => [
        row.cells[group.id]?.official || '',
        row.cells[group.id]?.attorney || '',
        displayTotal(row, group.id),
      ]),
      formatAmount(getRowGrandTotal(row), currency),
    ];
    await navigator.clipboard?.writeText(values.join('\t'));
    addAudit(`Row Copied: ${row.countryName}`);
    showSuccessToast('Row copied');
  };

  const moveRow = (rowId: string, direction: -1 | 1) => {
    const index = rows.findIndex((row) => row.id === rowId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= rows.length) return;
    updateRows((current) => {
      const nextRows = [...current];
      const [moved] = nextRows.splice(index, 1);
      nextRows.splice(nextIndex, 0, moved);
      return nextRows;
    }, direction < 0 ? 'Row Moved Up' : 'Row Moved Down');
  };

  const handleRowDrop = (targetRowId: string) => {
    if (!draggedRowId || draggedRowId === targetRowId) return;
    const fromIndex = rows.findIndex((row) => row.id === draggedRowId);
    const toIndex = rows.findIndex((row) => row.id === targetRowId);
    if (fromIndex < 0 || toIndex < 0) return;
    updateRows((current) => {
      const nextRows = [...current];
      const [moved] = nextRows.splice(fromIndex, 1);
      nextRows.splice(toIndex, 0, moved);
      return nextRows;
    }, 'Row Reordered');
    setDraggedRowId(null);
  };

  const handleAddColumn = () => {
    if (!newColumnLabel.trim()) return;
    const group: FeeGroup = {
      id: makeId(`${newColumnService.toLowerCase()}-${slugify(newColumnLabel)}`),
      service: newColumnService,
      label: newColumnLabel.trim(),
      visible: true,
      width: 132,
    };
    updateGroups((current) => [...current, group], `Column Added: ${getGroupLabel(group)}`);
    setSelectedServices((current) => (
      current.includes(newColumnService)
        ? current
        : SERVICE_ORDER.filter((service) => [...current, newColumnService].includes(service))
    ));
    setNewColumnLabel('New Service');
    setAddColumnOpen(false);
  };

  const handleDuplicateColumn = (groupId: string) => {
    const group = groups.find((item) => item.id === groupId);
    if (!group) return;
    const duplicate: FeeGroup = {
      ...group,
      id: makeId(`${group.service.toLowerCase()}-${slugify(group.label)}-copy`),
      label: `${group.label} Copy`,
    };
    updateGroups((current) => {
      const index = current.findIndex((item) => item.id === groupId);
      const nextGroups = [...current];
      nextGroups.splice(index + 1, 0, duplicate);
      return nextGroups;
    }, `Column Duplicated: ${getGroupLabel(group)}`);
    setRows((current) =>
      current.map((row) => ({
        ...row,
        cells: {
          ...row.cells,
          [duplicate.id]: { ...(row.cells[groupId] || emptyCell()) },
        },
      }))
    );
  };

  const handleDeleteColumn = (groupId: string) => {
    const group = groups.find((item) => item.id === groupId);
    updateGroups((current) => current.filter((item) => item.id !== groupId), `Column Deleted: ${group?.label || 'Column'}`);
  };

  const handleColumnDrop = (targetGroupId: string) => {
    if (!draggedColumnId || draggedColumnId === targetGroupId) return;
    const fromIndex = groups.findIndex((group) => group.id === draggedColumnId);
    const toIndex = groups.findIndex((group) => group.id === targetGroupId);
    if (fromIndex < 0 || toIndex < 0) return;
    updateGroups((current) => {
      const nextGroups = [...current];
      const [moved] = nextGroups.splice(fromIndex, 1);
      nextGroups.splice(toIndex, 0, moved);
      return nextGroups;
    }, 'Column Reordered');
    setDraggedColumnId(null);
  };

  const toggleGroupVisibility = (groupId: string, visible: boolean) => {
    updateGroups(
      (current) => current.map((group) => (group.id === groupId ? { ...group, visible } : group)),
      visible ? 'Column Shown' : 'Column Hidden'
    );
  };

  const setAllGroupsVisible = () => {
    updateGroups((current) => current.map((group) => ({ ...group, visible: true })), 'All Columns Shown');
  };

  const setAllRowsVisible = () => {
    updateRows((current) => current.map((row) => ({ ...row, visible: true })), 'All Rows Shown');
  };

  const hideEmptyRows = () => {
    updateRows((current) =>
      current.map((row) => {
        const hasAnyValue = groups.some((group) => {
          const cell = row.cells[group.id] || emptyCell();
          return cell.official.trim() || cell.attorney.trim();
        });
        return { ...row, visible: hasAnyValue };
      }),
    'Empty Rows Hidden'
    );
  };

  const hideZeroRows = () => {
    updateRows((current) =>
      current.map((row) => ({ ...row, visible: getRowGrandTotal(row, groups) !== 0 })),
    'Zero Value Rows Hidden'
    );
  };

  const hideEmptyColumns = () => {
    updateGroups((current) =>
      current.map((group) => {
        const hasAnyValue = rows.some((row) => {
          const cell = row.cells[group.id] || emptyCell();
          return cell.official.trim() || cell.attorney.trim();
        });
        return { ...group, visible: hasAnyValue };
      }),
    'Empty Columns Hidden'
    );
  };

  const hideZeroColumns = () => {
    updateGroups((current) =>
      current.map((group) => {
        const hasNonZero = rows.some((row) => (getNumericValue(row, group.id, 'total') ?? 0) !== 0);
        return { ...group, visible: hasNonZero };
      }),
    'Zero Columns Hidden'
    );
  };

  const toggleCollapsedService = (service: ServiceKey) => {
    pushHistory(`Service ${collapsedServices.includes(service) ? 'Expanded' : 'Collapsed'}: ${service}`);
    setCollapsedServices((current) =>
      current.includes(service) ? current.filter((item) => item !== service) : [...current, service]
    );
  };

  const handleUndo = () => {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    setRedoStack((current) => [...current, makeSnapshot()]);
    setUndoStack((current) => current.slice(0, -1));
    restoreSnapshot(previous);
    addAudit('Undo');
  };

  const handleRedo = () => {
    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    setUndoStack((current) => [...current, makeSnapshot()]);
    setRedoStack((current) => current.slice(0, -1));
    restoreSnapshot(next);
    addAudit('Redo');
  };

  const buildExportRows = (sourceRows = rowsForExport, sourceGroups = exportGroups) => {
    const topHeader = ['Country'];
    const secondHeader = [''];
    const merges: SheetMerge[] = [{ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }];
    let columnIndex = 1;

    sourceGroups.forEach((group) => {
      topHeader.push(getGroupLabel(group), '', '');
      secondHeader.push(
        `Official Fee (${currency})`,
        `Attorney Fee (${currency})`,
        `TOTAL (${currency})`
      );
      merges.push({ s: { r: 0, c: columnIndex }, e: { r: 0, c: columnIndex + 2 } });
      columnIndex += 3;
    });

    topHeader.push('Grand Total');
    secondHeader.push(`TOTAL (${currency})`);
    merges.push({ s: { r: 0, c: columnIndex }, e: { r: 1, c: columnIndex } });

    const dataRows = sourceRows.map((row) => [
      `${row.flag} ${row.countryName}${style.showCountryCode ? ` (${row.countryCode})` : ''}`,
      ...sourceGroups.flatMap((group) => {
        const cell = row.cells[group.id] || emptyCell();
        return [
          cell.official,
          cell.attorney,
          displayTotal(row, group.id),
        ];
      }),
      formatAmount(getRowGrandTotal(row, sourceGroups), currency),
    ]);

    return { aoa: [topHeader, secondHeader, ...dataRows], merges };
  };

  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const { aoa, merges } = buildExportRows();
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    worksheet['!merges'] = merges;
    worksheet['!cols'] = aoa[0].map((_, index) => ({ wch: index === 0 ? 26 : 16 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'IP Fee Report');
    XLSX.writeFile(workbook, `${exportFileName()}.xlsx`);
    addAudit('Excel Export Generated');
    showSuccessToast('Excel exported');
  };

  const exportCSV = () => {
    const { aoa } = buildExportRows();
    const csv = aoa
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${exportFileName()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    addAudit('CSV Export Generated');
  };

  const exportPDF = async () => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const { aoa } = buildExportRows();
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' });
    autoTable(doc, {
      head: [aoa[0], aoa[1]],
      body: aoa.slice(2),
      styles: {
        fontSize: 6,
        cellPadding: 2,
        lineColor: style.borderColor,
        lineWidth: 0.4,
        halign: 'center',
      },
      headStyles: {
        fillColor: [245, 191, 141],
        textColor: [17, 24, 39],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [109, 185, 201],
      },
      bodyStyles: {
        fillColor: [118, 195, 210],
      },
      margin: { top: 24, left: 18, right: 18 },
    });
    doc.save(`${exportFileName()}.pdf`);
    addAudit('PDF Export Generated');
  };

  const printReport = () => {
    const reportHtml = document.getElementById('fee-report-table')?.outerHTML;
    if (!reportHtml) return;
    const printWindow = window.open('', '_blank', 'width=1400,height=900');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>IP Services Fee Report</title>
          <style>
            body { margin: 16px; font-family: ${style.fontFamily}; }
            table { border-collapse: collapse; width: max-content; min-width: 100%; }
            th, td { border: ${style.borderWidth}px solid ${style.borderColor}; padding: 4px; font-size: ${style.fontSize}px; text-align: ${style.alignment}; }
            th { font-weight: 700; }
            input, button { display: none !important; }
          </style>
        </head>
        <body>${reportHtml}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    addAudit('Print View Generated');
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(makeSnapshot(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${exportFileName()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    addAudit('JSON Export Generated');
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      pushHistory('Import Started');
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension === 'json') {
        const parsed = JSON.parse(await file.text()) as Partial<ReportSnapshot>;
        if (!parsed.groups?.length || !parsed.rows?.length) throw new Error('Invalid JSON report');
        setSelectedServices(parsed.selectedServices || selectedServices);
        setGroups(parsed.groups);
        setRows(parsed.rows);
        setStyle({ ...DEFAULT_STYLE, ...(parsed.style || {}) });
        setCurrency(parsed.currency || currency);
        setCollapsedServices(parsed.collapsedServices || []);
      } else {
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { raw: false });
        const nextRows = jsonRows.map((item) => {
          const countryName = String(item.Country || item.country || '').replace(/^[^\w]+/, '').trim();
          const country = COUNTRY_OPTIONS.find((option) =>
            option.name.toLowerCase() === countryName.toLowerCase() ||
            option.code.toLowerCase() === countryName.toLowerCase()
          ) || { code: countryName.slice(0, 2).toUpperCase() || 'NA', name: countryName || 'Imported Country', flag: '🏳️' };
          const row = createRow(country.code, groups);
          row.countryName = country.name;
          row.flag = country.flag;

          groups.forEach((group) => {
            const label = getGroupLabel(group);
            row.cells[group.id] = {
              official: String(item[`${label} Official Fee`] || item[`${label} Official`] || ''),
              attorney: String(item[`${label} Attorney Fee`] || item[`${label} Attorney`] || ''),
            };
          });

          return row;
        }).filter((row) => row.countryName);

        if (nextRows.length === 0) throw new Error('No rows found');
        setRows(nextRows);
      }
      addAudit(`Imported File: ${file.name}`);
      showSuccessToast('Import completed');
    } catch (error) {
      setAlert(error instanceof Error ? error.message : 'Import failed');
    } finally {
      event.target.value = '';
    }
  };

  const saveTemplate = () => {
    if (!templateName.trim()) return;
    const template: SavedTemplate = {
      id: makeId('template'),
      name: templateName.trim(),
      createdAt: new Date().toISOString(),
      selectedServices,
      groups,
      style,
      currency,
    };
    const nextTemplates = [template, ...templates];
    setTemplates(nextTemplates);
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(nextTemplates));
    setTemplateName('');
    addAudit(`Template Saved: ${template.name}`);
  };

  const loadTemplate = (template: SavedTemplate) => {
    pushHistory(`Template Loaded: ${template.name}`);
    setSelectedServices(template.selectedServices);
    setGroups(template.groups);
    setRows((current) => current.map((row) => ensureRowCells(row, template.groups)));
    setStyle(template.style);
    setCurrency(template.currency);
  };

  const duplicateTemplate = (template: SavedTemplate) => {
    const duplicate = { ...template, id: makeId('template-copy'), name: `${template.name} Copy`, createdAt: new Date().toISOString() };
    const nextTemplates = [duplicate, ...templates];
    setTemplates(nextTemplates);
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(nextTemplates));
    addAudit(`Template Duplicated: ${template.name}`);
  };

  const deleteTemplate = (templateId: string) => {
    const nextTemplates = templates.filter((template) => template.id !== templateId);
    setTemplates(nextTemplates);
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(nextTemplates));
    addAudit('Template Deleted');
  };

  const saveView = () => {
    if (!viewName.trim()) return;
    const view: SavedView = {
      id: makeId('view'),
      name: viewName.trim(),
      createdAt: new Date().toISOString(),
      selectedServices,
      rowVisibility: Object.fromEntries(rows.map((row) => [row.id, row.visible])),
      groupVisibility: Object.fromEntries(groups.map((group) => [group.id, group.visible])),
      collapsedServices,
      style,
    };
    const nextViews = [view, ...views];
    setViews(nextViews);
    localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(nextViews));
    setViewName('');
    addAudit(`Saved View Created: ${view.name}`);
  };

  const loadView = (view: SavedView) => {
    pushHistory(`Saved View Loaded: ${view.name}`);
    setSelectedServices(view.selectedServices);
    setRows((current) => current.map((row) => ({ ...row, visible: view.rowVisibility[row.id] ?? row.visible })));
    setGroups((current) => current.map((group) => ({ ...group, visible: view.groupVisibility[group.id] ?? group.visible })));
    setCollapsedServices(view.collapsedServices);
    setStyle(view.style);
  };

  const deleteView = (viewId: string) => {
    const nextViews = views.filter((view) => view.id !== viewId);
    setViews(nextViews);
    localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(nextViews));
    addAudit('Saved View Deleted');
  };

  const selectedColumn = groups.find((group) => group.id === selectedColumnId) || visibleGroups[0];
  const selectedServiceGroups = useMemo(
    () => SERVICE_ORDER.map((service) => ({
      service,
      groups: visibleGroups.filter((group) => group.service === service),
    })).filter((section) => section.groups.length > 0 && selectedServices.includes(section.service)),
    [visibleGroups, selectedServices]
  );
  const getHeaderBackground = (service: ServiceKey) => {
    if (service === 'Trademark') return style.trademarkHeader;
    if (service === 'Patent' || service === 'Design') return style.secondaryHeader;
    return SERVICES[service].headerColor;
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#F4F6F8' }}>
      <Topbar title="IP Services Fee Report Builder" />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 340px' }, gap: 2, p: 3, flex: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          {alert && (
            <Alert severity="warning" onClose={() => setAlert('')} sx={{ mb: 2 }}>
              {alert}
            </Alert>
          )}

          <Paper sx={{ p: 2, mb: 2, borderRadius: 1 }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} sx={{ alignItems: { lg: 'center' } }}>
              <Box sx={{ minWidth: 280 }}>
                <Typography sx={{ fontWeight: 800, mb: 1 }}>Services</Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
                  {SERVICE_ORDER.map((service) => (
                    <FormControlLabel
                      key={service}
                      control={
                        <Checkbox
                          size="small"
                          checked={selectedServices.includes(service)}
                          onChange={(event) => handleToggleService(service, event.target.checked)}
                        />
                      }
                      label={service}
                      sx={{ mr: 1 }}
                    />
                  ))}
                </Stack>
              </Box>

              <Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', lg: 'block' } }} />

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ flex: 1 }}>
                <FormControl size="small" sx={{ minWidth: 170 }}>
                  <InputLabel>Country</InputLabel>
                  <Select
                    label="Country"
                    value={countryToAdd}
                    onChange={(event) => setCountryToAdd(event.target.value)}
                  >
                    {COUNTRY_OPTIONS.map((country) => (
                      <MenuItem key={country.code} value={country.code}>
                        {country.flag} {country.name} ({country.code})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button variant="contained" onClick={handleAddRow}>Add Row</Button>
                <Button variant="outlined" onClick={() => setAddColumnOpen(true)}>Add Column</Button>
                <Button variant="outlined" onClick={() => importInputRef.current?.click()}>Import</Button>
                <Button variant="outlined" onClick={(event) => setExportAnchor(event.currentTarget)}>Export</Button>
                <Button variant="outlined" disabled={undoStack.length === 0} onClick={handleUndo}>Undo</Button>
                <Button variant="outlined" disabled={redoStack.length === 0} onClick={handleRedo}>Redo</Button>
              </Stack>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mt: 2 }}>
              <TextField
                size="small"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                label="Search"
                sx={{ minWidth: 260 }}
              />
              <FormControl size="small" sx={{ minWidth: 170 }}>
                <InputLabel>Sort</InputLabel>
                <Select label="Sort" value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
                  <MenuItem value="manual">Manual</MenuItem>
                  <MenuItem value="country-asc">Country A-Z</MenuItem>
                  <MenuItem value="country-desc">Country Z-A</MenuItem>
                  <MenuItem value="total-asc">Total Low-High</MenuItem>
                  <MenuItem value="total-desc">Total High-Low</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Currency</InputLabel>
                <Select label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value as CurrencyCode)}>
                  {Object.keys(EXCHANGE_RATES).map((item) => (
                    <MenuItem key={item} value={item}>{item}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                label="Formula"
                value={selectedCellValue}
                disabled={!selectedCell}
                onChange={(event) => {
                  if (!selectedCell) return;
                  updateCell(selectedCell.rowId, selectedCell.groupId, selectedCell.field, event.target.value);
                }}
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start">=</InputAdornment>,
                  },
                }}
                sx={{ flex: 1, minWidth: 260 }}
              />
            </Stack>
          </Paper>

          <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', rowGap: 1 }}>
            {selectedServices.map((service) => {
              const serviceGroups = visibleGroups.filter((group) => group.service === service);
              const hiddenCount = serviceGroups.length * 3;
              const collapsed = collapsedServices.includes(service);
              return (
                <Chip
                  key={service}
                  label={collapsed ? `${service} (${hiddenCount} columns hidden)` : `${service} (${serviceGroups.length} groups)`}
                  onClick={() => toggleCollapsedService(service)}
                  sx={{
                    bgcolor: SERVICES[service].headerColor,
                    color: SERVICES[service].headerTextColor,
                    border: `1px solid ${SERVICES[service].accentColor}`,
                    fontWeight: 700,
                  }}
                />
              );
            })}
          </Stack>

          <TableContainer
            component={Paper}
            sx={{
              borderRadius: 1,
              maxHeight: 'calc(100vh - 310px)',
              overflow: 'auto',
              border: `${style.borderWidth}px solid ${style.borderColor}`,
            }}
          >
            <Table
              id="fee-report-table"
              stickyHeader
              size="small"
              sx={{
                minWidth: 1280,
                borderCollapse: 'collapse',
                '& th, & td': {
                  border: `${style.borderWidth}px solid ${style.borderColor}`,
                  fontFamily: style.fontFamily,
                  fontSize: `${style.fontSize}px`,
                  color: style.bodyTextColor,
                  textAlign: style.alignment,
                  p: 0.35,
                },
                '& th': {
                  color: style.headerTextColor,
                  fontWeight: 800,
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell
                    rowSpan={2}
                    sx={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 5,
                      minWidth: 252,
                      bgcolor: style.trademarkHeader,
                    }}
                  >
                    Country
                  </TableCell>
                  {selectedServiceGroups.map(({ service, groups: serviceGroups }) => {
                    if (collapsedServices.includes(service)) {
                      return (
                        <TableCell
                          key={`${service}-collapsed`}
                          colSpan={1}
                          sx={{
                            minWidth: 150,
                            bgcolor: getHeaderBackground(service),
                            cursor: 'pointer',
                          }}
                          onClick={() => toggleCollapsedService(service)}
                        >
                          {service} ({serviceGroups.length * 3} columns hidden)
                        </TableCell>
                      );
                    }

                    return serviceGroups.map((group) => (
                      <TableCell
                        key={group.id}
                        draggable
                        onDragStart={() => setDraggedColumnId(group.id)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => handleColumnDrop(group.id)}
                        colSpan={3}
                        sx={{
                          minWidth: group.width * 3,
                          bgcolor: getHeaderBackground(group.service),
                          cursor: 'grab',
                        }}
                      >
                        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', justifyContent: 'center' }}>
                          <span>{getGroupLabel(group)}</span>
                          <Tooltip title="Hide column">
                            <IconButton size="small" onClick={() => toggleGroupVisibility(group.id, false)} sx={{ width: 20, height: 20 }}>
                              <span style={{ fontSize: 12 }}>×</span>
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    ));
                  })}
                  <TableCell
                    rowSpan={2}
                    sx={{
                      minWidth: 118,
                      bgcolor: '#E7EEF7',
                      fontWeight: 900,
                    }}
                  >
                    Grand Total
                  </TableCell>
                </TableRow>
                <TableRow>
                  {selectedServiceGroups.map(({ service, groups: serviceGroups }) => {
                    if (collapsedServices.includes(service)) {
                      return (
                        <TableCell key={`${service}-collapsed-total`} sx={{ bgcolor: getHeaderBackground(service), fontWeight: 800 }}>
                          TOTAL ({currency})
                        </TableCell>
                      );
                    }

                    return serviceGroups.flatMap((group) => ([
                      <TableCell key={`${group.id}-official`} sx={{ minWidth: group.width, bgcolor: getHeaderBackground(group.service) }}>
                        Official Fee ({currency})
                      </TableCell>,
                      <TableCell key={`${group.id}-attorney`} sx={{ minWidth: group.width, bgcolor: getHeaderBackground(group.service) }}>
                        Attorney Fee ({currency})
                      </TableCell>,
                      <TableCell key={`${group.id}-total`} sx={{ minWidth: group.width, bgcolor: getHeaderBackground(group.service), fontWeight: 900 }}>
                        TOTAL ({currency})
                      </TableCell>,
                    ]));
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRows.map((row, rowIndex) => (
                  <TableRow
                    key={row.id}
                    draggable
                    onDragStart={() => setDraggedRowId(row.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleRowDrop(row.id)}
                    sx={{
                      height: row.height,
                      bgcolor: rowIndex % 2 === 0 ? style.bodyBackground : style.alternateBodyBackground,
                      opacity: row.visible ? 1 : 0.48,
                    }}
                  >
                    <TableCell
                      sx={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 2,
                        bgcolor: rowIndex % 2 === 0 ? style.bodyBackground : style.alternateBodyBackground,
                        fontWeight: 800,
                        textAlign: 'left !important',
                      }}
                    >
                      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                        <Checkbox
                          size="small"
                          checked={row.visible}
                          onChange={(event) => {
                            updateRows(
                              (current) => current.map((item) => (item.id === row.id ? { ...item, visible: event.target.checked } : item)),
                              event.target.checked ? 'Row Shown' : 'Row Hidden'
                            );
                          }}
                          sx={{ p: 0 }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <span>{row.flag} {row.countryName}{style.showCountryCode ? ` (${row.countryCode})` : ''}</span>
                        </Box>
                        <Tooltip title="Move up">
                          <IconButton size="small" onClick={() => moveRow(row.id, -1)} sx={{ width: 22, height: 22 }}>↑</IconButton>
                        </Tooltip>
                        <Tooltip title="Move down">
                          <IconButton size="small" onClick={() => moveRow(row.id, 1)} sx={{ width: 22, height: 22 }}>↓</IconButton>
                        </Tooltip>
                        <Tooltip title="Duplicate">
                          <IconButton size="small" onClick={() => handleDuplicateRow(row.id)} sx={{ width: 22, height: 22 }}>⧉</IconButton>
                        </Tooltip>
                        <Tooltip title="Copy">
                          <IconButton size="small" onClick={() => handleCopyRow(row)} sx={{ width: 22, height: 22 }}>⧠</IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => handleDeleteRow(row.id)} sx={{ width: 22, height: 22 }}>×</IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>

                    {selectedServiceGroups.map(({ service, groups: serviceGroups }) => {
                      if (collapsedServices.includes(service)) {
                        return (
                          <TableCell key={`${row.id}-${service}-total`} sx={{ fontWeight: 900 }}>
                            {formatAmount(getServiceTotal(row, service), currency)}
                          </TableCell>
                        );
                      }

                      return serviceGroups.flatMap((group) => {
                        const cell = row.cells[group.id] || emptyCell();
                        return [
                          <TableCell key={`${row.id}-${group.id}-official`}>
                            <TextField
                              variant="standard"
                              value={cell.official}
                              onFocus={() => setSelectedCell({ rowId: row.id, groupId: group.id, field: 'official' })}
                              onChange={(event) => updateCell(row.id, group.id, 'official', event.target.value)}
                              onBlur={(event) => commitCellEdit(row, group, 'official', cell.official, event.target.value)}
                              slotProps={{ htmlInput: { style: { textAlign: style.alignment, fontFamily: style.fontFamily, fontSize: style.fontSize } } }}
                              sx={{ width: '100%', '& input': { p: 0.2 } }}
                            />
                          </TableCell>,
                          <TableCell key={`${row.id}-${group.id}-attorney`}>
                            <TextField
                              variant="standard"
                              value={cell.attorney}
                              onFocus={() => setSelectedCell({ rowId: row.id, groupId: group.id, field: 'attorney' })}
                              onChange={(event) => updateCell(row.id, group.id, 'attorney', event.target.value)}
                              onBlur={(event) => commitCellEdit(row, group, 'attorney', cell.attorney, event.target.value)}
                              slotProps={{ htmlInput: { style: { textAlign: style.alignment, fontFamily: style.fontFamily, fontSize: style.fontSize } } }}
                              sx={{ width: '100%', '& input': { p: 0.2 } }}
                            />
                          </TableCell>,
                          <TableCell key={`${row.id}-${group.id}-total`} sx={{ fontWeight: 900 }}>
                            {displayTotal(row, group.id)}
                          </TableCell>,
                        ];
                      });
                    })}
                    <TableCell sx={{ fontWeight: 900, bgcolor: 'rgba(255,255,255,0.18)' }}>
                      {formatAmount(getRowGrandTotal(row), currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        <Paper sx={{ borderRadius: 1, overflow: 'hidden', alignSelf: 'start', position: { xl: 'sticky' }, top: { xl: 16 } }}>
          <Tabs value={panel} onChange={(_, value) => setPanel(value)} variant="scrollable" scrollButtons="auto">
            <Tab value="visibility" label="Visibility" />
            <Tab value="style" label="Style" />
            <Tab value="templates" label="Templates" />
            <Tab value="audit" label="Audit" />
          </Tabs>
          <Divider />

          {panel === 'visibility' && (
            <Box sx={{ p: 2, maxHeight: { xl: 'calc(100vh - 190px)' }, overflow: 'auto' }}>
              <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
                <Button size="small" variant="outlined" onClick={setAllGroupsVisible}>Show Columns</Button>
                <Button size="small" variant="outlined" onClick={setAllRowsVisible}>Show Rows</Button>
                <Button size="small" variant="outlined" onClick={hideEmptyRows}>Hide Empty Rows</Button>
                <Button size="small" variant="outlined" onClick={hideZeroRows}>Hide Zero Rows</Button>
                <Button size="small" variant="outlined" onClick={hideEmptyColumns}>Hide Empty Columns</Button>
                <Button size="small" variant="outlined" onClick={hideZeroColumns}>Hide Zero Columns</Button>
              </Stack>

              <Typography sx={{ fontWeight: 800, mb: 1 }}>Columns</Typography>
              <Stack spacing={1}>
                {selectedGroups.map((group) => (
                  <Paper key={group.id} variant="outlined" sx={{ p: 1, borderRadius: 1 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Checkbox
                        size="small"
                        checked={group.visible}
                        onChange={(event) => toggleGroupVisibility(group.id, event.target.checked)}
                      />
                      <TextField
                        size="small"
                        value={group.label}
                        onChange={(event) => {
                          const value = event.target.value;
                          setGroups((current) => current.map((item) => (item.id === group.id ? { ...item, label: value } : item)));
                        }}
                        onBlur={() => addAudit(`Column Renamed: ${getGroupLabel(group)}`)}
                        sx={{ flex: 1 }}
                      />
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: 'center' }}>
                      <FormControl size="small" sx={{ minWidth: 118 }}>
                        <InputLabel>Service</InputLabel>
                        <Select
                          label="Service"
                          value={group.service}
                          onChange={(event) => {
                            const nextService = event.target.value as ServiceKey;
                            updateGroups(
                              (current) => current.map((item) => (item.id === group.id ? { ...item, service: nextService } : item)),
                              'Column Service Updated'
                            );
                          }}
                        >
                          {SERVICE_ORDER.map((service) => <MenuItem key={service} value={service}>{service}</MenuItem>)}
                        </Select>
                      </FormControl>
                      <TextField
                        size="small"
                        label="Width"
                        type="number"
                        value={group.width}
                        onChange={(event) => {
                          const width = Math.max(80, Number(event.target.value) || 116);
                          setGroups((current) => current.map((item) => (item.id === group.id ? { ...item, width } : item)));
                        }}
                        sx={{ width: 92 }}
                      />
                      <Button size="small" onClick={() => handleDuplicateColumn(group.id)}>Duplicate</Button>
                      <Button size="small" color="error" onClick={() => handleDeleteColumn(group.id)}>Delete</Button>
                    </Stack>
                  </Paper>
                ))}
              </Stack>

              <Typography sx={{ fontWeight: 800, mt: 3, mb: 1 }}>Rows</Typography>
              <List dense disablePadding>
                {rows.map((row) => (
                  <ListItemButton key={row.id} sx={{ px: 0.5, borderRadius: 1 }}>
                    <Checkbox
                      size="small"
                      checked={row.visible}
                      onChange={(event) => {
                        updateRows(
                          (current) => current.map((item) => (item.id === row.id ? { ...item, visible: event.target.checked } : item)),
                          event.target.checked ? 'Row Shown' : 'Row Hidden'
                        );
                      }}
                    />
                    <ListItemText primary={`${row.flag} ${row.countryName}`} secondary={`${row.height}px`} />
                    <Slider
                      min={22}
                      max={58}
                      size="small"
                      value={row.height}
                      onChange={(_, value) => {
                        const height = Array.isArray(value) ? value[0] : value;
                        setRows((current) => current.map((item) => (item.id === row.id ? { ...item, height } : item)));
                      }}
                      sx={{ width: 82, mr: 1 }}
                    />
                  </ListItemButton>
                ))}
              </List>
            </Box>
          )}

          {panel === 'style' && (
            <Box sx={{ p: 2, maxHeight: { xl: 'calc(100vh - 190px)' }, overflow: 'auto' }}>
              <Stack spacing={2}>
                <TextField
                  label="Trademark Header"
                  type="color"
                  value={style.trademarkHeader}
                  onChange={(event) => setStyle((current) => ({ ...current, trademarkHeader: event.target.value }))}
                  size="small"
                />
                <TextField
                  label="Secondary Header"
                  type="color"
                  value={style.secondaryHeader}
                  onChange={(event) => setStyle((current) => ({ ...current, secondaryHeader: event.target.value }))}
                  size="small"
                />
                <TextField
                  label="Row Background"
                  type="color"
                  value={style.bodyBackground}
                  onChange={(event) => setStyle((current) => ({ ...current, bodyBackground: event.target.value }))}
                  size="small"
                />
                <TextField
                  label="Alternate Row"
                  type="color"
                  value={style.alternateBodyBackground}
                  onChange={(event) => setStyle((current) => ({ ...current, alternateBodyBackground: event.target.value }))}
                  size="small"
                />
                <TextField
                  label="Border Color"
                  type="color"
                  value={style.borderColor}
                  onChange={(event) => setStyle((current) => ({ ...current, borderColor: event.target.value }))}
                  size="small"
                />
                <TextField
                  label="Font Family"
                  value={style.fontFamily}
                  onChange={(event) => setStyle((current) => ({ ...current, fontFamily: event.target.value }))}
                  size="small"
                />
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>Font Size</Typography>
                  <Slider
                    min={10}
                    max={18}
                    value={style.fontSize}
                    onChange={(_, value) => setStyle((current) => ({ ...current, fontSize: Array.isArray(value) ? value[0] : value }))}
                  />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>Border Thickness</Typography>
                  <Slider
                    min={1}
                    max={4}
                    value={style.borderWidth}
                    onChange={(_, value) => setStyle((current) => ({ ...current, borderWidth: Array.isArray(value) ? value[0] : value }))}
                  />
                </Box>
                <ToggleButtonGroup
                  exclusive
                  value={style.alignment}
                  onChange={(_, value) => {
                    if (value) setStyle((current) => ({ ...current, alignment: value }));
                  }}
                  size="small"
                >
                  <ToggleButton value="left">Left</ToggleButton>
                  <ToggleButton value="center">Center</ToggleButton>
                  <ToggleButton value="right">Right</ToggleButton>
                </ToggleButtonGroup>
                <FormControlLabel
                  control={
                    <Switch
                      checked={style.showCountryCode}
                      onChange={(event) => setStyle((current) => ({ ...current, showCountryCode: event.target.checked }))}
                    />
                  }
                  label="Country Codes"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={style.exportVisibleRowsOnly}
                      onChange={(event) => setStyle((current) => ({ ...current, exportVisibleRowsOnly: event.target.checked }))}
                    />
                  }
                  label="Export Visible Rows"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={style.exportVisibleColumnsOnly}
                      onChange={(event) => setStyle((current) => ({ ...current, exportVisibleColumnsOnly: event.target.checked }))}
                    />
                  }
                  label="Export Visible Columns"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={style.includeHiddenData}
                      onChange={(event) => setStyle((current) => ({ ...current, includeHiddenData: event.target.checked }))}
                    />
                  }
                  label="Include Hidden Data"
                />
              </Stack>
            </Box>
          )}

          {panel === 'templates' && (
            <Box sx={{ p: 2, maxHeight: { xl: 'calc(100vh - 190px)' }, overflow: 'auto' }}>
              <Typography sx={{ fontWeight: 800, mb: 1 }}>Templates</Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <TextField size="small" label="Template Name" value={templateName} onChange={(event) => setTemplateName(event.target.value)} sx={{ flex: 1 }} />
                <Button variant="contained" onClick={saveTemplate}>Save</Button>
              </Stack>
              <Stack spacing={1}>
                {templates.map((template) => (
                  <Paper key={template.id} variant="outlined" sx={{ p: 1, borderRadius: 1 }}>
                    <Typography sx={{ fontWeight: 700 }}>{template.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{new Date(template.createdAt).toLocaleString()}</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      <Button size="small" onClick={() => loadTemplate(template)}>Load</Button>
                      <Button size="small" onClick={() => duplicateTemplate(template)}>Duplicate</Button>
                      <Button size="small" color="error" onClick={() => deleteTemplate(template.id)}>Delete</Button>
                    </Stack>
                  </Paper>
                ))}
              </Stack>

              <Divider sx={{ my: 2 }} />
              <Typography sx={{ fontWeight: 800, mb: 1 }}>Saved Views</Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <TextField size="small" label="View Name" value={viewName} onChange={(event) => setViewName(event.target.value)} sx={{ flex: 1 }} />
                <Button variant="contained" onClick={saveView}>Save</Button>
              </Stack>
              <Stack spacing={1}>
                {views.map((view) => (
                  <Paper key={view.id} variant="outlined" sx={{ p: 1, borderRadius: 1 }}>
                    <Typography sx={{ fontWeight: 700 }}>{view.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{new Date(view.createdAt).toLocaleString()}</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      <Button size="small" onClick={() => loadView(view)}>Load</Button>
                      <Button size="small" color="error" onClick={() => deleteView(view.id)}>Delete</Button>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}

          {panel === 'audit' && (
            <Box sx={{ p: 2, maxHeight: { xl: 'calc(100vh - 190px)' }, overflow: 'auto' }}>
              <Typography sx={{ fontWeight: 800, mb: 1 }}>Audit Log</Typography>
              <List dense disablePadding>
                {auditLog.map((entry) => (
                  <ListItemButton key={entry.id} sx={{ px: 0, alignItems: 'flex-start' }}>
                    <ListItemText
                      primary={entry.action}
                      secondary={`${entry.user} · ${new Date(entry.at).toLocaleString()}${entry.oldValue || entry.newValue ? ` · ${entry.oldValue || '-'} → ${entry.newValue || '-'}` : ''}`}
                    />
                  </ListItemButton>
                ))}
                {auditLog.length === 0 && (
                  <Typography color="text.secondary">No changes recorded.</Typography>
                )}
              </List>
            </Box>
          )}
        </Paper>
      </Box>

      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.json"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />

      <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}>
        <MenuItem onClick={() => { setExportAnchor(null); exportExcel(); }}>Excel (.xlsx)</MenuItem>
        <MenuItem onClick={() => { setExportAnchor(null); exportPDF(); }}>PDF (.pdf)</MenuItem>
        <MenuItem onClick={() => { setExportAnchor(null); exportCSV(); }}>CSV (.csv)</MenuItem>
        <MenuItem onClick={() => { setExportAnchor(null); exportJson(); }}>JSON (.json)</MenuItem>
        <MenuItem onClick={() => { setExportAnchor(null); printReport(); }}>Print</MenuItem>
      </Menu>

      <Dialog open={addColumnOpen} onClose={() => setAddColumnOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Column</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Service</InputLabel>
              <Select
                label="Service"
                value={newColumnService}
                onChange={(event) => setNewColumnService(event.target.value as ServiceKey)}
              >
                {SERVICE_ORDER.map((service) => (
                  <MenuItem key={service} value={service}>{service}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Column Name"
              value={newColumnLabel}
              onChange={(event) => setNewColumnLabel(event.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddColumnOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddColumn}>Add</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
