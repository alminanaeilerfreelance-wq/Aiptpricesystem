'use client';

import React from 'react';
import { Input, Card } from '@/components/ui';
import { Client } from '@/services/clients.service';

interface ClientInformationCardProps {
  clientSearch: string;
  onClientSearchChange: (value: string) => void;
  clientSuggestions: Client[];
  showSuggestions: boolean;
  onShowSuggestions: (show: boolean) => void;
  onSelectClient: (client: Client) => void;
  selectedClient: {
    name: string;
    email: string;
    type?: string;
    phone?: string;
    address?: string;
    notes?: string;
  };
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
  errors,
  suggestionsRef,
}) => {
  return (
    <Card className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900 mb-4">
        Client Information
      </h2>

      {/* Client Name with search dropdown */}
      <div className="relative" ref={suggestionsRef}>
        <Input
          label="Client Name *"
          value={clientSearch}
          onChange={(e) => {
            onClientSearchChange(e.target.value);
          }}
          onFocus={() => onShowSuggestions(true)}
          placeholder="Type to search or enter new name"
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
                  <span className="font-medium text-gray-900">{c.name}</span>
                  {c.type && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {c.type}
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

      {/* Client Email */}
      <Input
        label="Client Email"
        type="email"
        value={selectedClient.email}
        placeholder="client@example.com"
        readOnly
      />

      {/* Client Type (from selected client model) */}
      <Input
        label="Client Type"
        value={selectedClient.type || ''}
        placeholder="Client type"
        readOnly
      />

      {/* Client Phone (Contact) */}
      <Input
        label="Contact"
        type="tel"
        value={selectedClient.phone || ''}
        placeholder="Client contact"
        readOnly
      />

      {/* Client Address */}
      <Input
        label="Address"
        value={selectedClient.address || ''}
        placeholder="Client address"
        readOnly
      />

      {/* Notes */}
      <div>
        <label className="label">Note</label>
        <textarea
          className="input resize-none bg-gray-50"
          rows={3}
          value={selectedClient.notes || ''}
          placeholder="Client note"
          readOnly
        />
      </div>
    </Card>
  );
};

export default ClientInformationCard;
