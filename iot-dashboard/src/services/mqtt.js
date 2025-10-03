// MQTT Service - Kết nối realtime với MQTT broker
import mqtt from 'mqtt';

const MQTT_URL = 'ws://192.168.137.1:9001'; // WebSocket MQTT
const DEVICE_ID = 'esp32_01';

class MqttService {
  constructor() {
    this.client = null;
    this.connected = false;
    this.listeners = {
      telemetry: [],
      status: [],
      ledStatus: [],
    };
  }

  // Kết nối MQTT
  connect() {
    if (this.client && this.connected) {
      console.log('MQTT already connected');
      return;
    }

    try {
      this.client = mqtt.connect(MQTT_URL, {
        username: 'user1',      // ← THÊM DÒNG NÀY
        password: '123456',     // ← THÊM DÒNG NÀY
        keepalive: 60,
        reconnectPeriod: 2000,
        clientId: 'web-' + Math.random().toString(16).slice(2, 8),
      });

      this.client.on('connect', () => {
        console.log('✅ MQTT Connected');
        this.connected = true;

        // Subscribe topics
        this.client.subscribe([
          `iot/${DEVICE_ID}/telemetry`,
          `iot/${DEVICE_ID}/status`,
          `iot/${DEVICE_ID}/led/status`,
        ], { qos: 1 });
      });

      this.client.on('message', (topic, payload) => {
        try {
          const message = payload.toString();
          console.log(`📥 [${topic}] ${message}`);

          if (topic.endsWith('/telemetry')) {
            const data = JSON.parse(message);
            this.notifyListeners('telemetry', data);
          } else if (topic.endsWith('/led/status')) {
            this.notifyListeners('ledStatus', message);
          } else if (topic.endsWith('/status')) {
            this.notifyListeners('status', message);
          }
        } catch (error) {
          console.error('MQTT message error:', error);
        }
      });

      this.client.on('error', (error) => {
        console.error('❌ MQTT Error:', error.message);
        this.connected = false;
      });

      this.client.on('offline', () => {
        console.log('⚠️  MQTT Offline');
        this.connected = false;
      });

      this.client.on('reconnect', () => {
        console.log('🔄 MQTT Reconnecting...');
      });

    } catch (error) {
      console.error('MQTT connection failed:', error);
    }
  }

  // Đăng ký listener
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  // Hủy listener
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  // Thông báo cho listeners
  notifyListeners(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  // Publish message
  publish(topic, message) {
    if (this.client && this.connected) {
      this.client.publish(topic, message, { qos: 1 });
    } else {
      console.error('MQTT not connected');
    }
  }

  // Điều khiển LED qua MQTT
  controlLED(value) {
    const topic = `iot/${DEVICE_ID}/led/command`;
    this.publish(topic, value.toUpperCase());
  }

  // Ngắt kết nối
  disconnect() {
    if (this.client) {
      this.client.end();
      this.connected = false;
    }
  }

  // Check connection status
  isConnected() {
    return this.connected;
  }
}

export default new MqttService();