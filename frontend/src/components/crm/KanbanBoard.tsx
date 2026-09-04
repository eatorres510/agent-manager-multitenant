import React, { useState, useEffect, useRef } from 'react';
import { OpportunityModal, type OpportunityData } from './OpportunityModal';

interface KanbanBoardProps {
  tenantId: string;
  token: string | null;
  role: string | null;
  onOpenChat?: (convId: number | string) => void;
  defaultPipeline?: 'b2c' | 'b2b';
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
  pipeline_type?: 'b2c' | 'b2b';
  company_id?: number;
  company_name?: string;
  company_display_name?: string;
  company_ruc?: string;
  company_industry?: string;
  company_contact_id?: number;
  company_contact_name?: string;
  company_contact_role?: string;
  company_contact_phone?: string;
  company_contact_email?: string;
  credit_terms?: string;
  target_closing_date?: string;
  meta_ad_id?: string;
  meta_ad_headline?: string;
  meta_campaign_name?: string;
  invoiced_amount?: number;
  invoice_number?: string;
  sale_confirmed_at?: string;
  sale_items_summary?: string;
  created_at: string;
  updated_at: string;
}

const B2C_STAGES = [
  { id: 'stage:prospecto', name: 'Prospección', color: '#2563eb', bg: '#eff6ff' },
  { id: 'stage:interesado', name: 'Calificación', color: '#7c3aed', bg: '#f5f3ff' },
  { id: 'stage:cotizado', name: 'Propuesta / Cotizado', color: '#d97706', bg: '#fffbeb' },
  { id: 'stage:cita_agendada', name: 'Demostración Agendada', color: '#0284c7', bg: '#f0f9ff' },
  { id: 'stage:negociacion', name: 'Negociación', color: '#ea580c', bg: '#fff7ed' },
  { id: 'stage:ganado', name: 'Cierre Ganado', color: '#059669', bg: '#ecfdf5' },
  { id: 'stage:perdido', name: 'Venta Perdida', color: '#dc2626', bg: '#fef2f2' },
];

