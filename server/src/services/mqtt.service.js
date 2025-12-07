import { MQTT_TOPICS } from '../config/constants.js';
import { insertSensorData, checkDuplicateSensorData } from '../models/sensor.model.js';
import { insertActionLog } from '../models/action.model.js';

// Track pending commands waiting for feedback
const pendingCommands = new Map();
const COMMAND_TIMEOUT_MS = 10000; // 10 seconds

// Setup MQTT event handlers
export const setupMqttHandlers = (mqttClient) => {
  mqttClient.on('connect', () => {
    console.log('✅ MQTT connected to broker');
    mqttClient.subscribe([
      MQTT_TOPICS.telemetry, 
      MQTT_TOPICS.ledStatus, 
      MQTT_TOPICS.fanStatus, 
      MQTT_TOPICS.acStatus, 
      MQTT_TOPICS.status
    ], { qos: 1 }, (err) => {
      if (err) {
        console.error('❌ MQTT subscribe failed:', err);
      } else {
        console.log('📡 Subscribed to topics:', Object.values(MQTT_TOPICS));
      }
    });
  });

  mqttClient.on('error', (err) => {
    console.error('❌ MQTT error:', err.message);
  });

  mqttClient.on('offline', () => {
    console.log('⚠️  MQTT offline, reconnecting...');
  });

  mqttClient.on('message', handleMqttMessage);
};

// Handle incoming MQTT messages
const handleMqttMessage = async (topic, payload) => {
  try {
    const parts = topic.split('/');
    const deviceId = parts[1];
    
    console.log(`📥 [${topic}] ${payload.toString()}`);

    if (topic.endsWith('/telemetry')) {
      await handleTelemetry(deviceId, payload);
    } else if (topic.endsWith('/led/status')) {
      await handleLedStatus(deviceId, payload);
    } else if (topic.endsWith('/fan/status')) {
      await handleFanStatus(deviceId, payload);
    } else if (topic.endsWith('/ac/status')) {
      await handleAcStatus(deviceId, payload);
    } else if (topic.endsWith('/status')) {
      handleDeviceStatus(deviceId, payload);
    }
  } catch (error) {
    console.error('❌ Message processing error:', error.message);
  }
};

// Handle telemetry data
const handleTelemetry = async (deviceId, payload) => {
  const data = JSON.parse(payload.toString());
  
  // Round timestamp to nearest second
  const now = new Date();
  now.setMilliseconds(0);
  const timestamp = now;
  
  // Check for duplicates
  const isDuplicate = await checkDuplicateSensorData(deviceId, timestamp);
  if (isDuplicate) {
    console.log(`⚠️  Duplicate message ignored: timestamp=${timestamp.toISOString()} already exists`);
    return;
  }
  
  // Save each sensor type separately
  const sensors = [
    { type: 'temperature', value: data.temperature, unit: '°C' },
    { type: 'humidity', value: data.humidity, unit: '%' },
    { type: 'light', value: data.light, unit: 'nits' },
    { type: 'rainfall', value: data.rainfall, unit: 'mm' },
    { type: 'wind_speed', value: data.wind_speed, unit: 'm/s' }
  ];
  
  for (const sensor of sensors) {
    if (sensor.value != null) {
      await insertSensorData(deviceId, sensor.type, sensor.value, sensor.unit, timestamp);
    }
  }
};

// Handle LED status updates
const handleLedStatus = async (deviceId, payload) => {
  const status = payload.toString();
  await handleDeviceFeedback(deviceId, 'led', status);
};

// Handle FAN status updates
const handleFanStatus = async (deviceId, payload) => {
  const status = payload.toString();
  await handleDeviceFeedback(deviceId, 'fan', status);
};

// Handle AC status updates
const handleAcStatus = async (deviceId, payload) => {
  const status = payload.toString();
  await handleDeviceFeedback(deviceId, 'ac', status);
};

// Handle device feedback (unified logic)
const handleDeviceFeedback = async (deviceId, target, status) => {
  const commandKey = `${deviceId}:${target}`;
  const pendingCommand = pendingCommands.get(commandKey);
  
  if (pendingCommand) {
    // Clear timeout
    clearTimeout(pendingCommand.timeoutId);
    
    // Check if status matches expected value
    if (status === pendingCommand.expectedStatus) {
      // Success: Log to DB
      await insertActionLog(
        deviceId, 
        target, 
        status, 
        pendingCommand.issuedBy, 
        'success', 
        null, 
        pendingCommand.timestamp
      );
      console.log(`✅ [${target}] Command confirmed: ${status}`);
    } else {
      // Unexpected status
      await insertActionLog(
        deviceId, 
        target, 
        status, 
        pendingCommand.issuedBy, 
        'failed', 
        `Expected ${pendingCommand.expectedStatus}, got ${status}`, 
        pendingCommand.timestamp
      );
      console.log(`⚠️  [${target}] Unexpected status: expected ${pendingCommand.expectedStatus}, got ${status}`);
    }
    
    // Remove from pending
    pendingCommands.delete(commandKey);
  } else {
    // No pending command, just feedback from ESP32 (reconnect/initial state)
    console.log(`📡 [${target}] Status update (no pending): ${status}`);
  }
};

// Handle device status
const handleDeviceStatus = (deviceId, payload) => {
  const status = payload.toString();
  console.log(`📡 Device ${deviceId} status: ${status}`);
};

// Publish MQTT command
export const publishCommand = (mqttClient, deviceId, target, value, issuedBy, callback) => {
  const topic = `iot/${deviceId}/${target}/command`;
  const message = value.toUpperCase();
  const timestamp = new Date();
  const commandKey = `${deviceId}:${target}`;
  
  mqttClient.publish(topic, message, { qos: 1 }, async (err) => {
    if (err) {
      // Publish failed (MQTT error)
      await insertActionLog(deviceId, target, value, issuedBy, 'failed', `MQTT publish error: ${err.message}`, timestamp);
      callback(err, null);
    } else {
      // Publish success, now wait for feedback from ESP32
      console.log(`📤 [${topic}] ${message} - Waiting for device feedback...`);
      
      // Set timeout to handle no-response case
      const timeoutId = setTimeout(async () => {
        const pendingCmd = pendingCommands.get(commandKey);
        if (pendingCmd) {
          // Timeout: Device didn't respond
          await insertActionLog(
            deviceId, 
            target, 
            value, 
            issuedBy, 
            'failed', 
            'Device timeout: No feedback received within 10 seconds', 
            timestamp
          );
          console.log(`❌ [${target}] Timeout: Device didn't respond`);
          pendingCommands.delete(commandKey);
        }
      }, COMMAND_TIMEOUT_MS);
      
      // Track pending command
      pendingCommands.set(commandKey, {
        deviceId,
        target,
        expectedStatus: message, // "ON" or "OFF"
        issuedBy,
        timestamp,
        timeoutId
      });
      
      callback(null, { 
        ok: true, 
        device: deviceId, 
        target, 
        value: message,
        issued_by: issuedBy,
        timestamp: timestamp.toISOString()
      });
    }
  });
};

