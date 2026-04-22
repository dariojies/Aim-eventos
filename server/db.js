const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

const initDB = async () => {
  // 1. Create Core Multi-Event Tables
  const multiEventTables = `
    CREATE TABLE IF NOT EXISTS race_organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      subdomain VARCHAR(100) UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS race_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID REFERENCES race_organizations(id),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      config JSONB DEFAULT '{}',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS race_staff (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id UUID REFERENCES race_events(id),
      email VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL, -- 'admin', 'teacher'
      assigned_course VARCHAR(100), -- for teachers
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(event_id, email)
    );
  `;

  // 2. Base Tables (Legacy/Standard)
  const baseTables = `
    CREATE TABLE IF NOT EXISTS race_registrations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id UUID REFERENCES race_events(id),
      type VARCHAR(50) NOT NULL,
      course VARCHAR(100),
      full_name VARCHAR(255) NOT NULL,
      total_participants INTEGER DEFAULT 1,
      ampa_members INTEGER DEFAULT 0,
      wants_shirts BOOLEAN DEFAULT false,
      shirt_4y INTEGER DEFAULT 0, shirt_8y INTEGER DEFAULT 0, shirt_12y INTEGER DEFAULT 0, shirt_16y INTEGER DEFAULT 0,
      shirt_s INTEGER DEFAULT 0, shirt_m INTEGER DEFAULT 0, shirt_l INTEGER DEFAULT 0, shirt_xl INTEGER DEFAULT 0, shirt_xxl INTEGER DEFAULT 0,
      observations TEXT,
      dorsal_start INTEGER,
      dorsal_end INTEGER,
      registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_paid BOOLEAN DEFAULT false,
      external_email VARCHAR(255),
      external_phone VARCHAR(50),
      wants_dorsal BOOLEAN DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS race_economic_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id UUID REFERENCES race_events(id),
      course VARCHAR(100) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      payment_date DATE NOT NULL,
      observations TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS race_sessions (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "race_sessions_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
    );
    CREATE INDEX IF NOT EXISTS "IDX_race_session_expire" ON race_sessions ("expire");
  `;

  try {
    await pool.query(multiEventTables);
    await pool.query(baseTables);
    
    // 3. ATOMIC MIGRATION Logic
    const migrationScript = `
      DO $$ 
      DECLARE
        org_id_var UUID;
        event_id_var UUID;
      BEGIN 
        -- Create Default Organization if none exists
        IF NOT EXISTS (SELECT 1 FROM race_organizations WHERE subdomain = 'huertadelacruz') THEN
          INSERT INTO race_organizations (name, subdomain) 
          VALUES ('Huerta de la Cruz', 'huertadelacruz') 
          RETURNING id INTO org_id_var;
        ELSE
          SELECT id INTO org_id_var FROM race_organizations WHERE subdomain = 'huertadelacruz';
        END IF;

        -- Create Default Event if none exists
        IF NOT EXISTS (SELECT 1 FROM race_events WHERE slug = 'marcha-solidaria') THEN
          INSERT INTO race_events (org_id, name, slug, config) 
          VALUES (org_id_var, 'Carrera Solidaria Huerta de la Cruz', 'marcha-solidaria', 
                 '{"colors":{"primary_gradient":"linear-gradient(135deg, #6366f1 0%, #a855f7 100%)", "accent":"#6366f1"}, "assets":{}}')
          RETURNING id INTO event_id_var;
        ELSE
          SELECT id INTO event_id_var FROM race_events WHERE slug = 'marcha-solidaria';
        END IF;

        -- Ensure event_id exists in target tables
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='race_registrations' AND column_name='event_id') THEN
          ALTER TABLE race_registrations ADD COLUMN event_id UUID REFERENCES race_events(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='race_economic_records' AND column_name='event_id') THEN
          ALTER TABLE race_economic_records ADD COLUMN event_id UUID REFERENCES race_events(id);
        END IF;

        -- Link all orphans to this event
        UPDATE race_registrations SET event_id = event_id_var WHERE event_id IS NULL;
        UPDATE race_economic_records SET event_id = event_id_var WHERE event_id IS NULL;

        -- Ensure older registrations have wants_dorsal = true
        UPDATE race_registrations SET wants_dorsal = true WHERE wants_dorsal IS NULL;

        -- Migrate Teachers
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'race_teacher_assignments') THEN
          INSERT INTO race_staff (event_id, email, role, assigned_course)
          SELECT event_id_var, email, 'teacher', assigned_course FROM race_teacher_assignments
          ON CONFLICT (event_id, email) DO NOTHING;
        END IF;

        -- Migrate Admins
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'race_admin_assignments') THEN
          INSERT INTO race_staff (event_id, email, role)
          SELECT event_id_var, email, 'admin' FROM race_admin_assignments
          ON CONFLICT (event_id, email) DO NOTHING;
        END IF;
      END $$;
    `;
    await pool.query(migrationScript);
    console.log('Database initialized and migrated successfully.');
  } catch (err) {
    console.error('Error during database initialization/migration:', err);
  }
};

module.exports = { pool, initDB };
