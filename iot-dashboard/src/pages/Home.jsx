import { useState, useEffect, useCallback, memo, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FaThermometerHalf, FaTint, FaSun, FaFan, FaLightbulb, FaWifi, FaWind, FaCloudRain } from 'react-icons/fa';
import apiService from '../services/api';
import mqttService from '../services/mqtt';
import { SENSOR_THRESHOLDS, SENSOR_RANGES } from '../config/constants';
import { getAlertLevel } from '../utils/chartHelpers';
import './Home.css';

const Home = () => {
  const [fanOn, setFanOn] = useState(() => localStorage.getItem('device_fan') === 'true');
  const [acOn, setAcOn] = useState(() => localStorage.getItem('device_ac') === 'true');
  const [lightsOn, setLightsOn] = useState(() => localStorage.getItem('device_lights') === 'true');

  const [temperature, setTemperature] = useState(0);
  const [humidity, setHumidity] = useState(0);
  const [light, setLight] = useState(0);
  const [rainfall, setRainfall] = useState(0);
  const [windSpeed, setWindSpeed] = useState(0);

  const [tempData, setTempData] = useState([]);
  const [humidityData, setHumidityData] = useState([]);
  const [lightData, setLightData] = useState([]);
  const [rainfallData, setRainfallData] = useState([]);
  const [windSpeedData, setWindSpeedData] = useState([]);

  const [mqttConnected, setMqttConnected] = useState(false);

  // Pending states and timeout refs per device
  const [pendingFan, setPendingFan] = useState(false);
  const [pendingAc, setPendingAc] = useState(false);
  const [pendingLights, setPendingLights] = useState(false);
  
  // Hybrid approach: multiple timeout states
  const [deviceStatus, setDeviceStatus] = useState({
    fan: 'idle',    // idle, pending, processing, success, error, network_error
    ac: 'idle',
    lights: 'idle'
  });
  
  const pendingTimersRef = useRef({});
  const retryTimersRef = useRef({});
  
  // Timeout constants for hybrid approach
  const COMMAND_TIMEOUT_MS = 15000;  // 15s: processing -> error
  const RETRY_DELAY_MS = 3000;       // 3s: retry delay

  // Stats removed - using realtime chart data only (10 points = 20s)

  // Helper functions for hybrid approach
  const setDeviceStatusState = (device, status) => {
    setDeviceStatus(prev => ({ ...prev, [device]: status }));
  };

  const clearDeviceTimers = (device) => {
    if (pendingTimersRef.current[device]) {
      clearTimeout(pendingTimersRef.current[device]);
      pendingTimersRef.current[device] = null;
    }
    if (retryTimersRef.current[device]) {
      clearTimeout(retryTimersRef.current[device]);
      retryTimersRef.current[device] = null;
    }
  };

  const handleDeviceCommand = async (device, target, newState) => {
    // Clear any existing timers
    clearDeviceTimers(device);
    
    // Set pending state
    setDeviceStatusState(device, 'pending');
    setPendingFan(device === 'fan');
    setPendingAc(device === 'ac');
    setPendingLights(device === 'lights');

    try {
      // Add timeout for API call itself
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout for API call
      
      await apiService.controlDevice(target, newState ? 'ON' : 'OFF', 'web-user', controller.signal);
      clearTimeout(timeoutId);
      
      // API call successful, set processing state
      setDeviceStatusState(device, 'processing');
      
      // Set timeout for processing -> error
      pendingTimersRef.current[device] = setTimeout(() => {
        setDeviceStatusState(device, 'error');
        
        // Clear pending states
        if (device === 'fan') setPendingFan(false);
        if (device === 'ac') setPendingAc(false);
        if (device === 'lights') setPendingLights(false);
      }, COMMAND_TIMEOUT_MS);
      
    } catch (error) {
      // API call failed (network error or timeout)
      console.log(`API call failed for ${device}:`, error);
      setDeviceStatusState(device, 'network_error');
      
      // Clear pending states
      if (device === 'fan') setPendingFan(false);
      if (device === 'ac') setPendingAc(false);
      if (device === 'lights') setPendingLights(false);
      
      // Retry after delay
      retryTimersRef.current[device] = setTimeout(() => {
        console.log(`Retrying ${device} command...`);
        handleDeviceCommand(device, target, newState);
      }, RETRY_DELAY_MS);
    }
  };

  const handleDeviceFeedback = useCallback((device, status) => {
    // Clear all timers
    clearDeviceTimers(device);
    
    // Update device state
    const newState = status === 'ON';
    if (device === 'fan') {
      setFanOn(newState);
      localStorage.setItem('device_fan', newState);
    } else if (device === 'ac') {
      setAcOn(newState);
      localStorage.setItem('device_ac', newState);
    } else if (device === 'lights') {
      setLightsOn(newState);
      localStorage.setItem('device_lights', newState);
    }
    
    // Clear pending states
    if (device === 'fan') setPendingFan(false);
    if (device === 'ac') setPendingAc(false);
    if (device === 'lights') setPendingLights(false);
    
    // Set success state briefly
    setDeviceStatusState(device, 'success');
    setTimeout(() => setDeviceStatusState(device, 'idle'), 1000);
  }, []);

  const CustomTooltip = memo(({ active, payload, label, unit }) => {
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
  });

  // Helper function to add data point to chart (keep only 10 points = 20s)
  const addChartPoint = useCallback((setData, value) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    setData(prev => {
      const newData = [...prev, { time: timeStr, value: value }];
      // Keep only last 10 points (20 seconds / 2s per point)
      return newData.slice(-10);
    });
  }, []);

  // No more API polling for charts - use MQTT realtime only!

  useEffect(() => {
    mqttService.connect();
    setMqttConnected(mqttService.isConnected());

    const handleTelemetry = (data) => {
      // Update current values AND add to chart (realtime 2s update)
      if (data.temperature != null) {
        setTemperature(data.temperature);
        addChartPoint(setTempData, data.temperature);
      }
      if (data.humidity != null) {
        setHumidity(data.humidity);
        addChartPoint(setHumidityData, data.humidity);
      }
      if (data.light != null) {
        setLight(data.light);
        addChartPoint(setLightData, data.light);
      }
      if (data.rainfall != null) {
        setRainfall(data.rainfall);
        addChartPoint(setRainfallData, data.rainfall);
      }
      if (data.wind_speed != null) {
        setWindSpeed(data.wind_speed);
        addChartPoint(setWindSpeedData, data.wind_speed);
      }
      
      // Sync LED state từ trạng thái thật của ESP32
      if (data.led != null) {
        const ledState = data.led === 'ON';
        setLightsOn(ledState);
        localStorage.setItem('device_lights', ledState);
        // Clear pending when feedback arrives
        setPendingLights(false);
        if (pendingTimersRef.current.led) {
          clearTimeout(pendingTimersRef.current.led);
          pendingTimersRef.current.led = null;
        }
        
      }
      
      // Sync FAN state từ trạng thái thật của ESP32
      if (data.fan != null) {
        const fanState = data.fan === 'ON';
        setFanOn(fanState);
        localStorage.setItem('device_fan', fanState);
        setPendingFan(false);
        if (pendingTimersRef.current.fan) {
          clearTimeout(pendingTimersRef.current.fan);
          pendingTimersRef.current.fan = null;
        }
        
      }
      
      // Sync AC state từ trạng thái thật của ESP32
      if (data.ac != null) {
        const acState = data.ac === 'ON';
        setAcOn(acState);
        localStorage.setItem('device_ac', acState);
        setPendingAc(false);
        if (pendingTimersRef.current.ac) {
          clearTimeout(pendingTimersRef.current.ac);
          pendingTimersRef.current.ac = null;
        }
        
      }
    };

    const handleLedStatus = (status) => {
      handleDeviceFeedback('lights', status);
    };

    const handleFanStatus = (status) => {
      handleDeviceFeedback('fan', status);
    };

    const handleAcStatus = (status) => {
      handleDeviceFeedback('ac', status);
    };

    mqttService.on('telemetry', handleTelemetry);
    mqttService.on('ledStatus', handleLedStatus);
    mqttService.on('fanStatus', handleFanStatus);
    mqttService.on('acStatus', handleAcStatus);

    const checkConnection = setInterval(() => {
      setMqttConnected(mqttService.isConnected());
    }, 1000); // 1 second

    return () => {
      mqttService.off('telemetry', handleTelemetry);
      mqttService.off('ledStatus', handleLedStatus);
      mqttService.off('fanStatus', handleFanStatus);
      mqttService.off('acStatus', handleAcStatus);
      clearInterval(checkConnection);
      
      // Cleanup all timers
      clearDeviceTimers('fan');
      clearDeviceTimers('ac');
      clearDeviceTimers('lights');
    };
  }, [addChartPoint, handleDeviceFeedback]);

  const handleFanToggle = useCallback(async () => {
    const newState = !fanOn;
    await handleDeviceCommand('fan', 'fan', newState);
  }, [fanOn]);

  const handleAcToggle = useCallback(async () => {
    const newState = !acOn;
    await handleDeviceCommand('ac', 'ac', newState);
  }, [acOn]);

  const handleLightsToggle = useCallback(async () => {
    const newState = !lightsOn;
    await handleDeviceCommand('lights', 'led', newState);
  }, [lightsOn]);

  return (
    <div className="home">
      <div className="sensors-grid">
        <div className={`sensor-card alert-${getAlertLevel(temperature, SENSOR_THRESHOLDS.temperature)}`}>
          <div className="sensor-header">
            <FaThermometerHalf className="sensor-icon red" />
            <span className="sensor-label">Temperature</span>
          </div>
          <div className={`sensor-value red alert-value-${getAlertLevel(temperature, SENSOR_THRESHOLDS.temperature)}`}>
            {temperature.toFixed(1)}{SENSOR_RANGES.temperature.unit}
          </div>
        </div>

        <div className="chart-container">
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
                domain={[SENSOR_RANGES.temperature.min, SENSOR_RANGES.temperature.max]}
                label={{ value: SENSOR_RANGES.temperature.unit, angle: 0, position: 'top', offset: 10, style: { fontSize: 10, fill: '#6c7a8f' } }}
              />
              <Tooltip content={(props) => <CustomTooltip {...props} unit={SENSOR_RANGES.temperature.unit} />} />
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

        <div className={`sensor-card alert-${getAlertLevel(humidity, SENSOR_THRESHOLDS.humidity)}`}>
          <div className="sensor-header">
            <FaTint className="sensor-icon cyan" />
            <span className="sensor-label">Humidity</span>
          </div>
          <div className={`sensor-value cyan alert-value-${getAlertLevel(humidity, SENSOR_THRESHOLDS.humidity)}`}>
            {humidity.toFixed(1)}{SENSOR_RANGES.humidity.unit}
          </div>
        </div>

        <div className="chart-container">
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
                domain={[SENSOR_RANGES.humidity.min, SENSOR_RANGES.humidity.max]}
                label={{ value: SENSOR_RANGES.humidity.unit, angle: 0, position: 'top', offset: 10, style: { fontSize: 10, fill: '#6c7a8f' } }}
              />
              <Tooltip content={(props) => <CustomTooltip {...props} unit={SENSOR_RANGES.humidity.unit} />} />
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

        <div className={`sensor-card alert-${getAlertLevel(light, SENSOR_THRESHOLDS.light)}`}>
          <div className="sensor-header">
            <FaSun className="sensor-icon yellow" />
            <span className="sensor-label">Lights</span>
          </div>
          <div className={`sensor-value yellow alert-value-${getAlertLevel(light, SENSOR_THRESHOLDS.light)}`}>
            {light.toFixed(0)}{SENSOR_RANGES.light.unit}
          </div>
        </div>

        <div className="chart-container">
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
                domain={[SENSOR_RANGES.light.min, SENSOR_RANGES.light.max]}
                label={{ value: SENSOR_RANGES.light.unit, angle: 0, position: 'top', offset: 10, style: { fontSize: 10, fill: '#6c7a8f' } }}
              />
              <Tooltip content={(props) => <CustomTooltip {...props} unit={` ${SENSOR_RANGES.light.unit}`} />} />
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

        {/* Rainfall Sensor Card */}
        <div className={`sensor-card alert-${getAlertLevel(rainfall, SENSOR_THRESHOLDS.rainfall)}`}>
          <div className="sensor-header">
            <FaCloudRain className="sensor-icon blue" />
            <span className="sensor-label">Rainfall</span>
          </div>
          <div className={`sensor-value blue alert-value-${getAlertLevel(rainfall, SENSOR_THRESHOLDS.rainfall)}`}>
            {rainfall.toFixed(2)}{SENSOR_RANGES.rainfall.unit}
          </div>
        </div>

        {/* Rainfall Chart */}
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={rainfallData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
                domain={[SENSOR_RANGES.rainfall.min, SENSOR_RANGES.rainfall.max]}
                label={{ value: SENSOR_RANGES.rainfall.unit, angle: 0, position: 'top', offset: 10, style: { fontSize: 10, fill: '#6c7a8f' } }}
              />
              <Tooltip content={(props) => <CustomTooltip {...props} unit={SENSOR_RANGES.rainfall.unit} />} />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#4a90e2" 
                strokeWidth={2} 
                dot={{ fill: '#4a90e2', r: 2 }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Wind Speed Sensor Card */}
        <div className={`sensor-card alert-${getAlertLevel(windSpeed, SENSOR_THRESHOLDS.wind_speed)}`}>
          <div className="sensor-header">
            <FaWind className="sensor-icon green" />
            <span className="sensor-label">Wind Speed</span>
          </div>
          <div className={`sensor-value green alert-value-${getAlertLevel(windSpeed, SENSOR_THRESHOLDS.wind_speed)}`}>
            {windSpeed.toFixed(2)}{SENSOR_RANGES.wind_speed.unit}
          </div>
        </div>

        {/* Wind Speed Chart */}
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={windSpeedData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
                domain={[SENSOR_RANGES.wind_speed.min, SENSOR_RANGES.wind_speed.max]}
                label={{ value: SENSOR_RANGES.wind_speed.unit, angle: 0, position: 'top', offset: 10, style: { fontSize: 10, fill: '#6c7a8f' } }}
              />
              <Tooltip content={(props) => <CustomTooltip {...props} unit={SENSOR_RANGES.wind_speed.unit} />} />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#50c878" 
                strokeWidth={2} 
                dot={{ fill: '#50c878', r: 2 }}
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
              disabled={deviceStatus.fan !== 'idle'}
            >
              <span className="toggle-slider"></span>
            </button>
            {deviceStatus.fan === 'pending' && <div style={{ fontSize: 11, color: '#ffd93d', marginTop: 6 }}></div>}
            {deviceStatus.fan === 'processing' && <div style={{ fontSize: 11, color: '#00b4d8', marginTop: 6 }}>Loading...</div>}
            {deviceStatus.fan === 'error' && <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 6 }}></div>}
            {deviceStatus.fan === 'network_error' && <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 6 }}>Lỗi mạng</div>}
            {deviceStatus.fan === 'success' && <div style={{ fontSize: 11, color: '#51cf66', marginTop: 6 }}></div>}
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
              disabled={deviceStatus.ac !== 'idle'}
            >
              <span className="toggle-slider"></span>
            </button>
            {deviceStatus.ac === 'pending' && <div style={{ fontSize: 11, color: '#ffd93d', marginTop: 6 }}></div>}
            {deviceStatus.ac === 'processing' && <div style={{ fontSize: 11, color: '#00b4d8', marginTop: 6 }}>Loading...</div>}
            {deviceStatus.ac === 'error' && <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 6 }}></div>}
            {deviceStatus.ac === 'network_error' && <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 6 }}>Lỗi mạng</div>}
            {deviceStatus.ac === 'success' && <div style={{ fontSize: 11, color: '#51cf66', marginTop: 6 }}></div>}
          </div>

          {/* Lights Control */}
          <div className="device-card">
            <FaLightbulb className={`device-icon ${lightsOn ? 'light-active' : ''}`} />
            <div className="device-name">LIGHTS</div>
            <button 
              className={`toggle-btn ${lightsOn ? 'on' : 'off'}`}
              onClick={handleLightsToggle}
              disabled={deviceStatus.lights !== 'idle'}
            >
              <span className="toggle-slider"></span>
            </button>
            {deviceStatus.lights === 'pending' && <div style={{ fontSize: 11, color: '#ffd93d', marginTop: 6 }}></div>}
            {deviceStatus.lights === 'processing' && <div style={{ fontSize: 11, color: '#00b4d8', marginTop: 6 }}>Loading...</div>}
            {deviceStatus.lights === 'error' && <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 6 }}></div>}
            {deviceStatus.lights === 'network_error' && <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 6 }}>Lỗi mạng</div>}
            {deviceStatus.lights === 'success' && <div style={{ fontSize: 11, color: '#51cf66', marginTop: 6 }}></div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;