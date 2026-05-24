'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Topbar from '@/components/layout/Topbar';
import { Button, Input, Select, Card } from '@/components/ui';
import QuotationFeeSummary from '@/components/quotations/QuotationFeeSummary';
import { useToast } from '@/components/feedback/ToastProvider';
import { quotationsService, Quotation } from '@/services/quotations.service';
import { clientsService, Client } from '@/services/clients.service';
import { clientTypesService, ClientType } from '@/services/client-types.service';
import { countriesService, Country } from '@/services/countries.service';
import { proceduresService, Procedure } from '@/services/procedures.service';
import { pricingRulesService } from '@/services/pricing-rules.service';
import { useDebounce } from '@/hooks/useDebounce';

const SERVICES = ['Trademark', 'Patent', 'Copyright', 'Design', 'Litigation'] as const;
type ServiceType = typeof SERVICES[number];

interface FeeState {
  governmentFee: number;
  serviceFee: number;
  classFee: number;
  procedureFee: number;
}

export default function EditQuotationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();

  // Loading/error for existing quotation
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Client info
  const [clientSearch, setClientSearch] = useState('');
  const [clientSuggestions, setClientSuggestions] = useState<Client[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientTypeId, setClientTypeId] = useState('');
  const [notes, setNotes] = useState('');

  // Service / Country
  const [service, setService] = useState<ServiceType | ''>('');
  const [procedureId, setProcedureId] = useState('');
  const [procedureName, setProcedureName] = useState('');
  const [countryId, setCountryId] = useState('');
  const [countryName, setCountryName] = useState('');
  const [numberOfClasses, setNumberOfClasses] = useState(1);

  // Lookup data
  const [clientTypes, setClientTypes] = useState<ClientType[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);

  // Fees
  const [fees, setFees] = useState<FeeState>({
    governmentFee: 0,
    serviceFee: 0,
    classFee: 0,
    procedureFee: 0,
  });
  const [multiplier, setMultiplier] = useState(1);
  const [currency, setCurrency] = useState('SAR');
  const [status, setStatus] = useState<Quotation['status']>('Draft');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const debouncedClientSearch = useDebounce(clientSearch, 350);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const proceduresLoadedForService = useRef<string>('');

  // Load static data + existing quotation
  useEffect(() => {
    if (!id) return;

    async function init() {
      setInitialLoading(true);
      setLoadError(null);
      try {
        const [quotation, ctRes, cRes] = await Promise.all([
          quotationsService.getById(id),
          clientTypesService.list(),
          countriesService.list(),
        ]);

        setClientTypes(ctRes.clientTypes);
        setCountries(cRes.countries);

        // Pre-populate from existing quotation
        setClientName(quotation.clientName);
        setClientSearch(quotation.clientName);
        setClientEmail(quotation.clientEmail ?? '');
        setSelectedClientId(quotation.clientId ?? '');
        setNotes(quotation.notes ?? '');
        setService(quotation.service);
        setProcedureName(quotation.procedure);
        setCountryName(quotation.country);
        setNumberOfClasses(quotation.numberOfClasses);
        setFees({
          governmentFee: quotation.fees.governmentFee,
          serviceFee: quotation.fees.serviceFee,
          classFee: quotation.fees.classFee,
          procedureFee: quotation.fees.procedureFee,
        });
        setMultiplier(quotation.multiplier);
        setCurrency(quotation.currency);
        setStatus(quotation.status);

        // Match client type id
        const matchedCt = ctRes.clientTypes.find(
          (ct) => ct.name === quotation.clientType || ct._id === quotation.clientType,
        );
        if (matchedCt) setClientTypeId(matchedCt._id);

        // Match country id
        const matchedC = cRes.countries.find((c) => c.name === quotation.country);
        if (matchedC) setCountryId(matchedC._id);

        // Load procedures for the service
        const procRes = await proceduresService.list({ category: quotation.service });
        setProcedures(procRes.procedures);
        proceduresLoadedForService.current = quotation.service;

        // Match procedure id
        const matchedP = procRes.procedures.find(
          (p) => p.name === quotation.procedure,
        );
        if (matchedP) setProcedureId(matchedP._id);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load quotation');
      } finally {
        setInitialLoading(false);
      }
    }

    init();
  }, [id]);

  // Search clients
  useEffect(() => {
    if (!debouncedClientSearch || debouncedClientSearch.length < 2) {
      setClientSuggestions([]);
      return;
    }
    clientsService
      .list({ search: debouncedClientSearch })
      .then((res) => setClientSuggestions(res.clients.slice(0, 8)))
      .catch(() => setClientSuggestions([]));
  }, [debouncedClientSearch]);

  // Load procedures when service changes (not on initial population)
  const handleServiceChange = useCallback(
    async (newService: ServiceType | '') => {
      setService(newService);
      setProcedureId('');
      setProcedureName('');
      if (!newService) {
        setProcedures([]);
        return;
      }
      try {
        const res = await proceduresService.list({ category: newService });
        setProcedures(res.procedures);
        proceduresLoadedForService.current = newService;
      } catch {
        setProcedures([]);
      }
    },
    [],
  );

  // Auto-fetch pricing rule on service + country change (skip initial load)
  const pricingFetchDone = useRef(false);
  useEffect(() => {
    if (initialLoading) return;
    if (!pricingFetchDone.current) {
      pricingFetchDone.current = true;
      return;
    }
    if (!service || !countryId) return;
    const country = countries.find((c) => c._id === countryId);
    if (!country) return;
    pricingRulesService
      .list({ category: service, country: country.name })
      .then((res) => {
        const rule = res.pricingRules[0];
        if (rule) {
          setFees({
            governmentFee: rule.officialFee ?? 0,
            serviceFee: rule.attorneyFee ?? 0,
            classFee: rule.classFee ?? 0,
            procedureFee: 0,
          });
        }
      })
      .catch(() => {});
  }, [service, countryId, countries, initialLoading]);

  // Update multiplier when client type changes
  useEffect(() => {
    const ct = clientTypes.find((c) => c._id === clientTypeId);
    if (ct?.multiplier !== undefined) setMultiplier(ct.multiplier);
  }, [clientTypeId, clientTypes]);

  // Dismiss suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelectClient = (client: Client) => {
    setSelectedClientId(client._id);
    setClientName(client.name);
    setClientSearch(client.name);
    setClientEmail(client.email ?? '');
    if (client.clientType) setClientTypeId(client.clientType);
    setShowSuggestions(false);
  };

  const handleFeeChange = (field: keyof FeeState, value: string) => {
    setFees((prev) => ({ ...prev, [field]: parseFloat(value) || 0 }));
  };

  // Live calculation
  const subtotal =
    fees.governmentFee +
    fees.serviceFee +
    fees.classFee * numberOfClasses +
    fees.procedureFee;
  const total = subtotal * multiplier;
  const feeSummaryRows = [
    {
      procedureName: procedureName || 'Selected Procedure',
      governmentFees:
        fees.governmentFee +
        fees.classFee +
        fees.procedureFee,
      attorneyFees: fees.serviceFee,
      total,
    },
  ];

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!clientName.trim()) newErrors.clientName = 'Client name is required';
    if (!service) newErrors.service = 'Service is required';
    if (!procedureId && !procedureName) newErrors.procedureId = 'Procedure is required';
    if (!countryId && !countryName) newErrors.countryId = 'Country is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !id) return;

    const selectedProcedure = procedures.find((p) => p._id === procedureId);
    const selectedCountry = countries.find((c) => c._id === countryId);
    const selectedCt = clientTypes.find((ct) => ct._id === clientTypeId);

    const payload = {
      clientId: selectedClientId || undefined,
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim() || undefined,
      clientType: (selectedCt?.name ?? clientTypeId) || undefined,
      service: service as ServiceType,
      procedure: selectedProcedure?.name ?? procedureName,
      country: selectedCountry?.name ?? countryName,
      numberOfClasses,
      fees: {
        governmentFee: fees.governmentFee,
        serviceFee: fees.serviceFee,
        classFee: fees.classFee,
        procedureFee: fees.procedureFee,
      },
      multiplier,
      currency,
      notes: notes.trim() || undefined,
      status,
    };

    setSubmitting(true);
    try {
      await quotationsService.update(id, payload);
      toast.success('Quotation updated successfully');
      router.push(`/quotations/${id}`);
    } catch (err) {
      toast.error(
        'Failed to update quotation',
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Topbar title="Edit Quotation" />
        <div className="flex-1 p-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-6 h-48 animate-pulse bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col min-h-screen">
        <Topbar title="Edit Quotation" />
        <div className="flex-1 p-6">
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
            {loadError}
          </div>
          <Button variant="secondary" onClick={() => router.push('/quotations')}>
            Back to Quotations
          </Button>
        </div>
      </div>
    );
  }

  const clientTypeOptions = [
    { value: '', label: 'Select client type' },
    ...clientTypes.map((ct) => ({ value: ct._id, label: ct.name })),
  ];

  const serviceOptions = [
    { value: '', label: 'Select service' },
    ...SERVICES.map((s) => ({ value: s, label: s })),
  ];

  const procedureOptions = [
    { value: '', label: service ? 'Select procedure' : 'Select a service first' },
    ...procedures.map((p) => ({ value: p._id, label: p.name })),
  ];

  const countryOptions = [
    { value: '', label: 'Select country' },
    ...countries.map((c) => ({
      value: c._id,
      label: c.abbreviation ? `${c.abbreviation} ${c.name}` : c.name,
    })),
  ];

  const statusOptions = [
    { value: 'Draft', label: 'Draft' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Approved', label: 'Approved' },
    { value: 'Rejected', label: 'Rejected' },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar
        title="Edit Quotation"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Quotations', href: '/quotations' },
          { label: 'Edit' },
        ]}
      />

      <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column — Client info */}
          <Card className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900 mb-2">
              Client Information
            </h2>

            {/* Client Name with search dropdown */}
            <div className="relative" ref={suggestionsRef}>
              <Input
                label="Client Name"
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setClientName(e.target.value);
                  setSelectedClientId('');
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Type to search or enter name"
                error={errors.clientName}
                autoComplete="off"
              />
              {showSuggestions && clientSuggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-white shadow-lg overflow-hidden">
                  {clientSuggestions.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-surface transition-colors"
                      onMouseDown={() => handleSelectClient(c)}
                    >
                      <span className="font-medium text-gray-900">{c.name}</span>
                      {c.email && (
                        <span className="ml-2 text-xs text-gray-400">{c.email}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Input
              label="Client Email"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="client@example.com"
            />

            <Select
              label="Client Type"
              value={clientTypeId}
              options={clientTypeOptions}
              onChange={(e) => setClientTypeId(e.target.value)}
            />

            <div>
              <label className="label">Notes</label>
              <textarea
                className="input resize-none"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
              />
            </div>
          </Card>

          {/* Right column — Service / Country */}
          <Card className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900 mb-2">
              Service Details
            </h2>

            <Select
              label="Service"
              value={service}
              options={serviceOptions}
              onChange={(e) =>
                handleServiceChange(e.target.value as ServiceType | '')
              }
              error={errors.service}
            />

            <Select
              label="Procedure"
              value={procedureId}
              options={procedureOptions}
              onChange={(e) => {
                setProcedureId(e.target.value);
                const p = procedures.find((proc) => proc._id === e.target.value);
                if (p) setProcedureName(p.name);
              }}
              disabled={!service}
              error={errors.procedureId}
            />

            <Select
              label="Country"
              value={countryId}
              options={countryOptions}
              onChange={(e) => {
                setCountryId(e.target.value);
                const c = countries.find((co) => co._id === e.target.value);
                if (c) setCountryName(c.name);
              }}
              error={errors.countryId}
            />

            <Input
              label="Number of Classes"
              type="number"
              min={1}
              value={numberOfClasses}
              onChange={(e) =>
                setNumberOfClasses(Math.max(1, parseInt(e.target.value) || 1))
              }
            />

            <Select
              label="Status"
              value={status}
              options={statusOptions}
              onChange={(e) => setStatus(e.target.value as Quotation['status'])}
            />
          </Card>
        </div>

        {/* Fee fields */}
        <Card className="p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Fee Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              label="Government Fee"
              type="number"
              min={0}
              step="0.01"
              value={fees.governmentFee}
              onChange={(e) => handleFeeChange('governmentFee', e.target.value)}
            />
            <Input
              label="Attorney Fee"
              type="number"
              min={0}
              step="0.01"
              value={fees.serviceFee}
              onChange={(e) => handleFeeChange('serviceFee', e.target.value)}
            />
            <Input
              label="Class Fee (per class)"
              type="number"
              min={0}
              step="0.01"
              value={fees.classFee}
              onChange={(e) => handleFeeChange('classFee', e.target.value)}
            />
            <Input
              label="Procedure Fee"
              type="number"
              min={0}
              step="0.01"
              value={fees.procedureFee}
              onChange={(e) => handleFeeChange('procedureFee', e.target.value)}
            />
            <Input
              label="Multiplier"
              type="number"
              min={0.1}
              step="0.1"
              value={multiplier}
              onChange={(e) =>
                setMultiplier(Math.max(0.1, parseFloat(e.target.value) || 1))
              }
              helperText="Applied to subtotal (from client type)"
            />
            <Input
              label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="SAR"
            />
          </div>
        </Card>

        {/* Live fee summary */}
        <QuotationFeeSummary
          data={feeSummaryRows}
          currency={currency}
        />

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push(`/quotations/${id}`)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
