import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import mqtt from 'mqtt';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(bodyParser.json());

// PostgreSQL Connection
const pool = new pg.Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  user: process.env.PG_USER,
  password: process.env.PG_PASS,
  database: process.env.PG_DB,
});

// In-memory storage (fallback khi không có DB)
const inMemoryData = {
  dataSensor: [],    // Thay telemetry → data_sensor
  deviceActions: []  // Thay controls → device_actions
};

let useDatabase = false;

// Test DB connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ PostgreSQL connection failed:', err.message);
    console.log('⚠️  Running WITHOUT database - using in-memory storage');
    console.log('💡 Data will be lost on restart');
    useDatabase = false;
  } else {
    console.log('✅ PostgreSQL connected:', res.rows[0].now);
    useDatabase = true;
  }
});

// MQTT Client
const mqttClient = mqtt.connect(process.env.MQTT_URL, {
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASS,
  keepalive: 60,
  reconnectPeriod: 2000,
  clientId: 'iot-server-' + Math.random().toString(16).slice(2, 8)
});

const TOPICS = {
  telemetry: 'iot/+/telemetry',
  ledStatus: 'iot/+/led/status',
  status: 'iot/+/status'
};

mqttClient.on('connect', () => {
  console.log('✅ MQTT connected to broker');
  mqttClient.subscribe([TOPICS.telemetry, TOPICS.ledStatus, TOPICS.status], { qos: 1 }, (err) => {
    if (err) {
      console.error('❌ MQTT subscribe failed:', err);
    } else {
      console.log('📡 Subscribed to topics:', Object.values(TOPICS));
    }
  });
});

mqttClient.on('error', (err) => {
  console.error('❌ MQTT error:', err.message);
});

mqttClient.on('offline', () => {
  console.log('⚠️  MQTT offline, reconnecting...');
});

