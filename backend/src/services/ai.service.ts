import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { configService, AgentConfig } from './config.service.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Tool declarations for Gemini (declarative format compatible with OpenAPI)
const geminiSearchProductsTool = {
  name: 'search_products',
  description: 'Busca productos en el catálogo de la empresa por palabra clave, SKU, marca o categoría.',
  parameters: {
    type: 'OBJECT' as any,
    properties: {
      query: {
        type: 'STRING' as any,
        description: 'La palabra clave de búsqueda (ej: "laptop lenovo", "impresora epson", "silla").',
      },
    },
    required: ['query'],
  },
};

const geminiGetFaqInfoTool = {
  name: 'get_faq_info',
  description: 'Obtiene información de la base de conocimiento sobre políticas, métodos de pago, garantías y soporte técnico.',
  parameters: {
    type: 'OBJECT' as any,
    properties: {
      topic: {
        type: 'STRING' as any,
        description: 'El tema de consulta (ej: "BAC", "BANPRO", "garantías", "envíos", "soporte").',
      },
    },
    required: ['topic'],
  },
};

const geminiGetBusinessInfoTool = {
  name: 'get_business_info',
  description: 'Obtiene las ubicaciones físicas de las sucursales, los horarios de atención y el estado actual de la tienda.',
  parameters: {
    type: 'OBJECT' as any,
    properties: {},
  },
};

const geminiCheckAvailabilityTool = {
  name: 'check_availability',
  description: 'Consulta los horarios disponibles para agendar una cita en una fecha específica (formato YYYY-MM-DD).',
  parameters: {
    type: 'OBJECT' as any,
    properties: {
      date: {
        type: 'STRING' as any,
        description: 'La fecha a consultar en formato YYYY-MM-DD (ej: "2026-07-10").',
      },
    },
    required: ['date'],
  },
};

const geminiBookAppointmentTool = {
  name: 'book_appointment',
  description: 'Reserva una cita para un cliente en una fecha y hora específicas.',
  parameters: {
    type: 'OBJECT' as any,
    properties: {
      date: {
        type: 'STRING' as any,
        description: 'La fecha de la cita en formato YYYY-MM-DD (ej: "2026-07-10").',
      },
      time: {
        type: 'STRING' as any,
        description: 'La hora de la cita en formato HH:MM de 24 horas (ej: "14:00", "09:00").',
      },
      name: {
        type: 'STRING' as any,
        description: 'El nombre completo del cliente que reserva la cita.',
      },
      phone: {
        type: 'STRING' as any,
        description: 'El número de teléfono del cliente.',
      },
      service: {
        type: 'STRING' as any,
        description: 'El tipo de servicio solicitado (ej: "Mantenimiento Técnico", "Instalación de Cableado").',
      },
    },
    required: ['date', 'time', 'name', 'phone', 'service'],
  },
};

class AIService {
  async generateResponse(
    userMessage: string,
    history: ChatMessage[],
    tenantId: string,
    conversationId: string,
    config: AgentConfig
  ): Promise<string> {
    if (config.active_provider === 'gemini') {
      if (!config.gemini_api_key) {
        throw new Error('Gemini API Key is missing. Configure it in the panel.');
      }
      return this.callGemini(userMessage, history, tenantId, conversationId, config);
    } else {
      if (!config.deepseek_api_key) {
        throw new Error('DeepSeek API Key is missing. Configure it in the panel.');
      }
      return this.callDeepSeek(userMessage, history, tenantId, conversationId, config);
    }
  }

  private async callGemini(
    userMessage: string,
    history: ChatMessage[],
    tenantId: string,
    conversationId: string,
    config: AgentConfig
  ): Promise<string> {
    try {
      const ai = new GoogleGenerativeAI(config.gemini_api_key);
      const model = ai.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: config.system_prompt,
        tools: [{
          functionDeclarations: [
            geminiSearchProductsTool,
            geminiGetFaqInfoTool,
            geminiGetBusinessInfoTool,
            geminiCheckAvailabilityTool,
            geminiBookAppointmentTool
          ]
        }]
      });

