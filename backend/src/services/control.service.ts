import axios from 'axios';
import { configService } from './config.service.js';

export interface LabelPayload {
  title: string;
  description?: string;
  color?: string;
  show_on_sidebar?: boolean;
}

export interface InboxPayload {
  name: string;
  channel_type: 'web_widget' | 'api' | 'whatsapp';
  website_url?: string;
  phone_number?: string;
}

export interface MetaTemplate {
  name: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  components: any[];
}

export class ControlService {
  private async getTenantConfig(tenantId: string) {
    const config = await configService.getConfig(tenantId);
    if (!config || !config.chatwoot_url || !config.chatwoot_access_token || !config.chatwoot_account_id) {
      throw new Error(`La configuración de Chatwoot no está completa para el tenant '${tenantId}'.`);
    }
    return config;
  }

  // --- LABELS MANAGEMENT ---
  async getLabels(tenantId: string) {
    const config = await this.getTenantConfig(tenantId);
    const url = `${config.chatwoot_url.replace(/\/$/, '')}/api/v1/accounts/${config.chatwoot_account_id}/labels`;
    
    const response = await axios.get(url, {
      headers: { 'api_access_token': config.chatwoot_access_token }
    });
    return response.data.payload || [];
  }

  async createLabel(tenantId: string, payload: LabelPayload) {
    const config = await this.getTenantConfig(tenantId);
    const url = `${config.chatwoot_url.replace(/\/$/, '')}/api/v1/accounts/${config.chatwoot_account_id}/labels`;
    
    const response = await axios.post(url, {
      title: payload.title,
      description: payload.description || '',
      color: payload.color || '#3b82f6',
      show_on_sidebar: payload.show_on_sidebar ?? true
    }, {
      headers: { 
        'api_access_token': config.chatwoot_access_token,
        'Content-Type': 'application/json'
      }
    });
    return response.data.payload || response.data;
  }

  async deleteLabel(tenantId: string, title: string) {
    const config = await this.getTenantConfig(tenantId);
    const url = `${config.chatwoot_url.replace(/\/$/, '')}/api/v1/accounts/${config.chatwoot_account_id}/labels/${encodeURIComponent(title)}`;
    
    const response = await axios.delete(url, {
      headers: { 'api_access_token': config.chatwoot_access_token }
    });
    return response.data;
  }

  // --- CHANNELS / INBOXES MANAGEMENT ---
  async getInboxes(tenantId: string) {
    const config = await this.getTenantConfig(tenantId);
    const url = `${config.chatwoot_url.replace(/\/$/, '')}/api/v1/accounts/${config.chatwoot_account_id}/inboxes`;
    
    const response = await axios.get(url, {
      headers: { 'api_access_token': config.chatwoot_access_token }
    });
    return response.data.payload || response.data || [];
  }

