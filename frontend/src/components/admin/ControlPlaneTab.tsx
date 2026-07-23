import React, { useState, useEffect } from 'react';

interface ControlPlaneTabProps {
  tenantId: string;
  token: string | null;
  role: string | null;
}

interface LabelItem {
  id: number;
  title: string;
  description: string;
  color: string;
  show_on_sidebar: boolean;
}

interface InboxItem {
  id: number;
  name: string;
  channel_type: string;
  website_token?: string;
}

interface MetaTemplateItem {
  name: string;
  category: string;
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  components: any[];
}

export const ControlPlaneTab: React.FC<ControlPlaneTabProps> = ({ tenantId, token, role }) => {
  const [activeSection, setActiveSection] = useState<'labels' | 'channels' | 'templates'>('labels');

  // Labels state
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [fetchingLabels, setFetchingLabels] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newColor, setNewColor] = useState('#2563eb');
  const [creatingLabel, setCreatingLabel] = useState(false);

  // Channels state
  const [inboxes, setInboxes] = useState<InboxItem[]>([]);
  const [fetchingInboxes, setFetchingInboxes] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'web_widget' | 'api'>('web_widget');
  const [newWebsiteUrl, setNewWebsiteUrl] = useState('');
  const [creatingChannel, setCreatingChannel] = useState(false);

  // Meta Templates state
  const [templates, setTemplates] = useState<MetaTemplateItem[]>([]);
  const [fetchingTemplates, setFetchingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MetaTemplateItem | null>(null);
  const [targetConversationId, setTargetConversationId] = useState('');
  const [param1, setParam1] = useState('');
  const [param2, setParam2] = useState('');
  const [param3, setParam3] = useState('');
  const [sendingTemplate, setSendingTemplate] = useState(false);

  // Toast / Feedback
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  // --- API CALLS ---
  const fetchLabels = async () => {
    setFetchingLabels(true);
    try {
      const res = await fetch(`/api/control/${tenantId}/labels`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLabels(data);
      }
    } catch (e) {
      console.error('Error fetching labels:', e);
    } finally {
      setFetchingLabels(false);
    }
  };

  const handleCreateLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;
    setCreatingLabel(true);
    try {
      const res = await fetch(`/api/control/${tenantId}/labels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          color: newColor,
          show_on_sidebar: true
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error creando etiqueta');
      showToast(`Etiqueta '${newTitle}' creada exitosamente en Chatwoot!`);
      setNewTitle('');
      setNewDescription('');
      fetchLabels();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setCreatingLabel(false);
    }
  };

  const handleDeleteLabel = async (title: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar la etiqueta '${title}'?`)) return;
    try {
      const res = await fetch(`/api/control/${tenantId}/labels/${encodeURIComponent(title)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error eliminando etiqueta');
      showToast(`Etiqueta '${title}' eliminada.`);
      fetchLabels();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const fetchInboxes = async () => {
    setFetchingInboxes(true);
    try {
      const res = await fetch(`/api/control/${tenantId}/inboxes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInboxes(data);
      }
    } catch (e) {
      console.error('Error fetching inboxes:', e);
    } finally {
      setFetchingInboxes(false);
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName) return;
    setCreatingChannel(true);
    try {
      const res = await fetch(`/api/control/${tenantId}/inboxes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newChannelName,
          channel_type: newChannelType,
          website_url: newWebsiteUrl || 'https://sicsa.com.ni'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error creando canal');
      showToast(`Canal '${newChannelName}' aprovisionado con éxito!`);
      setNewChannelName('');
      setNewWebsiteUrl('');
      fetchInboxes();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setCreatingChannel(false);
    }
  };

  const fetchTemplates = async () => {
    setFetchingTemplates(true);
    try {
      const res = await fetch(`/api/control/${tenantId}/meta-templates`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (e) {
      console.error('Error fetching templates:', e);
    } finally {
      setFetchingTemplates(false);
    }
  };

  const handleSendTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate || !targetConversationId) return;
    setSendingTemplate(true);
    try {
      const paramsList = [param1, param2, param3].filter(Boolean);
      const res = await fetch(`/api/control/${tenantId}/meta-templates/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          conversation_id: targetConversationId,
          template_name: selectedTemplate.name,
          params: paramsList
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error enviando plantilla Meta');
      showToast(`Plantilla '${selectedTemplate.name}' enviada con éxito a la conversación #${targetConversationId}!`);
      setSelectedTemplate(null);
      setTargetConversationId('');
      setParam1('');
      setParam2('');
      setParam3('');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSendingTemplate(false);
    }
  };

  useEffect(() => {
    fetchLabels();
    fetchInboxes();
    fetchTemplates();
  }, [tenantId]);

  return (
    <div className="glass-card" style={{ animation: 'fadeIn 0.2s ease-out' }}>
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          padding: '0.75rem 1.25rem',
          backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
          color: '#fff',
          borderRadius: '8px',
          fontWeight: 'bold',
          fontSize: '0.85rem',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(11, 43, 76, 0.15)'
        }}>
          {toast.text}
        </div>
      )}

      {/* Title */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 className="card-title" style={{ color: '#0b2b4c', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🛡️ Control Plane: Canales, Labels & Plantillas Meta ({tenantId.toUpperCase()})
        </h2>
        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
          Administra la infraestructura de Chatwoot, aprovisiona canales y envía mensajes autorizados de Meta desde tu panel web.
        </p>
      </div>

      {/* Top Nav Buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveSection('labels')}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: activeSection === 'labels' ? '#2563eb' : '#e5e7eb',
            backgroundColor: activeSection === 'labels' ? '#eff6ff' : '#ffffff',
            color: activeSection === 'labels' ? '#2563eb' : '#64748b',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 'bold'
          }}
        >
          🏷️ Gestión de Etiquetas & Etapas CRM ({labels.length})
        </button>
        <button
          onClick={() => setActiveSection('channels')}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: activeSection === 'channels' ? '#10b981' : '#e5e7eb',
            backgroundColor: activeSection === 'channels' ? '#ecfdf5' : '#ffffff',
            color: activeSection === 'channels' ? '#059669' : '#64748b',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 'bold'
          }}
        >
          📱 Aprovisionar Canales & Webhooks ({inboxes.length})
        </button>
        <button
          onClick={() => setActiveSection('templates')}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: activeSection === 'templates' ? '#7c3aed' : '#e5e7eb',
            backgroundColor: activeSection === 'templates' ? '#f5f3ff' : '#ffffff',
            color: activeSection === 'templates' ? '#7c3aed' : '#64748b',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 'bold'
          }}
        >
          📲 Plantillas Autorizadas de Meta ({templates.length})
        </button>
      </div>

      {/* SECTION 1: LABELS MANAGEMENT */}
      {activeSection === 'labels' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.2s ease-out' }}>
          {role !== 'readonly' && (
            <form onSubmit={handleCreateLabel} style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#0b2b4c' }}>➕ Crear Nueva Etiqueta (Label)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label htmlFor="label_title">Nombre / Slug (ej. stage:cotizado)</label>
                  <input
                    type="text"
                    id="label_title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="ej. stage:cotizado"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="label_desc">Descripción (opcional)</label>
                  <input
                    type="text"
                    id="label_desc"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="ej. Cliente con cotización enviada"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="label_color">Color Hexadecimal</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="color"
                      id="label_color"
                      value={newColor}
                      onChange={(e) => setNewColor(e.target.value)}
                      style={{ width: '40px', height: '38px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={newColor}
                      onChange={(e) => setNewColor(e.target.value)}
                      style={{ flex: 1, fontFamily: 'monospace' }}
                    />
                  </div>
                </div>
              </div>
              <button type="submit" className="btn-primary" disabled={creatingLabel}>
                {creatingLabel ? 'Creando...' : 'Crear Etiqueta en Chatwoot'}
              </button>
            </form>
          )}

          {/* List of Labels */}
          <div>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: '#0b2b4c' }}>📋 Etiquetas Existentes en Chatwoot ({labels.length})</h4>
            {fetchingLabels ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Cargando etiquetas...</div>
            ) : labels.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No hay etiquetas creadas aún.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {labels.map((l) => (
                  <div
                    key={l.id}
                    style={{
                      padding: '0.85rem',
                      borderRadius: '10px',
                      backgroundColor: '#f8fafc',
                      border: `1px solid ${l.color || '#2563eb'}40`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: l.color || '#2563eb', display: 'inline-block' }}></span>
                        <strong style={{ fontSize: '0.85rem', color: '#0b2b4c' }}>{l.title}</strong>
                      </div>
                      {l.description && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>{l.description}</div>
                      )}
                    </div>
                    {role !== 'readonly' && (
                      <button
                        onClick={() => handleDeleteLabel(l.title)}
                        style={{
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.75rem',
                          borderRadius: '4px',
                          border: 'none',
                          backgroundColor: '#fef2f2',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: CHANNELS PROVISIONING */}
      {activeSection === 'channels' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.2s ease-out' }}>
          {role !== 'readonly' && (
            <form onSubmit={handleCreateChannel} style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#059669' }}>➕ Aprovisionar Nuevo Canal de Atención</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label htmlFor="channel_name">Nombre del Canal / Inbox</label>
                  <input
                    type="text"
                    id="channel_name"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="ej. Web Chat Sitio Web Oficial"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="channel_type">Tipo de Canal</label>
                  <select
                    id="channel_type"
                    value={newChannelType}
                    onChange={(e) => setNewChannelType(e.target.value as any)}
                    style={{ width: '100%' }}
                  >
                    <option value="web_widget">Web Chat Widget (Sitio Web)</option>
                    <option value="api">Canal API Genérico (WhatsApp / External)</option>
                  </select>
                </div>
                {newChannelType === 'web_widget' && (
                  <div className="form-group">
                    <label htmlFor="website_url">URL de tu Sitio Web</label>
                    <input
                      type="url"
                      id="website_url"
                      value={newWebsiteUrl}
                      onChange={(e) => setNewWebsiteUrl(e.target.value)}
                      placeholder="https://sicsa.com.ni"
                    />
                  </div>
                )}
              </div>
              <button type="submit" className="btn-primary" disabled={creatingChannel}>
                {creatingChannel ? 'Aprovisionando...' : 'Crear Canal & Auto-Conectar Webhook'}
              </button>
            </form>
          )}

          {/* Existing Inboxes */}
          <div>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: '#0b2b4c' }}>📋 Canales Configurados ({inboxes.length})</h4>
            {fetchingInboxes ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Cargando canales...</div>
            ) : inboxes.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No hay canales registrados.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {inboxes.map((ib) => (
                  <div key={ib.id} style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#0b2b4c' }}>{ib.name} (ID: #{ib.id})</div>
                      <div style={{ fontSize: '0.8rem', color: '#059669', marginTop: '0.2rem', fontWeight: 600 }}>Tipo: {ib.channel_type}</div>
                      {ib.website_token && (
                        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#64748b', marginTop: '0.2rem' }}>
                          Website Token: {ib.website_token}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', backgroundColor: '#ecfdf5', color: '#10b981', borderRadius: '6px', fontWeight: 'bold', border: '1px solid #a7f3d0' }}>
                      🟢 Webhook Conectado
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 3: META TEMPLATES (HSM) */}
      {activeSection === 'templates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ padding: '1rem', backgroundColor: '#f5f3ff', borderRadius: '10px', border: '1px solid #ddd6fe' }}>
            <h4 style={{ margin: '0 0 0.4rem 0', color: '#7c3aed', fontSize: '0.95rem' }}>📲 Plantillas Autorizadas por Meta (WhatsApp Cloud API)</h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: 1.4 }}>
              WhatsApp exige el uso de plantillas pre-aprobadas (HSM) para iniciar conversaciones fuera de la ventana de atención de 24 horas.
            </p>
          </div>

          {/* Templates Grid */}
          {fetchingTemplates ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Cargando plantillas de Meta...</div>
          ) : templates.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No hay plantillas registradas.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {templates.map((tpl, i) => (
                <div key={i} style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <strong style={{ fontSize: '0.9rem', color: '#2563eb' }}>{tpl.name}</strong>
                      <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', backgroundColor: '#ecfdf5', color: '#10b981', borderRadius: '4px', fontWeight: 'bold', border: '1px solid #a7f3d0' }}>
                        ✓ {tpl.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>Categoría: {tpl.category} | Idioma: {tpl.language}</div>
                    
                    {/* Template Content Body preview */}
                    <div style={{ padding: '0.75rem', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.8rem', color: '#0b2b4c', fontFamily: 'sans-serif', lineHeight: 1.4 }}>
                      {tpl.components.find((c: any) => c.type === 'BODY')?.text || 'Contenido de plantilla'}
                    </div>
                  </div>

                  {role !== 'readonly' && (
                    <button
                      onClick={() => setSelectedTemplate(tpl)}
                      className="btn-primary"
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', alignSelf: 'flex-start' }}
                    >
                      ✉️ Probar / Enviar Plantilla
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Send Template Modal */}
          {selectedTemplate && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(11, 43, 76, 0.4)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 2000,
              padding: '1.5rem',
              boxSizing: 'border-box'
            }}>
              <div className="glass-card" style={{ width: '100%', maxWidth: '500px', animation: 'fadeIn 0.2s ease-out' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 className="card-title" style={{ margin: 0, color: '#0b2b4c' }}>✉️ Enviar Plantilla: {selectedTemplate.name}</h3>
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    style={{ background: 'transparent', border: 'none', color: '#0b2b4c', fontSize: '1.25rem', cursor: 'pointer' }}
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleSendTemplate}>
                  <div className="form-group">
                    <label htmlFor="target_conv">ID de la Conversación Destino en Chatwoot</label>
                    <input
                      type="text"
                      id="target_conv"
                      value={targetConversationId}
                      onChange={(e) => setTargetConversationId(e.target.value)}
                      placeholder="ej. 30"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>{'Variable {{1}} (ej. Nombre del Cliente)'}</label>
                    <input
                      type="text"
                      value={param1}
                      onChange={(e) => setParam1(e.target.value)}
                      placeholder="ej. Erick Torres"
                    />
                  </div>

                  <div className="form-group">
                    <label>{'Variable {{2}} (ej. Servicio / Producto)'}</label>
                    <input
                      type="text"
                      value={param2}
                      onChange={(e) => setParam2(e.target.value)}
                      placeholder="ej. Laptop HP ProBook"
                    />
                  </div>

                  <div className="form-group">
                    <label>{'Variable {{3}} (ej. Fecha / Detalle)'}</label>
                    <input
                      type="text"
                      value={param3}
                      onChange={(e) => setParam3(e.target.value)}
                      placeholder="ej. 15 de Julio"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setSelectedTemplate(null)}
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={sendingTemplate}
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      {sendingTemplate ? 'Enviando...' : 'Confirmar Envío Meta HSM'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
