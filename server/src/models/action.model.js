import { pool, inMemoryData, getUseDatabase } from '../config/database.js';

// Get paginated action history with filters
export const getActionsWithFilters = async (deviceId, page, limit, search, filter, orderBy, orderDir, date) => {
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
    
    // Filter by target (device type)
    if (filter !== 'All') {
      whereConditions.push(`target = $${params.length + 1}`);
      params.push(filter.toLowerCase());
    }
    
    let baseQuery = `SELECT * FROM device_actions WHERE ${whereConditions.join(' AND ')}`;
    
    // Search
    if (search) {
      const searchConditions = [];
      const timeMatch = search.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
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
      } else if (timeMatch) {
        const hour = timeMatch[1].padStart(2, '0');
        const minute = timeMatch[2];
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        if (timeMatch[3]) {
          const second = timeMatch[3];
          const timeStr = `${targetDate} ${hour}:${minute}:${second}`;
          searchConditions.push(`timestamp >= $${params.length + 1}::timestamp AND timestamp < $${params.length + 1}::timestamp + INTERVAL '1 second'`);
          params.push(timeStr);
        } else {
          const timeStr = `${targetDate} ${hour}:${minute}:00`;
          searchConditions.push(`timestamp >= $${params.length + 1}::timestamp AND timestamp < $${params.length + 1}::timestamp + INTERVAL '1 minute'`);
          params.push(timeStr);
        }
      } else {
        const searchParam = `$${params.length + 1}`;
        searchConditions.push(`target ILIKE ${searchParam}`);
        searchConditions.push(`action ILIKE ${searchParam}`);
        params.push(`%${search}%`);
      }
      
      if (searchConditions.length > 0) {
        baseQuery += ` AND (${searchConditions.join(' OR ')})`;
      }
    }
    
    // Get count
    const countQuery = `SELECT COUNT(*) FROM (${baseQuery}) as counted`;
    const { rows: countRows } = await pool.query(countQuery, params);
    
    // Apply sorting
    const validColumns = ['id', 'timestamp', 'target', 'action', 'issued_by'];
    const validDirs = ['ASC', 'DESC'];
    const safeOrderBy = validColumns.includes(orderBy) ? orderBy : 'timestamp';
    const safeOrderDir = validDirs.includes(orderDir.toUpperCase()) ? orderDir.toUpperCase() : 'DESC';
    baseQuery += ` ORDER BY ${safeOrderBy} ${safeOrderDir}`;
    
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
    let allData = inMemoryData.deviceActions.filter(d => d.device_id === deviceId);
    
    if (date) {
      const targetDate = new Date(date).toDateString();
      allData = allData.filter(d => new Date(d.timestamp).toDateString() === targetDate);
    }
    
    if (filter !== 'All') {
      allData = allData.filter(d => d.target.toLowerCase() === filter.toLowerCase());
    }
    
    if (search) {
      allData = allData.filter(d => {
        const str = JSON.stringify(d).toLowerCase();
        return str.includes(search.toLowerCase());
      });
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

// Insert action log
export const insertActionLog = async (deviceId, target, action, issuedBy, result, note, timestamp) => {
  if (getUseDatabase()) {
    if (note) {
      await pool.query(
        `INSERT INTO device_actions(device_id, target, action, issued_by, result, note, timestamp) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [deviceId, target, action, issuedBy, result, note, timestamp]
      );
    } else {
      await pool.query(
        `INSERT INTO device_actions(device_id, target, action, issued_by, result, timestamp) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [deviceId, target, action, issuedBy, result, timestamp]
      );
    }
  } else {
    const newAction = {
      id: inMemoryData.deviceActions.length + 1,
      device_id: deviceId,
      target,
      action,
      issued_by: issuedBy,
      result,
      timestamp
    };
    if (note) newAction.note = note;
    
    inMemoryData.deviceActions.push(newAction);
    
    if (inMemoryData.deviceActions.length > 100) {
      inMemoryData.deviceActions = inMemoryData.deviceActions.slice(-50);
    }
  }
};

