import pg from 'pg';
import bcrypt from 'bcrypt';

const { Pool } = pg;

export interface AgentConfig {
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
  redis_enabled: number; // 1 = enabled (Redis), 0 = disabled (use local Postgres products)
  escalation_keywords?: string;
  max_fallback_attempts?: number;
  escalation_instructions?: string;
  allow_ai_escalation?: boolean;
  escalation_team_id?: number;
}

export interface User {
  id: number;
  tenant_id: string;
  email: string;
  password_hash: string;
  role: 'superadmin' | 'admin' | 'readonly';
}

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  description: string;
  url: string;
  category?: string;
  brand?: string;
}

export interface KnowledgeBase {
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

class ConfigService {
  private pool: pg.Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    this.pool = new Pool(connectionString ? { connectionString } : {});
  }

  async init() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // 1. Tenants table
      await client.query(`
        CREATE TABLE IF NOT EXISTS tenants (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 2. Users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(20) DEFAULT 'admin',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'admin'`);

      // 3. Tenant configurations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS tenant_configs (
          tenant_id VARCHAR(50) PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
          active_provider VARCHAR(20) DEFAULT 'gemini',
          gemini_api_key TEXT DEFAULT '',
          deepseek_api_key TEXT DEFAULT '',
          system_prompt TEXT DEFAULT 'Eres un asistente de IA para nuestro negocio...',
          chatwoot_url TEXT DEFAULT '',
          chatwoot_access_token TEXT DEFAULT '',
          chatwoot_account_id INTEGER DEFAULT 1,
          chatwoot_website_token TEXT DEFAULT '',
          redis_host VARCHAR(255) DEFAULT 'localhost',
          redis_port INTEGER DEFAULT 6379,
          redis_password TEXT DEFAULT '',
          redis_enabled INTEGER DEFAULT 0
        )
      `);

      await client.query(`ALTER TABLE tenant_configs ADD COLUMN IF NOT EXISTS escalation_keywords TEXT DEFAULT 'humano,asesor,representante,persona,soporte,operador'`);
      await client.query(`ALTER TABLE tenant_configs ADD COLUMN IF NOT EXISTS max_fallback_attempts INTEGER DEFAULT 3`);
      await client.query(`ALTER TABLE tenant_configs ADD COLUMN IF NOT EXISTS escalation_instructions TEXT DEFAULT ''`);
      await client.query(`ALTER TABLE tenant_configs ADD COLUMN IF NOT EXISTS allow_ai_escalation BOOLEAN DEFAULT true`);
      await client.query(`ALTER TABLE tenant_configs ADD COLUMN IF NOT EXISTS escalation_team_id INTEGER DEFAULT NULL`);

      // 4. Conversation logs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS logs (
          id SERIAL PRIMARY KEY,
          tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
          conversation_id VARCHAR(100) NOT NULL,
          role VARCHAR(20) NOT NULL,
          content TEXT NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 5. Products table (Local database catalog)
      await client.query(`
        CREATE TABLE IF NOT EXISTS products (
          id VARCHAR(100) NOT NULL,
          tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          price NUMERIC(10, 2) NOT NULL,
          stock INTEGER DEFAULT 0,
          description TEXT DEFAULT '',
          url TEXT DEFAULT '',
          category VARCHAR(100) DEFAULT '',
          brand VARCHAR(100) DEFAULT '',
          PRIMARY KEY (tenant_id, id)
        )
      `);

      await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT ''`);
      await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS brand VARCHAR(100) DEFAULT ''`);

      // 6. Knowledge Base table (FAQs, hours, details)
      await client.query(`
        CREATE TABLE IF NOT EXISTS knowledge_base (
          tenant_id VARCHAR(50) PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
          faqs TEXT DEFAULT '',
          bank_accounts TEXT DEFAULT '',
          branches TEXT DEFAULT '',
          timezone VARCHAR(50) DEFAULT 'America/Managua',
          mon_fri_start VARCHAR(5) DEFAULT '08:00',
          mon_fri_end VARCHAR(5) DEFAULT '17:30',
          sat_start VARCHAR(5) DEFAULT '09:00',
          sat_end VARCHAR(5) DEFAULT '12:30',
          sun_enabled INTEGER DEFAULT 0
        )
      `);

      await client.query(`ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS services TEXT DEFAULT ''`);

      // 7. Product queries table (for analytics)
      await client.query(`
        CREATE TABLE IF NOT EXISTS product_queries (
          id SERIAL PRIMARY KEY,
          tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
          product_id VARCHAR(100) NOT NULL,
          product_name VARCHAR(255) NOT NULL,
          conversation_id VARCHAR(100) NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 8. Appointments table (for booking)
      await client.query(`
        CREATE TABLE IF NOT EXISTS appointments (
          id SERIAL PRIMARY KEY,
          tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
          customer_name VARCHAR(100) NOT NULL,
          customer_phone VARCHAR(50) NOT NULL,
          appointment_date DATE NOT NULL,
          appointment_time VARCHAR(5) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (tenant_id, appointment_date, appointment_time)
        )
      `);

      await client.query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS service VARCHAR(255) DEFAULT 'Servicio Técnico'");

      // 9. Lost Sales table (for tracking out-of-stock interest)
      await client.query(`
        CREATE TABLE IF NOT EXISTS lost_sales (
          id SERIAL PRIMARY KEY,
          tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
          product_id VARCHAR(100) NOT NULL,
          product_name VARCHAR(255) NOT NULL,
          customer_phone VARCHAR(50) NOT NULL,
          conversation_id VARCHAR(100) NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Failed to initialize PostgreSQL schema:', e);
      throw e;
    } finally {
      client.release();
    }
  }

  // Tenant CRUD
  async createTenant(id: string, name: string): Promise<string> {
    await this.init();
    await this.pool.query(
      'INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
      [id, name]
    );
    // Initialize default config for this tenant
    await this.pool.query(
      'INSERT INTO tenant_configs (tenant_id) VALUES ($1) ON CONFLICT (tenant_id) DO NOTHING',
      [id]
    );
    // Initialize default knowledge base
    await this.pool.query(
      'INSERT INTO knowledge_base (tenant_id) VALUES ($1) ON CONFLICT (tenant_id) DO NOTHING',
      [id]
    );
    return id;
  }

  async getTenant(id: string) {
    const res = await this.pool.query('SELECT * FROM tenants WHERE id = $1', [id]);
    return res.rows[0];
  }

  async getAllTenantsAndUsers() {
    await this.init();
    const res = await this.pool.query(`
      SELECT t.id as tenant_id, t.name as tenant_name, string_agg(u.email, ', ') as email, t.created_at
      FROM tenants t
      LEFT JOIN users u ON t.id = u.tenant_id
      GROUP BY t.id, t.name, t.created_at
      ORDER BY t.created_at DESC
    `);
    return res.rows;
  }

  // User Auth & Signup
  async registerUser(tenantId: string, email: string, passwordPlain: string, role: string = 'admin'): Promise<User> {
    await this.init();
    const hash = await bcrypt.hash(passwordPlain, 10);
    const res = await this.pool.query(
      'INSERT INTO users (tenant_id, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [tenantId, email, hash, role]
    );
    return res.rows[0];
  }

  async findUserByEmail(email: string): Promise<User | null> {
    await this.init();
    const res = await this.pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return res.rows[0] || null;
  }

  async getUsers(tenantId?: string): Promise<Omit<User, 'password_hash'>[]> {
    await this.init();
    if (tenantId) {
      const res = await this.pool.query(
        'SELECT id, tenant_id, email, role FROM users WHERE tenant_id = $1 ORDER BY email ASC',
        [tenantId]
      );
      return res.rows;
    } else {
      const res = await this.pool.query(
        'SELECT id, tenant_id, email, role FROM users ORDER BY tenant_id ASC, email ASC'
      );
      return res.rows;
    }
  }

  async deleteUser(id: number): Promise<void> {
    await this.init();
    await this.pool.query('DELETE FROM users WHERE id = $1', [id]);
  }

  // Config management per tenant
  async getConfig(tenantId: string): Promise<AgentConfig> {
    await this.init();
    const res = await this.pool.query('SELECT * FROM tenant_configs WHERE tenant_id = $1', [tenantId]);
    if (res.rows.length === 0) {
      const inserted = await this.pool.query(
        'INSERT INTO tenant_configs (tenant_id) VALUES ($1) RETURNING *',
        [tenantId]
      );
      return inserted.rows[0];
    }
    return res.rows[0];
  }

  async updateConfig(tenantId: string, config: Partial<AgentConfig>): Promise<AgentConfig> {
    await this.init();
    const keys = Object.keys(config).filter(k => k !== 'tenant_id') as Array<keyof AgentConfig>;
    if (keys.length === 0) return this.getConfig(tenantId);
    const setClause = keys.map((k, idx) => `${k} = $${idx + 2}`).join(', ');
    const values = keys.map(k => config[k]);
    await this.pool.query(
      `UPDATE tenant_configs SET ${setClause} WHERE tenant_id = $1`,
      [tenantId, ...values]
    );
    return this.getConfig(tenantId);
  }

  // Knowledge Base management
  async getKnowledgeBase(tenantId: string): Promise<KnowledgeBase> {
    await this.init();
    const res = await this.pool.query('SELECT * FROM knowledge_base WHERE tenant_id = $1', [tenantId]);
    if (res.rows.length === 0) {
      const inserted = await this.pool.query(
        'INSERT INTO knowledge_base (tenant_id) VALUES ($1) RETURNING *',
        [tenantId]
      );
      return inserted.rows[0];
    }
    return res.rows[0];
  }

  async updateKnowledgeBase(tenantId: string, kb: Partial<KnowledgeBase>): Promise<KnowledgeBase> {
    await this.init();
    const keys = Object.keys(kb).filter(k => k !== 'tenant_id') as Array<keyof KnowledgeBase>;
    if (keys.length === 0) return this.getKnowledgeBase(tenantId);
    const setClause = keys.map((k, idx) => `${k} = $${idx + 2}`).join(', ');
    const values = keys.map(k => kb[k]);
    await this.pool.query(
      `UPDATE knowledge_base SET ${setClause} WHERE tenant_id = $1`,
      [tenantId, ...values]
    );
    return this.getKnowledgeBase(tenantId);
  }

  // Local Products Sync & Search (supports full and incremental modes)
  async syncProducts(tenantId: string, products: Partial<Product>[], mode: 'full' | 'incremental' = 'full') {
    await this.init();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      if (mode === 'full') {
        // Delete old products for this tenant
        await client.query('DELETE FROM products WHERE tenant_id = $1', [tenantId]);
      }
      
      // Insert/Upsert new products
      for (const p of products) {
        if (!p.id || !p.name || p.price === undefined) continue;
        
        await client.query(
          `INSERT INTO products (id, tenant_id, name, price, stock, description, url, category, brand)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id, tenant_id) DO UPDATE SET
             name = EXCLUDED.name,
             price = EXCLUDED.price,
             stock = EXCLUDED.stock,
             description = EXCLUDED.description,
             url = EXCLUDED.url,
             category = EXCLUDED.category,
             brand = EXCLUDED.brand`,
          [p.id, tenantId, p.name, p.price, p.stock || 0, p.description || '', p.url || '', p.category || '', p.brand || '']
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Error syncing products:', e);
      throw e;
    } finally {
      client.release();
    }
  }

  async getProducts(tenantId: string, limit: number = 10000): Promise<Product[]> {
    await this.init();
    const res = await this.pool.query(
      'SELECT * FROM products WHERE tenant_id = $1 ORDER BY name ASC LIMIT $2',
      [tenantId, limit]
    );
    return res.rows.map(r => ({
      ...r,
      price: parseFloat(r.price)
    }));
  }

  async searchLocalProducts(tenantId: string, query: string, limit: number = 3): Promise<Product[]> {
    await this.init();
    // Split query into words to do a multi-word search
    const words = query.split(/\s+/).filter(w => w.length > 2);
    let sql = 'SELECT * FROM products WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    
    if (words.length > 0) {
      sql += ' AND (';
      const clauses = words.map((w, idx) => {
        params.push(`%${w}%`);
        const pNum = idx + 2;
        return `(name ILIKE $${pNum} OR description ILIKE $${pNum} OR category ILIKE $${pNum} OR brand ILIKE $${pNum})`;
      });
      sql += clauses.join(' OR ');
      sql += ')';
    } else {
      // Fallback search
      params.push(`%${query}%`);
      sql += ' AND (name ILIKE $2 OR description ILIKE $2 OR category ILIKE $2 OR brand ILIKE $2)';
    }

    sql += ' ORDER BY stock DESC, name ASC LIMIT $' + (params.length + 1);
    params.push(limit);

    const res = await this.pool.query(sql, params);
    return res.rows.map(r => ({
      ...r,
      price: parseFloat(r.price)
    }));
  }

  // Log management per tenant
  async logMessage(tenantId: string, conversationId: string, role: string, content: string) {
    await this.init();
    await this.pool.query(
      'INSERT INTO logs (tenant_id, conversation_id, role, content) VALUES ($1, $2, $3, $4)',
      [tenantId, conversationId, role, content]
    );
  }

  async getLogs(tenantId: string, limit: number = 50) {
    await this.init();
    const res = await this.pool.query(
      'SELECT * FROM logs WHERE tenant_id = $1 ORDER BY timestamp DESC LIMIT $2',
      [tenantId, limit]
    );
    return res.rows;
  }

  async logProductQuery(tenantId: string, productId: string, productName: string, conversationId: string) {
    await this.init();
    await this.pool.query(
      `INSERT INTO product_queries (tenant_id, product_id, product_name, conversation_id)
       VALUES ($1, $2, $3, $4)`,
      [tenantId, productId, productName, conversationId]
    );
  }

  async getProductAnalytics(tenantId: string) {
    await this.init();
    const res = await this.pool.query(
      `SELECT product_id, product_name, COUNT(*)::integer as query_count, MAX(timestamp) as last_consulted
       FROM product_queries
       WHERE tenant_id = $1
       GROUP BY product_id, product_name
       ORDER BY query_count DESC
       LIMIT 10`
    );
    return res.rows;
  }

  async getDistinctConversations(tenantId: string) {
    await this.init();
    const res = await this.pool.query(
      `SELECT conversation_id, MAX(timestamp) as last_active, 
              COUNT(*)::integer as message_count
       FROM logs
       WHERE tenant_id = $1
       GROUP BY conversation_id
       ORDER BY last_active DESC`
    );
    return res.rows;
  }

  async getConversationLogs(tenantId: string, conversationId: string) {
    await this.init();
    const res = await this.pool.query(
      `SELECT * FROM logs
       WHERE tenant_id = $1 AND conversation_id = $2
       ORDER BY timestamp ASC`,
      [tenantId, conversationId]
    );
    return res.rows;
  }

  async getAppointments(tenantId: string): Promise<Appointment[]> {
    await this.init();
    const res = await this.pool.query(
      "SELECT id, tenant_id, customer_name, customer_phone, to_char(appointment_date, 'YYYY-MM-DD') as appointment_date, appointment_time, service, created_at FROM appointments WHERE tenant_id = $1 ORDER BY appointment_date ASC, appointment_time ASC",
      [tenantId]
    );
    return res.rows;
  }

  async createAppointment(tenantId: string, name: string, phone: string, date: string, time: string, service?: string): Promise<Appointment> {
    await this.init();
    const res = await this.pool.query(
      "INSERT INTO appointments (tenant_id, customer_name, customer_phone, appointment_date, appointment_time, service) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, tenant_id, customer_name, customer_phone, to_char(appointment_date, 'YYYY-MM-DD') as appointment_date, appointment_time, service, created_at",
      [tenantId, name, phone, date, time, service || 'Servicio Técnico']
    );
    return res.rows[0];
  }

  async deleteAppointment(tenantId: string, id: number): Promise<void> {
    await this.init();
    await this.pool.query('DELETE FROM appointments WHERE tenant_id = $1 AND id = $2', [tenantId, id]);
  }

  async getAvailableSlots(tenantId: string, dateStr: string): Promise<string[]> {
    await this.init();
    const date = new Date(dateStr + 'T00:00:00');
    const day = date.getDay(); // 0 = Sunday, 6 = Saturday
    if (day === 0) {
      return []; // Closed on Sundays
    }

    const allSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

    const res = await this.pool.query(
      'SELECT appointment_time FROM appointments WHERE tenant_id = $1 AND appointment_date = $2',
      [tenantId, dateStr]
    );
    const bookedSlots = res.rows.map(r => r.appointment_time);

    return allSlots.filter(slot => !bookedSlots.includes(slot));
  }

  // Lost Sales Tracking
  async logLostSale(tenantId: string, productId: string, productName: string, phone: string, conversationId: string): Promise<void> {
    await this.init();
    await this.pool.query(
      `INSERT INTO lost_sales (tenant_id, product_id, product_name, customer_phone, conversation_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, productId, productName, phone, conversationId]
    );
  }

  async getLostSales(tenantId: string): Promise<LostSale[]> {
    await this.init();
    const res = await this.pool.query(
      `SELECT id, tenant_id, product_id, product_name, customer_phone, conversation_id, to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as timestamp FROM lost_sales WHERE tenant_id = $1 ORDER BY timestamp DESC`,
      [tenantId]
    );
    return res.rows;
  }

  async deleteLostSale(tenantId: string, id: number): Promise<void> {
    await this.init();
    await this.pool.query(
      `DELETE FROM lost_sales WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id]
    );
  }
}

export interface Appointment {
  id: number;
  tenant_id: string;
  customer_name: string;
  customer_phone: string;
  appointment_date: string;
  appointment_time: string;
  service: string;
  created_at: string;
}

export interface LostSale {
  id: number;
  tenant_id: string;
  product_id: string;
  product_name: string;
  customer_phone: string;
  conversation_id: string;
  timestamp: string;
}

export const configService = new ConfigService();
export const dbPool = configService;
