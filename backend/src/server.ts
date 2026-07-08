import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { configService, AgentConfig, KnowledgeBase } from './services/config.service.js';
import { redisService } from './services/redis.service.js';
import { aiService, ChatMessage } from './services/ai.service.js';

dotenv.config();

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
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit', minute: '2-digit', hour12: false,
      weekday: 'short'
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
      const startVal = parseTime(kb.mon_fri_start || '08:00');
      const endVal = parseTime(kb.mon_fri_end || '17:30');
      isOpen = currentTimeVal >= startVal && currentTimeVal <= endVal;
      ruleText = `Lunes a Viernes de ${kb.mon_fri_start} a ${kb.mon_fri_end}`;
    } else if (dayOfWeek === 6) {
      // Sat
      const startVal = parseTime(kb.sat_start || '09:00');
      const endVal = parseTime(kb.sat_end || '12:30');
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
app.post('/api/webhook/:tenantId?', async (req, res) => {
  const tenantId = req.params.tenantId || 'demo';
  const payload = req.body;

  console.log(`[Webhook] Recibido evento para Tenant: ${tenantId}`);

  try {
    const tenant = await configService.getTenant(tenantId);
    if (!tenant) {
      console.warn(`[Webhook Error] Tenant '${tenantId}' no registrado en la plataforma.`);
      return res.status(404).json({ error: 'Tenant no encontrado.' });
    }

    if (
      payload.event === 'message_created' &&
      payload.message_type === 'incoming' &&
      payload.conversation &&
      payload.content
    ) {
      const conversationId = payload.conversation.id;
      const accountId = payload.account.id;
      const userMessage = payload.content;

      console.log(`[Webhook] Mensaje recibido en conv ${conversationId} de '${tenantId}': "${userMessage}"`);

      // Process message asynchronously
      handleIncomingMessage(tenantId, conversationId, accountId, userMessage).catch((err) => {
        console.error(`[Webhook Error] Error procesando respuesta para ${tenantId}:`, err);
      });
    }
  } catch (err) {
    console.error(`[Webhook System Error]`, err);
  }

  res.status(200).json({ status: 'ok' });
});

// Helper function to process the message and respond to Chatwoot
async function handleIncomingMessage(tenantId: string, conversationId: number, accountId: number, userMessage: string) {
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
  const dbLogs = await configService.getLogs(tenantId, 10);
  const history: ChatMessage[] = dbLogs
    .filter(log => log.conversation_id === conversationId.toString())
    .reverse()
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
${config.system_prompt}

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
      }
    );
  } catch (error: any) {
    console.error(`[AI Error - Tenant: ${tenantId}]`, error);
    if (hours.isOpen) {
      aiResponse = `Lo siento, en este momento presento un inconveniente técnico y un asesor te atenderá a la brevedad. 😊 [ESCALAR]`;
    } else {
      aiResponse = `Lo siento, en este momento presento un inconveniente técnico. Por favor déjanos tu consulta y un asesor te responderá al iniciar nuestro horario de atención. ¡Gracias por tu paciencia!`;
    }
  }

  // Check if AI response triggers human escalation
  const shouldEscalate = aiResponse.includes('[ESCALAR]');
  if (shouldEscalate) {
    // Strip the escalation tag before posting to Chatwoot
    aiResponse = aiResponse.replace('[ESCALAR]', '').trim();
  }

  // 5. Send message back to Chatwoot
  try {
    const chatwootUrl = `${config.chatwoot_url}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;
    console.log(`[Chatwoot API - Tenant: ${tenantId}] Enviando respuesta a: ${chatwootUrl}`);
    
    await axios.post(
      chatwootUrl,
      {
        content: aiResponse,
        message_type: 'outgoing'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'api_access_token': config.chatwoot_access_token
        }
      }
    );

    // 6. Log the assistant response
    await configService.logMessage(tenantId, conversationId.toString(), 'assistant', aiResponse);

    // 7. Perform Escalation in Chatwoot if triggered
    if (shouldEscalate) {
      console.log(`[Escalation - Tenant: ${tenantId}] Transfiriendo conversación ${conversationId} a un humano (estado: open)...`);
      const convUrl = `${config.chatwoot_url}/api/v1/accounts/${accountId}/conversations/${conversationId}`;
      await axios.put(
        convUrl,
        {
          status: 'open' // Chatwoot expects 'open', 'resolved', 'pending', or 'snoozed'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'api_access_token': config.chatwoot_access_token
          }
        }
      ).catch(e => {
        console.error(`[Escalation Error - Tenant: ${tenantId}] Failed to update conversation status:`, e.response?.data || e.message);
      });
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
      { expiresIn: '24h' }
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
    } else if (role === 'admin' || role === 'readonly') {
      const list = await configService.getUsers(tenantId);
      res.json(list);
    } else {
      res.status(403).json({ error: 'Permisos insuficientes.' });
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

    if (!Array.isArray(products)) {
      return res.status(400).json({ error: 'El cuerpo de la petición debe ser un arreglo de productos.' });
    }

    await configService.syncProducts(tenantId, products);
    res.json({ success: true, count: products.length });
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

app.get('*', (req, res) => {
  res.sendFile(path.resolve(frontendDistPath, 'index.html'));
});

app.listen(PORT, async () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  await seedDefaultAdmin();
});