// MQTT Message Handler
mqttClient.on('message', async (topic, payload) => {
  try {
    const parts = topic.split('/');
    const deviceId = parts[1];
    
    console.log(`📥 [${topic}] ${payload.toString()}`);

    if (topic.endsWith('/telemetry')) {
      const data = JSON.parse(payload.toString());
      const timestamp = new Date();
      
      // Lưu từng sensor riêng biệt theo schema mới
      const sensors = [
        { type: 'temperature', value: data.temperature, unit: '°C' },
        { type: 'humidity', value: data.humidity, unit: '%' },
        { type: 'light', value: data.light, unit: 'nits' }
      ];
      
      if (useDatabase) {
        // Insert từng sensor vào data_sensor table
        for (const sensor of sensors) {
          if (sensor.value != null) {
            await pool.query(
              `INSERT INTO data_sensor(device_id, sensor_type, value, unit, timestamp) 
               VALUES ($1, $2, $3, $4, $5)`,
              [deviceId, sensor.type, sensor.value, sensor.unit, timestamp]
            ).catch(err => console.log('⚠️  DB insert error:', err.message));
          }
        }
      } else {
        // In-memory storage
        for (const sensor of sensors) {
          if (sensor.value != null) {
            inMemoryData.dataSensor.push({
              id: inMemoryData.dataSensor.length + 1,
              device_id: deviceId,
              sensor_type: sensor.type,
              value: sensor.value,
              unit: sensor.unit,
              timestamp
            });
          }
        }
        // Keep only last 500 records
        if (inMemoryData.dataSensor.length > 1000) {
          inMemoryData.dataSensor = inMemoryData.dataSensor.slice(-500);
        }
      }
    }
    
    else if (topic.endsWith('/led/status')) {
      const status = payload.toString();
      const timestamp = new Date();
      
      if (useDatabase) {
        await pool.query(
          `INSERT INTO device_actions(device_id, target, action, issued_by, result, timestamp) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [deviceId, 'led', status, 'mqtt_feedback', 'success', timestamp]
        ).catch(err => console.log('⚠️  Action log error:', err.message));
      } else {
        inMemoryData.deviceActions.push({
          id: inMemoryData.deviceActions.length + 1,
          device_id: deviceId,
          target: 'led',
          action: status,
          issued_by: 'mqtt_feedback',
          result: 'success',
          timestamp
        });
        if (inMemoryData.deviceActions.length > 100) {
          inMemoryData.deviceActions = inMemoryData.deviceActions.slice(-50);
        }
      }
    }
    
    else if (topic.endsWith('/status')) {
      const status = payload.toString();
      console.log(`📡 Device ${deviceId} status: ${status}`);
      // Status có thể xử lý riêng nếu cần
    }

  } catch (error) {
    console.error('❌ Message processing error:', error.message);
  }
});

// ==================== REST API ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mqtt: mqttClient.connected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Get latest sensor data
app.get('/api/devices/:id/last', async (req, res) => {
  const { id } = req.params;
  try {
    if (useDatabase) {
      // Lấy giá trị mới nhất của mỗi loại sensor
      const { rows } = await pool.query(
        `SELECT DISTINCT ON (sensor_type) 
         sensor_type, value, unit, timestamp
         FROM data_sensor 
         WHERE device_id = $1 
         ORDER BY sensor_type, timestamp DESC`,
        [id]
      );
      
      // Convert array thành object dễ đọc
      const result = {
        device_id: id,
        timestamp: rows[0]?.timestamp || new Date()
      };
      rows.forEach(row => {
        result[row.sensor_type] = {
          value: row.value,
          unit: row.unit
        };
      });
      
      res.json(result);
    } else {
      // In-memory fallback
      const latestData = {};
      ['temperature', 'humidity', 'light'].forEach(type => {
        const sensor = inMemoryData.dataSensor
          .filter(d => d.device_id === id && d.sensor_type === type)
          .sort((a, b) => b.timestamp - a.timestamp)[0];
        if (sensor) {
          latestData[type] = { value: sensor.value, unit: sensor.unit };
          latestData.timestamp = sensor.timestamp;
        }
      });
      latestData.device_id = id;
      res.json(latestData);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get time series data for charts
  app.get('/api/devices/:id/series', async (req, res) => {
    const { id } = req.params;
    const { from = '1hour', sensor = 'all', limit = 5000 } = req.query;
    
    try {
      if (useDatabase) {
        let query, params = [id];
        
        // ✅ Xử lý "today" - lấy data từ 00:00 hôm nay (dùng được INDEX!)
        if (from === 'today') {
          query = `
            SELECT sensor_type, value, unit, timestamp
            FROM data_sensor
            WHERE device_id = $1 
              AND timestamp >= CURRENT_DATE 
              AND timestamp < CURRENT_DATE + INTERVAL '1 day'
          `;
        } else {
          // Parse từ "1hour" → "1 hour" cho PostgreSQL
          const interval = from.replace(/(\d+)([a-z]+)/, '$1 $2');
          query = `
            SELECT sensor_type, value, unit, timestamp
            FROM data_sensor
            WHERE device_id = $1 AND timestamp > NOW() - INTERVAL '${interval}'
          `;
        }
        
        // Thêm filter sensor nếu cần
        if (sensor !== 'all') {
          query += ` AND sensor_type = $2`;
          params.push(sensor);
        }
        
        // Thêm ORDER BY và LIMIT
        query += ` ORDER BY timestamp ASC LIMIT $${params.length + 1}`;
        params.push(limit);
        
        const { rows } = await pool.query(query, params);
        
        // ✅ WRAP TRONG OBJECT
        res.json({
          device_id: id,
          sensor: sensor,
          period: from,
          data: rows
        });
      } else {
        // In-memory fallback
        const match = from.match(/(\d+)(hour|minute|day)/);
        const amount = match ? parseInt(match[1]) : 1;
        const unit = match ? match[2] : 'hour';
        const ms = unit === 'minute' ? 60000 : unit === 'hour' ? 3600000 : 86400000;
        const cutoff = new Date(Date.now() - amount * ms);
        
        let series = inMemoryData.dataSensor
          .filter(d => d.device_id === id && d.timestamp > cutoff);
        
        if (sensor !== 'all') {
          series = series.filter(d => d.sensor_type === sensor);
        }
        
        series = series.sort((a, b) => a.timestamp - b.timestamp).slice(0, parseInt(limit));
        
        // ✅ WRAP TRONG OBJECT
        res.json({
          device_id: id,
          sensor: sensor,
          period: from,
          data: series
        });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  

// Get all sensor data with pagination (grouped by timestamp)
app.get('/api/devices/:id/sensors', async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 10, search = '', filter = 'All', orderBy = 'timestamp', orderDir = 'DESC' } = req.query;
  const offset = (page - 1) * limit;
  
  try {
    if (useDatabase) {
      // ✅ GROUP data by timestamp trước khi trả về
      let baseQuery = `
        WITH grouped_data AS (
          SELECT 
            MIN(id) as id,
            timestamp,
            MAX(CASE WHEN sensor_type = 'temperature' THEN value END) as temperature,
            MAX(CASE WHEN sensor_type = 'humidity' THEN value END) as humidity,
            MAX(CASE WHEN sensor_type = 'light' THEN value END) as light
          FROM data_sensor
          WHERE device_id = $1
      `;
      
      const params = [id];
      
      // ✅ Apply filter
      if (filter !== 'All') {
        baseQuery += ` AND sensor_type = $${params.length + 1}`;
        params.push(filter.toLowerCase());
      }
      
      baseQuery += `
          GROUP BY timestamp
        )
        SELECT * FROM grouped_data
      `;
      
      // ✅ Apply search (tìm theo mọi giá trị bao gồm timestamp)
      if (search) {
        baseQuery += ` WHERE CAST(id AS TEXT) LIKE $${params.length + 1} 
                       OR CAST(temperature AS TEXT) LIKE $${params.length + 1}
                       OR CAST(humidity AS TEXT) LIKE $${params.length + 1}
                       OR CAST(light AS TEXT) LIKE $${params.length + 1}
                       OR TO_CHAR(timestamp, 'YYYY-MM-DD HH24:MI:SS') LIKE $${params.length + 1}`;
        params.push(`%${search}%`);
      }
      
      // Count total
      const countQuery = `SELECT COUNT(*) FROM (${baseQuery}) as counted`;
      const { rows: countRows } = await pool.query(countQuery, params);
      
      // ✅ Apply sorting (BACKEND SORTING theo yêu cầu thầy)
      const validColumns = ['id', 'timestamp', 'temperature', 'humidity', 'light'];
      const validDirs = ['ASC', 'DESC'];
      const safeOrderBy = validColumns.includes(orderBy) ? orderBy : 'timestamp';
      const safeOrderDir = validDirs.includes(orderDir.toUpperCase()) ? orderDir.toUpperCase() : 'DESC';
      
      baseQuery += ` ORDER BY ${safeOrderBy} ${safeOrderDir}`;
      
      // Get paginated data
      baseQuery += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
      
      const { rows } = await pool.query(baseQuery, params);
      
      res.json({
        data: rows,
        total: parseInt(countRows[0].count),
        page: parseInt(page),
        limit: parseInt(limit)
      });
    } else {
      // In-memory fallback
      const allData = inMemoryData.dataSensor
        .filter(d => d.device_id === id)
        .sort((a, b) => b.timestamp - a.timestamp);
      const paginatedData = allData.slice(offset, offset + parseInt(limit));
      
      res.json({
        data: paginatedData,
        total: allData.length,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get device actions history
app.get('/api/devices/:id/actions', async (req, res) => {
  const { id } = req.params;
  const { limit = 50 } = req.query;
  
  try {
    if (useDatabase) {
      const { rows } = await pool.query(
        `SELECT * FROM device_actions 
         WHERE device_id = $1 
         ORDER BY timestamp DESC 
         LIMIT $2`,
        [id, limit]
      );
      
      // ✅ WRAP TRONG OBJECT CHO NHẤT QUÁN
      res.json({
        device_id: id,
        total: rows.length,
        data: rows
      });
    } else {
      // In-memory fallback
      const actions = inMemoryData.deviceActions
        .filter(d => d.device_id === id)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, parseInt(limit));
      
      // ✅ WRAP TRONG OBJECT
      res.json({
        device_id: id,
        total: actions.length,
        data: actions
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send command to device via MQTT
app.post('/api/devices/:id/cmd/:target', async (req, res) => {
  const { id, target } = req.params;
  const { value, issued_by = 'api' } = req.body;
  
  if (!value) {
    return res.status(400).json({ error: 'value is required' });
  }
  
  const topic = `iot/${id}/${target}/command`;
  const message = value.toUpperCase(); // ON, OFF, TOGGLE
  const timestamp = new Date();
  
  mqttClient.publish(topic, message, { qos: 1 }, async (err) => {
    if (err) {
      // Log failed action
      if (useDatabase) {
        await pool.query(
          `INSERT INTO device_actions(device_id, target, action, issued_by, result, note, timestamp) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, target, value, issued_by, 'failed', err.message, timestamp]
        ).catch(e => console.log('⚠️  Action log error:', e.message));
      }
      
      return res.status(500).json({ error: 'MQTT publish failed', details: err.message });
    }
    
    // Log successful action
    if (useDatabase) {
      await pool.query(
        `INSERT INTO device_actions(device_id, target, action, issued_by, result, timestamp) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, target, value, issued_by, 'pending', timestamp]
      ).catch(e => console.log('⚠️  Action log error:', e.message));
    } else {
      inMemoryData.deviceActions.push({
        id: inMemoryData.deviceActions.length + 1,
        device_id: id,
        target,
        action: value,
        issued_by,
        result: 'pending',
        timestamp
      });
    }
    
    console.log(`📤 [${topic}] ${message}`);
    res.json({ 
      ok: true, 
      device: id, 
      target, 
      value: message,
      issued_by,
      timestamp: timestamp.toISOString()
    });
  });
});

// Get device info (summary)
app.get('/api/devices/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    if (useDatabase) {
      // Get device summary from data_sensor
      const { rows } = await pool.query(
        `SELECT 
          device_id,
          COUNT(*) as total_records,
          MAX(timestamp) as last_seen
         FROM data_sensor 
         WHERE device_id = $1
         GROUP BY device_id`,
        [id]
      );
      
      if (rows.length > 0) {
        res.json(rows[0]);
      } else {
        res.json({ device_id: id, message: 'No data yet' });
      }
    } else {
      // In-memory fallback
      const deviceData = inMemoryData.dataSensor.filter(d => d.device_id === id);
      const lastSeen = deviceData.length > 0 
        ? Math.max(...deviceData.map(d => d.timestamp))
        : null;
      
      res.json({
        device_id: id,
        total_records: deviceData.length,
        last_seen: lastSeen ? new Date(lastSeen) : null
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 IoT Server running on http://localhost:${PORT}`);
  console.log(`📊 API Endpoints (Schema Updated):`);
  console.log(`   GET  /api/health`);
  console.log(`   GET  /api/devices/:id`);
  console.log(`   GET  /api/devices/:id/last`);
  console.log(`   GET  /api/devices/:id/series?from=1hour&sensor=temperature`);
  console.log(`   GET  /api/devices/:id/sensors?page=1&limit=10`);
  console.log(`   GET  /api/devices/:id/actions`);
  console.log(`   POST /api/devices/:id/cmd/:target { "value": "ON", "issued_by": "web" }`);
  console.log(``);
  console.log(`📋 Database Tables:`);
  console.log(`   - data_sensor (sensor_type, value, unit)`);
  console.log(`   - device_actions (target, action, issued_by, result)`);
});

