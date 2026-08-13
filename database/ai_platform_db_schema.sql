--
-- PostgreSQL database dump
--

\restrict Ip6uwXp46GDAhUFp0pCvDTByYghLDxbgjSGVyDuetdr5diO0gMWkJIVhtfieyPM

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: crm; Type: SCHEMA; Schema: -; Owner: ai_admin
--

CREATE SCHEMA crm;


ALTER SCHEMA crm OWNER TO ai_admin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: appointments; Type: TABLE; Schema: crm; Owner: ai_admin
--

CREATE TABLE crm.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying(64) NOT NULL,
    contact_id uuid,
    type character varying(32) DEFAULT 'showroom_visit'::character varying,
    status character varying(32) DEFAULT 'pending_confirm'::character varying,
    vehicle_label character varying(255),
    requested_date character varying(255),
    confirmed_date timestamp with time zone,
    end_time timestamp with time zone,
    location_id character varying(64),
    assigned_user_id character varying(64),
    notes text,
    advisor_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE crm.appointments OWNER TO ai_admin;

--
-- Name: contacts; Type: TABLE; Schema: crm; Owner: ai_admin
--

CREATE TABLE crm.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying(64) NOT NULL,
    name character varying(255),
    phone character varying(32),
    email character varying(255),
    preferred_channel character varying(32) DEFAULT 'whatsapp'::character varying,
    source character varying(32) DEFAULT 'whatsapp'::character varying,
    company_name character varying(255),
    tax_id character varying(32),
    external_crm_id character varying(255),
    external_crm_type character varying(32),
    identifiers jsonb DEFAULT '{}'::jsonb,
    tags jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE crm.contacts OWNER TO ai_admin;

--
-- Name: leads; Type: TABLE; Schema: crm; Owner: ai_admin
--

CREATE TABLE crm.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying(64) NOT NULL,
    contact_id uuid,
    session_id character varying(255),
    pipeline_type character varying(32) DEFAULT 'vehicle'::character varying NOT NULL,
    stage character varying(32) DEFAULT 'new'::character varying NOT NULL,
    score integer DEFAULT 0,
    intent_data jsonb DEFAULT '{}'::jsonb,
    assigned_to character varying(255),
    amount numeric(12,2),
    currency character varying(8) DEFAULT 'USD'::character varying,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    last_activity_at timestamp with time zone DEFAULT now()
);


ALTER TABLE crm.leads OWNER TO ai_admin;

--
-- Name: workshop_appointments; Type: TABLE; Schema: crm; Owner: ai_admin
--

CREATE TABLE crm.workshop_appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying(64) NOT NULL,
    contact_id uuid,
    service_type character varying(255),
    status character varying(32) DEFAULT 'scheduled'::character varying,
    appointment_date timestamp with time zone,
    end_time timestamp with time zone,
    location_id character varying(64),
    bay_number integer,
    notes text,
    advisor_name character varying(255),
    mechanic_name character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE crm.workshop_appointments OWNER TO ai_admin;

--
-- Name: agent_status_logs; Type: TABLE; Schema: public; Owner: ai_admin
--

CREATE TABLE public.agent_status_logs (
    id integer NOT NULL,
    tenant_id character varying(50),
    user_email character varying(255) NOT NULL,
    status character varying(50) NOT NULL,
    started_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ended_at timestamp without time zone
);


ALTER TABLE public.agent_status_logs OWNER TO ai_admin;

--
-- Name: agent_status_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: ai_admin
--

CREATE SEQUENCE public.agent_status_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.agent_status_logs_id_seq OWNER TO ai_admin;

--
-- Name: agent_status_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ai_admin
--

ALTER SEQUENCE public.agent_status_logs_id_seq OWNED BY public.agent_status_logs.id;


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: ai_admin
--

CREATE TABLE public.appointments (
    id integer NOT NULL,
    tenant_id character varying(50),
    customer_name character varying(100) NOT NULL,
    customer_phone character varying(50) NOT NULL,
    appointment_date date NOT NULL,
    appointment_time character varying(5) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    service character varying(255) DEFAULT 'Servicio Técnico'::character varying
);


ALTER TABLE public.appointments OWNER TO ai_admin;

--
-- Name: appointments_id_seq; Type: SEQUENCE; Schema: public; Owner: ai_admin
--

CREATE SEQUENCE public.appointments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.appointments_id_seq OWNER TO ai_admin;

--
-- Name: appointments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ai_admin
--

