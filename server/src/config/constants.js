// MQTT Topics
export const MQTT_TOPICS = {
  telemetry: 'iot/+/telemetry',
  ledStatus: 'iot/+/led/status',
  status: 'iot/+/status'
};

// Data retention policy
export const DATA_RETENTION_DAYS = 30;

// Cleanup interval (24 hours)
export const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

// Valid columns for sorting
export const SENSOR_SORT_COLUMNS = ['id', 'timestamp', 'temperature', 'humidity', 'light'];
export const ACTION_SORT_COLUMNS = ['id', 'timestamp', 'target', 'action', 'issued_by'];

// Valid sort directions
export const SORT_DIRECTIONS = ['ASC', 'DESC'];

// In-memory storage limits
export const IN_MEMORY_LIMITS = {
  sensors: 1000,
  actions: 100,
  sensorsKeep: 500,
  actionsKeep: 50
};

