import React, { useState } from 'react';

interface OnboardingWizardProps {
  tenantId: string;
  token: string | null;
  currentConfig: any;
  currentKb: string;
  onComplete: (updatedConfig: any, updatedKb: string) => Promise<void>;
  onClose?: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  tenantId,
  token: _token,
  currentConfig,
  currentKb,
  onComplete,
  onClose
}) => {
  const [step, setStep] = useState<number>(1);
  const [saving, setSaving] = useState(false);

  // Form State
  const [agentName, setAgentName] = useState<string>(currentConfig.agent_name || 'Sofía');
  const [companyName, setCompanyName] = useState<string>(currentConfig.company_name || tenantId.toUpperCase());
  const [activeProvider, setActiveProvider] = useState<'gemini' | 'deepseek'>(currentConfig.active_provider || 'gemini');
  const [geminiApiKey, setGeminiApiKey] = useState<string>(currentConfig.gemini_api_key === '***' ? '***' : currentConfig.gemini_api_key || '');
  const [deepseekApiKey, setDeepseekApiKey] = useState<string>(currentConfig.deepseek_api_key === '***' ? '***' : currentConfig.deepseek_api_key || '');
  
  // Schedule state
  const [scheduleEnabled, setScheduleEnabled] = useState<boolean>(currentConfig.schedule_enabled !== false);
  const [workDays, setWorkDays] = useState<string>(currentConfig.work_days || 'Lunes a Viernes');
  const [workHoursStart, setWorkHoursStart] = useState<string>(currentConfig.work_hours_start || '08:00');
  const [workHoursEnd, setWorkHoursEnd] = useState<string>(currentConfig.work_hours_end || '17:00');

  // Knowledge Base state
  const [kbContent, setKbContent] = useState<string>(currentKb || `# BASE DE CONOCIMIENTO - ${tenantId.toUpperCase()}

### 🏢 INFORMACIÓN GENERAL DE LA EMPRESA
- Empresa: ${tenantId.toUpperCase()}
- Dirección: Managua, Nicaragua
- Horario de Atención: ${workDays} de ${workHoursStart} a ${workHoursEnd}

### 🛍️ POLÍTICAS DE VENTA Y PAGOS
- Aceptamos transferencias bancarias, efectivo y tarjetas de crédito.
- Envíos a todo el país.
`);

  const handleNext = () => setStep(prev => Math.min(prev + 1, 4));
  const handlePrev = () => setStep(prev => Math.max(prev - 1, 1));

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const configToSave = {
        ...currentConfig,
        agent_name: agentName,
        company_name: companyName,
        active_provider: activeProvider,
        gemini_api_key: geminiApiKey,
        deepseek_api_key: deepseekApiKey,
        schedule_enabled: scheduleEnabled,
        work_days: workDays,
        work_hours_start: workHoursStart,
        work_hours_end: workHoursEnd,
        is_onboarded: true
      };
      await onComplete(configToSave, kbContent);
    } catch (err) {
      console.error('Error finalizando Onboarding:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(11, 43, 76, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
      padding: '1.5rem',
      boxSizing: 'border-box'
    }}>
      <div className="glass-card" style={{
        width: '100%',
        maxWidth: '750px',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
        border: '1px solid #cbd5e1',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeIn 0.25s ease-out'
      }}>
        {/* Header */}
        <div style={{
          backgroundColor: '#0b2b4c',
          padding: '1.25rem 1.75rem',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '2rem', color: '#60a5fa' }}>rocket_launch</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                Asistente de Onboarding e Inicialización ({tenantId.toUpperCase()})
              </h3>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: '#93c5fd' }}>
                Configuración del Agente IA, Claves de API, Horarios y Base de Conocimiento
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              style={{ border: 'none', background: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Step Indicator Progress Bar */}
        <div style={{ backgroundColor: '#f1f5f9', padding: '0.75rem 1.75rem', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
            {[
              { num: 1, title: 'Identidad' },
              { num: 2, title: 'Motor IA & API Key' },
              { num: 3, title: 'Horario 24/7' },
              { num: 4, title: 'Base de Conocimiento' }
            ].map(st => (
              <div
                key={st.num}
                onClick={() => setStep(st.num)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  zIndex: 2
                }}
              >
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: step >= st.num ? '#2563eb' : '#cbd5e1',
                  color: '#ffffff',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  transition: 'all 0.2s'
                }}>
                  {st.num}
                </div>
                <span style={{
                  fontSize: '0.78rem',
                  fontWeight: step === st.num ? 800 : 600,
                  color: step === st.num ? '#0b2b4c' : '#64748b'
                }}>
                  {st.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Wizard Body */}
        <form onSubmit={handleFinish} style={{ padding: '1.75rem', flex: 1, overflowY: 'auto' }}>
          {/* STEP 1: Identidad del Agente */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeIn 0.2s ease-out' }}>
              <div style={{ backgroundColor: '#eff6ff', padding: '1rem', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                <h4 style={{ margin: '0 0 0.3rem 0', color: '#1e40af', fontSize: '0.9rem', fontWeight: 800 }}>
                  👤 Paso 1: Nombre del Asistente e Identidad Comercial
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#3b82f6', lineHeight: 1.4 }}>
                  Define el nombre público de tu bot y la empresa. Sofía utilizará este nombre para identificarse amablemente con tus clientes en WhatsApp.
                </p>
              </div>

              <div className="form-group">
                <label style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0b2b4c' }}>Nombre del Asistente Virtual</label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="ej. Sofía, Carlos, Asistente Virtual"
                  required
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div className="form-group">
                <label style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0b2b4c' }}>Nombre Oficial de la Empresa</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="ej. SICSA Nicaragua"
                  required
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>
          )}

          {/* STEP 2: Motor de IA y Claves de API */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeIn 0.2s ease-out' }}>
              <div style={{ backgroundColor: '#f0fdf4', padding: '1rem', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                <h4 style={{ margin: '0 0 0.3rem 0', color: '#166534', fontSize: '0.9rem', fontWeight: 800 }}>
                  🤖 Paso 2: Configuración del Motor de Inteligencia Artificial
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#15803d', lineHeight: 1.4 }}>
                  Selecciona el motor conversacional activo para procesar las preguntas de tus clientes de WhatsApp e ingresa tu Clave de API.
                </p>
              </div>

              <div className="form-group">
                <label style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0b2b4c' }}>Proveedor / Motor de IA Activo</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.4rem' }}>
                  <div
                    onClick={() => setActiveProvider('gemini')}
                    style={{
                      padding: '1rem',
                      borderRadius: '10px',
                      border: activeProvider === 'gemini' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      backgroundColor: activeProvider === 'gemini' ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontWeight: 800, color: '#1e3a8a', fontSize: '0.9rem' }}>🚀 Motor IA Principal (Standard)</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>Recomendado para alta velocidad y respuestas concisas de catálogo.</div>
                  </div>

                  <div
                    onClick={() => setActiveProvider('deepseek')}
                    style={{
                      padding: '1rem',
                      borderRadius: '10px',
                      border: activeProvider === 'deepseek' ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                      backgroundColor: activeProvider === 'deepseek' ? '#f5f3ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontWeight: 800, color: '#5b21b6', fontSize: '0.9rem' }}>🧠 Motor IA Avanzado (High Performance)</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>Recomendado para análisis profundo y cotizaciones complejas.</div>
                  </div>
                </div>
              </div>

              {activeProvider === 'gemini' ? (
                <div className="form-group">
                  <label style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0b2b4c' }}>Clave de API Motor Principal</label>
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder={geminiApiKey === '***' ? '***' : 'Ingresa tu API Key'}
                    required
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontFamily: 'monospace' }}
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0b2b4c' }}>Clave de API Motor Avanzado</label>
                  <input
                    type="password"
                    value={deepseekApiKey}
                    onChange={(e) => setDeepseekApiKey(e.target.value)}
                    placeholder={deepseekApiKey === '***' ? '***' : 'Ingresa tu API Key'}
                    required
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontFamily: 'monospace' }}
                  />
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Horario de Atención 24/7 */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeIn 0.2s ease-out' }}>
              <div style={{ backgroundColor: '#fff7ed', padding: '1rem', borderRadius: '10px', border: '1px solid #fed7aa' }}>
                <h4 style={{ margin: '0 0 0.3rem 0', color: '#c2410c', fontSize: '0.9rem', fontWeight: 800 }}>
                  ⏰ Paso 3: Horario de Atención Comercial & Comportamiento 24/7
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#ea580c', lineHeight: 1.4 }}>
                  La IA opera 24/7 respondiendo catálogo. Durante tu horario comercial, transfiere inmediatamente a asesores en vivo. Fuera de horario, registra la oportunidad en el CRM.
                </p>
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="checkbox"
                  id="schedule_enabled_check"
                  checked={scheduleEnabled}
                  onChange={(e) => setScheduleEnabled(e.target.checked)}
                  style={{ width: 'auto', cursor: 'pointer' }}
                />
                <label htmlFor="schedule_enabled_check" style={{ margin: 0, fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}>
                  Activar Reglas de Horario Comercial (Escalamiento en Caliente vs CRM 24/7)
                </label>
              </div>

              {scheduleEnabled && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div className="form-group">
                    <label style={{ fontWeight: 800, fontSize: '0.85rem' }}>Días de Atención</label>
                    <input
                      type="text"
                      value={workDays}
                      onChange={(e) => setWorkDays(e.target.value)}
                      placeholder="Lunes a Viernes"
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontWeight: 800, fontSize: '0.85rem' }}>Hora Inicio Comercial</label>
                    <input
                      type="time"
                      value={workHoursStart}
                      onChange={(e) => setWorkHoursStart(e.target.value)}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontWeight: 800, fontSize: '0.85rem' }}>Hora Cierre Comercial</label>
                    <input
                      type="time"
                      value={workHoursEnd}
                      onChange={(e) => setWorkHoursEnd(e.target.value)}
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Base de Conocimiento Inicial */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeIn 0.2s ease-out' }}>
              <div style={{ backgroundColor: '#f0fdfa', padding: '1rem', borderRadius: '10px', border: '1px solid #99f6e4' }}>
                <h4 style={{ margin: '0 0 0.3rem 0', color: '#0f766e', fontSize: '0.9rem', fontWeight: 800 }}>
                  📚 Paso 4: Base de Conocimiento Inicial & Preguntas Frecuentes
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#0d9488', lineHeight: 1.4 }}>
                  Escribe la información de tu negocio (dirección, garantía, métodos de pago, envíos). Sofía utilizará este texto como su fuente de verdad primaria.
                </p>
              </div>

              <div className="form-group">
                <label style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0b2b4c' }}>Contenido de la Base de Conocimiento (Markdown)</label>
                <textarea
                  value={kbContent}
                  onChange={(e) => setKbContent(e.target.value)}
                  rows={10}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontFamily: 'monospace',
                    fontSize: '0.82rem',
                    lineHeight: 1.45
                  }}
                />
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '1.75rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid #e2e8f0'
          }}>
            <button
              type="button"
              onClick={handlePrev}
              disabled={step === 1}
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: step === 1 ? '#f1f5f9' : '#ffffff',
                color: step === 1 ? '#94a3b8' : '#0b2b4c',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: step === 1 ? 'not-allowed' : 'pointer'
              }}
            >
              ◀ Anterior
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                style={{
                  padding: '0.6rem 1.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Siguiente ▶
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '0.65rem 1.75rem',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)'
                }}
              >
                {saving ? 'Guardando e Inicializando...' : '🚀 Finalizar y Comenzar a Operar'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