ALTER SEQUENCE public.appointments_id_seq OWNED BY public.appointments.id;


--
-- Name: crm_opportunities; Type: TABLE; Schema: public; Owner: ai_admin
--

CREATE TABLE public.crm_opportunities (
    id integer NOT NULL,
    tenant_id character varying(50) NOT NULL,
    contact_id character varying(100) NOT NULL,
    contact_name character varying(150),
    contact_phone character varying(50),
    conversation_id character varying(50),
    title character varying(255) NOT NULL,
    value numeric(12,2) DEFAULT 0.00,
    currency character varying(10) DEFAULT 'USD'::character varying,
    stage character varying(50) DEFAULT 'stage:prospecto'::character varying,
    probability integer DEFAULT 50,
    assigned_agent_name character varying(100),
    lost_reason character varying(100),
    lost_notes text,
    next_action_type character varying(50),
    next_action_date timestamp without time zone,
    next_action_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    next_followup_date date,
    last_activity_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notes text
);


ALTER TABLE public.crm_opportunities OWNER TO ai_admin;

--
-- Name: crm_opportunities_id_seq; Type: SEQUENCE; Schema: public; Owner: ai_admin
--

CREATE SEQUENCE public.crm_opportunities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.crm_opportunities_id_seq OWNER TO ai_admin;

--
-- Name: crm_opportunities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ai_admin
--

ALTER SEQUENCE public.crm_opportunities_id_seq OWNED BY public.crm_opportunities.id;


--
-- Name: crm_opportunity_activities; Type: TABLE; Schema: public; Owner: ai_admin
--

