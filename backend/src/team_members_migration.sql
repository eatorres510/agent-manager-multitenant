CREATE TABLE IF NOT EXISTS crm_team_members (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES crm_teams(id) ON DELETE CASCADE,
    user_email VARCHAR(150) NOT NULL,
    user_name VARCHAR(100),
    role_in_team VARCHAR(50) DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_email)
);

-- Seed initial team members for sicsa tenant
INSERT INTO crm_team_members (team_id, user_email, user_name, role_in_team)
SELECT t.id, 'jovanela@sicsa.com.ni', 'Jovanela', 'leader'
FROM crm_teams t WHERE t.tenant_id = 'sicsa' AND t.team_key = 'ventas_b2b'
ON CONFLICT (team_id, user_email) DO NOTHING;

INSERT INTO crm_team_members (team_id, user_email, user_name, role_in_team)
SELECT t.id, 'adonis@sicsa.com.ni', 'Adonis', 'member'
FROM crm_teams t WHERE t.tenant_id = 'sicsa' AND t.team_key = 'ventas_b2b'
ON CONFLICT (team_id, user_email) DO NOTHING;

INSERT INTO crm_team_members (team_id, user_email, user_name, role_in_team)
SELECT t.id, 'mario@sicsa.com.ni', 'Mario Lumbi', 'member'
FROM crm_teams t WHERE t.tenant_id = 'sicsa' AND t.team_key = 'ventas_retail'
ON CONFLICT (team_id, user_email) DO NOTHING;

INSERT INTO crm_team_members (team_id, user_email, user_name, role_in_team)
SELECT t.id, 'toribio@sicsa.com.ni', 'Toribio', 'leader'
FROM crm_teams t WHERE t.tenant_id = 'sicsa' AND t.team_key = 'soporte_tecnico'
ON CONFLICT (team_id, user_email) DO NOTHING;

SELECT tm.id, t.name as team_name, tm.user_name, tm.user_email, tm.role_in_team 
FROM crm_team_members tm
JOIN crm_teams t ON tm.team_id = t.id;
