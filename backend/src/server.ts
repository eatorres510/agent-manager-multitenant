import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import multer from 'multer';
import { configService, AgentConfig, KnowledgeBase } from './services/config.service.js';
import { redisService } from './services/redis.service.js';
import { aiService, ChatMessage } from './services/ai.service.js';
import { controlService } from './services/control.service.js';

dotenv.config();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB file limit
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'secret-token-key-12345';

app.use(cors());
app.use(express.json({ limit: '10mb' })); // support larger payloads for product sync

// Serve frontend in production
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDistPath));

// Middleware to authenticate JWT
interface AuthRequest extends Request {
  user?: {
    email: string;
    tenant_id: string;
    role: 'superadmin' | 'admin' | 'readonly';
  };
}

function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. Token no provisto.' });
  }

  jwt.verify(token, JWT_SECRET, async (err, decodedUser: any) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado.' });
    }
    try {
      const user = await configService.findUserByEmail(decodedUser.email);
      if (user) {
        req.user = {
          email: user.email,
          tenant_id: user.tenant_id,
          role: user.role
        };
      } else {
        req.user = decodedUser;
      }
    } catch (dbErr) {
      req.user = decodedUser;
    }
    next();
  });
}

// Helper to determine if current time is within business hours (timezone-aware)
function isWithinWorkingHours(kb: KnowledgeBase): { isOpen: boolean; currentTimeStr: string; statusDescription: string } {
  try {
    const timezone = kb.timezone || 'America/Managua';
    const now = new Date();
    
    // Format to timezone components
    const formatter = new Intl.DateTimeFormat('es-NI', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const timeStr = formatter.format(now); // e.g. "Mon, 22:30"
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const dayOfWeek = tzDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const currentHour = tzDate.getHours();
    const currentMinute = tzDate.getMinutes();
    const currentTimeVal = currentHour * 60 + currentMinute;

    const parseTime = (tStr: string): number => {
      const [h, m] = tStr.split(':').map(Number);
      return h * 60 + m;
    };

    let isOpen = false;
    let ruleText = '';

    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      // Mon-Fri
      let startVal = parseTime(kb.mon_fri_start || '08:00');
      let endVal = parseTime(kb.mon_fri_end || '17:30');
      if (endVal < startVal && endVal < 720) endVal += 12 * 60;
      isOpen = currentTimeVal >= startVal && currentTimeVal <= endVal;
      ruleText = `Lunes a Viernes de ${kb.mon_fri_start} a ${kb.mon_fri_end}`;
    } else if (dayOfWeek === 6) {
      // Sat
      let startVal = parseTime(kb.sat_start || '08:00');
      let endVal = parseTime(kb.sat_end || '12:30');
      if (endVal < startVal && endVal < 720) endVal += 12 * 60;
      isOpen = currentTimeVal >= startVal && currentTimeVal <= endVal;
      ruleText = `Sábados de ${kb.sat_start} a ${kb.sat_end}`;
    } else {
      // Sun
      isOpen = kb.sun_enabled === 1;
      ruleText = 'Domingos (Cerrado)';
    }

    const statusDescription = isOpen 
      ? `Abierto (Horario de atención: ${ruleText})`
      : `Cerrado (Fuera de horario. Horario de atención: Lunes a Viernes ${kb.mon_fri_start}-${kb.mon_fri_end}, Sábados ${kb.sat_start}-${kb.sat_end})`;

    return {
      isOpen,
      currentTimeStr: `${timeStr} (Zona horaria: ${timezone})`,
      statusDescription
    };
  } catch (err) {
    console.error('Error calculating working hours:', err);
    return {
      isOpen: true,
      currentTimeStr: 'Desconocida',
      statusDescription: 'Abierto (Fallback por error de cálculo)'
    };
  }
}

// -------------------------------------------------------------
// WEBHOOK (Tenant Specific - Unauthenticated)
// -------------------------------------------------------------
// Keep track of message IDs sent by our bot to distinguish them from human responses
const botSentMessages = new Set<string>();

