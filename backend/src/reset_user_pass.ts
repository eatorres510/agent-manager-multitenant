import dotenv from 'dotenv';
import { configService } from './services/config.service.js';
import bcrypt from 'bcrypt';

dotenv.config();

async function run() {
  console.log('=== RESETTING USER PASSWORD ===');
  try {
    await configService.init();
    const hash = await bcrypt.hash('AdminRoot510!', 10);
    const dbPool = configService as any;
    if (dbPool.pool) {
      await dbPool.pool.query(
        "UPDATE users SET password_hash = $1, role = 'superadmin' WHERE email = $2",
        [hash, 'erick.torres@eitserv.tech']
      );
      console.log('¡Contraseña de erick.torres@eitserv.tech restablecida con éxito a "AdminRoot510!"!');
    }
  } catch (e) {
    console.error('Error resetting password:', e);
  } finally {
    process.exit(0);
  }
}
run();
