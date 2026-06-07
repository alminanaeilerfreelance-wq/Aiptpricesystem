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
  onSuccess: () => void;
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

const RequirementForm: React.FC<RequirementFormProps> = ({ open, onClose, onSuccess, editingId }) => {
  const isEditMode = Boolean(editingId);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(false);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch countries on mount
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        setCountriesLoading(true);
        const allCountries = await countriesService.listAll();
        setCountries(allCountries);
      } catch (err) {
        console.error('Failed to fetch countries:', err);
        setError('Failed to fetch countries');
      } finally {
        setCountriesLoading(false);
      }
    };

    if (open) {
      fetchCountries();
    }
  }, [open]);

  // Fetch requirement data if editing
  useEffect(() => {
    const fetchRequirement = async () => {
      if (!editingId) return;

      try {
        setFormData(INITIAL_FORM_DATA);
        setError('');
        setLoading(true);
        const response = await requirementsService.getById(editingId);
        setFormData({
          country: response.data.country._id,
          serviceCategory: response.data.serviceCategory || '',
          title: response.data.title || '',
          requirements: response.data.requirements,
        });
        setError('');
      } catch (err) {
        console.error('Failed to fetch requirement:', err);
        setError('Failed to fetch requirement');
      } finally {
        setLoading(false);
      }
    };

    if (open && editingId) {
      fetchRequirement();
    } else if (open && !editingId) {
      setFormData(INITIAL_FORM_DATA);
      setError('');
    }
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

      onSuccess();
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
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEditMode ? 'Edit / Update Requirement' : 'Add Requirement'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
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
              <ReactQuill
                value={formData.requirements}
                onChange={(content) => setFormData({ ...formData, requirements: content })}
                theme="snow"
                readOnly={loading}
                modules={{
                  toolbar: [
                    [{ header: [1, 2, false] }],
                    ['bold', 'italic', 'underline'],
                    ['link', 'blockquote', 'code-block'],
                    [{ list: 'ordered' }, { list: 'bullet' }],
                    ['clean'],
                  ],
                }}
              />
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
