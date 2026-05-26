import React, { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Checkbox,
  FormControl,
  InputLabel,
  ListItemText,
  Select,
  MenuItem,
  CircularProgress,
  Box,
  Alert,
  Typography,
  Stack,
  TextField,
  Divider,
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

const getPlainText = (html: string) => html
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const normalizeHtml = (html: string) => {
  const cleaned = html.trim();
  if (!cleaned || cleaned === '<p><br></p>' || cleaned === '<br>') {
    return '';
  }
  return html;
};

const RequirementForm: React.FC<RequirementFormProps> = ({ open, onClose, onSuccess, editingId }) => {
  const isEditing = Boolean(editingId);
  const [formData, setFormData] = useState({
    countries: [] as string[],
    requirements: '',
  });
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(false);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [error, setError] = useState('');
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);

  const syncEditorHtml = (html: string) => {
    if (!editorRef.current) return;
    const normalized = normalizeHtml(html);
    const current = normalizeHtml(editorRef.current.innerHTML);
    if (current !== normalized) {
      editorRef.current.innerHTML = normalized;
    }
  };

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        setCountriesLoading(true);
        const response = await countriesService.list({ page: 1, limit: 1000 });
        setCountries(response.countries || []);
      } catch {
        setError('Failed to fetch countries');
      } finally {
        setCountriesLoading(false);
      }
    };

    if (open) {
      fetchCountries();
    }
  }, [open]);

  useEffect(() => {
    const fetchRequirement = async () => {
      if (!editingId) return;

      try {
        setLoading(true);
        const response = await requirementsService.getById(editingId);
        const requirementHtml = response.data.requirements || '';
        setFormData({
          countries: [response.data.country._id],
          requirements: requirementHtml,
        });
        syncEditorHtml(requirementHtml);
        setError('');
      } catch {
        setError('Failed to fetch requirement');
      } finally {
        setLoading(false);
      }
    };

    if (open && editingId) {
      fetchRequirement();
    } else if (open && !editingId) {
      setFormData({ countries: [], requirements: '' });
      syncEditorHtml('');
      setError('');
    }
  }, [open, editingId]);

  useEffect(() => {
    if (open) {
      syncEditorHtml(formData.requirements);
    }
  }, [open]);

  const runCommand = (command: string, value?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    const html = normalizeHtml(editorRef.current.innerHTML);
    setFormData((prev) => ({ ...prev, requirements: html }));
    setError('');
  };

  const applyBlock = (tag: 'p' | 'h1' | 'h2' | 'blockquote') => {
    runCommand('formatBlock', tag);
  };

  const saveEditorSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (editorRef.current?.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  };

  const restoreEditorSelection = () => {
    const selection = window.getSelection();
    if (!selection || !savedRangeRef.current) return;
    selection.removeAllRanges();
    selection.addRange(savedRangeRef.current);
  };

  const handleAddLink = () => {
    editorRef.current?.focus();
    saveEditorSelection();
    setLinkUrl('');
    setLinkDialogOpen(true);
  };

  const handleInsertLink = () => {
    const trimmedUrl = linkUrl.trim();
    if (!trimmedUrl) {
      setLinkDialogOpen(false);
      return;
    }

    const normalizedUrl = /^(https?:\/\/|mailto:)/i.test(trimmedUrl)
      ? trimmedUrl
      : `https://${trimmedUrl}`;

    editorRef.current?.focus();
    restoreEditorSelection();
    document.execCommand('createLink', false, normalizedUrl);

    const html = normalizeHtml(editorRef.current?.innerHTML || '');
    setFormData((prev) => ({ ...prev, requirements: html }));
    setError('');
    setLinkDialogOpen(false);
    setLinkUrl('');
    savedRangeRef.current = null;
  };

  const handleCloseLinkDialog = () => {
    setLinkDialogOpen(false);
    setLinkUrl('');
    savedRangeRef.current = null;
  };

  const handleEditorInput = () => {
    const html = normalizeHtml(editorRef.current?.innerHTML || '');
    setFormData((prev) => ({ ...prev, requirements: html }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const latestHtml = normalizeHtml(editorRef.current?.innerHTML || formData.requirements);
    const latestPlain = getPlainText(latestHtml);

    if (formData.countries.length === 0) {
      setError(isEditing ? 'Country is required' : 'At least one country is required');
      return;
    }

    if (!latestPlain) {
      setError('Requirements is required');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const payload = {
        country: formData.countries[0],
        requirements: latestHtml,
      };

      if (editingId) {
        await requirementsService.update(editingId, payload);
      } else {
        const failedCountries: string[] = [];
        for (const countryId of formData.countries) {
          try {
            await requirementsService.create({
              country: countryId,
              requirements: latestHtml,
              upsertByCountry: true,
            });
          } catch {
            const countryName = countries.find((item) => item._id === countryId)?.name || countryId;
            failedCountries.push(countryName);
          }
        }

        if (failedCountries.length > 0) {
          throw new Error(`Failed to save countries: ${failedCountries.join(', ')}`);
        }
      }

      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save requirement');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ countries: [], requirements: '' });
    syncEditorHtml('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>{editingId ? 'Edit Requirement' : 'Add Requirement'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControl fullWidth disabled={countriesLoading || loading}>
              <InputLabel>{isEditing ? 'Country *' : 'Countries *'}</InputLabel>
              {isEditing ? (
                <Select
                  value={formData.countries[0] || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, countries: [e.target.value] });
                    setError('');
                  }}
                  label="Country *"
                >
                  <MenuItem value="">Select a country</MenuItem>
                  {countries.map((country) => (
                    <MenuItem key={country._id} value={country._id}>
                      {country.name}
                    </MenuItem>
                  ))}
                </Select>
              ) : (
                <Select
                  multiple
                  value={formData.countries}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({
                      ...formData,
                      countries: Array.isArray(value) ? value : String(value).split(','),
                    });
                    setError('');
                  }}
                  label="Countries *"
                  renderValue={(selected) => {
                    const selectedIds = selected as string[];
                    if (selectedIds.length === 0) return 'Select countries';
                    return selectedIds
                      .map((countryId) => countries.find((country) => country._id === countryId)?.name || countryId)
                      .join(', ');
                  }}
                >
                  {countries.map((country) => {
                    const checked = formData.countries.includes(country._id);
                    return (
                      <MenuItem key={country._id} value={country._id}>
                        <Checkbox checked={checked} size="small" />
                        <ListItemText primary={country.name} />
                      </MenuItem>
                    );
                  })}
                </Select>
              )}
            </FormControl>

            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                Requirements *
              </Typography>
              <Box
                sx={{
                  border: '1px solid #d0d5dd',
                  borderRadius: 1,
                  backgroundColor: '#fff',
                  overflow: 'hidden',
                }}
              >
                <Stack direction="row" spacing={1} sx={{ p: 1, borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
                  <Button type="button" size="small" variant="text" onClick={() => applyBlock('p')}>P</Button>
                  <Button type="button" size="small" variant="text" onClick={() => applyBlock('h1')}>H1</Button>
                  <Button type="button" size="small" variant="text" onClick={() => applyBlock('h2')}>H2</Button>
                  <Button type="button" size="small" variant="text" onClick={() => applyBlock('blockquote')}>Quote</Button>
                  <Divider flexItem orientation="vertical" />
                  <Button type="button" size="small" variant="text" onClick={() => runCommand('bold')}>Bold</Button>
                  <Button type="button" size="small" variant="text" onClick={() => runCommand('italic')}>Italic</Button>
                  <Button type="button" size="small" variant="text" onClick={() => runCommand('underline')}>Underline</Button>
                  <Button type="button" size="small" variant="text" onClick={() => runCommand('insertUnorderedList')}>Bullet</Button>
                  <Button type="button" size="small" variant="text" onClick={() => runCommand('insertOrderedList')}>Number</Button>
                  <Divider flexItem orientation="vertical" />
                  <Button type="button" size="small" variant="text" onClick={handleAddLink}>Link</Button>
                  <Button type="button" size="small" variant="text" onClick={() => runCommand('unlink')}>Unlink</Button>
                  <Divider flexItem orientation="vertical" />
                  <Button type="button" size="small" variant="text" onClick={() => runCommand('undo')}>Undo</Button>
                  <Button type="button" size="small" variant="text" onClick={() => runCommand('redo')}>Redo</Button>
                  <Button type="button" size="small" variant="text" onClick={() => runCommand('removeFormat')}>Clear</Button>
                </Stack>
                <Box
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleEditorInput}
                  sx={{
                    minHeight: 180,
                    p: 1.5,
                    outline: 'none',
                    '&:empty:before': {
                      content: '"Enter requirements..."',
                      color: '#94a3b8',
                    },
                  }}
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={loading || countriesLoading}>
            {loading ? <CircularProgress size={20} /> : editingId ? 'Update' : 'Save'}
          </Button>
        </DialogActions>
      </form>

      <Dialog open={linkDialogOpen} onClose={handleCloseLinkDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Insert Link</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="URL"
            placeholder="https://example.com"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleInsertLink();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={handleCloseLinkDialog}>Cancel</Button>
          <Button type="button" variant="contained" onClick={handleInsertLink}>Insert</Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default RequirementForm;
