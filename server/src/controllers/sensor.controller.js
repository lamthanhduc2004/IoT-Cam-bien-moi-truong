import { getLatestSensorData, getTimeSeriesData, getSensorsWithFilters } from '../models/sensor.model.js';

// Get latest sensor data
export const getLatest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await getLatestSensorData(id);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

// Get time series data for charts
export const getTimeSeries = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { from = '1hour', sensor = 'all', limit = 5000 } = req.query;
    
    const data = await getTimeSeriesData(id, from, sensor, limit);
    
    res.json({
      device_id: id,
      sensor: sensor,
      period: from,
      data
    });
  } catch (error) {
    next(error);
  }
};

// Get all sensor data with pagination and smart search
export const getAllSensors = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, search = '', filter = 'All', orderBy = 'timestamp', orderDir = 'DESC', date } = req.query;
    
    console.log('🔍 Search:', search, '🎯 Filter:', filter, '📅 Date:', date);
    
    const result = await getSensorsWithFilters(id, page, limit, search, filter, orderBy, orderDir, date);
    
    console.log(`✅ Returned ${result.data.length} rows, total: ${result.total}`);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error in /sensors:', error);
    next(error);
  }
};

