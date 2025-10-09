import { CHART_CONFIG, DATE_FORMAT } from '../config/constants';

/**
 * Sample chart data to reduce data points for better chart performance.
 * Takes raw sensor data and returns evenly distributed samples across 24 hours.
 * 
 * @param {Array} rawData - Raw sensor data with timestamp and value
 * @param {number} intervalMinutes - Sampling interval in minutes (default: 30)
 * @returns {Array} Sampled data points
 */
export const sampleChartData = (rawData, intervalMinutes = CHART_CONFIG.SAMPLING_INTERVAL_MINUTES) => {
  if (!rawData || rawData.length === 0) return [];

  const sampledData = [];
  const intervalMs = intervalMinutes * 60 * 1000;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayStart = today.getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  
  // Filter data for today only
  const todayData = rawData.filter(d => {
    const ts = new Date(d.timestamp).getTime();
    return ts >= dayStart && ts < dayEnd;
  });
  
  // Create time slots and average values within each slot
  for (let i = 0; i < CHART_CONFIG.TIME_SLOTS_PER_DAY; i++) {
    const slotStart = dayStart + (i * intervalMs);
    const slotEnd = slotStart + intervalMs;
    
    const pointsInSlot = todayData.filter(d => {
      const ts = new Date(d.timestamp).getTime();
      return ts >= slotStart && ts < slotEnd;
    });
    
    if (pointsInSlot.length > 0) {
      const avgValue = pointsInSlot.reduce((sum, p) => sum + p.value, 0) / pointsInSlot.length;
      sampledData.push({
        time: new Date(slotStart).toLocaleTimeString(DATE_FORMAT.LOCALE, DATE_FORMAT.TIME_OPTIONS),
        value: avgValue,
        timestamp: new Date(slotStart).toISOString()
      });
    }
  }
  
  return sampledData;
};

/**
 * Calculate statistics (min, max, avg) from sensor data.
 * 
 * @param {Array} data - Sensor data array
 * @returns {Object} Statistics object with min, max, avg
 */
export const calculateStats = (data) => {
  if (!data || data.length === 0) {
    return { min: 0, max: 0, avg: 0 };
  }

  const values = data.map(d => d.value);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: values.reduce((a, b) => a + b, 0) / values.length
  };
};

/**
 * Get alert level based on sensor value and thresholds.
 * 
 * @param {number} value - Sensor value
 * @param {Object} thresholds - Threshold configuration
 * @returns {string} Alert level: 'normal', 'warning', or 'danger'
 */
export const getAlertLevel = (value, thresholds) => {
  if (!thresholds) return 'normal';
  
  const { danger, warning } = thresholds;
  
  if (value < danger.min || value > danger.max) return 'danger';
  if (value < warning.min || value > warning.max) return 'warning';
  return 'normal';
};

