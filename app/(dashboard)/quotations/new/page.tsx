'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import Topbar from '@/components/layout/Topbar';
import { Button, Input, Card } from '@/components/ui';
import {
  ClientInformationCard,
  ServiceDetailsCard,
  QuotationCartTable,
  EditCartItemModal,
  CartItem,
} from '@/components/quotations';
import type { AssociateSuggestion } from '@/components/quotations/ClientInformationCard';
import { useToast } from '@/components/feedback/ToastProvider';
import { quotationsService } from '@/services/quotations.service';
import associteService from '@/services/associte.service';
import { countriesService, Country } from '@/services/countries.service';
import { proceduresService, Procedure } from '@/services/procedures.service';
import { useDebounce } from '@/hooks/useDebounce';

const SERVICES = [
  'Trademark',
  'Patent',
  'Copyright',
  'Design',
  'Litigation',
] as const;
type ServiceType = typeof SERVICES[number];

export default function NewQuotationPage() {
  const router = useRouter();
  const toast = useToast();
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // ASSOCITE INFO STATE
  const [clientSearch, setClientSearch] = useState('');
  const [clientSuggestions, setClientSuggestions] = useState<AssociateSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedAssociteId, setSelectedAssociteId] = useState('');
  const [selectedClient, setSelectedClient] = useState({
    name: '',
    email: '',
    type: '',
    phone: '',
    address: '',
    notes: '',
  });
  const [inquiriesProject, setInquiriesProject] = useState('');
  const [globalNotes, setGlobalNotes] = useState('');

  // SERVICE DETAILS STATE
  const [service, setService] = useState<ServiceType | ''>('');
  const [procedureId, setProcedureId] = useState('');
  const [countryId, setCountryId] = useState('');
  const [numberOfClasses, setNumberOfClasses] = useState(1);
  const [requirementIds, setRequirementIds] = useState<string[]>([]);
  const [officialFee, setOfficialFee] = useState(0);
  const [attorneyFee, setAttorneyFee] = useState(0);
  const [manualTotal, setManualTotal] = useState(0);

  // LOOKUP DATA
  const [countries, setCountries] = useState<Country[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);

  // CART STATE
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [currency, setCurrency] = useState('SAR');

  // EDIT MODAL STATE
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // UI STATE
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const debouncedClientSearch = useDebounce(clientSearch, 350);

  // LOAD STATIC DATA
  useEffect(() => {
    async function loadData() {
      try {
        const cRes = await countriesService.list();
        setCountries(cRes.countries);
      } catch (err) {
        toast.error('Failed to load form data');
      }
    }
    loadData();
  }, []);

  // SEARCH ASSOCITE
  useEffect(() => {
    if (!debouncedClientSearch || debouncedClientSearch.length < 2) {
      setClientSuggestions([]);
      return;
    }
    associteService
      .list({ search: debouncedClientSearch, page: 1, limit: 8 })
      .then((res) => setClientSuggestions((res.assocites || []).slice(0, 8)))
      .catch(() => setClientSuggestions([]));
  }, [debouncedClientSearch]);

  // LOAD PROCEDURES WHEN SERVICE CHANGES
  useEffect(() => {
    if (!service) {
      setProcedures([]);
      setProcedureId('');
      return;
    }
    proceduresService
      .list({ category: service })
      .then((res) => setProcedures(res.procedures))
      .catch(() => setProcedures([]));
    setProcedureId('');
  }, [service]);

  useEffect(() => {
    if (procedureId && !procedures.some((p) => p._id === procedureId)) {
      setProcedureId('');
    }
  }, [procedures, procedureId]);

  // DISMISS SUGGESTIONS ON OUTSIDE CLICK
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

  // HANDLERS
  const handleSelectClient = (associte: AssociateSuggestion) => {
    setSelectedAssociteId(associte._id);
    setClientSearch(associte.associteName);
    setSelectedClient({
      name: associte.associteName,
      email: associte.email || '',
      type: associte.associteType || '',
      phone: associte.contact || '',
      address: associte.address || '',
      notes: associte.notes || '',
    });
    setShowSuggestions(false);
  };

  const handleClientSearchChange = (value: string) => {
    setClientSearch(value);
    setShowSuggestions(true);
    setSelectedAssociteId('');
    setSelectedClient({
      name: value,
      email: '',
      type: '',
      phone: '',
      address: '',
      notes: '',
    });
  };

  const handleServiceChange = (value: string) => {
    setService(value as ServiceType);
    setCountryId('');
    setProcedureId('');
    setRequirementIds([]);
    setNumberOfClasses(1);
    setOfficialFee(0);
    setAttorneyFee(0);
    setManualTotal(0);
    setErrors((prev) => ({ ...prev, service: '', country: '', procedure: '' }));
  };

  const handleCountryChange = (value: string) => {
    setCountryId(value);
    setProcedureId('');
    setRequirementIds([]);
    setErrors((prev) => ({ ...prev, country: '', procedure: '' }));
  };

  const handleAddToCart = () => {
    const newErrors: Record<string, string> = {};
    if (!service) newErrors.service = 'Service is required';
    if (!procedureId) newErrors.procedure = 'Procedure is required';
    if (!countryId) newErrors.country = 'Country is required';
    if (officialFee < 0) newErrors.officialFee = 'Official fee must be non-negative';
    if (attorneyFee < 0) newErrors.attorneyFee = 'Attorney fee must be non-negative';
    if (manualTotal < 0) newErrors.total = 'Total must be non-negative';
    if (manualTotal > 0 && manualTotal < officialFee + attorneyFee) {
      newErrors.total = 'Total must be at least Official Fee + Attorney Fee';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Please fill in all required fields');
      return;
    }

    const procedure = procedures.find((p) => p._id === procedureId);
    const country = countries.find((c) => c._id === countryId);

    if (!procedure || !country) {
      toast.error('Unable to add item. Please check your selections.');
      return;
    }

    const calculatedTotal = officialFee + attorneyFee;
    const finalTotal = manualTotal > 0 ? manualTotal : calculatedTotal;

    const newCartItem: CartItem = {
      id: uuidv4(),
      procedureName: procedure.name,
      procedureId,
      countryName: country.name,
      countryId,
      serviceCategory: service as ServiceType,
      numberOfClasses: service === 'Trademark' ? numberOfClasses : 1,
      officialFee,
      attorneyFee,
      classFee: 0,
      requirementIds,
      total: finalTotal,
      isManualTotal: true,
    };

    setCartItems([...cartItems, newCartItem]);
    toast.success('Item added to cart');

    // Reset service details for next item
    setService('');
    setProcedureId('');
    setCountryId('');
    setNumberOfClasses(1);
    setRequirementIds([]);
    setOfficialFee(0);
    setAttorneyFee(0);
    setManualTotal(0);
    setErrors({});
  };

  const handleRemoveCartItem = (itemId: string) => {
    setCartItems(cartItems.filter((item) => item.id !== itemId));
    toast.success('Item removed from cart');
  };

  const handleEditCartItem = (itemId: string) => {
    setEditingItemId(itemId);
    setIsEditModalOpen(true);
  };

  const handleSaveEditedItem = (updatedItem: CartItem) => {
    setCartItems(cartItems.map((item) =>
      item.id === updatedItem.id ? updatedItem : item
    ));
    toast.success('Item updated in cart');
  };

  const editingItem = editingItemId
    ? cartItems.find((item) => item.id === editingItemId) || null
    : null;

  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!selectedClient.name.trim()) newErrors.clientName = 'Associte name is required';
    if (!selectedAssociteId) newErrors.clientName = 'Please select associte from suggestions';
    if (cartItems.length === 0) newErrors.cart = 'At least one item must be added to cart';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      const created = await Promise.all(
        cartItems.map((item) =>
        {
          const classFee =
            item.serviceCategory === 'Trademark' ? item.classFee : 0;
          const numberOfClasses =
            item.serviceCategory === 'Trademark' ? item.numberOfClasses : 1;
          const baseSubtotal = item.officialFee + item.attorneyFee + classFee * numberOfClasses;
          const targetTotal = item.isManualTotal ? item.total : baseSubtotal;
          const procedureFee = Math.max(0, targetTotal - baseSubtotal);

          return quotationsService.create({
            associteId: selectedAssociteId || undefined,
            clientName: selectedClient.name.trim(),
            clientEmail: selectedClient.email.trim() || undefined,
            clientType: selectedClient.type || undefined,
            inquiriesProject: inquiriesProject.trim() || undefined,
            service: item.serviceCategory,
            procedure: item.procedureName,
            country: item.countryName,
            numberOfClasses,
            requirementIds: item.requirementIds,
            fees: {
              governmentFee: item.officialFee,
              serviceFee: item.attorneyFee,
              classFee,
              procedureFee,
            },
            multiplier: 1,
            currency,
            notes: globalNotes.trim() || undefined,
            status: 'Draft',
          });
        }
        )
      );

      if (created.length === 1) {
        toast.success('Quotation created successfully');
        router.push(`/quotations/${created[0]._id}`);
        return;
      }

      toast.success(`${created.length} quotations created successfully`);
      router.push('/quotations');
    } catch (err) {
      toast.error(
        'Failed to create quotation',
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar
        title="New Quotation"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Quotations', href: '/quotations' },
          { label: 'New' },
        ]}
      />

      <form onSubmit={handleCreateQuotation} className="flex-1 p-6 space-y-6">
        {/* CLIENT INFO & SERVICE DETAILS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ClientInformationCard
            clientSearch={clientSearch}
            onClientSearchChange={handleClientSearchChange}
            clientSuggestions={clientSuggestions}
            showSuggestions={showSuggestions}
            onShowSuggestions={setShowSuggestions}
            onSelectClient={handleSelectClient}
            selectedClient={selectedClient}
            inquiriesProject={inquiriesProject}
            onInquiriesProjectChange={setInquiriesProject}
            errors={errors}
            suggestionsRef={suggestionsRef}
          />

          <ServiceDetailsCard
            service={service as ServiceType}
            procedureId={procedureId}
            countryId={countryId}
            numberOfClasses={numberOfClasses}
            requirementIds={requirementIds}
            procedures={procedures}
            countries={countries}
            officialFee={officialFee}
            attorneyFee={attorneyFee}
            totalFee={manualTotal}
            onServiceChange={handleServiceChange}
            onProcedureChange={setProcedureId}
            onCountryChange={handleCountryChange}
            onNumberOfClassesChange={setNumberOfClasses}
            onRequirementsChange={setRequirementIds}
            onOfficialFeeChange={setOfficialFee}
            onAttorneyFeeChange={setAttorneyFee}
            onTotalFeeChange={setManualTotal}
            errors={errors}
            onAddToCart={handleAddToCart}
          />
        </div>

        {/* CART TABLE */}
        <QuotationCartTable
          items={cartItems}
          onRemoveItem={handleRemoveCartItem}
          onEditItem={handleEditCartItem}
          currency={currency}
        />

        {/* EDIT CART ITEM MODAL */}
        <EditCartItemModal
          isOpen={isEditModalOpen}
          item={editingItem}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingItemId(null);
          }}
          onSave={handleSaveEditedItem}
          currency={currency}
        />

        {/* GLOBAL NOTES */}
        {cartItems.length > 0 && (
          <Card className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">
              Quotation Notes
            </h2>
            <div>
              <label className="label">Additional Notes</label>
              <textarea
                className="input resize-none"
                rows={3}
                value={globalNotes}
                onChange={(e) => setGlobalNotes(e.target.value)}
                placeholder="Any additional notes or terms for this quotation..."
              />
            </div>
            <div className="flex gap-2 items-center">
              <Input
                label="Currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="SAR"
              />
            </div>
          </Card>
        )}

        {/* SUBMIT BUTTONS */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push('/quotations')}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={cartItems.length === 0 || submitting}
            loading={submitting}
          >
            Create Quotation ({cartItems.length} item{cartItems.length !== 1 ? 's' : ''})
          </Button>
        </div>
      </form>
    </div>
  );
}
