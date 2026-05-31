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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Box,
  Alert,
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

interface Requirement {
  _id: string;
  country: {
    _id: string;
    name: string;
    code: string;
  };
  requirements: string;
}

const RequirementForm: React.FC<RequirementFormProps> = ({ open, onClose, onSuccess, editingId }) => {
  const [formData, setFormData] = useState({
    country: '',
    requirements: '',
  });

  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(false);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch countries on mount
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        setCountriesLoading(true);
        const response = await countriesService.list({ page: 1, limit: 1000 });
        setCountries(response.countries);
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
        setLoading(true);
        const response = await requirementsService.getById(editingId);
        setFormData({
          country: response.data.country._id,
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
      setFormData({ country: '', requirements: '' });
    }
  }, [open, editingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('handleSubmit called with formData:', formData);

    if (!formData.country || !formData.requirements.trim()) {
      console.log('Validation failed - missing fields');
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      setError('');

      console.log('About to call create/update with:', formData);
      if (editingId) {
        console.log('Updating requirement:', editingId);
        await requirementsService.update(editingId, formData);
      } else {
        console.log('Creating new requirement');
        const result = await requirementsService.create(formData);
        console.log('Create result:', result);
      }

      console.log('About to call onSuccess');
      onSuccess();
      console.log('onSuccess called, now calling handleClose');
      handleClose();
    } catch (err: any) {
      console.error('Failed to save requirement:', err);
      setError(err.response?.data?.error || 'Failed to save requirement');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ country: '', requirements: '' });
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editingId ? 'Edit Requirement' : 'Add Requirement'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            {/* Country Select */}
            <FormControl fullWidth disabled={countriesLoading}>
              <InputLabel>Country *</InputLabel>
              <Select
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                label="Country *"
              >
                <MenuItem value="">Select a country</MenuItem>
                {countries.map((country) => (
                  <MenuItem key={country._id} value={country._id}>
                    {country.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Requirements Rich Text Editor */}
            <Box>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                Requirements *
              </label>
              <ReactQuill
                value={formData.requirements}
                onChange={(content) => setFormData({ ...formData, requirements: content })}
                theme="snow"
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
            {loading ? 'Saving...' : editingId ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default RequirementForm;
