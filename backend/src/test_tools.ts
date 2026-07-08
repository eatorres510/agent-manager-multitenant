import dotenv from 'dotenv';
import { configService } from './services/config.service.js';
import { aiService } from './services/ai.service.js';

dotenv.config();

async function runTests() {
  console.log('=== RUNNING TOOL CALLING BOOKING TESTS INSIDE CONTAINER ===');
  try {
    await configService.init();
    const config = await configService.getConfig('sicsa');
    
    // Clear any previous test appointments for sicsa on 2026-07-15 to make test idempotent
    console.log('\n[TEST SETUP] Limpiando citas de prueba para el 2026-07-15...');
    await (configService as any).pool.query(
      "DELETE FROM appointments WHERE tenant_id = 'sicsa' AND appointment_date = '2026-07-15'"
    );

    console.log('\n[TEST 1] Consulta de disponibilidad inicial (Debe retornar todos los horarios)');
    const res1 = await aiService.generateResponse(
      '¿Qué horarios tienen disponibles para este miércoles 15 de julio de 2026?',
      [],
      'sicsa',
      'test-booking-conv',
      config
    );
    console.log('Response 1:', res1);

    console.log('\n[TEST 2] Agendar cita a las 14:00 (Debe llamar a book_appointment)');
    const res2 = await aiService.generateResponse(
      'Excelente, agéndame una cita de mantenimiento de impresora para ese miércoles 15 de julio de 2026 a las 2 PM a nombre de Erick Torres, mi teléfono es 8888-8888.',
      [{ role: 'user', content: '¿Qué horarios tienen disponibles para este miércoles 15 de julio de 2026?' }, { role: 'assistant', content: res1 }],
      'sicsa',
      'test-booking-conv',
      config
    );
    console.log('Response 2:', res2);

    console.log('\n[TEST 3] Consulta de disponibilidad posterior (Debe excluir las 14:00)');
    const res3 = await aiService.generateResponse(
      '¿Qué horas quedan disponibles ahora para el miércoles 15 de julio de 2026?',
      [],
      'sicsa',
      'test-booking-conv',
      config
    );
    console.log('Response 3:', res3);

  } catch(e) {
    console.error('Test error:', e);
  } finally {
    process.exit(0);
  }
}
runTests();
