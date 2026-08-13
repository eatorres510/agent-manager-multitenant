import paramiko

def setup_sicsa_whatsapp():
    host = "31.220.107.80"
    user = "root"
    secret = "k,M1vw.&?MY8ZQ5QLVz@"
    
    token = "EAAbkYS99ZB48BSIlZA9p3Cway7MJdmy6MZADdL4ZCddv0JyUJYkvRc3yKcLKXiwoxZAoY0xdFS7OMSh8I1X5caldW9yTL467NfvJev0mTSzAmezDBs2VoyYpIDtVvhA5L17P2CJiuePh4FQMxYq95XcCdtO1WkzwM50OZBy1ZCTiNhULLqvCyk0tZCjT6lznstZB6eQZDZD"
    phone_number_id = "1276351085553842"
    tenant_id = "sicsa"

    js_code = """
const axios = require('axios');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://ai_admin:ai_secure_pass_123@chatwoot-ai-db:5432/ai_platform_db'
});

async function run() {
  try {
    console.log('--- 1. Testing Token with Meta Graph API ---');
    const url = 'https://graph.facebook.com/v18.0/' + '%s';
    const metaRes = await axios.get(url, {
      headers: { 'Authorization': 'Bearer ' + '%s' }
    });
    console.log('Meta Graph API Response:', metaRes.data);

    console.log('--- 2. Updating tenant_configs in PostgreSQL ---');
    await pool.query(
      'UPDATE tenant_configs SET phone_number_id = $1, meta_access_token = $2, updated_at = NOW() WHERE tenant_id = $3',
      ['%s', '%s', '%s']
    );
    console.log('tenant_configs updated successfully for %s!');

    console.log('--- 3. Verifying Inboxes in Chatwoot ---');
    const configRes = await pool.query('SELECT chatwoot_url, chatwoot_access_token, chatwoot_account_id FROM tenant_configs WHERE tenant_id = $1', ['%s']);
    const cfg = configRes.rows[0];
    
    if (cfg && cfg.chatwoot_url) {
      const cleanUrl = cfg.chatwoot_url.replace(/\\/$/, '');
      const inboxesUrl = cleanUrl + '/api/v1/accounts/' + cfg.chatwoot_account_id + '/inboxes';
      const inboxesRes = await axios.get(inboxesUrl, {
        headers: { 'api_access_token': cfg.chatwoot_access_token }
      });
      console.log('Chatwoot Inboxes:', JSON.stringify(inboxesRes.data, null, 2));
    }

  } catch (e) {
    console.error('Error during setup:', e.response ? e.response.data : e.message);
  } finally {
    pool.end();
  }
}

run();
""" % (phone_number_id, token, phone_number_id, token, tenant_id, tenant_id, tenant_id)

    cmd = f'docker exec chatwoot-ai-platform node -e "{js_code}"'

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(host, username=user, password=secret, timeout=30)
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode('utf-8', errors='ignore')
        err = stderr.read().decode('utf-8', errors='ignore')
        print("STDOUT:\n", out)
        if err:
            print("STDERR:\n", err)
    finally:
        ssh.close()

if __name__ == "__main__":
    setup_sicsa_whatsapp()