      const contents: any[] = [
        ...history.map(h => ({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.content }]
        })),
        { role: 'user', parts: [{ text: userMessage }] }
      ];

      let response = await model.generateContent({ contents });
      let functionCalls = response.response.functionCalls();

      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        let result = '';

        console.log(`[Gemini Tool Call] AI invocó la función: ${call.name} con argumentos:`, call.args);

        if (call.name === 'search_products') {
          const args = call.args as { query: string };
          const products = await configService.searchLocalProducts(tenantId, args.query);
          result = products && products.length > 0 
            ? products.map(p => `- ID: ${p.id} | Nombre: ${p.name} | Marca: ${p.brand || 'No especificada'} | Categoría: ${p.category || 'No especificada'} | Precio: C$${p.price} + IVA | Stock: ${p.stock} | Enlace: ${p.url || 'No disponible'} | Descripción: ${p.description || ''}`).join('\n')
            : 'No se encontraron productos coincidentes en el catálogo.';
          
          if (products && products.length > 0) {
            for (const p of products) {
              await configService.logProductQuery(tenantId, p.id, p.name, conversationId).catch(err => {
                console.error('[Analytics Error] Failed to log product query:', err);
              });
            }
          }
        } else if (call.name === 'get_faq_info') {
          const kb = await configService.getKnowledgeBase(tenantId);
          result = `FAQs de la empresa:\n${kb.faqs}\n\nCuentas Bancarias y Métodos de Pago:\n${kb.bank_accounts}\n\nServicios Ofrecidos:\n${kb.services || 'No especificados'}`;
        } else if (call.name === 'get_business_info') {
          const kb = await configService.getKnowledgeBase(tenantId);
          result = `Sucursales y Ubicación: ${kb.branches}\nHorario Lunes-Viernes: ${kb.mon_fri_start} a ${kb.mon_fri_end}\nHorario Sábados: ${kb.sat_start} a ${kb.sat_end}\nDomingos: ${kb.sun_enabled ? 'Abierto' : 'Cerrado'}\nZona Horaria: ${kb.timezone}`;
        } else if (call.name === 'check_availability') {
          const args = call.args as { date: string };
          const slots = await configService.getAvailableSlots(tenantId, args.date);
          result = slots.length > 0 
            ? `Horarios disponibles para el ${args.date}: ${slots.join(', ')}`
            : `No hay horarios disponibles para el ${args.date} o el negocio está cerrado ese día.`;
        } else if (call.name === 'book_appointment') {
          const args = call.args as { date: string, time: string, name: string, phone: string, service?: string };
          try {
            const appt = await configService.createAppointment(tenantId, args.name, args.phone, args.date, args.time, args.service);
            result = `Cita de ${appt.service} reservada con éxito. ID Reserva: ${appt.id}. Detalle: ${appt.customer_name} el día ${appt.appointment_date} a las ${appt.appointment_time}.`;
          } catch (err: any) {
            result = `Error al registrar cita: El horario de las ${args.time} el día ${args.date} ya está ocupado. Por favor consulta la disponibilidad de nuevo y elige otra hora.`;
          }
        }

        // Return function output to Gemini context
        contents.push(response.response.candidates![0].content);
        contents.push({
          role: 'user',
          parts: [{
            functionResponse: {
              name: call.name,
              response: { result }
            }
          }]
        });

        const finalResponse = await model.generateContent({ contents });
        const text = finalResponse.response.text();
        if (!text) throw new Error('Empty response from Gemini after Tool execution');
        return text;
      }

      const text = response.response.text();
      if (!text) throw new Error('Empty response from Gemini');
      return text;
    } catch (e: any) {
      console.error('Error calling Gemini:', e);
      throw new Error(`Error de Gemini: ${e.message || e}`);
    }
  }

  private async callDeepSeek(
    userMessage: string,
    history: ChatMessage[],
    tenantId: string,
    conversationId: string,
    config: AgentConfig
  ): Promise<string> {
    try {
      const apiKey = config.deepseek_api_key;
      const messages: any[] = [
        { role: 'system', content: config.system_prompt },
        ...history.map(h => ({
          role: h.role === 'user' ? 'user' : 'assistant',
          content: h.content
        })),
        { role: 'user', content: userMessage }
      ];

      const tools = [
        {
          type: 'function',
          function: {
            name: 'search_products',
            description: 'Busca productos en el catálogo de la empresa por palabra clave, SKU, marca o categoría.',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Palabra clave (ej: "laptop lenovo").' }
              },
              required: ['query']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'get_faq_info',
            description: 'Obtiene información de la base de conocimiento sobre políticas, métodos de pago, garantías y soporte técnico.',
            parameters: {
              type: 'object',
              properties: {
                topic: { type: 'string', description: 'Tema de consulta (ej: "BAC", "garantía").' }
              },
              required: ['topic']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'get_business_info',
            description: 'Obtiene las ubicaciones físicas de las sucursales, los horarios de atención y zona horaria.',
            parameters: {
              type: 'object',
              properties: {}
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'check_availability',
            description: 'Consulta los horarios disponibles para agendar una cita en una fecha específica (formato YYYY-MM-DD).',
            parameters: {
              type: 'object',
              properties: {
                date: { type: 'string', description: 'La fecha a consultar en formato YYYY-MM-DD (ej: "2026-07-10").' }
              },
              required: ['date']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'book_appointment',
            description: 'Reserva una cita para un cliente en una fecha y hora específicas.',
            parameters: {
              type: 'object',
              properties: {
                date: { type: 'string', description: 'La fecha de la cita en formato YYYY-MM-DD (ej: "2026-07-10").' },
                time: { type: 'string', description: 'La hora de la cita en formato HH:MM (ej: "14:00").' },
                name: { type: 'string', description: 'El nombre del cliente.' },
                phone: { type: 'string', description: 'El número de teléfono del cliente.' },
                service: { type: 'string', description: 'El tipo de servicio solicitado (ej: "Mantenimiento Técnico", "Cableado").' }
              },
              required: ['date', 'time', 'name', 'phone', 'service']
            }
          }
        }
      ];

      let response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages,
          tools,
          tool_choice: 'auto',
          temperature: 0.7,
          stream: false
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 25000
        }
      );

      const choice = response.data?.choices?.[0];
      if (!choice || !choice.message) {
        throw new Error('Invalid response structure from DeepSeek API');
      }

      const toolCalls = choice.message.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        const call = toolCalls[0];
        let result = '';

        console.log(`[DeepSeek Tool Call] AI invocó la función: ${call.function.name} con argumentos:`, call.function.arguments);

        if (call.function.name === 'search_products') {
          const args = JSON.parse(call.function.arguments) as { query: string };
          const products = await configService.searchLocalProducts(tenantId, args.query);
          result = products && products.length > 0 
            ? products.map(p => `- ID: ${p.id} | Nombre: ${p.name} | Marca: ${p.brand || 'No especificada'} | Categoría: ${p.category || 'No especificada'} | Precio: C$${p.price} + IVA | Stock: ${p.stock} | Enlace: ${p.url || 'No disponible'} | Descripción: ${p.description || ''}`).join('\n')
            : 'No se encontraron productos coincidentes en el catálogo.';
          
          if (products && products.length > 0) {
            for (const p of products) {
              await configService.logProductQuery(tenantId, p.id, p.name, conversationId).catch(err => {
                console.error('[Analytics Error] Failed to log product query:', err);
              });
            }
          }
        } else if (call.function.name === 'get_faq_info') {
          const kb = await configService.getKnowledgeBase(tenantId);
          result = `FAQs de la empresa:\n${kb.faqs}\n\nCuentas Bancarias y Métodos de Pago:\n${kb.bank_accounts}\n\nServicios Ofrecidos:\n${kb.services || 'No especificados'}`;
        } else if (call.function.name === 'get_business_info') {
          const kb = await configService.getKnowledgeBase(tenantId);
          result = `Sucursales y Ubicación: ${kb.branches}\nHorario Lunes-Viernes: ${kb.mon_fri_start} a ${kb.mon_fri_end}\nHorario Sábados: ${kb.sat_start} a ${kb.sat_end}\nDomingos: ${kb.sun_enabled ? 'Abierto' : 'Cerrado'}\nZona Horaria: ${kb.timezone}`;
        } else if (call.function.name === 'check_availability') {
          const args = JSON.parse(call.function.arguments) as { date: string };
          const slots = await configService.getAvailableSlots(tenantId, args.date);
          result = slots.length > 0 
            ? `Horarios disponibles para el ${args.date}: ${slots.join(', ')}`
            : `No hay horarios disponibles para el ${args.date} o el negocio está cerrado ese día.`;
        } else if (call.function.name === 'book_appointment') {
          const args = JSON.parse(call.function.arguments) as { date: string, time: string, name: string, phone: string, service?: string };
          try {
            const appt = await configService.createAppointment(tenantId, args.name, args.phone, args.date, args.time, args.service);
            result = `Cita de ${appt.service} reservada con éxito. ID Reserva: ${appt.id}. Detalle: ${appt.customer_name} el día ${appt.appointment_date} a las ${appt.appointment_time}.`;
          } catch (err: any) {
            result = `Error al registrar cita: El horario de las ${args.time} el día ${args.date} ya está ocupado. Por favor consulta la disponibilidad de nuevo y elige otra hora.`;
          }
        }

        // Push assistant call and tool output to chat log
        messages.push(choice.message);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: result
        });

        const finalResponse = await axios.post(
          'https://api.deepseek.com/v1/chat/completions',
          {
            model: 'deepseek-chat',
            messages,
            temperature: 0.7,
            stream: false
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            timeout: 25000
          }
        );

        const finalChoice = finalResponse.data?.choices?.[0];
        if (!finalChoice || !finalChoice.message?.content) {
          throw new Error('Invalid final response structure from DeepSeek API');
        }
        return finalChoice.message.content;
      }

      return choice.message.content;
    } catch (e: any) {
      console.error('Error calling DeepSeek:', e);
      const errMsg = e.response?.data?.error?.message || e.message || e;
      throw new Error(`Error de DeepSeek: ${errMsg}`);
    }
  }
}

export const aiService = new AIService();
