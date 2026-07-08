import { createClient, RedisClientType } from 'redis';
import { AgentConfig, configService, Product } from './config.service.js';

// We map our products here

class RedisService {
  private client: RedisClientType | null = null;
  private isConnected = false;

  async getClient(config: AgentConfig): Promise<RedisClientType | null> {
    if (!config.redis_enabled) {
      this.close();
      return null;
    }

    if (this.client && this.isConnected) {
      return this.client;
    }

    try {
      const url = config.redis_password 
        ? `redis://:${config.redis_password}@${config.redis_host}:${config.redis_port}`
        : `redis://${config.redis_host}:${config.redis_port}`;
      
      this.client = createClient({ url });
      
      this.client.on('error', (err) => {
        console.error('Redis error:', err);
        this.isConnected = false;
      });

      await this.client.connect();
      this.isConnected = true;
      console.log('Connected to Redis database.');
      return this.client;
    } catch (e) {
      console.error('Failed to connect to Redis:', e);
      this.isConnected = false;
      this.client = null;
      return null;
    }
  }

  async close() {
    if (this.client) {
      try {
        await this.client.disconnect();
      } catch {}
      this.client = null;
      this.isConnected = false;
    }
  }

  async searchProducts(query: string, config: AgentConfig): Promise<Product[]> {
    // If Redis is disabled, query our local PostgreSQL products table
    if (!config.redis_enabled) {
      console.log(`[Postgres Search] Buscando productos en la tabla local de Postgres para tenant: ${config.tenant_id}`);
      return await configService.searchLocalProducts(config.tenant_id, query, 3);
    }

    const redisClient = await this.getClient(config);
    
    if (!redisClient) {
      // Fallback to local products table in PostgreSQL if Redis is checked but unreachable
      console.warn(`[Redis Connection Alert] Redis activado pero inalcanzable. Usando tabla de Postgres.`);
      return await configService.searchLocalProducts(config.tenant_id, query, 3);
    }

    try {
      // Search keys from Redis
      const keys = await redisClient.keys('product:*');
      const products: Product[] = [];

      for (const key of keys) {
        const data = await redisClient.get(key);
        if (data) {
          try {
            const product = JSON.parse(data) as Product;
            products.push(product);
          } catch {
            // If it's a Redis hash
            const hashData = await redisClient.hGetAll(key);
            if (hashData && hashData.name) {
              products.push({
                id: key.replace('product:', ''),
                name: hashData.name,
                price: parseFloat(hashData.price || '0'),
                stock: parseInt(hashData.stock || '0'),
                description: hashData.description || '',
                url: hashData.url || '',
                category: hashData.category || '',
                brand: hashData.brand || ''
              });
            }
          }
        }
      }

      // Filter local search in recovered keys
      const q = query.toLowerCase();
      const filtered = products.filter(p => 
        p.name.toLowerCase().includes(q) || 
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q))
      );

      if (filtered.length === 0 && keys.length === 0) {
        // Fallback to local Postgres products if Redis is empty
        return await configService.searchLocalProducts(config.tenant_id, query, 3);
      }

      return filtered;
    } catch (e) {
      console.error('Error querying Redis, falling back to local Postgres:', e);
      return await configService.searchLocalProducts(config.tenant_id, query, 3);
    }
  }
}

export const redisService = new RedisService();
export const redisPool = redisService;
