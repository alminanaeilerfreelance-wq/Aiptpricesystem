'use client';
import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const ReactQuill = dynamic(
  () => import('react-quill-new'),
  { ssr: false }
);
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Box,
  Alert,
  TextField,
} from '@mui/material';
import { countriesService } from '@/services/countries.service';
import requirementsService from '@/services/requirements.service';

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

const SERVICE_CATEGORY_OPTIONS: ServiceCategory[] = [
  'Trademark',
  'Patent',
  'Copyright',
  'Design',
  'Litigation',
];

const INITIAL_FORM_DATA: {
  country: string;
  serviceCategory: ServiceCategory | '';
  title: string;
  requirements: string;
} = {
  country: '',
  serviceCategory: '',
  title: '',
  requirements: '',
};

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, '').trim();

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
  const [loading, setLoading] = useState(false);
  const [countriesLoading, setCountriesLoading] = useState(false);
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
        setFormData({
          country: response.data.country._id,
          serviceCategory: response.data.serviceCategory || '',
          title: response.data.title || '',
          requirements: response.data.requirements,
        });
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
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ fontWeight: 900 }}>
        {isEditMode ? 'Edit / Update Requirement' : 'Add Requirement'}
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ bgcolor: '#F8FAFC' }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            {/* Country Select */}
            <FormControl fullWidth disabled={loading || countriesLoading}>
              <InputLabel>Country *</InputLabel>
              <Select
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                label="Country *"
              >
                <MenuItem value="">Select a country</MenuItem>
                {countries.map((country) => (
                  <MenuItem key={country._id} value={country._id}>
                    {country.abbreviation ? `${country.abbreviation} - ${country.name}` : country.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth disabled={loading}>
              <InputLabel>Service *</InputLabel>
              <Select
                value={formData.serviceCategory}
                onChange={(e) => setFormData({
                  ...formData,
                  serviceCategory: e.target.value as ServiceCategory | '',
                })}
                label="Service *"
              >
                <MenuItem value="">Select a service</MenuItem>
                {SERVICE_CATEGORY_OPTIONS.map((serviceCategory) => (
                  <MenuItem key={serviceCategory} value={serviceCategory}>
                    {serviceCategory}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Title *"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              fullWidth
              required
              disabled={loading}
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

        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || countriesLoading}
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
