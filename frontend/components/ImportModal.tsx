import { useRef, useState } from 'react';
import { X, Upload, Download, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export type ImportResult = { created: number; skipped: number; errors: { row: number; reason: string }[] };

type ImportModalProps = {
  open: boolean;
  title: string;
  description: string;
  templateHeaders: string[];
  templateExampleRow: string[];
  templateFilename: string;
  extraFields?: React.ReactNode;
  canSubmit?: boolean;
  onClose: () => void;
  onImport: (file: File) => Promise<ImportResult>;
  onDone?: () => void;
};

export default function ImportModal({
  open, title, description, templateHeaders, templateExampleRow, templateFilename,
  extraFields, canSubmit = true, onClose, onImport, onDone,
}: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const downloadTemplate = () => {
    const csv = [templateHeaders.join(','), templateExampleRow.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = templateFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!file) { toast.error('Choose a file first'); return; }
    if (!canSubmit) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await onImport(file);
      setResult(res);
      if (res.created > 0) {
        toast.success(`Imported ${res.created} row${res.created === 1 ? '' : 's'}`);
        onDone?.();
      } else {
        toast.error('Nothing was imported — see the details below');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>{title}</h2>
          <button onClick={() => { reset(); onClose(); }} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 13, color: '#64748B', marginBottom: 18 }}>{description}</p>

        <button onClick={downloadTemplate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, color: '#3B82F6', fontSize: 12, fontFamily: 'IBM Plex Mono', cursor: 'pointer', marginBottom: 18 }}>
          <Download size={13} /> Download CSV template
        </button>

        {extraFields}

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' }}>File (CSV or Excel .xlsx)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xlsm"
            onChange={e => { setFile(e.target.files?.[0] || null); setResult(null); }}
            style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', boxSizing: 'border-box' }}
          />
        </div>

        <button
          onClick={handleImport}
          disabled={importing || !file || !canSubmit}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 12,
            background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne',
            fontSize: 14, border: 'none', borderRadius: 8, cursor: importing || !file || !canSubmit ? 'default' : 'pointer',
            opacity: importing || !file || !canSubmit ? 0.6 : 1,
          }}
        >
          <Upload size={15} /> {importing ? 'Importing...' : 'Import'}
        </button>

        {result && (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13, color: 'var(--text-primary)' }}>
              <CheckCircle size={15} color="#10B981" />
              {result.created} created{result.skipped > 0 ? `, ${result.skipped} skipped` : ''}
            </div>
            {result.errors.length > 0 && (
              <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 14px', maxHeight: 180, overflowY: 'auto' }}>
                {result.errors.map((e, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'var(--text-secondary)', marginBottom: i < result.errors.length - 1 ? 6 : 0 }}>
                    <AlertTriangle size={12} color="#EF4444" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span><strong style={{ color: '#EF4444' }}>Row {e.row}:</strong> {e.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