CREATE TABLE public.crm_opportunity_activities (
    id integer NOT NULL,
    opportunity_id integer,
    activity_type character varying(50) NOT NULL,
    description text NOT NULL,
    scheduled_at timestamp without time zone,
    completed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.crm_opportunity_activities OWNER TO ai_admin;

--
-- Name: crm_opportunity_activities_id_seq; Type: SEQUENCE; Schema: public; Owner: ai_admin
--

CREATE SEQUENCE public.crm_opportunity_activities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.crm_opportunity_activities_id_seq OWNER TO ai_admin;

--
-- Name: crm_opportunity_activities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ai_admin
--

ALTER SEQUENCE public.crm_opportunity_activities_id_seq OWNED BY public.crm_opportunity_activities.id;


--
-- Name: crm_saved_lists; Type: TABLE; Schema: public; Owner: ai_admin
--

CREATE TABLE public.crm_saved_lists (
    id integer NOT NULL,
    tenant_id character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    filter_query character varying(255),
    contact_ids jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.crm_saved_lists OWNER TO ai_admin;

--
-- Name: crm_saved_lists_id_seq; Type: SEQUENCE; Schema: public; Owner: ai_admin
--

CREATE SEQUENCE public.crm_saved_lists_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.crm_saved_lists_id_seq OWNER TO ai_admin;

--
-- Name: crm_saved_lists_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ai_admin
--

ALTER SEQUENCE public.crm_saved_lists_id_seq OWNED BY public.crm_saved_lists.id;


--
-- Name: crm_team_members; Type: TABLE; Schema: public; Owner: ai_admin
--

CREATE TABLE public.crm_team_members (
    id integer NOT NULL,
    team_id integer,
    user_email character varying(150) NOT NULL,
    user_name character varying(100),
    role_in_team character varying(50) DEFAULT 'member'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.crm_team_members OWNER TO ai_admin;

--
-- Name: crm_team_members_id_seq; Type: SEQUENCE; Schema: public; Owner: ai_admin
--

CREATE SEQUENCE public.crm_team_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.crm_team_members_id_seq OWNER TO ai_admin;

--
-- Name: crm_team_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ai_admin
--

ALTER SEQUENCE public.crm_team_members_id_seq OWNED BY public.crm_team_members.id;


--
-- Name: crm_teams; Type: TABLE; Schema: public; Owner: ai_admin
--

CREATE TABLE public.crm_teams (
    id integer NOT NULL,
    tenant_id character varying(50) NOT NULL,
    team_key character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    ai_keywords text,
    assignment_mode character varying(50) DEFAULT 'round_robin'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.crm_teams OWNER TO ai_admin;

--
-- Name: crm_teams_id_seq; Type: SEQUENCE; Schema: public; Owner: ai_admin
--

CREATE SEQUENCE public.crm_teams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.crm_teams_id_seq OWNER TO ai_admin;

--
-- Name: crm_teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ai_admin
--

ALTER SEQUENCE public.crm_teams_id_seq OWNED BY public.crm_teams.id;


--
-- Name: knowledge_base; Type: TABLE; Schema: public; Owner: ai_admin
--

CREATE TABLE public.knowledge_base (
    tenant_id character varying(50) NOT NULL,
    faqs text DEFAULT ''::text,
    bank_accounts text DEFAULT ''::text,
    branches text DEFAULT ''::text,
    timezone character varying(50) DEFAULT 'America/Managua'::character varying,
    mon_fri_start character varying(5) DEFAULT '08:00'::character varying,
    mon_fri_end character varying(5) DEFAULT '17:30'::character varying,
    sat_start character varying(5) DEFAULT '09:00'::character varying,
    sat_end character varying(5) DEFAULT '12:30'::character varying,
    sun_enabled integer DEFAULT 0,
    services text DEFAULT ''::text
);


ALTER TABLE public.knowledge_base OWNER TO ai_admin;

--
-- Name: logs; Type: TABLE; Schema: public; Owner: ai_admin
--

CREATE TABLE public.logs (
    id integer NOT NULL,
    tenant_id character varying(50),
    conversation_id character varying(100) NOT NULL,
    role character varying(20) NOT NULL,
    content text NOT NULL,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.logs OWNER TO ai_admin;

--
-- Name: logs_id_seq; Type: SEQUENCE; Schema: public; Owner: ai_admin
--

CREATE SEQUENCE public.logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.logs_id_seq OWNER TO ai_admin;

--
-- Name: logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ai_admin
--

ALTER SEQUENCE public.logs_id_seq OWNED BY public.logs.id;


--
-- Name: lost_sales; Type: TABLE; Schema: public; Owner: ai_admin
--

CREATE TABLE public.lost_sales (
    id integer NOT NULL,
    tenant_id character varying(50),
    product_id character varying(100) NOT NULL,
    product_name character varying(255) NOT NULL,
    customer_phone character varying(50) NOT NULL,
    conversation_id character varying(100) NOT NULL,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.lost_sales OWNER TO ai_admin;

--
-- Name: lost_sales_id_seq; Type: SEQUENCE; Schema: public; Owner: ai_admin
--

CREATE SEQUENCE public.lost_sales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lost_sales_id_seq OWNER TO ai_admin;

--
-- Name: lost_sales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ai_admin
--

ALTER SEQUENCE public.lost_sales_id_seq OWNED BY public.lost_sales.id;


--
-- Name: product_queries; Type: TABLE; Schema: public; Owner: ai_admin
--

CREATE TABLE public.product_queries (
    id integer NOT NULL,
    tenant_id character varying(50),
    product_id character varying(100) NOT NULL,
    product_name character varying(255) NOT NULL,
    conversation_id character varying(100) NOT NULL,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.product_queries OWNER TO ai_admin;

--
-- Name: product_queries_id_seq; Type: SEQUENCE; Schema: public; Owner: ai_admin
--

CREATE SEQUENCE public.product_queries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_queries_id_seq OWNER TO ai_admin;

--
-- Name: product_queries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ai_admin
--

ALTER SEQUENCE public.product_queries_id_seq OWNED BY public.product_queries.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: ai_admin
--

CREATE TABLE public.products (
    id character varying(100) NOT NULL,
    tenant_id character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    price numeric(10,2) NOT NULL,
    stock integer DEFAULT 0,
    description text DEFAULT ''::text,
    url text DEFAULT ''::text,
    category character varying(100) DEFAULT ''::character varying,
    brand character varying(100) DEFAULT ''::character varying
);


ALTER TABLE public.products OWNER TO ai_admin;

--
-- Name: tenant_configs; Type: TABLE; Schema: public; Owner: ai_admin
--

CREATE TABLE public.tenant_configs (
    tenant_id character varying(50) NOT NULL,
    active_provider character varying(20) DEFAULT 'gemini'::character varying,
    gemini_api_key text DEFAULT ''::text,
    deepseek_api_key text DEFAULT ''::text,
    system_prompt text DEFAULT 'Eres un asistente de IA para nuestro negocio...'::text,
    chatwoot_url text DEFAULT ''::text,
    chatwoot_access_token text DEFAULT ''::text,
    chatwoot_account_id integer DEFAULT 1,
    chatwoot_website_token text DEFAULT ''::text,
    redis_host character varying(255) DEFAULT 'localhost'::character varying,
    redis_port integer DEFAULT 6379,
    redis_password text DEFAULT ''::text,
    redis_enabled integer DEFAULT 0,
    escalation_keywords text DEFAULT 'humano,asesor,representante,persona,soporte,operador'::text,
    max_fallback_attempts integer DEFAULT 3,
    escalation_instructions text DEFAULT ''::text,
    allow_ai_escalation boolean DEFAULT true,
    escalation_team_id integer,
    phone_number_id text,
    waba_id text,
    meta_access_token text,
    meta_app_id text,
    emergency_ai_mode boolean DEFAULT false,
    ai_enabled_during_hours boolean DEFAULT false,
    ai_enabled_after_hours boolean DEFAULT true,
    ai_auto_create_opportunities boolean DEFAULT true,
    auto_assign_on_reply boolean DEFAULT false,
    enable_idle_ai_rescue boolean DEFAULT true,
    idle_rescue_timeout_minutes integer DEFAULT 10,
    idle_rescue_strict_governance boolean DEFAULT true,
    idle_rescue_tag character varying(100) DEFAULT 'sin-comision-ia'::character varying,
    default_view_only_mine boolean DEFAULT true,
    enable_typing_lock boolean DEFAULT true,
    use_direct_sql_messages boolean DEFAULT true
);


ALTER TABLE public.tenant_configs OWNER TO ai_admin;

--
-- Name: tenants; Type: TABLE; Schema: public; Owner: ai_admin
--

CREATE TABLE public.tenants (
    id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.tenants OWNER TO ai_admin;

--
-- Name: users; Type: TABLE; Schema: public; Owner: ai_admin
--

CREATE TABLE public.users (
    id integer NOT NULL,
    tenant_id character varying(50),
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    role character varying(20) DEFAULT 'admin'::character varying,
    name character varying(255) DEFAULT ''::character varying
);


ALTER TABLE public.users OWNER TO ai_admin;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: ai_admin
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO ai_admin;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ai_admin
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: agent_status_logs id; Type: DEFAULT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.agent_status_logs ALTER COLUMN id SET DEFAULT nextval('public.agent_status_logs_id_seq'::regclass);


--
-- Name: appointments id; Type: DEFAULT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.appointments ALTER COLUMN id SET DEFAULT nextval('public.appointments_id_seq'::regclass);


--
-- Name: crm_opportunities id; Type: DEFAULT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.crm_opportunities ALTER COLUMN id SET DEFAULT nextval('public.crm_opportunities_id_seq'::regclass);


--
-- Name: crm_opportunity_activities id; Type: DEFAULT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.crm_opportunity_activities ALTER COLUMN id SET DEFAULT nextval('public.crm_opportunity_activities_id_seq'::regclass);


--
-- Name: crm_saved_lists id; Type: DEFAULT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.crm_saved_lists ALTER COLUMN id SET DEFAULT nextval('public.crm_saved_lists_id_seq'::regclass);


--
-- Name: crm_team_members id; Type: DEFAULT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.crm_team_members ALTER COLUMN id SET DEFAULT nextval('public.crm_team_members_id_seq'::regclass);


--
-- Name: crm_teams id; Type: DEFAULT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.crm_teams ALTER COLUMN id SET DEFAULT nextval('public.crm_teams_id_seq'::regclass);


--
-- Name: logs id; Type: DEFAULT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.logs ALTER COLUMN id SET DEFAULT nextval('public.logs_id_seq'::regclass);


--
-- Name: lost_sales id; Type: DEFAULT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.lost_sales ALTER COLUMN id SET DEFAULT nextval('public.lost_sales_id_seq'::regclass);


--
-- Name: product_queries id; Type: DEFAULT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.product_queries ALTER COLUMN id SET DEFAULT nextval('public.product_queries_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: crm; Owner: ai_admin
--

ALTER TABLE ONLY crm.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: crm; Owner: ai_admin
--

ALTER TABLE ONLY crm.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: crm; Owner: ai_admin
--

ALTER TABLE ONLY crm.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: contacts uq_contacts_tenant_phone; Type: CONSTRAINT; Schema: crm; Owner: ai_admin
--

ALTER TABLE ONLY crm.contacts
    ADD CONSTRAINT uq_contacts_tenant_phone UNIQUE (tenant_id, phone);


--
-- Name: workshop_appointments workshop_appointments_pkey; Type: CONSTRAINT; Schema: crm; Owner: ai_admin
--

ALTER TABLE ONLY crm.workshop_appointments
    ADD CONSTRAINT workshop_appointments_pkey PRIMARY KEY (id);


--
-- Name: agent_status_logs agent_status_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.agent_status_logs
    ADD CONSTRAINT agent_status_logs_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_tenant_id_appointment_date_appointment_time_key; Type: CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_tenant_id_appointment_date_appointment_time_key UNIQUE (tenant_id, appointment_date, appointment_time);


--
-- Name: crm_opportunities crm_opportunities_pkey; Type: CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.crm_opportunities
    ADD CONSTRAINT crm_opportunities_pkey PRIMARY KEY (id);


--
-- Name: crm_opportunity_activities crm_opportunity_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.crm_opportunity_activities
    ADD CONSTRAINT crm_opportunity_activities_pkey PRIMARY KEY (id);


--
-- Name: crm_saved_lists crm_saved_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.crm_saved_lists
    ADD CONSTRAINT crm_saved_lists_pkey PRIMARY KEY (id);


--
-- Name: crm_team_members crm_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.crm_team_members
    ADD CONSTRAINT crm_team_members_pkey PRIMARY KEY (id);


--
-- Name: crm_team_members crm_team_members_team_id_user_email_key; Type: CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.crm_team_members
    ADD CONSTRAINT crm_team_members_team_id_user_email_key UNIQUE (team_id, user_email);


--
-- Name: crm_teams crm_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.crm_teams
    ADD CONSTRAINT crm_teams_pkey PRIMARY KEY (id);


--
-- Name: crm_teams crm_teams_tenant_id_team_key_key; Type: CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.crm_teams
    ADD CONSTRAINT crm_teams_tenant_id_team_key_key UNIQUE (tenant_id, team_key);


--
-- Name: knowledge_base knowledge_base_pkey; Type: CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.knowledge_base
    ADD CONSTRAINT knowledge_base_pkey PRIMARY KEY (tenant_id);


--
-- Name: logs logs_pkey; Type: CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.logs
    ADD CONSTRAINT logs_pkey PRIMARY KEY (id);


--
-- Name: lost_sales lost_sales_pkey; Type: CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.lost_sales
    ADD CONSTRAINT lost_sales_pkey PRIMARY KEY (id);


--
-- Name: product_queries product_queries_pkey; Type: CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.product_queries
    ADD CONSTRAINT product_queries_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (tenant_id, id);


--
-- Name: tenant_configs tenant_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.tenant_configs
    ADD CONSTRAINT tenant_configs_pkey PRIMARY KEY (tenant_id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_contact_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: ai_admin
--

ALTER TABLE ONLY crm.appointments
    ADD CONSTRAINT appointments_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES crm.contacts(id) ON DELETE CASCADE;


--
-- Name: leads leads_contact_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: ai_admin
--

ALTER TABLE ONLY crm.leads
    ADD CONSTRAINT leads_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES crm.contacts(id) ON DELETE SET NULL;


--
-- Name: workshop_appointments workshop_appointments_contact_id_fkey; Type: FK CONSTRAINT; Schema: crm; Owner: ai_admin
--

ALTER TABLE ONLY crm.workshop_appointments
    ADD CONSTRAINT workshop_appointments_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES crm.contacts(id) ON DELETE CASCADE;


--
-- Name: agent_status_logs agent_status_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.agent_status_logs
    ADD CONSTRAINT agent_status_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: crm_opportunity_activities crm_opportunity_activities_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.crm_opportunity_activities
    ADD CONSTRAINT crm_opportunity_activities_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.crm_opportunities(id) ON DELETE CASCADE;


--
-- Name: crm_team_members crm_team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.crm_team_members
    ADD CONSTRAINT crm_team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.crm_teams(id) ON DELETE CASCADE;


--
-- Name: knowledge_base knowledge_base_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.knowledge_base
    ADD CONSTRAINT knowledge_base_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: logs logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.logs
    ADD CONSTRAINT logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: lost_sales lost_sales_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.lost_sales
    ADD CONSTRAINT lost_sales_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: product_queries product_queries_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.product_queries
    ADD CONSTRAINT product_queries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: products products_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_configs tenant_configs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.tenant_configs
    ADD CONSTRAINT tenant_configs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: users users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ai_admin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict Ip6uwXp46GDAhUFp0pCvDTByYghLDxbgjSGVyDuetdr5diO0gMWkJIVhtfieyPM

