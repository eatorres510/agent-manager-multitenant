import paramiko

def create_whatsapp_inbox():
    host = "31.220.107.80"
    user = "root"
    secret = "k,M1vw.&?MY8ZQ5QLVz@"

    cmd = """docker exec chatwoot-ai-platform node -e "
const axios = require('axios');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://ai_admin:ai_secure_pass_123@chatwoot-ai-db:5432/ai_platform_db'
});

async function run() {
  try {
    const res = await pool.query(\`SELECT chatwoot_url, chatwoot_access_token, chatwoot_account_id FROM tenant_configs WHERE tenant_id = 'sicsa'\`);
    const cfg = res.rows[0];

    const cleanUrl = cfg.chatwoot_url.replace(/\\/$/, '');
    const url = cleanUrl + '/api/v1/accounts/' + cfg.chatwoot_account_id + '/inboxes';
    
    console.log('--- Posting to Chatwoot URL:', url);
    const response = await axios.post(url, {
      name: 'WhatsApp Official SICSA 50588888897',
      channel: {
        type: 'api',
        webhook_url: 'http://31.220.107.80:4000/api/webhook/sicsa'
      }
    }, {
      headers: {
        'api_access_token': cfg.chatwoot_access_token,
        'Content-Type': 'application/json'
      }
    });

    console.log('Created Inbox Success! ID:', response.data.id, '| Name:', response.data.name);

  } catch (e) {
    console.error('API Error:', e.response ? JSON.stringify(e.response.data) : e.message);
  } finally {
    pool.end();
  }
}

run();
" """

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(host, username=user, password=secret, timeout=30)
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode('utf-8', errors='ignore')
        print("STDOUT:\n", out)
        if err:
            print("STDERR:\n", err)
    finally:
        ssh.close()

if __name__ == "__main__":
    create_whatsapp_inbox()
