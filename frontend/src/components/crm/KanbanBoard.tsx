import React, { useState, useEffect } from 'react';

interface KanbanBoardProps {
  tenantId: string;
  token: string | null;
  role: string | null;
  onOpenChat?: (convId: number) => void;
}

interface ConversationCard {
  id: number;
  status: 'open' | 'pending' | 'resolved' | 'snoozed';
  unread_count: number;
  last_activity_at: number;
  labels: string[];
  meta: {
    sender: {
      name: string;
      phone_number?: string;
      email?: string;
    };
    assignee?: {
      name: string;
    };
  };
}

const STAGES = [
  { id: 'stage:prospecto', name: '1. Lead / Prospecto IA', color: '#2563eb', bg: '#eff6ff' },
  { id: 'stage:interesado', name: '2. Interesado en Producto', color: '#7c3aed', bg: '#f5f3ff' },
  { id: 'stage:cotizado', name: '3. Cotización Enviada', color: '#d97706', bg: '#fffbeb' },
  { id: 'stage:cita_agendada', name: '4. Cita / Demo Agendada', color: '#0284c7', bg: '#f0f9ff' },
  { id: 'stage:negociacion', name: '5. En Negociación', color: '#ea580c', bg: '#fff7ed' },
  { id: 'stage:ganado', name: '6. Venta Ganada 🎉', color: '#059669', bg: '#ecfdf5' },
  { id: 'stage:perdido', name: '7. Venta Perdida ❌', color: '#dc2626', bg: '#fef2f2' }
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ tenantId, token, role, onOpenChat }) => {
  const [conversations, setConversations] = useState<ConversationCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/control/${tenantId}/conversations?status=all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Error fetching Kanban conversations:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, [tenantId]);

  const handleMoveStage = async (convId: number, currentLabels: string[], newStage: string) => {
    if (role === 'readonly') {
      showToast('Permisos de sólo lectura.', 'error');
      return;
    }

    try {
      const nonStageLabels = currentLabels.filter(l => !l.startsWith('stage:'));
      const updatedLabels = [...nonStageLabels, newStage];

      const res = await fetch(`/api/control/${tenantId}/conversations/${convId}/labels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ labels: updatedLabels })
      });

      if (!res.ok) throw new Error('Error actualizando etapa CRM');

      setConversations(prev => prev.map(c => c.id === convId ? { ...c, labels: updatedLabels } : c));
      showToast('Etapa CRM actualizada en el Tablero Kanban!');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const getStageForConv = (labels: string[]) => {
    const stage = labels.find(l => l.startsWith('stage:'));
    return stage || 'stage:prospecto';
  };

  return (
    <div style={{
      animation: 'fadeIn 0.25s ease-out',
      height: 'calc(100vh - 100px)',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      padding: '1.25rem',
      boxSizing: 'border-box',
      overflow: 'hidden',
      color: '#0b2b4c',
      border: '1px solid #e5e7eb',
      boxShadow: '0 4px 20px rgba(11, 43, 76, 0.05)',
      fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif'
    }}>
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          padding: '0.85rem 1.4rem',
          backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
          color: '#fff',
          borderRadius: '10px',
          fontWeight: 'bold',
          fontSize: '0.85rem',
          zIndex: 2000,
          boxShadow: '0 10px 25px rgba(11, 43, 76, 0.15)'
        }}>
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0b2b4c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📌 Tablero Kanban - Pipeline de Ventas CRM
          </h2>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            Visualización gráfica en tiempo real de leads por etapa del embudo comercial.
          </p>
        </div>

        <button
          onClick={fetchConversations}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            backgroundColor: '#f8fafc',
            color: '#0b2b4c',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'all 0.2s'
          }}
        >
          🔄 Actualizar Kanban
        </button>
      </div>

      {/* 7-COLUMN KANBAN BOARD */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(7, minmax(260px, 1fr))',
        gap: '0.85rem',
        overflowX: 'auto',
        overflowY: 'hidden',
        paddingBottom: '0.5rem'
      }}>
        {STAGES.map(stage => {
          const stageConvs = conversations.filter(c => getStageForConv(c.labels) === stage.id);

          return (
            <div
              key={stage.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                borderTop: `4px solid ${stage.color}`,
                padding: '0.75rem',
                maxHeight: '100%',
                overflow: 'hidden'
              }}
            >
              {/* Column Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '0.6rem',
                borderBottom: '1px solid #e5e7eb',
                marginBottom: '0.75rem'
              }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: stage.color }}>
                  {stage.name}
                </div>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '0.15rem 0.55rem',
                  borderRadius: '10px',
                  backgroundColor: stage.bg,
                  color: stage.color,
                  border: `1px solid ${stage.color}30`
                }}>
                  {stageConvs.length}
                </span>
              </div>

              {/* Cards List Column */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.65rem', paddingRight: '0.2rem' }}>
                {loading && conversations.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1rem', color: '#64748b', fontSize: '0.75rem' }}>Cargando...</div>
                ) : stageConvs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: '#9ca3af', fontSize: '0.75rem', border: '1px dashed #e5e7eb', borderRadius: '8px', backgroundColor: '#ffffff' }}>
                    Sin leads en esta etapa
                  </div>
                ) : (
                  stageConvs.map(c => {
                    const contactName = c.meta?.sender?.name || `Cliente #${c.id}`;
                    const phone = c.meta?.sender?.phone_number || '';
                    const isPendingBot = c.status === 'pending';

                    return (
                      <div
                        key={c.id}
                        style={{
                          padding: '0.85rem',
                          backgroundColor: '#ffffff',
                          borderRadius: '10px',
                          border: '1px solid #e5e7eb',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem',
                          boxShadow: '0 2px 8px rgba(11, 43, 76, 0.04)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '0.88rem', color: '#0b2b4c' }}>{contactName}</strong>
                          <span style={{
                            fontSize: '0.65rem',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontWeight: 700,
                            backgroundColor: isPendingBot ? 'rgba(16, 185, 129, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                            color: isPendingBot ? '#059669' : '#2563eb'
                          }}>
                            {isPendingBot ? '🤖 IA Sofía' : '👤 Humano'}
                          </span>
                        </div>

                        {phone && (
                          <div style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 600 }}>
                            📱 {phone}
                          </div>
                        )}

                        <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Asignado: <strong style={{ color: '#0b2b4c' }}>{c.meta?.assignee?.name || 'Bot IA'}</strong></span>
                        </div>

                        {/* Move Stage Selector & Action */}
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                          <select
                            value={stage.id}
                            onChange={(e) => handleMoveStage(c.id, c.labels, e.target.value)}
                            style={{
                              flex: 1,
                              padding: '0.35rem',
                              borderRadius: '6px',
                              backgroundColor: '#f8fafc',
                              border: '1px solid #e5e7eb',
                              color: '#0b2b4c',
                              fontSize: '0.72rem',
                              fontWeight: 600
                            }}
                          >
                            {STAGES.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>

                          {onOpenChat && (
                            <button
                              onClick={() => onOpenChat(c.id)}
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: '#2563eb',
                                color: '#ffffff',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.2)'
                              }}
                              title="Abrir Chat en Vivo"
                            >
                              💬
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