const B2B_STAGES = [
  { id: 'stage:b2b_prospecto', name: 'Cuenta Prospectada', color: '#2563eb', bg: '#eff6ff' },
  { id: 'stage:b2b_calificacion', name: 'Calificación (BANT)', color: '#7c3aed', bg: '#f5f3ff' },
  { id: 'stage:b2b_levantamiento', name: 'Levantamiento Técnico', color: '#0284c7', bg: '#f0f9ff' },
  { id: 'stage:b2b_propuesta', name: 'Propuesta / Proforma', color: '#d97706', bg: '#fffbeb' },
  { id: 'stage:b2b_comite', name: 'Revisión Comité', color: '#8b5cf6', bg: '#f5f3ff' },
  { id: 'stage:b2b_negociacion', name: 'Negociación', color: '#ea580c', bg: '#fff7ed' },
  { id: 'stage:b2b_ganado', name: 'Cierre Ganado (OC)', color: '#059669', bg: '#ecfdf5' },
  { id: 'stage:b2b_perdido', name: 'Venta Perdida', color: '#dc2626', bg: '#fef2f2' },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ tenantId, token, role, onOpenChat, defaultPipeline = 'b2c' }) => {
  const [activePipeline, setActivePipeline] = useState<'b2c' | 'b2b'>(defaultPipeline);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [advisorsList, setAdvisorsList] = useState<{ id?: number; name: string; email: string; role?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // View Mode: fitToScreen (auto compact) vs scrollable
  const [fitToScreen, setFitToScreen] = useState<boolean>(true);

  // Unified Opportunity Modal State
  const [showOppModal, setShowOppModal] = useState(false);
  const [editingOpp, setEditingOpp] = useState<Partial<OpportunityData> | null>(null);

  // Drag & Drop State
  const [draggedOppId, setDraggedOppId] = useState<number | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
    const interval = setInterval(fetchOpportunities, 10000);
    return () => clearInterval(interval);
  }, [tenantId]);

  const currentStages = activePipeline === 'b2b' ? B2B_STAGES : B2C_STAGES;

  // Filter opportunities belonging to current pipeline
  const currentPipelineOpps = opportunities.filter(o => {
    const isB2B = o.pipeline_type === 'b2b' || (o.stage && o.stage.startsWith('stage:b2b_'));
    return activePipeline === 'b2b' ? isB2B : !isB2B;
  });

  const handleStageChangeSelect = (opp: Opportunity, targetStage: string) => {
    if (role === 'readonly') {
      showToast('Permisos de sólo lectura.', 'error');
      return;
    }

    if (targetStage === 'stage:perdido' || targetStage === 'stage:b2b_perdido') {
      setEditingOpp({ ...opp, stage: targetStage });
      setShowOppModal(true);
    } else if (targetStage === 'stage:ganado' || targetStage === 'stage:b2b_ganado') {
      setEditingOpp({ ...opp, stage: targetStage });
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
      showToast('¡Oportunidad actualizada en el Pipeline CRM!');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleOpenOutboundWhatsApp = async (opp: Opportunity) => {
    const targetPhone = opp.company_contact_phone || opp.contact_phone;
    const targetName = opp.company_contact_name || opp.contact_name;

    if (!targetPhone) {
      alert('Esta oportunidad no cuenta con un número de WhatsApp registrado.');
      return;
    }

    if (opp.conversation_id && onOpenChat) {
      onOpenChat(parseInt(opp.conversation_id));
      return;
    }

    try {
      showToast(`Conectando con WhatsApp de ${targetName}...`);
      const res = await fetch(`/api/control/${tenantId}/outbound-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          phone: targetPhone,
          name: `${targetName} ${opp.company_display_name ? `(${opp.company_display_name})` : ''}`,
          company_id: opp.company_id
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error iniciando chat');

      showToast(`¡Chat abierto para ${targetName}! Redirigiendo...`);
      if (onOpenChat && data.display_id) {
        onOpenChat(data.display_id);
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const totalActiveValue = currentPipelineOpps
    .filter(o => !o.stage.includes('perdido'))
    .reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);

  return (
    <div style={{
      animation: 'fadeIn 0.25s ease-out',
      height: 'calc(100vh - 85px)',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--surface-card)',
      borderRadius: '16px',
      padding: '0.85rem 1rem',
      boxSizing: 'border-box',
      overflow: 'hidden',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-subtle)',
      boxShadow: 'var(--shadow-card)',
      fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif'
    }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          padding: '0.75rem 1.25rem',
          backgroundColor: toast.type === 'success' ? 'var(--status-success-solid)' : 'var(--status-danger-solid)',
          color: '#fff',
          borderRadius: '8px',
          fontWeight: 'bold',
          fontSize: '0.82rem',
          zIndex: 4000,
          boxShadow: 'var(--shadow-lg)'
        }}>
          {toast.text}
        </div>
      )}

      {/* TOP CONTROL BAR: RESPONSIVE SINGLE/DUAL LINE HEADER */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.6rem',
        marginBottom: '0.65rem',
        paddingBottom: '0.65rem',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0
      }}>
        {/* Left: Pipeline Switcher and Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            backgroundColor: 'var(--surface-subtle)',
            padding: '0.2rem',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)'
          }}>
            <button
              type="button"
              onClick={() => setActivePipeline('b2c')}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '8px',
                border: 'none',
                background: activePipeline === 'b2c' ? 'var(--gradient-primary)' : 'transparent',
                color: activePipeline === 'b2c' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 800,
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: activePipeline === 'b2c' ? '0 2px 8px rgba(142, 36, 208, 0.28)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>shopping_cart</span>
              Pipeline B2C (Retail & Citas)
            </button>

            <button
              type="button"
              onClick={() => setActivePipeline('b2b')}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '8px',
                border: 'none',
                background: activePipeline === 'b2b' ? 'var(--gradient-primary)' : 'transparent',
                color: activePipeline === 'b2b' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 800,
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: activePipeline === 'b2b' ? '0 2px 8px rgba(142, 36, 208, 0.28)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>domain</span>
              Pipeline B2B (Corporativo & Empresas)
            </button>
          </div>

          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{currentPipelineOpps.length} Oportunidades</strong> | Total Activo:{' '}
            <strong className="tabular-nums" style={{ color: 'var(--status-success-solid)', fontSize: '0.88rem' }}>
              ${totalActiveValue.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
            </strong>
          </div>
        </div>

        {/* Right: PRIMARY ACTION BUTTONS (+ CREAR OPORTUNIDAD, VIEW MODE, REFRESH) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {/* Fit Screen Toggle */}
          <button
            onClick={() => setFitToScreen(!fitToScreen)}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '7px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: fitToScreen ? 'var(--color-accent-subtle)' : 'var(--surface-card)',
              color: fitToScreen ? 'var(--color-accent-text)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.75rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}
            title={fitToScreen ? 'Cambiar a modo scroll ancho' : 'Ajustar todas las columnas a la pantalla'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>
              {fitToScreen ? 'fit_screen' : 'view_column'}
            </span>
            <span>{fitToScreen ? 'Ajustado a Pantalla (100%)' : 'Modo Expandido'}</span>
          </button>

          {!fitToScreen && (
            <div style={{ display: 'flex', gap: '0.2rem', backgroundColor: 'var(--surface-subtle)', padding: '0.15rem', borderRadius: '7px', border: '1px solid var(--border-subtle)' }}>
              <button
                onClick={() => handleScroll('left')}
                title="Desplazar columnas a la izquierda"
                style={{ padding: '0.35rem 0.5rem', borderRadius: '5px', border: 'none', backgroundColor: 'var(--surface-card)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>chevron_left</span>
              </button>
              <button
                onClick={() => handleScroll('right')}
                title="Desplazar columnas a la derecha"
                style={{ padding: '0.35rem 0.5rem', borderRadius: '5px', border: 'none', backgroundColor: 'var(--surface-card)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>chevron_right</span>
              </button>
            </div>
          )}

          {/* PRIMARY "+ NUEVA OPORTUNIDAD" BUTTON */}
          <button
            onClick={() => {
              setEditingOpp({ pipeline_type: activePipeline, stage: activePipeline === 'b2b' ? 'stage:b2b_prospecto' : 'stage:prospecto' });
              setShowOppModal(true);
            }}
            style={{
              padding: '0.5rem 1.1rem',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--gradient-primary)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: '0 2px 8px rgba(142, 36, 208, 0.28)',
              flexShrink: 0
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>add_circle</span>
            <span>+ Nueva Oportunidad {activePipeline.toUpperCase()}</span>
          </button>

          <button
            onClick={fetchOpportunities}
            style={{
              padding: '0.5rem 0.65rem',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--surface-card)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Actualizar oportunidades"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>refresh</span>
          </button>
        </div>
      </div>

      {/* COMPACT & RESPONSIVE KANBAN COLUMNS CONTAINER */}
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          display: fitToScreen ? 'grid' : 'flex',
          gridTemplateColumns: fitToScreen ? `repeat(${currentStages.length}, minmax(0, 1fr))` : undefined,
          gap: fitToScreen ? '0.45rem' : '0.75rem',
          overflowX: fitToScreen ? 'hidden' : 'auto',
          overflowY: 'hidden',
          paddingBottom: '0.45rem',
          scrollBehavior: 'smooth'
        }}
      >
        {currentStages.map(stage => {
          const stageOpps = currentPipelineOpps.filter(o => o.stage === stage.id);
          const totalStageValue = stageOpps.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
          const isDragOver = dragOverStageId === stage.id;
          const isLostStage = stage.id.includes('perdido');

          return (
            <div
              key={stage.id}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverStageId !== stage.id) setDragOverStageId(stage.id);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragOverStageId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const oppIdStr = e.dataTransfer.getData('text/plain');
                if (oppIdStr) {
                  const opp = opportunities.find(o => String(o.id) === oppIdStr);
                  if (opp && opp.stage !== stage.id) {
                    handleStageChangeSelect(opp, stage.id);
                  }
                }
                setDragOverStageId(null);
                setDraggedOppId(null);
              }}
              style={{
                width: fitToScreen ? 'auto' : '260px',
                minWidth: fitToScreen ? 0 : '260px',
                flexShrink: fitToScreen ? 1 : 0,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: isDragOver ? 'var(--status-success-bg)' : isLostStage ? 'var(--status-danger-bg)' : 'var(--surface-subtle)',
                borderRadius: '10px',
                border: isDragOver ? '2px dashed var(--status-success-solid)' : '1px solid var(--border-subtle)',
                borderTop: `3.5px solid ${stage.color}`,
                padding: '0.6rem 0.5rem',
                maxHeight: '100%',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.15s ease'
              }}
            >
              {/* Column Header */}
              <div style={{
                paddingBottom: '0.45rem',
                borderBottom: '1px solid var(--border-subtle)',
                marginBottom: '0.5rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {stage.name}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                    <span className="tabular-nums" style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '0.1rem 0.35rem',
                      borderRadius: '5px',
                      backgroundColor: 'var(--surface-card)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)'
                    }}>
                      {stageOpps.length}
                    </span>

                    <button
                      onClick={() => {
                        setEditingOpp({ pipeline_type: activePipeline, stage: stage.id });
                        setShowOppModal(true);
                      }}
                      style={{
                        padding: '0.1rem 0.25rem',
                        borderRadius: '4px',
                        border: '1px solid var(--border-subtle)',
                        backgroundColor: 'var(--surface-card)',
                        color: 'var(--color-primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title={`Crear oportunidad en "${stage.name}"`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>add</span>
                    </button>
                  </div>
                </div>

                {/* Total Column Monetary Value */}
                <div className="tabular-nums" style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  ${totalStageValue.toLocaleString('en-US', { minimumFractionDigits: 0 })} USD
                </div>
              </div>

              {/* Opportunity Cards List */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.1rem' }}>
                {loading && opportunities.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.72rem' }}>Cargando...</div>
                ) : stageOpps.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.25rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.72rem', fontStyle: 'italic', border: '1px dashed var(--border-subtle)', borderRadius: '8px' }}>
                    Sin oportunidades
                  </div>
                ) : (
                  stageOpps.map(opp => {
                    const isLost = opp.stage.includes('perdido');
                    const isWon = opp.stage.includes('ganado');
                    const isBeingDragged = draggedOppId === opp.id;
                    const isB2B = activePipeline === 'b2b';

                    const companyDisplayName = opp.company_display_name || opp.company_name;
                    const contactDisplayName = opp.company_contact_name || opp.contact_name;
                    const contactRole = opp.company_contact_role;

                    return (
                      <div
                        key={opp.id}
                        draggable={role !== 'readonly'}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData('text/plain', String(opp.id));
                          setDraggedOppId(opp.id);
                        }}
                        onDragEnd={() => {
                          setDraggedOppId(null);
                          setDragOverStageId(null);
                        }}
                        onClick={() => {
                          setEditingOpp(opp);
                          setShowOppModal(true);
                        }}
                        style={{
                          padding: '0.65rem',
                          backgroundColor: 'var(--surface-card)',
                          borderRadius: '10px',
                          border: isBeingDragged ? '2px dashed var(--color-primary)' : '1px solid var(--border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem',
                          boxShadow: 'var(--shadow-sm)',
                          cursor: role === 'readonly' ? 'pointer' : 'grab',
                          opacity: isBeingDragged ? 0.45 : 1,
                          transform: isBeingDragged ? 'scale(0.97)' : 'none',
                          transition: 'transform 0.15s ease, opacity 0.15s ease'
                        }}
                      >
                        {/* B2B COMPANY HEADER BADGE */}
                        {isB2B && companyDisplayName && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            color: 'var(--color-accent)',
                            backgroundColor: 'rgba(142, 36, 208, 0.12)',
                            padding: '0.15rem 0.35rem',
                            borderRadius: '5px',
                            border: '1px solid rgba(142, 36, 208, 0.25)'
                          }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', color: 'var(--color-accent)' }}>domain</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {companyDisplayName}
                            </span>
                          </div>
                        )}

                        {/* Title & Value */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.35rem' }}>
                          <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: 1.3, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {opp.title}
                          </strong>
                        </div>

                        {/* Amount Tag & Badges */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem' }}>
                          <span className="tabular-nums" style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            color: isWon ? 'var(--status-success-solid)' : isLost ? 'var(--status-danger-solid)' : 'var(--color-primary)',
                            backgroundColor: isWon ? 'var(--status-success-bg)' : isLost ? 'var(--status-danger-bg)' : 'var(--status-info-bg)',
                            border: isWon ? '1px solid var(--status-success-border)' : isLost ? '1px solid var(--status-danger-border)' : '1px solid var(--status-info-border)',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '5px',
                            display: 'inline-block'
                          }}>
                            ${Number(opp.invoiced_amount && isWon ? opp.invoiced_amount : opp.value).toLocaleString('en-US', { minimumFractionDigits: 0 })} {opp.currency}
                          </span>

                          {opp.meta_ad_id && (
                            <span
                              title={opp.meta_ad_headline ? `Anuncio: ${opp.meta_ad_headline}` : `Meta Ad ID: ${opp.meta_ad_id}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                fontSize: '0.66rem',
                                fontWeight: 800,
                                color: '#00CEFF',
                                backgroundColor: 'rgba(0, 206, 255, 0.1)',
                                border: '1px solid rgba(0, 206, 255, 0.3)',
                                padding: '0.08rem 0.35rem',
                                borderRadius: '4px'
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '0.75rem' }}>ads_click</span>
                              <span>Meta #{opp.meta_ad_id.slice(-6)}</span>
                            </span>
                          )}

                          {opp.invoice_number && isWon && (
                            <span
                              title={`Factura: ${opp.invoice_number}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                fontSize: '0.66rem',
                                fontWeight: 800,
                                color: '#059669',
                                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                                border: '1px solid rgba(5, 150, 105, 0.3)',
                                padding: '0.08rem 0.35rem',
                                borderRadius: '4px'
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '0.75rem' }}>receipt_long</span>
                              <span>Fac #{opp.invoice_number}</span>
                            </span>
                          )}
                        </div>

                        {/* Contact Person Details */}
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>person</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {contactDisplayName} {contactRole ? `(${contactRole})` : ''}
                          </span>
                        </div>

                        {/* Assigned Agent or Role */}
                        {opp.assigned_agent_name && opp.assigned_agent_name !== 'Sin Asignar' && (
                          <div style={{ fontSize: '0.68rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Asesor: <strong>{opp.assigned_agent_name}</strong>
                          </div>
                        )}

                        {/* Action Bar */}
                        <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.15rem' }}>
                          <select
                            value={opp.stage}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleStageChangeSelect(opp, e.target.value);
                            }}
                            style={{
                              flex: 1,
                              padding: '0.25rem',
                              borderRadius: '5px',
                              backgroundColor: 'var(--surface-subtle)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-primary)',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              minWidth: 0
                            }}
                          >
                            {currentStages.map(s => (
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
                              padding: '0.25rem 0.45rem',
                              borderRadius: '5px',
                              border: '1px solid var(--border-subtle)',
                              backgroundColor: 'var(--surface-subtle)',
                              color: 'var(--text-primary)',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            title="Editar Oportunidad"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '0.8rem' }}>edit</span>
                          </button>

                          {(opp.company_contact_phone || opp.contact_phone || opp.conversation_id) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenOutboundWhatsApp(opp);
                              }}
                              style={{
                                padding: '0.25rem 0.45rem',
                                borderRadius: '5px',
                                border: 'none',
                                backgroundColor: '#10b981',
                                color: '#ffffff',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Abrir / Enviar mensaje por WhatsApp"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>chat</span>
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

            showToast(oppData.id ? '¡Oportunidad actualizada!' : `¡Oportunidad creada en el Pipeline ${oppData.pipeline_type?.toUpperCase() || 'CRM'}!`);
            fetchOpportunities();
          } catch (err: any) {
            showToast(err.message, 'error');
          }
        }}
        initialData={editingOpp}
        defaultPipelineType={activePipeline}
        tenantId={tenantId}
        token={token}
        advisorsList={advisorsList}
      />
    </div>
  );
};
