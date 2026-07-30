CREATE TABLE IF NOT EXISTS crm_teams (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    team_key VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    ai_keywords TEXT,
    assignment_mode VARCHAR(50) DEFAULT 'round_robin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, team_key)
);

INSERT INTO crm_teams (tenant_id, team_key, name, description, ai_keywords, assignment_mode)
VALUES 
('sicsa', 'ventas_retail', 'Ventas Retail / Sucursales', 'Atención a clientes individuales y laptops personales', 'laptop, precio, tienda, horario, comprar, personal, teclado, mouse', 'round_robin'),
('sicsa', 'ventas_b2b', 'Ventas Corporativas (B2B)', 'Atención a empresas, compras por volumen y licitaciones', 'empresa, volumen, licitacion, proforma corporativa, credito, mayoreo', 'round_robin'),
('sicsa', 'soporte_tecnico', 'Soporte Técnico & Garantías', 'Diagnóstico técnico, mantenimiento y repuestos', 'garantia, falla, repuesto, reparacion, soporte tecnico, pantalla rota', 'manual')
ON CONFLICT (tenant_id, team_key) DO UPDATE 
SET name = EXCLUDED.name, description = EXCLUDED.description, ai_keywords = EXCLUDED.ai_keywords;

SELECT id, team_key, name, assignment_mode, ai_keywords FROM crm_teams WHERE tenant_id = 'sicsa';
