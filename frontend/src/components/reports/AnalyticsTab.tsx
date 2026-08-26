import React, { useState, useEffect } from 'react';

interface AnalyticsTabProps {
  tenantId: string;
  token: string | null;
  role: string | null;
}

type SubTab = 'executive' | 'crm-pipeline' | 'human-effort' | 'channels' | 'ai-insights' | 'quotes-audit';

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ tenantId, token }) => {
  const [subTab, setSubTab] = useState<SubTab>('executive');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'all'>('30d');
  const [quotesAuditData, setQuotesAuditData] = useState<any[]>([]);
  const [loadingQuotesAudit, setLoadingQuotesAudit] = useState(false);

  // Live Database Metrics State
  const [metrics, setMetrics] = useState({
    totalConversations: 0,
    activeConversations: 0,
    closedConversations: 0,
    aiHandledCount: 0,
    humanHandledCount: 0,
    aiAutonomyRate: 100,
    hoursSaved: 0,
    csatScore: 0.0,
    csatResponseRate: 0,
    pipeline: [
      { id: 'stage:prospecto', label: '1. Prospectos / Leads IA', count: 0, value: 0, color: '#2563eb' },
      { id: 'stage:interesado', label: '2. Interesados en Producto', count: 0, value: 0, color: '#7c3aed' },
      { id: 'stage:cotizado', label: '3. Cotización Enviada', count: 0, value: 0, color: '#d97706' },
      { id: 'stage:cita', label: '4. Cita / Demo Agendada', count: 0, value: 0, color: '#0284c7' },
      { id: 'stage:negociacion', label: '5. En Negociación', count: 0, value: 0, color: '#ea580c' },
      { id: 'stage:ganado', label: '6. Ventas Ganadas', count: 0, value: 0, color: '#059669' },
      { id: 'stage:perdido', label: '7. Ventas Perdidas', count: 0, value: 0, color: '#dc2626' }
    ],
    humanEffort: {
      avgHandleTimeMinutes: 0,
      avgPostEscalationResponseSeconds: 0,
      humanTypedMessages: 0,
      preQualifiedPercentage: 0,
      agentStats: [] as any[]
    },
    channels: [
      { name: `WhatsApp Principal (${tenantId.toUpperCase()})`, count: 0, percentage: 100 }
    ],
    aiInsights: {
      topProducts: [] as any[],
      lostSalesStock: [] as any[]
    }
  });

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`/api/control/${tenantId}/analytics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMetrics(prev => ({
          ...prev,
          ...data,
          aiInsights: {
            topProducts: data.topProducts || [],
            lostSalesStock: data.lostSalesStock || []
          }
        }));
      }
    } catch (e) {
      console.error('Error fetching real analytics:', e);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [tenantId, token]);

  useEffect(() => {
    if (subTab === 'quotes-audit' && token) {
      setLoadingQuotesAudit(true);
      fetch(`/api/control/${tenantId}/reports/quotes-audit`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setQuotesAuditData(data);
        })
        .catch(() => {})
        .finally(() => setLoadingQuotesAudit(false));
    }
  }, [subTab, tenantId, token]);

  return (
    <div className="glass-card" style={{ animation: 'fadeIn 0.2s ease-out' }}>
      {/* Header & Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 className="card-title" style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.5rem', color: 'var(--color-primary)' }}>analytics</span>
            Centro de Reportes, Informes Ejecutivos & BI ({tenantId.toUpperCase()})
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Informes de métricas omnicanal, rendimiento de la IA, auditoría de vendedores y exportación de datos.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* Export Button */}
          <button
            onClick={() => alert(`Generando e imprimiendo Informe Ejecutivo en PDF para ${tenantId.toUpperCase()} (${dateRange})...`)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--status-success-solid)',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>download</span>
            Exportar Informe (PDF/CSV)
          </button>

          {/* Date Filter */}
          <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--surface-subtle)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => setDateRange('7d')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: dateRange === '7d' ? 'var(--color-primary)' : 'transparent',
                color: dateRange === '7d' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 'bold'
              }}
            >
              7 días
            </button>
            <button
              onClick={() => setDateRange('30d')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: dateRange === '30d' ? 'var(--color-primary)' : 'transparent',
                color: dateRange === '30d' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 'bold'
              }}
            >
              30 días
            </button>
            <button
              onClick={() => setDateRange('all')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: dateRange === 'all' ? 'var(--color-primary)' : 'transparent',
                color: dateRange === 'all' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 'bold'
              }}
            >
              Histórico
            </button>
          </div>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '0.75rem',
        marginBottom: '1.5rem',
        overflowX: 'auto'
      }}>
        <button
          onClick={() => setSubTab('executive')}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: subTab === 'executive' ? 'var(--color-primary)' : 'var(--border-subtle)',
            backgroundColor: subTab === 'executive' ? 'rgba(0, 206, 255, 0.12)' : 'var(--surface-subtle)',
            color: subTab === 'executive' ? 'var(--color-accent)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>trending_up</span>
          Dashboard Ejecutivo & ROI IA
        </button>
        <button
          onClick={() => setSubTab('crm-pipeline')}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: subTab === 'crm-pipeline' ? 'var(--color-accent)' : 'var(--border-subtle)',
            backgroundColor: subTab === 'crm-pipeline' ? 'rgba(142, 36, 208, 0.15)' : 'var(--surface-subtle)',
            color: subTab === 'crm-pipeline' ? 'var(--color-accent)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>label</span>
          Pipeline CRM de Ventas (Labels)
        </button>
        <button
          onClick={() => setSubTab('ai-insights')}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: subTab === 'ai-insights' ? 'var(--color-primary)' : 'var(--border-subtle)',
            backgroundColor: subTab === 'ai-insights' ? 'rgba(0, 206, 255, 0.12)' : 'var(--surface-subtle)',
            color: subTab === 'ai-insights' ? 'var(--color-accent)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>auto_awesome</span>
          Inteligencia de Mercado & Stock
        </button>
        <button
          onClick={() => setSubTab('quotes-audit')}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: subTab === 'quotes-audit' ? 'var(--color-primary)' : 'var(--border-subtle)',
            backgroundColor: subTab === 'quotes-audit' ? 'rgba(0, 206, 255, 0.12)' : 'var(--surface-subtle)',
            color: subTab === 'quotes-audit' ? 'var(--color-accent)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>receipt_long</span>
          Auditoría de Cotizaciones
        </button>
        <button
          onClick={() => setSubTab('human-effort')}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: subTab === 'human-effort' ? 'var(--status-success-border)' : 'var(--border-subtle)',
            backgroundColor: subTab === 'human-effort' ? 'var(--status-success-bg)' : 'var(--surface-subtle)',
            color: subTab === 'human-effort' ? 'var(--status-success-solid)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>badge</span>
          Esfuerzo del Agente Humano
        </button>
        <button
          onClick={() => setSubTab('channels')}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: subTab === 'channels' ? 'var(--status-warning-border)' : 'var(--border-subtle)',
            backgroundColor: subTab === 'channels' ? 'var(--status-warning-bg)' : 'var(--surface-subtle)',
            color: subTab === 'channels' ? 'var(--status-warning-solid)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>smartphone</span>
          Rendimiento por Canal
        </button>
      </div>

      {/* TAB 1: EXECUTIVE DASHBOARD */}
      {subTab === 'executive' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.2s ease-out' }}>
          {/* KPI Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1.25rem', backgroundColor: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Conversaciones Totales</span>
              <div className="tabular-nums" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-primary)', margin: '0.25rem 0' }}>{metrics.totalConversations.toLocaleString()}</div>
              <span style={{ fontSize: '0.75rem', color: 'var(--status-success-solid)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>bolt</span>
                {metrics.activeConversations} activas en este momento
              </span>
            </div>

            <div style={{ padding: '1.25rem', backgroundColor: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Autonomía de IA</span>
              <div className="tabular-nums" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--status-success-solid)', margin: '0.25rem 0' }}>{metrics.aiAutonomyRate}%</div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{metrics.aiHandledCount} chats resueltos 100% por IA</span>
            </div>

            <div style={{ padding: '1.25rem', backgroundColor: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Horas/Hombre Ahorradas</span>
              <div className="tabular-nums" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-accent)', margin: '0.25rem 0' }}>{metrics.hoursSaved} hrs</div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Equivalente a ~{Math.round(metrics.hoursSaved / 8)} días laborales</span>
            </div>

            <div style={{ padding: '1.25rem', backgroundColor: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Satisfacción CSAT</span>
              <div className="tabular-nums" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--status-warning-solid)', margin: '0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.6rem', color: 'var(--status-warning-solid)' }}>star</span>
                {metrics.csatScore} / 5.0
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{metrics.csatResponseRate}% de respuesta de clientes</span>
            </div>
          </div>

          {/* Visual AI vs Human Split Progress Bar */}
          <div style={{ padding: '1.25rem', backgroundColor: 'var(--surface-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>smart_toy</span>
              Distribución de Atención: IA vs. Agentes Humanos
            </h4>

            <div style={{ height: '24px', backgroundColor: 'var(--surface-subtle)', borderRadius: '12px', overflow: 'hidden', display: 'flex', marginBottom: '0.75rem', border: '1px solid var(--border-subtle)' }}>
              <div style={{ width: `${metrics.aiAutonomyRate}%`, background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }}>
                IA ({metrics.aiAutonomyRate}%)
              </div>
              <div style={{ width: `${100 - metrics.aiAutonomyRate}%`, backgroundColor: 'rgba(142, 36, 208, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }}>
                Humanos ({(100 - metrics.aiAutonomyRate).toFixed(1)}%)
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <span>🤖 Resueltos por IA: <strong style={{ color: 'var(--text-primary)' }}>{metrics.aiHandledCount}</strong></span>
              <span>👤 Transferidos a Agentes: <strong style={{ color: 'var(--text-primary)' }}>{metrics.humanHandledCount}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CRM PIPELINE */}
      {subTab === 'crm-pipeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.2s ease-out' }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Pipeline de Conversión CRM (Valor Monetario por Etapa)</h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {metrics.pipeline.map(stage => (
              <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem', backgroundColor: 'var(--surface-card)', borderRadius: '10px', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ width: '220px', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                  {stage.label}
                </div>

                <div style={{ flex: 1, backgroundColor: 'var(--surface-subtle)', height: '18px', borderRadius: '9px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ width: `${(stage.count / 320) * 100}%`, backgroundColor: stage.color, height: '100%', borderRadius: '9px', transition: 'width 0.5s' }}></div>
                </div>

                <div className="tabular-nums" style={{ width: '100px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                  {stage.count} leads
                </div>

                <div className="tabular-nums" style={{ width: '130px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--status-success-solid)' }}>
                  ${stage.value.toLocaleString()} USD
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: HUMAN EFFORT */}
      {subTab === 'human-effort' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.2s ease-out' }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Auditoría de Desempeño y Esfuerzo de Vendedores</h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1rem', backgroundColor: 'var(--surface-card)', borderRadius: '10px', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>T. Promedio de Atención</span>
              <div className="tabular-nums" style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--status-success-solid)', margin: '0.2rem 0' }}>{metrics.humanEffort.avgHandleTimeMinutes} min</div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Por conversación tras escalamiento</span>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--surface-card)', borderRadius: '10px', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Respuesta Post-Escalamiento</span>
              <div className="tabular-nums" style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--color-primary)', margin: '0.2rem 0' }}>{metrics.humanEffort.avgPostEscalationResponseSeconds} seg</div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Rapidez del vendedor al tomar la llamada</span>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--surface-card)', borderRadius: '10px', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Precualificación por IA</span>
              <div className="tabular-nums" style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--color-accent)', margin: '0.2rem 0' }}>{metrics.humanEffort.preQualifiedPercentage}%</div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Chats entregados con datos listos</span>
            </div>
          </div>

          {/* Agent Table */}
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '10px', backgroundColor: 'var(--surface-card)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-subtle)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.85rem' }}>Vendedor / Agente</th>
                  <th style={{ padding: '0.85rem', textAlign: 'center' }}>Chats Atendidos</th>
                  <th style={{ padding: '0.85rem', textAlign: 'center' }}>Tiempo Atención Humana</th>
                  <th style={{ padding: '0.85rem', textAlign: 'center' }}>Mensajes Manuales</th>
                  <th style={{ padding: '0.85rem', textAlign: 'center' }}>Tiempo en Pausas</th>
                  <th style={{ padding: '0.85rem', textAlign: 'center' }}>CSAT Agente</th>
                </tr>
              </thead>
              <tbody>
                {metrics.humanEffort.agentStats.map((agent, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.85rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>{agent.name}</td>
                    <td style={{ padding: '0.85rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-primary)' }}>{agent.handled} ({agent.closed} resueltos)</td>
                    <td style={{ padding: '0.85rem', textAlign: 'center', fontWeight: 'bold', color: 'var(--status-success-solid)' }}>{agent.handleTimeMin} min</td>
                    <td style={{ padding: '0.85rem', textAlign: 'center', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{agent.typedMsgs} msgs</td>
                    <td style={{ padding: '0.85rem', textAlign: 'center', color: 'var(--text-muted)' }}>{agent.pausesMin} min</td>
                    <td style={{ padding: '0.85rem', textAlign: 'center', fontWeight: 'bold', color: 'var(--status-warning-solid)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '0.9rem', verticalAlign: 'middle', marginRight: '2px', color: 'var(--status-warning-solid)' }}>star</span>
                      {agent.csat}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: CHANNELS */}
      {subTab === 'channels' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.2s ease-out' }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>smartphone</span>
            Volumen y Proporción por Canal de Atención
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {metrics.channels.map((channel, idx) => (
              <div key={idx} style={{ padding: '1.25rem', backgroundColor: 'var(--surface-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{channel.name}</span>
                <div className="tabular-nums" style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'var(--color-accent)', margin: '0.5rem 0' }}>{channel.count} chats</div>
                <div style={{ height: '6px', backgroundColor: 'var(--surface-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${channel.percentage}%`, height: '100%', background: 'var(--gradient-primary)' }}></div>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem', display: 'block' }}>{channel.percentage}% del volumen total</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: AI INSIGHTS & LOST SALES */}
      {subTab === 'ai-insights' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.2s ease-out' }}>
          {/* Top Products Requested */}
          <div style={{ padding: '1.25rem', backgroundColor: 'var(--surface-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>trending_up</span>
              Laptops y Productos Más Consultados
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.6rem' }}>SKU</th>
                    <th style={{ padding: '0.6rem' }}>Producto</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center' }}>Consultas</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center' }}>Stock Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.aiInsights.topProducts.map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.6rem', fontFamily: 'monospace', color: 'var(--color-accent)', fontWeight: 700 }}>{p.id}</td>
                      <td style={{ padding: '0.6rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</td>
                      <td style={{ padding: '0.6rem', textAlign: 'center', fontWeight: 'bold', color: 'var(--status-success-solid)' }}>{p.count}</td>
                      <td style={{ padding: '0.6rem', textAlign: 'center', fontWeight: 'bold', color: 'var(--text-primary)' }}>{p.stock} un.</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Lost Sales because of Stock = 0 */}
          <div style={{ padding: '1.25rem', backgroundColor: 'var(--status-danger-bg)', borderRadius: '12px', border: '1px solid var(--status-danger-border)' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: 'var(--status-danger-solid)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--status-danger-solid)' }}>warning</span>
              Ventas Perdidas por Falta de Stock (`stock = 0`)
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Productos buscados por los clientes en WhatsApp que no tenían unidades disponibles en inventario.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--status-danger-border)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.6rem' }}>Producto Buscado</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center' }}>Clientes Interesados</th>
                    <th style={{ padding: '0.6rem' }}>Última Consulta</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.aiInsights.lostSalesStock.map((ls, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--status-danger-border)' }}>
                      <td style={{ padding: '0.6rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{ls.product}</td>
                      <td style={{ padding: '0.6rem', textAlign: 'center', fontWeight: 'bold', color: 'var(--status-danger-solid)' }}>{ls.count} personas</td>
                      <td style={{ padding: '0.6rem', color: 'var(--text-muted)' }}>{ls.lastRequested}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: QUOTES AUDIT & EXPORT */}
      {subTab === 'quotes-audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--surface-card)', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>📊 Auditoría Gerencial de Cotizaciones y Asignaciones</h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Trazabilidad inmutable de todas las cotizaciones creadas por asesor con exportación a Excel.</p>
            </div>
            <button
              onClick={() => {
                window.open(`/api/control/${tenantId}/reports/quotes-audit?format=csv`, '_blank');
              }}
              style={{
                backgroundColor: 'var(--status-success-solid)',
                color: '#ffffff',
                border: 'none',
                padding: '0.6rem 1.1rem',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>download</span>
              Exportar a Excel (CSV)
            </button>
          </div>

          <div style={{ backgroundColor: 'var(--surface-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-subtle)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontWeight: 700 }}>
                  <th style={{ padding: '0.75rem 1rem' }}>ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Cliente</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Teléfono</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Cotización / Oportunidad</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Monto</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Asesor Asignado</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {loadingQuotesAudit ? (
                  <tr><td colSpan={7} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando auditoría...</td></tr>
                ) : quotesAuditData.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Sin cotizaciones registradas.</td></tr>
                ) : (
                  quotesAuditData.map((row: any) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--color-accent)' }}>#{row.id}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{row.contact_name || 'Cliente'}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{row.contact_phone || '-'}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)' }}>{row.title || 'Cotización'}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: 'var(--status-success-solid)' }}>${row.value || 0} {row.currency || 'USD'}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--color-accent)' }}>{row.assigned_agent_name || 'Sin Asignar'}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{new Date(row.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
