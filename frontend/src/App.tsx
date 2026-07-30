import React, { useState, useEffect } from 'react';
import { AnalyticsTab } from './components/reports/AnalyticsTab';
import { ControlPlaneTab } from './components/admin/ControlPlaneTab';
import { InboxWorkspace } from './components/inbox/InboxWorkspace';
import { KanbanBoard } from './components/crm/KanbanBoard';
import { TeamManagementTab } from './components/admin/TeamManagementTab';
import { OnboardingWizard } from './components/admin/OnboardingWizard';
import { ContactsDirectoryTab } from './components/crm/ContactsDirectoryTab';
import { AdvisorHomeTab } from './components/home/AdvisorHomeTab';

interface AgentConfig {
  tenant_id: string;
  active_provider: 'gemini' | 'deepseek';
  gemini_api_key: string;
  deepseek_api_key: string;
  system_prompt: string;
  chatwoot_url: string;
  chatwoot_access_token: string;
  chatwoot_account_id: number;
  chatwoot_website_token: string;
  redis_host: string;
  redis_port: number;
  redis_password?: string;
  redis_enabled: number;
  escalation_keywords?: string;
  max_fallback_attempts?: number;
  escalation_instructions?: string;
  allow_ai_escalation?: boolean;
  escalation_team_id?: number;
}

interface KnowledgeBase {
  tenant_id: string;
  faqs: string;
  bank_accounts: string;
  branches: string;
  services?: string;
  timezone: string;
  mon_fri_start: string;
  mon_fri_end: string;
  sat_start: string;
  sat_end: string;
  sun_enabled: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  description: string;
  url: string;
  category?: string;
  brand?: string;
}

interface LogEntry {
  id: number;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface TenantInfo {
  tenant_id: string;
  tenant_name: string;
  email: string;
  created_at: string;
}

interface ToastMessage {
  text: string;
  type: 'success' | 'error';
}

type TabType = 'home' | 'settings' | 'knowledge' | 'products' | 'admin' | 'chats' | 'analytics' | 'activity' | 'webhook' | 'users' | 'appointments' | 'lost-sales' | 'api-docs' | 'control-plane' | 'inbox' | 'contacts' | 'kanban' | 'teams';

function App() {
  // Auth state
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [userEmail, setUserEmail] = useState<string | null>(localStorage.getItem('email'));
  const [tenantId, setTenantId] = useState<string | null>(localStorage.getItem('tenant_id'));
  const [role, setRole] = useState<'superadmin' | 'admin' | 'readonly' | null>(
    localStorage.getItem('role') as any
  );

  // Active Tab (Default to Advisor Home)
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [agentStatus, setAgentStatus] = useState<string>('online');

  // Auto-Idle Detection State & Refs
  const [autoIdleMinutes, setAutoIdleMinutes] = useState<number>(10);
  const lastActivityRef = React.useRef<number>(Date.now());
  const isAutoIdledRef = React.useRef<boolean>(false);

  // Auto-Idle Inactivity Listener & Automatic Restore
  useEffect(() => {
    if (!token) return;

    const handleUserActivity = () => {
      lastActivityRef.current = Date.now();

      if (isAutoIdledRef.current) {
        isAutoIdledRef.current = false;
        setAgentStatus('online');
        fetch('/api/agent-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: 'online' })
        }).catch(err => console.error('Error restoring status:', err));

        showToast('¡Bienvenido de vuelta! Tu estado se restauró automáticamente a Disponible.');
      }
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('mousedown', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);

    const interval = setInterval(() => {
      if (autoIdleMinutes <= 0 || agentStatus !== 'online') return;

      const idleTimeMs = Date.now() - lastActivityRef.current;
      const thresholdMs = autoIdleMinutes * 60 * 1000;

      if (idleTimeMs >= thresholdMs && !isAutoIdledRef.current) {
        isAutoIdledRef.current = true;
        setAgentStatus('idle');
        fetch('/api/agent-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: 'idle' })
        }).catch(err => console.error('Error setting auto-idle status:', err));

        showToast(`Inactividad detectada (${autoIdleMinutes} mins sin actividad). Estado cambiado a Inactivo / Ausente.`, 'error');
      }
    }, 15000);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('mousedown', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      clearInterval(interval);
    };
  }, [token, agentStatus, autoIdleMinutes]);

  // Users management state
  const [usersList, setUsersList] = useState<any[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'readonly'>('admin');
  const [newUserTenantId, setNewUserTenantId] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  // Login form state
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // App settings state
  const [config, setConfig] = useState<AgentConfig>({
    tenant_id: '',
    active_provider: 'gemini',
    gemini_api_key: '',
    deepseek_api_key: '',
    system_prompt: '',
    chatwoot_url: '',
    chatwoot_access_token: '',
    chatwoot_account_id: 1,
    chatwoot_website_token: '',
    redis_host: 'localhost',
    redis_port: 6379,
    redis_password: '',
    redis_enabled: 0,
    escalation_keywords: 'humano,asesor,representante,persona,soporte,operador',
    max_fallback_attempts: 3,
    escalation_instructions: '',
    allow_ai_escalation: true,
    escalation_team_id: undefined
  });

  // Knowledge base state
  const [kb, setKb] = useState<KnowledgeBase>({
    tenant_id: '',
    faqs: '',
    bank_accounts: '',
    branches: '',
    services: '',
    timezone: 'America/Managua',
    mon_fri_start: '08:00',
    mon_fri_end: '17:30',
    sat_start: '09:00',
    sat_end: '12:30',
    sun_enabled: 0
  });

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Super Admin state
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  
  // Appointments state
  interface AppointmentInfo {
    id: number;
    tenant_id: string;
    customer_name: string;
    customer_phone: string;
    appointment_date: string;
    appointment_time: string;
    service: string;
    created_at: string;
  }
  const [appointments, setAppointments] = useState<AppointmentInfo[]>([]);
  const [fetchingAppointments, setFetchingAppointments] = useState(false);
  const [selectedDate, setSelectedDate] = useState('2026-07-15');
  
  interface LostSaleInfo {
    id: number;
    tenant_id: string;
    product_id: string;
    product_name: string;
    customer_phone: string;
    conversation_id: string;
    timestamp: string;
  }
  const [lostSales, setLostSales] = useState<LostSaleInfo[]>([]);
  const [fetchingLostSales, setFetchingLostSales] = useState(false);
  const [showManualBookingModal, setShowManualBookingModal] = useState(false);
  const [manualBookingTime, setManualBookingTime] = useState('');
  const [manualCustomerName, setManualCustomerName] = useState('');
  const [manualCustomerPhone, setManualCustomerPhone] = useState('');
  const [manualService, setManualService] = useState('Servicio Técnico');
  const [bookingManual, setBookingManual] = useState(false);
  const [newTenantId, setNewTenantId] = useState('');

  // Change Password Modal State
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPasswordInput || !newPasswordInput) return;
    if (newPasswordInput !== confirmPasswordInput) {
      showToast('La nueva contraseña y la confirmación no coinciden.', 'error');
      return;
    }
    if (newPasswordInput.length < 6) {
      showToast('La nueva contraseña debe tener al menos 6 caracteres.', 'error');
      return;
    }