// Helper to escalate conversation in Chatwoot
async function escalateConversation(tenantId: string, conversationId: number, accountId: number, config: AgentConfig, reason: string) {
  try {
    console.log(`[Escalation - Tenant: ${tenantId}] Transfiriendo conversación ${conversationId} a un humano (estado: open)...`);
    
    // 1. Change status to open
    const convUrl = `${config.chatwoot_url}/api/v1/accounts/${accountId}/conversations/${conversationId}`;
    await axios.put(
      convUrl,
      { status: 'open' },
      { headers: { 'Content-Type': 'application/json', 'api_access_token': config.chatwoot_access_token } }
    );

    // 2. Add label 'bot-escalado'
    const labelUrl = `${config.chatwoot_url}/api/v1/accounts/${accountId}/conversations/${conversationId}/labels`;
    await axios.post(
      labelUrl,
      { labels: ['bot-escalado'] },
      { headers: { 'Content-Type': 'application/json', 'api_access_token': config.chatwoot_access_token } }
    ).catch(err => console.error(`[Label Error] Failed to add label:`, err.message));

    // 3. Post private note notifying agents
    const msgUrl = `${config.chatwoot_url}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;
    const noteRes = await axios.post(
      msgUrl,
      {
        content: `⚠️ [Bot] Conversación escalada automáticamente.\nMotivo: ${reason}`,
        message_type: 'outgoing',
        private: true
      },
      { headers: { 'Content-Type': 'application/json', 'api_access_token': config.chatwoot_access_token } }
    ).catch(err => {
      console.error(`[Note Error] Failed to add private note:`, err.message);
      return null;
    });

    if (noteRes && noteRes.data && noteRes.data.id) {
      botSentMessages.add(`${tenantId}:${noteRes.data.id}`);
      setTimeout(() => botSentMessages.delete(`${tenantId}:${noteRes.data.id}`), 60000);
    }

    // 4. Assign to team ONLY IF escalation_team_id is explicitly configured and not null
    if (config.escalation_team_id) {
      console.log(`[Escalation] Verificando asignación actual y asesores activos 'online' en equipo ID: ${config.escalation_team_id}`);
      
      const convDetailRes = await axios.get(
        `${config.chatwoot_url}/api/v1/accounts/${accountId}/conversations/${conversationId}`,
        { headers: { 'api_access_token': config.chatwoot_access_token } }
      ).catch(() => null);

      const currentAssigneeId = convDetailRes?.data?.meta?.assignee?.id;
      const assignUrl = `${config.chatwoot_url}/api/v1/accounts/${accountId}/conversations/${conversationId}/assignments`;
      const assignPayload: any = { team_id: config.escalation_team_id };

      if (currentAssigneeId) {
        console.log(`[Escalation Preserve Assignee] Conservando asesor ya asignado (ID: ${currentAssigneeId}).`);
        assignPayload.assignee_id = currentAssigneeId;
        await axios.post(
          assignUrl,
          assignPayload,
          { headers: { 'Content-Type': 'application/json', 'api_access_token': config.chatwoot_access_token } }
        ).catch(err => console.error(`[Team Assignment Error] Failed to assign team:`, err.response?.data || err.message));
      } else {
        const onlineMember = await controlService.getNextRoundRobinAssignee(tenantId, config.escalation_team_id);
        if (onlineMember) {
          console.log(`[Escalation Auto-Assign] Asesor activo en línea encontrado: ${onlineMember.user_name} (${onlineMember.user_email})`);
          assignPayload.assignee_id = onlineMember.user_id || onlineMember.id;
          await axios.post(
            assignUrl,
            assignPayload,
            { headers: { 'Content-Type': 'application/json', 'api_access_token': config.chatwoot_access_token } }
          ).catch(err => console.error(`[Team Assignment Error] Failed to assign team:`, err.response?.data || err.message));
        } else {
          console.log(`[Escalation Filter] Todos los asesores están Inactivos/Ausentes. Sin sobreescribir asignaciones.`);
        }
      }
    } else {
      console.log(`[Escalation] Asignación de equipo deshabilitada para tenant '${tenantId}'. Conservando asignación manual.`);
    }
  } catch (err: any) {
    console.error(`[Escalation System Error - Tenant: ${tenantId}]`, err.response?.data || err.message);
  }
}

// Helper to check consecutive fallback counts from database logs
async function checkFallbackEscalation(tenantId: string, conversationId: number, config: AgentConfig): Promise<boolean> {
  const maxFallbacks = config.max_fallback_attempts || 3;
  const logs = await configService.getConversationLogs(tenantId, conversationId.toString());
  
  // Filter assistant logs, sorted from newest to oldest (default from getConversationLogs is newest first)
  const assistantLogs = logs.filter(l => l.role === 'assistant');
  
  if (assistantLogs.length < maxFallbacks) {
    return false;
  }
  
  const recentResponses = assistantLogs.slice(0, maxFallbacks);
  
  const allAreFallbacks = recentResponses.every(l => {
    const text = l.content.toLowerCase();
    return text.includes('lo siento') || 
           text.includes('no tengo información') || 
           text.includes('inconveniente técnico') ||
           text.includes('presento un inconveniente') ||
           text.includes('no cuento con información');
  });
  
  return allAreFallbacks;
}

// Webhook route
app.post('/api/webhook/:tenantId?', async (req, res) => {
  const tenantId = req.params.tenantId || 'demo';
  const payload = req.body;

  console.log(`[Webhook] Recibido evento para Tenant: ${tenantId}`);

  try {
    const tenant = await configService.getTenant(tenantId);
    if (!tenant) {
      console.warn(`[Webhook Error] Tenant '${tenantId}' no registrado en la plataforma.`);
      return res.status(204).json({ error: 'Tenant no encontrado.' });
    }

    // Surgically update the affected conversation in cache (instead of clearing all)
    // This avoids forcing a full Chatwoot API re-fetch on every incoming message
    const webhookConvId = payload.conversation?.id;
    if (webhookConvId) {
      controlService.updateConversationInCache(tenantId, webhookConvId, payload);
    } else {
      controlService.clearTenantCache(tenantId);
    }

    // Broadcast SSE live event to connected advisors
    controlService.broadcastSseEvent(tenantId, payload.event || 'update', payload);


    if (payload.conversation) {
      const conversationId = payload.conversation.id;
      const status = payload.conversation.status;
      const assigneeId = payload.conversation.assignee_id || (payload.conversation.assignee && payload.conversation.assignee.id);

      // Ignore private notes, internal messages, and activity audit logs to prevent loops!
      if (payload.private || payload.message_type === 'activity' || payload.message_type === 2) {
        return res.status(200).json({ status: 'ignored_private_or_activity' });
      }

      // 1. Detect human takeover (outgoing public message from human agent)
      if (payload.event === 'message_created' && payload.message_type === 'outgoing') {
        const messageId = payload.id;
        if (!botSentMessages.has(`${tenantId}:${messageId}`)) {
          const sender = payload.sender;
          const senderName = sender?.name || sender?.email || 'agente humano';

          // Anti-loop guard: if already open AND already has assignee, skip processing
          // This prevents the webhook from re-triggering Human Takeover on every agent reply
          const currentAssignee = payload.conversation?.meta?.assignee;
          const conversationLabels: string[] = payload.conversation?.labels || [];
          const alreadyEscalated = conversationLabels.includes('bot-escalado');
          if (status === 'open' && currentAssignee && alreadyEscalated) {
            // Already fully processed — emit SSE and return immediately to break the loop
            controlService.broadcastSseEvent(tenantId, 'message_created', payload);
            return res.status(200).json({ status: 'already_open_skip' });
          }

          console.log(`[Handover] Agente humano ${senderName} envió mensaje saliente en conv #${conversationId}. Desactivando IA y auto-asignando.`);
          
          if (status === 'pending') {
            const config = await configService.getConfig(tenantId);
            await escalateConversation(
              tenantId, 
              conversationId, 
              payload.account.id, 
              config, 
              `Toma de control manual por ${senderName}.`
            );
          }

          // Auto-assign to sender ONLY IF conversation has no assignee
          if (!currentAssignee) {
            if (sender?.id) {
              controlService.assignConversation(tenantId, conversationId.toString(), sender.id).catch(e => console.error('[Webhook Auto-Assign Error]', e.message));
            } else if (sender?.email) {
              controlService.autoAssignBySenderEmail(tenantId, conversationId.toString(), sender.email).catch(e => console.error('[Webhook Auto-Assign Email Error]', e.message));
            }
          }

          return res.status(200).json({ status: 'handover_processed' });
        }
      }

      // 2. Process incoming messages
      if (
        payload.event === 'message_created' &&
        payload.message_type === 'incoming' &&
        payload.content
      ) {
        const config = await configService.getConfig(tenantId);
        const kb = await configService.getKnowledgeBase(tenantId);
        const hours = isWithinWorkingHours(kb);

        // ALWAYS broadcast SSE event for all incoming messages so frontend UI updates in real-time!
        const incomingMsgObj = {
          id: payload.id || Date.now(),
          content: payload.content || '',
          message_type: 0,
          private: payload.private || false,
          created_at: payload.created_at || Math.floor(Date.now() / 1000),
          conversation_id: conversationId,
          display_id: payload.conversation?.display_id || conversationId,
          sender: payload.sender || payload.conversation?.meta?.sender || { name: 'Cliente' }
        };
        controlService.broadcastSseEvent(tenantId, 'message_created', {
          conversation_id: conversationId,
          display_id: payload.conversation?.display_id || conversationId,
          message: incomingMsgObj
        });

        const isAfterHours = !hours.isOpen;

        // TENANT-LEVEL AI ACTIVATION DECISION:
        // 1. Emergency AI Mode = Forced ON 24/7.
        // 2. Outside Business Hours (!hours.isOpen):
        //    Controlled by config.ai_enabled_after_hours (Default: TRUE -> AI responds automatically & creates CRM opportunities when closed).
        // 3. During Business Hours (hours.isOpen):
        //    Controlled by config.ai_enabled_during_hours (Default: FALSE for SICSA -> Humans handle all chats when open, unless status is explicitly 'pending').

        let shouldAiRespond = false;

        if (config.emergency_ai_mode) {
          shouldAiRespond = true;
        } else if (isAfterHours) {
          shouldAiRespond = config.ai_enabled_after_hours !== false; // Default: true (Active after-hours)
        } else {
          // During Business Hours: Controlled strictly by config.ai_enabled_during_hours
          if (config.ai_enabled_during_hours === true) {
            shouldAiRespond = true;
          } else {
            // Default SICSA Mode: AI is 100% DISABLED during human business hours (Human First).
            // All incoming chats remain in inbox for human advisors to reply.
            shouldAiRespond = false;
          }
        }

        if (!shouldAiRespond) {
          console.log(`[AI Ignored - Tenant: ${tenantId}] En horario laboral con IA desactivada para atención humana (Estado: '${status}', Horario: ${hours.isOpen ? 'Abierto' : 'Cerrado'}). SSE Evento Emitido.`);
          return res.status(200).json({ status: 'ignored_human_in_control' });
        }

        const accountId = payload.account.id;
        const userMessage = payload.content;
        const customerPhone = payload.sender?.phone_number || payload.conversation?.meta?.sender?.phone_number || '';

        // Check for quick keyword-based escalation
        const keywords = (config.escalation_keywords || 'humano,asesor,representante,persona,soporte,operador')
          .split(',')
          .map(kw => kw.trim().toLowerCase())
          .filter(kw => kw.length > 0);
          
        const lowercaseMsg = userMessage.toLowerCase();
        const matchedKeyword = keywords.find(kw => lowercaseMsg.includes(kw));
        
        if (matchedKeyword) {
          console.log(`[Webhook Escalation] Palabra clave '${matchedKeyword}' detectada en el mensaje. (En Horario: ${hours.isOpen ? 'SÍ' : 'NO'})`);
          
          if (hours.isOpen) {
            await escalateConversation(
              tenantId, 
              conversationId, 
              accountId, 
              config, 
              `Usuario solicitó asistencia humana mediante palabra clave: "${matchedKeyword}"`
            );
            const welcomeMessage = "Te estoy transfiriendo con un asesor de servicio en este momento. ¡Un momento, por favor! 😊";
            const msgUrl = `${config.chatwoot_url}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;
            const chatwootRes = await axios.post(
              msgUrl,
              { content: welcomeMessage, message_type: 'outgoing' },
              { headers: { 'Content-Type': 'application/json', 'api_access_token': config.chatwoot_access_token } }
            );
            if (chatwootRes.data && chatwootRes.data.id) {
              botSentMessages.add(`${tenantId}:${chatwootRes.data.id}`);
              setTimeout(() => botSentMessages.delete(`${tenantId}:${chatwootRes.data.id}`), 60000);
            }
            await configService.logMessage(tenantId, conversationId.toString(), 'user', userMessage);
            await configService.logMessage(tenantId, conversationId.toString(), 'assistant', welcomeMessage);
            return res.status(200).json({ status: 'escalated_via_keyword' });
          } else {
            // After-hours keyword handling: inform customer of schedule politely
            const afterHoursMsg = `Actualmente nos encontramos fuera de nuestro horario de atención humana. Nuestro equipo atiende de Lunes a Viernes (8:00 AM - 5:30 PM) y Sábados (8:00 AM - 12:30 PM). He registrado tu consulta y un asesor te responderá tan pronto abramos. Mientras tanto, ¿en qué más te puedo asistir con información de productos o cotizaciones? 😊`;
            const msgUrl = `${config.chatwoot_url}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;
            const chatwootRes = await axios.post(
              msgUrl,
              { content: afterHoursMsg, message_type: 'outgoing' },
              { headers: { 'Content-Type': 'application/json', 'api_access_token': config.chatwoot_access_token } }
            );
            if (chatwootRes.data && chatwootRes.data.id) {
              botSentMessages.add(`${tenantId}:${chatwootRes.data.id}`);
              setTimeout(() => botSentMessages.delete(`${tenantId}:${chatwootRes.data.id}`), 60000);
            }
            await configService.logMessage(tenantId, conversationId.toString(), 'user', userMessage);
            await configService.logMessage(tenantId, conversationId.toString(), 'assistant', afterHoursMsg);
            return res.status(200).json({ status: 'after_hours_keyword_notified' });
          }
        }

        // Process message asynchronously
        handleIncomingMessage(tenantId, conversationId, accountId, userMessage, customerPhone).catch((err) => {
          console.error(`[Webhook Error] Error procesando respuesta para ${tenantId}:`, err);
        });
      }
    }
  } catch (err) {
    console.error(`[Webhook System Error]`, err);
  }

  res.status(200).json({ status: 'ok' });
});

