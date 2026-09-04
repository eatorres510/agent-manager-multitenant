import React, { useState, useEffect } from 'react';

interface MetaAdsAttributionTabProps {
  tenantId: string;
  token: string | null;
  role: string | null;
  onOpenChat?: (convId: number | string) => void;
}

interface MetaSummary {
  total_leads: number;
  total_sales: number;
  total_invoiced: number;
  total_spend: number;
  roas: number;
  cpa: number;
  conversion_rate: number;
}

interface MetaAdRow {
  meta_ad_id: string;
  meta_ad_headline?: string;
  meta_campaign_name?: string;
  meta_ad_image_url?: string;
  leads_count: number;
  sales_count: number;
  invoiced_amount: number;
  spend: number;
  impressions?: number;
  clicks?: number;
  roas: number;
  cpa: number;
  conversion_rate: number;
}

interface ConfirmedSale {
  id: number;
  title: string;
  contact_name: string;
  contact_phone: string;
  invoiced_amount: number;
  invoice_number?: string;
  sale_confirmed_at?: string;
  sale_items_summary?: string;
  meta_ad_id?: string;
  meta_ad_headline?: string;
  conversation_id?: string;
}

interface IncomingReferral {
  id: number;
  source_id: string;
  headline?: string;
  body?: string;
  image_url?: string;
  sender_phone?: string;
  conversation_id?: string;
  created_at: string;
}

