import { AlertTriangle } from 'lucide-react';

type ConfirmDialogProps = {
  open: boolean;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({ open, message, confirmLabel, cancelLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 24, width: 380 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle size={18} color="#EF4444" />
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans', lineHeight: 1.5, marginTop: 6 }}>{message}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: 10, background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', borderRadius: 8, fontWeight: 600, fontFamily: 'Syne', fontSize: 13, cursor: 'pointer' }}>
            {cancelLabel}
          </button>
          <button onClick={onConfirm} style={{ flex: 1, padding: 10, background: '#EF4444', border: 'none', color: '#fff', borderRadius: 8, fontWeight: 700, fontFamily: 'Syne', fontSize: 13, cursor: 'pointer' }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
