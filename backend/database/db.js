const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Configure the PostgreSQL connection pool
// Ensure you have DATABASE_URL defined in your .env file
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for most cloud databases (Render, Neon, Supabase)
  }
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

// Handle pool errors to prevent silent failures
pool.on('error', (err) => {
  console.error('Unexpected error on idle client in pool:', err);
});

// Asynchronous initialization function
async function initializeDatabase() {
  try {
    // 1. Run the base schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    await pool.query(schema);
    console.log('Database schema executed successfully.');

    // 2. Run migrations
    // PostgreSQL natively supports 'IF NOT EXISTS' for adding columns, 
    // making try/catch blocks for individual columns unnecessary.
    await pool.query(`
      ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS is_overridden INTEGER DEFAULT 0;
      ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS override_note TEXT;
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS class_account_id INTEGER;
    `);
    console.log('Migrations: Checked and applied successfully.');

  } catch (error) {
    console.error('Error initializing database:', error);
    throw error; // Re-throw so initialization promise rejects
  }
}

// Track database readiness
let dbReady = false;

// Initialize database and handle readiness state
initializeDatabase()
  .then(() => {
    dbReady = true;
    console.log('✅ Database ready for requests');
  })
  .catch((error) => {
    console.error('❌ Critical: Failed to initialize database:', error);
    process.exit(1);
  });

// Export a query wrapper, pool, and readiness check
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  isReady: () => dbReady
};