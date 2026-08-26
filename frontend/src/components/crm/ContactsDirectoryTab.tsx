import React, { useState, useEffect } from 'react';

interface ContactsDirectoryTabProps {
  tenantId: string;
  token: string | null;
  role: string | null;
  onOpenChat: (conversationId?: string) => void;
  onOpenOpportunityModal?: (contactData: { id: number; name: string; phone?: string; email?: string }) => void;
}

interface ChatwootContact {
  id: number;
  name: string;
  email?: string;
  phone_number?: string;
  thumbnail?: string;
  custom_attributes?: Record<string, any>;
  labels?: string[];
  last_activity_at?: number | string;
  created_at?: number | string;
}

interface SavedList {
  id: number;
  tenant_id: string;
  name: string;
  filter_query?: string;
  contact_ids?: number[];
  created_at: string;
}

export const ContactsDirectoryTab: React.FC<ContactsDirectoryTabProps> = ({
  tenantId,
  token,
  role,
  onOpenChat,
  onOpenOpportunityModal
}) => {
  const [contacts, setContacts] = useState<ChatwootContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Saved Lists (Listas de Seguimiento)
  const [savedLists, setSavedLists] = useState<SavedList[]>([]);
  const [activeListId, setActiveListId] = useState<number | 'all'>('all');
  const [showSaveListModal, setShowSaveListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [savingList, setSavingList] = useState(false);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Team members (Asesores)
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  // Available Tenant Labels
  const [tenantLabels, setTenantLabels] = useState<any[]>([]);

  // Edit Contact Modal State
  const [editingContact, setEditingContact] = useState<ChatwootContact | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [customFields, setCustomFields] = useState<Array<{ key: string; value: string }>>([]);
  const [contactLabels, setContactLabels] = useState<string[]>([]);
  const [newLabelInput, setNewLabelInput] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchContacts = async (pageNumber = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/control/${tenantId}/contacts?page=${pageNumber}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const list = data.payload || data || [];
        setContacts(list);
        setTotalCount(data.meta?.count || list.length);
      }
    } catch (e) {
      console.error('Error fetching contacts:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedLists = async () => {
    try {
      const res = await fetch(`/api/control/${tenantId}/contact-lists`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSavedLists(data);
      }
    } catch (e) {
      console.error('Error fetching saved lists:', e);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const res = await fetch(`/api/control/${tenantId}/team-members`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data);
      }
    } catch (e) {
      console.error('Error fetching team members:', e);
    }
  };

  const fetchTenantLabels = async () => {
    try {
      const res = await fetch(`/api/control/${tenantId}/labels`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTenantLabels(data || []);
      }
    } catch (e) {
      console.error('Error fetching tenant labels:', e);
    }
  };

  useEffect(() => {
    fetchContacts(page);
    fetchSavedLists();
    fetchTeamMembers();
    fetchTenantLabels();
  }, [tenantId, token, page]);

  // Extract unique companies for normalization dropdown
  const existingCompanies = Array.from(new Set(
    contacts
      .map(c => c.custom_attributes?.empresa || c.custom_attributes?.company)
      .filter((comp): comp is string => Boolean(comp && comp.trim()))
  )).sort();

  // Handle Save Custom List
  const handleSaveList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    setSavingList(true);
    try {
      const res = await fetch(`/api/control/${tenantId}/contact-lists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newListName.trim(),
          filter_query: searchQuery,
          contact_ids: selectedIds
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error creando lista');

      showToast(`¡Lista de seguimiento '${newListName}' guardada con éxito!`);
      setNewListName('');
      setShowSaveListModal(false);
      fetchSavedLists();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingList(false);
    }
  };

  const handleDeleteList = async (listId: number) => {
    try {
      const res = await fetch(`/api/control/${tenantId}/contact-lists/${listId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Lista de seguimiento eliminada.');
        if (activeListId === listId) setActiveListId('all');
        fetchSavedLists();
      }
    } catch (e) {
      console.error('Error deleting list:', e);
    }
  };

  // Edit Contact Handlers
  const handleOpenEditModal = (contact: ChatwootContact) => {
    setEditingContact(contact);
    setEditName(contact.name || '');
    setEditEmail(contact.email || '');
    setEditPhone(contact.phone_number || '');
    setContactLabels(contact.labels || []);

    const attrs = contact.custom_attributes || {};
    const fieldsArray: Array<{ key: string; value: string }> = [
      { key: 'empresa', value: attrs.empresa || attrs.company || '' },
      { key: 'ruc_cedula', value: attrs.ruc_cedula || attrs.ruc || '' },
      { key: 'tipo_cliente', value: attrs.tipo_cliente || attrs.client_type || 'Retail' },
      { key: 'lead_score', value: attrs.lead_score || 'Frío' },
      { key: 'cargo', value: attrs.cargo || attrs.role || '' },
      { key: 'ciudad_direccion', value: attrs.ciudad_direccion || attrs.address || '' },
      { key: 'presupuesto_usd', value: attrs.presupuesto_usd || attrs.budget || '' },
      { key: 'notas_asesor', value: attrs.notas_asesor || attrs.notes || '' }
    ];

    Object.keys(attrs).forEach(k => {
      if (!['empresa', 'company', 'ruc_cedula', 'ruc', 'tipo_cliente', 'client_type', 'lead_score', 'cargo', 'role', 'ciudad_direccion', 'address', 'presupuesto_usd', 'budget', 'notas_asesor', 'notes'].includes(k)) {
        fieldsArray.push({ key: k, value: String(attrs[k]) });
      }
    });

    setCustomFields(fieldsArray);
    setNewLabelInput('');
    setNewKey('');
    setNewValue('');
  };

  const handleAddLabel = (tag: string) => {
    const cleanTag = tag.trim().toLowerCase().replace(/\s+/g, '_');
    if (cleanTag && !contactLabels.includes(cleanTag)) {
      setContactLabels(prev => [...prev, cleanTag]);
    }
    setNewLabelInput('');
  };

  const handleRemoveLabel = (tag: string) => {
    setContactLabels(prev => prev.filter(t => t !== tag));
  };

  const handleAddCustomField = () => {
    if (!newKey.trim()) return;
    const sanitizedKey = newKey.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    setCustomFields(prev => [...prev, { key: sanitizedKey, value: newValue }]);
    setNewKey('');
    setNewValue('');
  };

  const handleRemoveCustomField = (index: number) => {
    setCustomFields(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact) return;
    setSavingContact(true);

    try {
      const customAttrsObj: Record<string, any> = {};
      customFields.forEach(f => {
        if (f.key.trim() && f.value.trim()) {
          customAttrsObj[f.key.trim()] = f.value.trim();
        }
      });

      const res = await fetch(`/api/control/${tenantId}/contacts/${editingContact.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editName,
          email: editEmail || null,
          phone_number: editPhone || null,
          custom_attributes: customAttrsObj,
          labels: contactLabels
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error actualizando contacto');

      showToast(`Contacto '${editName}' actualizado con éxito!`);
      setEditingContact(null);
      fetchContacts(page);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingContact(false);
    }
  };

  // Bulk Selection Handlers
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredContacts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredContacts.map(c => c.id));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // Export CSV
  const handleExportCSV = () => {
    const targetContacts = selectedIds.length > 0 
      ? contacts.filter(c => selectedIds.includes(c.id))
      : filteredContacts;

    if (targetContacts.length === 0) return;

    const headers = ['ID', 'Nombre', 'Teléfono', 'Correo', 'Empresa', 'RUC', 'Tipo Cliente', 'Lead Score', 'Etiquetas'];
    const rows = targetContacts.map(c => {
      const attrs = c.custom_attributes || {};
      return [
        c.id,
        `"${c.name || ''}"`,
        `"${c.phone_number || ''}"`,
        `"${c.email || ''}"`,
        `"${attrs.empresa || attrs.company || ''}"`,
        `"${attrs.ruc_cedula || attrs.ruc || ''}"`,
        `"${attrs.tipo_cliente || attrs.client_type || ''}"`,
        `"${attrs.lead_score || 'Frío'}"`,
        `"${(c.labels || []).join('; ')}"`
      ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `contactos_${tenantId}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`¡${targetContacts.length} contactos exportados a CSV!`);
  };

  // Filter Contacts by Active Saved List or Search Query
  const currentSavedList = savedLists.find(l => l.id === activeListId);

  const filteredContacts = contacts.filter(c => {
    if (currentSavedList && currentSavedList.contact_ids && currentSavedList.contact_ids.length > 0) {
      if (!currentSavedList.contact_ids.includes(c.id)) return false;
    }

    const effectiveQuery = searchQuery.trim() || (currentSavedList?.filter_query || '');
    if (!effectiveQuery) return true;

    const q = effectiveQuery.toLowerCase();
    const attrsStr = JSON.stringify(c.custom_attributes || {}).toLowerCase();
    const labelsStr = (c.labels || []).join(' ').toLowerCase();

    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.phone_number && c.phone_number.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      attrsStr.includes(q) ||
      labelsStr.includes(q)
    );
  });

  const formatLastActivity = (timestamp?: number | string) => {
    if (!timestamp) return '📅 Hoy';
    try {
      const date = typeof timestamp === 'number' 
        ? (timestamp > 10000000000 ? new Date(timestamp) : new Date(timestamp * 1000))
        : new Date(timestamp);
      if (isNaN(date.getTime())) return '📅 Hoy';
      
      const now = new Date();
      const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
      
      if (diffHours < 1) return '⚡ Hace unos mins';
      if (diffHours < 24) return `🕒 Hace ${diffHours}h`;
      if (diffHours < 48) return '📅 Ayer';
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return '📅 Hoy';
    }
  };

  return (
    <div className="glass-card" style={{ animation: 'fadeIn 0.2s ease-out' }}>
      {/* HTML Datalist for Company Normalization */}
      <datalist id="company-options">
        {existingCompanies.map((comp, idx) => (
          <option key={idx} value={comp} />
        ))}
      </datalist>

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

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 className="card-title" style={{ color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '1.6rem' }}>contacts</span>
            Directorio de Contactos & Listas de Seguimiento ({tenantId.toUpperCase()})
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Normalización de empresas, etiquetas personalizadas y listas de seguimiento clasificadas por Lead Score.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleExportCSV}
            style={{
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--surface-subtle)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>download</span>
            Exportar CSV
          </button>

          <button
            onClick={() => onOpenChat()}
            className="btn-primary"
            style={{ background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>forum</span>
            Bandeja En Vivo
          </button>
        </div>
      </div>

      {/* SUB-NAV: Saved Lists Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '0.35rem' }}>
        <button
          onClick={() => setActiveListId('all')}
          style={{
            padding: '0.55rem 1rem',
            border: 'none',
            borderBottom: activeListId === 'all' ? '2px solid var(--color-primary)' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: activeListId === 'all' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeListId === 'all' ? 800 : 600,
            fontSize: '0.85rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>group</span>
          Todos los Contactos ({totalCount})
        </button>

        {savedLists.map(sl => (
          <div key={sl.id} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <button
              onClick={() => setActiveListId(sl.id)}
              style={{
                padding: '0.55rem 0.85rem',
                border: 'none',
                borderBottom: activeListId === sl.id ? '2px solid var(--status-success-solid)' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: activeListId === sl.id ? 'var(--status-success-solid)' : 'var(--text-secondary)',
                fontWeight: activeListId === sl.id ? 800 : 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--status-success-solid)' }}>bookmark</span>
              {sl.name}
            </button>
            {role !== 'readonly' && (
              <button
                onClick={() => handleDeleteList(sl.id)}
                title="Eliminar Lista"
                style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', padding: '0.1rem 0.3rem' }}
              >
                ✕
              </button>
            )}
          </div>
        ))}

        {role !== 'readonly' && (
          <button
            onClick={() => setShowSaveListModal(true)}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '6px',
              border: '1px dashed var(--border-subtle)',
              backgroundColor: 'rgba(0, 206, 255, 0.12)',
              color: 'var(--color-accent)',
              fontWeight: 700,
              fontSize: '0.78rem',
              cursor: 'pointer',
              marginLeft: '0.5rem',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>bookmark_add</span>
            Guardar Vista como Lista
          </button>
        )}
      </div>

      {/* Floating Action Bar when bulk items selected */}
      {selectedIds.length > 0 && (
        <div style={{
          backgroundColor: 'var(--surface-card)',
          color: 'var(--text-primary)',
          padding: '0.75rem 1.25rem',
          borderRadius: '10px',
          border: '1px solid var(--border-subtle)',
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          boxShadow: 'var(--shadow-card)',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{ fontWeight: 800, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-accent)' }}>check_box</span>
            {selectedIds.length} contacto(s) seleccionado(s)
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={() => setShowSaveListModal(true)}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'var(--status-success-solid)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>bookmark</span>
              Crear Lista de Seguimiento
            </button>

            <button
              onClick={handleExportCSV}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--surface-subtle)',
                color: 'var(--text-primary)',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>download</span>
              Exportar Seleccionados
            </button>

            <button
              onClick={() => setSelectedIds([])}
              style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
            >
              Cancelar Selección
            </button>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        backgroundColor: 'var(--surface-card)',
        padding: '0.75rem 1rem',
        borderRadius: '10px',
        border: '1px solid var(--border-subtle)',
        marginBottom: '1.25rem',
        alignItems: 'center'
      }}>
        <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)', fontSize: '1.25rem' }}>search</span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por Nombre, Teléfono, Correo, RUC, Empresa, Etiqueta..."
          style={{
            flex: 1,
            border: 'none',
            backgroundColor: 'transparent',
            fontSize: '0.88rem',
            color: 'var(--text-primary)',
            outline: 'none'
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕ Limpiar Filtro
          </button>
        )}
      </div>

      {/* Table for Desktop View */}
      <div className="hide-mobile" style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '10px', backgroundColor: 'var(--surface-card)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--surface-subtle)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
              <th style={{ padding: '0.85rem 0.5rem 0.85rem 1rem', width: '38px' }}>
                <input
                  type="checkbox"
                  checked={filteredContacts.length > 0 && selectedIds.length === filteredContacts.length}
                  onChange={toggleSelectAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th style={{ padding: '0.85rem 1rem' }}>Nombre</th>
              <th style={{ padding: '0.85rem 1rem' }}>Teléfono</th>
              <th style={{ padding: '0.85rem 1rem' }}>Correo Electrónico</th>
              <th style={{ padding: '0.85rem 1rem' }}>Lead Score</th>
              <th style={{ padding: '0.85rem 1rem' }}>Empresa Normalizada</th>
              <th style={{ padding: '0.85rem 1rem' }}>Última Actividad</th>
              <th style={{ padding: '0.85rem 1rem' }}>Asesor Asignado</th>
              <th style={{ padding: '0.85rem 1rem' }}>Etiquetas del Contacto</th>
              <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Cargando directorio de contactos...
                </td>
              </tr>
            ) : filteredContacts.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {searchQuery ? 'No se encontraron contactos que coincidan con el filtro.' : 'No hay contactos en esta lista de seguimiento.'}
                </td>
              </tr>
            ) : (
              filteredContacts.map((c) => {
                const attrs = c.custom_attributes || {};
                const empresa = attrs.empresa || attrs.company;
                const ruc = attrs.ruc_cedula || attrs.ruc;
                const leadScore = attrs.lead_score || 'Frío';
                const labelsList = c.labels || [];
                const isSelected = selectedIds.includes(c.id);

                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: isSelected ? 'rgba(0, 206, 255, 0.08)' : 'transparent', transition: 'background-color 0.15s' }}>
                    <td style={{ padding: '0.85rem 0.5rem 0.85rem 1rem' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(c.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(0, 206, 255, 0.12)',
                          color: 'var(--color-accent)',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          fontWeight: 800,
                          fontSize: '0.82rem',
                          border: '1px solid rgba(0, 206, 255, 0.25)'
                        }}>
                          {(c.name || 'C')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{c.name || 'Contacto sin nombre'}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>ID: #{c.id}</div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-accent)' }}>
                      {c.phone_number ? `📱 ${c.phone_number}` : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin teléfono</span>}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                      {c.email || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin correo</span>}
                    </td>

                    {/* Lead Score */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '12px',
                        fontWeight: 800,
                        backgroundColor: leadScore === 'Caliente' ? 'var(--status-danger-bg)' : leadScore === 'Tibio' ? 'var(--status-warning-bg)' : 'var(--surface-subtle)',
                        color: leadScore === 'Caliente' ? 'var(--status-danger-solid)' : leadScore === 'Tibio' ? 'var(--status-warning-solid)' : 'var(--text-secondary)',
                        border: `1px solid ${leadScore === 'Caliente' ? 'var(--status-danger-border)' : leadScore === 'Tibio' ? 'var(--status-warning-border)' : 'var(--border-subtle)'}`
                      }}>
                        {leadScore === 'Caliente' ? '🔥 Caliente' : leadScore === 'Tibio' ? '⚡ Tibio' : '❄️ Frío'}
                      </span>
                    </td>

                    {/* Empresa Normalizada (Clickable to Filter Company) */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {empresa ? (
                        <div
                          onClick={() => setSearchQuery(empresa)}
                          title={`Hacer clic para filtrar todos los contactos de ${empresa}`}
                          style={{
                            fontWeight: 800,
                            color: 'var(--color-accent)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            flexDirection: 'column',
                            padding: '0.2rem 0.4rem',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(0, 206, 255, 0.12)',
                            border: '1px solid rgba(0, 206, 255, 0.25)'
                          }}
                        >
                          <span>🏢 {empresa}</span>
                          {ruc && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>RUC: {ruc}</span>}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin empresa</span>
                      )}
                    </td>

                    {/* Última Actividad */}
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatLastActivity(c.last_activity_at || c.created_at)}
                    </td>

                    {/* Asesor Asignado Dropdown */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <select
                        defaultValue={teamMembers[0]?.id || ''}
                        style={{
                          padding: '0.35rem 0.5rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle)',
                          fontSize: '0.78rem',
                          color: 'var(--text-primary)',
                          backgroundColor: 'var(--surface-subtle)',
                          fontWeight: 600
                        }}
                      >
                        <option value="">Sin asignar</option>
                        {teamMembers.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </td>

                    {/* Contact Labels / Etiquetas */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                        {labelsList.length > 0 ? (
                          labelsList.map((tag, idx) => (
                            <span key={idx} style={{
                              fontSize: '0.7rem',
                              padding: '0.15rem 0.45rem',
                              backgroundColor: 'rgba(142, 36, 208, 0.15)',
                              color: 'var(--color-accent)',
                              borderRadius: '12px',
                              border: '1px solid rgba(142, 36, 208, 0.35)',
                              fontWeight: 700
                            }}>
                              🏷️ {tag}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin etiquetas</span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                        <button
                          onClick={() => onOpenChat()}
                          title="Abrir Chat"
                          style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: 'none', background: 'var(--gradient-primary)', color: '#ffffff', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          💬
                        </button>

                        {role !== 'readonly' && (
                          <button
                            onClick={() => handleOpenEditModal(c)}
                            title="Editar Datos, Empresa y Etiquetas"
                            style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-subtle)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
                          >
                            ✏️
                          </button>
                        )}

                        {onOpenOpportunityModal && (
                          <button
                            onClick={() => onOpenOpportunityModal({ id: c.id, name: c.name, phone: c.phone_number, email: c.email })}
                            title="Crear Oportunidad CRM"
                            style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid var(--status-success-border)', backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-solid)', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
                          >
                            ➕ CRM
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MOBILE RESPONSIVE CONTACT CARDS */}
      <div className="hide-desktop" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando contactos...</div>
        ) : filteredContacts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No hay contactos disponibles.</div>
        ) : (
          filteredContacts.map(c => {
            const attrs = c.custom_attributes || {};
            const score = attrs.lead_score || 'Sin Calificar';
            const company = attrs.empresa || attrs.company || '';

            return (
              <div key={c.id} style={{
                backgroundColor: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{c.name || 'Sin Nombre'}</div>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.55rem',
                    borderRadius: '12px',
                    backgroundColor: score === 'Caliente' ? 'var(--status-danger-bg)' : score === 'Tibio' ? 'var(--status-warning-bg)' : 'var(--surface-subtle)',
                    color: score === 'Caliente' ? 'var(--status-danger-solid)' : score === 'Tibio' ? 'var(--status-warning-solid)' : 'var(--text-secondary)'
                  }}>
                    {score}
                  </span>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--color-accent)', fontWeight: 700 }}>
                  📞 {c.phone_number || 'Sin Teléfono'}
                </div>

                {c.email && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>✉️ {c.email}</div>}
                {company && <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600 }}>🏢 {company}</div>}

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                  <button
                    onClick={() => handleOpenEditModal(c)}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--surface-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    ✏️ Editar Ficha
                  </button>
                  {onOpenOpportunityModal && (
                    <button
                      onClick={() => onOpenOpportunityModal({ id: c.id, name: c.name, phone: c.phone_number, email: c.email })}
                      style={{
                        padding: '0.5rem 0.85rem',
                        borderRadius: '8px',
                        border: '1px solid var(--status-success-border)',
                        backgroundColor: 'var(--status-success-bg)',
                        color: 'var(--status-success-solid)',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      ➕ CRM
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          Página {page} (Mostrando {filteredContacts.length} de {totalCount} contactos totales)
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setPage(p => Math.max(p - 1, 1))}
            disabled={page === 1}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: page === 1 ? 'var(--surface-subtle)' : 'var(--surface-card)',
              color: page === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
              fontWeight: 700,
              fontSize: '0.78rem',
              cursor: page === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            ◀ Anterior
          </button>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={filteredContacts.length < 15 && totalCount <= page * 15}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: (filteredContacts.length < 15 && totalCount <= page * 15) ? 'var(--surface-subtle)' : 'var(--surface-card)',
              color: (filteredContacts.length < 15 && totalCount <= page * 15) ? 'var(--text-muted)' : 'var(--text-primary)',
              fontWeight: 700,
              fontSize: '0.78rem',
              cursor: (filteredContacts.length < 15 && totalCount <= page * 15) ? 'not-allowed' : 'pointer'
            }}
          >
            Siguiente ▶
          </button>
        </div>
      </div>

      {/* Save List Modal */}
      {showSaveListModal && (
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
          zIndex: 999
        }}>
          <div style={{ backgroundColor: 'var(--surface-card)', padding: '1.5rem', borderRadius: '14px', width: '100%', maxWidth: '450px', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 800 }}>
              💾 Guardar Lista de Seguimiento
            </h3>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Guarda este filtro o los contactos seleccionados como una pestaña permanente para tus asesores.
            </p>

            <form onSubmit={handleSaveList} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Nombre de la Lista</label>
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="ej. 🎯 Prospectos Managua B2B"
                  required
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-subtle)', color: 'var(--text-primary)' }}
                />
              </div>

              {selectedIds.length > 0 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--status-success-solid)', fontWeight: 700 }}>
                  ✓ Se vincularán {selectedIds.length} contacto(s) seleccionados.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowSaveListModal(false)}
                  style={{ padding: '0.55rem 1rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-subtle)', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingList}
                  style={{ padding: '0.55rem 1.25rem', borderRadius: '6px', border: 'none', background: 'var(--gradient-primary)', color: '#ffffff', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  {savingList ? 'Guardando...' : 'Guardar Lista ✓'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Contact Modal */}
      {editingContact && (
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
          padding: '1.5rem',
          boxSizing: 'border-box'
        }}>
          <div className="glass-card" style={{
            width: '100%',
            maxWidth: '650px',
            backgroundColor: 'var(--surface-card)',
            borderRadius: '16px',
            boxShadow: 'var(--shadow-card)',
            border: '1px solid var(--border-subtle)',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ backgroundColor: 'var(--surface-subtle)', padding: '1.25rem 1.5rem', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>✏️ Editar Contacto, Empresa & Etiquetas</h3>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: 'var(--color-accent)' }}>Sincronizado con Chatwoot y PostgreSQL (ID: #{editingContact.id})</p>
              </div>
              <button onClick={() => setEditingContact(null)} style={{ border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleSaveContact} style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Nombre del Contacto</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} required style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-subtle)', color: 'var(--text-primary)' }} />
                </div>
                <div className="form-group">
                  <label style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Teléfono WhatsApp</label>
                  <input type="text" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+50588885707" style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-subtle)', color: 'var(--text-primary)', fontFamily: 'monospace' }} />
                </div>
              </div>

              <div className="form-group">
                <label style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Correo Electrónico</label>
                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="ej. cliente@empresa.com" style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-subtle)', color: 'var(--text-primary)' }} />
              </div>

              {/* CONTACT LABELS (ETIQUETAS) SECTION */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                <h4 style={{ margin: '0 0 0.6rem 0', color: 'var(--color-accent)', fontSize: '0.92rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  🏷️ Etiquetas del Contacto (Tags)
                </h4>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  {contactLabels.map((lbl, idx) => (
                    <span key={idx} style={{
                      fontSize: '0.78rem',
                      padding: '0.25rem 0.6rem',
                      backgroundColor: 'rgba(142, 36, 208, 0.15)',
                      color: 'var(--color-accent)',
                      borderRadius: '14px',
                      border: '1px solid rgba(142, 36, 208, 0.35)',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}>
                      🏷️ {lbl}
                      <button
                        type="button"
                        onClick={() => handleRemoveLabel(lbl)}
                        style={{ border: 'none', background: 'none', color: 'var(--status-danger-solid)', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  {contactLabels.length === 0 && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin etiquetas asignadas.</span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={newLabelInput}
                    onChange={(e) => setNewLabelInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddLabel(newLabelInput);
                      }
                    }}
                    placeholder="Escribe una etiqueta (ej. cliente_eurocomp)..."
                    style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-subtle)', color: 'var(--text-primary)', fontSize: '0.82rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddLabel(newLabelInput)}
                    style={{ padding: '0.5rem 0.85rem', borderRadius: '6px', border: 'none', background: 'var(--gradient-primary)', color: '#ffffff', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}
                  >
                    + Añadir Etiqueta
                  </button>
                </div>

                {/* Suggestions from tenant labels */}
                {tenantLabels.length > 0 && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Sugeridos:</span>
                    {tenantLabels.slice(0, 6).map((tl, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleAddLabel(tl.title)}
                        style={{ padding: '0.15rem 0.45rem', fontSize: '0.7rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-subtle)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                      >
                        + {tl.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* CUSTOM ATTRIBUTES SECTION */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                <h4 style={{ margin: '0 0 0.85rem 0', color: 'var(--color-primary)', fontSize: '0.92rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>tune</span>
                  Atributos Personalizados Estandarizados (Custom Attributes)
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  {customFields.map((field, idx) => {
                    const isLeadScore = field.key === 'lead_score';
                    const isTipoCliente = field.key === 'tipo_cliente';
                    const isEmpresa = field.key === 'empresa';

                    return (
                      <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <div style={{ width: '35%', fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-secondary)', backgroundColor: 'var(--surface-subtle)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                          {field.key.replace(/_/g, ' ').toUpperCase()}
                        </div>

                        {isLeadScore ? (
                          <select
                            value={field.value || 'Frío'}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomFields(prev => prev.map((f, i) => i === idx ? { ...f, value: val } : f));
                            }}
                            style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-card)', fontSize: '0.82rem', fontWeight: 800, color: field.value === 'Caliente' ? 'var(--status-danger-solid)' : field.value === 'Tibio' ? 'var(--status-warning-solid)' : 'var(--text-secondary)' }}
                          >
                            <option value="Frío">❄️ Frío (Bajo Interés / Inicial)</option>
                            <option value="Tibio">⚡ Tibio (Consulta Activa / Interesado)</option>
                            <option value="Caliente">🔥 Caliente (Alta Intención de Compra / Cotizado)</option>
                            <option value="Descalificado">🚫 Descalificado (Sin Interés / Spam)</option>
                          </select>
                        ) : isTipoCliente ? (
                          <select
                            value={field.value || 'Retail'}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomFields(prev => prev.map((f, i) => i === idx ? { ...f, value: val } : f));
                            }}
                            style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-card)', fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-primary)' }}
                          >
                            <option value="Retail">👤 Retail (Consumidor Final)</option>
                            <option value="Corporativo B2B">🏢 Corporativo B2B (Empresa)</option>
                            <option value="Gobierno">🏛️ Gobierno / Institución Pública</option>
                            <option value="Mayorista">📦 Mayorista / Distribuidor</option>
                            <option value="VIP">⭐ VIP / Cuenta Clave</option>
                          </select>
                        ) : isEmpresa ? (
                          <input
                            type="text"
                            list="company-options"
                            value={field.value}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomFields(prev => prev.map((f, i) => i === idx ? { ...f, value: val } : f));
                            }}
                            placeholder="Selecciona o escribe el nombre de la Empresa..."
                            style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-card)', fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-accent)' }}
                          />
                        ) : (
                          <input
                            type="text"
                            value={field.value}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomFields(prev => prev.map((f, i) => i === idx ? { ...f, value: val } : f));
                            }}
                            placeholder={`Valor para ${field.key}`}
                            style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-card)', color: 'var(--text-primary)', fontSize: '0.82rem' }}
                          />
                        )}

                        <button type="button" onClick={() => handleRemoveCustomField(idx)} style={{ border: 'none', background: 'none', color: 'var(--status-danger-solid)', cursor: 'pointer', fontWeight: 'bold' }}>🗑️</button>
                      </div>
                    );
                  })}
                </div>

                {/* Add New Custom Attribute */}
                <div style={{ backgroundColor: 'var(--surface-subtle)', padding: '0.85rem', borderRadius: '8px', border: '1px dashed var(--border-subtle)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="text" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="Nuevo campo (ej. ruc, empresa)" style={{ width: '40%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-card)', color: 'var(--text-primary)', fontSize: '0.8rem' }} />
                  <input type="text" value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Valor inicial..." style={{ flex: 1, padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-card)', color: 'var(--text-primary)', fontSize: '0.8rem' }} />
                  <button type="button" onClick={handleAddCustomField} style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', border: 'none', backgroundColor: 'var(--status-success-solid)', color: '#ffffff', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>➕ Agregar Campo</button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setEditingContact(null)} style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-subtle)', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={savingContact} style={{ padding: '0.6rem 1.5rem', borderRadius: '8px', border: 'none', background: 'var(--gradient-primary)', color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}>{savingContact ? 'Guardando...' : 'Guardar Cambios ✓'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
