'use client';
import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const ReactQuill = dynamic(
  () => import('react-quill-new'),
  { ssr: false }
);
import {
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Box,
  Alert,
  TextField,
} from '@mui/material';
import { countriesService } from '@/services/countries.service';
import requirementsService from '@/services/requirements.service';
import { proceduresService, Procedure } from '@/services/procedures.service';
import { servicesService, Service } from '@/services/services.service';
import { useDebounce } from '@/hooks/useDebounce';

interface RequirementFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (mode: 'create' | 'update') => void;
  editingId?: string | null;
}

interface Country {
  _id: string;
  name: string;
  abbreviation: string;
  flagCode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type ServiceCategory = 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';

const sidebarDialogTitleSx = {
  bgcolor: '#0B1739',
  color: '#FFFFFF',
  fontWeight: 900,
  py: 1.5,
};

const INITIAL_FORM_DATA: {
  country: string;
  serviceId: string;
  serviceCategory: ServiceCategory | '';
  title: string;
  requirements: string;
} = {
  country: '',
  serviceId: '',
  serviceCategory: '',
  title: '',
  requirements: '',
};

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, '').trim();
const uniqueProceduresById = (items: Procedure[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item._id)) return false;
    seen.add(item._id);
    return true;
  });
};

const requirementTableToolbarHandlers = {
  insertTable(this: any) {
    this.quill.getModule('table')?.insertTable(3, 3);
  },
  insertRowAbove(this: any) {
    this.quill.getModule('table')?.insertRowAbove();
  },
  insertRowBelow(this: any) {
    this.quill.getModule('table')?.insertRowBelow();
  },
  insertColumnLeft(this: any) {
    this.quill.getModule('table')?.insertColumnLeft();
  },
  insertColumnRight(this: any) {
    this.quill.getModule('table')?.insertColumnRight();
  },
  deleteRow(this: any) {
    this.quill.getModule('table')?.deleteRow();
  },
  deleteColumn(this: any) {
    this.quill.getModule('table')?.deleteColumn();
  },
  deleteTable(this: any) {
    this.quill.getModule('table')?.deleteTable();
  },
};

const requirementFormEditorModules = {
  table: true,
  toolbar: {
    container: '#requirement-form-toolbar',
    handlers: requirementTableToolbarHandlers,
  },
};

const RequirementFormToolbar = () => (
  <Box id="requirement-form-toolbar" className="requirement-cart-toolbar">
    <span className="ql-formats">
      <select className="ql-header" defaultValue="" aria-label="Heading">
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="">Normal</option>
      </select>
      <button type="button" className="ql-bold" aria-label="Bold" />
      <button type="button" className="ql-italic" aria-label="Italic" />
      <button type="button" className="ql-underline" aria-label="Underline" />
      <button type="button" className="ql-link" aria-label="Link" />
      <button type="button" className="ql-list" value="ordered" aria-label="Numbered list" />
      <button type="button" className="ql-list" value="bullet" aria-label="Bullet list" />
    </span>
    <span className="ql-formats requirement-cart-table-tools">
      <button type="button" className="ql-insertTable" aria-label="Insert table">Table</button>
      <button type="button" className="ql-insertRowAbove" aria-label="Insert row above">Row Up</button>
      <button type="button" className="ql-insertRowBelow" aria-label="Insert row below">Row Down</button>
      <button type="button" className="ql-insertColumnLeft" aria-label="Insert column left">Col Left</button>
      <button type="button" className="ql-insertColumnRight" aria-label="Insert column right">Col Right</button>
      <button type="button" className="ql-deleteRow" aria-label="Delete row">Del Row</button>
      <button type="button" className="ql-deleteColumn" aria-label="Delete column">Del Col</button>
      <button type="button" className="ql-deleteTable" aria-label="Delete table">Del Table</button>
      <button type="button" className="ql-clean" aria-label="Clear formatting" />
    </span>
  </Box>
);

