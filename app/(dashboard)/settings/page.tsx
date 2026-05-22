'use client';

import React, { useEffect, useState } from 'react';
import Topbar from '@/components/layout/Topbar';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui';
import { Select } from '@/components/ui';
import { Card } from '@/components/ui';
import { settingsService, Settings } from '@/services/settings.service';

const CURRENCY_OPTIONS = [
  { value: 'SAR', label: 'SAR - Saudi Riyal' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'AED', label: 'AED - UAE Dirham' },
  { value: 'KWD', label: 'KWD - Kuwaiti Dinar' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Company settings form
  const [companyName, setCompanyName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [currency, setCurrency] = useState('SAR');
  const [defaultValidDays, setDefaultValidDays] = useState('30');
  const [termsAndConditions, setTermsAndConditions] = useState('');

  // SMTP settings form
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      setError(null);
      try {
        const data = await settingsService.get();
        setSettings(data);
        setCompanyName(data.companyName ?? '');
        setCompanyEmail(data.companyEmail ?? '');
        setCompanyPhone(data.companyPhone ?? '');
        setCompanyAddress(data.companyAddress ?? '');
        setCurrency(data.currency ?? 'SAR');
        setDefaultValidDays(String(data.defaultValidDays ?? 30));
        setTermsAndConditions(data.termsAndConditions ?? '');
        setSmtpHost(data.smtpHost ?? '');
        setSmtpPort(String(data.smtpPort ?? ''));
        setSmtpUser(data.smtpUser ?? '');
        setSmtpPass(''); // never prefill password
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const payload: Partial<Settings> = {
        companyName: companyName.trim(),
        companyEmail: companyEmail.trim() || undefined,
        companyPhone: companyPhone.trim() || undefined,
        companyAddress: companyAddress.trim() || undefined,
        currency,
        defaultValidDays: parseInt(defaultValidDays, 10) || 30,
        termsAndConditions: termsAndConditions.trim() || undefined,
        smtpHost: smtpHost.trim() || undefined,
        smtpPort: smtpPort ? parseInt(smtpPort, 10) : undefined,
        smtpUser: smtpUser.trim() || undefined,
      };
      if (smtpPass) {
        (payload as Record<string, unknown>).smtpPass = smtpPass;
      }
      await settingsService.update(payload);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Topbar title="Settings" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Settings" />

      <div className="flex-1 p-6 space-y-6 overflow-auto max-w-3xl">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {saveSuccess && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            Settings saved successfully.
          </div>
        )}

        {/* Company Settings */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-5">Company Settings</h2>
          <div className="space-y-4">
            <Input
              label="Company Name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. IP Law Firm"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Company Email"
                type="email"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
                placeholder="info@firm.com"
              />
              <Input
                label="Company Phone"
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
                placeholder="+966 11 000 0000"
              />
            </div>
            <Input
              label="Company Address"
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              placeholder="123 Business District, Riyadh"
            />
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Currency"
                options={CURRENCY_OPTIONS}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              />
              <Input
                label="Default Valid Days"
                type="number"
                min="1"
                step="1"
                value={defaultValidDays}
                onChange={(e) => setDefaultValidDays(e.target.value)}
                placeholder="30"
                helperText="Days before quotation expires"
              />
            </div>
            <div className="w-full">
              <label className="label">Terms & Conditions</label>
              <textarea
                className="input min-h-[120px] resize-y"
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
                placeholder="Enter your standard terms and conditions..."
              />
            </div>
          </div>
        </Card>

        {/* SMTP Settings */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-5">Email (SMTP) Settings</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="SMTP Host"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.example.com"
              />
              <Input
                label="SMTP Port"
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                placeholder="587"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="SMTP Username"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="smtp@example.com"
              />
              <Input
                label="SMTP Password"
                type="password"
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
                placeholder="Leave blank to keep current"
              />
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button variant="primary" onClick={handleSave} loading={saving}>
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
