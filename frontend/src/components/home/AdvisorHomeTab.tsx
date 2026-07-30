import React, { useState, useEffect } from 'react';

interface AdvisorHomeTabProps {
  tenantId: string;
  token: string | null;
  role: string | null;
  onOpenChat: (conversationId?: string) => void;
  onOpenKanban: () => void;
}

interface OpportunityItem {
  id: number;
  contact_name: string;
  contact_phone?: string;
  title: string;
  value: number;
  stage: string;
  next_followup_date?: string;
  last_activity_at?: string;
  notes?: string;
  diffDays?: number;
}

interface DashboardKPIs {
  activeCount: number;
  totalActiveValue: number;
  wonCount: number;
  totalWonValue: number;
  overdueCount: number;
  todayCount: number;
  upcomingCount: number;
}

export const AdvisorHomeTab: React.FC<AdvisorHomeTabProps> = ({
  tenantId,
  token,
  role: _role,
  onOpenChat,
  onOpenKanban
}) => {
  const [kpis, setKpis] = useState<DashboardKPIs>({
    activeCount: 0,
    totalActiveValue: 0,
    wonCount: 0,
    totalWonValue: 0,
    overdueCount: 0,
    todayCount: 0,
    upcomingCount: 0
  });

  const [overdueOpps, setOverdueOpps] = useState<OpportunityItem[]>([]);
  const [todayOpps, setTodayOpps] = useState<OpportunityItem[]>([]);
  const [upcomingOpps, setUpcomingOpps] = useState<OpportunityItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Sub-Tab filter in Home
  const [activeSubTab, setActiveSubTab] = useState<'overdue' | 'today' | 'upcoming'>('today');

  // Modal 1: Follow-up Log Modal State (Continuar Seguimiento)
  const [followingUpOpp, setFollowingUpOpp] = useState<OpportunityItem | null>(null);
  const [followupNote, setFollowupNote] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [newStage, setNewStage] = useState('');
  const [submittingFollowup, setSubmittingFollowup] = useState(false);

  // Modal 2: Edit Opportunity Modal State (Editar)
  const [editingOpp, setEditingOpp] = useState<OpportunityItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editStage, setEditStage] = useState('');
  const [editNextDate, setEditNextDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Modal 3: Close Opportunity Modal State (Cerrar Ganada / Perdida)
  const [closingOpp, setClosingOpp] = useState<OpportunityItem | null>(null);
  const [closeStatus, setCloseStatus] = useState<'stage:ganado' | 'stage:perdido'>('stage:ganado');
  const [closeReason, setCloseReason] = useState('');
  const [savingClose, setSavingClose] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/control/${tenantId}/advisor-dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setKpis(data.kpis);
        setOverdueOpps(data.overdue || []);
        setTodayOpps(data.today || []);
        setUpcomingOpps(data.upcoming || []);
      }
    } catch (e) {
      console.error('Error fetching advisor dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [tenantId, token]);

  // Handler: Continuar Seguimiento
  const handleOpenFollowupModal = (opp: OpportunityItem) => {
    setFollowingUpOpp(opp);
    setFollowupNote('');
    setNextDate(new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0]);
    setNewStage(opp.stage);
  };

  const handleLogFollowupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followingUpOpp || !followupNote.trim()) return;

    setSubmittingFollowup(true);
    try {
      const res = await fetch(`/api/control/${tenantId}/opportunities/${followingUpOpp.id}/followup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          note: followupNote.trim(),
          next_followup_date: nextDate || null,
          stage: newStage || null
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error registrando seguimiento');

      showToast(`Seguimiento registrado con éxito para ${followingUpOpp.contact_name}`);
      setFollowingUpOpp(null);
      fetchDashboardData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmittingFollowup(false);
    }
  };

  // Handler: Editar Oportunidad
  const handleOpenEditModal = (opp: OpportunityItem) => {
    setEditingOpp(opp);
    setEditName(opp.contact_name || '');
    setEditTitle(opp.title || '');
    setEditValue(String(opp.value || 0));
    setEditStage(opp.stage || 'stage:prospecto');
    setEditNextDate(opp.next_followup_date ? new Date(opp.next_followup_date).toISOString().split('T')[0] : '');
    setEditNotes(opp.notes || '');
  };

  const handleSaveEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOpp) return;

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/control/${tenantId}/opportunities/${editingOpp.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          contact_name: editName,
          title: editTitle,
          value: parseFloat(editValue) || 0,
          stage: editStage,
          next_followup_date: editNextDate || null,
          notes: editNotes
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error actualizando oportunidad');

      showToast(`Oportunidad de ${editName} actualizada correctamente.`);
      setEditingOpp(null);
      fetchDashboardData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  // Handler: Cerrar Oportunidad (Ganada / Perdida)
  const handleOpenCloseModal = (opp: OpportunityItem) => {
    setClosingOpp(opp);
    setCloseStatus('stage:ganado');
    setCloseReason('');
  };

  const handleSaveCloseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingOpp) return;

    setSavingClose(true);
    try {
      const notePrefix = closeStatus === 'stage:ganado' ? '[VENTA GANADA]' : '[VENTA PERDIDA]';
      const updatedNotes = closingOpp.notes 
        ? `${closingOpp.notes}\n${notePrefix} ${closeReason}` 
        : `${notePrefix} ${closeReason}`;

      const res = await fetch(`/api/control/${tenantId}/opportunities/${closingOpp.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          stage: closeStatus,
          notes: updatedNotes
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cerrar la oportunidad');

      showToast(`Oportunidad cerrada como ${closeStatus === 'stage:ganado' ? 'GANADA' : 'PERDIDA'}.`);
      setClosingOpp(null);
      fetchDashboardData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingClose(false);
    }
  };

  const getStageLabel = (stageId: string) => {
    switch (stageId) {
      case 'stage:prospecto': return '1. Prospecto / Lead';
      case 'stage:interesado': return '2. Interesado';
      case 'stage:cotizado': return '3. Cotización Enviada';
      case 'stage:cita': return '4. Cita / Demo';
      case 'stage:negociacion': return '5. En Negociación';
      case 'stage:ganado': return '6. Venta Ganada';
      case 'stage:perdido': return '7. Venta Perdida';
      default: return stageId;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.2s ease-out' }}>
      {/* Toast alert */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
          color: '#ffffff',
          padding: '0.75rem 1.25rem',
          borderRadius: '8px',
          fontWeight: 800,
          fontSize: '0.88rem',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(11, 43, 76, 0.15)'
        }}>
          {toast.text}
        </div>
      )}

      {/* Header Banner */}
      <div style={{
        backgroundColor: '#0b2b4c',
        color: '#ffffff',
        padding: '1.5rem',
        borderRadius: '16px',
        boxShadow: '0 10px 25px rgba(11, 43, 76, 0.2)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.5rem', color: '#60a5fa' }}>home</span>
            Inicio & Panel de Seguimiento Diario del Asesor ({tenantId.toUpperCase()})
          </h2>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.88rem', color: '#93c5fd', lineHeight: 1.4 }}>
            Control de actividades diarias: gestiona seguimientos pendientes, edita cotizaciones o cierra ventas de tu equipo.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            onClick={() => onOpenChat()}
            className="btn-primary"
            style={{ backgroundColor: '#2563eb', padding: '0.6rem 1.1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>forum</span>
            Ir a Bandeja En Vivo
          </button>
          <button
            onClick={() => onOpenKanban()}
            className="btn-primary"
            style={{ backgroundColor: '#10b981', padding: '0.6rem 1.1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>view_kanban</span>
            Ver Pipeline CRM (Kanban)
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {/* KPI 1: Overdue */}
        <div
          onClick={() => setActiveSubTab('overdue')}
          style={{
            backgroundColor: '#ffffff',
            padding: '1.25rem',
            borderRadius: '12px',
            border: '2px solid',
            borderColor: activeSubTab === 'overdue' ? '#ef4444' : '#fecaca',
            boxShadow: activeSubTab === 'overdue' ? '0 4px 15px rgba(239, 68, 68, 0.2)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>warning</span>
            Seguimientos Vencidos
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#991b1b', marginTop: '0.4rem' }}>
            {kpis.overdueCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#7f1d1d', marginTop: '0.2rem', fontWeight: 600 }}>
            Prospectos sin atención (+3 días)
          </div>
        </div>

        {/* KPI 2: Today */}
        <div
          onClick={() => setActiveSubTab('today')}
          style={{
            backgroundColor: '#ffffff',
            padding: '1.25rem',
            borderRadius: '12px',
            border: '2px solid',
            borderColor: activeSubTab === 'today' ? '#f59e0b' : '#fef3c7',
            boxShadow: activeSubTab === 'today' ? '0 4px 15px rgba(245, 158, 11, 0.2)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>today</span>
            Seguimientos para Hoy
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#b45309', marginTop: '0.4rem' }}>
            {kpis.todayCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#92400e', marginTop: '0.2rem', fontWeight: 600 }}>
            Programados para el día de hoy
          </div>
        </div>

        {/* KPI 3: Upcoming */}
        <div
          onClick={() => setActiveSubTab('upcoming')}
          style={{
            backgroundColor: '#ffffff',
            padding: '1.25rem',
            borderRadius: '12px',
            border: '2px solid',
            borderColor: activeSubTab === 'upcoming' ? '#2563eb' : '#bfdbfe',
            boxShadow: activeSubTab === 'upcoming' ? '0 4px 15px rgba(37, 99, 235, 0.2)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>event_upcoming</span>
            Próximos Seguimientos
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#1e40af', marginTop: '0.4rem' }}>
            {kpis.upcomingCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#1e3a8a', marginTop: '0.2rem', fontWeight: 600 }}>
            Próximos 7 días
          </div>
        </div>

        {/* KPI 4: Total Value */}
        <div style={{
          backgroundColor: '#ffffff',
          padding: '1.25rem',
          borderRadius: '12px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>attach_money</span>
            Valor en Pipeline Activo
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#065f46', marginTop: '0.4rem' }}>
            ${kpis.totalActiveValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#047857', marginTop: '0.2rem', fontWeight: 600 }}>
            {kpis.activeCount} oportunidades activas
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="glass-card" style={{ padding: '1.5rem', backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveSubTab('overdue')}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeSubTab === 'overdue' ? '#fef2f2' : 'transparent',
              color: activeSubTab === 'overdue' ? '#ef4444' : '#64748b',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderBottom: activeSubTab === 'overdue' ? '3px solid #ef4444' : '3px solid transparent'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>warning</span>
            Seguimientos Vencidos / Retrasados ({overdueOpps.length})
          </button>

          <button
            onClick={() => setActiveSubTab('today')}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeSubTab === 'today' ? '#fffbebf' : 'transparent',
              color: activeSubTab === 'today' ? '#d97706' : '#64748b',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderBottom: activeSubTab === 'today' ? '3px solid #f59e0b' : '3px solid transparent'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>today</span>
            Seguimientos de Hoy ({todayOpps.length})
          </button>

          <button
            onClick={() => setActiveSubTab('upcoming')}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeSubTab === 'upcoming' ? '#eff6ff' : 'transparent',
              color: activeSubTab === 'upcoming' ? '#2563eb' : '#64748b',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderBottom: activeSubTab === 'upcoming' ? '3px solid #2563eb' : '3px solid transparent'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>event_upcoming</span>
            Próximos Seguimientos ({upcomingOpps.length})
          </button>
        </div>

        {/* Action Table Renderer */}
        {(() => {
          const currentList = activeSubTab === 'overdue' ? overdueOpps : activeSubTab === 'today' ? todayOpps : upcomingOpps;

          return (
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', color: '#0b2b4c' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textTransform: 'uppercase', fontSize: '0.72rem' }}>
                    <th style={{ padding: '0.85rem 1rem' }}>Cliente / Oportunidad</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Estado Alerta / Fecha</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Etapa CRM</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Monto USD</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Acciones de Seguimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>Cargando datos de seguimiento...</td>
                    </tr>
                  ) : currentList.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '2.5rem', textAlign: 'center', color: '#059669', fontWeight: 700 }}>
                        No hay registros pendientes en esta sección.
                      </td>
                    </tr>
                  ) : (
                    currentList.map((opp) => (
                      <tr key={opp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ fontWeight: 800, color: '#0b2b4c' }}>{opp.contact_name}</div>
                          <div style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 600 }}>{opp.title}</div>
                          {opp.contact_phone && (
                            <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>{opp.contact_phone}</div>
                          )}
                        </td>

                        <td style={{ padding: '0.85rem 1rem' }}>
                          {activeSubTab === 'overdue' ? (
                            <span style={{ padding: '0.25rem 0.6rem', borderRadius: '12px', backgroundColor: '#fef2f2', color: '#ef4444', fontWeight: 800, fontSize: '0.75rem', border: '1px solid #fca5a5' }}>
                              {opp.diffDays || 3} días sin contacto
                            </span>
                          ) : activeSubTab === 'today' ? (
                            <span style={{ padding: '0.2rem 0.55rem', borderRadius: '8px', backgroundColor: '#fef3c7', color: '#d97706', fontWeight: 800, fontSize: '0.75rem' }}>
                              Programado Hoy
                            </span>
                          ) : (
                            <span style={{ fontWeight: 700, color: '#2563eb', fontSize: '0.78rem' }}>
                              {opp.next_followup_date || 'Próximo'}
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#475569' }}>
                          {getStageLabel(opp.stage)}
                        </td>

                        <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#059669', fontFamily: 'monospace' }}>
                          ${(parseFloat(String(opp.value)) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>

                        {/* Four Action Buttons: Chatear, Seguimiento, Editar, Cerrar */}
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => onOpenChat()}
                              title="Abrir Chat en Vivo"
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: '#2563eb',
                                color: '#ffffff',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.2rem'
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>forum</span>
                              Chatear
                            </button>

                            <button
                              onClick={() => handleOpenFollowupModal(opp)}
                              title="Continuar Seguimiento y Agendar Fecha"
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: '6px',
                                border: '1px solid #10b981',
                                backgroundColor: '#ecfdf5',
                                color: '#059669',
                                fontWeight: 800,
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.2rem'
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>event</span>
                              Seguimiento
                            </button>

                            <button
                              onClick={() => handleOpenEditModal(opp)}
                              title="Editar Oportunidad"
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                color: '#0b2b4c',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.2rem'
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>edit</span>
                              Editar
                            </button>

                            <button
                              onClick={() => handleOpenCloseModal(opp)}
                              title="Cerrar Oportunidad (Ganada o Perdida)"
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: '6px',
                                border: '1px solid #fca5a5',
                                backgroundColor: '#fff1f2',
                                color: '#be123c',
                                fontWeight: 800,
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.2rem'
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>task_alt</span>
                              Cerrar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {/* MODAL 1: Continuar Seguimiento */}
      {followingUpOpp && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(11, 43, 76, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 999,
          padding: '1.5rem'
        }}>
          <div style={{ backgroundColor: '#ffffff', padding: '1.5rem', borderRadius: '16px', width: '100%', maxWidth: '550px', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#0b2b4c', fontSize: '1.1rem', fontWeight: 800 }}>
                  Registrar Seguimiento de Actividad
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Oportunidad: <strong>{followingUpOpp.title}</strong> ({followingUpOpp.contact_name})
                </p>
              </div>
              <button onClick={() => setFollowingUpOpp(null)} style={{ border: 'none', background: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleLogFollowupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div className="form-group">
                <label style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0b2b4c' }}>
                  Nota del Seguimiento (Resultados de la llamada / chat / correo)
                </label>
                <textarea
                  value={followupNote}
                  onChange={(e) => setFollowupNote(e.target.value)}
                  placeholder="Se realizó llamada telefónica. El cliente solicitó ajuste de cotización agregando 2 laptops. Reagendado."
                  required
                  rows={3}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0b2b4c' }}>Próxima Fecha de Seguimiento</label>
                  <input
                    type="date"
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0b2b4c' }}>Actualizar Etapa del CRM</label>
                  <select
                    value={newStage}
                    onChange={(e) => setNewStage(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="stage:prospecto">1. Prospecto / Lead IA</option>
                    <option value="stage:interesado">2. Interesado en Producto</option>
                    <option value="stage:cotizado">3. Cotización Enviada</option>
                    <option value="stage:cita">4. Cita / Demo Agendada</option>
                    <option value="stage:negociacion">5. En Negociación</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setFollowingUpOpp(null)}
                  style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingFollowup}
                  style={{ padding: '0.6rem 1.5rem', borderRadius: '8px', border: 'none', backgroundColor: '#10b981', color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  {submittingFollowup ? 'Guardando...' : 'Guardar Seguimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Editar Oportunidad */}
      {editingOpp && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(11, 43, 76, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 999,
          padding: '1.5rem'
        }}>
          <div style={{ backgroundColor: '#ffffff', padding: '1.5rem', borderRadius: '16px', width: '100%', maxWidth: '580px', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#0b2b4c', fontSize: '1.1rem', fontWeight: 800 }}>
                  Editar Oportunidad CRM (ID: #{editingOpp.id})
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Modifica los detalles financieros y de seguimiento de este prospecto.
                </p>
              </div>
              <button onClick={() => setEditingOpp(null)} style={{ border: 'none', background: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleSaveEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0b2b4c' }}>Nombre del Cliente</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0b2b4c' }}>Monto Oportunidad ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontWeight: 700 }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0b2b4c' }}>Título / Producto Requerido</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0b2b4c' }}>Etapa del Pipeline</label>
                  <select
                    value={editStage}
                    onChange={(e) => setEditStage(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="stage:prospecto">1. Prospecto / Lead IA</option>
                    <option value="stage:interesado">2. Interesado en Producto</option>
                    <option value="stage:cotizado">3. Cotización Enviada</option>
                    <option value="stage:cita">4. Cita / Demo Agendada</option>
                    <option value="stage:negociacion">5. En Negociación</option>
                    <option value="stage:ganado">6. Venta Ganada</option>
                    <option value="stage:perdido">7. Venta Perdida</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0b2b4c' }}>Próxima Fecha Seguimiento</label>
                  <input
                    type="date"
                    value={editNextDate}
                    onChange={(e) => setEditNextDate(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0b2b4c' }}>Notas del Asesor</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setEditingOpp(null)}
                  style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  style={{ padding: '0.6rem 1.5rem', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  {savingEdit ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Cerrar Oportunidad (Ganada / Perdida) */}
      {closingOpp && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(11, 43, 76, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 999,
          padding: '1.5rem'
        }}>
          <div style={{ backgroundColor: '#ffffff', padding: '1.5rem', borderRadius: '16px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#0b2b4c', fontSize: '1.1rem', fontWeight: 800 }}>
                  Cerrar Oportunidad CRM
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Cliente: <strong>{closingOpp.contact_name}</strong> - ${closingOpp.value.toLocaleString()} USD
                </p>
              </div>
              <button onClick={() => setClosingOpp(null)} style={{ border: 'none', background: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleSaveCloseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div className="form-group">
                <label style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0b2b4c' }}>Estado Final de la Oportunidad</label>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.3rem' }}>
                  <button
                    type="button"
                    onClick={() => setCloseStatus('stage:ganado')}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: closeStatus === 'stage:ganado' ? '2px solid #10b981' : '1px solid #cbd5e1',
                      backgroundColor: closeStatus === 'stage:ganado' ? '#ecfdf5' : '#ffffff',
                      color: closeStatus === 'stage:ganado' ? '#047857' : '#475569',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      cursor: 'pointer'
                    }}
                  >
                    Venta Ganada
                  </button>

                  <button
                    type="button"
                    onClick={() => setCloseStatus('stage:perdido')}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: closeStatus === 'stage:perdido' ? '2px solid #ef4444' : '1px solid #cbd5e1',
                      backgroundColor: closeStatus === 'stage:perdido' ? '#fef2f2' : '#ffffff',
                      color: closeStatus === 'stage:perdido' ? '#b91c1c' : '#475569',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      cursor: 'pointer'
                    }}
                  >
                    Venta Perdida
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0b2b4c' }}>Motivo / Nota de Cierre</label>
                <textarea
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  placeholder={closeStatus === 'stage:ganado' ? "Cliente confirmó orden de compra e hizo depósito inicial." : "Cliente optó por competidor por tema de crédito."}
                  required
                  rows={3}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setClosingOpp(null)}
                  style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingClose}
                  style={{
                    padding: '0.6rem 1.5rem',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: closeStatus === 'stage:ganado' ? '#10b981' : '#ef4444',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  {savingClose ? 'Procesando...' : 'Confirmar Cierre'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
