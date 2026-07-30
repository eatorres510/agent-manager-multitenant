import React, { useState, useEffect } from 'react';

export interface OpportunityData {
  id?: number;
  contact_name: string;
  contact_phone?: string;
  conversation_id?: string;
  title: string;
  value: number;
  currency: string;
  stage: string;
  assigned_agent_name?: string;
  lost_reason?: string;
  lost_notes?: string;
  next_action_type?: string;
  next_action_date?: string;
  next_action_notes?: string;
}

interface OpportunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: OpportunityData) => Promise<void>;
  initialData?: Partial<OpportunityData> | null;
  defaultContactName?: string;
  defaultContactPhone?: string;
  defaultConvId?: string;
}

export const OpportunityModal: React.FC<OpportunityModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  defaultContactName = '',
  defaultContactPhone = '',
  defaultConvId = ''
}) => {
  const [title, setTitle] = useState('');
  const [value, setValue] = useState<number | string>(1000);
  const [stage, setStage] = useState('stage:prospecto');
  const [assignedAgent, setAssignedAgent] = useState('Sin Asignar');
  const [nextActionType, setNextActionType] = useState('llamada');
  const [nextActionDate, setNextActionDate] = useState('');
  const [nextActionNotes, setNextActionNotes] = useState('');
  const [lostReason, setLostReason] = useState('Precio Alto');
  const [lostNotes, setLostNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setValue(initialData.value || 0);
      setStage(initialData.stage || 'stage:prospecto');
      setAssignedAgent(initialData.assigned_agent_name || 'Sin Asignar');
      setNextActionType(initialData.next_action_type || 'llamada');
      setNextActionDate(initialData.next_action_date ? initialData.next_action_date.substring(0, 16) : '');
      setNextActionNotes(initialData.next_action_notes || '');
      setLostReason(initialData.lost_reason || 'Precio Alto');
      setLostNotes(initialData.lost_notes || '');
    } else {
      setTitle('');
      setValue(1000);
      setStage('stage:prospecto');
      setAssignedAgent('Sin Asignar');
      setNextActionType('llamada');
      setNextActionDate('');
      setNextActionNotes('');
      setLostReason('Precio Alto');
      setLostNotes('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Ingresa el título de la oportunidad comercial.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        id: initialData?.id,
        contact_name: initialData?.contact_name || defaultContactName || 'Cliente',
        contact_phone: initialData?.contact_phone || defaultContactPhone,
        conversation_id: initialData?.conversation_id || defaultConvId,
        title,
        value: typeof value === 'number' ? value : parseFloat(value) || 0,
        currency: 'USD',
        stage,
        assigned_agent_name: assignedAgent,
        next_action_type: nextActionType,
        next_action_date: nextActionDate || undefined,
        next_action_notes: nextActionNotes,
        lost_reason: stage === 'stage:perdido' ? lostReason : undefined,
        lost_notes: stage === 'stage:perdido' ? lostNotes : undefined
      });
      onClose();
    } catch (err: any) {
      alert(err.message || 'Error al guardar la oportunidad');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(11, 43, 76, 0.55)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 3000,
      backdropFilter: 'blur(3px)'
    }}>
      <form onSubmit={handleSubmit} style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '560px',
        maxWidth: '94%',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '1.75rem',
        boxShadow: '0 20px 50px rgba(11, 43, 76, 0.25)',
        border: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.1rem'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, color: '#0b2b4c', fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="material-symbols-outlined" style={{ color: '#2563eb', fontSize: '1.4rem' }}>business_center</span>
              {initialData?.id ? 'Editar Oportunidad Comercial' : '+ Crear Nueva Oportunidad Comercial'}
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
              Cliente: <strong>{initialData?.contact_name || defaultContactName || 'Cliente activo'}</strong> {defaultContactPhone && `(${defaultContactPhone})`}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', fontSize: '1.2rem', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>

        {/* Basic Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0b2b4c' }}>
            Título de la Oportunidad <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Compra de 5 Laptops ASUS Vivobook con factura de crédito"
            style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0b2b4c' }}>
              Valor Estimado ($ USD)
            </label>
            <input
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="1000"
              style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box', fontWeight: 700, color: '#059669' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0b2b4c' }}>
              Etapa Pipeline CRM
            </label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box', fontWeight: 700, color: '#0b2b4c' }}
            >
              <option value="stage:prospecto">1. Prospecto IA</option>
              <option value="stage:interesado">2. Interesado</option>
              <option value="stage:cotizado">3. Cotización Enviada</option>
              <option value="stage:cita_agendada">4. Cita Agendada</option>
              <option value="stage:negociacion">5. En Negociación</option>
              <option value="stage:ganado">6. Venta Ganada (Won)</option>
              <option value="stage:perdido">7. Venta Perdida (Lost)</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0b2b4c' }}>
            Vendedor / Asesor Asignado
          </label>
          <select
            value={assignedAgent}
            onChange={(e) => setAssignedAgent(e.target.value)}
            style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
          >
            <option value="Sin Asignar">Sin Asignar (Cola General)</option>
            <option value="Jovanela">Jovanela (Ventas Corporativas)</option>
            <option value="Adonis">Adonis (Ventas Corporativas)</option>
            <option value="Mario Lumbi">Mario Lumbi (Ventas Retail)</option>
            <option value="Toribio">Toribio (Soporte Técnico)</option>
          </select>
        </div>

        {/* SECTION: SEGUIMIENTO DE LA OPORTUNIDAD */}
        <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.88rem', color: '#2563eb', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>event</span>
            Seguimiento de la Oportunidad (Próxima Acción & Comentarios)
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>
                Tipo de Actividad
              </label>
              <select
                value={nextActionType}
                onChange={(e) => setNextActionType(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
              >
                <option value="llamada">📞 Próxima Llamada</option>
                <option value="correo">✉️ Correo Enviado / Por Enviar</option>
                <option value="visita">🏢 Visita al Cliente</option>
                <option value="demo">💻 Demo de Producto / Proforma</option>
                <option value="nota">📝 Comentario / Nota Interna</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>
                Fecha / Hora del Seguimiento
              </label>
              <input
                type="datetime-local"
                value={nextActionDate}
                onChange={(e) => setNextActionDate(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>
              Comentarios y Notas de Seguimiento
            </label>
            <textarea
              rows={3}
              value={nextActionNotes}
              onChange={(e) => setNextActionNotes(e.target.value)}
              placeholder="Ej: Cliente solicitó proforma formal con IVA desglosado. Volver a llamar el viernes a las 10:00 am."
              style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box', lineHeight: 1.4 }}
            />
          </div>
        </div>

        {/* SECTION: PERDIDA DE OPORTUNIDAD (ONLY IF LOST) */}
        {stage === 'stage:perdido' && (
          <div style={{ backgroundColor: '#fef2f2', padding: '1rem', borderRadius: '10px', border: '1px solid #fca5a5', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.88rem', color: '#dc2626', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>warning</span>
              Normalización de Venta Perdida
            </h4>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991b1b', display: 'block', marginBottom: '0.2rem' }}>
                Motivo de la Pérdida
              </label>
              <select
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #fca5a5', fontSize: '0.8rem', fontWeight: 700, color: '#991b1b' }}
              >
                <option value="Precio Alto">Precio Alto / Fuera de Presupuesto</option>
                <option value="Competencia">Compró a la Competencia</option>
                <option value="Sin Stock">Sin Stock / Producto No Disponible</option>
                <option value="Sin Respuesta">Falta de Respuesta del Cliente</option>
                <option value="Condiciones Pago">Condiciones de Crédito / Pago No Aceptadas</option>
                <option value="Otro">Otro Motivo</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991b1b', display: 'block', marginBottom: '0.2rem' }}>
                Detalle / Comentarios de la Pérdida
              </label>
              <textarea
                rows={2}
                value={lostNotes}
                onChange={(e) => setLostNotes(e.target.value)}
                placeholder="Ej: Consiguió el equipo C$1,000 más barato en otra tienda."
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #fca5a5', fontSize: '0.8rem', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '0.55rem 1.4rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
            }}
          >
            {saving ? 'Guardando...' : 'Guardar Oportunidad'}
          </button>
        </div>
      </form>
    </div>
  );
};
