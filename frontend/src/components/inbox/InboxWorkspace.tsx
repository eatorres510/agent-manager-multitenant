import React, { useState, useEffect, useRef } from 'react';
import { OpportunityModal, type OpportunityData } from '../crm/OpportunityModal';

interface InboxWorkspaceProps {
  tenantId: string;
  token: string | null;
  role: string | null;
  userEmail?: string | null;
}

interface ChatAttachment {
  id: number;
  message_id: number;
  file_type: 'image' | 'audio' | 'video' | 'file' | 'location' | string;
  data_url: string;
  thumb_url?: string;
  coordinates_lat?: number;
  coordinates_long?: number;
  fallback_title?: string;
}

interface ChatMessage {
  id: number;
  content: string;
  message_type: 0 | 1 | 2 | 3; // 0: incoming, 1: outgoing, 2: activity, 3: template
  private: boolean;
  created_at: number | string;
  content_attributes?: {
    location?: {
      latitude?: number;
      longitude?: number;
      name?: string;
      address?: string;
    };
    in_reply_to?: any;
  };
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
  timestamp?: number;
  created_at?: number;
  labels: string[];
  meta: {
    sender: {
      name: string;
      phone_number?: string;
      email?: string;
    };
    assignee?: {
      id?: number;
      name?: string;
      email?: string;
    };
  };
  messages?: ChatMessage[];
  dataFetched?: boolean;
  allMessagesLoaded?: boolean;
}

