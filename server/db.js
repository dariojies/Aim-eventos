const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

const initDB = async () => {
  // Migration: Rename old tables to use 'race_' prefix if they exist
  const migrationQuery = `
    DO $$ 
    BEGIN 
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teacher_assignments') THEN
        ALTER TABLE teacher_assignments RENAME TO race_teacher_assignments;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_assignments') THEN
        ALTER TABLE admin_assignments RENAME TO race_admin_assignments;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'economic_records') THEN
        ALTER TABLE economic_records RENAME TO race_economic_records;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'session') THEN
        ALTER TABLE session RENAME TO race_sessions;
      END IF;
    END $$;
  `;

  try {
    await pool.query(migrationQuery);
  } catch (err) {
    console.error('Migration failed (maybe already renamed):', err.message);
  }

  const queryText = `
    CREATE TABLE IF NOT EXISTS race_registrations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type VARCHAR(50) NOT NULL,
      course VARCHAR(100),
      full_name VARCHAR(255) NOT NULL,
      total_participants INTEGER DEFAULT 1,
      ampa_members INTEGER DEFAULT 0,
      wants_shirts BOOLEAN DEFAULT false,
      shirt_4y INTEGER DEFAULT 0,
      shirt_8y INTEGER DEFAULT 0,
      shirt_12y INTEGER DEFAULT 0,
      shirt_16y INTEGER DEFAULT 0,
      shirt_s INTEGER DEFAULT 0,
      shirt_m INTEGER DEFAULT 0,
      shirt_l INTEGER DEFAULT 0,
      shirt_xl INTEGER DEFAULT 0,
      shirt_xxl INTEGER DEFAULT 0,
      observations TEXT,
      dorsal_start INTEGER,
      dorsal_end INTEGER,
      registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_paid BOOLEAN DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS race_teacher_assignments (
      email VARCHAR(255) PRIMARY KEY,
      assigned_course VARCHAR(100) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS race_admin_assignments (
      email VARCHAR(255) PRIMARY KEY,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Ensure is_paid exists for existing databases
    DO $$ 
    BEGIN 
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='race_registrations' AND column_name='is_paid') THEN
        ALTER TABLE race_registrations ADD COLUMN is_paid BOOLEAN DEFAULT false;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='race_registrations' AND column_name='external_email') THEN
        ALTER TABLE race_registrations ADD COLUMN external_email VARCHAR(255);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='race_registrations' AND column_name='external_phone') THEN
        ALTER TABLE race_registrations ADD COLUMN external_phone VARCHAR(50);
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS race_economic_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      course VARCHAR(100) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      payment_date DATE NOT NULL,
      observations TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS race_sessions (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL
    );

    DO $$ 
    BEGIN 
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='race_sessions_pkey') THEN
        ALTER TABLE race_sessions ADD CONSTRAINT "race_sessions_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS "IDX_race_session_expire" ON race_sessions ("expire");
  `;
  try {
    await pool.query(queryText);
    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};

module.exports = { pool, initDB };
