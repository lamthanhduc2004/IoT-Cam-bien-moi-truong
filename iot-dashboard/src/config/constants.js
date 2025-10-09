// Application Constants
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  DEVICE_ID: import.meta.env.VITE_DEVICE_ID || 'esp32_01',
};

export const MQTT_CONFIG = {
  URL: import.meta.env.VITE_MQTT_URL || 'ws://192.168.137.1:9001',
  USERNAME: 'user1',
  PASSWORD: '123456',
  KEEPALIVE: 60,
  RECONNECT_PERIOD: 2000,
};

export const CHART_CONFIG = {
  SAMPLING_INTERVAL_MINUTES: 30,
  TIME_SLOTS_PER_DAY: 48,
  UPDATE_INTERVAL_MS: 10000, // 10 seconds
  CONNECTION_CHECK_INTERVAL_MS: 1000, // 1 second
  DEFAULT_LIMIT: 20000,
};

export const SENSOR_THRESHOLDS = {
  temperature: {
    danger: { min: 10, max: 35 },
    warning: { min: 15, max: 30 },
  },
  humidity: {
    danger: { min: 20, max: 80 },
    warning: { min: 30, max: 70 },
  },
  light: {
    danger: { min: 100, max: 4000 },
    warning: { min: 200, max: 3000 },
  },
};

export const SENSOR_RANGES = {
  temperature: { min: 0, max: 40, unit: '°C' },
  humidity: { min: 0, max: 100, unit: '%' },
  light: { min: 0, max: 4095, unit: 'nits' },
};

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [5, 10, 20, 50],
  MAX_PAGE_BUTTONS: 7,
};

export const DATA_RETENTION = {
  DAYS: 30,
  CLEANUP_INTERVAL_MS: 24 * 60 * 60 * 1000, // 24 hours
};

export const DATE_FORMAT = {
  LOCALE: 'vi-VN',
  TIME_OPTIONS: { hour: '2-digit', minute: '2-digit' },
};

