'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import Topbar from '@/components/layout/Topbar';
import {
  FeeBuilderDraft,
  FeeBuilderServiceKey,
} from '@/lib/fee-builder-drafts';
import { showSuccessToast } from '@/components/feedback/heroToast';
import { Country, countriesService } from '@/services/countries.service';
import { Continent, continentsService } from '@/services/continents.service';
import { PricingRule, pricingRulesService } from '@/services/pricing-rules.service';
import { feeBuilderDraftsService } from '@/services/fee-builder-drafts.service';

export const dynamic = 'force-dynamic';

const PRICING_RULE_PAGE_SIZE = 100;
const OPTION_PAGE_SIZE = 100;
const SERVICE_ORDER: FeeBuilderServiceKey[] = ['Trademark', 'Patent', 'Design', 'Copyright', 'Litigation'];

const DEFAULT_COLUMN_VISIBILITY: FeeBuilderDraft['columnVisibility'] = {
  country: true,
  procedure: true,
  officeFee: true,
  attorneyFee: true,
  total: true,
  status: true,
  updatedAt: true,
};

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const makeCountryKey = (rule: PricingRule) =>
  `${rule.countryName || 'Unknown'}::${rule.countryAbbreviation || ''}`.toLowerCase();

const formatMoney = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });

const formatDraftDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
};

const getDraftContinent = (draft: FeeBuilderDraft) =>
  draft.selectedContinent?.trim() || 'All Continents';

const loadAllCountries = async () => {
  const firstResponse = await countriesService.list({ page: 1, limit: OPTION_PAGE_SIZE });
  const pageCount = Math.ceil((firstResponse.total || 0) / OPTION_PAGE_SIZE);
  const remainingResponses =
    pageCount > 1
      ? await Promise.all(
          Array.from({ length: pageCount - 1 }, (_item, index) =>
            countriesService.list({ page: index + 2, limit: OPTION_PAGE_SIZE })
          )
        )
      : [];

  return [
    ...(firstResponse.countries || []),
    ...remainingResponses.flatMap((response) => response.countries || []),
  ];
};

const loadAllPricingRules = async () => {
  const firstResponse = await pricingRulesService.list({ page: 1, limit: PRICING_RULE_PAGE_SIZE });
  const pageCount = Math.ceil((firstResponse.total || 0) / PRICING_RULE_PAGE_SIZE);
  const remainingResponses =
    pageCount > 1
      ? await Promise.all(
          Array.from({ length: pageCount - 1 }, (_item, index) =>
            pricingRulesService.list({ page: index + 2, limit: PRICING_RULE_PAGE_SIZE })
          )
        )
      : [];

  return [
    ...(firstResponse.pricingRules || []),
    ...remainingResponses.flatMap((response) => response.pricingRules || []),
  ];
};

