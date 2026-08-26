import React, { useState, useEffect } from 'react';

interface CompaniesDirectoryTabProps {
  tenantId: string;
  token: string | null;
  role: string | null;
  onOpenChat: (conversationId?: string | number) => void;
  onOpenCreateOpportunity?: (companyData: { company_id: number; company_name: string; contact_id?: number; contact_name?: string; contact_phone?: string }) => void;
}

export interface CompanyContact {
  id: number;
  tenant_id: string;
  company_id: number;
  name: string;
  role_title?: string;
  phone?: string;
  email?: string;
  decision_level?: 'decisor' | 'evaluador_tecnico' | 'comprador' | 'usuario_final' | string;
  is_primary?: boolean;
  notes?: string;
  created_at: string;
}

export interface Company {
  id: number;
  tenant_id: string;
  name: string;
  ruc_tax_id?: string;
  industry?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  credit_terms?: string;
  assigned_agent_name?: string;
  status?: string;
  notes?: string;
  contacts_count?: number;
  deals_count?: number;
  total_pipeline_value?: number;
  contacts?: CompanyContact[];
  created_at: string;
  updated_at: string;
}

export const CompaniesDirectoryTab: React.FC<CompaniesDirectoryTabProps> = ({
  tenantId,
  token,
  role,
  onOpenChat,
  onOpenCreateOpportunity
}) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [advisorsList, setAdvisorsList] = useState<{ id?: number; name: string; email: string; role?: string }[]>([]);
  const [expandedCompanyIds, setExpandedCompanyIds] = useState<number[]>([]);
  const [companyContactsMap, setCompanyContactsMap] = useState<Record<number, CompanyContact[]>>({});
  const [loadingContacts, setLoadingContacts] = useState<Record<number, boolean>>({});

  // Modals state
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  const [showContactModal, setShowContactModal] = useState(false);
  const [targetCompanyForContact, setTargetCompanyForContact] = useState<Company | null>(null);
  const [editingContact, setEditingContact] = useState<CompanyContact | null>(null);

  // Form state for Company
  const [compName, setCompName] = useState('');
  const [compRuc, setCompRuc] = useState('');
  const [compIndustry, setCompIndustry] = useState('Tecnología & Telecomunicaciones');
  const [compPhone, setCompPhone] = useState('');
  const [compEmail, setCompEmail] = useState('');
  const [compWebsite, setCompWebsite] = useState('');
  const [compAddress, setCompAddress] = useState('');
  const [compCreditTerms, setCompCreditTerms] = useState('Crédito 30 días');
  const [compAssignedAgent, setCompAssignedAgent] = useState('Sin Asignar');
  const [compNotes, setCompNotes] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);

  // Form state for Contact
  const [contactName, setContactName] = useState('');
  const [contactRoleTitle, setContactRoleTitle] = useState('Gerente de Compras');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactDecisionLevel, setContactDecisionLevel] = useState('decisor');
  const [contactIsPrimary, setContactIsPrimary] = useState(false);
  const [contactNotes, setContactNotes] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  // Toast alert
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (token) {
      fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setAdvisorsList(data); })
        .catch(e => console.error('Error fetching users in Companies:', e));
    }
  }, [token]);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const q = searchQuery.trim() ? `?search=${encodeURIComponent(searchQuery.trim())}` : '';
      const res = await fetch(`/api/control/${tenantId}/companies${q}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCompanies(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Error fetching companies:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [tenantId, token]);

  const fetchContactsForCompany = async (companyId: number) => {
    setLoadingContacts(prev => ({ ...prev, [companyId]: true }));
    try {
      const res = await fetch(`/api/control/${tenantId}/companies/${companyId}/contacts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCompanyContactsMap(prev => ({ ...prev, [companyId]: Array.isArray(data) ? data : [] }));
      }
    } catch (e) {
      console.error('Error fetching contacts for company:', e);
    } finally {
      setLoadingContacts(prev => ({ ...prev, [companyId]: false }));
    }
  };

  const toggleExpandCompany = (companyId: number) => {
    if (expandedCompanyIds.includes(companyId)) {
      setExpandedCompanyIds(prev => prev.filter(id => id !== companyId));
    } else {
      setExpandedCompanyIds(prev => [...prev, companyId]);
      if (!companyContactsMap[companyId]) {
        fetchContactsForCompany(companyId);
      }
    }
  };

  // Handle Save Company
  const handleOpenCompanyModal = (company?: Company) => {
    if (company) {
      setEditingCompany(company);
      setCompName(company.name || '');
      setCompRuc(company.ruc_tax_id || '');
      setCompIndustry(company.industry || 'Tecnología & Telecomunicaciones');
      setCompPhone(company.phone || '');
      setCompEmail(company.email || '');
      setCompWebsite(company.website || '');
      setCompAddress(company.address || '');
      setCompCreditTerms(company.credit_terms || 'Crédito 30 días');
      setCompAssignedAgent(company.assigned_agent_name || 'Sin Asignar');
      setCompNotes(company.notes || '');
    } else {
      setEditingCompany(null);
      setCompName('');
      setCompRuc('');
      setCompIndustry('Tecnología & Telecomunicaciones');
      setCompPhone('');
      setCompEmail('');
      setCompWebsite('');
      setCompAddress('');
      setCompCreditTerms('Crédito 30 días');
      setCompAssignedAgent('Sin Asignar');
      setCompNotes('');
    }
    setShowCompanyModal(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role === 'readonly') {
      showToast('Permisos de sólo lectura.', 'error');
      return;
    }
    if (!compName.trim()) {
      alert('Ingresa el nombre o razón social de la empresa.');
      return;
    }

    setSavingCompany(true);
    try {
      const payload = {
        name: compName.trim(),
        ruc_tax_id: compRuc.trim() || undefined,
        industry: compIndustry,
        phone: compPhone.trim() || undefined,
        email: compEmail.trim() || undefined,
        website: compWebsite.trim() || undefined,
        address: compAddress.trim() || undefined,
        credit_terms: compCreditTerms,
        assigned_agent_name: compAssignedAgent,
        notes: compNotes.trim() || undefined
      };

      const url = editingCompany
        ? `/api/control/${tenantId}/companies/${editingCompany.id}`
        : `/api/control/${tenantId}/companies`;
      const method = editingCompany ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Error al guardar la empresa corporativa');

      showToast(editingCompany ? '¡Empresa actualizada con éxito!' : '¡Nueva empresa B2B registrada en el sistema!');
      setShowCompanyModal(false);
      fetchCompanies();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingCompany(false);
    }
  };

  const handleDeleteCompany = async (company: Company) => {
    if (role === 'readonly') {
      showToast('Permisos de sólo lectura.', 'error');
      return;
    }
    if (!window.confirm(`¿Estás seguro de eliminar la empresa "${company.name}" y todos sus contactos asociados?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/control/${tenantId}/companies/${company.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Error al eliminar empresa');
      showToast('Empresa eliminada del directorio.');
      fetchCompanies();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Handle Save Contact
  const handleOpenContactModal = (company: Company, contact?: CompanyContact) => {
    setTargetCompanyForContact(company);
    if (contact) {
      setEditingContact(contact);
      setContactName(contact.name || '');
      setContactRoleTitle(contact.role_title || 'Gerente de Compras');
      setContactPhone(contact.phone || '');
      setContactEmail(contact.email || '');
      setContactDecisionLevel(contact.decision_level || 'decisor');
      setContactIsPrimary(contact.is_primary || false);
      setContactNotes(contact.notes || '');
    } else {
      setEditingContact(null);
      setContactName('');
      setContactRoleTitle('Gerente de Compras');
      setContactPhone('');
      setContactEmail('');
      setContactDecisionLevel('decisor');
      setContactIsPrimary(false);
      setContactNotes('');
    }
    setShowContactModal(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role === 'readonly') {
      showToast('Permisos de sólo lectura.', 'error');
      return;
    }
    if (!targetCompanyForContact || !contactName.trim()) {
      alert('Ingresa el nombre del contacto.');
      return;
    }

    setSavingContact(true);
    try {
      const payload = {
        name: contactName.trim(),
        role_title: contactRoleTitle.trim() || undefined,
        phone: contactPhone.trim() || undefined,
        email: contactEmail.trim() || undefined,
        decision_level: contactDecisionLevel,
        is_primary: contactIsPrimary,
        notes: contactNotes.trim() || undefined
      };

      const url = editingContact
        ? `/api/control/${tenantId}/companies/${targetCompanyForContact.id}/contacts/${editingContact.id}`
        : `/api/control/${tenantId}/companies/${targetCompanyForContact.id}/contacts`;
      const method = editingContact ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Error al guardar el contacto de la empresa');

      showToast(editingContact ? '¡Contacto de empresa actualizado!' : '¡Contacto registrado y vinculado a la empresa!');
      setShowContactModal(false);
      fetchContactsForCompany(targetCompanyForContact.id);
      fetchCompanies();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingContact(false);
    }
  };

  const handleDeleteContact = async (companyId: number, contact: CompanyContact) => {
    if (role === 'readonly') {
      showToast('Permisos de sólo lectura.', 'error');
      return;
    }
    if (!window.confirm(`¿Eliminar al contacto "${contact.name}"?`)) return;

    try {
      const res = await fetch(`/api/control/${tenantId}/companies/${companyId}/contacts/${contact.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Error eliminando contacto');
      showToast('Contacto eliminado.');
      fetchContactsForCompany(companyId);
      fetchCompanies();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Handle Outbound WhatsApp Initiation
  const handleInitiateWhatsApp = async (company: Company, contact: CompanyContact) => {
    if (!contact.phone) {
      alert(`El contacto "${contact.name}" no tiene un número telefónico registrado.`);
      return;
    }

    try {
      showToast(`Iniciando chat de WhatsApp con ${contact.name}...`);
      const res = await fetch(`/api/control/${tenantId}/outbound-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          phone: contact.phone,
          name: `${contact.name} (${company.name})`,
          company_id: company.id,
          contact_id: contact.id
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error iniciando conversación de WhatsApp');

      showToast(`¡Chat abierto para ${contact.name}! Redirigiendo a Bandeja...`);
      if (onOpenChat && data.display_id) {
        onOpenChat(data.display_id);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // KPIs
  const totalCompaniesCount = companies.length;
  const totalContactsCount = companies.reduce((acc, c) => acc + (Number(c.contacts_count) || 0), 0);
  const totalB2BPipelineValue = companies.reduce((acc, c) => acc + (Number(c.total_pipeline_value) || 0), 0);
  const creditCompaniesCount = companies.filter(c => (c.credit_terms || '').toLowerCase().includes('crédito')).length;

  return (
    <div style={{
      animation: 'fadeIn 0.25s ease-out',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem',
      color: '#0b2b4c',
      fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif'
    }}>
      {/* Toast Alert */}
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
          zIndex: 4000,
          boxShadow: '0 10px 25px rgba(11, 43, 76, 0.15)'
        }}>
          {toast.text}
        </div>
      )}

      {/* Header Bar */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '1.25rem 1.5rem',
        border: '1px solid #e5e7eb',
        boxShadow: '0 4px 20px rgba(11, 43, 76, 0.05)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#0b2b4c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.6rem', color: '#2563eb' }}>domain</span>
            Directorio de Empresas & Cuentas Corporativas B2B ({tenantId.toUpperCase()})
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            Gestión de Empresas, RUC, Condiciones de Crédito y Múltiples Contactos Decisores con Mensajería WhatsApp Integrada.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleOpenCompanyModal()}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '9px',
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>add_business</span>
            + Dar de Alta Empresa B2B
          </button>

          <button
            onClick={fetchCompanies}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: '9px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              color: '#0b2b4c',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>refresh</span>
            Actualizar
          </button>
        </div>
      </div>

      {/* KPI Cards Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem'
      }}>
        <div style={{ backgroundColor: '#ffffff', padding: '1.1rem', borderRadius: '14px', border: '1px solid #e5e7eb', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Empresas Registradas</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0b2b4c', marginTop: '0.2rem' }}>{totalCompaniesCount}</div>
          <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, marginTop: '0.2rem' }}>🏢 Cuentas activas en CRM</div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '1.1rem', borderRadius: '14px', border: '1px solid #e5e7eb', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Contactos Decisores</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#2563eb', marginTop: '0.2rem' }}>{totalContactsCount}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, marginTop: '0.2rem' }}>👥 Compras, TI, Finanzas</div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '1.1rem', borderRadius: '14px', border: '1px solid #e5e7eb', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pipeline B2B Activo</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#059669', marginTop: '0.2rem' }}>${totalB2BPipelineValue.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span style={{ fontSize: '0.85rem' }}>USD</span></div>
          <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700, marginTop: '0.2rem' }}>💼 En proyectos corporativos</div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '1.1rem', borderRadius: '14px', border: '1px solid #e5e7eb', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cuentas con Crédito</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#7c3aed', marginTop: '0.2rem' }}>{creditCompaniesCount}</div>
          <div style={{ fontSize: '0.72rem', color: '#7c3aed', fontWeight: 700, marginTop: '0.2rem' }}>📄 15, 30 o 60 días</div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '0.85rem 1.25rem',
        border: '1px solid #e5e7eb',
        display: 'flex',
        gap: '1rem',
        alignItems: 'center'
      }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span className="material-symbols-outlined" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '1.2rem' }}>
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') fetchCompanies(); }}
            placeholder="Buscar por Razón Social, RUC, Industria, Asesor o Ciudad..."
            style={{
              width: '100%',
              padding: '0.65rem 0.85rem 0.65rem 2.4rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.88rem',
              color: '#0f172a',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <button
          onClick={fetchCompanies}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#0b2b4c',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer'
          }}
        >
          Buscar
        </button>
      </div>

      {/* Companies List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {loading && companies.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Cargando empresas corporativas...</div>
        ) : companies.length === 0 ? (
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '3rem 1.5rem',
            textAlign: 'center',
            border: '1px dashed #cbd5e1',
            color: '#64748b'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '3rem', color: '#94a3b8', marginBottom: '0.5rem' }}>domain_disabled</span>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#0b2b4c' }}>No se encontraron empresas B2B</h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem' }}>
              Registra las cuentas corporativas y decisores para empezar a darles seguimiento especializado.
            </p>
            <button
              onClick={() => handleOpenCompanyModal()}
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              + Registrar Primera Empresa
            </button>
          </div>
        ) : (
          companies.map(company => {
            const isExpanded = expandedCompanyIds.includes(company.id);
            const contactsList = companyContactsMap[company.id] || [];
            const isLoadingContacts = loadingContacts[company.id];

            return (
              <div
                key={company.id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '14px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Company Header Card */}
                <div style={{
                  padding: '1.1rem 1.4rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  backgroundColor: isExpanded ? '#f8fafc' : '#ffffff',
                  borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none'
                }}>
                  {/* Left: Company Main Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '280px' }}>
                    <div style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: '1.25rem',
                      border: '1px solid #bfdbfe',
                      flexShrink: 0
                    }}>
                      🏢
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0b2b4c' }}>
                          {company.name}
                        </h3>
                        {company.ruc_tax_id && (
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '6px',
                            backgroundColor: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            color: '#475569',
                            fontFamily: 'monospace'
                          }}>
                            RUC: {company.ruc_tax_id}
                          </span>
                        )}
                        {company.credit_terms && (
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '0.15rem 0.55rem',
                            borderRadius: '6px',
                            backgroundColor: company.credit_terms.toLowerCase().includes('crédito') ? '#f3e8ff' : '#ecfdf5',
                            color: company.credit_terms.toLowerCase().includes('crédito') ? '#7c3aed' : '#059669',
                            border: company.credit_terms.toLowerCase().includes('crédito') ? '1px solid #d8b4fe' : '1px solid #a7f3d0'
                          }}>
                            📄 {company.credit_terms}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.35rem', fontSize: '0.78rem', color: '#64748b', flexWrap: 'wrap' }}>
                        {company.industry && <span>🏭 {company.industry}</span>}
                        {company.assigned_agent_name && <span>👤 Asesor: <strong style={{ color: '#0b2b4c' }}>{company.assigned_agent_name}</strong></span>}
                        {company.phone && <span>📞 {company.phone}</span>}
                        {company.email && <span>✉️ {company.email}</span>}
                        {company.address && <span>📍 {company.address}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Right: Metrics and Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ textAlign: 'right', marginRight: '0.5rem' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>Pipeline B2B:</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#059669' }}>
                        ${(Number(company.total_pipeline_value) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenContactModal(company)}
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: '7px',
                        border: '1px solid #bfdbfe',
                        backgroundColor: '#eff6ff',
                        color: '#2563eb',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                      title="Agregar un nuevo contacto decisor a esta empresa"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>person_add</span>
                      + Contacto
                    </button>

                    <button
                      onClick={() => handleOpenCompanyModal(company)}
                      style={{
                        padding: '0.45rem 0.75rem',
                        borderRadius: '7px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#0b2b4c',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                      title="Editar Empresa"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>edit</span>
                      Editar
                    </button>

                    <button
                      onClick={() => handleDeleteCompany(company)}
                      style={{
                        padding: '0.45rem 0.6rem',
                        borderRadius: '7px',
                        border: '1px solid #fecaca',
                        backgroundColor: '#fef2f2',
                        color: '#dc2626',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        cursor: 'pointer'
                      }}
                      title="Eliminar Empresa"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>delete</span>
                    </button>

                    <button
                      onClick={() => toggleExpandCompany(company.id)}
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: '7px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: isExpanded ? '#0b2b4c' : '#f8fafc',
                        color: isExpanded ? '#ffffff' : '#0b2b4c',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>
                        {isExpanded ? 'expand_less' : 'expand_more'}
                      </span>
                      <span>Contactos ({company.contacts_count || contactsList.length || 0})</span>
                    </button>
                  </div>
                </div>

                {/* Collapsible Contacts Section (1 Company -> N Contacts) */}
                {isExpanded && (
                  <div style={{
                    padding: '1.25rem 1.5rem',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0b2b4c', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span className="material-symbols-outlined" style={{ color: '#2563eb', fontSize: '1.2rem' }}>badge</span>
                        Contactos y Decisores de {company.name} ({contactsList.length})
                      </h4>

                      <button
                        onClick={() => handleOpenContactModal(company)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: '#2563eb',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>add</span>
                        Agregar Contacto
                      </button>
                    </div>

                    {isLoadingContacts ? (
                      <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>Cargando contactos...</div>
                    ) : contactsList.length === 0 ? (
                      <div style={{
                        padding: '1.25rem',
                        backgroundColor: '#f8fafc',
                        borderRadius: '10px',
                        border: '1px dashed #cbd5e1',
                        textAlign: 'center',
                        color: '#64748b',
                        fontSize: '0.82rem'
                      }}>
                        No hay contactos registrados aún para esta empresa. Haz clic en "Agregar Contacto" para dar de alta al encargado de compras, TI o gerencia.
                      </div>
                    ) : (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                        gap: '0.85rem'
                      }}>
                        {contactsList.map(contact => (
                          <div
                            key={contact.id}
                            style={{
                              backgroundColor: '#f8fafc',
                              borderRadius: '10px',
                              padding: '0.85rem 1rem',
                              border: contact.is_primary ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.45rem',
                              position: 'relative'
                            }}
                          >
                            {/* Contact Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <strong style={{ fontSize: '0.92rem', color: '#0b2b4c' }}>{contact.name}</strong>
                                  {contact.is_primary && (
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.1rem 0.4rem', backgroundColor: '#eff6ff', color: '#1d4ed8', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                                      ⭐ Principal
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 700, marginTop: '0.15rem' }}>
                                  💼 {contact.role_title || 'Contacto Comercial'}
                                </div>
                              </div>

                              <span style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.45rem',
                                borderRadius: '6px',
                                backgroundColor: contact.decision_level === 'decisor' ? '#fef3c7' : '#f1f5f9',
                                color: contact.decision_level === 'decisor' ? '#92400e' : '#475569',
                                border: '1px solid #e2e8f0'
                              }}>
                                {contact.decision_level === 'decisor' ? 'Decisor Final' : contact.decision_level === 'evaluador_tecnico' ? 'Técnico / TI' : 'Comprador'}
                              </span>
                            </div>

                            {/* Contact Contact Details */}
                            <div style={{ fontSize: '0.78rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.2rem' }}>
                              {contact.phone && <div>📞 WhatsApp: <strong>{contact.phone}</strong></div>}
                              {contact.email && <div>✉️ Correo: {contact.email}</div>}
                              {contact.notes && <div style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic', marginTop: '0.15rem' }}>"{contact.notes}"</div>}
                            </div>

                            {/* Contact Actions Bar */}
                            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem' }}>
                              {contact.phone && (
                                <button
                                  onClick={() => handleInitiateWhatsApp(company, contact)}
                                  style={{
                                    flex: 1,
                                    padding: '0.4rem 0.6rem',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: '#10b981',
                                    color: '#ffffff',
                                    fontSize: '0.75rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.3rem'
                                  }}
                                  title="Iniciar conversación de WhatsApp"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>chat</span>
                                  WhatsApp
                                </button>
                              )}

                              {onOpenCreateOpportunity && (
                                <button
                                  onClick={() => onOpenCreateOpportunity({
                                    company_id: company.id,
                                    company_name: company.name,
                                    contact_id: contact.id,
                                    contact_name: contact.name,
                                    contact_phone: contact.phone
                                  })}
                                  style={{
                                    flex: 1,
                                    padding: '0.4rem 0.6rem',
                                    borderRadius: '6px',
                                    border: '1px solid #bfdbfe',
                                    backgroundColor: '#eff6ff',
                                    color: '#2563eb',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.25rem'
                                  }}
                                  title="Crear nueva oportunidad en el Pipeline B2B"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>add_task</span>
                                  + Oportunidad
                                </button>
                              )}

                              <button
                                onClick={() => handleOpenContactModal(company, contact)}
                                style={{
                                  padding: '0.4rem 0.5rem',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: '#ffffff',
                                  color: '#0b2b4c',
                                  cursor: 'pointer'
                                }}
                                title="Editar Contacto"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>edit</span>
                              </button>

                              <button
                                onClick={() => handleDeleteContact(company.id, contact)}
                                style={{
                                  padding: '0.4rem 0.5rem',
                                  borderRadius: '6px',
                                  border: '1px solid #fecaca',
                                  backgroundColor: '#fef2f2',
                                  color: '#dc2626',
                                  cursor: 'pointer'
                                }}
                                title="Eliminar Contacto"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>delete</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: CREATE / EDIT COMPANY */}
      {showCompanyModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(11, 43, 76, 0.55)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 3500,
          backdropFilter: 'blur(3px)'
        }}>
          <form onSubmit={handleSaveCompany} style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '600px',
            maxWidth: '94%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '1.75rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem' }}>
              <h3 style={{ margin: 0, color: '#0b2b4c', fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span className="material-symbols-outlined" style={{ color: '#2563eb' }}>business</span>
                {editingCompany ? 'Editar Empresa B2B' : '+ Registrar Nueva Empresa B2B'}
              </h3>
              <button
                type="button"
                onClick={() => setShowCompanyModal(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', fontSize: '1.25rem', fontWeight: 'bold' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                Razón Social / Nombre de la Empresa <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={compName}
                onChange={(e) => setCompName(e.target.value)}
                placeholder="Ej: Distribuidora Logística Central S.A."
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                  RUC / NIT / Cédula Jurídica
                </label>
                <input
                  type="text"
                  value={compRuc}
                  onChange={(e) => setCompRuc(e.target.value)}
                  placeholder="Ej: J0310000189445"
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                  Sector / Industria
                </label>
                <select
                  value={compIndustry}
                  onChange={(e) => setCompIndustry(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box', backgroundColor: '#fff' }}
                >
                  <option value="Tecnología & Telecomunicaciones">Tecnología & Telecomunicaciones</option>
                  <option value="Logística & Distribución">Logística & Distribución</option>
                  <option value="Construcción & Ferretería">Construcción & Ferretería</option>
                  <option value="Salud & Hospitales">Salud & Clínicas</option>
                  <option value="Banca, Seguros & Finanzas">Banca & Finanzas</option>
                  <option value="Comercio & Retail">Comercio & Retail</option>
                  <option value="Educación & Universidades">Educación & Universidades</option>
                  <option value="Agroindustria">Agroindustria</option>
                  <option value="Gobierno & Entidades Públicas">Gobierno & Entidades Públicas</option>
                  <option value="Servicios Profesionales">Servicios Profesionales</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                  Condiciones de Pago / Crédito
                </label>
                <select
                  value={compCreditTerms}
                  onChange={(e) => setCompCreditTerms(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box', backgroundColor: '#fff', fontWeight: 700, color: '#7c3aed' }}
                >
                  <option value="Contado / Inmediato">Contado / Inmediato</option>
                  <option value="Crédito 15 días">Crédito 15 días</option>
                  <option value="Crédito 30 días">Crédito 30 días</option>
                  <option value="Crédito 45 días">Crédito 45 días</option>
                  <option value="Crédito 60 días">Crédito 60 días</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                  Ejecutivo / Asesor B2B Asignado
                </label>
                <select
                  value={compAssignedAgent}
                  onChange={(e) => setCompAssignedAgent(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box', backgroundColor: '#fff' }}
                >
                  <option value="Sin Asignar">Sin Asignar (Cola B2B)</option>
                  {advisorsList.map(adv => (
                    <option key={adv.id || adv.email} value={adv.name || adv.email.split('@')[0]}>
                      {adv.name || adv.email.split('@')[0]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Teléfono Central / PBX</label>
                <input
                  type="text"
                  value={compPhone}
                  onChange={(e) => setCompPhone(e.target.value)}
                  placeholder="+505 2278 0000"
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Correo Central / Facturación</label>
                <input
                  type="email"
                  value={compEmail}
                  onChange={(e) => setCompEmail(e.target.value)}
                  placeholder="compras@empresa.com"
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Dirección Física / Sucursal Principal</label>
              <input
                type="text"
                value={compAddress}
                onChange={(e) => setCompAddress(e.target.value)}
                placeholder="Ej: Carretera a Masaya Km 4.5, Managua"
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Notas y Observaciones de la Cuenta</label>
              <textarea
                value={compNotes}
                onChange={(e) => setCompNotes(e.target.value)}
                rows={3}
                placeholder="Detalles sobre compras anuales, acuerdos de garantía o requerimientos especiales..."
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowCompanyModal(false)}
                style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={savingCompany}
                style={{ padding: '0.6rem 1.5rem', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
              >
                {savingCompany ? 'Guardando...' : editingCompany ? 'Actualizar Empresa' : 'Crear Empresa B2B'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: CREATE / EDIT CONTACT FOR COMPANY */}
      {showContactModal && targetCompanyForContact && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(11, 43, 76, 0.55)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 3600,
          backdropFilter: 'blur(3px)'
        }}>
          <form onSubmit={handleSaveContact} style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '540px',
            maxWidth: '94%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '1.75rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#0b2b4c', fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span className="material-symbols-outlined" style={{ color: '#2563eb' }}>person_add</span>
                  {editingContact ? 'Editar Contacto Decisor' : '+ Nuevo Contacto Decisor'}
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
                  Empresa: <strong style={{ color: '#0b2b4c' }}>{targetCompanyForContact.name}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', fontSize: '1.25rem', fontWeight: 'bold' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                Nombre y Apellido <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Ej: Lic. Martha Delgado"
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                  Cargo / Puesto
                </label>
                <input
                  type="text"
                  value={contactRoleTitle}
                  onChange={(e) => setContactRoleTitle(e.target.value)}
                  placeholder="Ej: Gerente de Compras / Director TI"
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                  Nivel de Decisión
                </label>
                <select
                  value={contactDecisionLevel}
                  onChange={(e) => setContactDecisionLevel(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box', backgroundColor: '#fff' }}
                >
                  <option value="decisor">⭐ Decisor Final (Aprueba Presupuesto)</option>
                  <option value="evaluador_tecnico">💡 Evaluador Técnico / TI</option>
                  <option value="comprador">🛒 Comprador / Operativo</option>
                  <option value="usuario_final">👤 Usuario Final / Solicitante</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                  Teléfono / WhatsApp Directo <span style={{ color: '#2563eb' }}>*</span>
                </label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+505 8888 1234"
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box', fontWeight: 700, color: '#0b2b4c' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="mdelgado@empresa.com"
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <input
                type="checkbox"
                id="is_primary_checkbox"
                checked={contactIsPrimary}
                onChange={(e) => setContactIsPrimary(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="is_primary_checkbox" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0b2b4c', cursor: 'pointer' }}>
                Marcar como Contacto Principal de la Empresa
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Notas sobre este contacto</label>
              <textarea
                value={contactNotes}
                onChange={(e) => setContactNotes(e.target.value)}
                rows={2}
                placeholder="Horario de atención preferido, canal de comunicación favorito..."
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={savingContact}
                style={{ padding: '0.6rem 1.5rem', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
              >
                {savingContact ? 'Guardando...' : editingContact ? 'Actualizar Contacto' : 'Guardar Contacto'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
