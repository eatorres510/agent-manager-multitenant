# Base de Conocimiento — Plataforma Multitenant salesengine.eitserv.tech

## 📌 Identificación del Sistema
- **Dominio Público:** `https://salesengine.eitserv.tech/`
- **Servidor:** VPS Hostinger `31.220.107.80`
- **Enrutador / SSL:** Traefik (`/etc/easypanel/traefik/config/salesengine.yaml`)
- **Contenedor:** Docker `chatwoot-ai-platform` (Puerto interno `4000`)
- **Tenant Principal en Producción:** SICSA (`etorres@sicsa.com.ni`)

---

## 🛡️ Estado y Delimitación Operativa

1. **Estado del Sistema:**
   - **Restaurado a su panel original** (`chatwoot-ai-platform` en puerto `4000` sobre el VPS `31.220.107.80`).
   - **Sin modificaciones en su flujo de trabajo operativo interno.**

2. **Alcance de UX Impeccable:**
   - Se aplicó **exclusivamente al Login / Landing Page de Acceso**.
   - El login presenta la identidad **FrankieCore AI** (*Enterprise AI Agent Platform*), eliminando menciones a Chatwoot en las tarjetas públicas de presentación.

3. **Flujo de Trabajo Interno (Intacto):**
   - **Operaciones & Ventas:** Inicio / Home del Asesor, Bandeja en Vivo (Chats), Pipeline CRM (Kanban), Directorio de Leads, Agenda de Citas.
   - **Agente IA:** Ajustes del Agente (Gemini / DeepSeek), Base de Conocimiento, Catálogo de Productos (4,902 artículos sincronizados).
   - **Informes & Analítica:** Reportes BI, Ventas Perdidas, Auditoría de Chats, Bitácora en Vivo.
   - **Canales & Sistema:** Control Plane (Meta Cloud API), Conectar Webhook, Gestión de Equipos.

---

## 🗺️ Separación de Proyectos en el Ecosistema

| Propiedad | Proyecto A: `salesengine.eitserv.tech` | Proyecto B: `FrankieCore AI Cockpit` |
| :--- | :--- | :--- |
| **Repositorio / Carpeta** | `chatwoot-ai-platform` | `eit-services-crm-platform` |
| **Servidor Host** | VPS `31.220.107.80:4000` (Traefik) | VPS `69.62.65.147:7070` |
| **Propósito Principal** | Panel Operativo Multitenant & Atención SICSA | Cockpit Ejecutivo 360°, Flota de 14 Trabajadores & Telemetría |
| **Estado UX Impeccable** | Aplicado **únicamente al Login** | Aplicado a toda la suite ejecutiva |
