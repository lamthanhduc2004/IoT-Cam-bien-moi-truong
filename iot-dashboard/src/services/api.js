// API Service - Kết nối với Backend
const API_BASE_URL = 'http://localhost:3000/api';
const DEVICE_ID = 'esp32_01';

class ApiService {
  // Health check
  async healthCheck() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      return { status: 'error', error: error.message };
    }
  }

  // Lấy dữ liệu mới nhất
  async getLatestData() {
    try {
      const response = await fetch(`${API_BASE_URL}/devices/${DEVICE_ID}/last`);
      return await response.json();
    } catch (error) {
      console.error('Get latest data failed:', error);
      return null;
    }
  }

  // Lấy dữ liệu time series cho biểu đồ
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

  // Lấy tất cả sensor data với pagination, search, filter, sorting
  async getSensors(page = 1, limit = 10, search = '', filter = 'All', orderBy = 'timestamp', orderDir = 'DESC') {
    try {
      const params = new URLSearchParams({
        page,
        limit,
        search,
        filter,
        orderBy,
        orderDir
      });
      
      const response = await fetch(
        `${API_BASE_URL}/devices/${DEVICE_ID}/sensors?${params}`
      );
      return await response.json();
    } catch (error) {
      console.error('Get sensors failed:', error);
      return { data: [], total: 0, page, limit };
    }
  }

  // Lấy lịch sử điều khiển (UPDATED)
  async getActions(limit = 50) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/devices/${DEVICE_ID}/actions?limit=${limit}`
      );
      return await response.json();
    } catch (error) {
      console.error('Get actions failed:', error);
      return [];
    }
  }

  // Điều khiển thiết bị
  async controlDevice(target, value, issued_by = 'web') {
    try {
      const response = await fetch(
        `${API_BASE_URL}/devices/${DEVICE_ID}/cmd/${target}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ value, issued_by }),
        }
      );
      return await response.json();
    } catch (error) {
      console.error('Control device failed:', error);
      return { ok: false, error: error.message };
    }
  }

  // Get device info
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