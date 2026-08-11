interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: { value: number; label: string };
  color?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export default function MetricCard({ label, value, subtext, trend, color = '#FBC02D', icon, onClick }: MetricCardProps) {
  const isPositive = trend && trend.value >= 0;

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-strong)',
      borderRadius: 12,
      padding: '20px 22px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.2s ease',
      cursor: onClick ? 'pointer' : 'default',
    }}
    onClick={onClick}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = color; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 24px ${color}18`; }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
    >
      {/* Top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${color}, transparent)`,
      }} />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
          {label}
        </span>
        {icon && (
          <div style={{ color: color, opacity: 0.7 }}>{icon}</div>
        )}
      </div>

      <div style={{
        fontSize: 28, fontFamily: 'IBM Plex Mono', fontWeight: 600,
        color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: 6,
      }}>
        {value}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {trend && (
          <span style={{
            fontSize: 11, fontFamily: 'IBM Plex Mono', fontWeight: 500,
            color: isPositive ? '#10B981' : '#EF4444',
            background: isPositive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            padding: '2px 6px', borderRadius: 4,
          }}>
            {isPositive ? '+' : ''}{trend.value}%
          </span>
        )}
        {subtext && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Sans' }}>
            {subtext}
          </span>
        )}
      </div>
    </div>
  );
}