// Helper function to process the message and respond to Chatwoot
async function handleIncomingMessage(tenantId: string, conversationId: number, accountId: number, userMessage: string, customerPhone?: string) {
  const config = await configService.getConfig(tenantId);
  const kb = await configService.getKnowledgeBase(tenantId);

  // Validate configuration
  if (!config.chatwoot_url || !config.chatwoot_access_token) {
    console.warn(`[Warning] Tenant '${tenantId}' no configurado en Chatwoot. Saltando respuesta.`);
    return;
  }

  // 1. Log the user message
  await configService.logMessage(tenantId, conversationId.toString(), 'user', userMessage);

  // 2. Fetch recent conversation history from logs to provide context to LLM
  const dbLogs = await configService.getConversationLogs(tenantId, conversationId.toString());
  const history: ChatMessage[] = dbLogs
    .slice(-10)
    .map(log => ({
      role: log.role === 'user' ? 'user' : 'assistant',
      content: log.content
    }));

  // Remove the current message from history since we pass it separately
  if (history.length > 0 && history[history.length - 1].content === userMessage) {
    history.pop();
  }

  // Calculate current business hours
  const hours = isWithinWorkingHours(kb);

  // Assemble the lightweight dynamic system prompt with escalation rules and system prompt
  const fullSystemPrompt = `
=== IDENTIDAD Y ROL OFICIAL ===
Tu nombre es Sofía, la Asistente Virtual Oficial de SICSA Nicaragua.
Atiendes a los clientes con amabilidad, educación y profesionalismo.

${config.system_prompt}

=== INSTRUCCIONES ADICIONALES DE ESCALAMIENTO Y CLASIFICACIÓN ===
${config.escalation_instructions || 'Usa tu criterio para escalar con la herramienta escalate_to_human si la consulta es un reclamo complejo o requiere atención humana.'}

=== EVALUACIÓN CONTEXTUAL DE INTENCIÓN (TALLER VS VENTAS) ===
Analiza cuidadosamente la intención del cliente en la oración completa:
1. ATENCIÓN COMERCIAL / VENTAS: Si el cliente solicita comprar equipos nuevos, accesorios, cotizar baterías externas o para UPS (ej: 12V 7Ah / 9Ah), precios de productos o promociones -> Responder en flujo comercial de Ventas.
2. SERVICIO TÉCNICO / TALLER: Si el cliente menciona que su equipo no enciende, no retiene carga, requiere reemplazo o cambio de batería interna de laptop, mantenimiento técnico, garantía o diagnóstico -> Invocar de inmediato la herramienta escalate_to_human(reason: 'INTENT: TALLER') o incluir la palabra clave [ESCALAR_TALLER] al final de tu mensaje para transferir a Taller.

=== REGISTRO AUTOMÁTICO DE OPORTUNIDAD EN CRM ===
Si identificas una oportunidad o interés comercial del cliente (solicitud de precio, producto, cotización, batería, compra o reserva), SIEMPRE debes incluir al final de tu mensaje la etiqueta de comando:
[CREAR_OPORTUNIDAD: Nombre o Producto | Valor Estimado $ | stage:prospecto]
Ejemplo: [CREAR_OPORTUNIDAD: Cotización Batería UPS Forza 12V | 25 | stage:prospecto]

=== ESTADO ACTUAL DE ATENCIÓN ===
- Estado de la Tienda: ${hours.statusDescription}
- Hora actual del servidor: ${hours.currentTimeStr}

REGLAS DE TRANSFERENCIA A ASESOR:
- Si el cliente solicita hablar con un asesor o humano:
  * Si el Estado Actual de la Tienda indica que está "Abierto": debes terminar amablemente diciendo que lo vas a transferir con un asesor y SIEMPRE incluir la palabra clave exacta "[ESCALAR]" al final de tu respuesta (ej: "Te voy a transferir con uno de nuestros asesores para que puedan ayudarte mejor 😊 [ESCALAR]").
  * Si el Estado Actual de la Tienda indica que está "Cerrado": explica de forma muy amable que actualmente el negocio está cerrado, menciona el horario de atención, indica que le responderá un asesor humano al abrir, y NO incluyes la palabra clave "[ESCALAR]" en tu respuesta final.
`;

  // 3. Generate AI response using Tool Calling
  let aiResponse = '';
  try {
    aiResponse = await aiService.generateResponse(
      userMessage,
      history,
      tenantId,
      conversationId.toString(),
      {
        ...config,
        system_prompt: fullSystemPrompt
      },
      customerPhone
    );
  } catch (error: any) {
    console.error(`[AI Error - Tenant: ${tenantId}]`, error);
    if (hours.isOpen) {
      aiResponse = `Lo siento, en este momento presento un inconveniente técnico y un asesor te atenderá a la brevedad. 😊 [ESCALAR]`;
    } else {
      aiResponse = `Lo siento, en este momento presento un inconveniente técnico. Por favor déjanos tu consulta y un asesor te responderá al iniciar nuestro horario de atención. ¡Gracias por tu paciencia!`;
    }
  }

  // Check for CRM Opportunity Creation command tag or commercial intent
  const oppMatch = aiResponse.match(/\[CREAR_OPORTUNIDAD:\s*([^|\]]+)(?:\|\s*([^|\]]+))?(?:\|\s*([^|\]]+))?\]/i);
  const isCommercialIntent = userMessage.toLowerCase().includes('precio') || 
                             userMessage.toLowerCase().includes('cotiz') || 
                             userMessage.toLowerCase().includes('cuanto cuesta') || 
                             userMessage.toLowerCase().includes('bater') || 
                             userMessage.toLowerCase().includes('ups') || 
                             userMessage.toLowerCase().includes('comprar') || 
                             userMessage.toLowerCase().includes('laptop');

  if ((oppMatch || isCommercialIntent) && config.ai_auto_create_opportunities !== false) {
    try {
      const oppTitle = oppMatch ? oppMatch[1].trim() : `Cotización: ${userMessage.slice(0, 35)}`;
      const oppValue = oppMatch && oppMatch[2] ? parseFloat(oppMatch[2].replace(/[^0-9.]/g, '')) || 50 : 50;
      const oppStage = oppMatch && oppMatch[3] ? oppMatch[3].trim() : 'stage:prospecto';

      // Check if opportunity already exists for this conversation to avoid duplicates
      const existingRes = await configService.query(`SELECT id FROM crm_opportunities WHERE tenant_id = $1 AND conversation_id = $2`, [tenantId, conversationId.toString()]);
      if (existingRes.rows.length === 0) {
        const createdOpp = await controlService.createOpportunity(tenantId, {
          contact_id: customerPhone || conversationId.toString(),
          contact_name: customerPhone ? `Cliente WhatsApp (${customerPhone})` : 'Cliente WhatsApp',
          contact_phone: customerPhone || '',
          conversation_id: conversationId.toString(),
          title: oppTitle,
          value: oppValue,
          currency: 'USD',
          stage: oppStage,
          assigned_agent_name: 'Sofía IA'
        });
        console.log(`[CRM Auto-Opp Created - Tenant: ${tenantId}] ID: ${createdOpp.id} - Title: ${oppTitle} - Value: $${oppValue}`);
        controlService.broadcastSseEvent(tenantId, 'opportunity_created', createdOpp);
      }
    } catch (oppErr: any) {
      console.error(`[Auto-Create Opportunity Error - Tenant: ${tenantId}]`, oppErr.message);
    }
  }

  // Strip opportunity tag before sending to WhatsApp
  aiResponse = aiResponse.replace(/\[CREAR_OPORTUNIDAD:[^\]]+\]/gi, '').trim();

  // Check if AI response triggers human escalation (including Taller context)
  let isTallerEscalation = aiResponse.includes('[ESCALAR_TALLER]');
  let shouldEscalate = aiResponse.includes('[ESCALAR]') || isTallerEscalation;
  let escalationReason = isTallerEscalation 
    ? "IA identificó consulta de servicio técnico / reemplazo interno de batería y transfirió a TALLER."
    : "IA solicitó transferencia mediante palabra clave [ESCALAR] o invocación de herramienta.";

  if (shouldEscalate) {
    // Strip the escalation tags before posting to Chatwoot
    aiResponse = aiResponse.replace('[ESCALAR_TALLER]', '').replace('[ESCALAR]', '').trim();
  }

  // Format AI response with Sofía's transparent signature prefix
  let formattedAiResponse = aiResponse;
  if (!formattedAiResponse.startsWith('🤖')) {
    formattedAiResponse = `🤖 *Sofía (Asistente IA SICSA)*:\n${aiResponse}`;
  }

  // 5. Send message back to Chatwoot
  try {
    const chatwootUrl = `${config.chatwoot_url}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;
    console.log(`[Chatwoot API - Tenant: ${tenantId}] Enviando respuesta de Sofía a: ${chatwootUrl}`);
    
    const chatwootRes = await axios.post(
      chatwootUrl,
      {
        content: formattedAiResponse,
        message_type: 'outgoing'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'api_access_token': config.chatwoot_access_token
        }
      }
    );

    if (chatwootRes.data && chatwootRes.data.id) {
      botSentMessages.add(`${tenantId}:${chatwootRes.data.id}`);
      setTimeout(() => botSentMessages.delete(`${tenantId}:${chatwootRes.data.id}`), 60000);
    }

    // 6. Log the assistant response
    await configService.logMessage(tenantId, conversationId.toString(), 'assistant', aiResponse);

    // 7. Check if we hit consecutive fallbacks from logs (rule-based fallback limit)
    if (!shouldEscalate) {
      const isFallback = aiResponse.toLowerCase().includes('lo siento') || 
                         aiResponse.toLowerCase().includes('no tengo información') ||
                         aiResponse.toLowerCase().includes('no cuento con información');
                         
      if (isFallback) {
        const hitLimit = await checkFallbackEscalation(tenantId, conversationId, config);
        if (hitLimit) {
          shouldEscalate = true;
          escalationReason = `Se alcanzó el número máximo de respuestas fallidas consecutivas (${config.max_fallback_attempts || 3}).`;
          
          // Send notification of fallback escalation to client
          const followUpMessage = "Veo que no he podido responder tus dudas de forma correcta. Te estoy transfiriendo con un asesor humano para ayudarte. 😊";
          const followUpRes = await axios.post(
            chatwootUrl,
            { content: followUpMessage, message_type: 'outgoing' },
            { headers: { 'Content-Type': 'application/json', 'api_access_token': config.chatwoot_access_token } }
          );
          if (followUpRes.data && followUpRes.data.id) {
            botSentMessages.add(`${tenantId}:${followUpRes.data.id}`);
            setTimeout(() => botSentMessages.delete(`${tenantId}:${followUpRes.data.id}`), 60000);
          }
          await configService.logMessage(tenantId, conversationId.toString(), 'assistant', followUpMessage);
        }
      }
    }

    // 8. Perform Escalation in Chatwoot if triggered
    if (shouldEscalate) {
      await escalateConversation(tenantId, conversationId, accountId, config, escalationReason);
    }
  } catch (error: any) {
    console.error(`[Chatwoot API Error - Tenant: ${tenantId}]`, error.response?.data || error.message);
  }
}

// -------------------------------------------------------------
// AUTH APIS
// -------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos.' });
  }

  try {
    const user = await configService.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // Generate JWT
    const token = jwt.sign(
      { email: user.email, tenant_id: user.tenant_id, role: user.role },
      JWT_SECRET,
      { expiresIn: '8d' }
    );

    res.json({ token, tenant_id: user.tenant_id, email: user.email, role: user.role });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = await configService.findUserByEmail(req.user!.email);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.json({
      email: user.email,
      tenant_id: user.tenant_id,
      role: user.role
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Change Password Endpoint (Allows any logged-in user to change their password)
app.post('/api/auth/change-password', authenticateToken, async (req: AuthRequest, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Contraseña actual y nueva contraseña requeridas.' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
  }

  try {
    const email = req.user!.email;
    const user = await configService.findUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const match = await bcrypt.compare(current_password, user.password_hash);
    if (!match) {
      return res.status(400).json({ error: 'La contraseña actual ingresada es incorrecta.' });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await configService.updateUserPassword(email, newHash);

    res.json({ success: true, message: '¡Contraseña actualizada con éxito!' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --- PHASE 2: CONTROL PLANE & CHANNELS & META TEMPLATES APIS ---

// Get all labels for tenant
app.get('/api/control/:tenantId/labels', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const labels = await controlService.getLabels(tenantId);
    res.json(labels);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Create new label in Chatwoot
app.post('/api/control/:tenantId/labels', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') return res.status(403).json({ error: 'Permisos de sólo lectura.' });
  try {
    const tenantId = req.params.tenantId;
    const label = await controlService.createLabel(tenantId, req.body);
    res.json({ success: true, label });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Delete label
app.delete('/api/control/:tenantId/labels/:title', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') return res.status(403).json({ error: 'Permisos de sólo lectura.' });
  try {
    const { tenantId, title } = req.params;
    await controlService.deleteLabel(tenantId, title);
    res.json({ success: true, message: `Etiqueta '${title}' eliminada.` });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Verify Meta Cloud API Credentials
app.post('/api/control/:tenantId/verify-meta', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { phone_number_id, meta_access_token } = req.body;
    const result = await controlService.verifyMetaCredentials(phone_number_id, meta_access_token);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(400).json({ error: e.response?.data?.error?.message || e.message });
  }
});

// Auto-Provision WhatsApp Channel in Chatwoot with 1-Click
app.post('/api/control/:tenantId/auto-provision-whatsapp', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') return res.status(403).json({ error: 'Permisos de sólo lectura.' });
  try {
    const tenantId = req.params.tenantId;
    const result = await controlService.autoProvisionWhatsApp(tenantId, req.body);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.response?.data?.error?.message || e.message });
  }
});

// Get agents from Chatwoot for tenant
app.get('/api/control/:tenantId/agents', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const agents = await controlService.getAgents(tenantId);
    res.json(agents);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get inboxes/channels
app.get('/api/control/:tenantId/inboxes', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const inboxes = await controlService.getInboxes(tenantId);
    res.json(inboxes);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Create new inbox/channel
app.post('/api/control/:tenantId/inboxes', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') return res.status(403).json({ error: 'Permisos de sólo lectura.' });
  try {
    const tenantId = req.params.tenantId;
    const inbox = await controlService.createInbox(tenantId, req.body);
    res.json({ success: true, inbox });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get Meta WhatsApp templates
app.get('/api/control/:tenantId/meta-templates', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const data = await controlService.getMetaTemplates(tenantId);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Send Meta WhatsApp template
app.post('/api/control/:tenantId/meta-templates/send', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') return res.status(403).json({ error: 'Permisos de sólo lectura.' });
  try {
    const tenantId = req.params.tenantId;
    const { conversation_id, template_name, params } = req.body;
    const result = await controlService.sendMetaTemplate(tenantId, conversation_id, template_name, params || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get real-time live analytics BI metrics for tenant
app.get('/api/control/:tenantId/analytics', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const analytics = await controlService.getAnalytics(tenantId);
    res.json(analytics);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get all registered tenants (Superadmin feature)
app.get('/api/control/tenants', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Acceso exclusivo para Super Administradores.' });
  }
  try {
    const tenants = await controlService.getAllTenants();
    res.json(tenants);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Advisor Home Dashboard Data (KPIs + Overdue + Today + Upcoming followups)
app.get('/api/control/:tenantId/advisor-dashboard', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { tenantId } = req.params;
    const data = await controlService.getAdvisorDashboardData(tenantId, req.user?.email);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Log opportunity follow-up note and schedule next touchpoint
app.post('/api/control/:tenantId/opportunities/:id/followup', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') return res.status(403).json({ error: 'Permisos de sólo lectura.' });
  try {
    const { tenantId, id } = req.params;
    const { note, next_followup_date, stage } = req.body;
    if (!note) return res.status(400).json({ error: 'La nota de seguimiento es requerida.' });
    const result = await controlService.logOpportunityFollowup(tenantId, parseInt(id), {
      note,
      next_followup_date,
      stage,
      created_by: req.user?.email || 'Asesor'
    });
    res.json({ success: true, result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Update opportunity details (Edit & Close opportunity)
app.put('/api/control/:tenantId/opportunities/:id', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') return res.status(403).json({ error: 'Permisos de sólo lectura.' });
  try {
    const { tenantId, id } = req.params;
    const result = await controlService.updateOpportunity(tenantId, parseInt(id), req.body);
    res.json({ success: true, result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --- PHASE 3: LIVE CONVERSATIONS & CUSTOM INBOX APIS ---

// Live Real-Time Server-Sent Events (SSE) Stream
app.get('/api/control/:tenantId/events', (req, res) => {
  const tenantId = req.params.tenantId;
  const token = (req.query.token as string) || (req.headers.authorization?.replace('Bearer ', ''));

  if (!token) {
    res.status(401).json({ error: 'Token requerido para canal de eventos SSE' });
    return;
  }

  try {
    jwt.verify(token, JWT_SECRET);
  } catch (err) {
    res.status(403).json({ error: 'Token inválido para canal de eventos SSE' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  controlService.addSseClient(tenantId, res);

  // Send periodic ping every 25 seconds to keep connection alive
  const pingInterval = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (e) {
      clearInterval(pingInterval);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(pingInterval);
  });
});

// List live conversations for tenant
app.get('/api/control/:tenantId/conversations', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const status = (req.query.status as string) || 'all';
    const page = parseInt((req.query.page as string) || '1');
    const conversations = await controlService.getConversations(tenantId, status, page);
    res.json(conversations);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Broadcast agent typing lock event via SSE
app.post('/api/control/:tenantId/conversations/:id/typing-lock', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { tenantId, id } = req.params;
    const { agent_name, agent_email } = req.body;
    controlService.broadcastSseEvent(tenantId, 'agent_typing_lock', {
      conversation_id: id,
      agent_name: agent_name || 'Un asesor',
      agent_email: agent_email || '',
      timestamp: Date.now()
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Unlock supervisor lock on a conversation (Supervisor / Admin Only)
app.post('/api/control/:tenantId/conversations/:id/unlock-supervisor', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { tenantId, id } = req.params;
    const userRole = req.user?.role || '';
    const isAdminOrSupervisor = ['superadmin', 'admin', 'supervisor'].includes(userRole);
    if (!isAdminOrSupervisor) {
      return res.status(403).json({ error: 'Solo un supervisor o administrador puede autorizar el desbloqueo de esta conversación.' });
    }

    await controlService.removeLabelFromConversation(tenantId, id, 'supervisor-lock');
    controlService.broadcastSseEvent(tenantId, 'conversation_updated', {
      id: parseInt(id),
      conversation: { id: parseInt(id), labels: [] }
    });

    res.json({ success: true, message: 'Conversación autorizada y desbloqueada para el vendedor.' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get messages for a specific conversation
app.get('/api/control/:tenantId/conversations/:id/messages', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { tenantId, id } = req.params;
    const before = req.query.before ? String(req.query.before) : undefined;
    const messages = await controlService.getConversationMessages(tenantId, id, before);
    res.json(messages);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get assignment history timeline for a conversation
app.get('/api/control/:tenantId/conversations/:id/assignment-history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { tenantId, id } = req.params;
    const history = await controlService.getAssignmentHistory(tenantId, id);
    res.json(history);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get quotes audit report (supports JSON & CSV download)
app.get('/api/control/:tenantId/reports/quotes-audit', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { tenantId } = req.params;
    const format = req.query.format as string;
    const report = await controlService.getQuotesAuditReport(tenantId);

    if (format === 'csv') {
      let csv = 'ID,Cliente,Telefono,Cotizacion,Monto,Moneda,Etapa,Asesor_Asignado,Fecha_Creacion\n';
      report.forEach((r: any) => {
        csv += `"${r.id}","${(r.contact_name||'').replace(/"/g, '""')}","${r.contact_phone||''}","${(r.title||'').replace(/"/g, '""')}",${r.value||0},"${r.currency||'USD'}","${r.stage||''}","${(r.assigned_agent_name||'Sin Asignar').replace(/"/g, '""')}","${new Date(r.created_at).toLocaleString()}"\n`;
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="auditoria_cotizaciones.csv"');
      return res.send(csv);
    }

    res.json(report);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Send outgoing response or private note (supports text and file attachments)
