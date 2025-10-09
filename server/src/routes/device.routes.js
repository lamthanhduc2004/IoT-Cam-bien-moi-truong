import express from 'express';
import { getDevice, sendCommand, healthCheck } from '../controllers/device.controller.js';

const createDeviceRouter = (mqttClient) => {
  const router = express.Router();

  // Health check
  router.get('/health', healthCheck(mqttClient));

  // Get device summary
  router.get('/devices/:id', getDevice);

  // Send command to device via MQTT
  router.post('/devices/:id/cmd/:target', sendCommand(mqttClient));

  return router;
};

export default createDeviceRouter;

