import psycopg2
from psycopg2.extras import RealDictCursor

db_params = {
    "host": "localhost",
    "port": 5432,
    "database": "ai_platform_db",
    "user": "postgres",
    "password": "!AdminRoot510"
}

def run_migration():
    conn = psycopg2.connect(**db_params)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute("""
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
    """)
    
    default_teams = [
        ('sicsa', 'ventas_retail', 'Ventas Retail / Sucursales', 'Atención a clientes individuales, consultas de precios de contado y laptops personales', 'laptop, precio, tienda, horario, comprar, personal, teclado, mouse', 'round_robin'),
        ('sicsa', 'ventas_b2b', 'Ventas Corporativas (B2B)', 'Atención a empresas, compras por volumen, licitaciones y facturación al crédito', 'empresa, volumen, licitacion, proforma corporativa, credito, mayoreo, 10 unidades', 'round_robin'),
        ('sicsa', 'soporte_tecnico', 'Soporte Técnico & Garantías', 'Diagnóstico técnico, mantenimiento de equipos, repuestos y servicio en garantía', 'garantia, falla, repuesto, reparacion, soporte tecnico, pantalla rota, no enciende', 'manual')
    ]
    
    for t in default_teams:
        cursor.execute("""
            INSERT INTO crm_teams (tenant_id, team_key, name, description, ai_keywords, assignment_mode)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (tenant_id, team_key) DO UPDATE 
            SET name = EXCLUDED.name, description = EXCLUDED.description, ai_keywords = EXCLUDED.ai_keywords;
        """, t)
        
    conn.commit()
    
    cursor.execute("SELECT * FROM crm_teams WHERE tenant_id = 'sicsa';")
    rows = cursor.fetchall()
    print(f"Migrated crm_teams table! Total teams: {len(rows)}")
    for r in rows:
        print(f" - [{r['team_key']}] {r['name']} | Mode: {r['assignment_mode']} | Keywords: {r['ai_keywords']}")
        
    cursor.close()
    conn.close()

if __name__ == '__main__':
    run_migration()