export default function FeeBuilderDraftsPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<FeeBuilderDraft[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [continents, setContinents] = useState<Continent[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [newDraftOpen, setNewDraftOpen] = useState(false);
  const [newDraftName, setNewDraftName] = useState('');
  const [newDraftContinent, setNewDraftContinent] = useState('');
  const [newDraftCountry, setNewDraftCountry] = useState('');
  const [newDraftProcedure, setNewDraftProcedure] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let active = true;

    const loadDrafts = async () => {
      try {
        const savedDrafts = await feeBuilderDraftsService.list();
        if (!active) return;
        setDrafts(savedDrafts);
      } catch (err) {
        if (!active) return;
        setFormError(err instanceof Error ? err.message : 'Failed to load saved drafts');
      } finally {
        if (active) setLoaded(true);
      }
    };

    loadDrafts();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadOptions = async () => {
      setOptionsLoading(true);
      setFormError('');
      try {
        const [countriesResult, continentsResult, rulesResult] = await Promise.all([
          loadAllCountries(),
          continentsService.list(),
          loadAllPricingRules(),
        ]);

        if (!active) return;

        setCountries(countriesResult);
        setContinents(Array.isArray(continentsResult.continents) ? continentsResult.continents : []);
        setPricingRules(rulesResult);
      } catch (err) {
        if (!active) return;
        setFormError(err instanceof Error ? err.message : 'Failed to load pricing rule options');
      } finally {
        if (active) setOptionsLoading(false);
      }
    };

    loadOptions();

    return () => {
      active = false;
    };
  }, []);

  const sortedDrafts = useMemo(
    () =>
      [...drafts].sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime()
      ),
    [drafts]
  );

  const procedureOptions = useMemo(() => {
    const rulesForCountry = newDraftCountry
      ? pricingRules.filter((rule) => rule.countryName === newDraftCountry)
      : pricingRules;

    return Array.from(new Set(rulesForCountry.map((rule) => rule.procedureName).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [newDraftCountry, pricingRules]);

  const previewRows = useMemo(() => {
    if (!newDraftCountry) return [];

    const serviceOrder = new Map(SERVICE_ORDER.map((service, index) => [service, index]));

    return pricingRules
      .filter((rule) => rule.countryName === newDraftCountry)
      .filter((rule) => !newDraftProcedure || rule.procedureName === newDraftProcedure)
      .sort((a, b) => {
        const serviceSort =
          (serviceOrder.get(a.serviceCategory) ?? SERVICE_ORDER.length) -
          (serviceOrder.get(b.serviceCategory) ?? SERVICE_ORDER.length);
        if (serviceSort !== 0) return serviceSort;

        const countrySort = a.countryName.localeCompare(b.countryName, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
        if (countrySort !== 0) return countrySort;

        return a.procedureName.localeCompare(b.procedureName, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      });
  }, [newDraftCountry, newDraftProcedure, pricingRules]);

  const resetNewDraftForm = () => {
    setNewDraftName('');
    setNewDraftContinent('');
    setNewDraftCountry('');
    setNewDraftProcedure('');
    setFormError('');
  };

  const openNewDraftModal = () => {
    resetNewDraftForm();
    setNewDraftOpen(true);
  };

  const closeNewDraftModal = () => {
    setNewDraftOpen(false);
    resetNewDraftForm();
  };

  const deleteDraft = async (draft: FeeBuilderDraft) => {
    const confirmed = window.confirm(`Delete "${draft.name}"?`);
    if (!confirmed) return;

    try {
      await feeBuilderDraftsService.delete(draft.id);
      const nextDrafts = drafts.filter((item) => item.id !== draft.id);
      setDrafts(nextDrafts);
      showSuccessToast('Draft deleted');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete draft');
    }
  };

  const openDraft = (draft: FeeBuilderDraft) => {
    router.push(`/reports/fee-builder?draftId=${encodeURIComponent(draft.id)}`);
  };

  const createDraftFromPricingRules = async () => {
    if (!newDraftCountry) {
      setFormError('Select a country before creating the draft.');
      return;
    }

    if (!newDraftProcedure) {
      setFormError('Select a procedure before creating the draft.');
      return;
    }

    if (previewRows.length === 0) {
      setFormError('No pricing rules found for the selected country and procedure.');
      return;
    }

    const now = new Date().toISOString();
    const name = newDraftName.trim() || `${newDraftCountry} ${newDraftProcedure} fees`;
    const selectedService = previewRows[0]?.serviceCategory || 'Trademark';
    const nextDraftPayload = {
      id: makeId('fee-draft'),
      name,
      draftDate: now.slice(0, 10),
      createdAt: now,
      updatedAt: now,
      selectedService,
      tableMode: 'quotation' as const,
      selectedCountry: newDraftCountry,
      selectedContinent: newDraftContinent,
      selectedProcedure: newDraftProcedure,
      selectedRuleIds: previewRows.map((rule) => rule._id),
      editedFees: Object.fromEntries(
        previewRows.map((rule) => [
          rule._id,
          {
            officialFee: String(rule.officialFee ?? 0),
            attorneyFee: String(rule.attorneyFee ?? 0),
          },
        ])
      ),
      rowOrder: Array.from(new Set(previewRows.map((rule) => makeCountryKey(rule)))),
      columnOrder: Array.from(new Set(previewRows.map((rule) => rule.procedureName).filter(Boolean))),
      columnVisibility: DEFAULT_COLUMN_VISIBILITY,
      fontFamily: 'Calibri',
      rowHeight: 22,
      columnWidth: 72,
      flagWidth: 26,
      flagHeight: 16,
      headerColor: '#EAF2FF',
      rowColor: '#FFFFFF',
      fontColor: '#111827',
      highlightColor: '#FFF2CC',
      printOrientation: 'landscape' as const,
      paperFormat: 'A4' as const,
      columnWidths: {},
      rowHeights: {},
    };

    try {
      const savedDraft = await feeBuilderDraftsService.create(nextDraftPayload);
      const nextDrafts = [savedDraft, ...drafts.filter((draft) => draft.id !== savedDraft.id)];

      setDrafts(nextDrafts);
      setNewDraftOpen(false);
      resetNewDraftForm();
      showSuccessToast('Draft created');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create draft');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F5F7FA' }}>
      <Topbar title="Saved IP Services Fee Drafts" />

      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Paper
          sx={{
            borderRadius: 1,
            overflow: 'hidden',
            border: '1px solid #D7DDE7',
            boxShadow: '0 10px 28px rgba(15, 23, 42, 0.08)',
          }}
        >
          <Box
            sx={{
              p: 2,
              borderBottom: '1px solid #D7DDE7',
              bgcolor: '#FFFFFF',
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 1.5,
              alignItems: { xs: 'stretch', sm: 'center' },
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography sx={{ fontWeight: 900, color: '#111827' }}>
                Saved Drafts
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#64748B' }}>
                Reopen saved IP Services Fee Builder drafts and continue editing.
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button variant="contained" component={Link} href="/reports/fee-builder?newDraft=1">
                New Draft
              </Button>
              <Button variant="outlined" component={Link} href="/reports/fee-builder?allFees=1">
                All Fees
              </Button>
              <Button variant="outlined" component={Link} href="/reports/fee-builder">
                Open Fee Builder
              </Button>
            </Stack>
          </Box>

          <TableContainer sx={{ bgcolor: '#FFFFFF', overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 760 }}>
              <TableHead>
                <TableRow
                  sx={{
                    '& th': {
                      bgcolor: '#EAF2FF',
                      color: '#111827',
                      fontWeight: 900,
                      borderBottom: '1px solid #CBD5E1',
                      whiteSpace: 'nowrap',
                    },
                  }}
                >
                  <TableCell>Continents</TableCell>
                  <TableCell>Name of the IP Services Draft</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedDrafts.map((draft) => (
                  <TableRow
                    key={draft.id}
                    hover
                    sx={{
                      '& td': {
                        borderBottom: '1px solid #E2E8F0',
                        py: 1.25,
                      },
                    }}
                  >
                    <TableCell>
                      <Chip
                        size="small"
                        label={getDraftContinent(draft)}
                        sx={{
                          bgcolor: '#ECFDF5',
                          color: '#065F46',
                          fontWeight: 800,
                          borderRadius: 1,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 800, color: '#111827' }}>
                        {draft.name || 'Untitled Draft'}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: '#64748B' }}>
                        {draft.selectedService || 'IP Services'}
                        {draft.tableMode === 'all' ? ' - All Fees' : ` - ${draft.selectedRuleIds?.length || 0} selected`}
                        {draft.selectedCountry ? ` - ${draft.selectedCountry}` : ''}
                        {draft.selectedProcedure ? ` - ${draft.selectedProcedure}` : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 700, color: '#334155' }}>
                        {formatDraftDate(draft.draftDate || draft.updatedAt || draft.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                        <Button size="small" variant="outlined" onClick={() => openDraft(draft)}>
                          Edit
                        </Button>
                        <Button size="small" color="error" variant="outlined" onClick={() => deleteDraft(draft)}>
                          Delete
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}

                {loaded && sortedDrafts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} sx={{ py: 5, textAlign: 'center' }}>
                      <Typography sx={{ fontWeight: 800, color: '#334155' }}>
                        No saved drafts yet.
                      </Typography>
                      <Typography sx={{ mt: 0.5, fontSize: 13, color: '#64748B' }}>
                        Save a draft from the IP Services Fee Builder to see it here.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>

      <Dialog open={newDraftOpen} onClose={closeNewDraftModal} fullWidth maxWidth="lg">
        <DialogTitle sx={{ fontWeight: 900 }}>Create IP Services Fee Draft</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {formError && (
              <Alert severity="warning" onClose={() => setFormError('')}>
                {formError}
              </Alert>
            )}

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' },
                gap: 1.5,
              }}
            >
              <TextField
                size="small"
                label="Draft Name"
                value={newDraftName}
                onChange={(event) => setNewDraftName(event.target.value)}
                placeholder="Asia fees"
              />
              <FormControl size="small">
                <InputLabel>Continent</InputLabel>
                <Select
                  label="Continent"
                  value={newDraftContinent}
                  onChange={(event) => setNewDraftContinent(String(event.target.value))}
                >
                  <MenuItem value="">All Continents</MenuItem>
                  {continents.map((continent) => (
                    <MenuItem key={continent._id} value={continent.continent}>
                      {continent.continent}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small">
                <InputLabel>Country</InputLabel>
                <Select
                  label="Country"
                  value={newDraftCountry}
                  onChange={(event) => {
                    setNewDraftCountry(String(event.target.value));
                    setNewDraftProcedure('');
                    setFormError('');
                  }}
                >
                  <MenuItem value="">Select Country</MenuItem>
                  {countries.map((country) => (
                    <MenuItem key={country._id} value={country.name}>
                      {country.name} ({country.abbreviation})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small">
                <InputLabel>Procedure</InputLabel>
                <Select
                  label="Procedure"
                  value={newDraftProcedure}
                  onChange={(event) => {
                    setNewDraftProcedure(String(event.target.value));
                    setFormError('');
                  }}
                  disabled={!newDraftCountry}
                >
                  <MenuItem value="">Select Procedure</MenuItem>
                  {procedureOptions.map((procedure) => (
                    <MenuItem key={procedure} value={procedure}>
                      {procedure}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box>
              <Typography sx={{ fontWeight: 900, color: '#111827', mb: 1 }}>
                All Fees
              </Typography>
              <TableContainer sx={{ border: '1px solid #D7DDE7', maxHeight: 360 }}>
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
                      <TableCell>Service</TableCell>
                      <TableCell>Country</TableCell>
                      <TableCell>Procedure</TableCell>
                      <TableCell align="right">Official Fees</TableCell>
                      <TableCell align="right">Attorney Fees</TableCell>
                      <TableCell align="right">Class Fee</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewRows.map((rule) => {
                      const total =
                        (Number(rule.officialFee) || 0) +
                        (Number(rule.attorneyFee) || 0) +
                        (Number(rule.classFee) || 0);

                      return (
                        <TableRow key={rule._id} hover>
                          <TableCell>{rule.serviceCategory}</TableCell>
                          <TableCell>{rule.countryName}</TableCell>
                          <TableCell>{rule.procedureName}</TableCell>
                          <TableCell align="right">{formatMoney(Number(rule.officialFee) || 0)}</TableCell>
                          <TableCell align="right">{formatMoney(Number(rule.attorneyFee) || 0)}</TableCell>
                          <TableCell align="right">{formatMoney(Number(rule.classFee) || 0)}</TableCell>
                          <TableCell align="right">
                            <Typography component="span" sx={{ fontWeight: 900 }}>
                              {formatMoney(total)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {!optionsLoading && previewRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} sx={{ py: 4, textAlign: 'center', color: '#64748B' }}>
                          Select a country and procedure to preview matching fees.
                        </TableCell>
                      </TableRow>
                    )}

                    {optionsLoading && (
                      <TableRow>
                        <TableCell colSpan={7} sx={{ py: 4, textAlign: 'center', color: '#64748B' }}>
                          Loading pricing rules...
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeNewDraftModal}>Cancel</Button>
          <Button variant="contained" onClick={createDraftFromPricingRules} disabled={optionsLoading}>
            Create Draft
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
