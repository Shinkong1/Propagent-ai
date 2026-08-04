import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { ClipboardCheck, Plus, X, ChevronDown, ChevronUp, Camera, Download, Trash2, AlertCircle } from 'lucide-react';
import { inspections as inspectionsApi, properties as propertiesApi } from '../../lib/api';
import { useLanguage } from '../../lib/LanguageContext';
import { useCurrency } from '../../lib/CurrencyContext';
import PlanLock, { hasPlanAccess } from '../../components/PlanLock';
import ConfirmDialog from '../../components/ConfirmDialog';
import toast from 'react-hot-toast';

const TYPES = ['move_in', 'move_out', 'annual', 'other'];
const CONDITION_COLOR: Record<string, string> = {
  good: '#10B981', fair: '#FBC02D', poor: '#EF4444', needs_manual_review: '#64748B',
};

export default function Inspections() {
  const { t } = useLanguage();
  const { formatMoney: fmtMoney } = useCurrency();
  const [list, setList] = useState<any[]>([]);
  const [propertyList, setPropertyList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [propertyId, setPropertyId] = useState('');
  const [unitList, setUnitList] = useState<any[]>([]);
  const [unitId, setUnitId] = useState('');
  const [inspectionType, setInspectionType] = useState('move_in');
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [inspectorName, setInspectorName] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [roomArea, setRoomArea] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<any | null>(null);

  const load = () => {
    inspectionsApi.list().then(r => setList(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    propertiesApi.list().then(r => setPropertyList(r.data || [])).catch(() => {});
  }, []);

  const changeProperty = (id: string) => {
    setPropertyId(id);
    setUnitId('');
    if (id) propertiesApi.listUnits(id).then(r => setUnitList(r.data || [])).catch(() => setUnitList([]));
    else setUnitList([]);
  };

  const create = async () => {
    if (!propertyId) {
      toast.error(t('inspections.requiredFields'));
      return;
    }
    setCreating(true);
    try {
      await inspectionsApi.create({
        property_id: propertyId, unit_id: unitId || undefined,
        inspection_type: inspectionType, inspection_date: inspectionDate,
        inspector_name: inspectorName || undefined, notes: notes || undefined,
      });
      toast.success(t('inspections.created'));
      setShowModal(false);
      setPropertyId(''); setUnitId(''); setInspectorName(''); setNotes('');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('inspections.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    try {
      const res = await inspectionsApi.get(id);
      setDetail(res.data);
    } catch { toast.error(t('inspections.loadFailed')); }
  };

  const uploadPhoto = async (id: string) => {
    if (!roomArea.trim() || !photoFile) {
      toast.error(t('inspections.photoRequiredFields'));
      return;
    }
    setUploadingPhoto(true);
    try {
      const res = await inspectionsApi.uploadPhoto(id, roomArea.trim(), photoFile);
      setDetail(res.data);
      setRoomArea(''); setPhotoFile(null);
      toast.success(t('inspections.photoUploaded'));
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('inspections.photoUploadFailed'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const downloadReport = async (item: any) => {
    try {
      const res = await inspectionsApi.downloadReport(item.id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `inspection_${item.property_name}_${item.inspection_date}.pdf`.replace(/\s+/g, '_');
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch { toast.error(t('inspections.reportFailed')); }
  };

  const remove = async (item: any) => {
    setDeletingId(item.id);
    try {
      await inspectionsApi.delete(item.id);
      toast.success(t('inspections.deleted'));
      if (expandedId === item.id) { setExpandedId(null); setDetail(null); }
      load();
    } catch { toast.error(t('inspections.deleteFailed')); }
    finally { setDeletingId(null); }
  };

  if (!hasPlanAccess('professional')) {
    return <PlanLock minTier="professional" titleKey="inspections.title" />;
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ color: '#64748B', fontFamily: 'IBM Plex Mono' }}>{t('nav.loading')}</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1100 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ClipboardCheck size={24} color="#FBC02D" />
            <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 26, color: 'var(--text-primary)' }}>{t('inspections.title')}</h1>
          </div>
          <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', border: 'none', borderRadius: 8, fontWeight: 700, fontFamily: 'Syne', fontSize: 14, cursor: 'pointer' }}>
            <Plus size={16} /> {t('inspections.newInspection')}
          </button>
        </div>
        <p style={{ color: '#64748B', fontSize: 14, marginBottom: 20 }}>{t('inspections.subtitle')}</p>

        {list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#475569', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12 }}>
            {t('inspections.noInspections')}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {list.map((item: any) => (
              <div key={item.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden' }}>
                <div onClick={() => toggleExpand(item.id)} style={{ padding: 16, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{item.property_name}{item.unit_number ? ` · ${item.unit_number}` : ''}</span>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontFamily: 'IBM Plex Mono' }}>{t(`inspections.type.${item.inspection_type}`)}</span>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: item.status === 'completed' ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)', color: item.status === 'completed' ? '#10B981' : 'var(--text-secondary)', fontFamily: 'IBM Plex Mono' }}>{t(`inspections.status.${item.status}`)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>{item.inspection_date}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#64748B' }}>{t('inspections.issues')}: {item.total_issues}</div>
                      <div style={{ fontSize: 13, fontFamily: 'IBM Plex Mono', color: item.estimated_repair_cost > 0 ? '#F97316' : 'var(--text-secondary)' }}>{fmtMoney(item.estimated_repair_cost)}</div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); downloadReport(item); }} title={t('inspections.downloadReport')}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981', cursor: 'pointer' }}>
                      <Download size={13} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); setConfirmTarget(item); }} disabled={deletingId === item.id} title={t('compliance.delete')}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', cursor: 'pointer' }}>
                      <Trash2 size={13} />
                    </button>
                    {expandedId === item.id ? <ChevronUp size={16} color="#64748B" /> : <ChevronDown size={16} color="#64748B" />}
                  </div>
                </div>

                {expandedId === item.id && detail && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                    {detail.inspector_name && (
                      <div style={{ fontSize: 12, color: '#64748B', margin: '12px 0' }}>{t('inspections.inspector')}: {detail.inspector_name}</div>
                    )}
                    {detail.photos.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#475569', marginBottom: 12 }}>{t('inspections.noPhotos')}</div>
                    ) : (
                      <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
                        {detail.photos.map((photo: any) => (
                          <div key={photo.id} style={{ background: 'var(--bg-app)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{photo.room_area}</span>
                              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: `${CONDITION_COLOR[photo.overall_condition] || '#64748B'}20`, color: CONDITION_COLOR[photo.overall_condition] || '#64748B', fontFamily: 'IBM Plex Mono' }}>
                                {t(`inspections.condition.${photo.overall_condition}`)}
                              </span>
                            </div>
                            {!photo.analyzed && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748B', marginBottom: 6 }}>
                                <AlertCircle size={12} /> {t('inspections.manualReviewNote')}
                              </div>
                            )}
                            {photo.issues.map((issue: any, i: number) => (
                              <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                                <span style={{ color: '#F97316', fontWeight: 600 }}>{t(`inspections.issueType.${issue.type}`)}</span> ({issue.severity}) — {issue.description} <span style={{ color: '#64748B' }}>({fmtMoney(issue.estimated_cost)})</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input value={roomArea} onChange={e => setRoomArea(e.target.value)} placeholder={t('inspections.roomAreaPlaceholder')}
                        spellCheck autoCorrect="on" autoCapitalize="words"
                        style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12, outline: 'none' }} />
                      <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] || null)}
                        style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 160 }} />
                      <button onClick={() => uploadPhoto(item.id)} disabled={uploadingPhoto}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(var(--accent-rgb),0.1)', border: '1px solid rgba(var(--accent-rgb),0.3)', borderRadius: 8, color: '#FBC02D', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <Camera size={13} /> {uploadingPhoto ? t('inspections.analyzing') : t('inspections.addPhoto')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <p style={{ marginTop: 20, fontSize: 11, color: '#475569' }}>{t('inspections.note')}</p>

        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28, width: 440 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>{t('inspections.newInspection')}</h2>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>{t('portfolio.property')}</label>
                  <select value={propertyId} onChange={e => changeProperty(e.target.value)} style={{ ...inp } as any}>
                    <option value="">{t('inspections.selectProperty')}</option>
                    {propertyList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>{t('inspections.unit')}</label>
                  <select value={unitId} onChange={e => setUnitId(e.target.value)} disabled={!propertyId} style={{ ...inp } as any}>
                    <option value="">{t('inspections.entireProperty')}</option>
                    {unitList.map(u => <option key={u.id} value={u.id}>{u.unit_number}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>{t('inspections.inspectionType')}</label>
                  <select value={inspectionType} onChange={e => setInspectionType(e.target.value)} style={{ ...inp } as any}>
                    {TYPES.map(ty => <option key={ty} value={ty}>{t(`inspections.type.${ty}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>{t('inspections.date')}</label>
                  <input type="date" value={inspectionDate} onChange={e => setInspectionDate(e.target.value)} style={inp} />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>{t('inspections.inspector')}</label>
                <input value={inspectorName} onChange={e => setInspectorName(e.target.value)}
                  spellCheck autoCorrect="on" autoCapitalize="words" style={inp} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>{t('compliance.notes')}</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  spellCheck autoCorrect="on" autoCapitalize="sentences"
                  style={{ ...inp, height: 60, resize: 'none' } as any} />
              </div>
              <button onClick={create} disabled={creating} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                {creating ? t('compliance.saving') : t('inspections.newInspection')}
              </button>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={!!confirmTarget}
          message={t('inspections.confirmDelete')}
          confirmLabel={t('compliance.delete')}
          cancelLabel={t('common.cancel')}
          onCancel={() => setConfirmTarget(null)}
          onConfirm={() => { const item = confirmTarget; setConfirmTarget(null); remove(item); }}
        />
      </div>
    </DashboardLayout>
  );
}

const lbl: React.CSSProperties = { display: 'block', marginBottom: 5, fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' };
const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none', boxSizing: 'border-box' };
