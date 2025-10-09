import { pool, inMemoryData, getUseDatabase } from '../config/database.js';

// Get device summary
export const getDeviceSummary = async (deviceId) => {
  if (getUseDatabase()) {
    const { rows } = await pool.query(
      `SELECT 
        device_id,
        COUNT(*) as total_records,
        MAX(timestamp) as last_seen
       FROM data_sensor 
       WHERE device_id = $1
       GROUP BY device_id`,
      [deviceId]
    );
    
    if (rows.length > 0) {
      return rows[0];
    } else {
      return { device_id: deviceId, message: 'No data yet' };
    }
  } else {
    // In-memory fallback
    const deviceData = inMemoryData.dataSensor.filter(d => d.device_id === deviceId);
    const lastSeen = deviceData.length > 0 
      ? Math.max(...deviceData.map(d => d.timestamp))
      : null;
    
    return {
      device_id: deviceId,
      total_records: deviceData.length,
      last_seen: lastSeen ? new Date(lastSeen) : null
    };
  }
};

