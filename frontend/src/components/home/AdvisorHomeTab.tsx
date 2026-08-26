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
      case 'stage:prospecto': return 'Prospección';
      case 'stage:interesado': return 'Calificación';
      case 'stage:cotizado': return 'Propuesta / Cotizado';
      case 'stage:cita':
      case 'stage:cita_agendada': return 'Demostración Agendada';
      case 'stage:negociacion': return 'Negociación';
      case 'stage:ganado': return 'Cierre Ganado';
      case 'stage:perdido': return 'Venta Perdida';
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

      {/* Modern Page Header (UP Digital Solution Breadcrumb & Actions) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        paddingBottom: '0.25rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {tenantId.toUpperCase()}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>/</span>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Panel Diario del Asesor
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Control de actividades diarias: gestiona seguimientos pendientes, edita cotizaciones y cierra ventas de tu equipo.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <button
            onClick={() => onOpenChat()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 1.1rem',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--gradient-primary)',
              color: '#FFFFFF',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(142, 36, 208, 0.28)',
              transition: 'all 0.15s ease'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>forum</span>
            Ir a Bandeja En Vivo
          </button>
          <button
            onClick={() => onOpenKanban()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 1.1rem',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--surface-card)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-xs)',
              transition: 'all 0.15s ease'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--status-success-solid)' }}>view_kanban</span>
            Ver Pipeline CRM (Kanban)
          </button>
        </div>
      </div>

      {/* KPI Cards Grid with Theme Variables & Tabular Numerals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {/* KPI 1: Overdue */}
        <div
          onClick={() => setActiveSubTab('overdue')}
          style={{
            backgroundColor: 'var(--surface-card)',
            padding: '1.25rem',
            borderRadius: '16px',
            border: activeSubTab === 'overdue' ? '2px solid var(--status-danger-solid)' : '1px solid var(--border-subtle)',
            borderLeft: '4px solid var(--status-danger-solid)',
            boxShadow: activeSubTab === 'overdue' ? '0 8px 20px rgba(220, 38, 38, 0.15)' : 'var(--shadow-card)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--status-danger-solid)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Seguimientos Vencidos
            </span>
            <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', color: 'var(--status-danger-solid)' }}>warning</span>
          </div>
          <div className="tabular-nums" style={{ fontSize: '2.1rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '0.4rem', lineHeight: 1 }}>
            {kpis?.overdueCount ?? 0}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.35rem', fontWeight: 600 }}>
            Prospectos sin atención (+3 días)
          </div>
        </div>

        {/* KPI 2: Today */}
        <div
          onClick={() => setActiveSubTab('today')}
          style={{
            backgroundColor: 'var(--surface-card)',
            padding: '1.25rem',
            borderRadius: '16px',
            border: activeSubTab === 'today' ? '2px solid var(--status-warning-solid)' : '1px solid var(--border-subtle)',
            borderLeft: '4px solid var(--status-warning-solid)',
            boxShadow: activeSubTab === 'today' ? '0 8px 20px rgba(217, 119, 6, 0.15)' : 'var(--shadow-card)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--status-warning-solid)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Seguimientos para Hoy
            </span>
            <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', color: 'var(--status-warning-solid)' }}>today</span>
          </div>
          <div className="tabular-nums" style={{ fontSize: '2.1rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '0.4rem', lineHeight: 1 }}>
            {kpis?.todayCount ?? 0}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.35rem', fontWeight: 600 }}>
            Programados para el día de hoy
          </div>
        </div>

        {/* KPI 3: Upcoming */}
        <div
          onClick={() => setActiveSubTab('upcoming')}
          style={{
            backgroundColor: 'var(--surface-card)',
            padding: '1.25rem',
            borderRadius: '16px',
            border: activeSubTab === 'upcoming' ? '2px solid var(--color-accent)' : '1px solid var(--border-subtle)',
            borderLeft: '4px solid var(--color-accent)',
            boxShadow: activeSubTab === 'upcoming' ? '0 8px 20px rgba(37, 99, 235, 0.15)' : 'var(--shadow-card)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Próximos Seguimientos
            </span>
            <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', color: 'var(--color-accent)' }}>event_upcoming</span>
          </div>
          <div className="tabular-nums" style={{ fontSize: '2.1rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '0.4rem', lineHeight: 1 }}>
            {kpis?.upcomingCount ?? 0}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.35rem', fontWeight: 600 }}>
            Próximos 7 días
          </div>
        </div>

        {/* KPI 4: Total Value */}
        <div style={{
          backgroundColor: 'var(--surface-card)',
          padding: '1.25rem',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
          borderLeft: '4px solid var(--status-success-solid)',
          boxShadow: 'var(--shadow-card)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--status-success-solid)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Valor en Pipeline Activo
            </span>
            <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', color: 'var(--status-success-solid)' }}>attach_money</span>
          </div>
          <div className="tabular-nums" style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '0.4rem', lineHeight: 1 }}>
            ${(kpis?.totalActiveValue ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.35rem', fontWeight: 600 }}>
            {kpis?.activeCount ?? 0} oportunidades activas
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ padding: '1.5rem', backgroundColor: 'var(--surface-card)', borderRadius: '16px', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveSubTab('overdue')}
            style={{
              padding: '0.55rem 1.1rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeSubTab === 'overdue' ? 'var(--status-danger-bg)' : 'transparent',
              color: activeSubTab === 'overdue' ? 'var(--status-danger-text)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderBottom: activeSubTab === 'overdue' ? '2px solid var(--status-danger-solid)' : '2px solid transparent'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.05rem', color: activeSubTab === 'overdue' ? 'var(--status-danger-solid)' : 'inherit' }}>warning</span>
            Seguimientos Vencidos ({overdueOpps.length})
          </button>

          <button
            onClick={() => setActiveSubTab('today')}
            style={{
              padding: '0.55rem 1.1rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeSubTab === 'today' ? 'var(--status-warning-bg)' : 'transparent',
              color: activeSubTab === 'today' ? 'var(--status-warning-text)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderBottom: activeSubTab === 'today' ? '2px solid var(--status-warning-solid)' : '2px solid transparent'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.05rem', color: activeSubTab === 'today' ? 'var(--status-warning-solid)' : 'inherit' }}>today</span>
            Seguimientos de Hoy ({todayOpps.length})
          </button>

          <button
            onClick={() => setActiveSubTab('upcoming')}
            style={{
              padding: '0.55rem 1.1rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeSubTab === 'upcoming' ? 'var(--color-accent-subtle)' : 'transparent',
              color: activeSubTab === 'upcoming' ? 'var(--color-accent-text)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderBottom: activeSubTab === 'upcoming' ? '2px solid var(--color-accent)' : '2px solid transparent'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.05rem', color: activeSubTab === 'upcoming' ? 'var(--color-accent)' : 'inherit' }}>event_upcoming</span>
            Próximos Seguimientos ({upcomingOpps.length})
          </button>
        </div>

        {/* Action Table / Zero Inbox Renderer */}
        {(() => {
          const currentList = activeSubTab === 'overdue' ? overdueOpps : activeSubTab === 'today' ? todayOpps : upcomingOpps;

          if (loading) {
            return (
              <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite', color: 'var(--color-primary)' }}>progress_activity</span>
                  <span>Cargando datos de seguimiento...</span>
                </div>
              </div>
            );
          }

          if (currentList.length === 0) {
            return (
              <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', borderRadius: '12px', backgroundColor: 'var(--surface-subtle)', border: '1px dashed var(--border-subtle)' }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '60px',
                  height: '60px',
                  borderRadius: '20px',
                  backgroundColor: 'var(--status-success-bg)',
                  border: '1px solid var(--status-success-border)',
                  color: 'var(--status-success-solid)',
                  marginBottom: '1rem',
                  boxShadow: '0 0 16px rgba(0, 208, 132, 0.2)'
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '2.2rem' }}>task_alt</span>
                </div>
                <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  ¡Bandeja de Seguimientos al Día!
                </h3>
                <p style={{ margin: '0 auto 1.5rem auto', maxWidth: '440px', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  No tienes prospectos ni cotizaciones pendientes de atención en esta sección. Puedes consultar el Pipeline CRM o iniciar una nueva conversación.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => onOpenKanban()}
                    style={{
                      padding: '0.55rem 1.1rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'var(--gradient-primary)',
                      color: '#FFFFFF',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(142, 36, 208, 0.25)'
                    }}
                  >
                    Ver Pipeline CRM
                  </button>
                  <button
                    onClick={() => onOpenChat()}
                    style={{
                      padding: '0.55rem 1.1rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--surface-card)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Ir a Bandeja En Vivo
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-subtle)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.04em' }}>
                    <th style={{ padding: '0.85rem 1rem' }}>Cliente / Oportunidad</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Estado Alerta / Fecha</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Etapa CRM</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Monto USD</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Acciones de Seguimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {currentList.map((opp) => (
                    <tr key={opp.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{opp.contact_name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-primary)', fontWeight: 600 }}>{opp.title}</div>
                          {opp.contact_phone && (
                            <div style={{ fontSize: '0.72rem', color: '#64748B', fontFamily: 'monospace' }}>{opp.contact_phone}</div>
                          )}
                        </td>

                        <td style={{ padding: '0.85rem 1rem' }}>
                          {activeSubTab === 'overdue' ? (
                            <span className="badge-clean badge-danger">
                              {opp.diffDays || 3} días sin contacto
                            </span>
                          ) : activeSubTab === 'today' ? (
                            <span className="badge-clean badge-warning">
                              Programado Hoy
                            </span>
                          ) : (
                            <span className="badge-clean badge-info">
                              {opp.next_followup_date || 'Próximo'}
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#475569' }}>
                          {getStageLabel(opp.stage)}
                        </td>

                        <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#065F46', fontFamily: 'monospace' }}>
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
                                backgroundColor: '#2563EB',
                                color: '#FFFFFF',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                boxShadow: '0 1px 3px rgba(37, 99, 235, 0.2)'
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
                                border: '1px solid #A7F3D0',
                                backgroundColor: '#ECFDF5',
                                color: '#065F46',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem'
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
                    ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {/* MODAL 1: Registrar Seguimiento */}
      {followingUpOpp && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(16, 2, 29, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 999,
          padding: '1.5rem'
        }}>
          <div style={{ backgroundColor: 'var(--surface-card)', padding: '1.5rem', borderRadius: '16px', width: '100%', maxWidth: '550px', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 800 }}>
                  Registrar Seguimiento de Actividad
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Oportunidad: <strong style={{ color: 'var(--color-accent)' }}>{followingUpOpp.title}</strong> ({followingUpOpp.contact_name})
                </p>
              </div>
              <button onClick={() => setFollowingUpOpp(null)} style={{ border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleLogFollowupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div className="form-group">
                <label style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Nota del Seguimiento (Resultados de la llamada / chat / correo)
                </label>
                <textarea
                  value={followupNote}
                  onChange={(e) => setFollowupNote(e.target.value)}
                  placeholder="Se realizó llamada telefónica. El cliente solicitó ajuste de cotización agregando 2 laptops. Reagendado."
                  required
                  rows={3}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-subtle)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Próxima Fecha de Seguimiento</label>
                  <input
                    type="date"
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-subtle)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Actualizar Etapa del CRM</label>
                  <select
                    value={newStage}
                    onChange={(e) => setNewStage(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-subtle)', color: 'var(--text-primary)' }}
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
                  style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-subtle)', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingFollowup}
                  style={{ padding: '0.6rem 1.5rem', borderRadius: '8px', border: 'none', background: 'var(--gradient-primary)', color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}
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
          backgroundColor: 'rgba(16, 2, 29, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 999,
          padding: '1.5rem'
        }}>
          <div style={{ backgroundColor: 'var(--surface-card)', padding: '1.5rem', borderRadius: '16px', width: '100%', maxWidth: '580px', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 800 }}>
                  Editar Oportunidad CRM (ID: #{editingOpp.id})
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Modifica los detalles financieros y de seguimiento de este prospecto.
                </p>
              </div>
              <button onClick={() => setEditingOpp(null)} style={{ border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleSaveEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Nombre del Cliente</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-subtle)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Monto Oportunidad ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-subtle)', color: 'var(--text-primary)', fontFamily: 'monospace', fontWeight: 700 }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Título / Producto Requerido</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-subtle)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Etapa del Pipeline</label>
                  <select
                    value={editStage}
                    onChange={(e) => setEditStage(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-subtle)', color: 'var(--text-primary)' }}
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
                  <label style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Próxima Fecha Seguimiento</label>
                  <input
                    type="date"
                    value={editNextDate}
                    onChange={(e) => setEditNextDate(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-subtle)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Notas del Asesor</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-subtle)', color: 'var(--text-primary)', fontSize: '0.82rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setEditingOpp(null)}
                  style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-subtle)', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  style={{ padding: '0.6rem 1.5rem', borderRadius: '8px', border: 'none', background: 'var(--gradient-primary)', color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}
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
          backgroundColor: 'rgba(16, 2, 29, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 999,
          padding: '1.5rem'
        }}>
          <div style={{ backgroundColor: 'var(--surface-card)', padding: '1.5rem', borderRadius: '16px', width: '100%', maxWidth: '500px', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 800 }}>
                  Cerrar Oportunidad CRM
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Cliente: <strong style={{ color: 'var(--text-primary)' }}>{closingOpp.contact_name}</strong> - ${closingOpp.value.toLocaleString()} USD
                </p>
              </div>
              <button onClick={() => setClosingOpp(null)} style={{ border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleSaveCloseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div className="form-group">
                <label style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Estado Final de la Oportunidad</label>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.3rem' }}>
                  <button
                    type="button"
                    onClick={() => setCloseStatus('stage:ganado')}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: closeStatus === 'stage:ganado' ? '2px solid var(--status-success-solid)' : '1px solid var(--border-subtle)',
                      backgroundColor: closeStatus === 'stage:ganado' ? 'var(--status-success-bg)' : 'var(--surface-subtle)',
                      color: closeStatus === 'stage:ganado' ? 'var(--status-success-solid)' : 'var(--text-secondary)',
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
                      border: closeStatus === 'stage:perdido' ? '2px solid var(--status-danger-solid)' : '1px solid var(--border-subtle)',
                      backgroundColor: closeStatus === 'stage:perdido' ? 'var(--status-danger-bg)' : 'var(--surface-subtle)',
                      color: closeStatus === 'stage:perdido' ? 'var(--status-danger-solid)' : 'var(--text-secondary)',
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
                <label style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Motivo / Nota de Cierre</label>
                <textarea
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  placeholder={closeStatus === 'stage:ganado' ? "Cliente confirmó orden de compra e hizo depósito inicial." : "Cliente optó por competidor por tema de crédito."}
                  required
                  rows={3}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-subtle)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setClosingOpp(null)}
                  style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-subtle)', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
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
                    backgroundColor: closeStatus === 'stage:ganado' ? 'var(--status-success-solid)' : 'var(--status-danger-solid)',
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
