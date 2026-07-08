# AI Platform - Administrador Inteligente de Agentes Multitenant

Una plataforma SaaS multitenant premium diseñada para conectar bandejas de entrada de **Chatwoot** con potentes agentes de Inteligencia Artificial (**Google Gemini** y **DeepSeek**) optimizados mediante **Llamadas a Funciones (Tool Calling)**. 

El sistema permite a empresas (inquilinos) automatizar la atención a clientes, buscar en su catálogo de productos local en PostgreSQL, responder consultas de su base de conocimiento y **agendar/gestionar citas en tiempo real** directamente desde WhatsApp sin salir del chat.

---

## Características Principales

### 1. Arquitectura Multitenant & Aislamiento de Datos
* **Aislamiento Total**: Cada empresa (Tenant) posee configuraciones, tokens de Chatwoot, API keys, catálogo de productos, base de conocimiento y agenda de citas 100% independientes y protegidos.
* **Control de Acceso Basado en Roles (RBAC)**:
  * `superadmin`: Acceso global a todas las empresas, creación de inquilinos y copiado de tokens de API pre-firmados para integraciones externas.
  * `admin`: Acceso de lectura/escritura a la configuración de su propio Tenant (Base de conocimiento, productos, agenda).
  * `readonly`: Permisos exclusivos de lectura para auditoría; bloquea modificaciones y despliega alertas visuales en el panel.

### 2. Motor de IA Inteligente y Liviano (Tool Calling / Function Calling)
Migramos del bloatware de prompts estáticos a llamadas a funciones dinámicas de IA nativas tanto en **Gemini 2.5 Flash** como en **DeepSeek-Chat (V3/R1)**:
* **`search_products(query)`**: Busca coincidencias semánticas y por SKU en el catálogo de productos local de PostgreSQL de la empresa y registra analíticas de consulta.
* **`get_faq_info()`**: Consulta políticas, cuentas bancarias y listado de servicios ofrecidos del inquilino.
* **`get_business_info()`**: Obtiene la dirección de sucursales, horarios comerciales y zonas horarias.
* **`check_availability(date)`**: Consulta dinámicamente horarios disponibles para reservar en la base de datos (de 09:00 AM a 17:00 PM), excluyendo domingos y citas ya ocupadas.
* **`book_appointment(date, time, name, phone, service)`**: Registra citas de servicios/mantenimiento en tiempo real directo desde la conversación.

### 3. Panel de Control Web Premium (Aesthetics "Vibe Code")
* Interfaz premium oscura con sombras suaves, efectos de glassmorphism y reset de caja (`border-box`) libre de emojis para una estética industrial limpia.
* **Agenda de Citas Interactiva**:
  * Selector de fecha para consultar el estado del día.
  * Grilla visual horaria con estados (**Disponible** en verde / **Ocupado** en rojo con detalles del cliente y servicio).
  * Modal interactivo para **crear reservas manuales** directamente desde la grilla.
  * Botón para dar de baja o cancelar citas.
* **Sección de Usuarios**: Creación de administradores y copiado rápido de tokens JWT firmados a 30 días para uso externo.
* **Conexión de Webhooks**: Generación automática de URL de webhook dinámico de Chatwoot para cada Tenant.
* **Historial e Ingesta de Productos**: Pestaña dedicada para verificar logs de conversación en vivo y analytics de productos más consultados.

---

## Arquitectura de Base de Datos (PostgreSQL)

```mermaid
erDiagram
    tenants ||--o{ users : "has"
    tenants ||--|| tenant_configs : "has"
    tenants ||--o{ products : "owns"
    tenants ||--|| knowledge_base : "has"
    tenants ||--o{ appointments : "schedules"
    tenants ||--o{ product_queries : "tracks"
    tenants ||--o{ logs : "stores"

    tenants {
        string id PK "Slug del Tenant"
        string name "Nombre Empresa"
    }
    users {
        int id PK
        string tenant_id FK
        string email
        string password_hash
        string role "superadmin | admin | readonly"
    }
    appointments {
        int id PK
        string tenant_id FK
        string customer_name
        string customer_phone
        string appointment_date
        string appointment_time
        string service "Tipo de Servicio"
    }
```

---

## Tecnologías Utilizadas

* **Backend**: Node.js, TypeScript, Express, PostgreSQL (`pg`), Axios, JWT, Bcrypt.
* **Frontend**: React (TypeScript), Vite, Vanilla CSS con variables personalizadas HSL.
* **Infraestructura**: Docker, Docker Compose, Nginx.

---

## Instalación y Configuración Local

1. **Requisitos**: Node.js (v20+), PostgreSQL local o en Docker.
2. **Configuración de Variables de Entorno (`.env`)**:
   Crea un archivo `.env` en la carpeta `backend/`:
   ```env
   PORT=4000
   DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/ai_platform_db
   JWT_SECRET=tu_secreto_super_seguro
   ```
3. **Iniciar el Backend**:
   ```bash
   cd backend
   npm install
   npm run build
   npm start
   ```
4. **Iniciar el Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## Despliegue con Docker Compose

La aplicación cuenta con una Dockerfile multi-stage optimizada. Para desplegar en un VPS de producción:
```bash
docker compose up --build -d
```
El servidor web quedará escuchando en el puerto `4000`.
