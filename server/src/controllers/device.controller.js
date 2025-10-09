import { getDeviceSummary } from '../models/device.model.js';
import { publishCommand } from '../services/mqtt.service.js';

// Get device summary
export const getDevice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await getDeviceSummary(id);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

// Send command to device via MQTT
export const sendCommand = (mqttClient) => {
  return async (req, res, next) => {
    try {
      const { id, target } = req.params;
      const { value, issued_by = 'api' } = req.body;
      
      if (!value) {
        return res.status(400).json({ error: 'value is required' });
      }
      
      publishCommand(mqttClient, id, target, value, issued_by, (err, result) => {
        if (err) {
          return res.status(500).json({ error: 'MQTT publish failed', details: err.message });
        }
        res.json(result);
      });
    } catch (error) {
      next(error);
    }
  };
};

// Health check
export const healthCheck = (mqttClient) => {
  return (req, res) => {
    res.json({
      status: 'ok',
      mqtt: mqttClient.connected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  };
};

