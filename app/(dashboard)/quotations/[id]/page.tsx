'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Topbar from '@/components/layout/Topbar';
import { Button, Card, Modal, Input } from '@/components/ui';
import { StatusBadge } from '@/components/tables';
import QuotationFeeSummary from '@/components/quotations/QuotationFeeSummary';
import { useToast } from '@/components/feedback/ToastProvider';
import { quotationsService, Quotation } from '@/services/quotations.service';
import requirementsService from '@/services/requirements.service';

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Approve state
  const [approving, setApproving] = useState(false);

  // Send email modal
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [origin, setOrigin] = useState('');
  const [countryRequirements, setCountryRequirements] = useState<
    Array<{ _id: string; requirements: string }>
  >([]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    quotationsService
      .getById(id)
      .then((data) => {
        setQuotation(data);
        setRecipientEmail(data.clientEmail ?? '');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load quotation');
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!quotation) return;

    const hasAssignedRequirements =
      Array.isArray(quotation.requirementIds) &&
      quotation.requirementIds.some(
        (item) => Boolean(item) && typeof item === 'object' && 'requirements' in item
      );

    if (hasAssignedRequirements) {
      setCountryRequirements([]);
      return;
    }

    requirementsService
      .list(1, 100, quotation.country)
      .then((res) => {
        const normalizedCountry = quotation.country.trim().toLowerCase();
        const list = Array.isArray(res?.data?.data) ? res.data.data : [];
        const matched = list.filter(
          (item) => item.country?.name?.trim().toLowerCase() === normalizedCountry
        );
        setCountryRequirements(
          matched.map((item) => ({
            _id: item._id,
            requirements: item.requirements,
          }))
        );
      })
      .catch(() => setCountryRequirements([]));
  }, [quotation]);

  const handleApprove = async () => {
    if (!quotation) return;
    setApproving(true);
    try {
      const updated = await quotationsService.approve(quotation._id);
      setQuotation(updated);
      toast.success('Quotation approved successfully');
    } catch (err) {
      toast.error('Failed to approve', err instanceof Error ? err.message : undefined);
    } finally {
      setApproving(false);
    }
  };

  const handleSendEmail = async () => {
    if (!quotation || !recipientEmail.trim()) return;
    setSendingEmail(true);
    try {
      await quotationsService.sendEmail(quotation._id, recipientEmail.trim());
      toast.success('Email sent successfully', `Sent to ${recipientEmail}`);
      setEmailModalOpen(false);
    } catch (err) {
      toast.error('Failed to send email', err instanceof Error ? err.message : undefined);
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Topbar title="Quotation Details" />
        <div className="flex-1 p-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-6 h-32 animate-pulse bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="flex flex-col min-h-screen">
        <Topbar title="Quotation Details" />
        <div className="flex-1 p-6">
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
            {error ?? 'Quotation not found'}
          </div>
          <Button variant="secondary" onClick={() => router.push('/quotations')}>
            Back to Quotations
          </Button>
        </div>
      </div>
    );
  }

  const formattedDate = new Date(quotation.createdAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const feeSummaryRows = [
    {
      procedureName: quotation.procedure,
      governmentFees:
        quotation.fees.governmentFee +
        quotation.fees.classFee +
        quotation.fees.procedureFee,
      attorneyFees: quotation.fees.serviceFee,
      total: quotation.total,
    },
  ];

  const requirementItems = Array.isArray(quotation.requirementIds)
    ? quotation.requirementIds.filter(
        (item): item is { _id: string; requirements: string } =>
          Boolean(item) && typeof item === 'object' && 'requirements' in item
      )
    : [];
  const requirementsToDisplay =
    requirementItems.length > 0 ? requirementItems : countryRequirements;

  const sanitizeHtml = (value: string) =>
    value
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
      .replace(/\son\w+="[^"]*"/gi, '')
      .replace(/\son\w+='[^']*'/gi, '')
      .replace(/javascript:/gi, '');

  const pdfDownloadPath = `/api/quotations/${quotation._id}/pdf?download=1${
    quotation.pdfAccessToken
      ? `&t=${encodeURIComponent(quotation.pdfAccessToken)}`
      : ''
  }`;
  const qrDownloadUrl = origin ? `${origin}${pdfDownloadPath}` : '';
  const qrImageUrl = qrDownloadUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrDownloadUrl)}`
    : '';

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar
        title="Quotation Details"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Quotations', href: '/quotations' },
          { label: quotation.quotationNo },
        ]}
      />

      <div className="flex-1 p-6 space-y-6 bg-slate-50">
        {/* Action buttons — hidden when printing */}
        <div className="flex flex-wrap items-center gap-3 no-print">
          <Button variant="secondary" onClick={() => router.push('/quotations')}>
            ← Back
          </Button>

          {quotation.status === 'Pending' && (
            <Button
              variant="primary"
              onClick={handleApprove}
              loading={approving}
            >
              Approve
            </Button>
          )}

          <Button variant="secondary" onClick={() => window.open(pdfDownloadPath, '_blank')}>
            Download PDF
          </Button>

          <Button variant="secondary" onClick={() => setEmailModalOpen(true)}>
            Send Email
          </Button>

          <Link href={`/quotations/${quotation._id}/edit`}>
            <Button variant="secondary">Edit</Button>
          </Link>
        </div>

        <Card className="p-6 bg-gradient-to-r from-slate-900 to-indigo-900 text-white border-0">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Quotation</p>
              <h1 className="text-2xl font-bold mt-1">{quotation.quotationNo}</h1>
              <p className="text-sm text-slate-200 mt-1">
                {quotation.clientName} • {quotation.service} • {quotation.country}
              </p>
            </div>
            <div className="inline-flex items-center rounded-full bg-white/15 px-4 py-1.5 text-sm">
              {quotation.status}
            </div>
          </div>
        </Card>

        {/* Info cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Client Information */}
          <Card className="p-6 border border-slate-200 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-4">
              Client Information
            </h2>
            <dl className="space-y-3">
              <InfoRow label="Name" value={quotation.clientName} />
              <InfoRow label="Email" value={quotation.clientEmail ?? '—'} />
              <InfoRow label="Client Type" value={quotation.clientType ?? '—'} />
              <InfoRow label="Country" value={quotation.country} />
            </dl>
          </Card>

          {/* Quotation Information */}
          <Card className="p-6 border border-slate-200 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-4">
              Quotation Information
            </h2>
            <dl className="space-y-3">
              <InfoRow label="Quotation No" value={quotation.quotationNo} mono />
              <InfoRow label="Service" value={quotation.service} />
              {/* <InfoRow label="Procedure" value={quotation.procedure} /> */}
              <InfoRow label="Country" value={quotation.country} />
              <div className="flex items-start justify-between">
                <dt className="text-sm text-gray-500">Status</dt>
                <dd>
                  <StatusBadge status={quotation.status} />
                </dd>
              </div>
              <InfoRow label="Date" value={formattedDate} />
              <InfoRow label="Valid Days" value={`${quotation.validDays} days`} />
              <InfoRow label="Currency" value={quotation.currency} />
            </dl>
          </Card>
        </div>

        {/* Fee Summary */}
        <QuotationFeeSummary
          data={feeSummaryRows}
          currency={quotation.currency}
        />

        <Card className="p-6 border border-slate-200 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Requirements</h2>

          {requirementsToDisplay.length === 0 ? (
            <p className="text-sm text-slate-500">
              No requirements assigned for this quotation.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full border-collapse bg-white">
                <thead>
                  <tr className="bg-indigo-700">
                    <th className="w-16 border border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white">
                      #
                    </th>
                    <th className="border border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white">
                      Requirement
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {requirementsToDisplay.map((requirement, index) => (
                    <tr
                      key={requirement._id}
                      className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                    >
                      <td className="border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
                        {index + 1}
                      </td>
                      <td className="border border-slate-200 px-4 py-3 text-sm text-slate-700">
                        <div
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(requirement.requirements) }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-6 border border-slate-200 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 mb-2">
            QR Code for PDF Download
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            Scan this QR code to open the PDF download link directly.
          </p>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              {qrImageUrl ? (
                <img
                  src={qrImageUrl}
                  alt="QR code for quotation PDF download"
                  width={180}
                  height={180}
                />
              ) : (
                <div className="w-[180px] h-[180px] bg-slate-100 animate-pulse rounded-lg" />
              )}
            </div>
            <div className="space-y-3">
              <Button variant="primary" onClick={() => window.open(pdfDownloadPath, '_blank')}>
                Download PDF
              </Button>
              <p className="text-xs text-slate-500 break-all max-w-xl">{qrDownloadUrl || 'Preparing secure link...'}</p>
            </div>
          </div>
        </Card>

        {/* Notes */}
        {quotation.notes && (
          <Card className="p-6 border border-slate-200 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Notes</h2>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{quotation.notes}</p>
          </Card>
        )}

        {/* Terms & Conditions */}
        <Card className="p-6 border border-slate-200 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 mb-3">
            Terms & Conditions
          </h2>
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              1. This quotation is valid for{' '}
              <strong>{quotation.validDays} days</strong> from the date of issue.
            </p>
            <p>
              2. All fees are quoted in <strong>{quotation.currency}</strong> and
              are subject to change without prior notice after the validity period.
            </p>
            <p>
              3. Government fees are based on current official schedules and may be
              subject to revision by the relevant authority.
            </p>
            <p>
              4. Payment is due within 30 days of invoice issuance unless otherwise
              agreed in writing.
            </p>
            <p>
              5. This quotation does not constitute a legal opinion or guarantee of
              registration.
            </p>
          </div>
        </Card>
      </div>

      {/* Send Email Modal */}
      <Modal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        title="Send Quotation by Email"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Recipient Email"
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="recipient@example.com"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setEmailModalOpen(false)}
              disabled={sendingEmail}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSendEmail}
              loading={sendingEmail}
              disabled={!recipientEmail.trim()}
            >
              Send Email
            </Button>
          </div>
        </div>
      </Modal>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          aside {
            display: none !important;
          }
          main {
            margin-left: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

// Helper component for detail rows
function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-sm text-gray-500 shrink-0">{label}</dt>
      <dd
        className={`text-sm text-gray-900 text-right ${
          mono ? 'font-mono font-medium' : 'font-medium'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