export const InboxWorkspace: React.FC<InboxWorkspaceProps> = ({ tenantId, token, role, userEmail }) => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConv, setSelectedConv] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeCategory, setActiveCategory] = useState<'all' | 'assigned' | 'ai' | 'pending' | 'resolved'>('all');
  const [filterOnlyMine, setFilterOnlyMine] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fetchingConvs, setFetchingConvs] = useState(false);
  const [fetchingMsgs, setFetchingMsgs] = useState(false);

  // Dynamic Advisors & Sales Teams list from Database & Chatwoot
  const [advisorsList, setAdvisorsList] = useState<{ id?: number; name: string; email: string; role?: string }[]>([]);
  const [teamsList, setTeamsList] = useState<{ id: number; name: string; team_key?: string }[]>([]);

  useEffect(() => {
    if (token) {
      // Fetch system users / advisors
      fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setAdvisorsList(data);
        })
        .catch(e => console.error('Error fetching system users:', e));

      // Fetch sales teams
      fetch(`/api/control/${tenantId}/teams`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setTeamsList(data);
        })
      // Fetch emergency AI status
      fetch(`/api/control/${tenantId}/emergency-status`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          if (data && typeof data.emergency_ai_mode === 'boolean') {
            setEmergencyAiMode(data.emergency_ai_mode);
          }
        })
        .catch(e => console.error('Error fetching emergency status:', e));
    }
  }, [tenantId, token]);

  const [emergencyAiMode, setEmergencyAiMode] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  const handleToggleEmergencyAI = () => {
    setShowEmergencyModal(true);
  };

  const confirmToggleEmergencyAI = async () => {
    setShowEmergencyModal(false);
    try {
      const endpoint = emergencyAiMode ? 'deactivate-global-ai' : 'activate-global-ai';
      const res = await fetch(`/api/control/${tenantId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setEmergencyAiMode(!emergencyAiMode);
        if (!emergencyAiMode) {
          showToast('⚡ MODO AUSENCIA ACTIVADO: La IA responderá automáticamente cuando un cliente envíe un mensaje.');
        } else {
          showToast('🛡️ Modo Ausencia DESACTIVADO: Control normal de asesores restablecido.');
        }
        fetchConversations();
      } else {
        throw new Error(data.error || 'Error al cambiar Modo Ausencia');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const formatMessageTime = (rawTime: number | string) => {
    if (!rawTime) return '';
    let date: Date;
    if (typeof rawTime === 'number') {
      date = new Date(rawTime > 10000000000 ? rawTime : rawTime * 1000);
    } else {
      date = new Date(rawTime);
    }
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatActivityMessage = (text: string) => {
    if (!text) return 'Evento del sistema';
    if (text.includes('agregó bot-escalado')) return 'Conversación escalada a asesor humano';
    if (text.includes('eliminó a bot-escalado')) return 'Etiqueta de escalamiento removida';
    if (text.includes('marcada como pendiente')) return 'Atención devuelta a la Inteligencia Artificial (Pendiente)';
    if (text.includes('marcada como resuelta') || text.includes('resolved')) return 'Conversación marcada como resuelta';
    if (text.includes('marcada como abierta') || text.includes('open')) return 'Conversación en atención por asesor humano';
    return text;
  };

  // Message composer state
  const [inputMessage, setInputMessage] = useState('');
  const [replyMode, setReplyMode] = useState<'public' | 'private'>('public');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sendingMsg, setSendingMsg] = useState(false);

  // Voice Recording state
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingTimer, setRecordingTimer] = useState(0);
  const [showMicHelpModal, setShowMicHelpModal] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  const getAudioStream = async (): Promise<MediaStream> => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      return await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    const legacyGetUserMedia = (navigator as any).getUserMedia ||
      (navigator as any).webkitGetUserMedia ||
      (navigator as any).mozGetUserMedia ||
      (navigator as any).msGetUserMedia;

    if (legacyGetUserMedia) {
      return new Promise((resolve, reject) => {
        legacyGetUserMedia.call(navigator, { audio: true }, resolve, reject);
      });
    }

    throw new Error("El navegador requiere conexión HTTPS o habilitar permisos de micrófono en chrome://flags.");
  };

  const startAudioRecording = async () => {
    try {
      const stream = await getAudioStream();
      const mimeType = (window.MediaRecorder && MediaRecorder.isTypeSupported('audio/ogg;codecs=opus'))
        ? 'audio/ogg;codecs=opus'
        : (window.MediaRecorder && MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';
        const audioFile = new File([audioBlob], `nota_de_voz_${Date.now()}.${ext}`, { type: mimeType });
        setSelectedFile(audioFile);
        stream.getTracks().forEach(track => track.stop());
        showToast('Nota de voz grabada exitosamente.');
      };

      mediaRecorder.start();
      setIsRecordingAudio(true);
      setRecordingTimer(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingTimer(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      setShowMicHelpModal(true);
      showToast(`Abre las instrucciones para habilitar el micrófono en Chrome/Edge.`, 'error');
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const cancelAudioRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecordingAudio(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      showToast('Grabación de audio cancelada.');
    }
  };

  // Quick Action Popovers & Modals
  const [showNewConvModal, setShowNewConvModal] = useState(false);
  const [contactsList, setContactsList] = useState<any[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [clientOpportunities, setClientOpportunities] = useState<any[]>([]);

  // Opportunity Modal state
  const [showOppModal, setShowOppModal] = useState(false);
  const [editingOppData, setEditingOppData] = useState<Partial<OpportunityData> | null>(null);

  // Toast / Alerts
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const selectedConvRef = useRef<ConversationItem | null>(null);
  selectedConvRef.current = selectedConv;
  const msgCacheRef = useRef<Record<string, ChatMessage[]>>({});

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

  const fetchConversations = async (isSilent = false) => {
    if (!isSilent && conversations.length === 0) {
      setFetchingConvs(true);
    }
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
        if (Array.isArray(data)) {
          const convList: ConversationItem[] = data;

          // Chatwoot Store Pattern (SET_ALL_CONVERSATION):
          // Merge incoming conversations while preserving messages array and dataFetched state for active chats!
          setConversations(prev => {
            const newConvs = [...prev];
            convList.forEach(incoming => {
              const idx = newConvs.findIndex(c => c.id === incoming.id);
              if (idx < 0) {
                newConvs.push({ ...incoming, messages: [], dataFetched: false });
              } else {
                const existing = newConvs[idx];
                newConvs[idx] = {
                  ...incoming,
                  messages: existing.messages || [],
                  dataFetched: existing.dataFetched || false,
                  allMessagesLoaded: existing.allMessagesLoaded
                };
              }
            });

            newConvs.sort((a, b) => {
              const timeA = a.last_activity_at || a.timestamp || a.created_at || 0;
              const timeB = b.last_activity_at || b.timestamp || b.created_at || 0;
              return timeB - timeA;
            });

            return newConvs;
          });

          if (convList.length > 0) {
            if (!selectedConvRef.current) {
              const firstConv = convList[0];
              setSelectedConv(firstConv);
              fetchMessages(firstConv.id.toString(), false);
            } else {
              const updatedSelected = convList.find(c => c.id === selectedConvRef.current?.id);
              if (updatedSelected) {
                if (updatedSelected.status !== selectedConvRef.current.status) {
                  setSelectedConv(updatedSelected);
                }
              }
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
        if (Array.isArray(data)) {
          const msgList: ChatMessage[] = data;
          if (msgList.length > 0) {
            msgCacheRef.current[convId] = msgList;
          }

          // Chatwoot Store Pattern: Update conversation object inside conversations store
          setConversations(prev => prev.map(c => {
            if (c.id.toString() === convId.toString()) {
              return {
                ...c,
                messages: msgList,
                dataFetched: true
              };
            }
            return c;
          }));

          // If this is the currently selected conversation, update messages state atomically
          if (selectedConvRef.current && selectedConvRef.current.id.toString() === convId.toString()) {
            setMessages(prev => {
              if (msgList.length === 0 && prev.length > 0) {
                return prev; // Never wipe out existing messages with empty array!
              }
              if (prev.length === msgList.length && prev.every((m, i) => m.id === msgList[i]?.id)) {
                return prev;
              }
              return msgList;
            });
          }
        }

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
    if ((!inputMessage.trim() && !selectedFile) || !selectedConv) return;
    setSendingMsg(true);
    try {
      const isPrivate = replyMode === 'private';
      let res;

      if (selectedFile) {
        const formData = new FormData();
        if (inputMessage.trim()) formData.append('content', inputMessage.trim());
        formData.append('is_private', isPrivate ? 'true' : 'false');
        formData.append('file', selectedFile);

        res = await fetch(`/api/control/${tenantId}/conversations/${selectedConv.id}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
      } else {
        res = await fetch(`/api/control/${tenantId}/conversations/${selectedConv.id}/messages`, {
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
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error enviando mensaje');

      setInputMessage('');
      setSelectedFile(null);
      fetchMessages(selectedConv.id.toString(), true);
      showToast(isPrivate ? 'Nota privada interna guardada' : 'Mensaje y archivo adjunto enviados a WhatsApp');
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
    fetchConversations(false);

    // Establish Real-Time SSE Event Connection
    let sse: EventSource | null = null;
    if (token) {
      const sseUrl = `/api/control/${tenantId}/events?token=${encodeURIComponent(token)}`;
      sse = new EventSource(sseUrl);

      sse.addEventListener('message_created', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          const convId = payload.conversation_id || payload.conversation?.id || payload.message?.conversation_id;
          
          // If event belongs to current active conversation, refresh messages immediately!
          if (selectedConvRef.current && convId && convId.toString() === selectedConvRef.current.id.toString()) {
            fetchMessages(selectedConvRef.current.id.toString(), true);
          }

          // Resync conversations list silently
          fetchConversations(true);
        } catch (err) {
          console.error('[SSE message_created Error]', err);
        }
      });

      sse.addEventListener('conversation_updated', () => {
        fetchConversations(true);
      });

      sse.addEventListener('conversation_status_changed', () => {
        fetchConversations(true);
      });
    }

    // Safety net: resync every 60 seconds (silent background refresh)
    const safetyNetInterval = setInterval(() => {
      fetchConversations(true);
      if (selectedConvRef.current) {
        fetchMessages(selectedConvRef.current.id.toString(), true);
      }
    }, 60000);

    return () => {
      if (sse) sse.close();
      clearInterval(safetyNetInterval);
    };
  }, [tenantId, activeCategory, token]);

  const isAssignedToUser = (c: ConversationItem) => {
    if (!userEmail) return false;
    if (!c.meta?.assignee) return false;

    const rawUser = userEmail.toLowerCase().trim();
    const userPrefix = rawUser.split('@')[0].replace(/[^a-z0-9]/g, ''); // e.g. "ericktorres"

    const assigneeName = (c.meta.assignee.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const assigneeEmail = (c.meta.assignee.email || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    if (assigneeEmail && (rawUser.includes(assigneeEmail) || assigneeEmail.includes(rawUser) || assigneeEmail.includes(userPrefix) || userPrefix.includes(assigneeEmail.split('@')[0]))) {
      return true;
    }
    if (assigneeName && (assigneeName.includes(userPrefix) || userPrefix.includes(assigneeName))) {
      return true;
    }

    // Admins and SuperAdmins viewing "Mis Asignados" see all assigned conversations
    if (role === 'admin' || role === 'superadmin' || rawUser.includes('admin') || rawUser.includes('platform')) {
      return true;
    }

    return false;
  };

  let filteredConvs = conversations.filter(c => {
    const name = c.meta?.sender?.name || '';
    const phone = c.meta?.sender?.phone_number || '';
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) || phone.includes(searchQuery);
    if (!matchesSearch) return false;

    if (filterOnlyMine) {
      return isAssignedToUser(c);
    }

    if (activeCategory === 'assigned') {
      if (userEmail) {
        return isAssignedToUser(c);
      }
      return c.status === 'open';
    }

    return true;
  });

  // GUARANTEE: If selectedConv is open in main panel, ensure it is ALWAYS included in sidebar filteredConvs!
  if (selectedConv && !filteredConvs.some(c => c.id === selectedConv.id)) {
    filteredConvs = [selectedConv, ...filteredConvs];
  }

  const myAssignedCount = conversations.filter(c => isAssignedToUser(c)).length;
  const isAdmin = role === 'admin' || role === 'superadmin' || localStorage.getItem('role') === 'admin' || localStorage.getItem('role') === 'superadmin';

  // Filter ONLY actual commercial sales advisors for the Vendedor Asignado dropdown
  const salesAdvisorsOnly = advisorsList.filter(u => {
    const r = (u.role || '').toLowerCase();
    const e = (u.email || '').toLowerCase();

    // Exclude global superadmins and external technical agency accounts
    if (e.includes('platform.local') || e.includes('eitserv.tech') || e.includes('upagency') || e.includes('updigitalsolution')) {
      return false;
    }
    // Include advisors with role 'asesor' OR active company advisors (@sicsa.com.ni)
    return r === 'asesor' || r === 'agent' || (!r && e.includes('@sicsa.com.ni'));
  });

  const getCRMStage = (labels: string[]) => {
    const stageLabel = labels.find(l => l.startsWith('stage:'));
    return stageLabel || 'stage:prospecto';
  };

  return (
    <div style={{
      animation: 'fadeIn 0.25s ease-out',
      height: 'calc(100vh - 75px)',
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

      {/* Confirmation Modal for Modo Ausencia */}
      {showEmergencyModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(11, 43, 76, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3000
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '1.75rem',
            maxWidth: '480px',
            width: '90%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            border: '1px solid #e5e7eb',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <span className="material-symbols-outlined" style={{
                fontSize: '2rem',
                color: emergencyAiMode ? '#059669' : '#dc2626',
                padding: '0.5rem',
                borderRadius: '50%',
                backgroundColor: emergencyAiMode ? '#ecfdf5' : '#fef2f2'
              }}>
                {emergencyAiMode ? 'support_agent' : 'bolt'}
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0b2b4c' }}>
                  {emergencyAiMode ? '🛡️ Desactivar Modo Ausencia' : '⚡ Activar Modo Ausencia'}
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                  {emergencyAiMode ? 'Restablecer atención por asesores humanos' : 'Atención automática con Inteligencia Artificial'}
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.5, margin: '0 0 1.25rem 0' }}>
              {emergencyAiMode
                ? '¿Confirmas que deseas desactivar el Modo Ausencia? Las conversaciones volverán al flujo de atención normal con los asesores asignados.'
                : '¿Confirmas que deseas activar el Modo Ausencia de la IA? La Inteligencia Artificial responderá automáticamente a cualquier mensaje entrante de clientes mientras el equipo esté ausente.'}
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowEmergencyModal(false)}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmToggleEmergencyAI}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: emergencyAiMode ? '#2563eb' : '#dc2626',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}
              >
                {emergencyAiMode ? 'Sí, Desactivar Modo Ausencia' : 'Sí, Activar Modo Ausencia'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Alert Banner when Modo Ausencia is Active */}
      {emergencyAiMode && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '10px',
          padding: '0.65rem 1.25rem',
          marginBottom: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#991b1b',
          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="material-symbols-outlined" style={{ color: '#dc2626', fontSize: '1.4rem' }}>bolt</span>
            <div>
              <strong style={{ fontSize: '0.88rem' }}>MODO AUSENCIA GLOBAL ACTIVADO</strong>
              <div style={{ fontSize: '0.78rem', color: '#b91c1c' }}>
                La Inteligencia Artificial está respondiendo a todos los mensajes entrantes de clientes.
              </div>
            </div>
          </div>
          {isAdmin ? (
            <button
              onClick={() => setShowEmergencyModal(true)}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '6px',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)'
              }}
            >
              Desactivar Modo Ausencia
            </button>
          ) : (
            <span style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 600, fontStyle: 'italic' }}>
              (Activado por Administrador)
            </span>
          )}
        </div>
      )}

      {/* Main 3-Column Grid Container */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr) 300px', gap: '0.75rem', flex: 1, overflow: 'hidden', width: '100%' }}>
        
        {/* ================= COLUMN 1: NAVIGATION & CONVERSATION LIST ================= */}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', borderRadius: '12px', padding: '0.85rem', border: '1px solid #e5e7eb', gap: '0.85rem', overflow: 'hidden' }}>
          
          <div>
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 800, color: '#0b2b4c' }}>Bandeja de Entrada</h3>

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
                gap: '0.4rem',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>add</span> + Nueva Conversación
            </button>

            {/* Out-Of-Office Global AI Toggle Button (Admins Only) */}
            {isAdmin && (
              <button
                onClick={handleToggleEmergencyAI}
                style={{
                  width: '100%',
                  marginTop: '0.5rem',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '8px',
                  border: emergencyAiMode ? '1px solid #ef4444' : '1px solid #10b981',
                  backgroundColor: emergencyAiMode ? '#fef2f2' : '#ecfdf5',
                  color: emergencyAiMode ? '#dc2626' : '#047857',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  boxShadow: emergencyAiMode ? '0 0 10px rgba(239, 68, 68, 0.2)' : '0 2px 6px rgba(16, 185, 129, 0.1)'
                }}
                title="Activa la Inteligencia Artificial para responder a TODOS los clientes cuando los asesores estén ausentes"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: emergencyAiMode ? '#dc2626' : '#047857' }}>
                  {emergencyAiMode ? 'bolt' : 'support_agent'}
                </span>
                {emergencyAiMode ? 'MODO AUSENCIA ACTIVO' : '⚡ Activar IA - Modo Ausencia'}
              </button>
            )}
          </div>

          {/* Category Filter Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {[
              { id: 'all', label: 'Todos los Chats', icon: 'forum', count: conversations.length },
              { id: 'assigned', label: 'Mis Asignados (Humano)', icon: 'person', count: myAssignedCount > 0 ? myAssignedCount : conversations.filter(c => c.status === 'open').length },
              { id: 'ai', label: 'Atendidos por IA', icon: 'smart_toy', count: conversations.filter(c => c.status === 'pending').length },
              { id: 'resolved', label: 'Resueltos', icon: 'check_circle', count: conversations.filter(c => c.status === 'resolved').length }
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
                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>{cat.icon}</span>
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

          {/* Quick Toggle: Filter Only My Assigned Chats */}
          {userEmail && (
            <div 
              onClick={() => setFilterOnlyMine(!filterOnlyMine)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                padding: '0.5rem 0.65rem', 
                backgroundColor: filterOnlyMine ? '#eff6ff' : '#ffffff', 
                borderRadius: '8px', 
                border: filterOnlyMine ? '1px solid #3b82f6' : '1px solid #e5e7eb',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: filterOnlyMine ? '#2563eb' : '#64748b' }}>
                  filter_alt
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: filterOnlyMine ? '#2563eb' : '#475569' }}>
                  Ver sólo mis chats ({userEmail.split('@')[0]})
                </span>
              </div>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 800,
                padding: '0.1rem 0.45rem',
                borderRadius: '10px',
                backgroundColor: filterOnlyMine ? '#2563eb' : '#cbd5e1',
                color: '#ffffff'
              }}>
                {filterOnlyMine ? 'SÓLO MIS CHATS' : 'TODOS'}
              </span>
            </div>
          )}

          {/* Search Input */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o teléfono..."
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
              MENSAJES RECIENTES
            </div>

            {fetchingConvs && conversations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.8rem' }}>Cargando chats en vivo...</div>
            ) : filteredConvs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b', fontSize: '0.82rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                {filterOnlyMine ? (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.5rem', color: '#3b82f6', marginBottom: '0.3rem' }}>filter_alt_off</span>
                    <div style={{ fontWeight: 700, color: '#0b2b4c' }}>Sin chats asignados a ti</div>
                    <div style={{ fontSize: '0.75rem', marginTop: '0.2rem', color: '#64748b' }}>
                      Actualmente no tienes conversaciones asignadas a ({userEmail?.split('@')[0]}).
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setFilterOnlyMine(false)}
                      style={{ marginTop: '0.65rem', padding: '0.35rem 0.75rem', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Ver Bandeja General (TODOS)
                    </button>
                  </>
                ) : (
                  'No hay conversaciones activas.'
                )}
              </div>
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
                        const cached = msgCacheRef.current[c.id.toString()];
                        if (cached && cached.length > 0) {
                          setMessages(cached);
                        }
                        fetchMessages(c.id.toString(), true);
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
                      <strong style={{ fontSize: '0.85rem', color: '#0b2b4c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>{contactName}</strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        {c.last_activity_at && (
                          <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>
                            {new Date((typeof c.last_activity_at === 'number' && c.last_activity_at < 2000000000 ? c.last_activity_at * 1000 : c.last_activity_at)).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        <span style={{
                          fontSize: '0.62rem',
                          padding: '0.12rem 0.4rem',
                          borderRadius: '4px',
                          fontWeight: 700,
                          backgroundColor: isPendingBot ? 'rgba(16, 185, 129, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                          color: isPendingBot ? '#059669' : '#2563eb'
                        }}>
                          {isPendingBot ? 'IA' : 'HUMANO'}
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.meta?.sender?.phone_number || `Conversación #${c.id}`}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================= COLUMN 2: CENTER CHAT WINDOW (THE HERO ROOM) ================= */}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
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
                  <span style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: selectedConv.status === 'pending' && !selectedConv.labels?.includes('bot-escalado') ? '#10b981' : '#f59e0b',
                    display: 'inline-block'
                  }} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0b2b4c' }}>
                        {selectedConv.meta?.sender?.name || `Conversación #${selectedConv.id}`}
                      </h3>

                      {/* Google Material Status Badge */}
                      <span style={{
                        fontSize: '0.7rem',
                        padding: '0.2rem 0.65rem',
                        borderRadius: '20px',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        backgroundColor: selectedConv.status === 'pending' && !selectedConv.labels?.includes('bot-escalado') ? '#ecfdf5' : '#fef3c7',
                        color: selectedConv.status === 'pending' && !selectedConv.labels?.includes('bot-escalado') ? '#047857' : '#b45309',
                        border: selectedConv.status === 'pending' && !selectedConv.labels?.includes('bot-escalado') ? '1px solid #a7f3d0' : '1px solid #fde68a'
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>
                          {selectedConv.status === 'pending' && !selectedConv.labels?.includes('bot-escalado') ? 'smart_toy' : 'support_agent'}
                        </span>
                        {selectedConv.status === 'pending' && !selectedConv.labels?.includes('bot-escalado') ? 'Atención por IA' : 'Atención Humana'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.1rem' }}>
                      CHAT DE WHATSAPP • {selectedConv.meta?.sender?.phone_number || ''}
                    </div>
                  </div>
                </div>

                {/* Top Action Buttons (Google Material Design - No Emojis) */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {selectedConv.status === 'pending' && !selectedConv.labels?.includes('bot-escalado') ? (
                    <button
                      onClick={() => handleToggleStatus('open')}
                      title="Pausar la Inteligencia Artificial y tomar el control del chat como asesor humano"
                      style={{
                        padding: '0.5rem 0.95rem',
                        fontSize: '0.8rem',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#0f172a',
                        color: '#ffffff',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        boxShadow: '0 2px 6px rgba(15, 23, 42, 0.15)',
                        transition: 'all 0.15s'
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '1.05rem', color: '#f8fafc' }}>pause_circle</span>
                      Pausar IA y Atender
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleStatus('pending')}
                      title="Devolver el control del chat a la Inteligencia Artificial"
                      style={{
                        padding: '0.5rem 0.95rem',
                        fontSize: '0.8rem',
                        borderRadius: '8px',
                        border: '1px solid #10b981',
                        backgroundColor: '#10b981',
                        color: '#ffffff',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                        transition: 'all 0.15s'
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '1.05rem', color: '#ffffff' }}>smart_toy</span>
                      Activar Asistente IA
                    </button>
                  )}

                  {selectedConv.status !== 'resolved' && (
                    <button
                      onClick={() => handleToggleStatus('resolved')}
                      title="Marcar conversación como resuelta"
                      style={{
                        padding: '0.5rem 0.95rem',
                        fontSize: '0.8rem',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#334155',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        transition: 'all 0.15s'
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '1.05rem', color: '#059669' }}>check_circle</span>
                      Resolver Chat
                    </button>
                  )}
                </div>
              </div>

              {/* Chat Stream Window */}
              <div ref={chatContainerRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem', backgroundColor: '#fafafa' }}>
                
                {/* Date Divider Pill */}
                <div style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.25rem 0.85rem', borderRadius: '12px', backgroundColor: '#e5e7eb', color: '#0b2b4c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    HOY
                  </span>
                </div>

                {fetchingMsgs && messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Cargando mensajes...</div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Aún no hay mensajes registrados.</div>
                ) : (
                  messages.filter((m, idx, arr) => {
                    if (m.private) {
                      const prev = arr[idx - 1];
                      if (prev && prev.private && (prev.content === m.content || (prev.content && m.content && prev.content.includes('Toma de control manual') && m.content.includes('Toma de control manual')))) {
                        return false;
                      }
                    }
                    return true;
                  }).map((m) => {
                    // System Activity Logs (message_type === 2) -> Centered Pill Audit Log
                    if (m.message_type === 2) {
                      return (
                        <div key={m.id} style={{ display: 'flex', justifyContent: 'center', margin: '0.45rem 0' }}>
                          <div style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            padding: '0.3rem 0.85rem',
                            borderRadius: '20px',
                            border: '1px solid #cbd5e1',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                          }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', color: '#64748b' }}>info</span>
                            <span>{formatActivityMessage(m.content)}</span>
                            {m.created_at && (
                              <span style={{ opacity: 0.65, fontSize: '0.68rem', marginLeft: '0.35rem' }}>
                                • {formatMessageTime(m.created_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    }

                    const isIncoming = m.message_type === 0;
                    const isPrivate = m.private;

                    const senderName = m.sender?.name || '';
                    const senderEmail = (m.sender as any)?.email || '';
                    
                    const isBot = !isIncoming && (
                      m.sender?.type === 'agent_bot' || 
                      senderName.toLowerCase().includes('bot') || 
                      senderName.toLowerCase().includes('sofía') || 
                      senderName.toLowerCase().includes('asistente') || 
                      senderName === 'Bot' ||
                      (!m.sender && !isPrivate)
                    );

                    const isTechAccount = 
                      senderName.toLowerCase().includes('anthony') ||
                      senderName.toLowerCase().includes('upagency') ||
                      senderName.toLowerCase().includes('eitserv') ||
                      senderName.toLowerCase().includes('platform') ||
                      senderName === 'SICSA NICARAGUA' ||
                      senderEmail.toLowerCase().includes('upagency') ||
                      senderEmail.toLowerCase().includes('eitserv') ||
                      senderEmail.toLowerCase().includes('platform.local');

                    const matchedAdvisor = advisorsList.find(a => 
                      !isTechAccount && (
                        (senderEmail && a.email?.toLowerCase() === senderEmail.toLowerCase()) ||
                        ((m.sender as any)?.id && a.id === (m.sender as any).id)
                      )
                    );

                    const assignedAdvisor = advisorsList.find(a => 
                      (selectedConv?.meta?.assignee?.email && a.email?.toLowerCase() === selectedConv.meta.assignee.email.toLowerCase()) ||
                      (selectedConv?.meta?.assignee?.name && a.name?.toLowerCase() === selectedConv.meta.assignee.name.toLowerCase())
                    );

                    const fallbackHumanName = assignedAdvisor?.name || 
                      (selectedConv?.meta?.assignee?.name && selectedConv.meta.assignee.name !== 'SICSA NICARAGUA' ? selectedConv.meta.assignee.name : '') ||
                      (userEmail ? userEmail.split('@')[0] : 'Asesor Humano');

                    const humanAgentName = isTechAccount
                      ? fallbackHumanName
                      : (matchedAdvisor?.name || 
                         (matchedAdvisor?.email ? matchedAdvisor.email.split('@')[0] : '') ||
                         (senderName && !isTechAccount && senderName !== 'Bot' ? senderName : fallbackHumanName));

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
                          <span style={{ fontWeight: 800, color: isPrivate ? '#b45309' : isIncoming ? '#64748b' : isBot ? '#047857' : '#93c5fd', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            {isPrivate ? (
                              <><span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>lock</span> NOTA PRIVADA INTERNA</>
                            ) : isIncoming ? (
                              <><span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>person</span> {selectedConv.meta?.sender?.name || 'Cliente'}</>
                            ) : isBot ? (
                              <><span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>smart_toy</span> Asistente IA Sofía</>
                            ) : (
                              <><span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>support_agent</span> {humanAgentName}</>
                            )}
                          </span>
                        </div>
                        
                        {/* MESSAGE TEXT CONTENT OR NULL CONTENT FALLBACK */}
                        {(() => {
                          const attrs = (m.content_attributes || {}) as any;
                          const displayContent = m.content || 
                            attrs.deleted_text || 
                            attrs.caption || 
                            attrs.fallback_title || 
                            attrs.story_sender ||
                            '';

                          if (displayContent) {
                            return <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, fontWeight: 500 }}>{displayContent}</div>;
                          }

                          // If no content text and no attachments, display helpful informative placeholder
                          if (!m.attachments || m.attachments.length === 0) {
                            return (
                              <div style={{ fontStyle: 'italic', fontSize: '0.8rem', opacity: 0.85, display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>chat_bubble_outline</span>
                                {isIncoming ? 'El cliente envió un sticker, elemento interactivo o mensaje de estado.' : 'Mensaje enviado sin texto.'}
                              </div>
                            );
                          }

                          return null;
                        })()}

                        {/* WHATSAPP GPS LOCATION CARD (STRICTLY FOR REAL LOCATION DATA) */}
                        {(() => {
                          const loc = m.content_attributes?.location;
                          const locAtt = m.attachments?.find((att: any) => 
                            att.file_type === 'location' || 
                            att.coordinates_lat || 
                            (att.data_url && (att.data_url.includes('maps.google.com') || att.data_url.includes('maps.apple.com') || att.data_url.includes('google.com/maps')))
                          );
                          
                          const hasMapsInContent = m.content && (m.content.includes('maps.google.com') || m.content.includes('maps.apple.com') || m.content.includes('google.com/maps'));

                          // STRICT GUARD: If no real location data or maps link, DO NOT render location card!
                          if (!loc && !locAtt && !hasMapsInContent) {
                            return null;
                          }

                          const lat = loc?.latitude || locAtt?.coordinates_lat || (locAtt as any)?.latitude;
                          const lng = loc?.longitude || locAtt?.coordinates_long || (locAtt as any)?.longitude;
                          const locName = loc?.name || locAtt?.fallback_title || '';
                          const locAddress = loc?.address || '';

                          let mapsUrl = '';
                          if (lat && lng) {
                            mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
                          } else if (locAtt?.data_url && (locAtt.data_url.includes('maps.google.com') || locAtt.data_url.includes('maps.apple.com') || locAtt.data_url.includes('google.com/maps'))) {
                            mapsUrl = locAtt.data_url;
                          } else if (hasMapsInContent) {
                            const match = m.content.match(/https?:\/\/[^\s]+/);
                            if (match) mapsUrl = match[0];
                          }

                          // Text for forwarding/copying
                          const forwardText = mapsUrl 
                            ? `📍 Ubicación compartida por el cliente: ${mapsUrl}`
                            : locName || locAddress 
                              ? `📍 Ubicación: ${locName} ${locAddress}`
                              : `📍 Ubicación de WhatsApp (Coordenadas GPS)`;

                          return (
                            <div style={{
                              backgroundColor: '#ffffff',
                              padding: '0.85rem',
                              borderRadius: '10px',
                              border: '1px solid #93c5fd',
                              marginTop: '0.5rem',
                              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.08)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, color: '#1e40af', fontSize: '0.85rem' }}>
                                  <span className="material-symbols-outlined" style={{ color: '#ef4444', fontSize: '1.25rem' }}>location_on</span>
                                  Ubicación GPS / Contacto de WhatsApp
                                </div>
                                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Msg #{m.id}</span>
                              </div>

                              {locName && <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginTop: '0.35rem' }}>{locName}</div>}
                              {locAddress && <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.15rem' }}>{locAddress}</div>}
                              {lat && lng && (
                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem', fontFamily: 'monospace' }}>
                                  Coordenadas GPS: {lat}, {lng}
                                </div>
                              )}

                              {/* Action Buttons: Open Maps / Forward / Copy */}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.65rem' }}>
                                {mapsUrl ? (
                                  <a
                                    href={mapsUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.35rem',
                                      padding: '0.4rem 0.75rem',
                                      backgroundColor: '#2563eb',
                                      color: '#ffffff',
                                      borderRadius: '6px',
                                      fontSize: '0.78rem',
                                      fontWeight: 800,
                                      textDecoration: 'none'
                                    }}
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>map</span>
                                    Abrir en Google Maps
                                  </a>
                                ) : null}

                                {/* Button to load location text into composer for forwarding */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInputMessage(forwardText);
                                    showToast('Ubicación lista en el cuadro de respuesta para reenviar.');
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0.4rem 0.75rem',
                                    backgroundColor: '#059669',
                                    color: '#ffffff',
                                    borderRadius: '6px',
                                    border: 'none',
                                    fontSize: '0.78rem',
                                    fontWeight: 800,
                                    cursor: 'pointer'
                                  }}
                                  title="Reenviar esta ubicación en tu respuesta"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>reply</span>
                                  Reenviar Ubicación
                                </button>

                                {/* Button to copy location link or text to clipboard */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(forwardText);
                                    showToast('Ubicación copiada al portapapeles.');
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0.4rem 0.75rem',
                                    backgroundColor: '#ffffff',
                                    color: '#1e293b',
                                    borderRadius: '6px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                  title="Copiar texto de ubicación"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: '#2563eb' }}>content_copy</span>
                                  Copiar Ubicación
                                </button>
                              </div>
                            </div>
                          );
                        })()}

                        {/* ATTACHMENTS (VOICE NOTES, IMAGES, PDFS) */}
                        {m.attachments && m.attachments.length > 0 && (
                          <div style={{ marginTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {m.attachments.map((att: any, attIdx: number) => {
                              const fileType = att.file_type || '';
                              const dataUrl = att.data_url || att.thumb_url || '';

                              if (fileType === 'location') return null; // Rendered above

                              if (fileType === 'audio' || dataUrl.includes('.ogg') || dataUrl.includes('.mp3') || dataUrl.includes('.m4a') || dataUrl.includes('.wav')) {
                                return (
                                  <div key={attIdx} style={{ backgroundColor: '#e0f2fe', padding: '0.6rem', borderRadius: '8px', marginTop: '0.25rem', border: '1px solid #0284c7' }}>
                                    <div style={{ fontSize: '0.72rem', color: '#0369a1', marginBottom: '0.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                      <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>mic</span> Audio de WhatsApp
                                    </div>
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
                                      <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>description</span> Descargar Documento / PDF
                                    </a>
                                  </div>
                                );
                              }
                            })}
                          </div>
                        )}

                        {/* MESSAGE TIMESTAMP (BOTTOM RIGHT CORNER) */}
                        {m.created_at && (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                            gap: '0.25rem',
                            marginTop: '0.35rem',
                            fontSize: '0.68rem',
                            color: !isIncoming && !isBot && !isPrivate ? 'rgba(255,255,255,0.75)' : '#64748b',
                            fontWeight: 600
                          }}>
                            <span>{formatMessageTime(m.created_at)}</span>
                            {!isIncoming && (
                              <span className="material-symbols-outlined" style={{ fontSize: '0.82rem', opacity: 0.8 }}>
                                {isBot ? 'smart_toy' : 'done_all'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
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
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>reply</span> Respuesta Pública
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
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>lock</span> Nota Privada Interna
                    </button>
                  </div>

                  {/* Textarea Container */}
                  <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    
                    {/* Active Voice Recording Bar */}
                    {isRecordingAudio && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 1rem',
                        backgroundColor: '#fef2f2',
                        borderRadius: '10px',
                        border: '1px solid #fca5a5'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#dc2626', fontWeight: 800, fontSize: '0.85rem' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>mic</span>
                          <span>Grabando Nota de Voz de WhatsApp: {Math.floor(recordingTimer / 60).toString().padStart(2, '0')}:{(recordingTimer % 60).toString().padStart(2, '0')}</span>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={cancelAudioRecording}
                            style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={stopAudioRecording}
                            style={{ padding: '0.4rem 0.85rem', borderRadius: '6px', border: 'none', backgroundColor: '#dc2626', color: '#ffffff', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>stop</span> Adjuntar Audio
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Attachment, Audio & Snippet Image Preview Box */}
                    {selectedFile && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.55rem 0.85rem',
                        backgroundColor: selectedFile.type.startsWith('audio/') ? '#ecfdf5' : '#eff6ff',
                        borderRadius: '8px',
                        border: selectedFile.type.startsWith('audio/') ? '1px solid #a7f3d0' : '1px solid #bfdbfe'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.82rem', color: selectedFile.type.startsWith('audio/') ? '#047857' : '#1e40af', fontWeight: 700, flex: 1 }}>
                          {selectedFile.type.startsWith('image/') ? (
                            <img
                              src={URL.createObjectURL(selectedFile)}
                              alt="Vista previa del recorte"
                              style={{ width: '42px', height: '42px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #93c5fd' }}
                            />
                          ) : selectedFile.type.startsWith('audio/') ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', width: '100%' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '1.4rem', color: '#059669' }}>mic</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 800, fontSize: '0.82rem' }}>Nota de Voz Grabada ({(selectedFile.size / 1024).toFixed(1)} KB)</div>
                                <audio controls src={URL.createObjectURL(selectedFile)} style={{ height: '32px', width: '100%', marginTop: '0.2rem' }} />
                              </div>
                            </div>
                          ) : (
                            <span className="material-symbols-outlined" style={{ fontSize: '1.3rem', color: '#2563eb' }}>
                              {selectedFile.type.includes('pdf') ? 'picture_as_pdf' : 'attach_file'}
                            </span>
                          )}

                          {!selectedFile.type.startsWith('audio/') && (
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{selectedFile.name}</div>
                              <div style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 600 }}>
                                {(selectedFile.size / 1024).toFixed(1)} KB • Listo para enviar a WhatsApp
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedFile(null)}
                          style={{ border: 'none', background: 'none', color: '#ef4444', fontWeight: 800, cursor: 'pointer', fontSize: '1.1rem', padding: '0.2rem 0.5rem', marginLeft: '0.5rem' }}
                          title="Quitar archivo adjunto"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    <textarea
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onPaste={(e) => {
                        const clipboardData = e.clipboardData;
                        if (!clipboardData) return;

                        // 1. Check items (from Snipping Tool Win+Shift+S / Ctrl+V clipboard)
                        const items = clipboardData.items;
                        if (items) {
                          for (let i = 0; i < items.length; i++) {
                            if (items[i].type.indexOf('image') !== -1) {
                              const blob = items[i].getAsFile();
                              if (blob) {
                                const extension = blob.type.split('/')[1] || 'png';
                                const file = new File([blob], `recorte_${new Date().getTime()}.${extension}`, { type: blob.type });
                                setSelectedFile(file);
                                showToast(`Recorte de imagen pegado exitosamente (${(file.size / 1024).toFixed(1)} KB)`);
                                return;
                              }
                            }
                          }
                        }

                        // 2. Fallback to clipboard files
                        if (clipboardData.files && clipboardData.files.length > 0) {
                          const file = clipboardData.files[0];
                          if (file) {
                            setSelectedFile(file);
                            showToast(`Archivo del portapapeles adjuntado: ${file.name}`);
                          }
                        }
                      }}
                      placeholder={replyMode === 'private' ? "Escribe una nota interna para el equipo..." : `Escribe tu respuesta para ${selectedConv.meta?.sender?.name || 'el cliente'} (puedes pegar capturas o grabar audios con el micrófono)...`}
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
                              setSelectedFile(file);
                              showToast(`Archivo '${file.name}' listo para enviar.`);
                            }
                          }}
                          accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx,.doc,.ogg,.mp3,.m4a,.wav,.webm"
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
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Adjuntar Cotización PDF, Documento o Imagen"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>attach_file</span>
                        </button>

                        {/* Microphone / WhatsApp Voice Note Button */}
                        <button
                          type="button"
                          onClick={isRecordingAudio ? stopAudioRecording : startAudioRecording}
                          style={{
                            padding: '0.45rem 0.75rem',
                            borderRadius: '8px',
                            border: isRecordingAudio ? '1px solid #ef4444' : '1px solid #e5e7eb',
                            backgroundColor: isRecordingAudio ? '#fee2e2' : '#ffffff',
                            color: isRecordingAudio ? '#dc2626' : '#2563eb',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Grabar Nota de Voz de WhatsApp"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>mic</span>
                        </button>
                      </div>

                      <button
                        type="submit"
                        disabled={sendingMsg || (!inputMessage.trim() && !selectedFile)}
                        style={{
                          padding: '0.55rem 1.25rem',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: replyMode === 'private' ? '#d97706' : '#2563eb',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          cursor: sendingMsg || (!inputMessage.trim() && !selectedFile) ? 'not-allowed' : 'pointer',
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
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', borderRadius: '12px', padding: '1rem', border: '1px solid #e5e7eb', gap: '1rem', overflowY: 'auto' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0b2b4c', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#2563eb' }}>person</span>
            Información del Contacto & CRM
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

              {/* Agent & Sales Team Assignment Section */}
              <div style={{ backgroundColor: '#ffffff', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0b2b4c', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: '#2563eb' }}>manage_accounts</span>
                    Vendedor Asignado ({salesAdvisorsOnly.length} Asesores):
                  </label>
                  <select
                    value={
                      salesAdvisorsOnly.find(a => 
                        (selectedConv.meta?.assignee?.email && a.email.toLowerCase() === selectedConv.meta.assignee.email.toLowerCase()) ||
                        (selectedConv.meta?.assignee?.id && a.id === selectedConv.meta.assignee.id) ||
                        (selectedConv.meta?.assignee?.name && (a.name === selectedConv.meta.assignee.name || a.email.split('@')[0] === selectedConv.meta.assignee.name))
                      )?.name || salesAdvisorsOnly.find(a => selectedConv.meta?.assignee?.email && a.email.toLowerCase() === selectedConv.meta.assignee.email.toLowerCase())?.email || 'unassigned'
                    }
                    onChange={async (e) => {
                      const selectedVal = e.target.value;
                      const advisor = salesAdvisorsOnly.find(a => a.name === selectedVal || a.email === selectedVal);
                      const assigneeId = advisor?.id || null;
                      const newAssignee = advisor ? { id: advisor.id, name: advisor.name, email: advisor.email } : undefined;

                      try {
                        await fetch(`/api/control/${tenantId}/conversations/${selectedConv.id}/assign`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                          },
                          body: JSON.stringify({ assignee_id: assigneeId })
                        });

                        // Update selectedConv state immutably for immediate React re-render
                        setSelectedConv(prev => prev ? {
                          ...prev,
                          meta: {
                            ...prev.meta,
                            assignee: newAssignee
                          }
                        } : null);

                        // Update conversations list state immutably
                        setConversations(prev => prev.map(c => 
                          c.id === selectedConv.id ? { ...c, meta: { ...c.meta, assignee: newAssignee } } : c
                        ));

                        showToast(selectedVal === 'unassigned' ? 'Conversación desasignada (Cola General).' : `Conversación asignada exitosamente a ${advisor?.name || selectedVal}`);
                        
                        // Silent background refresh
                        setTimeout(() => fetchConversations(true), 300);
                      } catch (err: any) {
                        showToast(`Error al reasignar: ${err.message}`, 'error');
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.45rem',
                      borderRadius: '8px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e5e7eb',
                      color: '#0b2b4c',
                      fontSize: '0.8rem',
                      fontWeight: 700
                    }}
                  >
                    <option value="unassigned">Sin Asignar (Cola General)</option>
                    {salesAdvisorsOnly.map((adv) => (
                      <option key={adv.id || adv.email} value={adv.name || adv.email}>
                        {adv.name || adv.email.split('@')[0]} ({adv.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0b2b4c', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: '#7c3aed' }}>groups</span>
                    Equipo de Ventas (Team):
                  </label>
                  <select
                    defaultValue={teamsList[0]?.id || ''}
                    onChange={async (e) => {
                      const teamId = e.target.value ? parseInt(e.target.value) : null;
                      const selectedTeam = teamsList.find(t => t.id === teamId);

                      try {
                        await fetch(`/api/control/${tenantId}/conversations/${selectedConv.id}/assign`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                          },
                          body: JSON.stringify({ assignee_id: selectedConv.meta?.assignee?.id || null, team_id: teamId })
                        });

                        showToast(teamId ? `Asignado al equipo: ${selectedTeam?.name}` : 'Equipo desasignado.');
                      } catch (err: any) {
                        showToast(`Error al cambiar equipo: ${err.message}`, 'error');
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.45rem',
                      borderRadius: '8px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e5e7eb',
                      color: '#0b2b4c',
                      fontSize: '0.8rem',
                      fontWeight: 700
                    }}
                  >
                    <option value="">-- Seleccionar Equipo --</option>
                    {teamsList.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
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
                  <option value="stage:ganado">6. Venta Ganada</option>
                  <option value="stage:perdido">7. Venta Perdida</option>
                </select>
              </div>

              {/* Client Opportunities Section */}
              <div style={{ backgroundColor: '#ffffff', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0b2b4c', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: '#2563eb' }}>business_center</span>
                    Oportunidades del Cliente:
                  </span>
                  <button
                    onClick={() => {
                      setEditingOppData(null);
                      setShowOppModal(true);
                    }}
                    style={{
                      padding: '0.25rem 0.6rem',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem'
                    }}
                  >
                    + Crear
                  </button>
                </div>

                {clientOpportunities.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Sin oportunidades activas registradas.</span>
                ) : (
                  clientOpportunities.map((opp: any) => (
                    <div
                      key={opp.id}
                      onClick={() => {
                        setEditingOppData(opp);
                        setShowOppModal(true);
                      }}
                      style={{
                        padding: '0.6rem',
                        borderRadius: '8px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontWeight: 800, color: '#0b2b4c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{opp.title}</span>
                        <span className="material-symbols-outlined" style={{ fontSize: '0.95rem', color: '#2563eb' }}>edit</span>
                      </div>
                      <div style={{ color: '#059669', fontWeight: 800, marginTop: '0.2rem' }}>
                        ${Number(opp.value).toLocaleString('en-US', { minimumFractionDigits: 2 })} {opp.currency}
                      </div>
                      {opp.assigned_agent_name && (
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>
                          👤 {opp.assigned_agent_name}
                        </div>
                      )}
                      {opp.next_action_type && (
                        <div style={{ fontSize: '0.7rem', color: '#0284c7', marginTop: '0.25rem', backgroundColor: '#f0f9ff', padding: '0.25rem 0.4rem', borderRadius: '4px', border: '1px solid #bae6fd' }}>
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

      {/* Opportunity Modal (Rich Create & Edit) */}
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

            showToast(oppData.id ? 'Oportunidad actualizada!' : 'Oportunidad comercial creada y vinculada!');
            if (selectedConv) {
              fetchClientOpportunities(selectedConv.meta?.sender?.phone_number || selectedConv.meta?.sender?.name || '');
            }
          } catch (e: any) {
            showToast(e.message, 'error');
          }
        }}
        initialData={editingOppData}
        defaultContactName={selectedConv?.meta?.sender?.name || 'Cliente'}
        defaultContactPhone={selectedConv?.meta?.sender?.phone_number || ''}
        defaultConvId={selectedConv?.id?.toString() || ''}
      />

      {/* Mic Permission Modal */}
      {showMicHelpModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(11, 43, 76, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 4000,
          padding: '1rem'
        }}>
          <div style={{ backgroundColor: '#ffffff', padding: '1.75rem', borderRadius: '16px', width: '100%', maxWidth: '520px', boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)', border: '1px solid #e5e7eb' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#0b2b4c', fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="material-symbols-outlined" style={{ color: '#dc2626', fontSize: '1.4rem' }}>mic_off</span>
                Habilitar Micrófono en Vivo (Chrome / Edge)
              </h3>
              <button onClick={() => setShowMicHelpModal(false)} style={{ border: 'none', background: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.5, margin: '0 0 1rem 0' }}>
              Los navegadores requieren habilitar el permiso de micrófono para la IP del servidor (<code style={{ backgroundColor: '#f1f5f9', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 700, color: '#2563eb' }}>http://31.220.107.80:4000</code>).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
              
              {/* Step 1 */}
              <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0b2b4c', marginBottom: '0.35rem' }}>
                  1. Abre una nueva pestaña y entra a:
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <code style={{ flex: 1, backgroundColor: '#ffffff', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', color: '#0369a1', fontFamily: 'monospace' }}>
                    chrome://flags/#unsafely-treat-insecure-origin-as-secure
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('chrome://flags/#unsafely-treat-insecure-origin-as-secure');
                      showToast('Enlace de chrome://flags copiado');
                    }}
                    style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Copiar
                  </button>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0b2b4c', marginBottom: '0.35rem' }}>
                  2. Pega la URL del servidor en el campo de texto:
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <code style={{ flex: 1, backgroundColor: '#ffffff', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', color: '#059669', fontFamily: 'monospace' }}>
                    http://31.220.107.80:4000
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('http://31.220.107.80:4000');
                      showToast('URL de la IP copiada');
                    }}
                    style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Copiar IP
                  </button>
                </div>
              </div>

              {/* Step 3 */}
              <div style={{ backgroundColor: '#ecfdf5', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #a7f3d0', fontSize: '0.82rem', color: '#047857', fontWeight: 700 }}>
                3. Cambia la opción a <strong>Enabled</strong> y haz clic en <strong>Relaunch</strong> (Reiniciar).
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={() => {
                  setShowMicHelpModal(false);
                  document.getElementById('attach_file_input')?.click();
                }}
                style={{ padding: '0.5rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: '#2563eb' }}>upload_file</span>
                Subir Audio Pregrabado (.ogg/.mp3)
              </button>

              <button
                type="button"
                onClick={() => setShowMicHelpModal(false)}
                style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Entendido
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
