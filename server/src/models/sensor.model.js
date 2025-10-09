import { pool, inMemoryData, getUseDatabase } from '../config/database.js';

// Get latest sensor data
export const getLatestSensorData = async (deviceId) => {
  if (getUseDatabase()) {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (sensor_type) 
       sensor_type, value, unit, timestamp
       FROM data_sensor 
       WHERE device_id = $1 
       ORDER BY sensor_type, timestamp DESC`,
      [deviceId]
    );
    
    const result = {
      device_id: deviceId,
      timestamp: rows[0]?.timestamp || new Date()
    };
    rows.forEach(row => {
      result[row.sensor_type] = {
        value: row.value,
        unit: row.unit
      };
    });
    
    return result;
  } else {
    // In-memory fallback
    const latestData = {};
    ['temperature', 'humidity', 'light'].forEach(type => {
      const sensor = inMemoryData.dataSensor
        .filter(d => d.device_id === deviceId && d.sensor_type === type)
        .sort((a, b) => b.timestamp - a.timestamp)[0];
      if (sensor) {
        latestData[type] = { value: sensor.value, unit: sensor.unit };
        latestData.timestamp = sensor.timestamp;
      }
    });
    latestData.device_id = deviceId;
    return latestData;
  }
};

// Get time series data
export const getTimeSeriesData = async (deviceId, from, sensor, limit) => {
  if (getUseDatabase()) {
    let query, params = [deviceId];
    
    if (from === 'today') {
      query = `
        SELECT sensor_type, value, unit, timestamp
        FROM data_sensor
        WHERE device_id = $1 
          AND timestamp >= CURRENT_DATE 
          AND timestamp < CURRENT_DATE + INTERVAL '1 day'
      `;
    } else {
      const interval = from.replace(/(\d+)([a-z]+)/, '$1 $2');
      query = `
        SELECT sensor_type, value, unit, timestamp
        FROM data_sensor
        WHERE device_id = $1 AND timestamp > NOW() - INTERVAL '${interval}'
      `;
    }
    
    if (sensor !== 'all') {
      query += ` AND sensor_type = $2`;
      params.push(sensor);
    }
    
    query += ` ORDER BY timestamp ASC LIMIT $${params.length + 1}`;
    params.push(limit);
    
    const { rows } = await pool.query(query, params);
    return rows;
  } else {
    // In-memory fallback
    const match = from.match(/(\d+)(hour|minute|day)/);
    const amount = match ? parseInt(match[1]) : 1;
    const unit = match ? match[2] : 'hour';
    const ms = unit === 'minute' ? 60000 : unit === 'hour' ? 3600000 : 86400000;
    const cutoff = new Date(Date.now() - amount * ms);
    
    let series = inMemoryData.dataSensor
      .filter(d => d.device_id === deviceId && d.timestamp > cutoff);
    
    if (sensor !== 'all') {
      series = series.filter(d => d.sensor_type === sensor);
    }
    
    return series.sort((a, b) => a.timestamp - b.timestamp).slice(0, parseInt(limit));
  }
};

// Get paginated sensor data with smart search
export const getSensorsWithFilters = async (deviceId, page, limit, search, filter, orderBy, orderDir, date) => {
  if (getUseDatabase()) {
    const hasFullDatetime = search && search.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    
    const params = [deviceId];
    let whereConditions = ['device_id = $1'];
    
    // Date filter
    if (date && !hasFullDatetime) {
      const paramIndex = params.length + 1;
      whereConditions.push(`timestamp >= $${paramIndex}::date`);
      whereConditions.push(`timestamp < ($${paramIndex}::date + INTERVAL '1 day')`);
      params.push(date);
    }
    
    let baseQuery = `
      WITH grouped_data AS (
        SELECT 
          MIN(id) as id,
          timestamp,
          MAX(CASE WHEN sensor_type = 'temperature' THEN value END) as temperature,
          MAX(CASE WHEN sensor_type = 'humidity' THEN value END) as humidity,
          MAX(CASE WHEN sensor_type = 'light' THEN value END) as light
        FROM data_sensor
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY timestamp
      )
      SELECT * FROM grouped_data
    `;
    
    let customOrderBy = null;
    let hasSearchCondition = false;
    
    // Smart search logic
    if (search) {
      const searchConditions = [];
      const fullDateTimeMatch = search.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      
      if (fullDateTimeMatch) {
        const hour = fullDateTimeMatch[1].padStart(2, '0');
        const minute = fullDateTimeMatch[2];
        const second = fullDateTimeMatch[3];
        const day = fullDateTimeMatch[4].padStart(2, '0');
        const month = fullDateTimeMatch[5].padStart(2, '0');
        const year = fullDateTimeMatch[6];
        const dateStr = `${year}-${month}-${day}`;
        
        if (second) {
          const timestampStr = `${dateStr} ${hour}:${minute}:${second}`;
          searchConditions.push(`timestamp >= $${params.length + 1}::timestamp AND timestamp < $${params.length + 1}::timestamp + INTERVAL '1 second'`);
          params.push(timestampStr);
        } else {
          const timestampStr = `${dateStr} ${hour}:${minute}:00`;
          searchConditions.push(`timestamp >= $${params.length + 1}::timestamp AND timestamp < $${params.length + 1}::timestamp + INTERVAL '1 minute'`);
          params.push(timestampStr);
        }
        hasSearchCondition = true;
      }
      else if (search.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)) {
        const timeMatch = search.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        const hour = timeMatch[1].padStart(2, '0');
        const minute = timeMatch[2];
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        if (timeMatch[3]) {
          const second = timeMatch[3];
          const timeStr = `${targetDate} ${hour}:${minute}:${second}`;
          searchConditions.push(`timestamp >= $${params.length + 1}::timestamp`);
          searchConditions.push(`timestamp < $${params.length + 1}::timestamp + INTERVAL '1 second'`);
          params.push(timeStr);
        } else {
          const timeStr = `${targetDate} ${hour}:${minute}:00`;
          searchConditions.push(`timestamp >= $${params.length + 1}::timestamp`);
          searchConditions.push(`timestamp < $${params.length + 1}::timestamp + INTERVAL '1 minute'`);
          params.push(timeStr);
        }
        hasSearchCondition = true;
      }
      else if (/^\d{2}$/.test(search)) {
        const num = parseInt(search);
        
        if (filter === 'Temperature') {
          searchConditions.push(`temperature >= $${params.length + 1} AND temperature < $${params.length + 2}`);
          params.push(num, num + 1);
          customOrderBy = 'temperature ASC';
          hasSearchCondition = true;
        } else if (filter === 'Humidity') {
          searchConditions.push(`humidity >= $${params.length + 1} AND humidity < $${params.length + 2}`);
          params.push(num, num + 1);
          customOrderBy = 'humidity ASC';
          hasSearchCondition = true;
        } else if (filter === 'All') {
          searchConditions.push(`(temperature >= $${params.length + 1} AND temperature < $${params.length + 2}) OR (humidity >= $${params.length + 1} AND humidity < $${params.length + 2})`);
          params.push(num, num + 1);
          customOrderBy = `
            CASE 
              WHEN temperature >= ${num} AND temperature < ${num + 1} THEN 1
              WHEN humidity >= ${num} AND humidity < ${num + 1} THEN 2
              ELSE 3
            END, temperature ASC, humidity ASC
          `;
          hasSearchCondition = true;
        }
      }
      else if (/^\d{3,}$/.test(search)) {
        const num = parseInt(search);
        
        if (filter === 'Light' || filter === 'All') {
          searchConditions.push(`light >= $${params.length + 1} AND light < $${params.length + 2}`);
          params.push(num, num + 100);
          customOrderBy = 'light ASC';
          hasSearchCondition = true;
        } else if (filter === 'Temperature' || filter === 'Humidity') {
          const searchParam = `$${params.length + 1}`;
          if (filter === 'Temperature') {
            searchConditions.push(`CAST(temperature AS TEXT) LIKE ${searchParam}`);
          } else if (filter === 'Humidity') {
            searchConditions.push(`CAST(humidity AS TEXT) LIKE ${searchParam}`);
          }
          params.push(`%${search}%`);
          hasSearchCondition = true;
        }
      }
      else {
        const searchParam = `$${params.length + 1}`;
        
        if (filter === 'Temperature') {
          searchConditions.push(`CAST(temperature AS TEXT) LIKE ${searchParam}`);
        } else if (filter === 'Humidity') {
          searchConditions.push(`CAST(humidity AS TEXT) LIKE ${searchParam}`);
        } else if (filter === 'Light') {
          searchConditions.push(`CAST(light AS TEXT) LIKE ${searchParam}`);
        } else {
          searchConditions.push(`CAST(temperature AS TEXT) LIKE ${searchParam}`);
          searchConditions.push(`CAST(humidity AS TEXT) LIKE ${searchParam}`);
          searchConditions.push(`CAST(light AS TEXT) LIKE ${searchParam}`);
        }
        params.push(`%${search}%`);
        hasSearchCondition = true;
      }
      
      if (searchConditions.length > 0) {
        baseQuery += ` WHERE ${searchConditions.join(' OR ')}`;
      }
    }
    
    // Filter by dropdown
    if (filter !== 'All' && !hasSearchCondition) {
      const filterConditions = [];
      if (filter === 'Temperature') {
        filterConditions.push('temperature IS NOT NULL');
      } else if (filter === 'Humidity') {
        filterConditions.push('humidity IS NOT NULL');
      } else if (filter === 'Light') {
        filterConditions.push('light IS NOT NULL');
      }
      
      if (filterConditions.length > 0) {
        if (hasSearchCondition) {
          baseQuery += ` AND ${filterConditions.join(' AND ')}`;
        } else {
          baseQuery += ` WHERE ${filterConditions.join(' AND ')}`;
        }
      }
    }
    
    // Get count
    const countQuery = `SELECT COUNT(*) FROM (${baseQuery}) as counted`;
    const { rows: countRows } = await pool.query(countQuery, params);
    
    // Apply sorting
    if (customOrderBy) {
      baseQuery += ` ORDER BY ${customOrderBy}`;
    } else {
      const validColumns = ['id', 'timestamp', 'temperature', 'humidity', 'light'];
      const validDirs = ['ASC', 'DESC'];
      const safeOrderBy = validColumns.includes(orderBy) ? orderBy : 'timestamp';
      const safeOrderDir = validDirs.includes(orderDir.toUpperCase()) ? orderDir.toUpperCase() : 'DESC';
      baseQuery += ` ORDER BY ${safeOrderBy} ${safeOrderDir}`;
    }
    
    // Pagination
    const offset = (page - 1) * limit;
    baseQuery += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const { rows } = await pool.query(baseQuery, params);
    
    return {
      data: rows,
      total: parseInt(countRows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
      date: date || 'all'
    };
  } else {
    // In-memory fallback
    let allData = inMemoryData.dataSensor.filter(d => d.device_id === deviceId);
    
    if (date) {
      const targetDate = new Date(date).toDateString();
      allData = allData.filter(d => new Date(d.timestamp).toDateString() === targetDate);
    }
    
    if (search) {
      const timeMatch = search.match(/^(\d{1,2}):(\d{2})$/);
      if (timeMatch) {
        const hour = timeMatch[1].padStart(2, '0');
        const minute = timeMatch[2];
        allData = allData.filter(d => {
          const time = new Date(d.timestamp).toTimeString().slice(0, 5);
          return time === `${hour}:${minute}`;
        });
      } else {
        allData = allData.filter(d => {
          const str = JSON.stringify(d).toLowerCase();
          return str.includes(search.toLowerCase());
        });
      }
    }
    
    allData = allData.sort((a, b) => b.timestamp - a.timestamp);
    const offset = (page - 1) * limit;
    const paginatedData = allData.slice(offset, offset + parseInt(limit));
    
    return {
      data: paginatedData,
      total: allData.length,
      page: parseInt(page),
      limit: parseInt(limit),
      date: date || 'all'
    };
  }
};

// Insert sensor data
export const insertSensorData = async (deviceId, sensorType, value, unit, timestamp) => {
  if (getUseDatabase()) {
    await pool.query(
      `INSERT INTO data_sensor(device_id, sensor_type, value, unit, timestamp) 
       VALUES ($1, $2, $3, $4, $5)`,
      [deviceId, sensorType, value, unit, timestamp]
    );
  } else {
    inMemoryData.dataSensor.push({
      id: inMemoryData.dataSensor.length + 1,
      device_id: deviceId,
      sensor_type: sensorType,
      value,
      unit,
      timestamp
    });
    
    if (inMemoryData.dataSensor.length > 1000) {
      inMemoryData.dataSensor = inMemoryData.dataSensor.slice(-500);
    }
  }
};

// Check for duplicate sensor data
export const checkDuplicateSensorData = async (deviceId, timestamp) => {
  if (getUseDatabase()) {
    const result = await pool.query(
      `SELECT COUNT(*) FROM data_sensor 
       WHERE device_id = $1 
       AND timestamp = $2
       LIMIT 1`,
      [deviceId, timestamp]
    );
    return parseInt(result.rows[0].count) > 0;
  }
  return false;
};

