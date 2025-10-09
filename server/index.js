import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

// Config
import { initializeDatabase, cleanupOldData, setUseDatabase } from './src/config/database.js';
import { createMqttClient } from './src/config/mqtt.js';
import { CLEANUP_INTERVAL_MS } from './src/config/constants.js';

// Services
import { setupMqttHandlers } from './src/services/mqtt.service.js';

// Routes
import sensorRoutes from './src/routes/sensor.routes.js';
import actionRoutes from './src/routes/action.routes.js';
import createDeviceRouter from './src/routes/device.routes.js';

// Middleware
import { errorHandler, notFoundHandler } from './src/middleware/errorHandler.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(bodyParser.json());

// Initialize Database
const dbConnected = await initializeDatabase();
setUseDatabase(dbConnected);

if (dbConnected) {
  // Run cleanup on startup
  await cleanupOldData();
  
  // Schedule cleanup every 24 hours
  setInterval(cleanupOldData, CLEANUP_INTERVAL_MS);
}

// Initialize MQTT
const mqttClient = createMqttClient();
setupMqttHandlers(mqttClient);

// API Routes
app.use('/api', sensorRoutes);
app.use('/api', actionRoutes);
app.use('/api', createDeviceRouter(mqttClient));

// Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 IoT Server running on http://localhost:${PORT}`);
  console.log(`📊 API Endpoints (Schema Updated):`);
  console.log(`   GET  /api/health`);
  console.log(`   GET  /api/devices/:id`);
  console.log(`   GET  /api/devices/:id/last`);
  console.log(`   GET  /api/devices/:id/series?from=1hour&sensor=temperature`);
  console.log(`   GET  /api/devices/:id/sensors?page=1&limit=10&date=2025-10-06`);
  console.log(`   GET  /api/devices/:id/actions`);
  console.log(`   POST /api/devices/:id/cmd/:target { "value": "ON", "issued_by": "web" }`);
  console.log(``);
  console.log(`📋 Database Tables:`);
  console.log(`   - data_sensor (sensor_type, value, unit)`);
  console.log(`   - device_actions (target, action, issued_by, result)`);
  console.log(`🧹 Auto-cleanup: Data > 30 days will be deleted daily`);
  console.log(``);
  console.log(`🔍 Smart Search Rules:`);
  console.log(`   - "23:38 9/10/2025" → Full datetime search (HH:MM DD/MM/YYYY)`);
  console.log(`   - "22:47" or "22:47:30" → Time only search`);
  console.log(`   - "28" (2 digits) → Temp 28.0-28.9 + Humidity 28.0-28.9 (temp first)`);
  console.log(`   - "500" (3+ digits) → Light 500-599`);
  console.log(`   - With filter → Search only in filtered field`);
});
