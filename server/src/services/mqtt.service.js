import { MQTT_TOPICS } from '../config/constants.js';
import { insertSensorData, checkDuplicateSensorData } from '../models/sensor.model.js';
import { insertActionLog } from '../models/action.model.js';

// Setup MQTT event handlers
export const setupMqttHandlers = (mqttClient) => {
  mqttClient.on('connect', () => {
    console.log('✅ MQTT connected to broker');
    mqttClient.subscribe([MQTT_TOPICS.telemetry, MQTT_TOPICS.ledStatus, MQTT_TOPICS.status], { qos: 1 }, (err) => {
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
    { type: 'light', value: data.light, unit: 'nits' }
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
  const timestamp = new Date();
  
  await insertActionLog(deviceId, 'led', status, 'mqtt_feedback', 'success', null, timestamp);
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
  
  mqttClient.publish(topic, message, { qos: 1 }, async (err) => {
    if (err) {
      await insertActionLog(deviceId, target, value, issuedBy, 'failed', err.message, timestamp);
      callback(err, null);
    } else {
      await insertActionLog(deviceId, target, value, issuedBy, 'pending', null, timestamp);
      console.log(`📤 [${topic}] ${message}`);
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

