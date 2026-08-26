import React, { useState, useEffect } from 'react';

export interface OpportunityData {
  id?: number;
  contact_id?: string;
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
  pipeline_type?: 'b2c' | 'b2b';
  company_id?: number;
  company_name?: string;
  company_contact_id?: number;
  credit_terms?: string;
  target_closing_date?: string;
}

interface OpportunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: OpportunityData) => Promise<void>;
  initialData?: Partial<OpportunityData> | null;
  defaultContactName?: string;
  defaultContactPhone?: string;
  defaultConvId?: string;
  defaultPipelineType?: 'b2c' | 'b2b';
  tenantId?: string;
  token?: string | null;
  advisorsList?: { id?: number; name: string; email: string; role?: string }[];
}

const B2C_STAGES = [
  { id: 'stage:prospecto', name: 'Prospección (Retail)' },
  { id: 'stage:interesado', name: 'Calificación (Interesado)' },
  { id: 'stage:cotizado', name: 'Propuesta / Cotizado' },
  { id: 'stage:cita_agendada', name: 'Demostración / Cita Agendada' },
  { id: 'stage:negociacion', name: 'Negociación' },
  { id: 'stage:ganado', name: 'Cierre Ganado' },
  { id: 'stage:perdido', name: 'Venta Perdida' },
];

const B2B_STAGES = [
  { id: 'stage:b2b_prospecto', name: '1. Cuenta Prospectada / Identificada' },
  { id: 'stage:b2b_calificacion', name: '2. Contacto & Calificación (BANT)' },
  { id: 'stage:b2b_levantamiento', name: '3. Levantamiento Técnico' },
  { id: 'stage:b2b_propuesta', name: '4. Propuesta Formal & Proforma' },
  { id: 'stage:b2b_comite', name: '5. En Revisión de Comité / Crédito' },
  { id: 'stage:b2b_negociacion', name: '6. Negociación & Términos' },
  { id: 'stage:b2b_ganado', name: '7. Cierre Ganado (Orden de Compra)' },
  { id: 'stage:b2b_perdido', name: 'Venta Perdida B2B' },
];