    setChangingPass(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          current_password: currentPasswordInput,
          new_password: newPasswordInput
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error cambiando contraseña');

      showToast('¡Contraseña actualizada con éxito!');
      setShowChangePassModal(false);
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setChangingPass(false);
    }
  };

  // Sidebar navigation collapsible groups state
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    operations: false,
    ai: false,
    analytics: false,
    system: false
  });

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantEmail, setNewTenantEmail] = useState('');
  const [newTenantPassword, setNewTenantPassword] = useState('');
  const [newTenantRole, setNewTenantRole] = useState<'admin' | 'superadmin'>('admin');
  const [creatingTenant, setCreatingTenant] = useState(false);

  // Analytics and Chat history state
  interface ChatConversation {
    conversation_id: string;
    last_active: string;
    message_count: number;
  }
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedConversationLogs, setSelectedConversationLogs] = useState<LogEntry[]>([]);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [isAutoPolling, setIsAutoPolling] = useState(true);
  const [logLimit, setLogLimit] = useState<number>(30);
  const [teamsList, setTeamsList] = useState<any[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const handleOnboardingComplete = async (updatedConfig: any, updatedKb: string) => {
    try {
      // 1. Save Config
      const configRes = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedConfig)
      });

      if (!configRes.ok) throw new Error('Error guardando configuración del agente');
      const savedConfigData = await configRes.json();

      // 2. Save Knowledge Base
      const kbRes = await fetch('/api/knowledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: updatedKb })
      });

      if (!kbRes.ok) throw new Error('Error guardando la base de conocimiento');

      setConfig(savedConfigData);
      setKb(prev => ({ ...prev, faqs: updatedKb }));
      setShowOnboarding(false);
      showToast('¡Onboarding completado con éxito! Tu Agente IA está listo para operar 24/7.');
    } catch (e: any) {
      showToast(e.message || 'Error durante el onboarding', 'error');
    }
  };

  const fetchUserProfile = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRole(data.role);
        setTenantId(data.tenant_id);
        setUserEmail(data.email);
        localStorage.setItem('role', data.role);
        localStorage.setItem('tenant_id', data.tenant_id);
        localStorage.setItem('email', data.email);
      }
    } catch (e) {
      console.error('Error fetching user profile:', e);
    }
  };

  const fetchTeamsList = async () => {
    try {
      const currentTenant = tenantId || 'sicsa';
      const res = await fetch(`/api/control/${currentTenant}/teams`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTeamsList(data || []);
      }
    } catch (e) {
      console.error('Error fetching teams:', e);
    }
  };

  // Fetch configs, logs, products, and KB when token is available
  useEffect(() => {
    if (token) {
      fetchUserProfile();
      fetchConfig();
      fetchKnowledgeBase();
      fetchProducts();
      fetchLogs();
      fetchUsers();
      fetchAppointments();
      fetchLostSales();
      fetchTeamsList();
      if (role === 'superadmin') {
        fetchTenants();
      }
    } else {
      setLoading(false);
    }
  }, [token, role, tenantId]);

  // High-performance polling for Bitácora en Vivo (only active on activity tab)
  useEffect(() => {
    if (token && isAutoPolling && activeTab === 'activity') {
      const interval = setInterval(() => fetchLogs(), 5000);
      return () => clearInterval(interval);
    }
  }, [token, isAutoPolling, activeTab, logLimit]);

  // Load Chatwoot Web Widget dynamically if token is configured
  useEffect(() => {
    if (config.chatwoot_url && config.chatwoot_website_token) {
      console.log('Loading Chatwoot Web SDK widget...');
      
      const existingScript = document.getElementById('chatwoot-sdk-script');
      if (!existingScript) {
        (function(d,t) {
          var BASE_URL = config.chatwoot_url;
          var g = d.createElement(t) as HTMLScriptElement;
          var s = d.getElementsByTagName(t)[0];
          g.src = BASE_URL + "/packs/js/sdk.js";
          g.defer = true;
          g.async = true;
          g.id = 'chatwoot-sdk-script';
          s.parentNode?.insertBefore(g,s);
          g.onload = function(){
            (window as any).chatwootSDK.run({
              websiteToken: config.chatwoot_website_token,
              baseUrl: BASE_URL
            });
          }
        })(document,"script");
      } else {
        try {
          if ((window as any).chatwootSDK) {
            (window as any).chatwootSDK.run({
              websiteToken: config.chatwoot_website_token,
              baseUrl: config.chatwoot_url
            });
          }
        } catch (e) {
          console.error('Error re-running Chatwoot SDK:', e);
        }
      }
    }
  }, [config.chatwoot_url, config.chatwoot_website_token]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput, password: passwordInput })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Credenciales inválidas');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('email', data.email);
      localStorage.setItem('tenant_id', data.tenant_id);
      localStorage.setItem('role', data.role);

      setToken(data.token);
      setUserEmail(data.email);
      setTenantId(data.tenant_id);
      setRole(data.role);
      showToast('Sesión iniciada correctamente');
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    localStorage.removeItem('tenant_id');
    localStorage.removeItem('role');
    setToken(null);
    setUserEmail(null);
    setTenantId(null);
    setRole(null);
    setLogs([]);
    setProducts([]);
    showToast('Sesión cerrada');
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        handleLogout();
        return;
      }
      if (!res.ok) throw new Error('No se pudo obtener la configuración');
      const data = await res.json();
      setConfig(data);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchKnowledgeBase = async () => {
    try {
      const res = await fetch('/api/knowledge', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setKb(data);
      }
    } catch (e) {
      console.error('Error fetching knowledge base:', e);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (e) {
      console.error('Error fetching products:', e);
    }
  };

  const fetchLogs = async (overrideLimit?: number) => {
    try {
      const targetLimit = overrideLimit || logLimit || 30;
      const res = await fetch(`/api/logs?limit=${targetLimit}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data || []);
      }
    } catch (e) {
      console.error('Error fetching logs:', e);
    }
  };

  const fetchTenants = async () => {
    try {
      const res = await fetch('/api/admin/tenants', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTenants(data);
      }
    } catch (e) {
      console.error('Error fetching tenants:', e);
    }
  };

  const fetchAppointments = async () => {
    setFetchingAppointments(true);
    try {
      const res = await fetch('/api/appointments', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAppointments(data);
      }
    } catch (e) {
      console.error('Error fetching appointments:', e);
    } finally {
      setFetchingAppointments(false);
    }
  };

  const handleCancelAppointment = async (id: number) => {
    if (!window.confirm('¿Estás seguro de que deseas cancelar esta cita?')) return;
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error cancelando cita');
      showToast('Cita cancelada con éxito!');
      fetchAppointments();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateManualBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingManual(true);
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customer_name: manualCustomerName,
          customer_phone: manualCustomerPhone,
          appointment_date: selectedDate,
          appointment_time: manualBookingTime,
          service: manualService
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error creando reserva');
      showToast('Cita agendada con éxito!');
      setShowManualBookingModal(false);
      setManualCustomerName('');
      setManualCustomerPhone('');
      setManualService('Servicio Técnico');
      fetchAppointments();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setBookingManual(false);
    }
  };

  const fetchLostSales = async () => {
    try {
      setFetchingLostSales(true);
      const res = await fetch('/api/analytics/lost-sales', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLostSales(data);
      }
    } catch (e) {
      console.error('Error fetching lost sales:', e);
    } finally {
      setFetchingLostSales(false);
    }
  };

  const handleDeleteLostSale = async (id: number) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este registro de venta perdida?')) return;
    try {
      const res = await fetch(`/api/analytics/lost-sales/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error eliminando venta perdida');
      showToast('Registro eliminado con éxito');
      fetchLostSales();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/logs/conversations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (e) {
      console.error('Error fetching conversations:', e);
    }
  };

  const fetchConversationLogs = async (id: string) => {
    try {
      setSelectedConversationId(id);
      const res = await fetch(`/api/logs/conversation/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedConversationLogs(data);
      }
    } catch (e) {
      console.error('Error fetching conversation logs:', e);
    }
  };

  const fetchAnalytics = async () => {
    try {
      await fetch('/api/analytics/products', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {
      console.error('Error fetching analytics:', e);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingTenant(true);
    try {
      const res = await fetch('/api/auth/register-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tenant_id: newTenantId,
          tenant_name: newTenantName,
          email: newTenantEmail,
          password: newTenantPassword,
          role: newTenantRole
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error registrando tenant');
      
      showToast('Empresa y administrador registrados con éxito!');
      setNewTenantId('');
      setNewTenantName('');
      setNewTenantEmail('');
      setNewTenantPassword('');
      setNewTenantRole('admin');
      fetchTenants();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setCreatingTenant(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const endpoint = role === 'superadmin' ? '/api/admin/users-tokens' : '/api/users';
      const res = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch (e) {
      console.error('Error fetching users:', e);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tenant_id: role === 'superadmin' ? newUserTenantId : tenantId,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error registrando usuario');

      showToast('Usuario registrado con éxito!');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('admin');
      if (role === 'superadmin') setNewUserTenantId('');
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este usuario?')) return;
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error eliminando usuario');

      showToast('Usuario de baja con éxito!');
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: name === 'chatwoot_account_id' || name === 'redis_port' ? parseInt(value) || 0 : value
    }));
  };

  const handleKbChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setKb(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleKbToggleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setKb(prev => ({
      ...prev,
      [name]: checked ? 1 : 0
    }));
  };


  const handleProviderSelect = (provider: 'gemini' | 'deepseek') => {
    setConfig(prev => ({
      ...prev,
      active_provider: provider
    }));
  };

  const saveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });
      
      if (!res.ok) throw new Error('Error guardando configuración');
      const data = await res.json();
      setConfig(data);
      showToast('Configuración guardada correctamente');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveKnowledgeBase = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(kb)
      });
      if (!res.ok) throw new Error('Error guardando base de conocimiento');
      const data = await res.json();
      setKb(data);
      showToast('Base de conocimiento actualizada');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const isChatwootConfigured = !!(config.chatwoot_url && config.chatwoot_access_token);
  const isAIConfigured = config.active_provider === 'gemini' ? !!config.gemini_api_key : !!config.deepseek_api_key;

  // Render Login page if not authenticated
  if (!token) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'var(--gradient-hero)',
        padding: '1.5rem',
        boxSizing: 'border-box'
      }}>
        {toast && (
          <div className={`toast ${toast.type === 'error' ? 'error' : ''}`}>
            <div className="status-dot active" style={{ backgroundColor: toast.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)' }} />
            <span>{toast.text}</span>
          </div>
        )}
        
        <div className="glass-card" style={{ width: '100%', maxWidth: '420px', animation: 'fadeIn 0.5s ease-out' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ 
              fontFamily: "'Outfit', sans-serif", 
              fontSize: '2.2rem', 
              margin: '0 0 0.5rem 0',
              background: 'var(--gradient-primary)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 700
            }}>
              AI Platform
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
              Administrador Inteligente de Agentes Multitenant
            </p>
          </div>

          {loginError && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--color-danger)',
              borderRadius: '8px',
              padding: '0.85rem',
              color: '#f87171',
              fontSize: '0.85rem',
              marginBottom: '1.5rem',
              lineHeight: 1.4
            }}>
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="email">Correo Electrónico</label>
              <input
                type="email"
                id="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="ejemplo@empresa.com"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ width: '100%', paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.5rem',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    padding: '0.2rem',
                    color: 'var(--text-muted)'
                  }}
                  title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loggingIn} style={{ marginTop: '0.5rem' }}>
              {loggingIn ? 'Validando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div style={{ 
            marginTop: '1.5rem', 
            paddingTop: '1.25rem', 
            borderTop: '1px solid var(--border-color)', 
            textAlign: 'center',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            lineHeight: 1.4
          }}>
            🔑 El registro de empresas es privado. Solicita tu acceso con el administrador global del servicio.
          </div>
        </div>
      </div>
    );
  }

  // Render Loader if loading configurations
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p style={{ fontSize: '1.2rem', color: '#93c5fd' }}>Cargando datos de la empresa...</p>
      </div>
    );
  }

  // Render Dashboard
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
      {/* Toast Notification */}
      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'error' : ''}`}>
          <div className="status-dot active" style={{ backgroundColor: toast.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)' }} />
          <span>{toast.text}</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside style={{
        width: '280px',
        backgroundColor: '#07162c',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.25rem 1rem',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        position: 'fixed',
        height: '100vh',
        left: 0,
        top: 0,
        zIndex: 100,
        boxShadow: '6px 0 30px rgba(0,0,0,0.3)',
        boxSizing: 'border-box'
      }}>
        {/* Sidebar Header & Branding */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '0.4rem', 
          marginBottom: '1.25rem', 
          paddingBottom: '0.85rem', 
          borderBottom: '1px solid rgba(255,255,255,0.08)' 
        }}>
          {tenantId === 'sicsa' ? (
            <div style={{ padding: '0.2rem 0', display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
              <img 
                src="https://sicsa.com.ni/wp-content/uploads/2023/06/logo-sisca-azul-medium.png" 
                alt="SICSA Nicaragua Logo" 
                style={{ 
                  height: '34px', 
                  maxWidth: '100%', 
                  objectFit: 'contain',
                  filter: 'brightness(0) invert(1)'
                }} 
              />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" fill="none">
                <rect x="3" y="8" width="18" height="12" rx="3" fill="#38bdf8"/>
                <path d="M12 2v6M9 2h6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="8" cy="14" r="2" fill="#ffffff"/>
                <circle cx="16" cy="14" r="2" fill="#ffffff"/>
              </svg>
              <div>
                <h1 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#f8fafc', letterSpacing: '-0.02em' }}>Plataforma IA</h1>
                <span style={{ fontSize: '0.68rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>Control Center</span>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.1rem' }}>
            <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              PRODUCCIÓN ({tenantId?.toUpperCase()})
            </span>
            <span style={{ 
              fontSize: '0.62rem', 
              padding: '0.1rem 0.4rem', 
              backgroundColor: 'rgba(56, 189, 248, 0.15)', 
              color: '#38bdf8', 
              borderRadius: '10px',
              fontWeight: 800,
              border: '1px solid rgba(56, 189, 248, 0.3)'
            }}>
              v2.5
            </span>
          </div>
        </div>

        {/* User Profile Card & Agent Status */}
        <div style={{ 
          padding: '0.85rem', 
          backgroundColor: 'rgba(255,255,255,0.03)', 
          borderRadius: '12px', 
          marginBottom: '1.25rem',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05)'
        }}>
          {/* User Info Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
              <div style={{ 
                width: '30px', 
                height: '30px', 
                borderRadius: '50%', 
                backgroundColor: role === 'superadmin' ? '#ef4444' : role === 'admin' ? '#2563eb' : '#10b981',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.8rem',
                flexShrink: 0
              }}>
                {userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '0.76rem', color: '#f8fafc', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {userEmail || 'Asesor'}
                </div>
                <div style={{ fontSize: '0.65rem', color: role === 'superadmin' ? '#f87171' : role === 'admin' ? '#60a5fa' : '#34d399', fontWeight: 700 }}>
                  {role === 'superadmin' ? '👑 Super Admin' : role === 'admin' ? '💼 Admin Tenant' : '🎧 Asesor de Ventas'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowChangePassModal(true)}
              title="Cambiar tu contraseña"
              style={{
                padding: '0.25rem 0.45rem',
                borderRadius: '6px',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                color: '#38bdf8',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>key</span>
              Pass
            </button>
          </div>

          {/* Super Admin Tenant Switcher Dropdown */}
          {role === 'superadmin' && (
            <div style={{ marginBottom: '0.65rem' }}>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                Cambiar Tenant (Global):
              </div>
              <select
                value={tenantId || ''}
                onChange={(e) => {
                  const newT = e.target.value;
                  if (newT) {
                    setTenantId(newT);
                    localStorage.setItem('tenant_id', newT);
                    showToast(`¡Cambiado al inquilino ${newT.toUpperCase()}!`);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.5rem',
                  borderRadius: '6px',
                  backgroundColor: '#0c2240',
                  border: '1px solid #3b82f6',
                  color: '#60a5fa',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                {tenants.length > 0 ? (
                  tenants.map(t => (
                    <option key={t.tenant_id} value={t.tenant_id}>
                      🏢 {t.tenant_name || t.tenant_id.toUpperCase()} ({t.tenant_id})
                    </option>
                  ))
                ) : (
                  <option value={tenantId || 'sicsa'}>🏢 {tenantId?.toUpperCase()}</option>
                )}
              </select>
            </div>
          )}

          {/* Agent Availability Status Select */}
          <div style={{ marginTop: '0.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Estado de Disponibilidad</span>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: agentStatus === 'online' ? '#10b981' : agentStatus === 'busy' ? '#ef4444' : agentStatus === 'idle' ? '#94a3b8' : '#f59e0b',
                boxShadow: agentStatus === 'online' ? '0 0 8px #10b981' : 'none'
              }} />
            </div>

            <select
              value={agentStatus}
              onChange={async (e) => {
                const newStatus = e.target.value;
                setAgentStatus(newStatus);
                isAutoIdledRef.current = false;
                try {
                  await fetch('/api/agent-status', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ status: newStatus })
                  });
                } catch (err) {
                  console.error('Error updating status:', err);
                }
              }}
              style={{
                width: '100%',
                padding: '0.4rem 0.5rem',
                borderRadius: '6px',
                backgroundColor: '#0c2240',
                border: '1px solid rgba(255,255,255,0.12)',
                color: agentStatus === 'online' ? '#34d399' : agentStatus === 'busy' ? '#f87171' : agentStatus === 'idle' ? '#cbd5e1' : '#fbbf24',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                marginBottom: '0.4rem'
              }}
            >
              <option value="online">🟢 Disponible (En línea)</option>
              <option value="busy">🔴 Ocupado / En Llamada</option>
              <option value="lunch">🍱 En Almuerzo</option>
              <option value="training">🎓 En Capacitación</option>
              <option value="break">☕ En Pausa Corta</option>
              <option value="idle">🌙 Ausente (Auto-Idle)</option>
            </select>
          </div>

          {/* Auto-Idle Timeout Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600 }}>Inactividad Auto:</span>
            <select
              value={autoIdleMinutes}
              onChange={(e) => setAutoIdleMinutes(parseInt(e.target.value))}
              style={{
                padding: '0.2rem 0.4rem',
                borderRadius: '4px',
                backgroundColor: '#0c2240',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#38bdf8',
                fontSize: '0.68rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <option value={5}>5 min</option>
              <option value={10}>10 min (Ideal)</option>
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={0}>Off</option>
            </select>
          </div>
        </div>

        {/* Sidebar Nav Links */}
        <nav style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '0.2rem', 
          flex: 1, 
          overflowY: 'auto', 
          paddingRight: '0.2rem' 
        }}>
          
          {/* GROUP 1: OPERACIONES Y VENTAS */}
          <div
            onClick={() => toggleGroup('operations')}
            style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              color: '#38bdf8',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              padding: '0.5rem 0.6rem 0.25rem 0.6rem',
              marginTop: '0.1rem',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              userSelect: 'none'
            }}
          >
            <span>Operaciones & Ventas</span>
            <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: '#38bdf8' }}>
              {collapsedGroups.operations ? 'chevron_right' : 'expand_more'}
            </span>
          </div>

          {!collapsedGroups.operations && (
            <>
              <button
                onClick={() => setActiveTab('home')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: activeTab === 'home' ? 'rgba(56, 189, 248, 0.16)' : 'transparent',
                  border: 'none',
                  borderLeft: activeTab === 'home' ? '3px solid #38bdf8' : '3px solid transparent',
                  color: activeTab === 'home' ? '#38bdf8' : '#94a3b8',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0 8px 8px 0',
                  fontSize: '0.82rem',
                  fontWeight: activeTab === 'home' ? 800 : 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>home</span>
                Inicio / Home del Asesor
              </button>

              <button
                onClick={() => setActiveTab('inbox')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: activeTab === 'inbox' ? 'rgba(16, 185, 129, 0.16)' : 'transparent',
                  border: 'none',
                  borderLeft: activeTab === 'inbox' ? '3px solid #10b981' : '3px solid transparent',
                  color: activeTab === 'inbox' ? '#34d399' : '#94a3b8',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0 8px 8px 0',
                  fontSize: '0.82rem',
                  fontWeight: activeTab === 'inbox' ? 800 : 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>forum</span>
                Bandeja En Vivo (Chats)
              </button>

              <button
                onClick={() => setActiveTab('kanban')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: activeTab === 'kanban' ? 'rgba(245, 158, 11, 0.16)' : 'transparent',
                  border: 'none',
                  borderLeft: activeTab === 'kanban' ? '3px solid #f59e0b' : '3px solid transparent',
                  color: activeTab === 'kanban' ? '#fbbf24' : '#94a3b8',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0 8px 8px 0',
                  fontSize: '0.82rem',
                  fontWeight: activeTab === 'kanban' ? 800 : 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>view_kanban</span>
                Pipeline CRM (Kanban)
              </button>

              <button
                onClick={() => setActiveTab('contacts')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: activeTab === 'contacts' ? 'rgba(56, 189, 248, 0.16)' : 'transparent',
                  border: 'none',
                  borderLeft: activeTab === 'contacts' ? '3px solid #38bdf8' : '3px solid transparent',
                  color: activeTab === 'contacts' ? '#38bdf8' : '#94a3b8',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0 8px 8px 0',
                  fontSize: '0.82rem',
                  fontWeight: activeTab === 'contacts' ? 800 : 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>group</span>
                Directorio de Leads
              </button>

              <button
                onClick={() => {
                  setActiveTab('appointments');
                  fetchAppointments();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: activeTab === 'appointments' ? 'rgba(56, 189, 248, 0.16)' : 'transparent',
                  border: 'none',
                  borderLeft: activeTab === 'appointments' ? '3px solid #38bdf8' : '3px solid transparent',
                  color: activeTab === 'appointments' ? '#38bdf8' : '#94a3b8',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0 8px 8px 0',
                  fontSize: '0.82rem',
                  fontWeight: activeTab === 'appointments' ? 800 : 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>calendar_month</span>
                Agenda de Citas
              </button>
            </>
          )}

          {/* GROUP 2: IA Y CONFIGURACIÓN */}
          <div
            onClick={() => toggleGroup('ai')}
            style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              color: '#c084fc',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              padding: '0.65rem 0.6rem 0.25rem 0.6rem',
              marginTop: '0.2rem',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              userSelect: 'none'
            }}
          >
            <span>Agente IA</span>
            <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: '#c084fc' }}>
              {collapsedGroups.ai ? 'chevron_right' : 'expand_more'}
            </span>
          </div>

          {!collapsedGroups.ai && (
            <>
              <button
                onClick={() => setActiveTab('settings')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: activeTab === 'settings' ? 'rgba(168, 85, 247, 0.16)' : 'transparent',
                  border: 'none',
                  borderLeft: activeTab === 'settings' ? '3px solid #a855f7' : '3px solid transparent',
                  color: activeTab === 'settings' ? '#c084fc' : '#94a3b8',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0 8px 8px 0',
                  fontSize: '0.82rem',
                  fontWeight: activeTab === 'settings' ? 800 : 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>smart_toy</span>
                Ajustes del Agente
              </button>

              <button
                onClick={() => setActiveTab('knowledge')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: activeTab === 'knowledge' ? 'rgba(168, 85, 247, 0.16)' : 'transparent',
                  border: 'none',
                  borderLeft: activeTab === 'knowledge' ? '3px solid #a855f7' : '3px solid transparent',
                  color: activeTab === 'knowledge' ? '#c084fc' : '#94a3b8',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0 8px 8px 0',
                  fontSize: '0.82rem',
                  fontWeight: activeTab === 'knowledge' ? 800 : 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>psychology</span>
                Base de Conocimiento
              </button>

              <button
                onClick={() => {
                  setActiveTab('products');
                  fetchProducts();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: activeTab === 'products' ? 'rgba(16, 185, 129, 0.16)' : 'transparent',
                  border: 'none',
                  borderLeft: activeTab === 'products' ? '3px solid #10b981' : '3px solid transparent',
                  color: activeTab === 'products' ? '#34d399' : '#94a3b8',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0 8px 8px 0',
                  fontSize: '0.82rem',
                  fontWeight: activeTab === 'products' ? 800 : 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>inventory_2</span>
                Catálogo de Productos
              </button>
            </>
          )}

          {/* GROUP 3: INTELIGENCIA Y REPORTES */}
          <div
            onClick={() => toggleGroup('analytics')}
            style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              color: '#f472b6',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              padding: '0.65rem 0.6rem 0.25rem 0.6rem',
              marginTop: '0.2rem',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              userSelect: 'none'
            }}
          >
            <span>Informes & Analítica</span>
            <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: '#f472b6' }}>
              {collapsedGroups.analytics ? 'chevron_right' : 'expand_more'}
            </span>
          </div>

          {!collapsedGroups.analytics && (
            <>
              <button
                onClick={() => {
                  setActiveTab('analytics');
                  fetchAnalytics();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: activeTab === 'analytics' ? 'rgba(236, 72, 153, 0.16)' : 'transparent',
                  border: 'none',
                  borderLeft: activeTab === 'analytics' ? '3px solid #ec4899' : '3px solid transparent',
                  color: activeTab === 'analytics' ? '#f472b6' : '#94a3b8',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0 8px 8px 0',
                  fontSize: '0.82rem',
                  fontWeight: activeTab === 'analytics' ? 800 : 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>analytics</span>
                Reportes e Informes BI
              </button>

              <button
                onClick={() => {
                  setActiveTab('lost-sales');
                  fetchLostSales();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: activeTab === 'lost-sales' ? 'rgba(239, 68, 68, 0.14)' : 'transparent',
                  border: 'none',
                  borderLeft: activeTab === 'lost-sales' ? '3px solid #ef4444' : '3px solid transparent',
                  color: activeTab === 'lost-sales' ? '#f87171' : '#94a3b8',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0 8px 8px 0',
                  fontSize: '0.82rem',
                  fontWeight: activeTab === 'lost-sales' ? 800 : 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>shopping_cart_checkout</span>
                Ventas Perdidas
              </button>

              <button
                onClick={() => {
                  setActiveTab('chats');
                  fetchConversations();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: activeTab === 'chats' ? 'rgba(245, 158, 11, 0.16)' : 'transparent',
                  border: 'none',
                  borderLeft: activeTab === 'chats' ? '3px solid #f59e0b' : '3px solid transparent',
                  color: activeTab === 'chats' ? '#fbbf24' : '#94a3b8',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0 8px 8px 0',
                  fontSize: '0.82rem',
                  fontWeight: activeTab === 'chats' ? 800 : 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>visibility</span>
                Auditoría de Chats
              </button>

              <button
                onClick={() => {
                  setActiveTab('activity');
                  fetchLogs();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: activeTab === 'activity' ? 'rgba(139, 92, 246, 0.16)' : 'transparent',
                  border: 'none',
                  borderLeft: activeTab === 'activity' ? '3px solid #8b5cf6' : '3px solid transparent',
                  color: activeTab === 'activity' ? '#a78bfa' : '#94a3b8',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0 8px 8px 0',
                  fontSize: '0.82rem',
                  fontWeight: activeTab === 'activity' ? 800 : 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>vital_signs</span>
                Bitácora en Vivo
              </button>
            </>
          )}

          {/* GROUP 4: CANALES Y ADMINISTRACIÓN */}
          <div
            onClick={() => toggleGroup('system')}
            style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              color: '#2dd4bf',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              padding: '0.65rem 0.6rem 0.25rem 0.6rem',
              marginTop: '0.2rem',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              userSelect: 'none'
            }}
          >
            <span>Canales & Sistema</span>
            <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: '#2dd4bf' }}>
              {collapsedGroups.system ? 'chevron_right' : 'expand_more'}
            </span>
          </div>

          {!collapsedGroups.system && (
            <>
              <button
                onClick={() => setActiveTab('control-plane')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: activeTab === 'control-plane' ? 'rgba(56, 189, 248, 0.16)' : 'transparent',
                  border: 'none',
                  borderLeft: activeTab === 'control-plane' ? '3px solid #38bdf8' : '3px solid transparent',
                  color: activeTab === 'control-plane' ? '#38bdf8' : '#94a3b8',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0 8px 8px 0',
                  fontSize: '0.82rem',
                  fontWeight: activeTab === 'control-plane' ? 800 : 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>lan</span>
                Control Plane (Meta)
              </button>

              <button
                onClick={() => setActiveTab('webhook')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: activeTab === 'webhook' ? 'rgba(20, 184, 166, 0.16)' : 'transparent',
                  border: 'none',
                  borderLeft: activeTab === 'webhook' ? '3px solid #14b8a6' : '3px solid transparent',
                  color: activeTab === 'webhook' ? '#2dd4bf' : '#94a3b8',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0 8px 8px 0',
                  fontSize: '0.82rem',
                  fontWeight: activeTab === 'webhook' ? 800 : 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>webhook</span>
                Conectar Webhook
              </button>

              <button
                onClick={() => setActiveTab('teams')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: activeTab === 'teams' ? 'rgba(56, 189, 248, 0.16)' : 'transparent',
                  border: 'none',
                  borderLeft: activeTab === 'teams' ? '3px solid #38bdf8' : '3px solid transparent',
                  color: activeTab === 'teams' ? '#38bdf8' : '#94a3b8',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0 8px 8px 0',
                  fontSize: '0.82rem',
                  fontWeight: activeTab === 'teams' ? 800 : 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>groups</span>
                Gestión de Equipos (Teams)
              </button>

              <button
                onClick={() => {
                  setActiveTab('users');
                  fetchUsers();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: activeTab === 'users' ? 'rgba(56, 189, 248, 0.16)' : 'transparent',
                  border: 'none',
                  borderLeft: activeTab === 'users' ? '3px solid #38bdf8' : '3px solid transparent',
                  color: activeTab === 'users' ? '#38bdf8' : '#94a3b8',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0 8px 8px 0',
                  fontSize: '0.82rem',
                  fontWeight: activeTab === 'users' ? 800 : 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>manage_accounts</span>
                Usuarios y Tokens
              </button>

              <button
                onClick={() => setActiveTab('api-docs')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: activeTab === 'api-docs' ? 'rgba(16, 185, 129, 0.16)' : 'transparent',
                  border: 'none',
                  borderLeft: activeTab === 'api-docs' ? '3px solid #10b981' : '3px solid transparent',
                  color: activeTab === 'api-docs' ? '#34d399' : '#94a3b8',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0 8px 8px 0',
                  fontSize: '0.82rem',
                  fontWeight: activeTab === 'api-docs' ? 800 : 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>description</span>
                Portal de API & Docs
              </button>

              {role === 'superadmin' && (
                <button
                  onClick={() => {
                    setActiveTab('admin');
                    fetchTenants();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    background: activeTab === 'admin' ? 'rgba(239, 68, 68, 0.16)' : 'transparent',
                    border: 'none',
                    borderLeft: activeTab === 'admin' ? '3px solid #ef4444' : '3px solid transparent',
                    color: activeTab === 'admin' ? '#f87171' : '#94a3b8',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '0 8px 8px 0',
                    fontSize: '0.82rem',
                    fontWeight: activeTab === 'admin' ? 800 : 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                    marginTop: '0.1rem'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>admin_panel_settings</span>
                  Super Admin Global
                </button>
              )}
            </>
          )}
        </nav>

        {/* Sidebar Footer Logout Button */}
        <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '0.6rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#f87171',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>logout</span>
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div style={{ marginLeft: '280px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', boxSizing: 'border-box' }}>
        {/* Top Header bar (Ultra-compact & Space-efficient) */}
        <header style={{
          background: '#ffffff',
          borderBottom: '1px solid var(--border-color)',
          padding: '0.65rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          boxSizing: 'border-box',
          boxShadow: '0 1px 4px rgba(11, 43, 76, 0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {activeTab === 'inbox' && 'Bandeja En Vivo (Chats)'}
              {activeTab === 'kanban' && 'Pipeline CRM (Kanban)'}
              {activeTab === 'contacts' && 'Directorio de Leads'}
              {activeTab === 'settings' && 'Ajustes del Agente IA'}
              {activeTab === 'knowledge' && 'Base de Conocimiento'}
              {activeTab === 'products' && 'Catálogo de Productos'}
              {activeTab === 'chats' && 'Auditoría de Historial de Chats'}
              {activeTab === 'analytics' && 'Reportes & Analítica BI'}
              {activeTab === 'lost-sales' && 'Ventas Perdidas'}
              {activeTab === 'activity' && 'Bitácora en Vivo'}
              {activeTab === 'webhook' && 'Conectar Webhook'}
              {activeTab === 'control-plane' && 'Control Plane (Meta)'}
              {activeTab === 'users' && 'Usuarios y Tokens'}
              {activeTab === 'api-docs' && 'Portal de API & Docs'}
              {activeTab === 'appointments' && 'Agenda de Citas'}
              {activeTab === 'admin' && 'Panel de Super Administración'}
            </h2>
          </div>

          {/* Status Badges in Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div className="status-badge" style={{ padding: '0.2rem 0.6rem', fontSize: '0.72rem' }}>
              <div className={`status-dot ${isChatwootConfigured ? 'active' : 'inactive'}`} />
              <span>Conexión CRM</span>
            </div>
            <div className="status-badge" style={{ padding: '0.2rem 0.6rem', fontSize: '0.72rem' }}>
              <div className={`status-dot ${isAIConfigured ? 'active' : 'inactive'}`} />
              <span>AI: {isAIConfigured ? 'Motor IA Activo' : 'Sin Configurar'}</span>
            </div>
            <div className="status-badge" style={{ padding: '0.2rem 0.6rem', fontSize: '0.72rem' }}>
              <div className="status-dot active" />
              <span>Catálogo ({products.length})</span>
            </div>
          </div>
        </header>

        {/* Dashboard Main Content grid */}
        <main style={{ padding: '0.85rem 1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="dashboard-grid">
            <section>
          {activeTab === 'home' && (
            <AdvisorHomeTab
              tenantId={tenantId || 'sicsa'}
              token={token}
              role={role}
              onOpenChat={() => setActiveTab('inbox')}
              onOpenKanban={() => setActiveTab('kanban')}
            />
          )}

          {activeTab === 'settings' && (
            <form onSubmit={saveConfig} className="glass-card" style={{ animation: 'fadeIn 0.2s ease-out' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h2 className="card-title" style={{ margin: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                    Configuración del Agente IA ({tenantId?.toUpperCase()})
                  </h2>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                    Ajuste de llaves de API, prompt de identidad, horario comercial 24/7 y reglas de escalamiento.
                  </p>
                </div>

                {(role === 'admin' || role === 'superadmin') && (
                  <button
                    type="button"
                    onClick={() => setShowOnboarding(true)}
                    style={{
                      padding: '0.55rem 1.1rem',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>rocket_launch</span>
                    🚀 Lanzar Asistente de Onboarding
                  </button>
                )}
              </div>

              {/* Provider Switch */}
              <div className="form-group">
                <label>Proveedor de IA Activo</label>
                <div className="provider-toggle">
                  <button
                    type="button"
                    className={`provider-btn ${config.active_provider === 'gemini' ? 'active' : ''}`}
                    onClick={() => handleProviderSelect('gemini')}
                  >
                    🚀 Motor IA Principal (Standard)
                  </button>
                  <button
                    type="button"
                    className={`provider-btn ${config.active_provider === 'deepseek' ? 'active' : ''}`}
                    onClick={() => handleProviderSelect('deepseek')}
                  >
                    🧠 Motor IA Avanzado (High Performance)
                  </button>
                </div>
              </div>

              {/* AI API Keys */}
              {config.active_provider === 'gemini' ? (
                <div className="form-group">
                  <label htmlFor="gemini_api_key">Clave de API Motor IA Principal</label>
                  <input
                    type="password"
                    id="gemini_api_key"
                    name="gemini_api_key"
                    value={config.gemini_api_key}
                    onChange={handleInputChange}
                    placeholder={config.gemini_api_key ? '***' : 'Ingresa tu API Key del Motor Principal'}
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label htmlFor="deepseek_api_key">Clave de API Motor IA Avanzado</label>
                  <input
                    type="password"
                    id="deepseek_api_key"
                    name="deepseek_api_key"
                    value={config.deepseek_api_key}
                    onChange={handleInputChange}
                    placeholder={config.deepseek_api_key ? '***' : 'Ingresa tu API Key del Motor Avanzado'}
                  />
                </div>
              )}

              {/* System Prompt */}
              <div className="form-group">
                <label htmlFor="system_prompt">Instrucciones / Personalidad de la Asistente (System Prompt)</label>
                <textarea
                  id="system_prompt"
                  name="system_prompt"
                  value={config.system_prompt}
                  onChange={handleInputChange}
                  rows={15}
                  placeholder="Instrucciones detalladas de interacción, respuestas del catálogo y reglas..."
                />
              </div>

              {/* Comportamiento de la IA por Horario de Atención */}
              <div style={{ backgroundColor: '#eff6ff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #bfdbfe', margin: '1.5rem 0 1.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, color: '#1e40af', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span className="material-symbols-outlined" style={{ color: '#2563eb', fontSize: '1.3rem' }}>schedule</span>
                    Horario de Atención y Comportamiento de la IA (24/7)
                  </h4>
                  <button
                    type="button"
                    onClick={() => setActiveTab('knowledge')}
                    style={{
                      padding: '0.4rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid #2563eb',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>edit_calendar</span>
                    Configurar Horario en Base de Conocimiento
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
                  <div style={{ backgroundColor: '#ffffff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #dbeafe' }}>
                    <div style={{ fontWeight: 800, color: '#1e3a8a', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.3rem' }}>
                      ☀️ DENTRO del Horario de Atención
                    </div>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569', lineHeight: 1.4 }}>
                      La IA atiende dudas de catálogo, precios y servicios. Si el cliente requiere hablar con un humano o califica para escalamiento, la IA <strong>transfiere la conversación inmediatamente en caliente</strong> al vendedor o equipo asignado en Chatwoot.
                    </p>
                  </div>

                  <div style={{ backgroundColor: '#ffffff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #dbeafe' }}>
                    <div style={{ fontWeight: 800, color: '#1e3a8a', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.3rem' }}>
                      🌙 FUERA del Horario de Atención
                    </div>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569', lineHeight: 1.4 }}>
                      La IA <strong>continúa respondiendo 24/7</strong> a todas las consultas de productos. Si el cliente solicita un humano, le explica amablemente el horario comercial, promete respuesta al abrir y <strong>registra la oportunidad en el CRM</strong> sin forzar transferencia en caliente.
                    </p>
                  </div>
                </div>
              </div>

              {/* Rules for human escalation */}
              <div style={{ borderTop: '1px solid var(--border-color)', margin: '1.5rem 0', paddingTop: '1.5rem' }}>
                <h3 className="card-title" style={{ fontSize: '1.15rem', marginBottom: '1rem', color: 'var(--color-warning)' }}>🚨 Reglas de Escalamiento a Asesor Humano</h3>
                
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <input
                    type="checkbox"
                    id="allow_ai_escalation"
                    name="allow_ai_escalation"
                    checked={config.allow_ai_escalation !== false}
                    onChange={(e) => setConfig({ ...config, allow_ai_escalation: e.target.checked })}
                    style={{ width: 'auto', margin: 0, cursor: 'pointer' }}
                  />
                  <label htmlFor="allow_ai_escalation" style={{ margin: 0, fontWeight: 'bold', cursor: 'pointer' }}>
                    Permitir que la IA decida cuándo escalar (Escalamiento Cognitivo)
                  </label>
                </div>

                <div className="form-group">
                  <label htmlFor="escalation_instructions">Instrucciones de Escalamiento para la IA</label>
                  <textarea
                    id="escalation_instructions"
                    name="escalation_instructions"
                    value={config.escalation_instructions || ''}
                    onChange={handleInputChange}
                    rows={4}
                    placeholder="Ej: Escala la conversación de inmediato si el cliente pregunta por créditos especiales, si está muy molesto, o si pide hablar con el gerente."
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="escalation_keywords">Palabras clave para escalar (separadas por comas)</label>
                    <input
                      type="text"
                      id="escalation_keywords"
                      name="escalation_keywords"
                      value={config.escalation_keywords || ''}
                      onChange={handleInputChange}
                      placeholder="humano, asesor, soporte, queja"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="max_fallback_attempts">Intentos fallidos máximos antes de escalar</label>
                    <input
                      type="number"
                      id="max_fallback_attempts"
                      name="max_fallback_attempts"
                      value={config.max_fallback_attempts || 3}
                      onChange={handleInputChange}
                      placeholder="3"
                    />
                  </div>
                </div>

                {/* Matriz de Asignación por Intención & Selección de Equipo Destino */}
                <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #cbd5e1', marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 2px 8px rgba(11,43,76,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: 0, color: '#0b2b4c', fontSize: '0.95rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span className="material-symbols-outlined" style={{ color: '#2563eb', fontSize: '1.2rem' }}>alt_route</span>
                        Matriz de Asignación y Auto-Escalamiento por Intención (Intent Rules Engine)
                      </h4>
                      <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                        La IA clasifica la intención del cliente (ej: Servicio Técnico, Compra de Servidores B2B, Retail) y auto-escala la conversación al equipo correspondiente.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('teams')}
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: '8px',
                        border: '1px solid #bfdbfe',
                        backgroundColor: '#eff6ff',
                        color: '#2563eb',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>tune</span>
                      Administrar Intenciones & Equipos
                    </button>
                  </div>

                  {/* Dynamic list of Intent -> Team Rules */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {teamsList.length === 0 ? (
                      <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic', padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                        Cargando intenciones y equipos configurados en el sistema...
                      </div>
                    ) : (
                      teamsList.map((team) => (
                        <div key={team.id} style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0b2b4c', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '1.05rem', color: '#2563eb' }}>groups</span>
                              {team.name}
                              <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem', borderRadius: '4px', backgroundColor: '#e2e8f0', color: '#334155', fontWeight: 700 }}>
                                Clave: {team.team_key}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.25rem' }}>
                              🎯 <strong>Palabras Clave de Intención:</strong> {team.ai_keywords || 'Sin palabras clave'}
                            </div>
                          </div>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#059669', backgroundColor: '#ecfdf5', padding: '0.25rem 0.55rem', borderRadius: '6px', border: '1px solid #a7f3d0', whiteSpace: 'nowrap' }}>
                            ⚡ Auto-Escala por IA
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Fallback Team Dropdown */}
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.8rem' }}>
                    <label htmlFor="escalation_team_id" style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0b2b4c', display: 'block', marginBottom: '0.3rem' }}>
                      Equipo Destino por Defecto / Fallback (Si no coincide ninguna intención explícita):
                    </label>
                    <select
                      id="escalation_team_id"
                      name="escalation_team_id"
                      value={config.escalation_team_id || ''}
                      onChange={(e) => setConfig({ ...config, escalation_team_id: e.target.value ? parseInt(e.target.value) : undefined })}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0b2b4c', fontSize: '0.85rem', fontWeight: 700 }}
                    >
                      <option value="">-- Seleccionar Equipo por Defecto --</option>
                      {teamsList.map(t => (
                        <option key={t.id} value={t.id}>{t.name} (Clave: {t.team_key})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Omnichannel Integration Settings */}
              <div style={{ borderTop: '1px solid var(--border-color)', margin: '1.5rem 0', paddingTop: '1.5rem' }}>
                <h3 className="card-title" style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>Conexión con Servidor Omnicanal</h3>
                
                <div className="form-group">
                  <label htmlFor="chatwoot_url">URL del Servidor Omnicanal</label>
                  <input
                    type="url"
                    id="chatwoot_url"
                    name="chatwoot_url"
                    value={config.chatwoot_url}
                    onChange={handleInputChange}
                    placeholder="https://mensajeria.tu-dominio.com"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="chatwoot_account_id">ID de Cuenta Omnicanal</label>
                    <input
                      type="number"
                      id="chatwoot_account_id"
                      name="chatwoot_account_id"
                      value={config.chatwoot_account_id}
                      onChange={handleInputChange}
                      placeholder="2"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="chatwoot_access_token">Token de Acceso de Integración</label>
                    <input
                      type="password"
                      id="chatwoot_access_token"
                      name="chatwoot_access_token"
                      value={config.chatwoot_access_token}
                      onChange={handleInputChange}
                      placeholder="Token de acceso API del Agente"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label htmlFor="chatwoot_website_token">Token de Canal Webchat de Pruebas</label>
                  <input
                    type="text"
                    id="chatwoot_website_token"
                    name="chatwoot_website_token"
                    value={config.chatwoot_website_token || ''}
                    onChange={handleInputChange}
                    placeholder="ej: h2ynGT9Wr5uVgaSCR3DxdUdV"
                  />
                </div>
              </div>

              {role !== 'readonly' ? (
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Guardando configuración...' : 'Guardar y Aplicar Cambios'}
                </button>
              ) : (
                <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '0.85rem', fontWeight: 'bold', display: 'inline-block' }}>
                  ⚠️ Rol de Sólo Lectura: No dispones de permisos para modificar la configuración.
                </div>
              )}
            </form>
          )}

          {activeTab === 'knowledge' && (
            <form onSubmit={saveKnowledgeBase} className="glass-card" style={{ animation: 'fadeIn 0.2s ease-out' }}>
              <h2 className="card-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-secondary)' }}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5V3a2.5 2.5 0 0 1 2.5-2.5H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5z"/></svg>
                Base de Conocimiento de {tenantId ? tenantId.toUpperCase() : ''}
              </h2>

              <div className="form-group">
                <label htmlFor="branches">Sucursales y Ubicaciones</label>
                <textarea
                  id="branches"
                  name="branches"
                  value={kb.branches}
                  onChange={handleKbChange}
                  rows={3}
                  placeholder="Direcciones y teléfonos de las oficinas/tiendas..."
                />
              </div>

              <div className="form-group">
                <label htmlFor="bank_accounts">Cuentas Bancarias y Métodos de Pago</label>
                <textarea
                  id="bank_accounts"
                  name="bank_accounts"
                  value={kb.bank_accounts}
                  onChange={handleKbChange}
                  rows={3}
                  placeholder="Detalles sobre bancos, tarjetas y transferencias..."
                />
              </div>

              <div className="form-group">
                <label htmlFor="faqs">Preguntas Frecuentes (FAQs)</label>
                <textarea
                  id="faqs"
                  name="faqs"
                  value={kb.faqs}
                  onChange={handleKbChange}
                  rows={8}
                  placeholder="Ingresa políticas de devolución, envío, garantías y preguntas comunes..."
                />
              </div>

              <div className="form-group">
                <label htmlFor="services">Servicios Ofrecidos (ej. mantenimiento, cableado, etc.)</label>
                <textarea
                  id="services"
                  name="services"
                  value={kb.services || ''}
                  onChange={handleKbChange}
                  rows={6}
                  placeholder="Describe los servicios que ofrece la empresa (ej. mantenimiento técnico, instalación de cableado estructurado, soporte post-venta, etc.). La IA explicará estos servicios al cliente sin dar un precio fijo."
                />
              </div>

              {/* Working Hours Settings */}
              <div style={{ borderTop: '1px solid var(--border-color)', margin: '1.5rem 0', paddingTop: '1.5rem' }}>
                <h3 className="card-title" style={{ fontSize: '1.15rem', marginBottom: '1.1rem' }}>⏰ Configuración de Horario Laboral</h3>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="timezone">Zona Horaria</label>
                    <select
                      id="timezone"
                      name="timezone"
                      value={kb.timezone}
                      onChange={handleKbChange}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        backgroundColor: '#071D34',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '0.9rem'
                      }}
                    >
                      <option value="America/Managua">Nicaragua (America/Managua)</option>
                      <option value="America/Bogota">Colombia/Ecuador (America/Bogota)</option>
                      <option value="America/Mexico_City">México (America/Mexico_City)</option>
                      <option value="America/New_York">Miami/NY (America/New_York)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div className="switch-group" style={{ border: 'none', padding: 0 }}>
                      <div className="switch-label">
                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Atención los Domingos</span>
                      </div>
                      <label className="switch-control">
                        <input
                          type="checkbox"
                          name="sun_enabled"
                          checked={kb.sun_enabled === 1}
                          onChange={handleKbToggleChange}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Lunes a Viernes - Apertura</label>
                    <input
                      type="text"
                      name="mon_fri_start"
                      value={kb.mon_fri_start}
                      onChange={handleKbChange}
                      placeholder="08:00"
                    />
                  </div>
                  <div className="form-group">
                    <label>Lunes a Viernes - Cierre</label>
                    <input
                      type="text"
                      name="mon_fri_end"
                      value={kb.mon_fri_end}
                      onChange={handleKbChange}
                      placeholder="17:30"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Sábados - Apertura</label>
                    <input
                      type="text"
                      name="sat_start"
                      value={kb.sat_start}
                      onChange={handleKbChange}
                      placeholder="09:00"
                    />
                  </div>
                  <div className="form-group">
                    <label>Sábados - Cierre</label>
                    <input
                      type="text"
                      name="sat_end"
                      value={kb.sat_end}
                      onChange={handleKbChange}
                      placeholder="12:30"
                    />
                  </div>
                </div>
              </div>

              {role !== 'readonly' ? (
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Guardando Base de Conocimiento...' : 'Guardar Base de Conocimiento'}
                </button>
              ) : (
                <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '0.85rem', fontWeight: 'bold', display: 'inline-block' }}>
                  ⚠️ Rol de Sólo Lectura: No dispones de permisos para modificar la base de conocimiento.
                </div>
              )}
            </form>
          )}

          {activeTab === 'products' && (
            <div className="glass-card" style={{ animation: 'fadeIn 0.2s ease-out' }}>
              <h2 className="card-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-success)' }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                Catálogo de Productos Sincronizados ({products.length})
              </h2>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.4 }}>
                A continuación se muestra la base de datos local de productos. Puedes sincronizar e integrar nuevos productos desde tu ERP enviando un JSON vía HTTP POST.
              </p>

              {/* API Integration Guide */}
              <details style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '0.75rem',
                marginBottom: '1.5rem',
                fontSize: '0.85rem'
              }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#2563eb' }}>
                  💻 Guía de integración de productos vía API
                </summary>
                <div style={{ marginTop: '0.75rem' }}>
                  <p style={{ margin: '0 0 0.5rem 0' }}>Realiza una petición POST a la siguiente URL:</p>
                  <code style={{ 
                    display: 'block', 
                    padding: '0.5rem', 
                    backgroundColor: 'var(--bg-card)', 
                    borderRadius: '6px', 
                    color: '#10b981',
                    marginBottom: '0.5rem',
                    fontFamily: 'monospace',
                    border: '1px solid var(--border-color)'
                  }}>
                    {window.location.origin}/api/products/sync
                  </code>
                  <p style={{ margin: '0 0 0.5rem 0' }}>Agrega la cabecera de autenticación:</p>
                  <code style={{ 
                    display: 'block', 
                    padding: '0.5rem', 
                    backgroundColor: 'var(--bg-card)', 
                    borderRadius: '6px', 
                    color: '#8b5cf6',
                    marginBottom: '0.5rem',
                    fontFamily: 'monospace',
                    border: '1px solid var(--border-color)'
                  }}>
                    Authorization: Bearer {token?.slice(0, 15)}...
                  </code>
                  <p style={{ margin: '0 0 0.5rem 0' }}>Cuerpo de la Petición (JSON Array):</p>
                  <pre style={{ 
                    padding: '0.75rem', 
                    backgroundColor: 'var(--bg-card)', 
                    borderRadius: '6px', 
                    color: 'var(--text-main)',
                    margin: 0,
                    overflowX: 'auto',
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    border: '1px solid var(--border-color)'
                  }}>
{`[
  {
    "id": "PROD-101",
    "name": "LAPTOP HP PROBOOK 450 G9",
    "price": 21990.00,
    "stock": 5,
    "description": "Intel Core i5, 8GB RAM, 512GB SSD, Windows 11",
    "url": "https://www.sicsa.com.ni/laptop-hp-probook-450-g9",
    "category": "Laptops",
    "brand": "HP"
  }
]`}
                  </pre>
                </div>
              </details>

              {/* Live search input */}
              <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="🔍 Buscar por nombre, ID/SKU, marca, categoría o descripción..."
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem 0.75rem 2.5rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '0.9rem'
                    }}
                  />
                  {productSearch && (
                    <button
                      onClick={() => {
                        setProductSearch('');
                        setCurrentPage(1);
                      }}
                      style={{
                        position: 'absolute',
                        right: '0.75rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '1rem'
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Table of Products */}
              {products.length === 0 ? (
                <div style={{
                  padding: '2.5rem',
                  border: '1px dashed var(--border-color)',
                  borderRadius: '12px',
                  textAlign: 'center',
                  color: 'var(--text-muted)'
                }}>
                  No hay productos cargados en este tenant. Utiliza el endpoint de arriba para sincronizarlos.
                </div>
              ) : (() => {
                const filteredProducts = products.filter(p => 
                  p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                  p.id.toLowerCase().includes(productSearch.toLowerCase()) ||
                  (p.description || '').toLowerCase().includes(productSearch.toLowerCase()) ||
                  (p.brand || '').toLowerCase().includes(productSearch.toLowerCase()) ||
                  (p.category || '').toLowerCase().includes(productSearch.toLowerCase())
                );

                const itemsPerPage = 15;
                const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
                const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                if (filteredProducts.length === 0) {
                  return (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No se encontraron productos coincidentes con "{productSearch}".
                    </div>
                  );
                }

                return (
                  <div>
                    <div style={{ overflowX: 'auto', maxHeight: '500px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'rgba(11, 43, 76, 0.03)', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '0.75rem' }}>ID/SKU</th>
                            <th style={{ padding: '0.75rem' }}>Nombre</th>
                            <th style={{ padding: '0.75rem' }}>Marca</th>
                            <th style={{ padding: '0.75rem' }}>Categoría</th>
                            <th style={{ padding: '0.75rem' }}>Precio</th>
                            <th style={{ padding: '0.75rem' }}>Stock</th>
                            <th style={{ padding: '0.75rem' }}>Enlace Directo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedProducts.map((p) => (
                            <tr key={p.id} style={{ borderBottom: '1px solid rgba(11, 43, 76, 0.02)' }}>
                              <td style={{ padding: '0.75rem', fontFamily: 'monospace', color: '#2563eb', fontWeight: 'bold' }}>{p.id}</td>
                              <td style={{ padding: '0.75rem', fontWeight: 600 }}>{p.name}</td>
                              <td style={{ padding: '0.75rem' }}>{p.brand || <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                              <td style={{ padding: '0.75rem' }}>{p.category || <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                              <td style={{ padding: '0.75rem', color: '#10b981', fontWeight: 'bold' }}>C$ {p.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td style={{ padding: '0.75rem' }}>{p.stock}</td>
                              <td style={{ padding: '0.75rem', wordBreak: 'break-all' }}>
                                {p.url ? (
                                  <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
                                    Ver ficha 🔗
                                  </a>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)' }}>Sin enlace</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '1.5rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid var(--border-color)',
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)'
                      }}>
                        <div>
                          Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredProducts.length)} de {filteredProducts.length} productos
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            style={{
                              padding: '0.5rem 1rem',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: currentPage === 1 ? 'transparent' : 'var(--bg-input)',
                              color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-main)',
                              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: 600
                            }}
                          >
                            ◀ Anterior
                          </button>
                          <span style={{ alignSelf: 'center', padding: '0 0.5rem', fontWeight: 600, color: 'var(--text-main)' }}>
                            Página {currentPage} de {totalPages}
                          </span>
                          <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            style={{
                              padding: '0.5rem 1rem',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: currentPage === totalPages ? 'transparent' : 'var(--bg-input)',
                              color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-main)',
                              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: 600
                            }}
                          >
                            Siguiente ▶
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="glass-card" style={{ animation: 'fadeIn 0.2s ease-out' }}>
              <h2 className="card-title">
                👥 Control de Usuarios y Tokens de Acceso
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.4 }}>
                {role === 'superadmin' 
                  ? 'Panel de control global. Puedes dar de alta usuarios, asignar roles y copiar sus tokens de autenticación firmados para el uso de la API.'
                  : role === 'admin'
                    ? 'Administración de usuarios de este tenant. Puedes dar de alta nuevos administradores y usuarios de sólo lectura.'
                    : 'Listado de usuarios asignados a tu empresa. No dispones de permisos de edición.'
                }
              </p>

              {role !== 'readonly' && (
                <form onSubmit={handleCreateUser} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '2rem', marginBottom: '2rem' }}>
                  <h3 className="card-title" style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>➕ Crear Nuevo Usuario</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                    {role === 'superadmin' && (
                      <div className="form-group">
                        <label htmlFor="new_user_tenant">Empresa (Tenant)</label>
                        <select
                          id="new_user_tenant"
                          value={newUserTenantId}
                          onChange={(e) => setNewUserTenantId(e.target.value)}
                          required
                          style={{ width: '100%' }}
                        >
                          <option value="">-- Selecciona Empresa --</option>
                          {Array.from(new Set(tenants.map(t => t.tenant_id))).map(tId => (
                            <option key={tId} value={tId}>{tId.toUpperCase()}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="form-group">
                      <label htmlFor="new_user_email">Correo Electrónico</label>
                      <input
                        type="email"
                        id="new_user_email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="ej: usuario@empresa.com"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="new_user_password">Contraseña</label>
                      <input
                        type="password"
                        id="new_user_password"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="new_user_role">Rol del Usuario</label>
                      <select
                        id="new_user_role"
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value as any)}
                        required
                        style={{ width: '100%' }}
                      >
                        <option value="admin">Administrador (Lectura/Escritura)</option>
                        <option value="readonly">Sólo Lectura</option>
                        {role === 'superadmin' && <option value="superadmin">Super Administrador</option>}
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="btn-primary" disabled={creatingUser}>
                    {creatingUser ? 'Creando...' : 'Crear Usuario'}
                  </button>
                </form>
              )}

              <h3 className="card-title" style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>📋 Usuarios Registrados ({usersList.length})</h3>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'rgba(11, 43, 76, 0.03)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '0.75rem' }}>Empresa</th>
                      <th style={{ padding: '0.75rem' }}>Correo Electrónico</th>
                      <th style={{ padding: '0.75rem' }}>Rol</th>
                      {role === 'superadmin' && <th style={{ padding: '0.75rem' }}>Token de Acceso API (30 días)</th>}
                      {role !== 'readonly' && <th style={{ padding: '0.75rem', textAlign: 'center' }}>Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map((u) => {
                      const isSelf = u.email === userEmail;
                      return (
                        <tr key={u.id} style={{ borderBottom: '1px solid rgba(11, 43, 76, 0.02)' }}>
                          <td style={{ padding: '0.75rem', fontWeight: 'bold', color: '#2563eb' }}>{u.tenant_id.toUpperCase()}</td>
                          <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                            {u.email} {isSelf && <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', backgroundColor: 'var(--color-primary)', color: 'white', borderRadius: '4px', marginLeft: '0.5rem' }}>Tú</span>}
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            <span style={{
                              fontSize: '0.75rem',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontWeight: 'bold',
                              backgroundColor: u.role === 'superadmin' ? 'rgba(239, 68, 68, 0.1)' : u.role === 'admin' ? 'rgba(37, 99, 235, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                              color: u.role === 'superadmin' ? '#ef4444' : u.role === 'admin' ? '#2563eb' : '#6b7280'
                            }}>
                              {u.role === 'superadmin' ? 'Super Admin' : u.role === 'admin' ? 'Admin' : 'Sólo Lectura'}
                            </span>
                          </td>
                          {role === 'superadmin' && (
                            <td style={{ padding: '0.75rem', maxWidth: '300px' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  readOnly
                                  value={u.token || ''}
                                  style={{
                                    fontSize: '0.75rem',
                                    fontFamily: 'monospace',
                                    padding: '0.25rem 0.5rem',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '4px',
                                    backgroundColor: 'var(--bg-input)',
                                    flex: 1
                                  }}
                                />
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(u.token || '');
                                    showToast('Token copiado al portapapeles');
                                  }}
                                  style={{
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.75rem',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '4px',
                                    backgroundColor: 'var(--color-primary)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  Copiar
                                </button>
                              </div>
                            </td>
                          )}
                          {role !== 'readonly' && (
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                disabled={isSelf}
                                style={{
                                  padding: '0.3rem 0.6rem',
                                  fontSize: '0.75rem',
                                  borderRadius: '4px',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: isSelf ? 'transparent' : 'rgba(239, 68, 68, 0.1)',
                                  color: isSelf ? 'var(--text-muted)' : '#ef4444',
                                  cursor: isSelf ? 'not-allowed' : 'pointer',
                                  fontWeight: 'bold'
                                }}
                              >
                                Dar de Baja 🗑️
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'appointments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.2s ease-out' }}>
              {/* Daily slots grid card */}
              <div className="glass-card">
                <h2 className="card-title" style={{ color: '#3b82f6', marginBottom: '0.5rem' }}>
                  📅 Visualización Diaria de Citas
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                  Selecciona un día para verificar la disponibilidad de horarios de atención (09:00 AM a 05:00 PM). Puedes agendar citas manuales o ver las registradas por la IA.
                </p>

                {/* Datepicker bar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  marginBottom: '2rem'
                }}>
                  <label htmlFor="selected_date" style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Ver Agenda del Día:</label>
                  <input
                    type="date"
                    id="selected_date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      backgroundColor: '#071D34',
                      border: '1px solid var(--border-color)',
                      color: '#0b2b4c',
                      fontSize: '0.9rem',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                {/* Slots Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1rem'
                }}>
                  {['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'].map((slot) => {
                    const appt = appointments.find(a => a.appointment_date === selectedDate && a.appointment_time === slot);
                    
                    return (
                      <div
                        key={slot}
                        style={{
                          padding: '1rem',
                          borderRadius: '12px',
                          border: appt ? '1px solid rgba(239, 68, 68, 0.3)' : '1px dashed rgba(16, 185, 129, 0.4)',
                          backgroundColor: appt ? 'rgba(239, 68, 68, 0.03)' : 'rgba(16, 185, 129, 0.02)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '1rem',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#0b2b4c' }}>{slot} hs</span>
                          <span style={{
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            backgroundColor: appt ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: appt ? '#ef4444' : '#10b981'
                          }}>
                            {appt ? 'Ocupado' : 'Disponible'}
                          </span>
                        </div>

                        {appt ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem' }}>
                            <div style={{ color: 'var(--text-muted)' }}>
                              Servicio: <strong style={{ color: '#fff' }}>{appt.service || 'Servicio Técnico'}</strong>
                            </div>
                            <div style={{ color: 'var(--text-muted)' }}>
                              Cliente: <strong style={{ color: '#fff' }}>{appt.customer_name}</strong>
                            </div>
                            <div style={{ color: 'var(--text-muted)' }}>
                              Teléfono: <span style={{ fontFamily: 'monospace' }}>{appt.customer_phone}</span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                            Espacio libre. Listo para reservar.
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                          {appt ? (
                            role !== 'readonly' && (
                              <button
                                onClick={() => handleCancelAppointment(appt.id)}
                                style={{
                                  padding: '0.3rem 0.6rem',
                                  fontSize: '0.75rem',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(239, 68, 68, 0.2)',
                                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  fontWeight: 'bold'
                                }}
                              >
                                Cancelar Cita 🗑️
                              </button>
                            )
                          ) : (
                            role !== 'readonly' && (
                              <button
                                onClick={() => {
                                  setManualBookingTime(slot);
                                  setShowManualBookingModal(true);
                                }}
                                style={{
                                  padding: '0.35rem 0.75rem',
                                  fontSize: '0.75rem',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(59, 130, 246, 0.2)',
                                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                  color: '#60a5fa',
                                  cursor: 'pointer',
                                  fontWeight: 'bold'
                                }}
                              >
                                Agendar Manual 📝
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* General appointments list */}
              <div className="glass-card">
                <h2 className="card-title">
                  📋 Resumen General de Citas ({appointments.length})
                </h2>
                
                {fetchingAppointments ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando citas...</div>
                ) : appointments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No hay citas reservadas en el sistema.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'rgba(11, 43, 76, 0.03)', borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ padding: '0.75rem' }}>Cliente</th>
                          <th style={{ padding: '0.75rem' }}>Teléfono</th>
                          <th style={{ padding: '0.75rem' }}>Servicio Solicitado</th>
                          <th style={{ padding: '0.75rem' }}>Fecha</th>
                          <th style={{ padding: '0.75rem' }}>Hora</th>
                          <th style={{ padding: '0.75rem' }}>Agendada el</th>
                          {role !== 'readonly' && <th style={{ padding: '0.75rem', textAlign: 'center' }}>Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {appointments.map((a) => (
                          <tr key={a.id} style={{ borderBottom: '1px solid rgba(11, 43, 76, 0.02)' }}>
                            <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{a.customer_name}</td>
                            <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>{a.customer_phone}</td>
                            <td style={{ padding: '0.75rem', fontWeight: 600, color: '#e0f2fe', backgroundColor: 'rgba(56, 189, 248, 0.05)', borderRadius: '4px' }}>
                              {a.service || 'Servicio Técnico'}
                            </td>
                            <td style={{ padding: '0.75rem', fontWeight: 600, color: '#3b82f6' }}>{a.appointment_date}</td>
                            <td style={{ padding: '0.75rem', fontWeight: 600, color: '#10b981' }}>{a.appointment_time} hs</td>
                            <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                              {new Date(a.created_at).toLocaleDateString()} {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            {role !== 'readonly' && (
                              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                <button
                                  onClick={() => handleCancelAppointment(a.id)}
                                  style={{
                                    padding: '0.3rem 0.6rem',
                                    fontSize: '0.75rem',
                                    borderRadius: '4px',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  Cancelar 🗑️
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Manual Booking Modal */}
              {showManualBookingModal && (
                <div style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  zIndex: 200,
                  padding: '1.5rem',
                  boxSizing: 'border-box'
                }}>
                  <div className="glass-card" style={{ width: '100%', maxWidth: '450px', animation: 'fadeIn 0.2s ease-out' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <h3 className="card-title" style={{ margin: 0, color: '#3b82f6' }}>📝 Agendar Cita Manual</h3>
                      <button
                        onClick={() => setShowManualBookingModal(false)}
                        style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.25rem', cursor: 'pointer' }}
                      >
                        ×
                      </button>
                    </div>

                    <form onSubmit={handleCreateManualBooking}>
                      <div className="form-group">
                        <label>Fecha y Hora</label>
                        <input
                          type="text"
                          readOnly
                          value={`${selectedDate} a las ${manualBookingTime} hs`}
                          style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="manual_service">Servicio</label>
                        <input
                          type="text"
                          id="manual_service"
                          value={manualService}
                          onChange={(e) => setManualService(e.target.value)}
                          placeholder="ej. Mantenimiento de laptop"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="manual_name">Nombre del Cliente</label>
                        <input
                          type="text"
                          id="manual_name"
                          value={manualCustomerName}
                          onChange={(e) => setManualCustomerName(e.target.value)}
                          placeholder="Nombre completo"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="manual_phone">Teléfono del Cliente</label>
                        <input
                          type="text"
                          id="manual_phone"
                          value={manualCustomerPhone}
                          onChange={(e) => setManualCustomerPhone(e.target.value)}
                          placeholder="ej. 8888-8888"
                          required
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setShowManualBookingModal(false)}
                          style={{ padding: '0.5rem 1rem' }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="btn-primary"
                          disabled={bookingManual}
                          style={{ padding: '0.5rem 1rem' }}
                        >
                          {bookingManual ? 'Guardando...' : 'Confirmar Reserva'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'lost-sales' && (
            <div className="glass-card" style={{ animation: 'fadeIn 0.2s ease-out' }}>
              <h2 className="card-title" style={{ color: '#ef4444' }}>
                📈 Reporte de Oportunidades & Ventas Perdidas
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.4 }}>
                A continuación se listan las búsquedas de productos agotados (stock = 0) consultados por los clientes en WhatsApp. Utiliza esta lista para contactar a los clientes interesados una vez que vuelva a ingresar mercadería en tu ERP.
              </p>

              {fetchingLostSales ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando oportunidades perdidas...</div>
              ) : lostSales.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '3rem', 
                  border: '1px dashed var(--border-color)', 
                  borderRadius: '8px', 
                  color: 'var(--text-muted)', 
                  fontSize: '0.9rem' 
                }}>
                  ¡Excelente! No hay oportunidades de venta perdida registradas actualmente en el sistema.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'rgba(11, 43, 76, 0.03)', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '0.75rem' }}>Producto Solicitado</th>
                        <th style={{ padding: '0.75rem' }}>SKU/ID</th>
                        <th style={{ padding: '0.75rem' }}>Teléfono Cliente</th>
                        <th style={{ padding: '0.75rem' }}>Fecha de Consulta</th>
                        <th style={{ padding: '0.75rem' }}>Conversación ID</th>
                        {role !== 'readonly' && <th style={{ padding: '0.75rem', textAlign: 'center' }}>Acciones</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {lostSales.map((ls) => (
                        <tr key={ls.id} style={{ borderBottom: '1px solid rgba(11, 43, 76, 0.02)' }}>
                          <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{ls.product_name}</td>
                          <td style={{ padding: '0.75rem', fontFamily: 'monospace', color: '#2563eb', fontWeight: 'bold' }}>{ls.product_id}</td>
                          <td style={{ padding: '0.75rem', fontWeight: 600, color: '#f59e0b' }}>
                            {ls.customer_phone || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No capturado</span>}
                          </td>
                          <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                            {new Date(ls.timestamp).toLocaleString()}
                          </td>
                          <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>{ls.conversation_id}</td>
                          {role !== 'readonly' && (
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                              <button
                                onClick={() => handleDeleteLostSale(ls.id)}
                                style={{
                                  padding: '0.3rem 0.6rem',
                                  fontSize: '0.75rem',
                                  borderRadius: '4px',
                                  border: '1px solid var(--border-color)',
                                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                  color: '#10b981',
                                  cursor: 'pointer',
                                  fontWeight: 'bold'
                                }}
                              >
                                Marcar Atendido ✓
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'api-docs' && (
            <div className="glass-card" style={{ animation: 'fadeIn 0.2s ease-out', maxWidth: '900px' }}>
              <h2 className="card-title" style={{ color: '#10b981' }}>
                💻 Portal de Integración de API & Documentación
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: 1.5 }}>
                Esta documentación describe los endpoints disponibles para sincronizar tu catálogo de productos desde tu ERP y registrar citas de manera externa en tu cuenta de inquilino.
              </p>

              {/* API Token Badge */}
              <div style={{
                backgroundColor: 'rgba(59, 130, 246, 0.05)',
                border: '1px solid rgba(59, 130, 246, 0.15)',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '2rem'
              }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#60a5fa', fontSize: '0.95rem' }}>🔑 Tu API Token JWT (Autorización Bearer):</h4>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <code style={{ 
                    flex: 1,
                    padding: '0.5rem 0.75rem', 
                    backgroundColor: '#071D34', 
                    borderRadius: '6px', 
                    fontSize: '0.8rem', 
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                    color: '#0b2b4c',
                    border: '1px solid var(--border-color)'
                  }}>
                    {token ? `${token.slice(0, 50)}...` : 'Token no disponible'}
                  </code>
                  <button
                    onClick={() => {
                      if (token) {
                        navigator.clipboard.writeText(token);
                        showToast('Token copiado al portapapeles');
                      }
                    }}
                    className="btn-primary"
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                  >
                    Copiar Token
                  </button>
                </div>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  ⚠️ Este token tiene una validez de 30 días. Recuerda mantenerlo en secreto para proteger tu catálogo.
                </p>
              </div>

              {/* Endpoints List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                
                {/* Endpoint 1 */}
                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <span style={{ 
                      padding: '0.25rem 0.75rem', 
                      backgroundColor: '#10b981', 
                      color: '#0b2b4c', 
                      borderRadius: '6px', 
                      fontWeight: 'bold', 
                      fontSize: '0.85rem' 
                    }}>
                      POST
                    </span>
                    <strong style={{ fontFamily: 'monospace', fontSize: '1.1rem', color: '#0b2b4c' }}>/api/products/sync</strong>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '1rem', lineHeight: 1.5 }}>
                    Sincroniza y actualiza los productos de tu ERP. Admite dos modos de ejecución a través del query parameter <code style={{ color: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.08)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>mode</code>:
                  </p>
                  <ul style={{ fontSize: '0.85rem', color: 'var(--text-muted)', paddingLeft: '1.25rem', marginBottom: '1rem', lineHeight: 1.5 }}>
                    <li><strong style={{ color: '#fff' }}>mode=full</strong> (por defecto): Reemplazo total. Borra todos los productos del catálogo de la empresa e inserta los enviados.</li>
                    <li><strong style={{ color: '#fff' }}>mode=incremental</strong>: Sincronización parcial optimizada. Realiza un <strong>UPSERT</strong> directo de los productos del lote (los actualiza si existen o los crea si no), sin tocar el resto de productos en la base de datos. ¡Ideal para ventas en tiempo real!</li>
                  </ul>

                  {/* Code snippet */}
                  <h5 style={{ margin: '1rem 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Ejemplo de petición cURL:</h5>
                  <pre style={{ 
                    padding: '1rem', 
                    backgroundColor: '#071D34', 
                    borderRadius: '8px', 
                    color: '#34d399', 
                    overflowX: 'auto', 
                    fontSize: '0.8rem', 
                    fontFamily: 'monospace',
                    border: '1px solid var(--border-color)',
                    lineHeight: 1.4
                  }}>
{`curl -X POST "${window.location.origin}/api/products/sync?mode=incremental" \\
  -H "Authorization: Bearer TU_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '[
    {
      "id": "SKU-9901",
      "name": "TECLADO MECANICO LOGITECH G413",
      "price": 1850.00,
      "stock": 12,
      "brand": "LOGITECH",
      "category": "Accesorios",
      "description": "Teclado retroiluminado rojo con interruptores Romer-G",
      "url": "https://sicsa.com.ni/teclado-logitech-g413"
    }
  ]'`}
                  </pre>
                </div>

                {/* Endpoint 2 */}
                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <span style={{ 
                      padding: '0.25rem 0.75rem', 
                      backgroundColor: '#3b82f6', 
                      color: '#0b2b4c', 
                      borderRadius: '6px', 
                      fontWeight: 'bold', 
                      fontSize: '0.85rem' 
                    }}>
                      GET
                    </span>
                    <strong style={{ fontFamily: 'monospace', fontSize: '1.1rem', color: '#0b2b4c' }}>/api/products</strong>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '1rem', lineHeight: 1.5 }}>
                    Obtiene el catálogo completo de productos sincronizados de tu empresa (retorna hasta un límite de 10,000 registros).
                  </p>
                  
                  <h5 style={{ margin: '1rem 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Ejemplo de petición cURL:</h5>
                  <pre style={{ 
                    padding: '1rem', 
                    backgroundColor: '#071D34', 
                    borderRadius: '8px', 
                    color: '#60a5fa', 
                    overflowX: 'auto', 
                    fontSize: '0.8rem', 
                    fontFamily: 'monospace',
                    border: '1px solid var(--border-color)',
                    lineHeight: 1.4
                  }}>
{`curl -X GET "${window.location.origin}/api/products" \\
  -H "Authorization: Bearer TU_API_TOKEN"`}
                  </pre>
                </div>

                {/* Endpoint 3 */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <span style={{ 
                      padding: '0.25rem 0.75rem', 
                      backgroundColor: '#10b981', 
                      color: '#0b2b4c', 
                      borderRadius: '6px', 
                      fontWeight: 'bold', 
                      fontSize: '0.85rem' 
                    }}>
                      POST
                    </span>
                    <strong style={{ fontFamily: 'monospace', fontSize: '1.1rem', color: '#0b2b4c' }}>/api/appointments</strong>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '1rem', lineHeight: 1.5 }}>
                    Permite agendar citas de forma externa en el sistema de calendario de tu inquilino (ej. integraciones con otros calendarios o CRMs).
                  </p>
                  
                  <h5 style={{ margin: '1rem 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Ejemplo de petición cURL:</h5>
                  <pre style={{ 
                    padding: '1rem', 
                    backgroundColor: '#071D34', 
                    borderRadius: '8px', 
                    color: '#34d399', 
                    overflowX: 'auto', 
                    fontSize: '0.8rem', 
                    fontFamily: 'monospace',
                    border: '1px solid var(--border-color)',
                    lineHeight: 1.4
                  }}>
{`curl -X POST "${window.location.origin}/api/appointments" \\
  -H "Authorization: Bearer TU_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer_name": "Maria Lopez",
    "customer_phone": "+505-8777-6655",
    "appointment_date": "2026-07-15",
    "appointment_time": "11:00",
    "service": "Mantenimiento Técnico"
  }'`}
                  </pre>
                </div>

              </div>
            </div>
          )}

          {activeTab === 'control-plane' && (
            <ControlPlaneTab tenantId={tenantId || 'demo'} token={token} role={role} />
          )}

          {activeTab === 'inbox' && (
            <InboxWorkspace tenantId={tenantId || 'demo'} token={token} role={role} userEmail={userEmail} />
          )}

          {activeTab === 'contacts' && (
            <ContactsDirectoryTab
              tenantId={tenantId || 'demo'}
              token={token}
              role={role}
              onOpenChat={() => setActiveTab('inbox')}
              onOpenOpportunityModal={() => setActiveTab('kanban')}
            />
          )}

          {activeTab === 'kanban' && (
            <KanbanBoard tenantId={tenantId || 'demo'} token={token} role={role} onOpenChat={() => setActiveTab('inbox')} />
          )}

          {activeTab === 'admin' && role === 'superadmin' && (
            <div className="glass-card" style={{ animation: 'fadeIn 0.2s ease-out' }}>
              <h2 className="card-title" style={{ color: 'var(--color-danger)' }}>
                🏢 Panel de Super Administración (Tenants & Usuarios)
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.4 }}>
                Administración de cuentas e inquilinos (Tenants). Puedes dar de alta nuevos clientes y asignarles su primer usuario administrador.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
                {/* Create Tenant Form */}
                <form onSubmit={handleCreateTenant} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '2rem' }}>
                  <h3 className="card-title" style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>➕ Dar de Alta Nueva Empresa (Tenant)</h3>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="new_tenant_id">ID del Tenant (slug único)</label>
                      <input
                        type="text"
                        id="new_tenant_id"
                        value={newTenantId}
                        onChange={(e) => setNewTenantId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                        placeholder="ej: sicsa"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="new_tenant_name">Nombre de la Empresa</label>
                      <input
                        type="text"
                        id="new_tenant_name"
                        value={newTenantName}
                        onChange={(e) => setNewTenantName(e.target.value)}
                        placeholder="ej: SICSA Nicaragua"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                    <div className="form-group">
                      <label htmlFor="new_tenant_email">Correo del Administrador</label>
                      <input
                        type="email"
                        id="new_tenant_email"
                        value={newTenantEmail}
                        onChange={(e) => setNewTenantEmail(e.target.value)}
                        placeholder="ej: admin@sicsa.com.ni"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="new_tenant_password">Contraseña</label>
                      <input
                        type="password"
                        id="new_tenant_password"
                        value={newTenantPassword}
                        onChange={(e) => setNewTenantPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="new_tenant_role">Rol del Administrador</label>
                      <select
                        id="new_tenant_role"
                        value={newTenantRole}
                        onChange={(e) => setNewTenantRole(e.target.value as any)}
                        required
                        style={{ width: '100%' }}
                      >
                        <option value="admin">Administrador (Tenant)</option>
                        <option value="superadmin">Super Administrador (Global)</option>
                      </select>
                    </div>
                  </div>

                  <button type="submit" className="btn-primary" style={{ backgroundColor: '#ef4444', borderColor: '#dc2626' }} disabled={creatingTenant}>
                    {creatingTenant ? 'Creando Tenant...' : 'Crear Empresa y Administrador'}
                  </button>
                </form>

                {/* Tenants list */}
                <div>
                  <h3 className="card-title" style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>📋 Empresas Registradas</h3>
                  {tenants.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando inquilinos...</div>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '0.75rem' }}>Tenant ID</th>
                            <th style={{ padding: '0.75rem' }}>Nombre</th>
                            <th style={{ padding: '0.75rem' }}>Usuario Admin</th>
                            <th style={{ padding: '0.75rem' }}>Fecha de Alta</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tenants.map((t, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                              <td style={{ padding: '0.75rem', fontFamily: 'monospace', color: '#f87171', fontWeight: 'bold' }}>{t.tenant_id}</td>
                              <td style={{ padding: '0.75rem', fontWeight: 600 }}>{t.tenant_name}</td>
                              <td style={{ padding: '0.75rem', color: '#93c5fd' }}>{t.email || '(Sin usuario)'}</td>
                              <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{t.created_at ? new Date(t.created_at).toLocaleDateString() : 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'chats' && (
            <div className="glass-card" style={{ animation: 'fadeIn 0.2s ease-out' }}>
              <h2 className="card-title">
                💬 Historial de Conversaciones
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.4 }}>
                Explora el historial de interacciones de los clientes con Sofía para auditar y ajustar el comportamiento de la IA.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
                {/* Conversation List Sidebar */}
                <div style={{ borderRight: '1px solid var(--border-color)', paddingRight: '1rem', maxHeight: '500px', overflowY: 'auto' }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem' }}>Conversaciones Activas</h4>
                  {conversations.length === 0 ? (
                    <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>No hay conversaciones registradas.</div>
                  ) : (
                    conversations.map((c) => (
                      <div
                        key={c.conversation_id}
                        onClick={() => fetchConversationLogs(c.conversation_id)}
                        style={{
                          padding: '0.75rem',
                          borderRadius: '8px',
                          backgroundColor: selectedConversationId === c.conversation_id ? 'var(--color-primary-glow)' : 'transparent',
                          border: selectedConversationId === c.conversation_id ? '1px solid var(--color-primary)' : '1px solid transparent',
                          cursor: 'pointer',
                          marginBottom: '0.5rem',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--color-primary)' }}>ID #{c.conversation_id}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{c.message_count} mensajes</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(c.last_active).toLocaleString()}</div>
                      </div>
                    ))
                  )}
                </div>

                {/* Conversation History Chat Log */}
                <div style={{ maxHeight: '500px', overflowY: 'auto', paddingLeft: '0.5rem' }}>
                  {selectedConversationId ? (
                    <div>
                      <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem' }}>Detalle de Chat: #{selectedConversationId}</h4>
                      {selectedConversationLogs.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando logs del chat...</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {selectedConversationLogs.map((log) => (
                            <div key={log.id} style={{
                              padding: '0.85rem',
                              borderRadius: '8px',
                              backgroundColor: log.role === 'user' ? '#f1f5f9' : '#e0f2fe',
                              alignSelf: log.role === 'user' ? 'flex-start' : 'flex-end',
                              maxWidth: '85%',
                              border: log.role === 'user' ? '1px solid #e2e8f0' : '1px solid #bae6fd'
                            }}>
                              <div style={{ fontWeight: 'bold', fontSize: '0.75rem', color: log.role === 'user' ? '#475569' : '#0369a1', marginBottom: '0.25rem' }}>
                                {log.role === 'user' ? 'Cliente' : 'Sofía (IA)'}
                              </div>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{log.content}</div>
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.35rem', textAlign: 'right' }}>
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      👈 Selecciona una conversación de la lista para ver el historial de chat completo.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <AnalyticsTab tenantId={tenantId || 'demo'} token={token} role={role} />
          )}

          {activeTab === 'activity' && (
            <div className="glass-card" style={{ animation: 'fadeIn 0.2s ease-out' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h2 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0b2b4c' }}>
                    <span className="material-symbols-outlined" style={{ color: '#8b5cf6', fontSize: '1.6rem' }}>vital_signs</span>
                    Bitácora en Vivo: Actividad del Asistente ({tenantId?.toUpperCase()})
                  </h2>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
                    Supervisión en tiempo real optimizada para alto volumen (400+ conversaciones diarias). Límite de carga inteligente para latencia cero.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {/* Auto-polling toggle button */}
                  <button
                    type="button"
                    onClick={() => setIsAutoPolling(!isAutoPolling)}
                    style={{
                      padding: '0.45rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: isAutoPolling ? '#10b981' : '#cbd5e1',
                      backgroundColor: isAutoPolling ? '#ecfdf5' : '#f8fafc',
                      color: isAutoPolling ? '#059669' : '#64748b',
                      fontSize: '0.78rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: isAutoPolling ? '#10b981' : '#94a3b8' }}>
                      {isAutoPolling ? 'sync' : 'pause_circle'}
                    </span>
                    {isAutoPolling ? '🟢 Refresco Automático (5s)' : '⏸️ Polling Pausado'}
                  </button>

                  {/* Message limit selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                    <span>Límite:</span>
                    <select
                      value={logLimit}
                      onChange={(e) => {
                        const newLimit = parseInt(e.target.value);
                        setLogLimit(newLimit);
                        fetchLogs(newLimit);
                      }}
                      style={{
                        padding: '0.4rem 0.6rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#0b2b4c',
                        fontSize: '0.78rem',
                        fontWeight: 'bold'
                      }}
                    >
                      <option value={20}>Últimos 20 msgs</option>
                      <option value={50}>Últimos 50 msgs</option>
                      <option value={100}>Últimos 100 msgs</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Quick Search & Filter bar */}
              <div style={{
                display: 'flex',
                gap: '0.75rem',
                backgroundColor: '#f8fafc',
                padding: '0.75rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                marginBottom: '1.25rem',
                alignItems: 'center'
              }}>
                <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '1.2rem' }}>search</span>
                <input
                  type="text"
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  placeholder="Filtrar por palabra clave o ID de conversación (ej: 2)..."
                  style={{
                    flex: 1,
                    border: 'none',
                    backgroundColor: 'transparent',
                    fontSize: '0.85rem',
                    color: '#0b2b4c',
                    outline: 'none'
                  }}
                />
                {logSearchQuery && (
                  <button
                    onClick={() => setLogSearchQuery('')}
                    style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    ✕ Limpiar
                  </button>
                )}
              </div>

              {/* Logs Stream */}
              <div className="logs-list" style={{ maxHeight: '580px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(() => {
                  const filteredLogs = logs.filter(log => {
                    if (!logSearchQuery.trim()) return true;
                    const q = logSearchQuery.toLowerCase();
                    return (
                      log.content.toLowerCase().includes(q) ||
                      log.conversation_id.toString().includes(q) ||
                      log.role.toLowerCase().includes(q)
                    );
                  });

                  if (filteredLogs.length === 0) {
                    return (
                      <div className="empty-state" style={{ padding: '3rem', textAlign: 'center' }}>
                        <p style={{ fontWeight: 'bold', color: '#64748b' }}>No se encontraron registros de actividad.</p>
                        <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                          {logSearchQuery ? 'Prueba cambiando el término de búsqueda.' : 'Los mensajes de WhatsApp aparecerán aquí en vivo al ser procesados por la IA.'}
                        </p>
                      </div>
                    );
                  }

                  return filteredLogs.map((log) => (
                    <div key={log.id} className="log-item" style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '10px',
                      backgroundColor: log.role === 'user' ? '#f8fafc' : '#f0f9ff',
                      border: log.role === 'user' ? '1px solid #e2e8f0' : '1px solid #bae6fd',
                      boxShadow: '0 1px 3px rgba(11, 43, 76, 0.03)'
                    }}>
                      <div className="log-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            backgroundColor: log.role === 'user' ? '#e2e8f0' : '#2563eb',
                            color: log.role === 'user' ? '#ffffff' : '#ffffff'
                          }}>
                            {log.role === 'user' ? '👤 CLIENTE' : '🤖 SOFÍA (IA)'}
                          </span>
                          <span
                            onClick={() => {
                              setSelectedConversationId(log.conversation_id.toString());
                              setActiveTab('chats');
                            }}
                            title="Haz clic para ver el historial completo de esta conversación"
                            style={{
                              fontSize: '0.75rem',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              color: '#2563eb',
                              cursor: 'pointer',
                              backgroundColor: '#eff6ff',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              border: '1px solid #bfdbfe'
                            }}
                          >
                            Conversación #{log.conversation_id} ↗
                          </span>
                        </div>
                        <span className="log-time" style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                          {formatTime(log.timestamp)}
                        </span>
                      </div>
                      <div className="log-content" style={{ fontSize: '0.88rem', color: '#0b2b4c', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                        {log.content}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {activeTab === 'webhook' && (
            <div className="glass-card" style={{ animation: 'fadeIn 0.2s ease-out' }}>
              <h2 className="card-title">
                🔗 Integración de Webhook con Chatwoot
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                Para conectar tu bandeja de entrada de Chatwoot con nuestro agente inteligente, debes registrar un Webhook en tu panel de Chatwoot.
              </p>

              <div style={{ borderLeft: '4px solid var(--color-primary)', padding: '1rem', backgroundColor: 'var(--bg-input)', borderRadius: '8px', marginBottom: '1.5rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-primary)' }}>URL del Webhook de este Tenant:</h4>
                <code style={{ 
                  display: 'block', 
                  padding: '0.75rem', 
                  backgroundColor: 'var(--bg-card)', 
                  borderRadius: '6px', 
                  fontSize: '0.9rem', 
                  color: '#2563eb',
                  wordBreak: 'break-all',
                  fontFamily: 'monospace',
                  border: '1px solid var(--border-color)',
                  fontWeight: 'bold'
                }}>
                  {window.location.origin}/api/webhook/{tenantId}
                </code>
              </div>

              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--color-primary)' }}>📋 Instrucciones de Configuración:</h3>
              <ol style={{ fontSize: '0.9rem', lineHeight: 1.6, paddingLeft: '1.25rem', color: 'var(--text-main)' }}>
                <li style={{ marginBottom: '0.5rem' }}>Ve a tu panel de administración de Chatwoot (ej. <i>Ajustes del Account</i>).</li>
                <li style={{ marginBottom: '0.5rem' }}>Navega a la sección de <b>Webhooks</b>.</li>
                <li style={{ marginBottom: '0.5rem' }}>Haz clic en <b>Añadir nuevo webhook</b>.</li>
                <li style={{ marginBottom: '0.5rem' }}>Pega la URL de arriba en el campo de dirección de destino.</li>
                <li style={{ marginBottom: '0.5rem' }}>Selecciona el evento <b>message_created</b> (Mensaje creado).</li>
              </ol>
            </div>
          )}

          {activeTab === 'teams' && (
            <TeamManagementTab tenantId={tenantId || 'sicsa'} token={token} role={role} />
          )}
            </section>
          </div>
        </main>
      </div>

      {showOnboarding && (
        <OnboardingWizard
          tenantId={tenantId || 'demo'}
          token={token}
          currentConfig={config}
          currentKb={kb.faqs || ''}
          onComplete={handleOnboardingComplete}
          onClose={() => setShowOnboarding(false)}
        />
      )}

      {/* Change Password Modal */}
      {showChangePassModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(11, 43, 76, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '1.5rem'
        }}>
          <div style={{ backgroundColor: '#ffffff', padding: '1.5rem', borderRadius: '16px', width: '100%', maxWidth: '450px', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#0b2b4c', fontSize: '1.1rem', fontWeight: 800 }}>
                  🔑 Cambiar mi Contraseña
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Usuario: <strong>{userEmail}</strong>
                </p>
              </div>
              <button onClick={() => setShowChangePassModal(false)} style={{ border: 'none', background: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleChangePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0b2b4c' }}>Contraseña Actual</label>
                <input
                  type="password"
                  value={currentPasswordInput}
                  onChange={(e) => setCurrentPasswordInput(e.target.value)}
                  required
                  placeholder="Ingresa tu contraseña actual"
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div className="form-group">
                <label style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0b2b4c' }}>Nueva Contraseña</label>
                <input
                  type="password"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  required
                  placeholder="Mínimo 6 caracteres"
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div className="form-group">
                <label style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0b2b4c' }}>Confirmar Nueva Contraseña</label>
                <input
                  type="password"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  required
                  placeholder="Repite la nueva contraseña"
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowChangePassModal(false)}
                  style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={changingPass}
                  style={{ padding: '0.6rem 1.5rem', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  {changingPass ? 'Actualizando...' : 'Guardar Nueva Contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
