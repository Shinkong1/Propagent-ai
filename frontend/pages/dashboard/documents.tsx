import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { FileText, Upload, X, Search, Download, Trash2, AlertCircle, Sparkles, Lock } from 'lucide-react';
import { documents as documentsApi, properties as propertiesApi, tenants as tenantsApi } from '../../lib/api';
import { useLanguage } from '../../lib/LanguageContext';
import { hasPlanAccess } from '../../components/PlanLock';
import ConfirmDialog from '../../components/ConfirmDialog';
import Link from 'next/link';
import toast from 'react-hot-toast';

const CATEGORIES = ['lease', 'insurance', 'vendor_contract', 'hoa_document', 'utility_bill', 'mortgage_document', 'inspection_report', 'other'];
const GENERATE_TYPES = ['lease_agreement', 'lease_renewal_notice', 'rent_increase_notice', 'move_out_notice'];

const FIELD_LABELS: Record<string, string> = {
  rent: 'rent', deposit: 'deposit', late_fee: 'lateFee',
  renewal_date: 'renewalDate', expiration_date: 'expirationDate', pet_policy: 'petPolicy',
};

export default function Documents() {
  const { t } = useLanguage();
  const [docs, setDocs] = useState<any[]>([]);
  const [propertyList, setPropertyList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('lease');
  const [propertyId, setPropertyId] = useState('');
  const [uploading, setUploading] = useState(false);

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [tenantList, setTenantList] = useState<any[]>([]);
  const [genType, setGenType] = useState('lease_agreement');
  const [genTenantId, setGenTenantId] = useState('');
  const [genNewEndDate, setGenNewEndDate] = useState('');
  const [genNewRent, setGenNewRent] = useState('');
  const [genEffectiveDate, setGenEffectiveDate] = useState('');
  const [genMoveOutDate, setGenMoveOutDate] = useState('');
  const [genErrors, setGenErrors] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const canGenerate = hasPlanAccess('professional');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<any | null>(null);

  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [savingTemplates, setSavingTemplates] = useState(false);

  const openTemplatesModal = () => {
    documentsApi.getTemplates().then(r => setTemplates(r.data || {})).catch(() => setTemplates({}));
    setShowTemplatesModal(true);
  };

  const saveTemplates = async () => {
    setSavingTemplates(true);
    try {
      await documentsApi.updateTemplates(templates);
      toast.success(t('documents.templatesSaved'));
      setShowTemplatesModal(false);
    } catch { toast.error(t('documents.templatesSaveFailed')); }
    finally { setSavingTemplates(false); }
  };

  const load = () => {
    documentsApi.list().then(r => setDocs(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    propertiesApi.list().then(r => setPropertyList(r.data || [])).catch(() => {});
    tenantsApi.list().then(r => setTenantList(r.data || [])).catch(() => {});
  }, []);

  const runSearch = async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const res = await documentsApi.search(searchQuery.trim());
      setSearchResults(res.data);
    } catch { toast.error(t('documents.searchFailed')); }
    finally { setSearching(false); }
  };

  const upload = async () => {
    if (!file || !title.trim()) {
      toast.error(t('documents.requiredFields'));
      return;
    }
    setUploading(true);
    try {
      await documentsApi.upload(file, title.trim(), category, propertyId || undefined);
      toast.success(t('documents.uploaded'));
      setShowModal(false);
      setFile(null); setTitle(''); setCategory('lease'); setPropertyId('');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('documents.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const generateDocument = async () => {
    const errors = new Set<string>();
    if (!genTenantId) errors.add('tenant');
    if (genType === 'lease_renewal_notice' && !genNewEndDate.trim()) errors.add('newEndDate');
    if (genType === 'rent_increase_notice') {
      if (!genNewRent.toString().trim()) errors.add('newRent');
      if (!genEffectiveDate.trim()) errors.add('effectiveDate');
    }
    if (genType === 'move_out_notice' && !genMoveOutDate.trim()) errors.add('moveOutDate');

    setGenErrors(errors);
    if (errors.size > 0) {
      toast.error(errors.has('tenant') && errors.size === 1 ? t('documents.generateSelectTenantError') : t('documents.generateFieldsRequiredError'));
      return;
    }
    setGenerating(true);
    try {
      const payload: any = { document_type: genType, tenant_id: genTenantId };
      if (genType === 'lease_renewal_notice') payload.new_end_date = genNewEndDate;
      if (genType === 'rent_increase_notice') { payload.new_rent = parseFloat(genNewRent); payload.effective_date = genEffectiveDate; }
      if (genType === 'move_out_notice') payload.move_out_date = genMoveOutDate;

      await documentsApi.generate(payload);
      toast.success(t('documents.generated'));
      setShowGenerateModal(false);
      setGenType('lease_agreement');
      setGenTenantId(''); setGenNewEndDate(''); setGenNewRent(''); setGenEffectiveDate(''); setGenMoveOutDate(''); setGenErrors(new Set());
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('documents.generateFailed'));
    } finally {
      setGenerating(false);
    }
  };

  const download = async (doc: any) => {
    try {
      const res = await documentsApi.download(doc.id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch { toast.error(t('documents.downloadFailed')); }
  };

  const remove = async (doc: any) => {
    setDeletingId(doc.id);
    try {
      await documentsApi.delete(doc.id);
      toast.success(t('documents.deleted'));
      load();
    } catch { toast.error(t('documents.deleteFailed')); }
    finally { setDeletingId(null); }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ color: '#64748B', fontFamily: 'IBM Plex Mono' }}>{t('nav.loading')}</div>
      </DashboardLayout>
    );
  }

  const displayed = searchResults !== null ? searchResults : docs;

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1100 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <FileText size={24} color="#FBC02D" />
            <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 26, color: 'var(--text-primary)' }}>{t('documents.title')}</h1>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {canGenerate && (
              <button onClick={openTemplatesModal} title={t('documents.templatesEdit')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', borderRadius: 8, fontWeight: 700, fontFamily: 'Syne', fontSize: 14, cursor: 'pointer' }}>
                <FileText size={16} /> {t('documents.templates')}
              </button>
            )}
            {canGenerate ? (
              <button onClick={() => { setGenType('lease_agreement'); setGenTenantId(''); setGenNewEndDate(''); setGenNewRent(''); setGenEffectiveDate(''); setGenMoveOutDate(''); setShowGenerateModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)', borderRadius: 8, fontWeight: 700, fontFamily: 'Syne', fontSize: 14, cursor: 'pointer' }}>
                <Sparkles size={16} color="#FBC02D" /> {t('documents.generateDocument')}
              </button>
            ) : (
              <Link href="/pricing" style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', color: '#64748B', borderRadius: 8, fontWeight: 700, fontFamily: 'Syne', fontSize: 14, cursor: 'pointer' }}>
                  <Lock size={13} /> {t('documents.generateDocument')}
                </div>
              </Link>
            )}
            <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', border: 'none', borderRadius: 8, fontWeight: 700, fontFamily: 'Syne', fontSize: 14, cursor: 'pointer' }}>
              <Upload size={16} /> {t('documents.upload')}
            </button>
          </div>
        </div>
        <p style={{ color: '#64748B', fontSize: 14, marginBottom: 20 }}>{t('documents.subtitle')}</p>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runSearch()}
              placeholder={t('documents.searchPlaceholder')}
              spellCheck autoCorrect="on"
              style={{ width: '100%', padding: '9px 12px 9px 34px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <button onClick={runSearch} disabled={searching} style={{ padding: '9px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
            {searching ? '...' : t('documents.search')}
          </button>
          {searchResults !== null && (
            <button onClick={() => { setSearchResults(null); setSearchQuery(''); }} style={{ padding: '9px 16px', background: 'transparent', border: 'none', color: '#64748B', fontSize: 13, cursor: 'pointer' }}>
              {t('documents.clearSearch')}
            </button>
          )}
        </div>

        {displayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#475569', fontFamily: 'IBM Plex Sans', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12 }}>
            {searchResults !== null ? t('documents.noResults') : t('documents.noDocuments')}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {displayed.map((doc: any) => (
              <div key={doc.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <h3 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{doc.title}</h3>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontFamily: 'IBM Plex Mono' }}>
                        {t(`documents.category.${doc.category}`)}
                      </span>
                    </div>
                    {doc.property_name && (
                      <div style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>{doc.property_name}</div>
                    )}
                    {searchResults !== null ? (
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, fontFamily: 'IBM Plex Mono' }}>{doc.snippet}</p>
                    ) : (
                      <>
                        {doc.extraction_status === 'unsupported' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#F97316', marginBottom: 8 }}>
                            <AlertCircle size={12} /> {t('documents.noTextExtracted')}
                          </div>
                        )}
                        {doc.extracted_fields && Object.keys(doc.extracted_fields).length > 0 && (
                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 6 }}>
                            {Object.entries(doc.extracted_fields).map(([key, value]) => (
                              <div key={key}>
                                <div style={{ fontSize: 9, color: '#64748B', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase' }}>{t(`documents.field.${FIELD_LABELS[key] || key}`)}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-hover)', fontFamily: 'IBM Plex Mono' }}>{String(value)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => download(doc)} title={t('documents.download')}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981', cursor: 'pointer' }}>
                      <Download size={13} />
                    </button>
                    <button onClick={() => setConfirmTarget(doc)} disabled={deletingId === doc.id} title={t('documents.delete')}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', cursor: 'pointer' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <p style={{ marginTop: 20, fontSize: 11, color: '#475569' }}>{t('documents.note')}</p>

        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28, width: 440 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>{t('documents.upload')}</h2>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>{t('documents.file')}</label>
                <input type="file" onChange={e => setFile(e.target.files?.[0] || null)}
                  style={{ width: '100%', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Sans' }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>{t('documents.docTitle')}</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Sunset Towers Unit 3 Lease"
                  spellCheck autoCorrect="on" autoCapitalize="sentences" style={inp} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={lbl}>{t('compliance.category')}</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inp } as any}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{t(`documents.category.${c}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>{t('portfolio.property')}</label>
                  <select value={propertyId} onChange={e => setPropertyId(e.target.value)} style={{ ...inp } as any}>
                    <option value="">{t('documents.noProperty')}</option>
                    {propertyList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={upload} disabled={uploading} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                {uploading ? t('documents.uploading') : t('documents.upload')}
              </button>
            </div>
          </div>
        )}

        {showGenerateModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28, width: 440 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>{t('documents.generateDocument')}</h2>
                <button onClick={() => { setShowGenerateModal(false); setGenErrors(new Set()); }} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={18} /></button>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>{t('documents.documentType')}</label>
                <select value={genType} onChange={e => { setGenType(e.target.value); setGenErrors(new Set()); }} style={inp as any}>
                  {GENERATE_TYPES.map(ty => <option key={ty} value={ty}>{t(`documents.generateType.${ty}`)}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>{t('documents.generateTenant')}</label>
                <select value={genTenantId} onChange={e => { setGenTenantId(e.target.value); genErrors.delete('tenant'); setGenErrors(new Set(genErrors)); }} style={genErrors.has('tenant') ? errInp : inp as any}>
                  <option value="">{t('documents.generateSelectTenant')}</option>
                  {tenantList.filter(tn => tn.active_lease_id).map(tn => (
                    <option key={tn.id} value={tn.id}>{tn.first_name} {tn.last_name}</option>
                  ))}
                </select>
                {genErrors.has('tenant') && <p style={errMsg}>{t('documents.generateSelectTenantError')}</p>}
              </div>

              {genType === 'lease_renewal_notice' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>{t('documents.newEndDate')}</label>
                  <input type="date" value={genNewEndDate} onChange={e => { setGenNewEndDate(e.target.value); genErrors.delete('newEndDate'); setGenErrors(new Set(genErrors)); }} style={genErrors.has('newEndDate') ? errInp : inp} />
                </div>
              )}

              {genType === 'rent_increase_notice' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={lbl}>{t('documents.newRent')}</label>
                    <input type="number" value={genNewRent} onChange={e => { setGenNewRent(e.target.value); genErrors.delete('newRent'); setGenErrors(new Set(genErrors)); }} style={genErrors.has('newRent') ? errInp : inp} />
                  </div>
                  <div>
                    <label style={lbl}>{t('documents.effectiveDate')}</label>
                    <input type="date" value={genEffectiveDate} onChange={e => { setGenEffectiveDate(e.target.value); genErrors.delete('effectiveDate'); setGenErrors(new Set(genErrors)); }} style={genErrors.has('effectiveDate') ? errInp : inp} />
                  </div>
                </div>
              )}

              {genType === 'move_out_notice' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>{t('documents.moveOutDate')}</label>
                  <input type="date" value={genMoveOutDate} onChange={e => { setGenMoveOutDate(e.target.value); genErrors.delete('moveOutDate'); setGenErrors(new Set(genErrors)); }} style={genErrors.has('moveOutDate') ? errInp : inp} />
                </div>
              )}

              <button onClick={generateDocument} disabled={generating} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                {generating ? t('documents.generating') : t('documents.generateDocument')}
              </button>
              <p style={{ fontSize: 11, color: '#475569', marginTop: 12 }}>{t('documents.generateNote')}</p>
            </div>
          </div>
        )}

        {showTemplatesModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 28, width: 520, maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h2 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>{t('documents.templates')}</h2>
                <button onClick={() => setShowTemplatesModal(false)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <p style={{ fontSize: 12, color: '#64748B', marginBottom: 18, lineHeight: 1.5 }}>{t('documents.templatesSubtitle')}</p>
              {GENERATE_TYPES.map(ty => (
                <div key={ty} style={{ marginBottom: 16 }}>
                  <label style={lbl}>{t(`documents.generateType.${ty}`)}</label>
                  <textarea
                    value={templates[ty] || ''}
                    onChange={e => setTemplates(p => ({ ...p, [ty]: e.target.value }))}
                    placeholder={t('documents.templatesPlaceholder')}
                    spellCheck autoCorrect="on" autoCapitalize="sentences"
                    style={{ ...inp, height: 70, resize: 'vertical' } as any}
                  />
                </div>
              ))}
              <button onClick={saveTemplates} disabled={savingTemplates} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, #FBC02D, #F57F17)', color: 'var(--bg-app)', fontWeight: 700, fontFamily: 'Syne', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                {savingTemplates ? t('compliance.saving') : t('documents.templatesSave')}
              </button>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={!!confirmTarget}
          message={t('documents.confirmDelete').replace('{title}', confirmTarget?.title || '')}
          confirmLabel={t('documents.delete')}
          cancelLabel={t('common.cancel')}
          onCancel={() => setConfirmTarget(null)}
          onConfirm={() => { const doc = confirmTarget; setConfirmTarget(null); remove(doc); }}
        />
      </div>
    </DashboardLayout>
  );
}

const lbl: React.CSSProperties = { display: 'block', marginBottom: 5, fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' };
const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg-app)', border: '1px solid var(--border-input)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'IBM Plex Sans', outline: 'none', boxSizing: 'border-box' };
const errInp: React.CSSProperties = { ...inp, border: '1px solid #EF4444' };
const errMsg: React.CSSProperties = { fontSize: 11, color: '#EF4444', marginTop: 4, fontFamily: 'IBM Plex Sans' };
