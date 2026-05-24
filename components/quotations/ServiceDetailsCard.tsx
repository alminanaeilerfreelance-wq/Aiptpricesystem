'use client';

import React, { useState, useEffect } from 'react';
import { Input, Select, Card } from '@/components/ui';
import MultiSelect from '@/components/ui/MultiSelect';
import { Country } from '@/services/countries.service';
import { Procedure } from '@/services/procedures.service';
import { PricingRule } from '@/services/pricing-rules.service';
import requirementsService from '@/services/requirements.service';

interface Requirement {
  _id: string;
  country: { _id: string; name: string };
  requirements: string;
}

interface ServiceDetailsCardProps {
  service: string;
  procedureId: string;
  countryId: string;
  numberOfClasses: number;
  requirementIds: string[];
  procedures: Procedure[];
  countries: Country[];
  selectedPricingRule: PricingRule | null;
  onServiceChange: (value: string) => void;
  onProcedureChange: (value: string) => void;
  onCountryChange: (value: string) => void;
  onNumberOfClassesChange: (value: number) => void;
  onRequirementsChange: (values: string[]) => void;
  errors: Record<string, string>;
  onAddToCart: () => void;
}

const SERVICES = [
  'Trademark',
  'Patent',
  'Copyright',
  'Design',
  'Litigation',
] as const;

export const ServiceDetailsCard: React.FC<ServiceDetailsCardProps> = ({
  service,
  procedureId,
  countryId,
  numberOfClasses,
  requirementIds,
  procedures,
  countries,
  selectedPricingRule,
  onServiceChange,
  onProcedureChange,
  onCountryChange,
  onNumberOfClassesChange,
  onRequirementsChange,
  errors,
  onAddToCart,
}) => {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loadingReqs, setLoadingReqs] = useState(false);

  const stripHtml = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  // Load requirements when country changes
  useEffect(() => {
    if (!countryId) {
      setRequirements([]);
      return;
    }

    setLoadingReqs(true);
    requirementsService
      .list(1, 100, '', countryId)
      .then((res) => {
        setRequirements(res.data.data || []);
      })
      .catch(() => setRequirements([]))
      .finally(() => setLoadingReqs(false));
  }, [countryId]);

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
      label: c.abbreviation ? `${c.abbreviation} - ${c.name}` : c.name,
    })),
  ];

  const requirementOptions = requirements.map((r) => ({
    value: r._id,
    label: stripHtml(r.requirements).slice(0, 120),
  }));

  // Determine if class field should be shown
  const showClassField = service === 'Trademark';

  return (
    <Card className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900 mb-4">
        Service Details
      </h2>

      {/* Service Category */}
      <Select
        label="Service Category *"
        value={service}
        options={serviceOptions}
        onChange={(e) => onServiceChange(e.target.value)}
        error={errors.service}
      />

      {/* Country */}
      <Select
        label="Country *"
        value={countryId}
        options={countryOptions}
        onChange={(e) => onCountryChange(e.target.value)}
        error={errors.country}
        disabled={!service}
      />

      {/* Procedure Name (auto-filtered) */}
      <Select
        label="Procedure Name *"
        value={procedureId}
        options={procedureOptions}
        onChange={(e) => onProcedureChange(e.target.value)}
        disabled={!service || !countryId}
        error={errors.procedure}
        helperText={
          service && countryId && procedures.length === 0
            ? 'No procedure is configured in Pricing Rules for this service/country.'
            : undefined
        }
      />

      {/* Number of Classes - Trademark only */}
      {showClassField && (
        <Input
          label="Number of Classes *"
          type="number"
          min={1}
          max={45}
          value={numberOfClasses}
          onChange={(e) =>
            onNumberOfClassesChange(Math.max(1, parseInt(e.target.value) || 1))
          }
          helperText="Trademark only (per mark per class)"
        />
      )}

      {/* Requirements Multi-Select */}
      <MultiSelect
        label="Requirements (Select2)"
        options={requirementOptions}
        value={requirementIds}
        onChange={onRequirementsChange}
        placeholder={
          loadingReqs
            ? 'Loading requirements...'
            : 'Select requirement(s) from requirement page data'
        }
        searchable
      />

      {/* Pricing Rules Display */}
      {selectedPricingRule && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-sm text-blue-900 mb-3">
            Pricing Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-600">Official Fee:</span>
              <span className="ml-2 font-medium text-gray-900">
                {selectedPricingRule.officialFee}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Attorney Fee:</span>
              <span className="ml-2 font-medium text-gray-900">
                {selectedPricingRule.attorneyFee}
              </span>
            </div>
            {showClassField && (
              <div>
                <span className="text-gray-600">Per Class Fee:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {selectedPricingRule.classFee}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add to Cart Button */}
      <button
        type="button"
        onClick={onAddToCart}
        className="w-full px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
      >
        Add to Cart
      </button>
    </Card>
  );
};

export default ServiceDetailsCard;