export const OpportunityModal: React.FC<OpportunityModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  defaultContactName = '',
  defaultContactPhone = '',
  defaultConvId = '',
  defaultPipelineType = 'b2c',
  tenantId = 'sicsa',
  token = null,
  advisorsList = []
}) => {
  const [pipelineType, setPipelineType] = useState<'b2c' | 'b2b'>('b2c');
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

  // B2B Specific State
  const [companiesList, setCompaniesList] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>('');
  const [companyContacts, setCompanyContacts] = useState<any[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<number | ''>('');
  const [creditTerms, setCreditTerms] = useState('Contado');
  const [targetClosingDate, setTargetClosingDate] = useState('');

  // B2C Contact State
  const [contactNameInput, setContactNameInput] = useState('');
  const [contactPhoneInput, setContactPhoneInput] = useState('');

  // Fetch Companies when in B2B mode
  useEffect(() => {
    if (token && isOpen) {
      fetch(`/api/control/${tenantId}/companies`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setCompaniesList(data); })
        .catch(e => console.error('Error fetching companies for modal:', e));
    }
  }, [token, isOpen, tenantId]);

  // Fetch Contacts when a Company is selected in B2B mode
  useEffect(() => {
    if (token && selectedCompanyId) {
      fetch(`/api/control/${tenantId}/companies/${selectedCompanyId}/contacts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(data => {
          const list = Array.isArray(data) ? data : [];
          setCompanyContacts(list);
          if (list.length > 0 && !selectedContactId) {
            // Auto select primary contact or first contact
            const primary = list.find((c: any) => c.is_primary) || list[0];
            setSelectedContactId(primary.id);
            setContactNameInput(primary.name);
            setContactPhoneInput(primary.phone || '');
          }
        })
        .catch(e => console.error('Error fetching company contacts:', e));
    } else {
      setCompanyContacts([]);
    }
  }, [token, selectedCompanyId, tenantId]);

  useEffect(() => {
    if (initialData) {
      const pType = initialData.pipeline_type || (initialData.stage && initialData.stage.includes('b2b') ? 'b2b' : 'b2c');
      setPipelineType(pType);
      setTitle(initialData.title || '');
      setValue(initialData.value || 0);
      setStage(initialData.stage || (pType === 'b2b' ? 'stage:b2b_prospecto' : 'stage:prospecto'));
      setAssignedAgent(initialData.assigned_agent_name || 'Sin Asignar');
      setNextActionType(initialData.next_action_type || 'llamada');
      setNextActionDate(initialData.next_action_date ? initialData.next_action_date.substring(0, 16) : '');
      setNextActionNotes(initialData.next_action_notes || '');
      setLostReason(initialData.lost_reason || 'Precio Alto');
      setLostNotes(initialData.lost_notes || '');

      // B2B
      setSelectedCompanyId(initialData.company_id || '');
      setSelectedContactId(initialData.company_contact_id || '');
      setCreditTerms(initialData.credit_terms || 'Contado');
      setTargetClosingDate(initialData.target_closing_date ? initialData.target_closing_date.substring(0, 10) : '');

      setContactNameInput(initialData.contact_name || defaultContactName || '');
      setContactPhoneInput(initialData.contact_phone || defaultContactPhone || '');
    } else {
      const pType = defaultPipelineType || 'b2c';
      setPipelineType(pType);
      setTitle('');
      setValue(pType === 'b2b' ? 4500 : 1000);
      setStage(pType === 'b2b' ? 'stage:b2b_prospecto' : 'stage:prospecto');
      setAssignedAgent('Sin Asignar');
      setNextActionType('llamada');
      setNextActionDate('');
      setNextActionNotes('');
      setLostReason('Precio Alto');
      setLostNotes('');

      setSelectedCompanyId('');
      setSelectedContactId('');
      setCreditTerms('Crédito 30 días');
      setTargetClosingDate('');

      setContactNameInput(defaultContactName || '');
      setContactPhoneInput(defaultContactPhone || '');
    }
  }, [initialData, isOpen, defaultPipelineType, defaultContactName, defaultContactPhone]);

  if (!isOpen) return null;

  const handleCompanyChange = (compIdStr: string) => {
    if (!compIdStr) {
      setSelectedCompanyId('');
      setSelectedContactId('');
      return;
    }
    const cId = parseInt(compIdStr);
    setSelectedCompanyId(cId);
    const comp = companiesList.find(c => c.id === cId);
    if (comp) {
      if (comp.credit_terms) setCreditTerms(comp.credit_terms);
      if (comp.assigned_agent_name && comp.assigned_agent_name !== 'Sin Asignar') {
        setAssignedAgent(comp.assigned_agent_name);
      }
    }
  };

  const handleContactChange = (contactIdStr: string) => {
    if (!contactIdStr) {
      setSelectedContactId('');
      return;
    }
    const contId = parseInt(contactIdStr);
    setSelectedContactId(contId);
    const cont = companyContacts.find(c => c.id === contId);
    if (cont) {
      setContactNameInput(cont.name);
      setContactPhoneInput(cont.phone || '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Ingresa el título de la oportunidad comercial.');
      return;
    }

    let finalContactName = contactNameInput.trim();
    let finalContactPhone = contactPhoneInput.trim();
    let finalCompanyName = '';

    if (pipelineType === 'b2b') {
      if (!selectedCompanyId) {
        alert('Por favor selecciona la Empresa Corporativa para esta oportunidad B2B.');
        return;
      }
      const comp = companiesList.find(c => c.id === selectedCompanyId);
      finalCompanyName = comp ? comp.name : '';

      if (selectedContactId) {
        const cont = companyContacts.find(c => c.id === selectedContactId);
        if (cont) {
          finalContactName = cont.name;
          finalContactPhone = cont.phone || '';
        }
      }
    }

    setSaving(true);
    try {
      await onSave({
        id: initialData?.id,
        contact_id: initialData?.contact_id || 'general',
        contact_name: finalContactName || 'Cliente',
        contact_phone: finalContactPhone,
        conversation_id: initialData?.conversation_id || defaultConvId || undefined,
        title: title.trim(),
        value: typeof value === 'number' ? value : parseFloat(value) || 0,
        currency: 'USD',
        stage,
        assigned_agent_name: assignedAgent,
        next_action_type: nextActionType,
        next_action_date: nextActionDate || undefined,
        next_action_notes: nextActionNotes,
        lost_reason: stage.includes('perdido') ? lostReason : undefined,
        lost_notes: stage.includes('perdido') ? lostNotes : undefined,
        pipeline_type: pipelineType,
        company_id: pipelineType === 'b2b' && selectedCompanyId ? Number(selectedCompanyId) : undefined,
        company_name: pipelineType === 'b2b' ? finalCompanyName : undefined,
        company_contact_id: pipelineType === 'b2b' && selectedContactId ? Number(selectedContactId) : undefined,
        credit_terms: pipelineType === 'b2b' ? creditTerms : undefined,
        target_closing_date: pipelineType === 'b2b' && targetClosingDate ? targetClosingDate : undefined
      });
      onClose();
    } catch (err: any) {
      alert(err.message || 'Error al guardar la oportunidad');
    } finally {
      setSaving(false);
    }
  };

  const currentStages = pipelineType === 'b2b' ? B2B_STAGES : B2C_STAGES;

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
        width: '600px',
        maxWidth: '94%',
        maxHeight: '92vh',
        overflowY: 'auto',
        padding: '1.75rem',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.1rem',
        fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem' }}>
          <div>
            <h3 style={{ margin: 0, color: '#0b2b4c', fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span className="material-symbols-outlined" style={{ color: '#2563eb', fontSize: '1.35rem' }}>
                {pipelineType === 'b2b' ? 'domain' : 'business_center'}
              </span>
              {initialData?.id ? 'Editar Oportunidad Comercial' : '+ Crear Oportunidad en Pipeline'}
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
              {pipelineType === 'b2b' ? '🏢 Oportunidad Corporativa / Empresas B2B' : '🛒 Oportunidad Retail / Clientes Particulares B2C'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#64748B',
              fontSize: '1.25rem',
              fontWeight: 'bold'
            }}
          >
            ✕
          </button>
        </div>

        {/* PIPELINE TYPE SELECTOR SWITCH */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          backgroundColor: '#f1f5f9',
          padding: '0.25rem',
          borderRadius: '10px',
          gap: '0.25rem'
        }}>
          <button
            type="button"
            onClick={() => {
              setPipelineType('b2c');
              if (stage.includes('b2b')) setStage('stage:prospecto');
            }}
            style={{
              padding: '0.5rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: pipelineType === 'b2c' ? '#2563eb' : 'transparent',
              color: pipelineType === 'b2c' ? '#ffffff' : '#64748b',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              transition: 'all 0.15s ease'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.05rem' }}>shopping_cart</span>
            🛒 Pipeline B2C (Retail)
          </button>

          <button
            type="button"
            onClick={() => {
              setPipelineType('b2b');
              if (!stage.includes('b2b')) setStage('stage:b2b_prospecto');
            }}
            style={{
              padding: '0.5rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: pipelineType === 'b2b' ? '#0b2b4c' : 'transparent',
              color: pipelineType === 'b2b' ? '#ffffff' : '#64748b',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              transition: 'all 0.15s ease'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.05rem' }}>domain</span>
            🏢 Pipeline B2B (Empresas)
          </button>
        </div>

        {/* B2B COMPANY & CONTACT SELECTION SECTION */}
        {pipelineType === 'b2b' ? (
          <div style={{ backgroundColor: '#eff6ff', padding: '1rem', borderRadius: '10px', border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>corporate_fare</span>
              Empresa y Contacto Decisor Asociado
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e3a8a' }}>
                  Seleccionar Empresa <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  required
                  value={selectedCompanyId}
                  onChange={(e) => handleCompanyChange(e.target.value)}
                  style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid #93c5fd', fontSize: '0.85rem', backgroundColor: '#fff', fontWeight: 700, color: '#0b2b4c' }}
                >
                  <option value="">-- Selecciona una Empresa --</option>
                  {companiesList.map(comp => (
                    <option key={comp.id} value={comp.id}>
                      {comp.name} {comp.ruc_tax_id ? `(${comp.ruc_tax_id})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e3a8a' }}>
                  Contacto que origina la oportunidad
                </label>
                <select
                  value={selectedContactId}
                  onChange={(e) => handleContactChange(e.target.value)}
                  disabled={!selectedCompanyId || companyContacts.length === 0}
                  style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid #93c5fd', fontSize: '0.85rem', backgroundColor: '#fff', color: '#0b2b4c' }}
                >
                  <option value="">{companyContacts.length === 0 ? '-- Sin contactos registrados --' : '-- Selecciona el Contacto --'}</option>
                  {companyContacts.map(cont => (
                    <option key={cont.id} value={cont.id}>
                      {cont.name} ({cont.role_title || 'Comercial'}) {cont.phone ? `• ${cont.phone}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e3a8a' }}>Condición de Crédito / Pago</label>
                <select
                  value={creditTerms}
                  onChange={(e) => setCreditTerms(e.target.value)}
                  style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: '#fff' }}
                >
                  <option value="Contado / Inmediato">Contado / Inmediato</option>
                  <option value="Crédito 15 días">Crédito 15 días</option>
                  <option value="Crédito 30 días">Crédito 30 días</option>
                  <option value="Crédito 45 días">Crédito 45 días</option>
                  <option value="Crédito 60 días">Crédito 60 días</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e3a8a' }}>Fecha Estimada de Cierre</label>
                <input
                  type="date"
                  value={targetClosingDate}
                  onChange={(e) => setTargetClosingDate(e.target.value)}
                  style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>
            </div>
          </div>
        ) : (
          /* B2C CONTACT INPUTS */
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Nombre del Cliente</label>
              <input
                type="text"
                value={contactNameInput}
                onChange={(e) => setContactNameInput(e.target.value)}
                placeholder="Ej: Erick Torres"
                style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Teléfono / WhatsApp</label>
              <input
                type="text"
                value={contactPhoneInput}
                onChange={(e) => setContactPhoneInput(e.target.value)}
                placeholder="+505 8888 5707"
                style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
              />
            </div>
          </div>
        )}

        {/* Basic Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
            Título del Proyecto / Oportunidad <span style={{ color: '#DC2626' }}>*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={pipelineType === 'b2b' ? "Ej: Suministro de 15 Laptops ASUS Core i7 + Configuración de Red" : "Ej: Compra de Laptop ASUS Vivobook"}
            style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.88rem', color: '#0F172A', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
              Monto Estimado ($ USD)
            </label>
            <input
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="4500"
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.88rem', boxSizing: 'border-box', fontWeight: 700, color: '#065F46' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
              Etapa del Pipeline ({pipelineType.toUpperCase()})
            </label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#fff', fontSize: '0.85rem', boxSizing: 'border-box', fontWeight: 700, color: '#0b2b4c' }}
            >
              {currentStages.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
            Vendedor / Asesor Asignado
          </label>
          <select
            value={assignedAgent}
            onChange={(e) => setAssignedAgent(e.target.value)}
            style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.88rem', color: '#0F172A', boxSizing: 'border-box' }}
          >
            <option value="Sin Asignar">Sin Asignar (Cola General)</option>
            {advisorsList && advisorsList.length > 0 ? (
              advisorsList
                .filter(u => {
                  const e = (u.email || '').toLowerCase();
                  const n = (u.name || '').toLowerCase();
                  return !e.includes('platform.local') && !e.includes('erick.torres') && !e.includes('eitserv.tech') && !e.includes('upagency') && !n.includes('erick torres');
                })
                .map(adv => (
                  <option key={adv.id || adv.email} value={adv.name || adv.email.split('@')[0]}>
                    {adv.name || adv.email.split('@')[0]} ({adv.email})
                  </option>
                ))
            ) : (
              <>
                <option value="Jovanela">Jovanela (Ventas Corporativas B2B)</option>
                <option value="Adonis">Adonis (Ventas Corporativas B2B)</option>
                <option value="Mario Lumbi">Mario Lumbi (Ventas Retail)</option>
                <option value="Toribio">Toribio (Soporte Técnico)</option>
              </>
            )}
          </select>
        </div>

        {/* SECTION: SEGUIMIENTO DE LA OPORTUNIDAD */}
        <div style={{ backgroundColor: '#F8FAFC', padding: '1rem', borderRadius: '10px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0B2B4C', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: '#2563EB' }}>event_upcoming</span>
            Próxima Acción de Seguimiento
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Tipo de Acción</label>
              <select
                value={nextActionType}
                onChange={(e) => setNextActionType(e.target.value)}
                style={{ padding: '0.55rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem', backgroundColor: '#fff' }}
              >
                <option value="llamada">📞 Llamada Telefónica</option>
                <option value="correo">✉️ Envío de Correo / Proforma</option>
                <option value="visita">🏢 Visita Presencial a la Empresa</option>
                <option value="demo">💻 Reunión Virtual / Demo</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Fecha y Hora Programada</label>
              <input
                type="datetime-local"
                value={nextActionDate}
                onChange={(e) => setNextActionDate(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Notas de la Acción</label>
            <input
              type="text"
              value={nextActionNotes}
              onChange={(e) => setNextActionNotes(e.target.value)}
              placeholder="Ej: Llamar a Compras para confirmar recepción de proforma..."
              style={{ padding: '0.55rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
            />
          </div>
        </div>

        {/* SECTION: VENTA PERDIDA (IF APPLICABLE) */}
        {stage.includes('perdido') && (
          <div style={{ backgroundColor: '#FEF2F2', padding: '1rem', borderRadius: '10px', border: '1px solid #FECACA', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#991B1B', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: '#DC2626' }}>report</span>
              Motivo de Venta Perdida
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7F1D1D' }}>Motivo Principal</label>
              <select
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                style={{ padding: '0.55rem', borderRadius: '6px', border: '1px solid #FCA5A5', fontSize: '0.82rem', backgroundColor: '#fff' }}
              >
                <option value="Precio Alto / Competencia">Precio Alto / Compró con Competencia</option>
                <option value="Sin Stock Inmediato">Sin Stock Inmediato</option>
                <option value="Condiciones de Crédito Rechazadas">Condiciones de Crédito Rechazadas</option>
                <option value="Presupuesto Cancelado por Empresa">Presupuesto Cancelado por Empresa</option>
                <option value="Decisor No Responde">Decisor No Responde / Lead Frío</option>
                <option value="Otro">Otro Motivo</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7F1D1D' }}>Detalles Adicionales</label>
              <textarea
                value={lostNotes}
                onChange={(e) => setLostNotes(e.target.value)}
                rows={2}
                placeholder="Explicación detallada del motivo por el cual no se cerró el negocio..."
                style={{ padding: '0.55rem', borderRadius: '6px', border: '1px solid #FCA5A5', fontSize: '0.82rem' }}
              />
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#fff',
              color: '#475569',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '0.65rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#2563EB',
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
            }}
          >
            {saving ? 'Guardando...' : initialData?.id ? 'Actualizar Oportunidad' : 'Crear Oportunidad'}
          </button>
        </div>
      </form>
    </div>
  );
};
