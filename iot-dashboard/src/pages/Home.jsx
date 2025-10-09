import { useState, useEffect, useCallback, memo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FaThermometerHalf, FaTint, FaSun, FaFan, FaLightbulb, FaWifi, FaWind } from 'react-icons/fa';
import apiService from '../services/api';
import mqttService from '../services/mqtt';
import { CHART_CONFIG, SENSOR_THRESHOLDS, SENSOR_RANGES } from '../config/constants';
import { sampleChartData, calculateStats, getAlertLevel } from '../utils/chartHelpers';
import './Home.css';

const Home = () => {
  const [fanOn, setFanOn] = useState(() => localStorage.getItem('device_fan') === 'true');
  const [acOn, setAcOn] = useState(() => localStorage.getItem('device_ac') === 'true');
  const [lightsOn, setLightsOn] = useState(() => localStorage.getItem('device_lights') === 'true');

  const [temperature, setTemperature] = useState(0);
  const [humidity, setHumidity] = useState(0);
  const [light, setLight] = useState(0);

  const [tempData, setTempData] = useState([]);
  const [humidityData, setHumidityData] = useState([]);
  const [lightData, setLightData] = useState([]);

  const [mqttConnected, setMqttConnected] = useState(false);

  const [tempStats, setTempStats] = useState({ min: 0, max: 0, avg: 0 });
  const [humStats, setHumStats] = useState({ min: 0, max: 0, avg: 0 });
  const [lightStats, setLightStats] = useState({ min: 0, max: 0, avg: 0 });

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

  useEffect(() => {
    const fetchLatestData = async () => {
      const data = await apiService.getLatestData();
      if (data) {
        setTemperature(data.temperature?.value || 0);
        setHumidity(data.humidity?.value || 0);
        setLight(data.light?.value || 0);
      }
    };

    const fetchChartData = async () => {
      const tempSeries = await apiService.getTimeSeries('today', 'temperature', CHART_CONFIG.DEFAULT_LIMIT);
      const humSeries = await apiService.getTimeSeries('today', 'humidity', CHART_CONFIG.DEFAULT_LIMIT);
      const lightSeries = await apiService.getTimeSeries('today', 'light', CHART_CONFIG.DEFAULT_LIMIT);

      if (tempSeries?.data && tempSeries.data.length > 0) {
        setTempData(sampleChartData(tempSeries.data));
        setTempStats(calculateStats(tempSeries.data));
      }
      
      if (humSeries?.data && humSeries.data.length > 0) {
        setHumidityData(sampleChartData(humSeries.data));
        setHumStats(calculateStats(humSeries.data));
      }
      
      if (lightSeries?.data && lightSeries.data.length > 0) {
        setLightData(sampleChartData(lightSeries.data));
        setLightStats(calculateStats(lightSeries.data));
      }
    };

    fetchLatestData();
    fetchChartData();

    const interval = setInterval(() => {
      fetchLatestData();
      fetchChartData();
    }, CHART_CONFIG.UPDATE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    mqttService.connect();
    setMqttConnected(mqttService.isConnected());

    const handleTelemetry = (data) => {
      if (data.temperature != null) setTemperature(data.temperature);
      if (data.humidity != null) setHumidity(data.humidity);
      if (data.light != null) setLight(data.light);
    };

    const handleLedStatus = (status) => {
      const newState = status === 'ON';
      setLightsOn(newState);
      localStorage.setItem('device_lights', newState);
    };

    mqttService.on('telemetry', handleTelemetry);
    mqttService.on('ledStatus', handleLedStatus);

    const checkConnection = setInterval(() => {
      setMqttConnected(mqttService.isConnected());
    }, CHART_CONFIG.CONNECTION_CHECK_INTERVAL_MS);

    return () => {
      mqttService.off('telemetry', handleTelemetry);
      mqttService.off('ledStatus', handleLedStatus);
      clearInterval(checkConnection);
    };
  }, []);

  const handleFanToggle = useCallback(async () => {
    const newState = !fanOn;
    setFanOn(newState);
    localStorage.setItem('device_fan', newState);
    await apiService.controlDevice('fan', newState ? 'ON' : 'OFF', 'web-user');
  }, [fanOn]);

  const handleAcToggle = useCallback(async () => {
    const newState = !acOn;
    setAcOn(newState);
    localStorage.setItem('device_ac', newState);
    await apiService.controlDevice('ac', newState ? 'ON' : 'OFF', 'web-user');
  }, [acOn]);

  const handleLightsToggle = useCallback(async () => {
    const newState = !lightsOn;
    setLightsOn(newState);
    localStorage.setItem('device_lights', newState);
    await apiService.controlDevice('led', newState ? 'ON' : 'OFF', 'web-user');
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