import { useState } from 'react';
import { Download } from 'lucide-react';
import toast from 'react-hot-toast';

type Format = 'csv' | 'xlsx' | 'pdf';

export default function ExportButtons({
  onExport, filenameBase,
}: {
  onExport: (format: Format) => Promise<{ data: BlobPart }>;
  filenameBase: string;
}) {
  const [downloading, setDownloading] = useState<Format | null>(null);

  const handle = async (format: Format) => {
    setDownloading(format);
    try {
      const res = await onExport(format);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filenameBase}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {(['csv', 'xlsx', 'pdf'] as const).map(fmt => (
        <button
          key={fmt}
          onClick={() => handle(fmt)}
          disabled={downloading === fmt}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8,
            color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'IBM Plex Mono', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Download size={12} /> {downloading === fmt ? '...' : fmt.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
