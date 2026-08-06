import React, { useState, useEffect } from 'react';
import { OpportunityModal, type OpportunityData } from './OpportunityModal';

interface KanbanBoardProps {
  tenantId: string;
  token: string | null;
  role: string | null;
  onOpenChat?: (convId: number) => void;
}

export interface Opportunity {
  id: number;
  tenant_id: string;
  contact_id: string;
  contact_name: string;
  contact_phone: string;
  conversation_id?: string;
  title: string;
  value: number;
  currency: string;
  stage: string;
  probability: number;
  assigned_agent_name?: string;
  lost_reason?: string;
  lost_notes?: string;
  next_action_type?: string;
  next_action_date?: string;
  next_action_notes?: string;
  created_at: string;
  updated_at: string;
}

const STAGES = [
  { id: 'stage:prospecto', name: '1. Lead / Prospecto IA', color: '#2563eb', bg: '#eff6ff' },
  { id: 'stage:interesado', name: '2. Interesado en Producto', color: '#7c3aed', bg: '#f5f3ff' },
  { id: 'stage:cotizado', name: '3. Cotización Enviada', color: '#d97706', bg: '#fffbeb' },
  { id: 'stage:cita_agendada', name: '4. Cita / Demo Agendada', color: '#0284c7', bg: '#f0f9ff' },
  { id: 'stage:negociacion', name: '5. En Negociación', color: '#ea580c', bg: '#fff7ed' },
  { id: 'stage:ganado', name: '6. Venta Ganada', color: '#059669', bg: '#ecfdf5' },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ tenantId, token, role, onOpenChat }) => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [advisorsList, setAdvisorsList] = useState<{ id?: number; name: string; email: string; role?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Unified Opportunity Modal State
  const [showOppModal, setShowOppModal] = useState(false);
  const [editingOpp, setEditingOpp] = useState<Partial<OpportunityData> | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (token) {
      fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setAdvisorsList(data); })
        .catch(e => console.error('Error fetching users in Kanban:', e));
    }
  }, [token]);

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/control/${tenantId}/opportunities`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOpportunities(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Error fetching CRM opportunities:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
    const interval = setInterval(fetchOpportunities, 8000);
    return () => clearInterval(interval);
  }, [tenantId]);

  const handleStageChangeSelect = (opp: Opportunity, targetStage: string) => {
    if (role === 'readonly') {
      showToast('Permisos de sólo lectura.', 'error');
      return;
    }

    if (targetStage === 'stage:perdido') {
      setEditingOpp({ ...opp, stage: 'stage:perdido' });
      setShowOppModal(true);
    } else {
      updateOppStage(opp.id, targetStage);
    }
  };

  const updateOppStage = async (oppId: number, stage: string, lost_reason?: string, lost_notes?: string) => {
    try {
      const res = await fetch(`/api/control/${tenantId}/opportunities/${oppId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ stage, lost_reason, lost_notes })
      });

      if (!res.ok) throw new Error('Error actualizando etapa de la oportunidad');

      setOpportunities(prev => prev.map(o => o.id === oppId ? { ...o, stage, lost_reason, lost_notes } : o));
      showToast('Oportunidad actualizada en el Pipeline CRM!');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div style={{
      animation: 'fadeIn 0.25s ease-out',
      height: 'calc(100vh - 75px)',
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

      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0b2b4c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.4rem', color: '#2563eb' }}>view_kanban</span>
            Tablero Kanban - Pipeline de Oportunidades CRM
          </h2>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            Gestión individual de Oportunidades Comerciales, valores monetarios y seguimiento de Próximas Acciones.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => {
              setEditingOpp(null);
              setShowOppModal(true);
            }}
            style={{
              padding: '0.55rem 1.1rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>add</span>
            Nueva Oportunidad
          </button>

          <button
            onClick={fetchOpportunities}
            style={{
              padding: '0.55rem 0.9rem',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              color: '#0b2b4c',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>refresh</span>
            Actualizar
          </button>
        </div>
      </div>

      {/* 7-COLUMN KANBAN BOARD */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(7, minmax(280px, 1fr))',
        gap: '0.85rem',
        overflowX: 'auto',
        overflowY: 'hidden',
        paddingBottom: '0.5rem'
      }}>
        {STAGES.map(stage => {
          const stageOpps = opportunities.filter(o => o.stage === stage.id);
          const totalStageValue = stageOpps.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);

          return (
            <div
              key={stage.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: `1.5px solid ${stage.color}`,
                padding: '0.75rem',
                maxHeight: '100%',
                overflow: 'hidden'
              }}
            >
              {/* Column Header */}
              <div style={{
                paddingBottom: '0.6rem',
                borderBottom: '1px solid #e2e8f0',
                marginBottom: '0.75rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: stage.color }}>
                    {stage.name}
                  </span>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '10px',
                    backgroundColor: stage.bg,
                    color: stage.color
                  }}>
                    {stageOpps.length}
                  </span>
                </div>

                {/* Total Column Monetary Value */}
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0b2b4c', marginTop: '0.35rem' }}>
                  Total: <span style={{ color: stage.color }}>${totalStageValue.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</span>
                </div>
              </div>

              {/* Opportunity Cards List */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.65rem', paddingRight: '0.2rem' }}>
                {loading && opportunities.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1rem', color: '#64748b', fontSize: '0.75rem' }}>Cargando...</div>
                ) : stageOpps.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.75rem', border: '1px dashed #cbd5e1', borderRadius: '8px' }}>
                    Sin oportunidades en esta etapa
                  </div>
                ) : (
                  stageOpps.map(opp => {
                    const isLost = opp.stage === 'stage:perdido';
                    const isWon = opp.stage === 'stage:ganado';

                    return (
                      <div
                        key={opp.id}
                        onClick={() => {
                          setEditingOpp(opp);
                          setShowOppModal(true);
                        }}
                        style={{
                          padding: '0.85rem',
                          backgroundColor: '#ffffff',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.45rem',
                          boxShadow: '0 2px 6px rgba(11, 43, 76, 0.04)',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        {/* Title & Contact */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <strong style={{ fontSize: '0.85rem', color: '#0b2b4c', lineHeight: 1.3 }}>
                            {opp.title}
                          </strong>
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            color: isWon ? '#059669' : isLost ? '#dc2626' : '#2563eb',
                            backgroundColor: isWon ? '#ecfdf5' : isLost ? '#fef2f2' : '#eff6ff',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px',
                            whiteSpace: 'nowrap'
                          }}>
                            ${Number(opp.value).toLocaleString('en-US', { minimumFractionDigits: 2 })} {opp.currency}
                          </span>
                        </div>

                        {/* Customer Info */}
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>person</span>
                          {opp.contact_name} {opp.contact_phone && `(${opp.contact_phone})`}
                        </div>

                        {/* Lost Reason Badge */}
                        {isLost && opp.lost_reason && (
                          <div style={{
                            fontSize: '0.7rem',
                            backgroundColor: '#fef2f2',
                            color: '#dc2626',
                            padding: '0.3rem 0.5rem',
                            borderRadius: '6px',
                            border: '1px solid #fecaca'
                          }}>
                            <strong>Motivo Pérdida:</strong> {opp.lost_reason}
                            {opp.lost_notes && <div style={{ fontSize: '0.65rem', marginTop: '0.1rem' }}>"{opp.lost_notes}"</div>}
                          </div>
                        )}

                        {/* Next Action Badge */}
                        {opp.next_action_type && (
                          <div style={{
                            fontSize: '0.7rem',
                            backgroundColor: '#f0f9ff',
                            color: '#0284c7',
                            padding: '0.3rem 0.5rem',
                            borderRadius: '6px',
                            border: '1px solid #bae6fd',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>
                                {opp.next_action_type === 'llamada' ? 'call' : opp.next_action_type === 'correo' ? 'mail' : opp.next_action_type === 'visita' ? 'directions_car' : 'laptop'}
                              </span>
                              {opp.next_action_type}: {opp.next_action_notes || 'Pendiente'}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingOpp(opp);
                                setShowOppModal(true);
                              }}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.7rem', color: '#0284c7', fontWeight: 800, padding: 0 }}
                              title="Editar Próxima Acción"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>edit</span>
                            </button>
                          </div>
                        )}

                        {/* Action Bar */}
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                          <select
                            value={opp.stage}
                            onChange={(e) => {
                                e.stopPropagation();
                                handleStageChangeSelect(opp, e.target.value);
                            }}
                            style={{
                              flex: 1,
                              padding: '0.35rem',
                              borderRadius: '6px',
                              backgroundColor: '#ffffff',
                              border: '1px solid #cbd5e1',
                              color: '#0b2b4c',
                              fontSize: '0.72rem',
                              fontWeight: 700
                            }}
                          >
                            {STAGES.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingOpp(opp);
                              setShowOppModal(true);
                            }}
                            style={{
                              padding: '0.35rem 0.6rem',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#f8fafc',
                              color: '#0b2b4c',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.2rem'
                            }}
                            title="Editar Oportunidad"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>edit</span>
                            Editar
                          </button>

                          {opp.conversation_id && onOpenChat && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenChat(parseInt(opp.conversation_id!));
                              }}
                              style={{
                                padding: '0.35rem 0.6rem',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: '#2563eb',
                                color: '#ffffff',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Ir al Chat de WhatsApp"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>chat</span>
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

      {/* Unified Opportunity Modal (Create & Edit) */}
      <OpportunityModal
        isOpen={showOppModal}
        onClose={() => setShowOppModal(false)}
        onSave={async (oppData: OpportunityData) => {
          try {
            const url = oppData.id 
              ? `/api/control/${tenantId}/opportunities/${oppData.id}`
              : `/api/control/${tenantId}/opportunities`;
            const method = oppData.id ? 'PUT' : 'POST';

            const res = await fetch(url, {
              method,
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(oppData)
            });

            if (!res.ok) throw new Error('Error al guardar la oportunidad');

            showToast(oppData.id ? 'Oportunidad actualizada!' : 'Oportunidad comercial creada en el Pipeline!');
            fetchOpportunities();
          } catch (err: any) {
            showToast(err.message, 'error');
          }
        }}
        initialData={editingOpp}
        advisorsList={advisorsList}
      />
    </div>
  );
};