const RequirementForm: React.FC<RequirementFormProps> = ({ open, onClose, onSuccess, editingId }) => {
  const isEditMode = Boolean(editingId);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  const [countries, setCountries] = useState<Country[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null);
  const [procedureTitleInput, setProcedureTitleInput] = useState('');
  const debouncedProcedureTitleInput = useDebounce(procedureTitleInput, 350);
  const [loading, setLoading] = useState(false);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [proceduresLoading, setProceduresLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch countries on mount
  useEffect(() => {
    let active = true;

    const fetchCountries = async () => {
      try {
        setCountriesLoading(true);
        const allCountries = await countriesService.listAll();
        if (!active) return;
        setCountries(allCountries);
      } catch (err) {
        if (!active) return;
        console.error('Failed to fetch countries:', err);
        setError('Failed to fetch countries');
      } finally {
        if (active) setCountriesLoading(false);
      }
    };

    if (open) {
      fetchCountries();
    }

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    let active = true;

    const fetchServices = async () => {
      try {
        setServicesLoading(true);
        const response = await servicesService.list({ page: 1, limit: 1000 });
        if (!active) return;
        setServices((response.services || []).filter((service) => service.isActive !== false));
      } catch (err) {
        if (!active) return;
        console.error('Failed to fetch services:', err);
        setError('Failed to fetch services');
      } finally {
        if (active) setServicesLoading(false);
      }
    };

    if (open) {
      fetchServices();
    }

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    let active = true;

    const fetchProcedures = async () => {
      if (!open || !formData.serviceCategory) {
        setProcedures([]);
        setProceduresLoading(false);
        return;
      }

      try {
        setProceduresLoading(true);

        // If user hasn't typed a search query, load a larger result set
        // so the select's dropdown can show all procedures for the category.
        const searchQuery = debouncedProcedureTitleInput.trim() || undefined;
        const limit = searchQuery && searchQuery.length > 0 ? 25 : 1000;

        const response = await proceduresService.list({
          category: formData.serviceCategory,
          search: searchQuery,
          page: 1,
          limit,
        });
        if (!active) return;
        setProcedures(uniqueProceduresById(response.procedures || []));
      } catch (err) {
        if (!active) return;
        console.error('Failed to fetch procedures:', err);
        setProcedures([]);
        setError('Failed to fetch procedures');
      } finally {
        if (active) setProceduresLoading(false);
      }
    };

    fetchProcedures();

    return () => {
      active = false;
    };
  }, [debouncedProcedureTitleInput, formData.serviceCategory, open]);

  // Fetch requirement data if editing
  useEffect(() => {
    let active = true;

    const fetchRequirement = async () => {
      if (!editingId) return;

      try {
        setFormData(INITIAL_FORM_DATA);
        setError('');
        setLoading(true);
        const response = await requirementsService.getById(editingId);
        if (!active) return;
        const responseService = response.data.serviceId;
        const responseServiceId =
          typeof responseService === 'string' ? responseService : responseService?._id || '';
        setFormData({
          country: response.data.country._id,
          serviceId: responseServiceId,
          serviceCategory: response.data.serviceCategory || '',
          title: response.data.title || '',
          requirements: response.data.requirements,
        });
        setProcedureTitleInput(response.data.title || '');
        setSelectedProcedure(null);
        setError('');
      } catch (err) {
        if (!active) return;
        console.error('Failed to fetch requirement:', err);
        setError('Failed to fetch requirement');
      } finally {
        if (active) setLoading(false);
      }
    };

    if (open && editingId) {
      fetchRequirement();
    } else if (open && !editingId) {
      setFormData(INITIAL_FORM_DATA);
      setProcedureTitleInput('');
      setSelectedProcedure(null);
      setError('');
      setLoading(false);
    }

    return () => {
      active = false;
    };
  }, [open, editingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.country ||
      !formData.serviceCategory ||
      !formData.title.trim() ||
      !stripHtml(formData.requirements)
    ) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const payload = {
        country: formData.country,
        serviceId: formData.serviceId || undefined,
        serviceCategory: formData.serviceCategory,
        title: formData.title.trim(),
        requirements: formData.requirements,
      };

      if (isEditMode && editingId) {
        await requirementsService.update(editingId, payload);
      } else {
        await requirementsService.create(payload);
      }

      onSuccess(isEditMode ? 'update' : 'create');
      handleClose();
    } catch (err: any) {
      console.error('Failed to save requirement:', err);
      setError(err.response?.data?.error || 'Failed to save requirement');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData(INITIAL_FORM_DATA);
    setProcedureTitleInput('');
    setSelectedProcedure(null);
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth slotProps={{ paper: { sx: { borderRadius: 2 } } }}>
      <DialogTitle sx={sidebarDialogTitleSx}>
        {isEditMode ? 'Edit / Update Requirement' : 'Add Requirement'}
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ bgcolor: '#FFFFFF' }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <Autocomplete
              options={countries}
              value={countries.find((country) => country._id === formData.country) || null}
              loading={countriesLoading}
              disabled={loading || countriesLoading}
              isOptionEqualToValue={(option, value) => option._id === value._id}
              getOptionLabel={(country) =>
                country.abbreviation ? `${country.abbreviation} - ${country.name}` : country.name
              }
              onChange={(_event, value) => setFormData({ ...formData, country: value?._id || '' })}
              renderInput={(params) => <TextField {...params} label="Country *" required />}
            />

            <Autocomplete
              options={services}
              value={services.find((service) => service._id === formData.serviceId) || null}
              loading={servicesLoading}
              disabled={loading || servicesLoading}
              isOptionEqualToValue={(option, value) => option._id === value._id}
              getOptionLabel={(service) => `${service.name} (${service.category})`}
              onChange={(_event, value) => {
                  setSelectedProcedure(null);
                  setProcedureTitleInput('');
                  setProcedures([]);
                  setFormData({
                    ...formData,
                    serviceId: value?._id || '',
                    serviceCategory: value?.category || '',
                    title: '',
                  });
                }}
              renderInput={(params) => <TextField {...params} label="Service *" required />}
            />

            <Autocomplete
              options={procedures}
              value={selectedProcedure}
              inputValue={procedureTitleInput}
              loading={proceduresLoading}
              disabled={loading || !formData.serviceCategory}
              filterOptions={(options) => options}
              isOptionEqualToValue={(option, value) => option._id === value._id}
              getOptionLabel={(option) =>
                `${option.name}${option.serviceCategory ? ` (${option.serviceCategory})` : ''}`
              }
              onInputChange={(_event, value, reason) => {
                setProcedureTitleInput(value);
                if (reason === 'input') {
                  setSelectedProcedure(null);
                  setFormData((current) => ({ ...current, title: '' }));
                }
              }}
              onChange={(_event, value) => {
                setSelectedProcedure(value);
                setProcedureTitleInput(value?.name || '');
                setFormData((current) => ({
                  ...current,
                  title: value?.name || '',
                  serviceCategory: value?.serviceCategory || current.serviceCategory,
                }));
                if (value) setProcedures((current) => uniqueProceduresById([value, ...current]));
              }}
              loadingText="Searching procedures..."
              noOptionsText={
                formData.serviceCategory
                  ? 'No procedures found'
                  : 'Select a service first'
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Title / Procedure *"
                  required
                  helperText={
                    formData.serviceCategory
                      ? 'Type to search Procedure model, then select a title.'
                      : 'Select a service first to load procedures.'
                  }
                />
              )}
            />

            {/* Requirements Rich Text Editor */}
            <Box>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                Requirements *
              </label>
              <Box className="requirement-cart-editor" sx={{ bgcolor: '#FFFFFF' }}>
                <RequirementFormToolbar />
                <ReactQuill
                  value={formData.requirements}
                  onChange={(content) => setFormData({ ...formData, requirements: content })}
                  theme="snow"
                  readOnly={loading}
                  modules={requirementFormEditorModules}
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ bgcolor: '#FFFFFF', px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || countriesLoading || servicesLoading}
            startIcon={loading && <CircularProgress size={20} />}
          >
            {loading ? (isEditMode ? 'Updating...' : 'Adding...') : isEditMode ? 'Update Requirement' : 'Add Requirement'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default RequirementForm;
