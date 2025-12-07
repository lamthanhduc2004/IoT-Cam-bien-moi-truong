import { API_CONFIG } from '../config/constants';

const { BASE_URL: API_BASE_URL, DEVICE_ID } = API_CONFIG;

class ApiService {
  async healthCheck() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      return { status: 'error', error: error.message };
    }
  }

  async getLatestData() {
    try {
      const response = await fetch(`${API_BASE_URL}/devices/${DEVICE_ID}/last`);
      return await response.json();
    } catch (error) {
      console.error('Get latest data failed:', error);
      return null;
    }
  }

  async getTimeSeries(from = '1hour', sensor = 'temperature', limit = 50) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/devices/${DEVICE_ID}/series?from=${from}&sensor=${sensor}&limit=${limit}`
      );
      return await response.json();
    } catch (error) {
      console.error('Get time series failed:', error);
      return { data: [] };
    }
  }

  async getSensors(page = 1, limit = 10, search = '', filter = 'All', orderBy = 'timestamp', orderDir = 'DESC', date = null) {
    try {
      const params = new URLSearchParams({
        page,
        limit,
        search,
        filter,
        orderBy,
        orderDir
      });
      
      if (date) {
        params.append('date', date);
      }
      
      const response = await fetch(
        `${API_BASE_URL}/devices/${DEVICE_ID}/sensors?${params}`
      );
      return await response.json();
    } catch (error) {
      console.error('Get sensors failed:', error);
      return { data: [], total: 0, page, limit };
    }
  }

  async getActions(page = 1, limit = 10, search = '', filter = 'All', orderBy = 'timestamp', orderDir = 'DESC', date = '') {
    try {
      const params = new URLSearchParams({
        page,
        limit,
        search,
        filter,
        orderBy,
        orderDir,
        date
      });
      const response = await fetch(`${API_BASE_URL}/devices/${DEVICE_ID}/actions?${params}`);
      return await response.json();
    } catch (error) {
      console.error('Get actions failed:', error);
      return { data: [], total: 0 };
    }
  }

  async controlDevice(target, value, issued_by = 'web', signal = null) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/devices/${DEVICE_ID}/cmd/${target}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ value, issued_by }),
          signal: signal
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Control device failed:', error);
      throw error; // Re-throw để Home.jsx catch được
    }
  }

  async getDeviceInfo() {
    try {
      const response = await fetch(`${API_BASE_URL}/devices/${DEVICE_ID}`);
      return await response.json();
    } catch (error) {
      console.error('Get device info failed:', error);
      return null;
    }
  }
}

export default new ApiService();
