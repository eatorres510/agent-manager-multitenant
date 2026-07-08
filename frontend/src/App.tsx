import React, { useState, useEffect } from 'react';

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

type TabType = 'settings' | 'knowledge' | 'products' | 'admin' | 'chats' | 'analytics' | 'activity' | 'webhook' | 'users' | 'appointments';

function App() {
  // Auth state
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [userEmail, setUserEmail] = useState<string | null>(localStorage.getItem('email'));
  const [tenantId, setTenantId] = useState<string | null>(localStorage.getItem('tenant_id'));
  const [role, setRole] = useState<'superadmin' | 'admin' | 'readonly' | null>(
    localStorage.getItem('role') as any
  );

  // Active Tab
  const [activeTab, setActiveTab] = useState<TabType>('settings');

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
    redis_enabled: 0
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
  const [showManualBookingModal, setShowManualBookingModal] = useState(false);
  const [manualBookingTime, setManualBookingTime] = useState('');
  const [manualCustomerName, setManualCustomerName] = useState('');
  const [manualCustomerPhone, setManualCustomerPhone] = useState('');
  const [manualService, setManualService] = useState('Servicio Técnico');
  const [bookingManual, setBookingManual] = useState(false);
  const [newTenantId, setNewTenantId] = useState('');
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
  interface ProductAnalytic {
    product_id: string;
    product_name: string;
    query_count: number;
    last_consulted: string;
  }
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedConversationLogs, setSelectedConversationLogs] = useState<LogEntry[]>([]);
  const [analytics, setAnalytics] = useState<ProductAnalytic[]>([]);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

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
      if (role === 'superadmin') {
        fetchTenants();
      }
      const interval = setInterval(fetchLogs, 5000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [token, role]);

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

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
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
      const res = await fetch('/api/analytics/products', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
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
        background: 'radial-gradient(circle at 50% 0%, #151d30 0%, #0B0F19 70%)',
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
              background: 'linear-gradient(135deg, #60a5fa 0%, #c084fc 100%)',
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
              <input
                type="password"
                id="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                required
              />
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
        <p style={{ fontSize: '1.2rem', color: '#9ca3af' }}>Cargando datos de la empresa...</p>
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

      {/* Left Sidebar */}
      <aside style={{
        width: '280px',
        backgroundColor: '#0b2b4c',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.5rem',
        borderRight: '1px solid rgba(255, 255, 255, 0.1)',
        position: 'fixed',
        height: '100vh',
        left: 0,
        top: 0,
        zIndex: 100,
        boxShadow: '4px 0 25px rgba(0,0,0,0.15)',
        boxSizing: 'border-box'
      }}>
        {/* Sidebar Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="none" style={{ filter: 'drop-shadow(0 2px 8px rgba(37,99,235,0.5))' }}>
            <rect x="3" y="8" width="18" height="12" rx="3" fill="#3b82f6"/>
            <path d="M12 2v6M9 2h6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="8" cy="14" r="2" fill="#ffffff"/>
            <circle cx="16" cy="14" r="2" fill="#ffffff"/>
            <circle cx="8" cy="14" r="0.75" fill="#3b82f6"/>
            <circle cx="16" cy="14" r="0.75" fill="#3b82f6"/>
            <path d="M9 18h6" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round"/>
            <rect x="1" y="11" width="2" height="6" rx="1" fill="#1d4ed8"/>
            <rect x="21" y="11" width="2" height="6" rx="1" fill="#1d4ed8"/>
          </svg>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>Agente IA</h1>
            <span style={{ fontSize: '0.7rem', color: '#60a5fa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Control Panel</span>
          </div>
        </div>

        {/* Current User Badge in Sidebar */}
        <div style={{ 
          padding: '0.75rem 1rem', 
          backgroundColor: 'rgba(255,255,255,0.04)', 
          borderRadius: '8px', 
          marginBottom: '1.5rem',
          border: '1px solid rgba(255,255,255,0.08)'
        }}>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.2rem' }}>Empresa (Tenant)</div>
          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            {tenantId?.toUpperCase()}
            {role && (
              <span style={{ 
                fontSize: '0.65rem', 
                padding: '0.1rem 0.35rem', 
                backgroundColor: role === 'superadmin' ? 'rgba(239, 68, 68, 0.2)' : role === 'admin' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(156, 163, 175, 0.2)', 
                color: role === 'superadmin' ? '#f87171' : role === 'admin' ? '#60a5fa' : '#9ca3af',
                borderRadius: '4px',
                fontWeight: 'bold'
              }}>
                {role === 'superadmin' ? 'S.Admin' : role === 'admin' ? 'Admin' : 'Lector'}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.1rem' }}>Usuario</div>
          <div style={{ fontSize: '0.75rem', color: '#e2e8f0', wordBreak: 'break-all', fontWeight: 500 }}>{userEmail}</div>
        </div>

        {/* Sidebar Nav Links */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1, overflowY: 'auto' }}>
          <button
            onClick={() => setActiveTab('settings')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: activeTab === 'settings' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              border: 'none',
              borderLeft: activeTab === 'settings' ? '3px solid #3b82f6' : '3px solid transparent',
              color: activeTab === 'settings' ? '#60a5fa' : '#9ca3af',
              padding: '0.75rem 1rem',
              borderRadius: '0 8px 8px 0',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s'
            }}
          >
            Ajustes del Agente
          </button>

          <button
            onClick={() => setActiveTab('knowledge')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: activeTab === 'knowledge' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
              border: 'none',
              borderLeft: activeTab === 'knowledge' ? '3px solid #a855f7' : '3px solid transparent',
              color: activeTab === 'knowledge' ? '#c084fc' : '#9ca3af',
              padding: '0.75rem 1rem',
              borderRadius: '0 8px 8px 0',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s'
            }}
          >
            Base de Conocimiento
          </button>

          <button
            onClick={() => {
              setActiveTab('appointments');
              fetchAppointments();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: activeTab === 'appointments' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              border: 'none',
              borderLeft: activeTab === 'appointments' ? '3px solid #3b82f6' : '3px solid transparent',
              color: activeTab === 'appointments' ? '#60a5fa' : '#9ca3af',
              padding: '0.75rem 1rem',
              borderRadius: '0 8px 8px 0',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s'
            }}
          >
            Agenda de Citas
          </button>

          <button
            onClick={() => {
              setActiveTab('products');
              fetchProducts();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: activeTab === 'products' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              border: 'none',
              borderLeft: activeTab === 'products' ? '3px solid #10b981' : '3px solid transparent',
              color: activeTab === 'products' ? '#34d399' : '#9ca3af',
              padding: '0.75rem 1rem',
              borderRadius: '0 8px 8px 0',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s'
            }}
          >
            Catálogo de Productos
          </button>

          <button
            onClick={() => {
              setActiveTab('chats');
              fetchConversations();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: activeTab === 'chats' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
              border: 'none',
              borderLeft: activeTab === 'chats' ? '3px solid #f59e0b' : '3px solid transparent',
              color: activeTab === 'chats' ? '#fbbf24' : '#9ca3af',
              padding: '0.75rem 1rem',
              borderRadius: '0 8px 8px 0',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s'
            }}
          >
            Auditoría de Chats
          </button>

          <button
            onClick={() => {
              setActiveTab('analytics');
              fetchAnalytics();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: activeTab === 'analytics' ? 'rgba(236, 72, 153, 0.15)' : 'transparent',
              border: 'none',
              borderLeft: activeTab === 'analytics' ? '3px solid #ec4899' : '3px solid transparent',
              color: activeTab === 'analytics' ? '#f472b6' : '#9ca3af',
              padding: '0.75rem 1rem',
              borderRadius: '0 8px 8px 0',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s'
            }}
          >
            Estadísticas
          </button>

          <button
            onClick={() => {
              setActiveTab('activity');
              fetchLogs();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: activeTab === 'activity' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
              border: 'none',
              borderLeft: activeTab === 'activity' ? '3px solid #8b5cf6' : '3px solid transparent',
              color: activeTab === 'activity' ? '#a78bfa' : '#9ca3af',
              padding: '0.75rem 1rem',
              borderRadius: '0 8px 8px 0',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s'
            }}
          >
            Actividad en Vivo
          </button>

          <button
            onClick={() => setActiveTab('webhook')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: activeTab === 'webhook' ? 'rgba(20, 184, 166, 0.15)' : 'transparent',
              border: 'none',
              borderLeft: activeTab === 'webhook' ? '3px solid #14b8a6' : '3px solid transparent',
              color: activeTab === 'webhook' ? '#2dd4bf' : '#9ca3af',
              padding: '0.75rem 1rem',
              borderRadius: '0 8px 8px 0',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s'
            }}
          >
            Conectar Webhook
          </button>

          <button
            onClick={() => {
              setActiveTab('users');
              fetchUsers();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: activeTab === 'users' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              border: 'none',
              borderLeft: activeTab === 'users' ? '3px solid #2563eb' : '3px solid transparent',
              color: activeTab === 'users' ? '#60a5fa' : '#9ca3af',
              padding: '0.75rem 1rem',
              borderRadius: '0 8px 8px 0',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s'
            }}
          >
            Usuarios y Tokens
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
                gap: '0.75rem',
                background: activeTab === 'admin' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                border: 'none',
                borderLeft: activeTab === 'admin' ? '3px solid #ef4444' : '3px solid transparent',
                color: activeTab === 'admin' ? '#f87171' : '#9ca3af',
                padding: '0.75rem 1rem',
                borderRadius: '0 8px 8px 0',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
            >
              Super Admin
            </button>
          )}
        </nav>

        {/* Sidebar Footer Logout */}
        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              color: '#f87171',
              padding: '0.65rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
            }}
          >
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div style={{ marginLeft: '280px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', boxSizing: 'border-box' }}>
        {/* Top Header bar */}
        <header style={{
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-color)',
          padding: '1.25rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          boxSizing: 'border-box'
        }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              {activeTab === 'settings' && 'Ajustes del Agente IA'}
              {activeTab === 'knowledge' && 'Base de Conocimiento (FAQs y Horarios)'}
              {activeTab === 'products' && 'Catálogo de Productos'}
              {activeTab === 'chats' && 'Auditoría de Historial de Chats'}
              {activeTab === 'analytics' && 'Estadísticas de Consultas'}
              {activeTab === 'activity' && 'Actividad en Vivo'}
              {activeTab === 'webhook' && 'Integración de Webhook'}
              {activeTab === 'users' && 'Gestión de Usuarios y Tokens'}
              {activeTab === 'appointments' && 'Agenda de Citas (Agendamiento IA)'}
              {activeTab === 'admin' && 'Panel de Super Administración Global'}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
              Panel de control y optimización del asistente inteligente
            </p>
          </div>

          {/* Status Badges in Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="status-badge">
              <div className={`status-dot ${isChatwootConfigured ? 'active' : 'inactive'}`} />
              <span>Chatwoot</span>
            </div>
            <div className="status-badge">
              <div className={`status-dot ${isAIConfigured ? 'active' : 'inactive'}`} />
              <span>AI: {config.active_provider === 'gemini' ? 'Gemini' : 'DeepSeek'}</span>
            </div>
            <div className="status-badge">
              <div className="status-dot active" />
              <span>Catálogo ({products.length})</span>
            </div>
          </div>
        </header>

        {/* Dashboard Main Content grid */}
        <main style={{ padding: '2rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="dashboard-grid">
            <section>
          {activeTab === 'settings' && (
            <form onSubmit={saveConfig} className="glass-card" style={{ animation: 'fadeIn 0.2s ease-out' }}>
              <h2 className="card-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                Configuración del Agente IA
              </h2>

              {/* Provider Switch */}
              <div className="form-group">
                <label>Proveedor de IA Activo</label>
                <div className="provider-toggle">
                  <button
                    type="button"
                    className={`provider-btn ${config.active_provider === 'gemini' ? 'active' : ''}`}
                    onClick={() => handleProviderSelect('gemini')}
                  >
                    🚀 Google Gemini
                  </button>
                  <button
                    type="button"
                    className={`provider-btn ${config.active_provider === 'deepseek' ? 'active' : ''}`}
                    onClick={() => handleProviderSelect('deepseek')}
                  >
                    🧠 DeepSeek
                  </button>
                </div>
              </div>

              {/* AI API Keys */}
              {config.active_provider === 'gemini' ? (
                <div className="form-group">
                  <label htmlFor="gemini_api_key">Google Gemini API Key</label>
                  <input
                    type="password"
                    id="gemini_api_key"
                    name="gemini_api_key"
                    value={config.gemini_api_key}
                    onChange={handleInputChange}
                    placeholder={config.gemini_api_key ? '***' : 'Ingresa tu API Key de Gemini'}
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label htmlFor="deepseek_api_key">DeepSeek API Key</label>
                  <input
                    type="password"
                    id="deepseek_api_key"
                    name="deepseek_api_key"
                    value={config.deepseek_api_key}
                    onChange={handleInputChange}
                    placeholder={config.deepseek_api_key ? '***' : 'Ingresa tu API Key de DeepSeek'}
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

              {/* Chatwoot Configuration */}
              <div style={{ borderTop: '1px solid var(--border-color)', margin: '1.5rem 0', paddingTop: '1.5rem' }}>
                <h3 className="card-title" style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>Conexión con Chatwoot</h3>
                
                <div className="form-group">
                  <label htmlFor="chatwoot_url">URL del Servidor Chatwoot</label>
                  <input
                    type="url"
                    id="chatwoot_url"
                    name="chatwoot_url"
                    value={config.chatwoot_url}
                    onChange={handleInputChange}
                    placeholder="https://chatwoot.tu-dominio.com"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="chatwoot_account_id">ID de Cuenta</label>
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
                    <label htmlFor="chatwoot_access_token">Access Token del Agente</label>
                    <input
                      type="password"
                      id="chatwoot_access_token"
                      name="chatwoot_access_token"
                      value={config.chatwoot_access_token}
                      onChange={handleInputChange}
                      placeholder="Token de acceso API del Bot/Agente"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label htmlFor="chatwoot_website_token">Token del Canal Web (Website Token) para chat de pruebas</label>
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
                Base de Conocimiento de {tenantId === 'demo' ? 'SICSA' : tenantId}
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
                        backgroundColor: '#1f2937',
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
                  backgroundColor: 'rgba(255,255,255,0.03)',
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
                      backgroundColor: '#1f2937',
                      border: '1px solid var(--border-color)',
                      color: '#ffffff',
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
                          <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ffffff' }}>{slot} hs</span>
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
                              <td style={{ padding: '0.75rem', color: '#9ca3af' }}>{t.email || '(Sin usuario)'}</td>
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
            <div className="glass-card" style={{ animation: 'fadeIn 0.2s ease-out' }}>
              <h2 className="card-title">
                📊 Estadísticas de Búsqueda de Productos
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.4 }}>
                Mira en tiempo real qué productos y laptops del catálogo de SICSA están consultando tus clientes.
              </p>

              <div>
                <h3 className="card-title" style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>🔥 Top 10 Laptops / Productos más Consultados</h3>
                {analytics.length === 0 ? (
                  <div style={{
                    padding: '3rem 1rem',
                    border: '1px dashed var(--border-color)',
                    borderRadius: '12px',
                    textAlign: 'center',
                    color: 'var(--text-muted)'
                  }}>
                    Aún no hay búsquedas de productos registradas. Las consultas de tus clientes aparecerán aquí automáticamente.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'rgba(11, 43, 76, 0.03)', borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ padding: '0.75rem' }}>ID/SKU del Producto</th>
                          <th style={{ padding: '0.75rem' }}>Nombre del Producto</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center' }}>Nº de Consultas</th>
                          <th style={{ padding: '0.75rem' }}>Última vez consultado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.map((a, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(11, 43, 76, 0.02)' }}>
                            <td style={{ padding: '0.75rem', fontFamily: 'monospace', color: '#2563eb', fontWeight: 'bold' }}>{a.product_id}</td>
                            <td style={{ padding: '0.75rem', fontWeight: 600 }}>{a.product_name}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 'bold', color: '#10b981', fontSize: '1rem' }}>
                              {a.query_count}
                            </td>
                            <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{new Date(a.last_consulted).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="glass-card" style={{ animation: 'fadeIn 0.2s ease-out' }}>
              <h2 className="card-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-secondary)' }}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                Actividad del Asistente (Conversaciones en Vivo)
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.4 }}>
                A continuación se muestran los mensajes más recientes procesados por el asistente en tiempo real.
              </p>
              <div className="logs-list" style={{ maxHeight: '600px' }}>
                {logs.length === 0 ? (
                  <div className="empty-state">
                    <p>No hay mensajes registrados aún.</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Los mensajes enviados por tus clientes aparecerán aquí en tiempo real cuando se conecte el webhook.
                    </p>
                  </div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="log-item">
                      <div className="log-header">
                        <span className={`log-role ${log.role}`}>
                          {log.role === 'user' ? 'Cliente' : 'Sofía (IA)'}
                        </span>
                        <span className="log-time">
                          {formatTime(log.timestamp)}
                        </span>
                      </div>
                      <div className="log-content" style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>{log.content}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        Conversación ID: {log.conversation_id}
                      </div>
                    </div>
                  ))
                )}
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
                <li style={{ marginBottom: '0.5rem' }}>Guarda los cambios.</li>
              </ol>
            </div>
          )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
