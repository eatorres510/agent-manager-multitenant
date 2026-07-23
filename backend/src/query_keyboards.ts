import { configService } from './services/config.service.js';

async function run() {
  await configService.init();
  const res = await (configService as any).pool.query(
    "SELECT id, name, brand, category, price, stock FROM products WHERE tenant_id = 'sicsa' AND (category ILIKE '%teclado%' OR name ILIKE '%teclado%') AND stock = 0 ORDER BY name ASC"
  );
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}
run();
