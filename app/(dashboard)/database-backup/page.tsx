'use client';

import React, { ChangeEvent, useMemo, useRef, useState } from 'react';
import Topbar from '@/components/layout/Topbar';
import { useAuth } from '@/hooks/useAuth';
import { showSuccessToast } from '@/components/feedback/heroToast';

export const dynamic = 'force-dynamic';

type ImportMode = 'merge' | 'replace';

interface ImportResult {
  success: boolean;
  mode: ImportMode;
  importedAt: string;
  source?: {
    app?: string;
    version?: number | null;
    exportedAt?: string | null;
    database?: string | null;
  };
  collections: Array<{
    name: string;
    documents: number;
    mode: ImportMode;
  }>;
  totalDocuments: number;
}

const DatabaseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <ellipse cx="12" cy="5" rx="7" ry="3" />
    <path d="M5 5v6c0 1.66 3.13 3 7 3s7-1.34 7-3V5" />
    <path d="M5 11v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6" />
  </svg>
);

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 21h14" />
  </svg>
);

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21V9m0 0 4 4m-4-4-4 4" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3h14" />
  </svg>
);

function getApiErrorMessage(value: unknown, fallback: string) {
  if (value && typeof value === 'object') {
    const error = value as { error?: string; message?: string };
    return error.error || error.message || fallback;
  }
  return fallback;
}

function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return {};
  const token = window.localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getFilename(response: Response) {
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  if (match?.[1]) return match[1];
  return `aipt-database-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DatabaseBackupPage() {
  const { user, loading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [confirmText, setConfirmText] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);

  const canImport = useMemo(
    () => Boolean(selectedFile) && !importing && (mode === 'merge' || confirmText === 'DATABASE'),
    [confirmText, importing, mode, selectedFile]
  );

  const handleExport = async () => {
    setError('');
    setResult(null);
    setExporting(true);

    try {
      const response = await fetch('/api/admin/database-backup', {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(getApiErrorMessage(payload, 'Failed to export database backup'));
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = getFilename(response);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      showSuccessToast('Database backup exported');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to export database backup');
    } finally {
      setExporting(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError('');
    setResult(null);
    setSelectedFile(event.target.files?.[0] || null);
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    setError('');
    setResult(null);
    setImporting(true);

    try {
      const backupText = await selectedFile.text();
      const response = await fetch(`/api/admin/database-backup?mode=${mode}`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
          'X-Backup-Confirm': mode === 'replace' ? confirmText : '',
        },
        credentials: 'include',
        body: backupText,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, 'Failed to import database backup'));
      }

      setResult(payload as ImportResult);
      showSuccessToast('Database backup imported');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to import database backup');
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <div className="flex min-h-screen flex-col">
        <Topbar title="Database Backup" />
        <div className="grid flex-1 place-items-center p-6 text-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Forbidden</h1>
            <p className="mt-2 text-sm text-gray-600">Only administrators can access database backups.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar title="Database Backup" />

      <div className="flex-1 p-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <section className="card p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700">
                  <DatabaseIcon />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">Full Database Backup</h1>
                  <p className="mt-1 text-sm text-gray-600">
                    Export or restore all MongoDB collections in Extended JSON format.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <DownloadIcon />
                {exporting ? 'Exporting...' : 'Export Database'}
              </button>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="card p-6">
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Import Backup</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Merge updates matching `_id` records, or replace each collection from the uploaded backup.
                  </p>
                </div>

                <div>
                  <label className="label">Backup file</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50"
                  >
                    <UploadIcon />
                    Select Backup File
                  </button>
                  {selectedFile && (
                    <p className="mt-2 text-sm text-gray-600">
                      {selectedFile.name} - {formatBytes(selectedFile.size)}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className={`rounded-lg border p-4 ${mode === 'merge' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="importMode"
                        value="merge"
                        checked={mode === 'merge'}
                        onChange={() => setMode('merge')}
                        className="mt-1"
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Merge</p>
                        <p className="mt-1 text-xs text-gray-600">Upsert backup records without clearing collections.</p>
                      </div>
                    </div>
                  </label>

                  <label className={`rounded-lg border p-4 ${mode === 'replace' ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'}`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="importMode"
                        value="replace"
                        checked={mode === 'replace'}
                        onChange={() => setMode('replace')}
                        className="mt-1"
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Replace</p>
                        <p className="mt-1 text-xs text-gray-600">Clear each backup collection before inserting records.</p>
                      </div>
                    </div>
                  </label>
                </div>

                {mode === 'replace' && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <label className="label text-red-900">Confirmation</label>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(event) => setConfirmText(event.target.value)}
                      placeholder="DATABASE"
                      className="input mt-1 border-red-200 focus:border-red-500 focus:ring-red-500"
                    />
                  </div>
                )}

                <div>
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={!canImport}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <UploadIcon />
                    {importing ? 'Importing...' : 'Import Backup'}
                  </button>
                </div>
              </div>
            </div>

            <aside className="card p-6">
              <h2 className="text-base font-semibold text-gray-900">Current Rules</h2>
              <div className="mt-4 space-y-3 text-sm text-gray-700">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="font-semibold text-gray-900">Access</p>
                  <p className="mt-1">Admin role only.</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="font-semibold text-gray-900">Format</p>
                  <p className="mt-1">MongoDB Extended JSON.</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="font-semibold text-gray-900">Replace Mode</p>
                  <p className="mt-1">Requires typed confirmation.</p>
                </div>
              </div>
            </aside>
          </section>

          {result && (
            <section className="card overflow-hidden">
              <div className="border-b border-gray-200 px-6 py-4">
                <h2 className="text-base font-semibold text-gray-900">Import Result</h2>
                <p className="mt-1 text-sm text-gray-600">
                  {result.totalDocuments} document{result.totalDocuments === 1 ? '' : 's'} processed in {result.collections.length} collection{result.collections.length === 1 ? '' : 's'}.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-600">
                    <tr>
                      <th className="border-b border-gray-200 px-6 py-3">Collection</th>
                      <th className="border-b border-gray-200 px-6 py-3">Documents</th>
                      <th className="border-b border-gray-200 px-6 py-3">Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.collections.map((collection) => (
                      <tr key={collection.name} className="odd:bg-white even:bg-gray-50">
                        <td className="border-b border-gray-100 px-6 py-3 font-medium text-gray-900">{collection.name}</td>
                        <td className="border-b border-gray-100 px-6 py-3 text-gray-700">{collection.documents}</td>
                        <td className="border-b border-gray-100 px-6 py-3 text-gray-700">{collection.mode}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
