import React, { useState, useEffect } from 'react';

interface TeamManagementTabProps {
  tenantId: string;
  token: string | null;
  role: string | null;
}

export interface TeamMember {
  id: number;
  team_id: number;
  user_email: string;
  user_name: string;
  role_in_team: string;
  created_at: string;
}

export interface Team {
  id: number;
  tenant_id: string;
  team_key: string;
  name: string;
  description: string;
  ai_keywords: string;
  assignment_mode: 'round_robin' | 'manual' | 'open';
  created_at: string;
  members?: TeamMember[];
}

export const TeamManagementTab: React.FC<TeamManagementTabProps> = ({ tenantId, token, role: _role }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modal State for New/Edit Team
  const [showModal, setShowModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [aiKeywords, setAiKeywords] = useState('');
  const [assignmentMode, setAssignmentMode] = useState<'round_robin' | 'manual' | 'open'>('round_robin');

  // Modal State for Adding Team Member
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [selectedTeamForMember, setSelectedTeamForMember] = useState<Team | null>(null);
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('member');
  const [systemUsers, setSystemUsers] = useState<any[]>([]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchSystemUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const users = await res.json();
        setSystemUsers(users || []);
      }
    } catch (e) {
      console.error('Error fetching system users:', e);
    }
  };

  const fetchTeams = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/control/${tenantId}/teams`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const teamsData: Team[] = await res.json();
        if (Array.isArray(teamsData)) {
          // Fetch members for each team
          const teamsWithMembers = await Promise.all(
            teamsData.map(async (team) => {
              try {
                const memRes = await fetch(`/api/control/${tenantId}/teams/${team.id}/members`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                if (memRes.ok) {
                  const members = await memRes.json();
                  return { ...team, members: Array.isArray(members) ? members : [] };
                }
              } catch (e) {
                console.error('Error fetching members:', e);
              }
              return { ...team, members: [] };
            })
          );
          setTeams(teamsWithMembers);
        }
      }
    } catch (err) {
      console.error('Error fetching teams:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
    fetchSystemUsers();
  }, [tenantId]);

  const handleOpenCreateModal = () => {
    setEditingTeam(null);
    setName('');
    setDescription('');
    setAiKeywords('');
    setAssignmentMode('round_robin');
    setShowModal(true);
  };

  const handleOpenEditModal = (team: Team) => {
    setEditingTeam(team);
    setName(team.name);
    setDescription(team.description || '');
    setAiKeywords(team.ai_keywords || '');
    setAssignmentMode(team.assignment_mode || 'round_robin');
    setShowModal(true);
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Ingresa el nombre del equipo.', 'error');
      return;
    }

    try {
      const url = editingTeam 
        ? `/api/control/${tenantId}/teams/${editingTeam.id}`
        : `/api/control/${tenantId}/teams`;
      const method = editingTeam ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          description,
          ai_keywords: aiKeywords,
          assignment_mode: assignmentMode
        })
      });

      if (!res.ok) throw new Error('Error al guardar el equipo de ventas');

      setShowModal(false);
      showToast(editingTeam ? 'Equipo actualizado con éxito!' : 'Equipo de ventas creado con éxito!');
      fetchTeams();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteTeam = async (id: number) => {
    if (!window.confirm('¿Seguro que deseas eliminar este equipo de ventas?')) return;

    try {
      const res = await fetch(`/api/control/${tenantId}/teams/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error eliminando el equipo');
      showToast('Equipo eliminado.');
      fetchTeams();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Add Member to Team
  const handleOpenAddMemberModal = (team: Team) => {
    setSelectedTeamForMember(team);
    if (systemUsers && systemUsers.length > 0) {
      const firstUser = systemUsers[0];
      setMemberEmail(firstUser.email);
      setMemberName(firstUser.name || firstUser.email.split('@')[0]);
    } else {
      setMemberEmail('jovanela@sicsa.com.ni');
      setMemberName('Jovanela Torres');
    }
    setMemberRole('member');
    setShowMemberModal(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamForMember || !memberEmail.trim()) {
      showToast('Ingresa el correo del vendedor.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/control/${tenantId}/teams/${selectedTeamForMember.id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_name: memberName || memberEmail.split('@')[0],
          user_email: memberEmail,
          role_in_team: memberRole
        })
      });

      if (!res.ok) throw new Error('Error al agregar integrante al equipo');

      setShowMemberModal(false);
      showToast(`Integrante ${memberName || memberEmail} asignado a ${selectedTeamForMember.name}`);
      fetchTeams();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleRemoveMember = async (teamId: number, memberId: number, name: string) => {
    if (!window.confirm(`¿Remover a ${name} de este equipo?`)) return;

    try {
      const res = await fetch(`/api/control/${tenantId}/teams/${teamId}/members/${memberId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error removiendo integrante');
      showToast('Integrante removido del equipo.');
      fetchTeams();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="glass-card" style={{ animation: 'fadeIn 0.25s ease-out' }}>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 className="card-title" style={{ margin: 0, color: '#0b2b4c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.5rem', color: '#2563eb' }}>groups</span>
            Gestión de Equipos & Integrantes ({tenantId.toUpperCase()})
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
            Administra tus equipos de ventas, asigna sus vendedores integrantes e insere reglas automáticas de auto-escalamiento en la IA.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>add</span>
          Crear Nuevo Equipo
        </button>
      </div>

      {/* Teams Grid Cards */}
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#2563eb', fontWeight: 700 }}>
          Cargando equipos e integrantes...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          {teams.map(team => (
            <div key={team.id} style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              boxShadow: '0 2px 8px rgba(11, 43, 76, 0.04)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <strong style={{ fontSize: '1rem', color: '#0b2b4c', display: 'block' }}>{team.name}</strong>
                  <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#64748b', backgroundColor: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                    key: {team.team_key}
                  </span>
                </div>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.55rem',
                  borderRadius: '6px',
                  backgroundColor: team.assignment_mode === 'round_robin' ? '#eff6ff' : '#fef3c7',
                  color: team.assignment_mode === 'round_robin' ? '#2563eb' : '#d97706'
                }}>
                  {team.assignment_mode === 'round_robin' ? '🔄 Rotativo (Round Robin)' : '👤 Asignación Manual'}
                </span>
              </div>

              <p style={{ fontSize: '0.82rem', color: '#475569', margin: 0, lineHeight: 1.4 }}>
                {team.description || 'Sin descripción asignada.'}
              </p>

              {/* AI Keywords */}
              <div style={{ backgroundColor: '#f8fafc', padding: '0.65rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0b2b4c', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', color: '#8b5cf6' }}>psychology</span>
                  Criterios / Palabras Clave para Escalamiento IA:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {team.ai_keywords ? team.ai_keywords.split(',').map((kw, i) => (
                    <span key={i} style={{ fontSize: '0.68rem', backgroundColor: '#f1f5f9', color: '#334155', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                      {kw.trim()}
                    </span>
                  )) : (
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Sin palabras clave asociadas</span>
                  )}
                </div>
              </div>

              {/* Team Members List */}
              <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '0.65rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0b2b4c', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '0.95rem', color: '#10b981' }}>badge</span>
                    Integrantes del Equipo ({team.members?.length || 0}):
                  </span>
                  <button
                    onClick={() => handleOpenAddMemberModal(team)}
                    style={{
                      padding: '0.25rem 0.55rem',
                      borderRadius: '6px',
                      border: '1px solid #10b981',
                      backgroundColor: '#ecfdf5',
                      color: '#059669',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>person_add</span> + Agregar
                  </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {!team.members || team.members.length === 0 ? (
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>Sin vendedores asignados a este equipo.</span>
                  ) : (
                    team.members.map(m => (
                      <span key={m.id} style={{
                        fontSize: '0.72rem',
                        padding: '0.25rem 0.55rem',
                        borderRadius: '6px',
                        backgroundColor: m.role_in_team === 'leader' ? '#fef3c7' : '#f1f5f9',
                        color: m.role_in_team === 'leader' ? '#b45309' : '#1e293b',
                        border: '1px solid #cbd5e1',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}>
                        <strong style={{ fontSize: '0.75rem' }}>{m.user_name}</strong>
                        {m.role_in_team === 'leader' && <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>👑 (Líder)</span>}
                        <span
                          onClick={() => handleRemoveMember(team.id, m.id, m.user_name)}
                          style={{ cursor: 'pointer', color: '#ef4444', marginLeft: '0.2rem', fontWeight: 'bold' }}
                          title="Remover integrante"
                        >
                          ✕
                        </span>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => handleOpenEditModal(team)}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#2563eb',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>edit</span> Editar Equipo
                </button>
                <button
                  onClick={() => handleDeleteTeam(team.id)}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>delete</span> Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI SYSTEM PROMPT ESCALATION RULES PREVIEW */}
      <div style={{ backgroundColor: '#0b2b4c', padding: '1.25rem', borderRadius: '12px', color: '#ffffff', marginTop: '2rem' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className="material-symbols-outlined">smart_toy</span>
          Reglas de Auto-Escalamiento en el System Prompt de la IA (Vista Previa en Vivo)
        </h3>
        <p style={{ fontSize: '0.8rem', color: '#93c5fd', margin: '0 0 1rem 0' }}>
          Estas instrucciones son inyectadas dinámicamente en el System Prompt de Gemini 2.5 Flash / DeepSeek para que la IA sepa a qué equipo transferir según la intención del cliente:
        </p>

        <pre style={{ backgroundColor: '#07182b', padding: '1rem', borderRadius: '8px', fontSize: '0.78rem', color: '#34d399', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0, border: '1px solid #1e3a8a' }}>
{`### REGLAS OBLIGATORIAS DE ESCALAMIENTO AUTOMÁTICO A EQUIPOS ESPECIALIZADOS:
Cuando el cliente requiera hablar con un asesor o solicite atención especializada, debes incluir al final de tu respuesta el tag exacto [ESCALATE: key_del_equipo]:

` + teams.map(t => `- **Equipo: ${t.name}** (key: ${t.team_key}): ${t.description || 'Sin descripción'}
  Criterios / Palabras clave de activación: ${t.ai_keywords || 'general'}
  Tag obligatorio para transferir a este equipo: [ESCALATE: ${t.team_key}]`).join('\n\n')}
        </pre>
      </div>

      {/* CREATE / EDIT TEAM MODAL */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 2000
        }}>
          <form onSubmit={handleSaveTeam} style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            padding: '1.75rem',
            width: '460px',
            maxWidth: '92%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <h3 style={{ margin: 0, color: '#0b2b4c', fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="material-symbols-outlined" style={{ color: '#2563eb' }}>groups</span>
              {editingTeam ? 'Editar Equipo de Ventas' : 'Crear Nuevo Equipo de Ventas'}
            </h3>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0b2b4c' }}>Nombre del Equipo</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Licitaciones & Gobierno"
                style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box', marginTop: '0.2rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0b2b4c' }}>Descripción del Equipo</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: Atención a compras estatales, licitaciones del estado y contratos públicos."
                style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box', marginTop: '0.2rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0b2b4c' }}>Palabras Clave para Escalamiento Automático (IA)</label>
              <input
                type="text"
                value={aiKeywords}
                onChange={(e) => setAiKeywords(e.target.value)}
                placeholder="Separadas por comas. Ej: licitación, pliego, gobierno, contrato publico, exoneración"
                style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box', marginTop: '0.2rem' }}
              />
              <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
                Si el cliente menciona estas palabras en el chat, la IA asignará la conversación automáticamente a este equipo.
              </span>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0b2b4c' }}>Modo de Asignación Interna entre Vendedores</label>
              <select
                value={assignmentMode}
                onChange={(e) => setAssignmentMode(e.target.value as any)}
                style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', marginTop: '0.2rem' }}
              >
                <option value="round_robin">Rotativo Automático (Round Robin)</option>
                <option value="manual">Manual por Supervisor</option>
                <option value="open">Libre (Cualquier vendedor puede tomarlo)</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={{ padding: '0.5rem 1.2rem', borderRadius: '6px', border: 'none', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
              >
                Guardar Equipo
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADD MEMBER MODAL */}
      {showMemberModal && selectedTeamForMember && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 2000
        }}>
          <form onSubmit={handleSaveMember} style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            padding: '1.75rem',
            width: '420px',
            maxWidth: '92%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <h3 style={{ margin: 0, color: '#0b2b4c', fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="material-symbols-outlined" style={{ color: '#10b981' }}>person_add</span>
              Agregar Integrante a: {selectedTeamForMember.name}
            </h3>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0b2b4c', display: 'block', marginBottom: '0.3rem' }}>
                Seleccionar Asesor Registrado en el Sistema <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                required
                value={memberEmail}
                onChange={(e) => {
                  const selectedEmail = e.target.value;
                  setMemberEmail(selectedEmail);
                  const found = systemUsers.find(u => u.email === selectedEmail);
                  if (found) {
                    setMemberName(found.name || found.email.split('@')[0]);
                  }
                }}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 700, color: '#0b2b4c', backgroundColor: '#f8fafc' }}
              >
                <option value="">-- Seleccionar Usuario Registrado --</option>
                {systemUsers.map(u => (
                  <option key={u.id || u.email} value={u.email}>
                    👤 {u.name ? `${u.name} (${u.email})` : u.email} - {u.role === 'superadmin' ? 'Administrador' : 'Asesor / Usuario'}
                  </option>
                ))}
                {systemUsers.length === 0 && (
                  tenantId.toLowerCase() === 'sicsa' ? (
                    <>
                      <option value="jovanela@sicsa.com.ni">👤 Jovanela Torres (jovanela@sicsa.com.ni)</option>
                      <option value="adonis@sicsa.com.ni">👤 Adonis (adonis@sicsa.com.ni)</option>
                      <option value="mario@sicsa.com.ni">👤 Mario Lumbi (mario@sicsa.com.ni)</option>
                      <option value="toribio@sicsa.com.ni">👤 Toribio (toribio@sicsa.com.ni)</option>
                    </>
                  ) : (
                    <>
                      <option value={`admin@${tenantId.toLowerCase()}.com`}>👤 Admin ({`admin@${tenantId.toLowerCase()}.com`})</option>
                      <option value={`vendedor1@${tenantId.toLowerCase()}.com`}>👤 Vendedor 1 ({`vendedor1@${tenantId.toLowerCase()}.com`})</option>
                      <option value={`soporte@${tenantId.toLowerCase()}.com`}>👤 Soporte ({`soporte@${tenantId.toLowerCase()}.com`})</option>
                    </>
                  )
                )}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0b2b4c' }}>Nombre Visible en el Equipo</label>
              <input
                type="text"
                required
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="Ej: Jovanela Torres"
                style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box', marginTop: '0.2rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0b2b4c' }}>Rol dentro del Equipo</label>
              <select
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', marginTop: '0.2rem' }}
              >
                <option value="member">👤 Vendedor / Asesor</option>
                <option value="leader">👑 Líder / Supervisor de Equipo</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowMemberModal(false)}
                style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={{ padding: '0.5rem 1.2rem', borderRadius: '6px', border: 'none', backgroundColor: '#10b981', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
              >
                Asignar al Equipo
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
