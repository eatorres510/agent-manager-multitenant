import React, { useState } from 'react';

interface AnalyticsTabProps {
  tenantId: string;
  token: string | null;
  role: string | null;
}

type SubTab = 'executive' | 'crm-pipeline' | 'human-effort' | 'channels' | 'ai-insights';

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ tenantId }) => {
  const [subTab, setSubTab] = useState<SubTab>('executive');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'all'>('30d');

  // Metrics state for demonstration & dynamic calculation
  const [metrics] = useState({
    totalConversations: 1248,
    activeConversations: 42,
    closedConversations: 1206,
    aiHandledCount: 980,
    humanHandledCount: 268,
    aiAutonomyRate: 78.5,
    hoursSaved: 163,
    csatScore: 4.8,
    csatResponseRate: 64,
    // CRM Pipeline Stages
    pipeline: [
      { id: 'prospecto', label: 'Prospectos / Leads IA', count: 320, value: 45000, color: '#2563eb' },
      { id: 'interesado', label: 'Interesados en Producto', count: 215, value: 38000, color: '#7c3aed' },
      { id: 'cotizado', label: 'Cotización Enviada', count: 140, value: 29000, color: '#d97706' },
      { id: 'cita_agendada', label: 'Cita / Demo Agendada', count: 85, value: 18500, color: '#0284c7' },
      { id: 'negociacion', label: 'En Negociación', count: 48, value: 12000, color: '#ea580c' },
      { id: 'ganado', label: 'Ventas Ganadas', count: 180, value: 52000, color: '#059669' },
      { id: 'perdido', label: 'Ventas Perdidas (Stock/Precio)', count: 60, value: 15000, color: '#dc2626' }
    ],
    // Human Effort Metrics
    humanEffort: {
      avgHandleTimeMinutes: 8.4,
      avgPostEscalationResponseSeconds: 42,
      humanTypedMessages: 1840,
      preQualifiedPercentage: 86,
      agentStats: [
        { name: 'Jovanela', handled: 84, closed: 80, handleTimeMin: 7.2, typedMsgs: 540, pausesMin: 45, csat: 4.9 },
        { name: 'Adonis', handled: 76, closed: 72, handleTimeMin: 8.5, typedMsgs: 480, pausesMin: 50, csat: 4.7 },
        { name: 'Mario Lumbi', handled: 62, closed: 60, handleTimeMin: 9.1, typedMsgs: 410, pausesMin: 30, csat: 4.8 },
        { name: 'Toribio', handled: 46, closed: 44, handleTimeMin: 8.8, typedMsgs: 310, pausesMin: 40, csat: 4.9 }
      ]
    },
    // Channels
    channels: [
      { name: 'WhatsApp Principal (+505 8888-5707)', count: 840, percentage: 67 },
      { name: 'WhatsApp Ventas Corporativas', count: 260, percentage: 21 },
      { name: 'Web Chat Widget (Sitio Web)', count: 148, percentage: 12 }
    ],
    // AI Insights
    aiInsights: {
      topProducts: [
        { id: 'LAP-HP-450G9', name: 'HP ProBook 450 G9 i5 8GB/512GB', count: 142, stock: 8 },
        { id: 'LAP-DELL-3540', name: 'Dell Latitude 3540 Core i5 16GB', count: 118, stock: 5 },
        { id: 'LAP-LENOVO-E16', name: 'Lenovo ThinkPad E16 Ryzen 7', count: 96, stock: 3 },
        { id: 'LAP-ASUS-I9', name: 'ASUS VivoBook Core i9 16GB', count: 84, stock: 2 }
      ],
      lostSalesStock: [
        { product: 'MacBook Air M2 13"', count: 18, lastRequested: '2026-07-21' },
        { product: 'Impresora Epson L3250 EcoTank', count: 14, lastRequested: '2026-07-20' },
        { product: 'Monitor Dell 27" IPS 4K', count: 9, lastRequested: '2026-07-19' }
      ]
    }
  });

  return (
    <div className="glass-card" style={{ animation: 'fadeIn 0.2s ease-out' }}>
      {/* Header & Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 className="card-title" style={{ margin: 0, color: '#0b2b4c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📊 Centro de Reportes, Informes Ejecutivos & BI ({tenantId.toUpperCase()})
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
            📥 Exportar Informe (PDF/CSV)
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
          📈 Dashboard Ejecutivo & ROI IA
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
          🏷️ Pipeline CRM de Ventas (Labels)
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
          🏋️‍♂️ Esfuerzo del Agente Humano
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
          📱 Rendimiento por Canal
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
          💡 Oportunidades & Inventario
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
              <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>⚡ {metrics.activeConversations} activas en este momento</span>
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
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#d97706', margin: '0.25rem 0' }}>⭐ {metrics.csatScore} / 5.0</div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{metrics.csatResponseRate}% de respuesta de clientes</span>
            </div>
          </div>

          {/* Visual AI vs Human Split Progress Bar */}
          <div style={{ padding: '1.25rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: '#0b2b4c' }}>🤖 Distribución de Atención: IA vs. Agentes Humanos</h4>
            <div style={{ height: '24px', borderRadius: '12px', backgroundColor: '#e5e7eb', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${metrics.aiAutonomyRate}%`, backgroundColor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', color: '#fff' }}>
                IA ({metrics.aiAutonomyRate}%)
              </div>
              <div style={{ width: `${100 - metrics.aiAutonomyRate}%`, backgroundColor: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', color: '#fff' }}>
                Humano ({(100 - metrics.aiAutonomyRate).toFixed(1)}%)
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
              <span>🟢 {metrics.aiHandledCount} Atendidas por IA</span>
              <span>🔵 {metrics.humanHandledCount} Atendidas por Asesores Humanos</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CRM PIPELINE (KANBAN & STAGES) */}
      {subTab === 'crm-pipeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ padding: '1rem', backgroundColor: '#f5f3ff', borderRadius: '10px', border: '1px solid #ddd6fe' }}>
            <h4 style={{ margin: '0 0 0.4rem 0', color: '#7c3aed', fontSize: '0.95rem' }}>🏷️ Pipeline CRM impulsado por Etiquetas de Chatwoot (`stage:*`)</h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: 1.4 }}>
              Las conversaciones cambian de etapa automáticamente cuando la IA cotiza productos o agenda citas, o manualmente cuando un vendedor actualiza la etiqueta del chat.
            </p>
          </div>

          {/* Kanban Columns Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', overflowX: 'auto' }}>
            {metrics.pipeline.map((stage) => (
              <div
                key={stage.id}
                style={{
                  padding: '1rem',
                  backgroundColor: '#f8fafc',
                  borderRadius: '12px',
                  border: `1px solid ${stage.color}40`,
                  borderTop: `4px solid ${stage.color}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: stage.color }}>{stage.label}</span>
                  <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.45rem', backgroundColor: `${stage.color}15`, color: stage.color, borderRadius: '4px', fontWeight: 'bold' }}>
                    {stage.count}
                  </span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#0b2b4c' }}>
                  C$ {stage.value.toLocaleString()}
                </div>
                <div style={{ height: '5px', borderRadius: '3px', backgroundColor: '#e5e7eb', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, (stage.count / 350) * 100)}%`, height: '100%', backgroundColor: stage.color }}></div>
                </div>
              </div>
            ))}
          </div>

          {/* Conversion Funnel Summary */}
          <div style={{ padding: '1.25rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: '#0b2b4c' }}>🎯 Métricas de Conversión del Embudo de Ventas</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: '#64748b' }}>Tasa de Conversión Prospecto ➡️ Venta:</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#059669', marginTop: '0.2rem' }}>56.2%</div>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Duración Promedio del Ciclo:</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#2563eb', marginTop: '0.2rem' }}>1.4 días</div>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Principal Motivo de Pérdida:</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#dc2626', marginTop: '0.2rem' }}>Falta de Stock (62%)</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HUMAN EFFORT METRICS */}
      {subTab === 'human-effort' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ padding: '1rem', backgroundColor: '#ecfdf5', borderRadius: '10px', border: '1px solid #a7f3d0' }}>
            <h4 style={{ margin: '0 0 0.4rem 0', color: '#059669', fontSize: '0.95rem' }}>🏋️‍♂️ Medición de Esfuerzo Exclusivo del Vendedor Humano</h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: 1.4 }}>
              Los contadores de atención humana inician únicamente cuando la IA transfiere la conversación a un vendedor. No incluye los minutos que el bot estuvo conversando con el cliente.
            </p>
          </div>

          {/* Effort Summary KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Tiempo Promedio de Atención Humana</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#059669', margin: '0.2rem 0' }}>{metrics.humanEffort.avgHandleTimeMinutes} min</div>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Desde escalamiento hasta resolución</span>
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
                    <td style={{ padding: '0.85rem', textAlign: 'center', fontWeight: 'bold', color: '#d97706' }}>⭐ {agent.csat}</td>
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
          <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#0b2b4c' }}>📱 Volumen y Proporción por Canal de Atención</h4>
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
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: '#0b2b4c' }}>🔥 Laptops y Productos Más Consultados</h4>
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
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#dc2626' }}>⚠️ Ventas Perdidas por Falta de Stock (`stock = 0`)</h4>
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
