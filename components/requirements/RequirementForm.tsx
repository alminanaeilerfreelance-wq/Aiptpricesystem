import React, { useEffect, useRef, useState } from 'react';
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
  Typography,
  Stack,
  TextField,
  Divider,
} from '@mui/material';
import { countriesService } from '@/services/countries.service';
import { servicesService } from '@/services/services.service';
import requirementsService from '@/services/requirements.service';

type ServiceCategory = 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';

interface RequirementFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingId?: string | null;
}

interface Country {
  _id: string;
  name: string;
}

const DEFAULT_CATEGORIES: ServiceCategory[] = ['Trademark', 'Patent', 'Copyright', 'Design', 'Litigation'];

const getPlainText = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
const normalizeHtml = (html: string) => {
  const cleaned = html.trim();
  if (!cleaned || cleaned === '<p><br></p>' || cleaned === '<br>') return '';
  return html;
};

const RequirementForm: React.FC<RequirementFormProps> = ({ open, onClose, onSuccess, editingId }) => {
  const [country, setCountry] = useState('');
  const [serviceCategory, setServiceCategory] = useState<ServiceCategory | ''>('');
  const [requirementsHtml, setRequirementsHtml] = useState('');
  const [countries, setCountries] = useState<Country[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(false);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [error, setError] = useState('');
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);

  const syncEditorHtml = (html: string) => {
    if (!editorRef.current) return;
    const normalized = normalizeHtml(html);
    if (normalizeHtml(editorRef.current.innerHTML) !== normalized) {
      editorRef.current.innerHTML = normalized;
    }
  };

  useEffect(() => {
    if (!open) return;
    const loadLookups = async () => {
      try {
        setLookupsLoading(true);
        const [countriesRes, servicesRes] = await Promise.all([
          countriesService.list({ page: 1, limit: 1000 }),
          servicesService.list({ page: 1, limit: 1000 }),
        ]);
        setCountries((countriesRes.countries || []).map((c) => ({ _id: c._id, name: c.name })));
        const cats = Array.from(new Set((servicesRes.services || []).map((s) => s.category))).filter(Boolean) as ServiceCategory[];
        setCategories(cats.length ? cats : DEFAULT_CATEGORIES);
      } catch {
        setError('Failed to load countries/services');
        setCategories(DEFAULT_CATEGORIES);
      } finally {
        setLookupsLoading(false);
      }
    };
    loadLookups();
  }, [open]);

  useEffect(() => {
    const fetchRequirement = async () => {
      if (!editingId || !open) return;
      try {
        setLoading(true);
        const res = await requirementsService.getById(editingId);
        setCountry(res.data.country._id);
        setServiceCategory((res.data.serviceCategory as ServiceCategory) || '');
        const html = res.data.requirements || '';
        setRequirementsHtml(html);
        syncEditorHtml(html);
      } catch {
        setError('Failed to load requirement');
      } finally {
        setLoading(false);
      }
    };

    if (open && editingId) {
      fetchRequirement();
    } else if (open && !editingId) {
      setCountry('');
      setServiceCategory('');
      setRequirementsHtml('');
      syncEditorHtml('');
      setError('');
    }
  }, [open, editingId]);

  const runCommand = (command: string, value?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    const html = normalizeHtml(editorRef.current.innerHTML);
    setRequirementsHtml(html);
    setError('');
  };

  const saveSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (editorRef.current?.contains(range.commonAncestorContainer)) savedRangeRef.current = range.cloneRange();
  };

  const restoreSelection = () => {
    const selection = window.getSelection();
    if (!selection || !savedRangeRef.current) return;
    selection.removeAllRanges();
    selection.addRange(savedRangeRef.current);
  };

  const handleInsertLink = () => {
    const trimmed = linkUrl.trim();
    if (!trimmed) {
      setLinkDialogOpen(false);
      return;
    }
    const normalized = /^(https?:\/\/|mailto:)/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand('createLink', false, normalized);
    const html = normalizeHtml(editorRef.current?.innerHTML || '');
    setRequirementsHtml(html);
    setLinkDialogOpen(false);
    setLinkUrl('');
    savedRangeRef.current = null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const html = normalizeHtml(editorRef.current?.innerHTML || requirementsHtml);
    const plain = getPlainText(html);

    if (!country) return setError('Country is required');
    if (!serviceCategory) return setError('Service is required');
    if (!plain) return setError('Requirements is required');

    try {
      setLoading(true);
      setError('');
      const payload = { country, serviceCategory, requirements: html, upsertByCountry: true };
      if (editingId) await requirementsService.update(editingId, payload);
      else await requirementsService.create(payload);
      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save requirement');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCountry('');
    setServiceCategory('');
    setRequirementsHtml('');
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
            <FormControl fullWidth disabled={lookupsLoading || loading}>
              <InputLabel>Country *</InputLabel>
              <Select value={country} label="Country *" onChange={(e) => setCountry(String(e.target.value))}>
                <MenuItem value="">Select country</MenuItem>
                {countries.map((c) => <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl fullWidth disabled={lookupsLoading || loading}>
              <InputLabel>Service *</InputLabel>
              <Select value={serviceCategory} label="Service *" onChange={(e) => setServiceCategory(e.target.value as ServiceCategory)}>
                <MenuItem value="">Select service</MenuItem>
                {categories.map((cat) => <MenuItem key={cat} value={cat}>{cat}</MenuItem>)}
              </Select>
            </FormControl>

            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>Requirements *</Typography>
              <Box sx={{ border: '1px solid #d0d5dd', borderRadius: 1, backgroundColor: '#fff', overflow: 'hidden' }}>
                <Stack direction="row" spacing={1} sx={{ p: 1, borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
                  <Button type="button" size="small" onClick={() => runCommand('bold')}>Bold</Button>
                  <Button type="button" size="small" onClick={() => runCommand('italic')}>Italic</Button>
                  <Button type="button" size="small" onClick={() => runCommand('underline')}>Underline</Button>
                  <Button type="button" size="small" onClick={() => runCommand('insertUnorderedList')}>Bullet</Button>
                  <Button type="button" size="small" onClick={() => runCommand('insertOrderedList')}>Number</Button>
                  <Divider flexItem orientation="vertical" />
                  <Button type="button" size="small" onClick={() => { editorRef.current?.focus(); saveSelection(); setLinkDialogOpen(true); }}>Link</Button>
                  <Button type="button" size="small" onClick={() => runCommand('unlink')}>Unlink</Button>
                </Stack>
                <Box
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={() => setRequirementsHtml(normalizeHtml(editorRef.current?.innerHTML || ''))}
                  sx={{ minHeight: 180, p: 1.5, outline: 'none', '&:empty:before': { content: '"Enter requirements..."', color: '#94a3b8' } }}
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={loading || lookupsLoading}>
            {loading ? <CircularProgress size={20} /> : editingId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>

      <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Insert Link</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth margin="dense" label="URL" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleInsertLink}>Insert</Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default RequirementForm;