export const MetaAdsAttributionTab: React.FC<MetaAdsAttributionTabProps> = ({
  tenantId,
  token,
  role: _role,
  onOpenChat
}) => {
  const [loading, setLoading] = useState(false);
  const [subTab, setSubTab] = useState<'ads' | 'sales' | 'leads' | 'config'>('ads');
  const [summary, setSummary] = useState<MetaSummary>({
    total_leads: 0,
    total_sales: 0,
    total_invoiced: 0,
    total_spend: 0,
    roas: 0,
    cpa: 0,
    conversion_rate: 0
  });
  const [adsList, setAdsList] = useState<MetaAdRow[]>([]);
  const [salesList, setSalesList] = useState<ConfirmedSale[]>([]);
  const [referralsList, setReferralsList] = useState<IncomingReferral[]>([]);
  const [config, setConfig] = useState<{ meta_ad_account_id?: string; has_marketing_token?: boolean }>({});
  
  // Spend Editing Modal / State
  const [editingSpendAd, setEditingSpendAd] = useState<MetaAdRow | null>(null);
  const [spendInput, setSpendInput] = useState<string>('');
  const [impressionsInput, setImpressionsInput] = useState<string>('');
  const [clicksInput, setClicksInput] = useState<string>('');
  const [savingSpend, setSavingSpend] = useState(false);

  // Meta API Config State
  const [adAccountIdInput, setAdAccountIdInput] = useState('');
  const [marketingTokenInput, setMarketingTokenInput] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/control/${tenantId}/meta-attribution`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al cargar datos de atribución Meta');
      const data = await res.json();
      setSummary(data.summary || {
        total_leads: 0,
        total_sales: 0,
        total_invoiced: 0,
        total_spend: 0,
        roas: 0,
        cpa: 0,
        conversion_rate: 0
      });
      setAdsList(Array.isArray(data.ads) ? data.ads : []);
      setSalesList(Array.isArray(data.sales) ? data.sales : []);
      setReferralsList(Array.isArray(data.referrals) ? data.referrals : []);
      setConfig(data.config || {});
      if (data.config?.meta_ad_account_id) {
        setAdAccountIdInput(data.config.meta_ad_account_id);
      }
    } catch (err: any) {
      console.error('Error fetching Meta attribution:', err);
      showToast(err.message || 'Error al cargar métricas de Meta', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenantId]);

  const handleSaveSpend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSpendAd) return;
    setSavingSpend(true);
    try {
      const res = await fetch(`/api/control/${tenantId}/meta-attribution/save-spend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ad_id: editingSpendAd.meta_ad_id,
          ad_name: editingSpendAd.meta_ad_headline || editingSpendAd.meta_ad_id,
          campaign_name: editingSpendAd.meta_campaign_name || 'Campaña WhatsApp',
          spend: parseFloat(spendInput) || 0,
          impressions: parseInt(impressionsInput) || 0,
          clicks: parseInt(clicksInput) || 0
        })
      });

      if (!res.ok) throw new Error('Error al registrar gasto');
      showToast('¡Gasto del anuncio actualizado correctamente!');
      setEditingSpendAd(null);
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingSpend(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await fetch(`/api/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          meta_ad_account_id: adAccountIdInput.trim(),
          meta_marketing_token: marketingTokenInput.trim() || undefined
        })
      });

      if (!res.ok) throw new Error('Error al guardar credenciales de Meta');
      showToast('¡Configuración de Meta Ads guardada!');
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div style={{
      animation: 'fadeIn 0.25s ease-out',
      minHeight: 'calc(100vh - 90px)',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      color: 'var(--text-primary)',
      fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif'
    }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '0.75rem 1.25rem',
          borderRadius: '8px',
          backgroundColor: toast.type === 'error' ? 'var(--status-danger-solid)' : '#059669',
          color: '#fff',
          fontWeight: 700,
          fontSize: '0.85rem',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>
            {toast.type === 'error' ? 'error' : 'check_circle'}
          </span>
          <span>{toast.text}</span>
        </div>
      )}

      {/* HEADER BAR */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'var(--surface-card)',
        padding: '1rem 1.25rem',
        borderRadius: '12px',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            backgroundColor: 'rgba(0, 206, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(0, 206, 255, 0.3)'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.5rem', color: '#00CEFF' }}>
              ads_click
            </span>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>Meta Ads vs Facturado Real</span>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 800,
                color: '#059669',
                backgroundColor: 'rgba(5, 150, 105, 0.12)',
                padding: '0.15rem 0.45rem',
                borderRadius: '6px',
                border: '1px solid rgba(5, 150, 105, 0.3)'
              }}>
                Atribución CTWA & CRM
              </span>
            </h2>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
              Evaluación de campañas Click-to-WhatsApp: anuncios, interacciones y leads vs. facturación real cerrada en CRM.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              padding: '0.55rem 0.95rem',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--surface-subtle)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', animation: loading ? 'spin 1s linear infinite' : 'none' }}>
              refresh
            </span>
            <span>{loading ? 'Actualizando...' : 'Actualizar'}</span>
          </button>
        </div>
      </div>

      {/* TOP KPI CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '0.75rem'
      }}>
        {/* Real Invoiced */}
        <div style={{
          backgroundColor: 'var(--surface-card)',
          padding: '1rem',
          borderRadius: '12px',
          border: '1px solid rgba(5, 150, 105, 0.35)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#059669', fontSize: '0.75rem', fontWeight: 800 }}>
            <span>REAL FACTURADO</span>
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>payments</span>
          </div>
          <div className="tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#059669' }}>
            ${summary.total_invoiced.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Total cerrado con factura en CRM
          </div>
        </div>

        {/* Ad Spend */}
        <div style={{
          backgroundColor: 'var(--surface-card)',
          padding: '1rem',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 800 }}>
            <span>GASTO META ADS</span>
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#38bdf8' }}>receipt</span>
          </div>
          <div className="tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            ${summary.total_spend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Inversión total en publicidad
          </div>
        </div>

        {/* ROAS */}
        <div style={{
          backgroundColor: 'var(--surface-card)',
          padding: '1rem',
          borderRadius: '12px',
          border: summary.roas >= 3 ? '1px solid rgba(16, 185, 129, 0.4)' : summary.roas >= 1 ? '1px solid rgba(0, 206, 255, 0.4)' : '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: summary.roas >= 1 ? '#00CEFF' : 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 800 }}>
            <span>ROAS REAL (RETORNO)</span>
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>trending_up</span>
          </div>
          <div className="tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 900, color: summary.roas >= 2 ? '#10B981' : summary.roas >= 1 ? '#00CEFF' : '#E2E8F0' }}>
            {summary.roas > 0 ? `${summary.roas.toFixed(2)}x` : '0.00x'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            ${summary.roas.toFixed(2)} facturados por cada $1 gastado
          </div>
        </div>

        {/* Closed Sales Count */}
        <div style={{
          backgroundColor: 'var(--surface-card)',
          padding: '1rem',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 800 }}>
            <span>VENTAS CONCRETADAS</span>
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#10B981' }}>verified</span>
          </div>
          <div className="tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {summary.total_sales}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {summary.conversion_rate.toFixed(1)}% tasa de cierre de leads
          </div>
        </div>

        {/* WhatsApp Leads */}
        <div style={{
          backgroundColor: 'var(--surface-card)',
          padding: '1rem',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 800 }}>
            <span>LEADS DE ANUNCIOS</span>
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#2563eb' }}>chat</span>
          </div>
          <div className="tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {summary.total_leads}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Conversaciones iniciadas desde CTWA
          </div>
        </div>

        {/* Real CPA */}
        <div style={{
          backgroundColor: 'var(--surface-card)',
          padding: '1rem',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 800 }}>
            <span>CPA REAL (COSTO/VENTA)</span>
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#f59e0b' }}>price_change</span>
          </div>
          <div className="tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            ${summary.cpa.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Inversión por cada venta cerrada
          </div>
        </div>
      </div>

      {/* SUBTABS NAVIGATION */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '0.4rem',
        marginTop: '0.5rem'
      }}>
        <button
          onClick={() => setSubTab('ads')}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: subTab === 'ads' ? 'var(--gradient-primary)' : 'var(--surface-subtle)',
            color: subTab === 'ads' ? '#ffffff' : 'var(--text-secondary)',
            fontWeight: 800,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>view_list</span>
          <span>Desglose por Anuncio & Campaña ({adsList.length})</span>
        </button>

        <button
          onClick={() => setSubTab('sales')}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: subTab === 'sales' ? 'var(--gradient-primary)' : 'var(--surface-subtle)',
            color: subTab === 'sales' ? '#ffffff' : 'var(--text-secondary)',
            fontWeight: 800,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>verified</span>
          <span>Ventas Facturadas Confirmadas ({salesList.length})</span>
        </button>

        <button
          onClick={() => setSubTab('leads')}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: subTab === 'leads' ? 'var(--gradient-primary)' : 'var(--surface-subtle)',
            color: subTab === 'leads' ? '#ffffff' : 'var(--text-secondary)',
            fontWeight: 800,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>forum</span>
          <span>Historial de Leads CTWA ({referralsList.length})</span>
        </button>

        <button
          onClick={() => setSubTab('config')}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: subTab === 'config' ? 'var(--gradient-primary)' : 'var(--surface-subtle)',
            color: subTab === 'config' ? '#ffffff' : 'var(--text-secondary)',
            fontWeight: 800,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>settings_suggest</span>
          <span>Configuración de Cuenta Meta</span>
        </button>
      </div>

      {/* SUBTAB CONTENT */}

      {/* 1. ADS BREAKDOWN TABLE */}
      {subTab === 'ads' && (
        <div style={{
          backgroundColor: 'var(--surface-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800 }}>
              📊 Comparativa de Anuncios: Inversión vs. Facturación Real en CRM
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Muestra los anuncios detectados automáticamente por el webhook Click-to-WhatsApp
            </span>
          </div>

          {adsList.length === 0 ? (
            <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', opacity: 0.5, marginBottom: '0.5rem' }}>
                ads_click
              </span>
              <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700 }}>Aún no se registran mensajes de anuncios de Meta</p>
              <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.78rem' }}>
                Cuando un usuario haga clic en un anuncio de WhatsApp y envíe el primer mensaje, aparecerá aquí con su Titular, Imagen y Ad ID.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-subtle)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>ANUNCIO / CAMPAÑA</th>
                    <th style={{ padding: '0.75rem 0.75rem', fontWeight: 800 }}>ID META</th>
                    <th style={{ padding: '0.75rem 0.75rem', fontWeight: 800, textAlign: 'center' }}>LEADS</th>
                    <th style={{ padding: '0.75rem 0.75rem', fontWeight: 800, textAlign: 'center' }}>VENTAS</th>
                    <th style={{ padding: '0.75rem 0.75rem', fontWeight: 800, textAlign: 'center' }}>% CIERRE</th>
                    <th style={{ padding: '0.75rem 0.75rem', fontWeight: 800, textAlign: 'right' }}>GASTO META</th>
                    <th style={{ padding: '0.75rem 0.75rem', fontWeight: 800, textAlign: 'right' }}>FACTURADO REAL</th>
                    <th style={{ padding: '0.75rem 0.75rem', fontWeight: 800, textAlign: 'center' }}>ROAS</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 800, textAlign: 'center' }}>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {adsList.map(ad => (
                    <tr key={ad.meta_ad_id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}>
                      {/* Ad Title & Image */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          {ad.meta_ad_image_url ? (
                            <img
                              src={ad.meta_ad_image_url}
                              alt={ad.meta_ad_headline || 'Ad'}
                              style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--border-subtle)' }}
                              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div style={{ width: '36px', height: '36px', borderRadius: '6px', backgroundColor: 'rgba(0, 206, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00CEFF' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>ads_click</span>
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 800, color: 'var(--text-primary)', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ad.meta_ad_headline || 'Anuncio sin titular'}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {ad.meta_campaign_name || 'Campaña WhatsApp'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Ad ID */}
                      <td style={{ padding: '0.75rem 0.75rem' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', backgroundColor: 'var(--surface-subtle)', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                          {ad.meta_ad_id}
                        </span>
                      </td>

                      {/* Leads Count */}
                      <td style={{ padding: '0.75rem 0.75rem', textAlign: 'center', fontWeight: 800 }}>
                        <span style={{ padding: '0.15rem 0.5rem', borderRadius: '12px', backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
                          {ad.leads_count}
                        </span>
                      </td>

                      {/* Sales Count */}
                      <td style={{ padding: '0.75rem 0.75rem', textAlign: 'center', fontWeight: 800 }}>
                        <span style={{ padding: '0.15rem 0.5rem', borderRadius: '12px', backgroundColor: ad.sales_count > 0 ? 'rgba(5, 150, 105, 0.12)' : 'var(--surface-subtle)', color: ad.sales_count > 0 ? '#059669' : 'var(--text-muted)' }}>
                          {ad.sales_count}
                        </span>
                      </td>

                      {/* Conversion Rate */}
                      <td style={{ padding: '0.75rem 0.75rem', textAlign: 'center', fontWeight: 700 }}>
                        {ad.conversion_rate.toFixed(1)}%
                      </td>

                      {/* Ad Spend */}
                      <td style={{ padding: '0.75rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>
                        ${ad.spend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Invoiced Amount */}
                      <td style={{ padding: '0.75rem 0.75rem', textAlign: 'right', fontWeight: 900, color: ad.invoiced_amount > 0 ? '#059669' : 'var(--text-primary)' }}>
                        ${ad.invoiced_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* ROAS Badge */}
                      <td style={{ padding: '0.75rem 0.75rem', textAlign: 'center' }}>
                        <span style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          fontWeight: 800,
                          fontSize: '0.76rem',
                          backgroundColor: ad.roas >= 3 ? 'rgba(5, 150, 105, 0.15)' : ad.roas >= 1 ? 'rgba(0, 206, 255, 0.15)' : 'var(--surface-subtle)',
                          color: ad.roas >= 3 ? '#059669' : ad.roas >= 1 ? '#00CEFF' : 'var(--text-muted)',
                          border: ad.roas >= 1 ? '1px solid currentColor' : '1px solid var(--border-subtle)'
                        }}>
                          {ad.roas > 0 ? `${ad.roas.toFixed(2)}x` : '0.00x'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <button
                          onClick={() => {
                            setEditingSpendAd(ad);
                            setSpendInput(String(ad.spend || 0));
                            setImpressionsInput(String(ad.impressions || 0));
                            setClicksInput(String(ad.clicks || 0));
                          }}
                          style={{
                            padding: '0.35rem 0.65rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border-subtle)',
                            backgroundColor: 'var(--surface-subtle)',
                            color: 'var(--text-primary)',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                          title="Actualizar gasto publicitario registrado"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>edit</span>
                          <span>Editar Gasto</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 2. CONFIRMED SALES TABLE */}
      {subTab === 'sales' && (
        <div style={{
          backgroundColor: 'var(--surface-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#059669', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>receipt_long</span>
              Ventas Confirmadas con Factura en CRM
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Solo las oportunidades en etapa 'Cierre Ganado' con factura registrada
            </span>
          </div>

          {salesList.length === 0 ? (
            <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', opacity: 0.5, marginBottom: '0.5rem' }}>
                receipt_long
              </span>
              <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700 }}>Aún no hay ventas confirmadas con factura</p>
              <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.78rem' }}>
                En el Pipeline CRM (Kanban), mueve una oportunidad a 'Cierre Ganado' e ingresa el número de factura y monto real facturado.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-subtle)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>FACTURA #</th>
                    <th style={{ padding: '0.75rem 0.75rem', fontWeight: 800 }}>CLIENTE / TELÉFONO</th>
                    <th style={{ padding: '0.75rem 0.75rem', fontWeight: 800 }}>TITULO OPORTUNIDAD</th>
                    <th style={{ padding: '0.75rem 0.75rem', fontWeight: 800 }}>PRODUCTOS FACTURADOS</th>
                    <th style={{ padding: '0.75rem 0.75rem', fontWeight: 800 }}>ANUNCIO ATRIBUIDO</th>
                    <th style={{ padding: '0.75rem 0.75rem', fontWeight: 800, textAlign: 'right' }}>MONTO FACTURADO</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 800, textAlign: 'center' }}>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {salesList.map(sale => (
                    <tr key={sale.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{
                          fontWeight: 800,
                          color: '#059669',
                          backgroundColor: 'rgba(5, 150, 105, 0.1)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          border: '1px solid rgba(5, 150, 105, 0.3)'
                        }}>
                          {sale.invoice_number || 'S/N'}
                        </span>
                      </td>

                      <td style={{ padding: '0.75rem 0.75rem' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                          {sale.contact_name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {sale.contact_phone || 'Sin teléfono'}
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem 0.75rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {sale.title}
                      </td>

                      <td style={{ padding: '0.75rem 0.75rem', color: 'var(--text-secondary)', fontSize: '0.74rem' }}>
                        {sale.sale_items_summary || '—'}
                      </td>

                      <td style={{ padding: '0.75rem 0.75rem' }}>
                        {sale.meta_ad_id ? (
                          <div>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              color: '#00CEFF',
                              backgroundColor: 'rgba(0, 206, 255, 0.1)',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              border: '1px solid rgba(0, 206, 255, 0.3)'
                            }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '0.8rem' }}>ads_click</span>
                              <span>#{sale.meta_ad_id}</span>
                            </span>
                            {sale.meta_ad_headline && (
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {sale.meta_ad_headline}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Orgánico / Directo</span>
                        )}
                      </td>

                      <td style={{ padding: '0.75rem 0.75rem', textAlign: 'right', fontWeight: 900, color: '#059669', fontSize: '0.9rem' }}>
                        ${Number(sale.invoiced_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        {sale.conversation_id && onOpenChat ? (
                          <button
                            onClick={() => onOpenChat(sale.conversation_id!)}
                            style={{
                              padding: '0.35rem 0.65rem',
                              borderRadius: '6px',
                              border: '1px solid var(--border-subtle)',
                              backgroundColor: 'var(--surface-subtle)',
                              color: '#2563eb',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>forum</span>
                            <span>Ver Chat</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. INCOMING LEADS HISTORIAL */}
      {subTab === 'leads' && (
        <div style={{
          backgroundColor: 'var(--surface-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#2563eb', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>forum</span>
              Leads Entrantes desde Anuncios de Meta (Click-to-WhatsApp)
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Total detectados: {referralsList.length}
            </span>
          </div>

          {referralsList.length === 0 ? (
            <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', opacity: 0.5, marginBottom: '0.5rem' }}>
                contact_support
              </span>
              <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700 }}>Aún no se reciben leads desde Meta Ads</p>
              <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.78rem' }}>
                Asegúrate de que tus anuncios en Meta tengan activo el destino 'Enviar mensaje a WhatsApp'.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-subtle)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>FECHA</th>
                    <th style={{ padding: '0.75rem 0.75rem', fontWeight: 800 }}>TELÉFONO</th>
                    <th style={{ padding: '0.75rem 0.75rem', fontWeight: 800 }}>ANUNCIO DE ORIGEN</th>
                    <th style={{ padding: '0.75rem 0.75rem', fontWeight: 800 }}>AD ID</th>
                    <th style={{ padding: '0.75rem 0.75rem', fontWeight: 800 }}>MENSAJE O DESCRIPCIÓN</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 800, textAlign: 'center' }}>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {referralsList.map(ref => (
                    <tr key={ref.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.74rem' }}>
                        {ref.created_at ? new Date(ref.created_at).toLocaleString() : '—'}
                      </td>

                      <td style={{ padding: '0.75rem 0.75rem', fontWeight: 700 }}>
                        {ref.sender_phone || 'Desconocido'}
                      </td>

                      <td style={{ padding: '0.75rem 0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {ref.image_url && (
                            <img
                              src={ref.image_url}
                              alt={ref.headline || 'Ad'}
                              style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }}
                              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                            />
                          )}
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {ref.headline || 'Anuncio sin titular'}
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem 0.75rem' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', backgroundColor: 'var(--surface-subtle)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                          {ref.source_id}
                        </span>
                      </td>

                      <td style={{ padding: '0.75rem 0.75rem', color: 'var(--text-secondary)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ref.body || '—'}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        {ref.conversation_id && onOpenChat ? (
                          <button
                            onClick={() => onOpenChat(ref.conversation_id!)}
                            style={{
                              padding: '0.35rem 0.65rem',
                              borderRadius: '6px',
                              border: '1px solid var(--border-subtle)',
                              backgroundColor: 'var(--surface-subtle)',
                              color: '#2563eb',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>forum</span>
                            <span>Abrir Chat</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. META CONFIGURATION TAB */}
      {subTab === 'config' && (
        <div style={{
          backgroundColor: 'var(--surface-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-card)',
          maxWidth: '750px'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.3rem', color: '#00CEFF' }}>settings_suggest</span>
            Configuración de Meta Graph API & Cuenta Publicitaria
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem', lineHeight: 1.5 }}>
            Configura el ID de tu Cuenta de Anuncios de Meta y el Token de Marketing para sincronizar automáticamente el gasto, impresiones y clics directamente desde los servidores de Meta.
          </p>

          <form onSubmit={handleSaveConfig} style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 800 }}>ID de Cuenta Publicitaria de Meta (Ad Account ID)</label>
              <input
                type="text"
                value={adAccountIdInput}
                onChange={(e) => setAdAccountIdInput(e.target.value)}
                placeholder="ej: act_123456789012345"
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--surface-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Lo encuentras en la barra superior o en la URL del Administrador de Anuncios de Meta.
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 800 }}>Token de Sistema de Meta (Marketing API Access Token)</label>
              <input
                type="password"
                value={marketingTokenInput}
                onChange={(e) => setMarketingTokenInput(e.target.value)}
                placeholder={config.has_marketing_token ? '••••••••••••••••••••••••••••• (Configurado)' : 'Pega el token de usuario de sistema de Meta aquí...'}
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--surface-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem'
                }}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {config.has_marketing_token
                  ? '✅ Ya tienes un token activo configurado. Solo ingresa uno nuevo si deseas cambiarlo.'
                  : 'Token generado en Meta Business Suite -> Usuarios del sistema con permisos ads_read y ads_management.'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '0.5rem' }}>
              <button
                type="submit"
                disabled={savingConfig}
                style={{
                  padding: '0.65rem 1.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--gradient-primary)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                {savingConfig ? 'Guardando...' : 'Guardar Configuración de Meta'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT SPEND MODAL */}
      {editingSpendAd && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'var(--surface-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '450px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900 }}>
                Actualizar Gasto del Anuncio #{editingSpendAd.meta_ad_id}
              </h3>
              <button
                onClick={() => setEditingSpendAd(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Anuncio: <strong>{editingSpendAd.meta_ad_headline || editingSpendAd.meta_ad_id}</strong>
            </div>

            <form onSubmit={handleSaveSpend} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 800 }}>Gasto Publicitario ($ USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={spendInput}
                  onChange={(e) => setSpendInput(e.target.value)}
                  placeholder="0.00"
                  style={{
                    padding: '0.6rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--surface-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    fontWeight: 700
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Impresiones (opcional)</label>
                  <input
                    type="number"
                    value={impressionsInput}
                    onChange={(e) => setImpressionsInput(e.target.value)}
                    placeholder="0"
                    style={{
                      padding: '0.55rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--surface-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Clics (opcional)</label>
                  <input
                    type="number"
                    value={clicksInput}
                    onChange={(e) => setClicksInput(e.target.value)}
                    placeholder="0"
                    style={{
                      padding: '0.55rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--surface-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setEditingSpendAd(null)}
                  style={{
                    padding: '0.6rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--surface-subtle)',
                    color: 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingSpend}
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--gradient-primary)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  {savingSpend ? 'Guardando...' : 'Guardar Gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
