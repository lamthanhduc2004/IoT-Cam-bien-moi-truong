import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { FaThermometerHalf, FaTint, FaSun, FaFan, FaLightbulb, FaWifi, FaWind } from 'react-icons/fa';
import apiService from '../services/api';
import mqttService from '../services/mqtt';
import './Home.css';

const Home = () => {
  // Device states
  const [fanOn, setFanOn] = useState(false);
  const [acOn, setAcOn] = useState(false);
  const [lightsOn, setLightsOn] = useState(false);

  // Sensor data
  const [temperature, setTemperature] = useState(0);
  const [humidity, setHumidity] = useState(0);
  const [light, setLight] = useState(0);

  // Chart data
  const [tempData, setTempData] = useState([]);
  const [humidityData, setHumidityData] = useState([]);
  const [lightData, setLightData] = useState([]);

  // MQTT connection status
  const [mqttConnected, setMqttConnected] = useState(false);

  // Stats tracking
  const [tempStats, setTempStats] = useState({ min: 0, max: 0, avg: 0 });
  const [humStats, setHumStats] = useState({ min: 0, max: 0, avg: 0 });
  const [lightStats, setLightStats] = useState({ min: 0, max: 0, avg: 0 });

  // ✅ Custom Tooltip Component
  const CustomTooltip = ({ active, payload, label, unit }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: '#1a1f2e',
          border: '1px solid #00b4d8',
          borderRadius: '8px',
          padding: '10px',
          color: '#fff'
        }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#00b4d8' }}>
            {payload[0].payload.time || label}
          </p>
          <p style={{ margin: '5px 0 0 0', fontSize: '14px', fontWeight: 'bold' }}>
            {payload[0].value.toFixed(1)}{unit}
          </p>
        </div>
      );
    }
    return null;
  };

  // ✅ Hàm kiểm tra mức cảnh báo
  const getAlertLevel = (value, type) => {
    switch (type) {
      case 'temperature':
        if (value < 10 || value > 35) return 'danger';
        if (value < 15 || value > 30) return 'warning';
        return 'normal';
      
      case 'humidity':
        if (value < 20 || value > 80) return 'danger';
        if (value < 30 || value > 70) return 'warning';
        return 'normal';
      
      case 'light':
        if (value < 100 || value > 4000) return 'danger';
        if (value < 200 || value > 3000) return 'warning';
        return 'normal';
      
      default:
        return 'normal';
    }
  };

  // Fetch initial data và chart data
  useEffect(() => {
    // Fetch latest sensor data
    const fetchLatestData = async () => {
      const data = await apiService.getLatestData();
      if (data) {
        setTemperature(data.temperature?.value || 0);
        setHumidity(data.humidity?.value || 0);
        setLight(data.light?.value || 0);
      }
    };

    // Fetch chart data
    const fetchChartData = async () => {
      // ✅ Query "today" - Backend sẽ lấy data từ 00:00 hôm nay (tối ưu!)
      const tempSeries = await apiService.getTimeSeries('today', 'temperature', 20000);
      const humSeries = await apiService.getTimeSeries('today', 'humidity', 20000);
      const lightSeries = await apiService.getTimeSeries('today', 'light', 20000);

      if (tempSeries?.data && tempSeries.data.length > 0) {
        // ✅ BIỂU ĐỒ 24H: Chỉ hiển thị data HÔM NAY, sampling 30 phút
        const sampledData = [];
        const intervalMs = 30 * 60 * 1000; // 30 phút
        
        // Lấy 00:00 và 24:00 của HÔM NAY (local time)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dayStart = today.getTime();
        const dayEnd = dayStart + 24 * 60 * 60 * 1000;
        
        console.log('🆕 CODE MỚI CHẠY! HÔM NAY:', today.toLocaleDateString('vi-VN'));
        console.log('   Backend trả về:', tempSeries.data.length, 'records');
        
        // Lọc chỉ lấy data HÔM NAY
        const todayData = tempSeries.data.filter(d => {
          const ts = new Date(d.timestamp).getTime();
          return ts >= dayStart && ts < dayEnd;
        });
        
        console.log('   Data hôm nay:', todayData.length, 'records');
        
        // Tạo 48 time slots (00:00 → 24:00)
        for (let i = 0; i < 48; i++) {
          const slotStart = dayStart + (i * intervalMs);
          const slotEnd = slotStart + intervalMs;
          
          // Lấy data points trong slot này
          const pointsInSlot = todayData.filter(d => {
            const ts = new Date(d.timestamp).getTime();
            return ts >= slotStart && ts < slotEnd;
          });
          
          // CHỈ THÊM ĐIỂM NẾU CÓ DATA
          if (pointsInSlot.length > 0) {
            const avgValue = pointsInSlot.reduce((sum, p) => sum + p.value, 0) / pointsInSlot.length;
            const slotDate = new Date(slotStart);
            
            sampledData.push({
              time: slotDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
              value: avgValue,
              timestamp: slotDate.toISOString()
            });
          }
        }
        
        console.log('   Sau sampling:', sampledData.length, 'điểm');
        if (sampledData.length > 0) {
          console.log('   Từ:', sampledData[0].time, '→', sampledData[sampledData.length - 1].time);
        }
        
        setTempData(sampledData);
        
        // Calculate stats từ raw data
        const values = tempSeries.data.map(d => d.value);
        setTempStats({
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((a, b) => a + b, 0) / values.length
        });
      }
      
      if (humSeries?.data && humSeries.data.length > 0) {
        // ✅ BIỂU ĐỒ 24H: Chỉ hiển thị data HÔM NAY, sampling 30 phút
        const sampledData = [];
        const intervalMs = 30 * 60 * 1000;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dayStart = today.getTime();
        const dayEnd = dayStart + 24 * 60 * 60 * 1000;
        
        const todayData = humSeries.data.filter(d => {
          const ts = new Date(d.timestamp).getTime();
          return ts >= dayStart && ts < dayEnd;
        });
        
        for (let i = 0; i < 48; i++) {
          const slotStart = dayStart + (i * intervalMs);
          const slotEnd = slotStart + intervalMs;
          
          const pointsInSlot = todayData.filter(d => {
            const ts = new Date(d.timestamp).getTime();
            return ts >= slotStart && ts < slotEnd;
          });
          
          if (pointsInSlot.length > 0) {
            const avgValue = pointsInSlot.reduce((sum, p) => sum + p.value, 0) / pointsInSlot.length;
            const slotDate = new Date(slotStart);
            
            sampledData.push({
              time: slotDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
              value: avgValue,
              timestamp: slotDate.toISOString()
            });
          }
        }
        
        setHumidityData(sampledData);
        
        const values = humSeries.data.map(d => d.value);
        setHumStats({
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((a, b) => a + b, 0) / values.length
        });
      }
      
      if (lightSeries?.data && lightSeries.data.length > 0) {
        // ✅ BIỂU ĐỒ 24H: Chỉ hiển thị data HÔM NAY, sampling 30 phút
        const sampledData = [];
        const intervalMs = 30 * 60 * 1000;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dayStart = today.getTime();
        const dayEnd = dayStart + 24 * 60 * 60 * 1000;
        
        const todayData = lightSeries.data.filter(d => {
          const ts = new Date(d.timestamp).getTime();
          return ts >= dayStart && ts < dayEnd;
        });
        
        for (let i = 0; i < 48; i++) {
          const slotStart = dayStart + (i * intervalMs);
          const slotEnd = slotStart + intervalMs;
          
          const pointsInSlot = todayData.filter(d => {
            const ts = new Date(d.timestamp).getTime();
            return ts >= slotStart && ts < slotEnd;
          });
          
          if (pointsInSlot.length > 0) {
            const avgValue = pointsInSlot.reduce((sum, p) => sum + p.value, 0) / pointsInSlot.length;
            const slotDate = new Date(slotStart);
            
            sampledData.push({
              time: slotDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
              value: avgValue,
              timestamp: slotDate.toISOString()
            });
          }
        }
        
        setLightData(sampledData);
        
        const values = lightSeries.data.map(d => d.value);
        setLightStats({
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((a, b) => a + b, 0) / values.length
        });
      }
    };

    fetchLatestData();
    fetchChartData();

    // Refresh data every 10 seconds
    const interval = setInterval(() => {
      fetchLatestData();
      fetchChartData();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // MQTT realtime updates
  useEffect(() => {
    // Connect MQTT
    mqttService.connect();

    // Listen for telemetry
    const handleTelemetry = (data) => {
      console.log('📊 Realtime data:', data);
      if (data.temperature != null) setTemperature(data.temperature);
      if (data.humidity != null) setHumidity(data.humidity);
      if (data.light != null) setLight(data.light);
    };

    // Listen for LED status
    const handleLedStatus = (status) => {
      console.log('💡 LED status:', status);
      setLightsOn(status === 'ON');
    };

    mqttService.on('telemetry', handleTelemetry);
    mqttService.on('ledStatus', handleLedStatus);

    // Check MQTT connection every second
    const checkConnection = setInterval(() => {
      setMqttConnected(mqttService.isConnected());
    }, 5000);

    return () => {
      mqttService.off('telemetry', handleTelemetry);
      mqttService.off('ledStatus', handleLedStatus);
      clearInterval(checkConnection);
    };
  }, []);

  // Control handlers
  const handleFanToggle = async () => {
    const newState = !fanOn;
    setFanOn(newState);
    const result = await apiService.controlDevice('fan', newState ? 'ON' : 'OFF', 'web-user');
    console.log('Fan control:', result);
  };

  const handleAcToggle = async () => {
    const newState = !acOn;
    setAcOn(newState);
    const result = await apiService.controlDevice('ac', newState ? 'ON' : 'OFF', 'web-user');
    console.log('AC control:', result);
  };

  const handleLightsToggle = async () => {
    const newState = !lightsOn;
    setLightsOn(newState);
    
    // Gửi command qua API (sẽ publish MQTT)
    const result = await apiService.controlDevice('led', newState ? 'ON' : 'OFF', 'web-user');
    console.log('LED control:', result);
    
    // MQTT sẽ nhận status update từ ESP32
  };

  return (
    <div className="home">
      <div className="sensors-grid">
        {/* Temperature Section */}
        <div className={`sensor-card alert-${getAlertLevel(temperature, 'temperature')}`}>
          <div className="sensor-header">
            <FaThermometerHalf className="sensor-icon red" />
            <span className="sensor-label">Temperature</span>
          </div>
          <div className={`sensor-value red alert-value-${getAlertLevel(temperature, 'temperature')}`}>
            {temperature.toFixed(1)}°C
          </div>
        </div>

        <div className="chart-container">
          {/* Removed stats header to give more space for the chart */}
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={tempData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3548" />
              <XAxis 
                dataKey="time" 
                stroke="#6c7a8f" 
                tick={{ fontSize: 9 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                stroke="#6c7a8f" 
                tick={{ fontSize: 10 }}
                domain={[0, 40]}
                label={{ value: '°C', angle: 0, position: 'top', offset: 10, style: { fontSize: 10, fill: '#6c7a8f' } }}
              />
              <Tooltip content={(props) => <CustomTooltip {...props} unit="°C" />} />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#ff6b6b" 
                strokeWidth={2} 
                dot={{ fill: '#ff6b6b', r: 2 }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Humidity Section */}
        <div className={`sensor-card alert-${getAlertLevel(humidity, 'humidity')}`}>
          <div className="sensor-header">
            <FaTint className="sensor-icon cyan" />
            <span className="sensor-label">Humidity</span>
          </div>
          <div className={`sensor-value cyan alert-value-${getAlertLevel(humidity, 'humidity')}`}>
            {humidity.toFixed(1)}%
          </div>
        </div>

        <div className="chart-container">
          {/* Removed stats header to give more space for the chart */}
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={humidityData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3548" />
              <XAxis 
                dataKey="time" 
                stroke="#6c7a8f" 
                tick={{ fontSize: 9 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                stroke="#6c7a8f" 
                tick={{ fontSize: 10 }}
                domain={[0, 100]}
                label={{ value: '%', angle: 0, position: 'top', offset: 10, style: { fontSize: 10, fill: '#6c7a8f' } }}
              />
              <Tooltip content={(props) => <CustomTooltip {...props} unit="%" />} />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#00b4d8" 
                strokeWidth={2} 
                dot={{ fill: '#00b4d8', r: 2 }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Lights Section */}
        <div className={`sensor-card alert-${getAlertLevel(light, 'light')}`}>
          <div className="sensor-header">
            <FaSun className="sensor-icon yellow" />
            <span className="sensor-label">Lights</span>
          </div>
          <div className={`sensor-value yellow alert-value-${getAlertLevel(light, 'light')}`}>
            {light.toFixed(0)}nits
          </div>
        </div>

        <div className="chart-container">
          {/* Removed stats header to give more space for the chart */}
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={lightData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3548" />
              <XAxis 
                dataKey="time" 
                stroke="#6c7a8f" 
                tick={{ fontSize: 9 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                stroke="#6c7a8f" 
                tick={{ fontSize: 10 }}
                domain={[0, 4095]}
                label={{ value: 'nits', angle: 0, position: 'top', offset: 10, style: { fontSize: 10, fill: '#6c7a8f' } }}
              />
              <Tooltip content={(props) => <CustomTooltip {...props} unit=" nits" />} />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#ffd93d" 
                strokeWidth={2} 
                dot={{ fill: '#ffd93d', r: 2 }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Devices Control Section */}
      <div className="devices-section">
        <div className="devices-header">
          <FaWifi className={`wifi-icon ${mqttConnected ? 'connected' : 'disconnected'}`} />
          <span className="devices-label">Devices {mqttConnected && '(Live)'}</span>
        </div>

        <div className="devices-grid">
          {/* Fan Control */}
          <div className="device-card">
            <FaFan className={`device-icon ${fanOn ? 'spinning' : ''}`} />
            <div className="device-name">FAN</div>
            <button 
              className={`toggle-btn ${fanOn ? 'on' : 'off'}`}
              onClick={handleFanToggle}
            >
              <span className="toggle-slider"></span>
            </button>
          </div>

          {/* AC Control */}
          <div className="device-card">
            <div className="ac-icon-container">
              <FaWind className={`device-icon ac-icon ${acOn ? 'ac-active' : ''}`} />
              {acOn && (
                <>
                  <div className="wind-wave wave-1"></div>
                  <div className="wind-wave wave-2"></div>
                  <div className="wind-wave wave-3"></div>
                </>
              )}
            </div>
            <div className="device-name">A/C</div>
            <button 
              className={`toggle-btn ${acOn ? 'on' : 'off'}`}
              onClick={handleAcToggle}
            >
              <span className="toggle-slider"></span>
            </button>
          </div>

          {/* Lights Control */}
          <div className="device-card">
            <FaLightbulb className={`device-icon ${lightsOn ? 'light-active' : ''}`} />
            <div className="device-name">LIGHTS</div>
            <button 
              className={`toggle-btn ${lightsOn ? 'on' : 'off'}`}
              onClick={handleLightsToggle}
            >
              <span className="toggle-slider"></span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;