import React, { useState, useEffect, useRef } from 'react';

interface InboxWorkspaceProps {
  tenantId: string;
  token: string | null;
  role: string | null;
}

interface ChatAttachment {
  id: number;
  message_id: number;
  file_type: 'image' | 'audio' | 'video' | 'file';
  data_url: string;
  thumb_url?: string;
}

interface ChatMessage {
  id: number;
  content: string;
  message_type: 0 | 1 | 2 | 3; // 0: incoming, 1: outgoing, 2: activity, 3: template
  private: boolean;
  created_at: number | string;
  attachments?: ChatAttachment[];
  sender?: {
    name?: string;
    type?: string;
  };
}

interface ConversationItem {
  id: number;
  status: 'open' | 'pending' | 'resolved' | 'snoozed';
  unread_count: number;
  last_activity_at: number;
  labels: string[];
  meta: {
    sender: {
      name: string;
      phone_number?: string;
      email?: string;
    };
    assignee?: {
      name: string;
    };
  };
  messages?: ChatMessage[];
}

export const InboxWorkspace: React.FC<InboxWorkspaceProps> = ({ tenantId, token, role }) => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConv, setSelectedConv] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeCategory, setActiveCategory] = useState<'all' | 'assigned' | 'ai' | 'pending' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [fetchingConvs, setFetchingConvs] = useState(false);
  const [fetchingMsgs, setFetchingMsgs] = useState(false);

  // Message composer state
  const [inputMessage, setInputMessage] = useState('');
  const [replyMode, setReplyMode] = useState<'public' | 'private'>('public');
  const [sendingMsg, setSendingMsg] = useState(false);

  // Quick Action Popovers & Modals
  const [showNewConvModal, setShowNewConvModal] = useState(false);
  const [contactsList, setContactsList] = useState<any[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [clientOpportunities, setClientOpportunities] = useState<any[]>([]);

  // Toast / Alerts
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const selectedConvRef = useRef<ConversationItem | null>(null);
  selectedConvRef.current = selectedConv;

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // --- API CALLS ---
  const fetchContactsList = async () => {
    try {
      const res = await fetch(`/api/control/${tenantId}/contacts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setContactsList(data.payload || data || []);
      }
    } catch (e) {
      console.error('Error fetching contacts list:', e);
    }
  };

  const handleOpenNewConvModal = () => {
    setShowNewConvModal(true);
    fetchContactsList();
  };

  const handleCreateNewConversation = async () => {
    if (!selectedContactId) {
      showToast('Selecciona un contacto registrado.', 'error');
      return;
    }

    try {
      let contactId = selectedContactId ? parseInt(selectedContactId) : null;
      
      const res = await fetch(`/api/control/${tenantId}/conversations/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          contact_id: contactId,
          message: 'Hola! Bienvenido a la atención personalizada de WhatsApp.'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error creando nueva conversación');

      setShowNewConvModal(false);
      showToast('Nueva conversación iniciada con éxito!');
      fetchConversations();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const fetchConversations = async () => {
    setFetchingConvs(true);
    try {
      let statusParam = 'all';
      if (activeCategory === 'pending') statusParam = 'pending';
      else if (activeCategory === 'assigned') statusParam = 'open';
      else if (activeCategory === 'resolved') statusParam = 'resolved';

      const res = await fetch(`/api/control/${tenantId}/conversations?status=${statusParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const convList: ConversationItem[] = Array.isArray(data) ? data : [];
        setConversations(convList);

        if (convList.length > 0) {
          if (!selectedConvRef.current) {
            setSelectedConv(convList[0]);
            fetchMessages(convList[0].id.toString(), false);
          } else {
            const updatedSelected = convList.find(c => c.id === selectedConvRef.current?.id);
            if (updatedSelected) {
              setSelectedConv(updatedSelected);
            }
          }
        }
      }
    } catch (e) {
      console.error('Error fetching live conversations:', e);
    } finally {
      setFetchingConvs(false);
    }
  };

  const fetchClientOpportunities = async (phoneOrName: string) => {
    if (!phoneOrName) return;
    try {
      const res = await fetch(`/api/control/${tenantId}/opportunities?contact_id=${encodeURIComponent(phoneOrName)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClientOpportunities(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Error fetching client opportunities:', e);
    }
  };

  const fetchMessages = async (convId: string, isSilent = false) => {
    if (!isSilent && messages.length === 0) {
      setFetchingMsgs(true);
    }
    try {
      if (!isSilent && selectedConvRef.current) {
        fetchClientOpportunities(selectedConvRef.current.meta?.sender?.phone_number || selectedConvRef.current.meta?.sender?.name || '');
      }
      const res = await fetch(`/api/control/${tenantId}/conversations/${convId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const msgList: ChatMessage[] = Array.isArray(data) ? data : [];
        
        setMessages(prev => {
          if (prev.length === msgList.length && prev.every((m, i) => m.id === msgList[i]?.id)) {
            return prev;
          }
          return msgList;
        });

        if (!isSilent) {
          setTimeout(() => scrollToBottom('auto'), 50);
        } else {
          const chatContainer = chatContainerRef.current;
          if (chatContainer) {
            const isNearBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 150;
            if (isNearBottom) {
              setTimeout(() => scrollToBottom('auto'), 50);
            }
          }
        }
      }
    } catch (e) {
      console.error('Error fetching messages:', e);
    } finally {
      setFetchingMsgs(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || !selectedConv) return;
    setSendingMsg(true);
    try {
      const isPrivate = replyMode === 'private';
      const res = await fetch(`/api/control/${tenantId}/conversations/${selectedConv.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: inputMessage,
          is_private: isPrivate
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error enviando mensaje');

      setInputMessage('');
      fetchMessages(selectedConv.id.toString(), true);
      showToast(isPrivate ? 'Nota privada interna guardada' : 'Mensaje enviado a WhatsApp');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleToggleStatus = async (newStatus: 'open' | 'pending' | 'resolved') => {
    if (!selectedConv) return;
    try {
      const res = await fetch(`/api/control/${tenantId}/conversations/${selectedConv.id}/toggle_status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error cambiando estado');

      setSelectedConv({ ...selectedConv, status: newStatus });
      showToast(`Estado actualizado a '${newStatus === 'open' ? 'Atención por Humano' : newStatus === 'pending' ? 'Atención por IA' : 'Resuelto'}'`);
      fetchConversations();
      fetchMessages(selectedConv.id.toString(), true);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleChangeCRMStage = async (stageLabel: string) => {
    if (!selectedConv) return;
    try {
      const existingNonStageLabels = selectedConv.labels.filter(l => !l.startsWith('stage:'));
      const updatedLabels = [...existingNonStageLabels, stageLabel];

      const res = await fetch(`/api/control/${tenantId}/conversations/${selectedConv.id}/labels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ labels: updatedLabels })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error actualizando etapa CRM');

      setSelectedConv({ ...selectedConv, labels: updatedLabels });
      showToast(`Etapa CRM actualizada a '${stageLabel}'`);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(() => {
      fetchConversations();
      if (selectedConvRef.current) {
        fetchMessages(selectedConvRef.current.id.toString(), true);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [tenantId, activeCategory]);

  const filteredConvs = conversations.filter(c => {
    const name = c.meta?.sender?.name || '';
    const phone = c.meta?.sender?.phone_number || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase()) || phone.includes(searchQuery);
  });

  const getCRMStage = (labels: string[]) => {
    const stageLabel = labels.find(l => l.startsWith('stage:'));
    return stageLabel || 'stage:prospecto';
  };

  return (
    <div style={{
      animation: 'fadeIn 0.25s ease-out',
      height: 'calc(100vh - 100px)',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      padding: '0.85rem',
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

      {/* 3-COLUMN WORKSPACE GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 310px', gap: '0.85rem', height: '100%', overflow: 'hidden' }}>
        
        {/* ================= COLUMN 1: LEFT SIDEBAR (OPERATOR CONSOLE) ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', borderRadius: '12px', padding: '1rem', border: '1px solid #e5e7eb', gap: '1rem', overflow: 'hidden' }}>
          
          {/* Console Header */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0b2b4c' }}>Operator Console</h2>
                <div style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.1rem', fontWeight: 700 }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} /> Active Session
                </div>
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              onClick={handleOpenNewConvModal}
              style={{
                width: '100%',
                padding: '0.65rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
              }}
            >
              + New Conversation
            </button>
          </div>

          {/* Category Filter Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {[
              { id: 'all', label: 'All Chats', icon: '💬', count: conversations.length },
              { id: 'assigned', label: 'Assigned', icon: '👤', count: conversations.filter(c => c.status === 'open').length },
              { id: 'ai', label: 'AI Managed', icon: '🤖', count: conversations.filter(c => c.status === 'pending').length },
              { id: 'resolved', label: 'Resolved', icon: '✓', count: conversations.filter(c => c.status === 'resolved').length }
            ].map(cat => {
              const isActive = activeCategory === cat.id;
              return (
                <div
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id as any)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '8px',
                    backgroundColor: isActive ? '#eff6ff' : 'transparent',
                    color: isActive ? '#2563eb' : '#64748b',
                    fontWeight: isActive ? 700 : 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '0.9rem' }}>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </div>
                  {cat.count > 0 && (
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '10px',
                      backgroundColor: isActive ? '#2563eb' : '#e5e7eb',
                      color: isActive ? '#ffffff' : '#0b2b4c',
                      fontWeight: 700
                    }}>
                      {cat.count}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Search Input */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              color: '#0b2b4c',
              boxSizing: 'border-box'
            }}
          />

          {/* Recent Messages Header & List */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              RECENT MESSAGES
            </div>

            {fetchingConvs && conversations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.8rem' }}>Loading live chats...</div>
            ) : filteredConvs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.8rem' }}>No active chats found.</div>
            ) : (
              filteredConvs.map((c) => {
                const isSelected = selectedConv?.id === c.id;
                const contactName = c.meta?.sender?.name || `Conversation #${c.id}`;
                const isPendingBot = c.status === 'pending';

                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      if (selectedConv?.id !== c.id) {
                        setSelectedConv(c);
                        setMessages([]);
                        fetchMessages(c.id.toString(), false);
                      }
                    }}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                      borderLeft: isSelected ? '4px solid #2563eb' : '4px solid transparent',
                      borderTop: '1px solid #e5e7eb',
                      borderRight: '1px solid #e5e7eb',
                      borderBottom: '1px solid #e5e7eb',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <strong style={{ fontSize: '0.85rem', color: '#0b2b4c' }}>{contactName}</strong>
                      <span style={{
                        fontSize: '0.62rem',
                        padding: '0.12rem 0.4rem',
                        borderRadius: '4px',
                        fontWeight: 700,
                        backgroundColor: isPendingBot ? 'rgba(16, 185, 129, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                        color: isPendingBot ? '#059669' : '#2563eb'
                      }}>
                        {isPendingBot ? 'AI' : 'HUMAN'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.meta?.sender?.phone_number || `Conversation #${c.id}`}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================= COLUMN 2: CENTER CHAT WINDOW (THE HERO ROOM) ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          {selectedConv ? (
            <>
              {/* Top Header Bar */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.85rem 1.25rem',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0b2b4c' }}>
                      {selectedConv.meta?.sender?.name || `Conversation #${selectedConv.id}`}
                    </h3>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      WHATSAPP CHAT
                    </div>
                  </div>
                </div>

                {/* Top Action Buttons */}
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                  {selectedConv.status === 'pending' ? (
                    <button
                      onClick={() => handleToggleStatus('open')}
                      style={{
                        padding: '0.45rem 0.9rem',
                        fontSize: '0.78rem',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        backgroundColor: '#ffffff',
                        color: '#0b2b4c',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}
                    >
                      👤 Take Over (Human)
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleStatus('pending')}
                      style={{
                        padding: '0.45rem 0.9rem',
                        fontSize: '0.78rem',
                        borderRadius: '8px',
                        border: '1px solid #10b981',
                        backgroundColor: '#ecfdf5',
                        color: '#059669',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}
                    >
                      🤖 Handover to AI
                    </button>
                  )}

                  {selectedConv.status !== 'resolved' && (
                    <button
                      onClick={() => handleToggleStatus('resolved')}
                      style={{
                        padding: '0.45rem 0.9rem',
                        fontSize: '0.78rem',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: '#10b981',
                        color: '#ffffff',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
                      }}
                    >
                      ✓ Resolve
                    </button>
                  )}
                </div>
              </div>

              {/* Chat Stream Window */}
              <div ref={chatContainerRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem', backgroundColor: '#fafafa' }}>
                
                {/* Date Divider Pill */}
                <div style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.25rem 0.85rem', borderRadius: '12px', backgroundColor: '#e5e7eb', color: '#0b2b4c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    TODAY
                  </span>
                </div>

                {fetchingMsgs && messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No messages recorded yet.</div>
                ) : (
                  messages.map((m) => {
                    const isIncoming = m.message_type === 0;
                    const isPrivate = m.private;
                    const isBot = m.sender?.type === 'agent' || m.sender?.name?.includes('Bot') || m.sender?.name?.includes('Sofía');

                    return (
                      <div
                        key={m.id}
                        style={{
                          alignSelf: isIncoming ? 'flex-start' : 'flex-end',
                          maxWidth: '78%',
                          padding: '0.9rem 1.15rem',
                          borderRadius: '14px',
                          backgroundColor: isPrivate
                            ? '#fef3c7' // Light Amber Private Note
                            : isIncoming
                              ? '#f1f5f9' // Light Slate Incoming
                              : isBot
                                ? '#ecfdf5' // Soft Emerald Bot
                                : '#0b2b4c', // Navy Corporate Operator
                          border: isPrivate
                            ? '1px solid #f59e0b'
                            : isIncoming
                              ? '1px solid #e5e7eb'
                              : isBot
                                ? '1px solid #10b981'
                                : '1px solid #0b2b4c',
                          color: isPrivate
                            ? '#92400e'
                            : isIncoming
                              ? '#0b2b4c'
                              : isBot
                                ? '#065f46'
                                : '#ffffff',
                          fontSize: '0.88rem',
                          boxShadow: '0 2px 8px rgba(11, 43, 76, 0.04)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.72rem', marginBottom: '0.4rem' }}>
                          <span style={{ fontWeight: 800, color: isPrivate ? '#b45309' : isIncoming ? '#64748b' : isBot ? '#047857' : '#93c5fd' }}>
                            {isPrivate ? '🔒 INTERNAL PRIVATE NOTE' : isIncoming ? selectedConv.meta?.sender?.name || 'Client' : isBot ? '🤖 Sofía (AI Agent)' : '👤 Me (Operator)'}
                          </span>
                        </div>
                        
                        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, fontWeight: 500 }}>{m.content}</div>

                        {/* ATTACHMENTS (VOICE NOTES, IMAGES, PDFS) */}
                        {m.attachments && m.attachments.length > 0 && (
                          <div style={{ marginTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {m.attachments.map((att: any, attIdx: number) => {
                              const fileType = att.file_type || '';
                              const dataUrl = att.data_url || att.thumb_url || '';

                              if (fileType === 'audio' || dataUrl.includes('.ogg') || dataUrl.includes('.mp3') || dataUrl.includes('.m4a') || dataUrl.includes('.wav')) {
                                return (
                                  <div key={attIdx} style={{ backgroundColor: '#e0f2fe', padding: '0.6rem', borderRadius: '8px', marginTop: '0.25rem', border: '1px solid #0284c7' }}>
                                    <div style={{ fontSize: '0.72rem', color: '#0369a1', marginBottom: '0.25rem', fontWeight: 'bold' }}>🎙️ WhatsApp Voice Note</div>
                                    <audio controls src={dataUrl} style={{ width: '100%', height: '36px' }} />
                                  </div>
                                );
                              } else if (fileType === 'image' || dataUrl.match(/\.(jpeg|jpg|gif|png|svg)$/i)) {
                                return (
                                  <div key={attIdx} style={{ marginTop: '0.25rem' }}>
                                    <img
                                      src={dataUrl}
                                      alt="Attachment"
                                      style={{ maxWidth: '260px', maxHeight: '220px', borderRadius: '8px', objectFit: 'cover', cursor: 'pointer', border: '1px solid #e5e7eb' }}
                                      onClick={() => window.open(dataUrl, '_blank')}
                                    />
                                  </div>
                                );
                              } else {
                                return (
                                  <div key={attIdx} style={{ marginTop: '0.25rem' }}>
                                    <a
                                      href={dataUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        padding: '0.45rem 0.85rem',
                                        backgroundColor: '#ffffff',
                                        borderRadius: '6px',
                                        color: '#2563eb',
                                        fontSize: '0.78rem',
                                        textDecoration: 'none',
                                        fontWeight: 'bold',
                                        border: '1px solid #e5e7eb'
                                      }}
                                    >
                                      📄 Download Document / Quote PDF
                                    </a>
                                  </div>
                                );
                              }
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Bottom Message Composer */}
              {role !== 'readonly' ? (
                <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e5e7eb' }}>
                  
                  {/* Mode Selector Tabs (Public Reply vs Private Note) */}
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setReplyMode('public')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        borderBottom: replyMode === 'public' ? '2px solid #2563eb' : '2px solid transparent',
                        color: replyMode === 'public' ? '#2563eb' : '#64748b',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        paddingBottom: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      ↩ Public Reply
                    </button>

                    <button
                      type="button"
                      onClick={() => setReplyMode('private')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        borderBottom: replyMode === 'private' ? '2px solid #d97706' : '2px solid transparent',
                        color: replyMode === 'private' ? '#d97706' : '#64748b',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        paddingBottom: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      🔒 Private Note
                    </button>
                  </div>

                  {/* Textarea Container */}
                  <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <textarea
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder={replyMode === 'private' ? "Type internal note..." : `Type your message to ${selectedConv.meta?.sender?.name || 'client'}...`}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        borderRadius: '10px',
                        border: '1px solid #e5e7eb',
                        backgroundColor: '#ffffff',
                        color: '#0b2b4c',
                        fontSize: '0.88rem',
                        fontFamily: 'inherit',
                        resize: 'none',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                    />

                    {/* Action Bar Below Input */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="file"
                          id="attach_file_input"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setInputMessage((prev) => prev ? `${prev} [Adjunto: ${file.name}]` : `[Adjunto: ${file.name}]`);
                              showToast(`Archivo '${file.name}' seleccionado.`);
                            }
                          }}
                          accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx"
                        />

                        {/* Clip / File Button */}
                        <button
                          type="button"
                          onClick={() => document.getElementById('attach_file_input')?.click()}
                          style={{
                            padding: '0.45rem 0.75rem',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            backgroundColor: '#ffffff',
                            color: '#2563eb',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: 'bold'
                          }}
                          title="Adjuntar Cotización PDF o Imagen"
                        >
                          📎
                        </button>
                      </div>

                      <button
                        type="submit"
                        disabled={sendingMsg || !inputMessage.trim()}
                        style={{
                          padding: '0.55rem 1.25rem',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: replyMode === 'private' ? '#d97706' : '#2563eb',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          cursor: sendingMsg || !inputMessage.trim() ? 'not-allowed' : 'pointer',
                          boxShadow: '0 2px 8px rgba(37, 99, 235, 0.2)'
                        }}
                      >
                        {sendingMsg ? 'Enviando...' : replyMode === 'private' ? 'Guardar Nota' : 'Enviar WhatsApp'}
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#64748b' }}>
              Selecciona una conversación para iniciar la atención.
            </div>
          )}
        </div>

        {/* ================= COLUMN 3: RIGHT SIDEBAR (CONTACT DETAILS & CRM) ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', borderRadius: '12px', padding: '1rem', border: '1px solid #e5e7eb', gap: '1rem', overflowY: 'auto' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0b2b4c', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
            👤 Contact Info & CRM
          </h3>

          {selectedConv ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: '#ffffff', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Nombre del Cliente:</span>
                <strong style={{ fontSize: '0.9rem', color: '#0b2b4c' }}>{selectedConv.meta?.sender?.name || 'Cliente sin nombre'}</strong>
                
                {selectedConv.meta?.sender?.phone_number && (
                  <>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, marginTop: '0.4rem' }}>WhatsApp / Teléfono:</span>
                    <span style={{ fontSize: '0.85rem', color: '#2563eb', fontWeight: 700 }}>{selectedConv.meta?.sender?.phone_number}</span>
                  </>
                )}
              </div>

              {/* CRM Pipeline Stage Selector */}
              <div style={{ backgroundColor: '#ffffff', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0b2b4c', marginBottom: '0.5rem', display: 'block' }}>
                  Etapa Pipeline CRM:
                </label>
                <select
                  value={getCRMStage(selectedConv.labels)}
                  onChange={(e) => handleChangeCRMStage(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '8px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e5e7eb',
                    color: '#0b2b4c',
                    fontSize: '0.8rem',
                    fontWeight: 700
                  }}
                >
                  <option value="stage:prospecto">1. Prospecto IA</option>
                  <option value="stage:interesado">2. Interesado</option>
                  <option value="stage:cotizado">3. Cotización Enviada</option>
                  <option value="stage:cita_agendada">4. Cita Agendada</option>
                  <option value="stage:negociacion">5. En Negociación</option>
                  <option value="stage:ganado">6. Venta Ganada 🎉</option>
                  <option value="stage:perdido">7. Venta Perdida ❌</option>
                </select>
              </div>

              {/* Client Opportunities Section */}
              <div style={{ backgroundColor: '#ffffff', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0b2b4c' }}>
                    💼 Oportunidades del Cliente:
                  </span>
                  <button
                    onClick={async () => {
                      const title = prompt('Título de la Oportunidad Comercial:');
                      if (!title) return;
                      const valStr = prompt('Monto estimado en USD ($):', '1000');
                      const val = parseFloat(valStr || '0') || 0;

                      try {
                        const res = await fetch(`/api/control/${tenantId}/opportunities`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                          },
                          body: JSON.stringify({
                            contact_name: selectedConv.meta?.sender?.name || 'Cliente',
                            contact_phone: selectedConv.meta?.sender?.phone_number || '',
                            conversation_id: selectedConv.id.toString(),
                            title,
                            value: val,
                            currency: 'USD',
                            stage: 'stage:prospecto',
                            next_action_type: 'llamada',
                            next_action_notes: 'Seguimiento inicial por WhatsApp'
                          })
                        });
                        if (res.ok) {
                          showToast('Oportunidad vinculada a este chat!');
                          fetchClientOpportunities(selectedConv.meta?.sender?.phone_number || selectedConv.meta?.sender?.name || '');
                        }
                      } catch (e: any) {
                        showToast(e.message, 'error');
                      }
                    }}
                    style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    + Crear
                  </button>
                </div>

                {clientOpportunities.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Sin oportunidades activas registradas.</span>
                ) : (
                  clientOpportunities.map((opp: any) => (
                    <div key={opp.id} style={{ padding: '0.5rem', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.75rem' }}>
                      <div style={{ fontWeight: 700, color: '#0b2b4c' }}>{opp.title}</div>
                      <div style={{ color: '#2563eb', fontWeight: 800, marginTop: '0.2rem' }}>
                        ${Number(opp.value).toLocaleString('en-US', { minimumFractionDigits: 2 })} {opp.currency}
                      </div>
                      {opp.next_action_type && (
                        <div style={{ fontSize: '0.68rem', color: '#0284c7', marginTop: '0.2rem' }}>
                          📌 {opp.next_action_type}: {opp.next_action_notes || 'Pendiente'}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Labels list */}
              <div style={{ backgroundColor: '#ffffff', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0b2b4c', marginBottom: '0.5rem', display: 'block' }}>
                  Etiquetas (Labels):
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {selectedConv.labels.length === 0 ? (
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Sin etiquetas</span>
                  ) : (
                    selectedConv.labels.map((lbl, idx) => (
                      <span key={idx} style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: '#eff6ff', color: '#2563eb', fontWeight: 700, border: '1px solid #bfdbfe' }}>
                        {lbl}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Sin conversación seleccionada</div>
          )}
        </div>

      </div>

      {/* New Conversation Modal */}
      {showNewConvModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(11, 43, 76, 0.4)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 3000
        }}>
          <div style={{ backgroundColor: '#ffffff', padding: '1.75rem', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 40px rgba(11, 43, 76, 0.2)', border: '1px solid #e5e7eb' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#0b2b4c', fontSize: '1.1rem', fontWeight: 800 }}>+ Iniciar Nueva Conversación</h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0b2b4c', display: 'block', marginBottom: '0.4rem' }}>Seleccionar Contacto Registrado:</label>
              <select
                value={selectedContactId}
                onChange={(e) => setSelectedContactId(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: '#f8fafc', color: '#0b2b4c', fontSize: '0.85rem' }}
              >
                <option value="">-- Seleccionar de la lista --</option>
                {contactsList.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone_number || 'Sin Teléfono'})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                onClick={() => setShowNewConvModal(false)}
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: '#f8fafc', color: '#0b2b4c', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateNewConversation}
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
              >
                Iniciar Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
