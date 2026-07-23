import React, { useState, useEffect } from 'react';

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
  { id: 'stage:ganado', name: '6. Venta Ganada 🎉', color: '#059669', bg: '#ecfdf5' },
  { id: 'stage:perdido', name: '7. Venta Perdida ❌', color: '#dc2626', bg: '#fef2f2' }
];

const LOST_REASONS = [
  'Precio Alto / Fuera de Presupuesto',
  'Sin Stock de Producto / Inexistente',
  'Tiempo de Entrega Largo',
  'Compró con Competidor',
  'Proyecto Cancelado / Pospuesto',
  'Otro Motivo'
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ tenantId, token, role, onOpenChat }) => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // New Opportunity Modal State
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newValue, setNewValue] = useState<number>(1000);
  const [newCurrency, setNewCurrency] = useState<'USD' | 'NIO'>('USD');
  const [newStage, setNewStage] = useState('stage:prospecto');
  const [newNextType, setNewNextType] = useState('llamada');
  const [newNextDate, setNewNextDate] = useState('');
  const [newNextNotes, setNewNextNotes] = useState('');

  // Lost Opportunity Modal State
  const [showLostModal, setShowLostModal] = useState(false);
  const [targetOppForLost, setTargetOppForLost] = useState<Opportunity | null>(null);
  const [selectedLostReason, setSelectedLostReason] = useState(LOST_REASONS[0]);
  const [lostNotesText, setLostNotesText] = useState('');

  // Next Action Modal State
  const [showActionModal, setShowActionModal] = useState(false);
  const [targetOppForAction, setTargetOppForAction] = useState<Opportunity | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

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

  const handleCreateOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContactName.trim()) {
      showToast('Ingresa el título y nombre del cliente.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/control/${tenantId}/opportunities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          contact_name: newContactName,
          contact_phone: newContactPhone,
          title: newTitle,
          value: newValue,
          currency: newCurrency,
          stage: newStage,
          next_action_type: newNextType,
          next_action_date: newNextDate ? newNextDate : null,
          next_action_notes: newNextNotes
        })
      });

      if (!res.ok) throw new Error('Error creando oportunidad comercial');

      setShowNewModal(false);
      setNewTitle('');
      setNewContactName('');
      setNewContactPhone('');
      showToast('Oportunidad Comercial creada con éxito!');
      fetchOpportunities();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleStageChangeSelect = (opp: Opportunity, targetStage: string) => {
    if (role === 'readonly') {
      showToast('Permisos de sólo lectura.', 'error');
      return;
    }

    if (targetStage === 'stage:perdido') {
      setTargetOppForLost(opp);
      setSelectedLostReason(LOST_REASONS[0]);
      setLostNotesText('');
      setShowLostModal(true);
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

  const handleSaveLostReason = async () => {
    if (!targetOppForLost) return;
    await updateOppStage(targetOppForLost.id, 'stage:perdido', selectedLostReason, lostNotesText);
    setShowLostModal(false);
    setTargetOppForLost(null);
  };

  const handleSaveNextAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetOppForAction) return;

    try {
      const res = await fetch(`/api/control/${tenantId}/opportunities/${targetOppForAction.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          next_action_type: newNextType,
          next_action_date: newNextDate ? newNextDate : null,
          next_action_notes: newNextNotes
        })
      });

      if (!res.ok) throw new Error('Error guardando próxima acción');

      // Log activity
      await fetch(`/api/control/${tenantId}/opportunities/${targetOppForAction.id}/activities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          activity_type: newNextType,
          description: `Próxima acción programada (${newNextType}): ${newNextNotes}`
        })
      });

      setShowActionModal(false);
      setTargetOppForAction(null);
      showToast('Próxima acción registrada correctamente!');
      fetchOpportunities();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
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

      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0b2b4c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📌 Tablero Kanban - Pipeline de Oportunidades CRM
          </h2>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            Gestión individual de Oportunidades Comerciales, valores monetarios y seguimiento de Próximas Acciones.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setShowNewModal(true)}
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
            ➕ Nueva Oportunidad
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
            🔄 Actualizar
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
                        style={{
                          padding: '0.85rem',
                          backgroundColor: '#ffffff',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.45rem',
                          boxShadow: '0 2px 6px rgba(11, 43, 76, 0.04)',
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
                          👤 {opp.contact_name} {opp.contact_phone && `(${opp.contact_phone})`}
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
                            <span>
                              {opp.next_action_type === 'llamada' && '📞 Llamada'}
                              {opp.next_action_type === 'correo' && '✉️ Correo'}
                              {opp.next_action_type === 'visita' && '🚗 Visita'}
                              {opp.next_action_type === 'demo' && '💻 Demo'}
                              : {opp.next_action_notes || 'Pendiente'}
                            </span>
                            <button
                              onClick={() => {
                                setTargetOppForAction(opp);
                                setNewNextType(opp.next_action_type || 'llamada');
                                setNewNextNotes(opp.next_action_notes || '');
                                setShowActionModal(true);
                              }}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.7rem', color: '#0284c7', fontWeight: 800 }}
                              title="Editar Próxima Acción"
                            >
                              ✏️
                            </button>
                          </div>
                        )}

                        {/* Action Bar */}
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                          <select
                            value={opp.stage}
                            onChange={(e) => handleStageChangeSelect(opp, e.target.value)}
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
                            onClick={() => {
                              setTargetOppForAction(opp);
                              setNewNextType('llamada');
                              setNewNextNotes('');
                              setShowActionModal(true);
                            }}
                            style={{
                              padding: '0.35rem 0.6rem',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#f8fafc',
                              color: '#0b2b4c',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                            title="Programar Próxima Acción"
                          >
                            📅
                          </button>

                          {opp.conversation_id && onOpenChat && (
                            <button
                              onClick={() => onOpenChat(parseInt(opp.conversation_id!))}
                              style={{
                                padding: '0.35rem 0.6rem',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: '#2563eb',
                                color: '#ffffff',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                              title="Ir al Chat de WhatsApp"
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

      {/* NEW OPPORTUNITY MODAL */}
      {showNewModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1500
        }}>
          <form onSubmit={handleCreateOpportunity} style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            padding: '1.75rem',
            width: '450px',
            maxWidth: '90%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <h3 style={{ margin: 0, color: '#0b2b4c', fontSize: '1.1rem', fontWeight: 800 }}>
              ➕ Crear Nueva Oportunidad Comercial
            </h3>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>Título de la Oportunidad</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ej: Licitación 10 Laptops Dell Latitude"
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box', marginTop: '0.2rem' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>Nombre del Cliente</label>
                <input
                  type="text"
                  required
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box', marginTop: '0.2rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>Teléfono WhatsApp</label>
                <input
                  type="text"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  placeholder="+505 8888 5707"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box', marginTop: '0.2rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>Valor Estimado</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={newValue}
                  onChange={(e) => setNewValue(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box', marginTop: '0.2rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>Moneda</label>
                <select
                  value={newCurrency}
                  onChange={(e) => setNewCurrency(e.target.value as 'USD' | 'NIO')}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box', marginTop: '0.2rem' }}
                >
                  <option value="USD">USD ($)</option>
                  <option value="NIO">NIO (C$)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>Etapa Inicial</label>
                <select
                  value={newStage}
                  onChange={(e) => setNewStage(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box', marginTop: '0.2rem' }}
                >
                  {STAGES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>Próxima Acción (Seguimiento)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem', marginTop: '0.2rem' }}>
                <select
                  value={newNextType}
                  onChange={(e) => setNewNextType(e.target.value)}
                  style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                >
                  <option value="llamada">📞 Llamada</option>
                  <option value="correo">✉️ Correo</option>
                  <option value="visita">🚗 Visita</option>
                  <option value="demo">💻 Demo</option>
                </select>
                <input
                  type="text"
                  value={newNextNotes}
                  onChange={(e) => setNewNextNotes(e.target.value)}
                  placeholder="Notas de la próxima acción..."
                  style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={{ padding: '0.5rem 1.2rem', borderRadius: '6px', border: 'none', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
              >
                Guardar Oportunidad
              </button>
            </div>
          </form>
        </div>
      )}

      {/* LOST OPPORTUNITY MODAL */}
      {showLostModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1500
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            padding: '1.75rem',
            width: '420px',
            maxWidth: '90%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <h3 style={{ margin: 0, color: '#dc2626', fontSize: '1.1rem', fontWeight: 800 }}>
              ❌ Registrar Motivo de Pérdida de la Oportunidad
            </h3>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
              Oportunidad: <strong>{targetOppForLost?.title}</strong>
            </p>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0b2b4c' }}>Motivo Principal (Normalizado)</label>
              <select
                value={selectedLostReason}
                onChange={(e) => setSelectedLostReason(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', marginTop: '0.2rem' }}
              >
                {LOST_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0b2b4c' }}>Notas Explicativas Adicionales</label>
              <textarea
                rows={3}
                value={lostNotesText}
                onChange={(e) => setLostNotesText(e.target.value)}
                placeholder="Detalla el motivo (ej: El cliente decidió comprar con la competencia por C$1,200 menos)..."
                style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box', marginTop: '0.2rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => { setShowLostModal(false); setTargetOppForLost(null); }}
                style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveLostReason}
                style={{ padding: '0.5rem 1.2rem', borderRadius: '6px', border: 'none', backgroundColor: '#dc2626', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
              >
                Confirmar Venta Perdida
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEXT ACTION MODAL */}
      {showActionModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1500
        }}>
          <form onSubmit={handleSaveNextAction} style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            padding: '1.75rem',
            width: '420px',
            maxWidth: '90%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <h3 style={{ margin: 0, color: '#0284c7', fontSize: '1.1rem', fontWeight: 800 }}>
              📅 Programar Próxima Acción de Seguimiento
            </h3>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0b2b4c' }}>Tipo de Acción</label>
              <select
                value={newNextType}
                onChange={(e) => setNewNextType(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', marginTop: '0.2rem' }}
              >
                <option value="llamada">📞 Llamada Telefónica</option>
                <option value="correo">✉️ Correo Electrónico</option>
                <option value="visita">🚗 Visita Presencial al Cliente</option>
                <option value="demo">💻 Demostración de Producto</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0b2b4c' }}>Fecha y Hora Programada</label>
              <input
                type="datetime-local"
                value={newNextDate}
                onChange={(e) => setNewNextDate(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box', marginTop: '0.2rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0b2b4c' }}>Notas del Seguimiento</label>
              <textarea
                rows={3}
                value={newNextNotes}
                onChange={(e) => setNewNextNotes(e.target.value)}
                placeholder="Detalla lo que debes tratar con el cliente..."
                style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box', marginTop: '0.2rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => { setShowActionModal(false); setTargetOppForAction(null); }}
                style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={{ padding: '0.5rem 1.2rem', borderRadius: '6px', border: 'none', backgroundColor: '#0284c7', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
              >
                Guardar Seguimiento
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
