import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// PostgreSQL Connection Pool
export const pool = new pg.Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  user: process.env.PG_USER,
  password: process.env.PG_PASS,
  database: process.env.PG_DB,
});

// In-memory storage (fallback when DB is unavailable)
export const inMemoryData = {
  dataSensor: [],
  deviceActions: []
};

export let useDatabase = false;

// Test DB connection and set useDatabase flag
export const initializeDatabase = async () => {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connected:', res.rows[0].now);
    useDatabase = true;
    return true;
  } catch (err) {
    console.error('❌ PostgreSQL connection failed:', err.message);
    console.log('⚠️  Running WITHOUT database - using in-memory storage');
    console.log('💡 Data will be lost on restart');
    useDatabase = false;
    return false;
  }
};

// Update useDatabase flag
export const setUseDatabase = (value) => {
  useDatabase = value;
};

// Get useDatabase flag
export const getUseDatabase = () => useDatabase;

// Cleanup old data (>30 days)
export const cleanupOldData = async () => {
  if (!useDatabase) return;
  
  try {
    const result = await pool.query(
      `DELETE FROM data_sensor WHERE timestamp < NOW() - INTERVAL '30 days'`
    );
    console.log(`🧹 Cleanup: Deleted ${result.rowCount} old records (>30 days)`);
  } catch (err) {
    console.error('❌ Cleanup error:', err.message);
  }
};

