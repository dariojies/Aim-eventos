const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

const initDB = async () => {
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
      registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(queryText);
    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};

module.exports = { pool, initDB };