app.post('/api/control/:tenantId/conversations/:id/messages', authenticateToken, upload.single('file'), async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') return res.status(403).json({ error: 'Permisos de sólo lectura.' });
  try {
    const { tenantId, id } = req.params;
    const { content, is_private } = req.body;
    const file = req.file;

    if (!content && !file) {
      return res.status(400).json({ error: 'Debes ingresar un mensaje o adjuntar un archivo.' });
    }
    
    const isPrivate = is_private === 'true' || is_private === true;
    const message = await controlService.sendMessage(tenantId, id, content || '', isPrivate, file);

    // Auto-assign to logged-in advisor ONLY IF tenant has auto_assign_on_reply enabled
    const config = await configService.getConfig(tenantId);
    if (!isPrivate && req.user?.email && config.auto_assign_on_reply === true) {
      controlService.autoAssignBySenderEmail(tenantId, id, req.user.email).catch(e => console.error('[Auto Assign Error]', e.message));
    }

    // Broadcast SSE event immediately
    controlService.broadcastSseEvent(tenantId, 'message_created', { conversation_id: id, message });

    res.json({ success: true, message });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Toggle conversation status (open/pending/resolved/snoozed)
app.post('/api/control/:tenantId/conversations/:id/toggle_status', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') return res.status(403).json({ error: 'Permisos de sólo lectura.' });
  try {
    const { tenantId, id } = req.params;
    const { status } = req.body;
    const result = await controlService.toggleStatus(tenantId, id, status);

    controlService.broadcastSseEvent(tenantId, 'conversation_updated', { conversation_id: id, status });

    res.json({ success: true, result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Update conversation CRM stage label
app.post('/api/control/:tenantId/conversations/:id/labels', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') return res.status(403).json({ error: 'Permisos de sólo lectura.' });
  try {
    const { tenantId, id } = req.params;
    const { labels } = req.body;
    const result = await controlService.toggleLabel(tenantId, id, labels || []);
    res.json({ success: true, result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Mark conversation as read (update_last_seen)
app.post('/api/control/:tenantId/conversations/:id/read', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { tenantId, id } = req.params;
    const result = await controlService.markConversationAsRead(tenantId, id);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Assign conversation to advisor agent or team (Restricted to superadmin, admin, supervisor)
app.post('/api/control/:tenantId/conversations/:id/assign', authenticateToken, async (req: AuthRequest, res) => {
  const requesterRole = req.user?.role || 'asesor';
  const allowedRoles = ['superadmin', 'admin', 'supervisor'];
  if (!allowedRoles.includes(requesterRole)) {
    return res.status(403).json({ error: 'Permisos insuficientes: Sólo Administradores, Supervisores y Mercadeo pueden asignar vendedores.' });
  }
  try {
    const { tenantId, id } = req.params;
    const { assignee_id, team_id, assignee_email } = req.body;
    const result = await controlService.assignConversation(
      tenantId, 
      id, 
      assignee_id !== undefined ? assignee_id : null, 
      team_id !== undefined ? team_id : null,
      assignee_email || null
    );

    controlService.broadcastSseEvent(tenantId, 'conversation_updated', { conversation_id: id, assignee_id, assignee_email, team_id });
    res.json({ success: true, result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Delete or archive conversation
app.delete('/api/control/:tenantId/conversations/:id', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') return res.status(403).json({ error: 'Permisos de sólo lectura.' });
  try {
    const { tenantId, id } = req.params;
    const result = await controlService.deleteConversation(tenantId, id);
    controlService.broadcastSseEvent(tenantId, 'conversation_updated', { conversation_id: id });
    res.json({ success: true, result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Emergency Out-of-Office / Power Outage Global AI Activation (Admins Only)
app.post('/api/control/:tenantId/activate-global-ai', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Acceso denegado: Esta opción es exclusiva para los administradores del tenant.' });
  }
  try {
    const { tenantId } = req.params;
    const result = await controlService.activateGlobalAI(tenantId);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/control/:tenantId/deactivate-global-ai', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Acceso denegado: Esta opción es exclusiva para los administradores del tenant.' });
  }
  try {
    const { tenantId } = req.params;
    const result = await controlService.deactivateGlobalAI(tenantId);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/control/:tenantId/emergency-status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { tenantId } = req.params;
    const config = await configService.getConfig(tenantId);
    res.json({ emergency_ai_mode: !!config.emergency_ai_mode });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get contacts list for directory
app.get('/api/control/:tenantId/contacts', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { tenantId } = req.params;
    const page = parseInt(req.query.page as string || '1');
    const result = await controlService.getContacts(tenantId, page);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Update contact and custom attributes
app.put('/api/control/:tenantId/contacts/:id', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') return res.status(403).json({ error: 'Permisos de sólo lectura.' });
  try {
    const { tenantId, id } = req.params;
    const result = await controlService.updateContact(tenantId, parseInt(id), req.body);
    res.json({ success: true, result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Saved Contact Lists (Listas de Seguimiento)
app.get('/api/control/:tenantId/contact-lists', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { tenantId } = req.params;
    const lists = await controlService.getSavedLists(tenantId);
    res.json(lists);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/control/:tenantId/contact-lists', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') return res.status(403).json({ error: 'Permisos de sólo lectura.' });
  try {
    const { tenantId } = req.params;
    const { name, filter_query, contact_ids } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre de la lista es requerido.' });
    const list = await controlService.createSavedList(tenantId, name, filter_query || '', contact_ids || []);
    res.json({ success: true, list });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/control/:tenantId/contact-lists/:id', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') return res.status(403).json({ error: 'Permisos de sólo lectura.' });
  try {
    const { tenantId, id } = req.params;
    await controlService.deleteSavedList(tenantId, parseInt(id));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Create new conversation
app.post('/api/control/:tenantId/conversations/create', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') return res.status(403).json({ error: 'Permisos de sólo lectura.' });
  try {
    const { tenantId } = req.params;
    const { contact_id, inbox_id, message } = req.body;
    const result = await controlService.createConversation(tenantId, contact_id, inbox_id, message);
    res.json({ success: true, result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --- PHASE 4: AGENT PAUSES & AVAILABILITY STATUSES ---

// Update current agent status (online/busy/lunch/training/break)
app.post('/api/agent-status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userEmail = req.user!.email;
    const tenantId = req.user!.tenant_id;
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Estado no especificado.' });

    await configService.setAgentStatus(tenantId, userEmail, status);
    res.json({ success: true, status, user_email: userEmail });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get agent status summary for tenant
app.get('/api/agent-status/summary', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenant_id;
    const summary = await configService.getAgentStatusSummary(tenantId);
    res.json(summary);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Admin endpoint to register new tenants (restringido)
app.post('/api/auth/register-tenant', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Permisos insuficientes. Solo superadministradores.' });
  }

  const { tenant_id, tenant_name, email, password, role } = req.body;

  if (!tenant_id || !tenant_name || !email || !password) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (tenant_id, tenant_name, email, password).' });
  }

  try {
    await configService.createTenant(tenant_id, tenant_name);
    const user = await configService.registerUser(tenant_id, email, password, role || 'admin');
    res.json({ success: true, tenant_id, user: user.email });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Admin endpoint to list all tenants and users (restringido)
app.get('/api/admin/tenants', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Permisos insuficientes. Solo superadministradores.' });
  }

  try {
    const list = await configService.getAllTenantsAndUsers();
    res.json(list);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// User Management API
app.get('/api/users', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const role = req.user!.role;
    const tenantId = req.user!.tenant_id;
    if (role === 'superadmin') {
      const list = await configService.getUsers();
      res.json(list);
    } else {
      const list = await configService.getUsers(tenantId);
      res.json(list);
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/users', authenticateToken, async (req: AuthRequest, res) => {
  const role = req.user!.role;
  const requesterTenantId = req.user!.tenant_id;

  if (role === 'readonly') {
    return res.status(403).json({ error: 'Permisos de sólo lectura. No puedes crear usuarios.' });
  }

  const { tenant_id, email, password, role: targetRole } = req.body;

  if (!email || !password || !targetRole) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (email, password, role).' });
  }

  // Restrict target tenant based on role
  const targetTenantId = role === 'superadmin' ? (tenant_id || requesterTenantId) : requesterTenantId;

  // Restrict target role based on role
  if (role === 'admin' && targetRole === 'superadmin') {
    return res.status(403).json({ error: 'Un administrador de tenant no puede crear superadministradores.' });
  }

  try {
    const user = await configService.registerUser(targetTenantId, email, password, targetRole);
    res.json({ success: true, user: { email: user.email, role: user.role, tenant_id: user.tenant_id } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req: AuthRequest, res) => {
  const role = req.user!.role;
  const tenantId = req.user!.tenant_id;

  if (role === 'readonly') {
    return res.status(403).json({ error: 'Permisos de sólo lectura. No puedes eliminar usuarios.' });
  }

  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

    // Check if deleting self
    const allUsers = await configService.getUsers();
    const targetUser = allUsers.find(u => u.id === id);
    if (!targetUser) return res.status(404).json({ error: 'Usuario no encontrado.' });

    if (req.user!.email === targetUser.email) {
      return res.status(400).json({ error: 'No puedes eliminarte a ti mismo.' });
    }

    if (role === 'superadmin') {
      await configService.deleteUser(id);
      res.json({ success: true });
    } else if (role === 'admin') {
      // Admin can only delete users of their own tenant
      if (targetUser.tenant_id !== tenantId) {
        return res.status(403).json({ error: 'No puedes eliminar un usuario de otro tenant.' });
      }
      await configService.deleteUser(id);
      res.json({ success: true });
    } else {
      res.status(403).json({ error: 'Permisos insuficientes.' });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Admin token copier endpoint (signed tokens list)
app.get('/api/admin/users-tokens', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Permisos insuficientes. Solo superadministradores.' });
  }

  try {
    const list = await configService.getUsers();
    const result = list.map(u => {
      const token = jwt.sign(
        { email: u.email, tenant_id: u.tenant_id, role: u.role },
        JWT_SECRET,
        { expiresIn: '30d' }
      );
      return {
        ...u,
        token
      };
    });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// -------------------------------------------------------------
// CONFIG & KNOWLEDGE APIS (Protected by JWT)
// -------------------------------------------------------------
app.get('/api/config', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenant_id;
    const config = await configService.getConfig(tenantId);
    
    res.json({
      ...config,
      gemini_api_key: config.gemini_api_key ? '***' : '',
      deepseek_api_key: config.deepseek_api_key ? '***' : ''
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/config', authenticateToken, async (req: AuthRequest, res) => {
  const tenantId = req.user!.tenant_id;
  if (req.user?.role === 'readonly') {
    return res.status(403).json({ error: 'Permisos de sólo lectura. No puedes modificar la configuración.' });
  }
  try {
    console.log(`[API Config - POST] Recibido intento de guardar para Tenant: ${tenantId}`);
    const currentConfig = await configService.getConfig(tenantId);
    const data = req.body;
    
    console.log('[API Config - POST] Active provider recibido:', data.active_provider);

    if (data.gemini_api_key === '***') {
      data.gemini_api_key = currentConfig.gemini_api_key;
    }
    if (data.deepseek_api_key === '***') {
      data.deepseek_api_key = currentConfig.deepseek_api_key;
    }

    const updated = await configService.updateConfig(tenantId, data);
    console.log(`[API Config - POST] Configuración guardada con éxito para Tenant: ${tenantId}. Provider activo en DB: ${updated.active_provider}`);

    res.json({
      ...updated,
      gemini_api_key: updated.gemini_api_key ? '***' : '',
      deepseek_api_key: updated.deepseek_api_key ? '***' : ''
    });
  } catch (e: any) {
    console.error(`[API Config Error - Tenant: ${tenantId}]`, e);
    res.status(500).json({ error: e.message });
  }
});

// Knowledge Base endpoints
app.get('/api/knowledge', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenant_id;
    const kb = await configService.getKnowledgeBase(tenantId);
    res.json(kb);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/knowledge', authenticateToken, async (req: AuthRequest, res) => {
  const tenantId = req.user!.tenant_id;
  if (req.user?.role === 'readonly') {
    return res.status(403).json({ error: 'Permisos de sólo lectura. No puedes modificar la base de conocimiento.' });
  }
  try {
    const data = req.body;
    const updated = await configService.updateKnowledgeBase(tenantId, data);
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// -------------------------------------------------------------
// PRODUCT SYNC & GET APIS (Protected by JWT)
// -------------------------------------------------------------
app.get('/api/products', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenant_id;
    const products = await configService.getProducts(tenantId, 10000);
    res.json(products);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/products/sync', authenticateToken, async (req: AuthRequest, res) => {
  const tenantId = req.user!.tenant_id;
  if (req.user?.role === 'readonly') {
    return res.status(403).json({ error: 'Permisos de sólo lectura. No puedes sincronizar productos.' });
  }
  try {
    const products = req.body;
    const mode = req.query.mode === 'incremental' ? 'incremental' : 'full';

    if (!Array.isArray(products)) {
      return res.status(400).json({ error: 'El cuerpo de la petición debe ser un arreglo de productos.' });
    }

    await configService.syncProducts(tenantId, products, mode);
    res.json({ success: true, count: products.length, mode });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/logs', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenant_id;
    const logs = await configService.getLogs(tenantId, 50);
    res.json(logs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET list of distinct conversations
app.get('/api/logs/conversations', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenant_id;
    const list = await configService.getDistinctConversations(tenantId);
    res.json(list);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET conversation log messages by conversation id
app.get('/api/logs/conversation/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenant_id;
    const conversationId = req.params.id;
    const logs = await configService.getConversationLogs(tenantId, conversationId);
    res.json(logs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET top product analytics
app.get('/api/analytics/products', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenant_id;
    const stats = await configService.getProductAnalytics(tenantId);
    res.json(stats);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET lost sales list for current tenant
app.get('/api/analytics/lost-sales', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenant_id;
    const list = await configService.getLostSales(tenantId);
    res.json(list);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE lost sale by ID
app.delete('/api/analytics/lost-sales/:id', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') {
    return res.status(403).json({ error: 'Permisos de sólo lectura. No puedes eliminar registros de venta perdida.' });
  }
  try {
    const tenantId = req.user!.tenant_id;
    const id = parseInt(req.params.id);
    await configService.deleteLostSale(tenantId, id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// -------------------------------------------------------------
// APPOINTMENTS APIS (Protected by JWT)
// -------------------------------------------------------------
app.get('/api/appointments', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenant_id;
    const list = await configService.getAppointments(tenantId);
    res.json(list);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/appointments', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') {
    return res.status(403).json({ error: 'Permisos de sólo lectura. No puedes agendar citas.' });
  }
  const { customer_name, customer_phone, appointment_date, appointment_time, service } = req.body;
  if (!customer_name || !customer_phone || !appointment_date || !appointment_time) {
    return res.status(400).json({ error: 'Faltan campos requeridos.' });
  }
  try {
    const tenantId = req.user!.tenant_id;
    const appt = await configService.createAppointment(
      tenantId,
      customer_name,
      customer_phone,
      appointment_date,
      appointment_time,
      service
    );
    res.json(appt);
  } catch (e: any) {
    res.status(400).json({ error: 'El horario seleccionado ya está ocupado por otra cita.' });
  }
});

app.delete('/api/appointments/:id', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') {
    return res.status(403).json({ error: 'Permisos de sólo lectura. No puedes cancelar citas.' });
  }
  try {
    const tenantId = req.user!.tenant_id;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });
    await configService.deleteAppointment(tenantId, id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// -------------------------------------------------------------
// CRM OPPORTUNITIES APIS (Protected by JWT)
// -------------------------------------------------------------
app.get('/api/control/:tenantId/opportunities', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { tenantId } = req.params;
    const { contact_id, conversation_id, stage, pipeline_type } = req.query;
    const list = await controlService.getOpportunities(
      tenantId,
      contact_id ? String(contact_id) : undefined,
      conversation_id ? String(conversation_id) : undefined,
      stage ? String(stage) : undefined,
      pipeline_type ? String(pipeline_type) : undefined
    );
    res.json(list);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// -------------------------------------------------------------
// B2B COMPANIES & CONTACTS APIS (Protected by JWT)
// -------------------------------------------------------------
app.get('/api/control/:tenantId/companies', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { tenantId } = req.params;
    const { search } = req.query;
    const list = await controlService.getCompanies(tenantId, search ? String(search) : undefined);
    res.json(list);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/control/:tenantId/companies/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { tenantId, id } = req.params;
    const company = await controlService.getCompany(tenantId, parseInt(id));
    if (!company) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json(company);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/control/:tenantId/companies', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') {
    return res.status(403).json({ error: 'Permisos de sólo lectura.' });
  }
  try {
    const { tenantId } = req.params;
    const company = await controlService.createCompany(tenantId, req.body);
    res.json(company);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/control/:tenantId/companies/:id', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') {
    return res.status(403).json({ error: 'Permisos de sólo lectura.' });
  }
  try {
    const { tenantId, id } = req.params;
    const company = await controlService.updateCompany(tenantId, parseInt(id), req.body);
    res.json(company);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/control/:tenantId/companies/:id', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') {
    return res.status(403).json({ error: 'Permisos de sólo lectura.' });
  }
  try {
    const { tenantId, id } = req.params;
    await controlService.deleteCompany(tenantId, parseInt(id));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Company Contacts CRUD (1 Company -> N Contacts)
app.get('/api/control/:tenantId/companies/:companyId/contacts', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { tenantId, companyId } = req.params;
    const contacts = await controlService.getCompanyContacts(tenantId, parseInt(companyId));
    res.json(contacts);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/control/:tenantId/companies/:companyId/contacts', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') {
    return res.status(403).json({ error: 'Permisos de sólo lectura.' });
  }
  try {
    const { tenantId, companyId } = req.params;
    const contact = await controlService.createCompanyContact(tenantId, parseInt(companyId), req.body);
    res.json(contact);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/control/:tenantId/companies/:companyId/contacts/:contactId', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') {
    return res.status(403).json({ error: 'Permisos de sólo lectura.' });
  }
  try {
    const { tenantId, companyId, contactId } = req.params;
    const contact = await controlService.updateCompanyContact(tenantId, parseInt(companyId), parseInt(contactId), req.body);
    res.json(contact);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/control/:tenantId/companies/:companyId/contacts/:contactId', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') {
    return res.status(403).json({ error: 'Permisos de sólo lectura.' });
  }
  try {
    const { tenantId, companyId, contactId } = req.params;
    await controlService.deleteCompanyContact(tenantId, parseInt(companyId), parseInt(contactId));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Outbound WhatsApp Instant Chat Initiation
app.post('/api/control/:tenantId/outbound-chat', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') {
    return res.status(403).json({ error: 'Permisos de sólo lectura.' });
  }
  try {
    const { tenantId } = req.params;
    const result = await controlService.initiateOutboundWhatsApp(tenantId, req.body);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/control/:tenantId/opportunities', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') {
    return res.status(403).json({ error: 'Permisos de sólo lectura.' });
  }
  try {
    const { tenantId } = req.params;
    const opp = await controlService.createOpportunity(tenantId, req.body);
    res.json(opp);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/control/:tenantId/opportunities/:id', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') {
    return res.status(403).json({ error: 'Permisos de sólo lectura.' });
  }
  try {
    const { tenantId, id } = req.params;
    const opp = await controlService.updateOpportunity(tenantId, parseInt(id), req.body);
    res.json(opp);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/control/:tenantId/opportunities/:id', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') {
    return res.status(403).json({ error: 'Permisos de sólo lectura.' });
  }
  try {
    const { tenantId, id } = req.params;
    await controlService.deleteOpportunity(tenantId, parseInt(id));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/control/:tenantId/opportunities/:id/activities', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { tenantId, id } = req.params;
    const activities = await controlService.getOpportunityActivities(tenantId, parseInt(id));
    res.json(activities);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/control/:tenantId/opportunities/:id/activities', authenticateToken, async (req: AuthRequest, res) => {
  if (req.user?.role === 'readonly') {
    return res.status(403).json({ error: 'Permisos de sólo lectura.' });
  }
  try {
    const { tenantId, id } = req.params;
    const activity = await controlService.addOpportunityActivity(tenantId, parseInt(id), {
      ...req.body,
      created_by: req.user?.email || 'Usuario'
    });
    res.json(activity);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// -------------------------------------------------------------
// INITIAL SEED DATA & STARTUP
// -------------------------------------------------------------
async function seedDefaultAdmin() {
  try {
    await configService.init();

    // Ensure erick and admin are superadmins in DB
    const dbPool = configService as any;
    if (dbPool.pool) {
      await dbPool.pool.query(
        "UPDATE users SET role = 'superadmin' WHERE email IN ($1, $2)",
        ['admin@platform.local', 'erick.torres@eitserv.tech']
      );
    }
    
    // Check if admin tenant exists
    const adminTenant = await configService.getTenant('admin');
    if (!adminTenant) {
      console.log('[Seed] Creando tenant de administración global "admin"...');
      await configService.createTenant('admin', 'Administrador Global');
      
      const adminEmail = 'admin@platform.local';
      const adminPass = 'admin123!';
      await configService.registerUser('admin', adminEmail, adminPass, 'superadmin');
      console.log(`[Seed] Administrador global creado: ${adminEmail} / ${adminPass}`);
    }

    // Check if sicsa tenant exists
    const sicsaTenant = await configService.getTenant('sicsa');
    if (!sicsaTenant) {
      console.log('[Seed] Creando tenant "sicsa" para pruebas (SICSA)...');
      await configService.createTenant('sicsa', 'SICSA Nicaragua');
      
      const sicsaEmail = 'erick.torres@eitserv.tech';
      const sicsaPass = 'AdminRoot510!';
      await configService.registerUser('sicsa', sicsaEmail, sicsaPass, 'superadmin');
      console.log(`[Seed] Usuario de prueba creado: ${sicsaEmail} / ${sicsaPass}`);
      
      // Update system prompt to Sofia's prompt
      const sofiaPrompt = `Instrucciones para la interacción:

1. Saludo inicial:
Al iniciar la conversación, Sofía debe saludar al cliente de manera amigable y presentarse:
"¡Hola! Soy Sofía, la asistente virtual de SICSA 😊 ¿En qué puedo ayudarte hoy? ¿Tienes en mente algún tipo de producto o una necesidad específica?"

2. Identificación de necesidades:
Si el cliente menciona un producto de forma general, Sofía debe solicitar más detalles para entender mejor sus necesidades:
"¡Genial! Para ayudarte mejor, ¿podrías decirme qué tipo de producto estás buscando o cuál es tu necesidad específica?"

3. Recomendación de productos:
Una vez que entiendas claramente lo que el cliente necesita, busca en el catálogo indexado de SICSA y muestra hasta 3 productos reales que coincidan con esa necesidad. Cuando encuentres productos válidos con nombre, precio y enlace, muéstralos tal como están en la base. Prioriza resultados con los 3 campos completos. Si hay más de uno, muestra hasta 3.

Cada producto debe incluir, sin excepción:
- Nombre completo y exacto del producto
- Precio real en córdobas (C$), seguido de "+ IVA"
- Enlace directo al producto en el sitio de SICSA

Formato obligatorio para mostrar cada producto:
[Nombre del producto] – C$[precio real] + IVA
👉 [enlace directo al producto]

No se permite:
- Mostrar solo 1 producto si hay más disponibles
- Dejar campos como [precio] o [enlace] sin rellenar
- Usar frases generales como “Te recomiendo esta laptop…”
- Usar resúmenes antes o después de las fichas. Solo las fichas correspondientes, nada más.

4. Manejo de preguntas adicionales:
Sofía debe responder todas las preguntas del cliente de manera precisa y basada únicamente en la información real disponible en el catálogo de SICSA.
Si el cliente solicita un producto específico y no se encuentra en el catálogo, Sofía debe informar al cliente y proporcionar un enlace a la categoría relacionada para que explore otras opciones.

5. Limitaciones y transferencia a un asesor:
Si Sofía no puede responder una pregunta debido a la falta de información en el catálogo, debe admitirlo de manera transparente y ofrecer asistencia adicional:
"Lo siento, no tengo información sobre eso en este momento. ¿Hay algo más en lo que pueda ayudarte?"

Si el cliente solicita hablar con un asesor humano, Sofía debe facilitar la transferencia (el sistema se encargará de realizarla).

Reglas y directrices:
- Sofía debe utilizar siempre información real y actualizada del catálogo de SICSA.
- Nunca generes enlaces basados en el nombre del producto. Usa únicamente los enlaces reales que encuentres en la base indexada. Si no hay enlace, no muestres el producto.
- Nunca debe usar texto ficticio ni marcadores de posición.
- No debe mostrar enlaces genéricos como "https://www.sicsa.com".
- No uses los productos de ejemplo en tu respuesta final. Siempre busca productos reales disponibles actualmente.`;

      await configService.updateConfig('sicsa', {
        system_prompt: sofiaPrompt,
        chatwoot_url: 'https://n8n-chatwoot.kwu5pq.easypanel.host',
        chatwoot_account_id: 2,
        chatwoot_access_token: 'GuFMXhQH6kxBtNnAMEZNBxsf',
        chatwoot_website_token: 'h2ynGT9Wr5uVgaSCR3DxdUdV'
      });

      // Update knowledge base for SICSA
      await configService.updateKnowledgeBase('sicsa', {
        branches: 'Managua: Los Robles, de donde fue el Pool 8, 50 metros abajo. Managua, Nicaragua.',
        bank_accounts: 'Para transferencias bancarias nacionales o depósitos, por favor solicita los números de cuenta BAC o BANPRO directos con un asesor.',
        faqs: 'Preguntas Frecuentes:\n- ¿Aceptan tarjetas?: Sí, aceptamos tarjetas Visa, MasterCard y American Express.\n- ¿Hacen envíos?: Sí, hacemos envíos a todo el territorio nacional.\n- Página web oficial: https://sicsa.com.ni',
        timezone: 'America/Managua',
        mon_fri_start: '08:00',
        mon_fri_end: '17:30',
        sat_start: '09:00',
        sat_end: '12:30',
        sun_enabled: 0
      });
      
      console.log('[Seed] Configuración inicial de Sofia y Base de Conocimiento de SICSA pre-cargada para el tenant "sicsa".');
    }
  } catch (err) {
    console.error('[Seed Error] Error ejecutando la inicialización:', err);
  }
}

// --- CRM TEAMS ENDPOINTS ---
app.get('/api/control/:tenantId/teams', authenticateToken, async (req: any, res) => {
  try {
    const teams = await controlService.getTeams(req.params.tenantId);
    res.json(teams);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/control/:tenantId/teams', authenticateToken, async (req: any, res) => {
  try {
    const team = await controlService.createTeam(req.params.tenantId, req.body);
    res.status(201).json(team);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/control/:tenantId/teams/:id', authenticateToken, async (req: any, res) => {
  try {
    const team = await controlService.updateTeam(req.params.tenantId, parseInt(req.params.id), req.body);
    res.json(team);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/control/:tenantId/teams/:id', authenticateToken, async (req: any, res) => {
  try {
    const deleted = await controlService.deleteTeam(req.params.tenantId, parseInt(req.params.id));
    res.json(deleted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- CRM TEAM MEMBERS ENDPOINTS ---
app.get('/api/control/:tenantId/teams/:teamId/members', authenticateToken, async (req: any, res) => {
  try {
    const members = await controlService.getTeamMembers(req.params.tenantId, parseInt(req.params.teamId));
    res.json(members);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/control/:tenantId/teams/:teamId/members', authenticateToken, async (req: any, res) => {
  try {
    const member = await controlService.addTeamMember(req.params.tenantId, parseInt(req.params.teamId), req.body);
    res.status(201).json(member);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/control/:tenantId/teams/:teamId/members/:memberId', authenticateToken, async (req: any, res) => {
  try {
    const deleted = await controlService.removeTeamMember(req.params.tenantId, parseInt(req.params.teamId), parseInt(req.params.memberId));
    res.json(deleted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.resolve(frontendDistPath, 'index.html'));
});

app.listen(PORT, async () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  await seedDefaultAdmin();
});
