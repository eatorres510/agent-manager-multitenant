import React, { useState, useEffect } from 'react';

interface AnalyticsTabProps {
  tenantId: string;
  token: string | null;
  role: string | null;
}

type SubTab = 'executive' | 'crm-pipeline' | 'human-effort' | 'channels' | 'ai-insights';

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ tenantId, token }) => {
  const [subTab, setSubTab] = useState<SubTab>('executive');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'all'>('30d');

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

  return (
    <div className="glass-card" style={{ animation: 'fadeIn 0.2s ease-out' }}>
      {/* Header & Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 className="card-title" style={{ margin: 0, color: '#0b2b4c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.5rem', color: '#2563eb' }}>analytics</span>
            Centro de Reportes, Informes Ejecutivos & BI ({tenantId.toUpperCase()})
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
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
              backgroundColor: '#10b981',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>download</span>
            Exportar Informe (PDF/CSV)
          </button>

          {/* Date Filter */}
          <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: '#f8fafc', padding: '0.25rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <button
              onClick={() => setDateRange('7d')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: dateRange === '7d' ? '#0b2b4c' : 'transparent',
                color: dateRange === '7d' ? '#fff' : '#64748b',
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
                backgroundColor: dateRange === '30d' ? '#0b2b4c' : 'transparent',
                color: dateRange === '30d' ? '#fff' : '#64748b',
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
                backgroundColor: dateRange === 'all' ? '#0b2b4c' : 'transparent',
                color: dateRange === 'all' ? '#fff' : '#64748b',
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
        borderBottom: '1px solid #e5e7eb',
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
            borderColor: subTab === 'executive' ? '#2563eb' : '#e5e7eb',
            backgroundColor: subTab === 'executive' ? '#eff6ff' : '#ffffff',
            color: subTab === 'executive' ? '#2563eb' : '#64748b',
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
            borderColor: subTab === 'crm-pipeline' ? '#7c3aed' : '#e5e7eb',
            backgroundColor: subTab === 'crm-pipeline' ? '#f5f3ff' : '#ffffff',
            color: subTab === 'crm-pipeline' ? '#7c3aed' : '#64748b',
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
          onClick={() => setSubTab('human-effort')}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: subTab === 'human-effort' ? '#10b981' : '#e5e7eb',
            backgroundColor: subTab === 'human-effort' ? '#ecfdf5' : '#ffffff',
            color: subTab === 'human-effort' ? '#059669' : '#64748b',
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
            borderColor: subTab === 'channels' ? '#d97706' : '#e5e7eb',
            backgroundColor: subTab === 'channels' ? '#fffbeb' : '#ffffff',
            color: subTab === 'channels' ? '#d97706' : '#64748b',
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
        <button
          onClick={() => setSubTab('ai-insights')}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: subTab === 'ai-insights' ? '#db2777' : '#e5e7eb',
            backgroundColor: subTab === 'ai-insights' ? '#fdf2f8' : '#ffffff',
            color: subTab === 'ai-insights' ? '#db2777' : '#64748b',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>lightbulb</span>
          Oportunidades & Inventario
        </button>
      </div>

      {/* TAB 1: EXECUTIVE DASHBOARD */}
      {subTab === 'executive' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.2s ease-out' }}>
          {/* KPI Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1.25rem', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Conversaciones Totales</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#2563eb', margin: '0.25rem 0' }}>{metrics.totalConversations.toLocaleString()}</div>
              <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>bolt</span>
                {metrics.activeConversations} activas en este momento
              </span>
            </div>

            <div style={{ padding: '1.25rem', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Autonomía de IA</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#059669', margin: '0.25rem 0' }}>{metrics.aiAutonomyRate}%</div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{metrics.aiHandledCount} chats resueltos 100% por IA</span>
            </div>

            <div style={{ padding: '1.25rem', backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Horas/Hombre Ahorradas</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#7c3aed', margin: '0.25rem 0' }}>{metrics.hoursSaved} hrs</div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Equivalente a ~{Math.round(metrics.hoursSaved / 8)} días laborales</span>
            </div>

            <div style={{ padding: '1.25rem', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Satisfacción CSAT</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#d97706', margin: '0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.6rem', color: '#f59e0b' }}>star</span>
                {metrics.csatScore} / 5.0
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{metrics.csatResponseRate}% de respuesta de clientes</span>
            </div>
          </div>

          {/* Visual AI vs Human Split Progress Bar */}
          <div style={{ padding: '1.25rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: '#0b2b4c', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="material-symbols-outlined" style={{ color: '#2563eb' }}>smart_toy</span>
              Distribución de Atención: IA vs. Agentes Humanos
            </h4>

            <div style={{ height: '24px', backgroundColor: '#e2e8f0', borderRadius: '12px', overflow: 'hidden', display: 'flex', marginBottom: '0.75rem' }}>
              <div style={{ width: `${metrics.aiAutonomyRate}%`, backgroundColor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }}>
                IA ({metrics.aiAutonomyRate}%)
              </div>
              <div style={{ width: `${100 - metrics.aiAutonomyRate}%`, backgroundColor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }}>
                Humanos ({(100 - metrics.aiAutonomyRate).toFixed(1)}%)
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b' }}>
              <span>🤖 Resueltos por IA: <strong>{metrics.aiHandledCount}</strong></span>
              <span>👤 Transferidos a Agentes: <strong>{metrics.humanHandledCount}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CRM PIPELINE */}
      {subTab === 'crm-pipeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.2s ease-out' }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#0b2b4c' }}>Pipeline de Conversión CRM (Valor Monetario por Etapa)</h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {metrics.pipeline.map(stage => (
              <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                <div style={{ width: '220px', fontSize: '0.85rem', fontWeight: 'bold', color: stage.color }}>
                  {stage.label}
                </div>

                <div style={{ flex: 1, backgroundColor: '#e5e7eb', height: '18px', borderRadius: '9px', overflow: 'hidden' }}>
                  <div style={{ width: `${(stage.count / 320) * 100}%`, backgroundColor: stage.color, height: '100%', borderRadius: '9px', transition: 'width 0.5s' }}></div>
                </div>

                <div style={{ width: '100px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 'bold', color: '#0b2b4c' }}>
                  {stage.count} leads
                </div>

                <div style={{ width: '130px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 'bold', color: '#059669' }}>
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
          <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#0b2b4c' }}>Auditoría de Desempeño y Esfuerzo de Vendedores</h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>T. Promedio de Atención</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#059669', margin: '0.2rem 0' }}>{metrics.humanEffort.avgHandleTimeMinutes} min</div>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Por conversación tras escalamiento</span>
            </div>

            <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Respuesta Post-Escalamiento</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#2563eb', margin: '0.2rem 0' }}>{metrics.humanEffort.avgPostEscalationResponseSeconds} seg</div>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Rapidez del vendedor al tomar la llamada</span>
            </div>

            <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Precualificación por IA</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#7c3aed', margin: '0.2rem 0' }}>{metrics.humanEffort.preQualifiedPercentage}%</div>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Chats entregados con datos listos</span>
            </div>
          </div>

          {/* Agent Table */}
          <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '10px', backgroundColor: '#ffffff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', color: '#0b2b4c' }}>
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
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.85rem', fontWeight: 'bold', color: '#2563eb' }}>{agent.name}</td>
                    <td style={{ padding: '0.85rem', textAlign: 'center', fontWeight: 600, color: '#0b2b4c' }}>{agent.handled} ({agent.closed} resueltos)</td>
                    <td style={{ padding: '0.85rem', textAlign: 'center', fontWeight: 'bold', color: '#059669' }}>{agent.handleTimeMin} min</td>
                    <td style={{ padding: '0.85rem', textAlign: 'center', fontFamily: 'monospace', color: '#0b2b4c' }}>{agent.typedMsgs} msgs</td>
                    <td style={{ padding: '0.85rem', textAlign: 'center', color: '#64748b' }}>{agent.pausesMin} min</td>
                    <td style={{ padding: '0.85rem', textAlign: 'center', fontWeight: 'bold', color: '#d97706' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '0.9rem', verticalAlign: 'middle', marginRight: '2px', color: '#f59e0b' }}>star</span>
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
          <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#0b2b4c', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="material-symbols-outlined" style={{ color: '#2563eb' }}>smartphone</span>
            Volumen y Proporción por Canal de Atención
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {metrics.channels.map((channel, idx) => (
              <div key={idx} style={{ padding: '1.25rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#0b2b4c' }}>{channel.name}</span>
                <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#2563eb', margin: '0.5rem 0' }}>{channel.count} chats</div>
                <div style={{ height: '6px', backgroundColor: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${channel.percentage}%`, height: '100%', backgroundColor: '#2563eb' }}></div>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.4rem', display: 'block' }}>{channel.percentage}% del volumen total</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: AI INSIGHTS & LOST SALES */}
      {subTab === 'ai-insights' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.2s ease-out' }}>
          {/* Top Products Requested */}
          <div style={{ padding: '1.25rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: '#0b2b4c', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="material-symbols-outlined" style={{ color: '#ea580c' }}>trending_up</span>
              Laptops y Productos Más Consultados
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#64748b' }}>
                    <th style={{ padding: '0.6rem' }}>SKU</th>
                    <th style={{ padding: '0.6rem' }}>Producto</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center' }}>Consultas</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center' }}>Stock Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.aiInsights.topProducts.map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.6rem', fontFamily: 'monospace', color: '#2563eb', fontWeight: 700 }}>{p.id}</td>
                      <td style={{ padding: '0.6rem', fontWeight: 600, color: '#0b2b4c' }}>{p.name}</td>
                      <td style={{ padding: '0.6rem', textAlign: 'center', fontWeight: 'bold', color: '#059669' }}>{p.count}</td>
                      <td style={{ padding: '0.6rem', textAlign: 'center', fontWeight: 'bold', color: '#0b2b4c' }}>{p.stock} un.</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Lost Sales because of Stock = 0 */}
          <div style={{ padding: '1.25rem', backgroundColor: '#fef2f2', borderRadius: '12px', border: '1px solid #fecaca' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="material-symbols-outlined" style={{ color: '#dc2626' }}>warning</span>
              Ventas Perdidas por Falta de Stock (`stock = 0`)
            </h4>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
              Productos buscados por los clientes en WhatsApp que no tenían unidades disponibles en inventario.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #fecaca', color: '#64748b' }}>
                    <th style={{ padding: '0.6rem' }}>Producto Buscado</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center' }}>Clientes Interesados</th>
                    <th style={{ padding: '0.6rem' }}>Última Consulta</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.aiInsights.lostSalesStock.map((ls, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #fee2e2' }}>
                      <td style={{ padding: '0.6rem', fontWeight: 'bold', color: '#0b2b4c' }}>{ls.product}</td>
                      <td style={{ padding: '0.6rem', textAlign: 'center', fontWeight: 'bold', color: '#dc2626' }}>{ls.count} personas</td>
                      <td style={{ padding: '0.6rem', color: '#64748b' }}>{ls.lastRequested}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
