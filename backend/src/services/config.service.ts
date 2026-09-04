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
  emergency_ai_mode?: boolean;
  ai_enabled_during_hours?: boolean;
  ai_enabled_after_hours?: boolean;
  ai_auto_create_opportunities?: boolean;
  auto_assign_on_reply?: boolean;
  phone_number_id?: string;
  waba_id?: string;
  meta_access_token?: string;
  meta_app_id?: string;
  enable_idle_ai_rescue?: boolean;
  idle_rescue_timeout_minutes?: number;
  idle_rescue_strict_governance?: boolean;
  idle_rescue_tag?: string;
  default_view_only_mine?: boolean;
  enable_typing_lock?: boolean;
  use_direct_sql_messages?: boolean;
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
  private chatwootPool: pg.Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    this.pool = new Pool(connectionString ? { connectionString } : {});

    const chatwootDbUrl = process.env.CHATWOOT_DATABASE_URL || 'postgres://postgres:5510d4af325da01766d7@n8n_chatwoot-db.1.wncgm8vlnsjjsyw286hsgqbcb:5432/n8n';
    this.chatwootPool = new Pool({ connectionString: chatwootDbUrl });
  }

  public getPool(): pg.Pool {
    return this.pool;
  }

  public async query(text: string, params?: any[]) {
    return this.pool.query(text, params);
  }

  public async queryChatwootDb(text: string, params?: any[]) {
    return this.chatwootPool.query(text, params);
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
      await client.query(`ALTER TABLE tenant_configs ADD COLUMN IF NOT EXISTS emergency_ai_mode BOOLEAN DEFAULT false`);
      await client.query(`ALTER TABLE tenant_configs ADD COLUMN IF NOT EXISTS ai_enabled_during_hours BOOLEAN DEFAULT false`);
      await client.query(`ALTER TABLE tenant_configs ADD COLUMN IF NOT EXISTS ai_enabled_after_hours BOOLEAN DEFAULT true`);
      await client.query(`ALTER TABLE tenant_configs ADD COLUMN IF NOT EXISTS ai_auto_create_opportunities BOOLEAN DEFAULT true`);
      await client.query(`ALTER TABLE tenant_configs ADD COLUMN IF NOT EXISTS enable_idle_ai_rescue BOOLEAN DEFAULT true`);
      await client.query(`ALTER TABLE tenant_configs ADD COLUMN IF NOT EXISTS idle_rescue_timeout_minutes INTEGER DEFAULT 10`);
      await client.query(`ALTER TABLE tenant_configs ADD COLUMN IF NOT EXISTS idle_rescue_strict_governance BOOLEAN DEFAULT true`);
      await client.query(`ALTER TABLE tenant_configs ADD COLUMN IF NOT EXISTS idle_rescue_tag VARCHAR(100) DEFAULT 'sin-comision-ia'`);
      await client.query(`ALTER TABLE tenant_configs ADD COLUMN IF NOT EXISTS default_view_only_mine BOOLEAN DEFAULT true`);
      await client.query(`ALTER TABLE tenant_configs ADD COLUMN IF NOT EXISTS enable_typing_lock BOOLEAN DEFAULT true`);
      await client.query(`ALTER TABLE tenant_configs ADD COLUMN IF NOT EXISTS use_direct_sql_messages BOOLEAN DEFAULT true`);

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

      // 10. Agent status logs table (for breaks/availabilities)
      await client.query(`
        CREATE TABLE IF NOT EXISTS agent_status_logs (
          id SERIAL PRIMARY KEY,
          tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
          user_email VARCHAR(255) NOT NULL,
          status VARCHAR(50) NOT NULL,
          started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          ended_at TIMESTAMP NULL
        )
      `);

      // 11. B2B Companies & Accounts table
      await client.query(`
        CREATE TABLE IF NOT EXISTS crm_companies (
          id SERIAL PRIMARY KEY,
          tenant_id VARCHAR(50) NOT NULL,
          name VARCHAR(200) NOT NULL,
          ruc_tax_id VARCHAR(50),
          industry VARCHAR(100),
          phone VARCHAR(50),
          email VARCHAR(255),
          website VARCHAR(255),
          address TEXT,
          credit_terms VARCHAR(50) DEFAULT 'Contado',
          assigned_agent_name VARCHAR(100),
          status VARCHAR(50) DEFAULT 'active',
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 12. B2B Company Contacts table (1 Company -> N Contacts)
      await client.query(`
        CREATE TABLE IF NOT EXISTS crm_company_contacts (
          id SERIAL PRIMARY KEY,
          tenant_id VARCHAR(50) NOT NULL,
          company_id INT NOT NULL REFERENCES crm_companies(id) ON DELETE CASCADE,
          name VARCHAR(150) NOT NULL,
          role_title VARCHAR(100),
          phone VARCHAR(50),
          email VARCHAR(255),
          decision_level VARCHAR(50) DEFAULT 'decisor',
          is_primary BOOLEAN DEFAULT false,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 13. Extend CRM Opportunities with B2B columns
      await client.query(`
        ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS pipeline_type VARCHAR(20) DEFAULT 'b2c';
        ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS company_id INT REFERENCES crm_companies(id) ON DELETE SET NULL;
        ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS company_name VARCHAR(200);
        ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS company_contact_id INT REFERENCES crm_company_contacts(id) ON DELETE SET NULL;
        ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS credit_terms VARCHAR(50);
        ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS target_closing_date DATE;
      `);

      // 14. Meta Ads Click-to-WhatsApp Referrals & Campaign Attribution
      await client.query(`
        CREATE TABLE IF NOT EXISTS meta_ad_referrals (
          id SERIAL PRIMARY KEY,
          tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
          conversation_id VARCHAR(100) NOT NULL,
          contact_phone VARCHAR(50),
          contact_name VARCHAR(150),
          source_id VARCHAR(100) NOT NULL,
          source_type VARCHAR(50) DEFAULT 'ad',
          source_url TEXT,
          headline TEXT,
          body TEXT,
          media_type VARCHAR(20) DEFAULT 'image',
          image_url TEXT,
          video_url TEXT,
          ctwa_clid TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_meta_ref_source_id ON meta_ad_referrals(source_id);
        CREATE INDEX IF NOT EXISTS idx_meta_ref_conv_id ON meta_ad_referrals(tenant_id, conversation_id);

        CREATE TABLE IF NOT EXISTS meta_ad_insights (
          tenant_id VARCHAR(50) NOT NULL,
          ad_id VARCHAR(100) NOT NULL,
          ad_name VARCHAR(255),
          campaign_id VARCHAR(100),
          campaign_name VARCHAR(255),
          adset_id VARCHAR(100),
          adset_name VARCHAR(255),
          spend NUMERIC(12, 2) DEFAULT 0,
          impressions INT DEFAULT 0,
          clicks INT DEFAULT 0,
          cpc NUMERIC(8, 2) DEFAULT 0,
          manual_spend NUMERIC(12, 2) DEFAULT NULL,
          synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (tenant_id, ad_id)
        );

        ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS meta_ad_id VARCHAR(100);
        ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS meta_ad_headline TEXT;
        ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS meta_campaign_name VARCHAR(255);
        ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS invoiced_amount NUMERIC(12, 2) DEFAULT 0;
        ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100);
        ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS sale_confirmed_at TIMESTAMP;
        ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS sale_items_summary TEXT;

        ALTER TABLE tenant_configs ADD COLUMN IF NOT EXISTS meta_ad_account_id VARCHAR(100) DEFAULT '';
        ALTER TABLE tenant_configs ADD COLUMN IF NOT EXISTS meta_marketing_token TEXT DEFAULT '';
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

  async updateUserPassword(email: string, passwordHash: string): Promise<void> {
    await this.init();
    await this.pool.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2',
      [passwordHash, email]
    );
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

  async searchLocalProducts(tenantId: string, query: string, limit: number = 6): Promise<Product[]> {
    await this.init();
    const cleanQuery = (query || '').toString().toLowerCase().trim();
    
    // Check if user is asking for POS / Punto de Venta / Farmacias / Abarroterías
    const isPOSQuery = cleanQuery.includes('pos') || cleanQuery.includes('punto') || cleanQuery.includes('farmacia') || cleanQuery.includes('abarroter') || cleanQuery.includes('caja');

    let words = cleanQuery.split(/\s+/).filter(w => w.length >= 2 && w !== 'para' && w !== 'con' && w !== 'que' && w !== 'los' && w !== 'las' && w !== 'una' && w !== 'del');
    
    if (isPOSQuery && !words.includes('laptop') && !words.includes('impresora')) {
      words.push('laptop', 'escritorio', 'impresora', 'punto');
    }

    let sql = 'SELECT * FROM products WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    
    if (words.length > 0) {
      sql += ' AND (';
      const clauses = words.map((w, idx) => {
        params.push(`%${w}%`);
        const pNum = idx + 2;
        return `(name ILIKE $${pNum} OR description ILIKE $${pNum} OR category ILIKE $${pNum} OR brand ILIKE $${pNum})`;
      });
      // Use OR matching if POS query or multiple terms so available options are found
      sql += clauses.join(isPOSQuery ? ' OR ' : ' OR ');
      sql += ')';
    } else {
      params.push(`%${cleanQuery}%`);
      sql += ' AND (name ILIKE $2 OR description ILIKE $2 OR category ILIKE $2 OR brand ILIKE $2)';
    }

    // Prioritize AVAILABLE STOCK (stock > 0) first, then relevancy score, then name
    let orderBy = ' ORDER BY (CASE WHEN stock > 0 THEN 1 ELSE 0 END) DESC, ';
    if (words.length > 0) {
      const matchScore = words.map((w, idx) => {
        const pNum = idx + 2;
        return `
          (CASE 
            WHEN category ILIKE $${pNum} AND category NOT ILIKE '%repuesto%' AND category NOT ILIKE '%servicio%' THEN 10
            WHEN name ILIKE $${pNum} AND category NOT ILIKE '%repuesto%' AND category NOT ILIKE '%servicio%' THEN 5
            WHEN category ILIKE $${pNum} THEN 2
            WHEN name ILIKE $${pNum} THEN 1
            ELSE 0 
          END)
        `;
      }).join(' + ');
      orderBy += `(${matchScore}) DESC, `;
    }
    orderBy += 'stock DESC, name ASC';

    sql += orderBy + ' LIMIT $' + (params.length + 1);
    params.push(limit);

    const res = await this.pool.query(sql, params);
    let rows = res.rows.map(r => ({
      ...r,
      price: parseFloat(r.price)
    }));

    // Fallback if 0 rows found: return available laptops / desktops / printers
    if (rows.length === 0) {
      const fallbackRes = await this.pool.query(
        'SELECT * FROM products WHERE tenant_id = $1 AND stock > 0 ORDER BY stock DESC, name ASC LIMIT $2',
        [tenantId, limit]
      );
      rows = fallbackRes.rows.map(r => ({ ...r, price: parseFloat(r.price) }));
    }

    return rows;
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
      `SELECT l.*, r.source_id as meta_ad_id, r.headline as meta_headline, r.image_url as meta_image_url
       FROM logs l
       LEFT JOIN meta_ad_referrals r ON r.tenant_id = l.tenant_id AND r.conversation_id = l.conversation_id
       WHERE l.tenant_id = $1 
       ORDER BY l.timestamp DESC 
       LIMIT $2`,
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
      `SELECT l.*, r.source_id as meta_ad_id, r.headline as meta_headline, r.image_url as meta_image_url
       FROM logs l
       LEFT JOIN meta_ad_referrals r ON r.tenant_id = l.tenant_id AND r.conversation_id = l.conversation_id
       WHERE l.tenant_id = $1 AND l.conversation_id = $2
       ORDER BY l.timestamp ASC`,
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

  // --- AGENT STATUS & PAUSES TRACKING ---
  async setAgentStatus(tenantId: string, userEmail: string, status: string): Promise<void> {
    await this.init();
    // Close active status for user
    await this.pool.query(
      `UPDATE agent_status_logs SET ended_at = CURRENT_TIMESTAMP WHERE tenant_id = $1 AND user_email = $2 AND ended_at IS NULL`,
      [tenantId, userEmail]
    );
    // Insert new status log
    await this.pool.query(
      `INSERT INTO agent_status_logs (tenant_id, user_email, status, started_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [tenantId, userEmail, status]
    );
  }

  async getAgentStatusSummary(tenantId: string): Promise<any[]> {
    await this.init();
    const res = await this.pool.query(
      `SELECT user_email, status, started_at FROM agent_status_logs WHERE tenant_id = $1 AND ended_at IS NULL ORDER BY started_at DESC`,
      [tenantId]
    );
    return res.rows;
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