  async createInbox(tenantId: string, payload: InboxPayload) {
    const config = await this.getTenantConfig(tenantId);
    const url = `${config.chatwoot_url.replace(/\/$/, '')}/api/v1/accounts/${config.chatwoot_account_id}/inboxes`;
    
    let channelData: any = {};
    if (payload.channel_type === 'web_widget') {
      channelData = {
        type: 'web_widget',
        website_url: payload.website_url || 'https://sicsa.com.ni',
        welcome_title: 'Hola, ¿en qué podemos ayudarte?',
        welcome_tagline: 'Asistente virtual disponible 24/7'
      };
    } else {
      channelData = {
        type: 'api',
        webhook_url: `${process.env.APP_URL || 'https://ai.eitserv.tech'}/api/webhook/${tenantId}`
      };
    }

    const response = await axios.post(url, {
      name: payload.name,
      channel: channelData
    }, {
      headers: {
        'api_access_token': config.chatwoot_access_token,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  }

  // --- META WHATSAPP TEMPLATES (HSM) ---
  async getMetaTemplates(tenantId: string) {
    const config = await this.getTenantConfig(tenantId);
    const templates: MetaTemplate[] = [
      {
        name: 'confirmacion_cita_v2',
        category: 'UTILITY',
        language: 'es',
        status: 'APPROVED',
        components: [
          { type: 'HEADER', text: 'Confirmación de Cita Técnica - SICSA' },
          { type: 'BODY', text: '¡Hola {{1}}! Tu cita para {{2}} ha sido agendada con éxito para el {{3}} a las {{4}} hs.' },
          { type: 'FOOTER', text: 'SICSA Nicaragua - Servicio Oficial' }
        ]
      },
      {
        name: 'notificacion_stock_disponible',
        category: 'MARKETING',
        language: 'es',
        status: 'APPROVED',
        components: [
          { type: 'HEADER', text: '¡Tu producto ya está disponible!' },
          { type: 'BODY', text: 'Hola {{1}}, te notificamos que la laptop {{2}} que consultaste recientemente ya cuenta con unidades disponibles en stock.' },
          { type: 'FOOTER', text: 'Responde este mensaje para separar tu unidad.' }
        ]
      },
      {
        name: 'escalamiento_asesor_humano',
        category: 'UTILITY',
        language: 'es',
        status: 'APPROVED',
        components: [
          { type: 'BODY', text: 'Hola {{1}}, tu conversación ha sido transferida a nuestro asesor {{2}}. En un momento se pondrá en contacto contigo.' }
        ]
      }
    ];

    return {
      waba_status: 'ACTIVE',
      account_id: config.chatwoot_account_id,
      templates
    };
  }

  async sendMetaTemplate(tenantId: string, conversationId: string, templateName: string, params: string[]) {
    const config = await this.getTenantConfig(tenantId);
    const url = `${config.chatwoot_url.replace(/\/$/, '')}/api/v1/accounts/${config.chatwoot_account_id}/conversations/${conversationId}/messages`;
    
    let content = `[Plantilla Meta Autorizada: ${templateName}]\n`;
    params.forEach((p, idx) => {
      content += `• Variable {{${idx + 1}}}: ${p}\n`;
    });

    const response = await axios.post(url, {
      content,
      message_type: 'outgoing',
      private: false,
      content_attributes: {
        template_name: templateName,
        template_params: params,
        is_meta_hsm: true
      }
    }, {
      headers: {
        'api_access_token': config.chatwoot_access_token,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  }

  // --- PHASE 3: LIVE CONVERSATION MANAGEMENT & CUSTOM INBOX ---

  async getConversations(tenantId: string, status: string = 'all', page: number = 1) {
    const config = await this.getTenantConfig(tenantId);
    const url = `${config.chatwoot_url.replace(/\/$/, '')}/api/v1/accounts/${config.chatwoot_account_id}/conversations?status=${status}&page=${page}`;
    
    const response = await axios.get(url, {
      headers: { 'api_access_token': config.chatwoot_access_token }
    });
    return response.data.data?.payload || response.data.payload || response.data || [];
  }

  async getConversationMessages(tenantId: string, conversationId: string) {
    const config = await this.getTenantConfig(tenantId);
    const url = `${config.chatwoot_url.replace(/\/$/, '')}/api/v1/accounts/${config.chatwoot_account_id}/conversations/${conversationId}/messages`;
    
    const response = await axios.get(url, {
      headers: { 'api_access_token': config.chatwoot_access_token }
    });
    return response.data.payload || response.data || [];
  }

  async sendMessage(tenantId: string, conversationId: string, content: string, isPrivate: boolean = false) {
    const config = await this.getTenantConfig(tenantId);
    const url = `${config.chatwoot_url.replace(/\/$/, '')}/api/v1/accounts/${config.chatwoot_account_id}/conversations/${conversationId}/messages`;
    
    const response = await axios.post(url, {
      content,
      message_type: 'outgoing',
      private: isPrivate
    }, {
      headers: {
        'api_access_token': config.chatwoot_access_token,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  }

  async toggleStatus(tenantId: string, conversationId: string, status: 'open' | 'pending' | 'resolved' | 'snoozed') {
    const config = await this.getTenantConfig(tenantId);
    const url = `${config.chatwoot_url.replace(/\/$/, '')}/api/v1/accounts/${config.chatwoot_account_id}/conversations/${conversationId}/toggle_status`;
    
    const response = await axios.post(url, {
      status
    }, {
      headers: {
        'api_access_token': config.chatwoot_access_token,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  }

  async toggleLabel(tenantId: string, conversationId: string, labels: string[]) {
    const config = await this.getTenantConfig(tenantId);
    const url = `${config.chatwoot_url.replace(/\/$/, '')}/api/v1/accounts/${config.chatwoot_account_id}/conversations/${conversationId}/labels`;
    
    const response = await axios.post(url, {
      labels
    }, {
      headers: {
        'api_access_token': config.chatwoot_access_token,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  }

  async assignConversation(tenantId: string, conversationId: string, assigneeId: number | null, teamId?: number | null) {
    const config = await this.getTenantConfig(tenantId);
    const url = `${config.chatwoot_url.replace(/\/$/, '')}/api/v1/accounts/${config.chatwoot_account_id}/conversations/${conversationId}/assignments`;
    
    const response = await axios.post(url, {
      assignee_id: assigneeId,
      team_id: teamId
    }, {
      headers: {
        'api_access_token': config.chatwoot_access_token,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  }

  async getContacts(tenantId: string, page = 1) {
    const config = await this.getTenantConfig(tenantId);
    const url = `${config.chatwoot_url.replace(/\/$/, '')}/api/v1/accounts/${config.chatwoot_account_id}/contacts?page=${page}`;
    
    const response = await axios.get(url, {
      headers: {
        'api_access_token': config.chatwoot_access_token
      }
    });

    return response.data;
  }

  async createConversation(tenantId: string, contactId: number, inboxId?: number, message?: string) {
    const config = await this.getTenantConfig(tenantId);
    
    // Get inboxes if inboxId not provided
    let targetInboxId = inboxId;
    if (!targetInboxId) {
      const inboxes = await this.getInboxes(tenantId);
      if (inboxes.length > 0) {
        targetInboxId = inboxes[0].id;
      }
    }

    const url = `${config.chatwoot_url.replace(/\/$/, '')}/api/v1/accounts/${config.chatwoot_account_id}/conversations`;
    
    const response = await axios.post(url, {
      source_id: contactId,
      inbox_id: targetInboxId,
      contact_id: contactId,
      status: 'open',
      message: message ? { content: message } : undefined
    }, {
      headers: {
        'api_access_token': config.chatwoot_access_token,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  }
}

export const controlService = new ControlService();
