import { configService } from './services/config.service.js';

async function run() {
  await configService.init();
  const c = await configService.getConfig('sicsa');
  console.log({
    tenant_id: c.tenant_id,
    chatwoot_url: c.chatwoot_url,
    chatwoot_account_id: c.chatwoot_account_id,
    chatwoot_access_token: c.chatwoot_access_token ? c.chatwoot_access_token.slice(0, 15) + '...' : null,
    chatwoot_website_token: c.chatwoot_website_token ? c.chatwoot_website_token.slice(0, 15) + '...' : null
  });
  process.exit(0);
}
run();
