import mqtt from 'mqtt';
import dotenv from 'dotenv';

dotenv.config();

// MQTT Client Configuration
export const createMqttClient = () => {
  return mqtt.connect(process.env.MQTT_URL, {
    username: process.env.MQTT_USER,
    password: process.env.MQTT_PASS,
    keepalive: 60,
    reconnectPeriod: 2000,
    clientId: 'iot-server-' + Math.random().toString(16).slice(2, 8)
  });
};

