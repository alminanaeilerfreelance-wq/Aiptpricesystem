'use client';

import React from 'react';
import { Input, Card } from '@/components/ui';

export interface AssociateSuggestion {
  _id: string;
  associteName: string;
  email?: string;
  associteType?: string;
  contact?: string;
  address?: string;
  notes?: string;
}

interface ClientInformationCardProps {
  clientSearch: string;
  onClientSearchChange: (value: string) => void;
  clientSuggestions: AssociateSuggestion[];
  showSuggestions: boolean;
  onShowSuggestions: (show: boolean) => void;
  onSelectClient: (client: AssociateSuggestion) => void;
  selectedClient: {
    name: string;
    email: string;
    type?: string;
    phone?: string;
    address?: string;
    notes?: string;
  };
  inquiriesProject: string;
  onInquiriesProjectChange: (value: string) => void;
  errors: Record<string, string>;
  suggestionsRef: React.RefObject<HTMLDivElement>;
}

export const ClientInformationCard: React.FC<ClientInformationCardProps> = ({
  clientSearch,
  onClientSearchChange,
  clientSuggestions,
  showSuggestions,
  onShowSuggestions,
  onSelectClient,
  selectedClient,
  inquiriesProject,
  onInquiriesProjectChange,
  errors,
  suggestionsRef,
}) => {
  return (
    <Card className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900 mb-4">
        Associte Information
      </h2>

      {/* Associte Name with search dropdown */}
      <div className="relative" ref={suggestionsRef}>
        <Input
          label="Associte Name *"
          value={clientSearch}
          onChange={(e) => {
            onClientSearchChange(e.target.value);
          }}
          onFocus={() => onShowSuggestions(true)}
          placeholder="Type to search associte or enter name"
          error={errors.clientName}
          autoComplete="off"
        />
        {showSuggestions && clientSuggestions.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-white shadow-lg overflow-hidden">
            {clientSuggestions.map((c) => (
              <button
                key={c._id}
                type="button"
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-surface transition-colors border-b last:border-b-0"
                onMouseDown={() => onSelectClient(c)}
              >
                <div className="flex justify-between items-start">
                  <span className="font-medium text-gray-900">{c.associteName}</span>
                  {c.associteType && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {c.associteType}
                    </span>
                  )}
                </div>
                {c.email && (
                  <span className="text-xs text-gray-400">{c.email}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Associte Email */}
      <Input
        label="Associte Email"
        type="email"
        value={selectedClient.email}
        placeholder="associte@example.com"
        readOnly
      />

      {/* Associte Type */}
      <Input
        label="Associte Type"
        value={selectedClient.type || ''}
        placeholder="Associte type"
        readOnly
      />

      {/* Associte Contact */}
      <Input
        label="Contact"
        type="tel"
        value={selectedClient.phone || ''}
        placeholder="Associte contact"
        readOnly
      />

      {/* Associte Address */}
      <Input
        label="Address"
        value={selectedClient.address || ''}
        placeholder="Associte address"
        readOnly
      />

      <Input
        label="Inquiries Project"
        value={inquiriesProject}
        onChange={(e) => onInquiriesProjectChange(e.target.value)}
        placeholder="Enter inquiries project name"
      />

      {/* Notes */}
      <div>
        <label className="label">Note</label>
        <textarea
          className="input resize-none bg-gray-50"
          rows={3}
          value={selectedClient.notes || ''}
          placeholder="Associte note"
          readOnly
        />
      </div>
    </Card>
  );
};

export default ClientInformationCard;
