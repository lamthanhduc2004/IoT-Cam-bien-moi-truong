-- IoT Database Schema
-- Run: psql "postgres://postgres:postgres@localhost:5432/iotdb" -f db-schema.sql

-- Bảng data_sensor - Lưu dữ liệu từ sensors
CREATE TABLE IF NOT EXISTS data_sensor (
  id BIGSERIAL PRIMARY KEY,
  device_id VARCHAR(64) NOT NULL,
  sensor_type VARCHAR(16) NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  unit VARCHAR(8),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index cho query nhanh
CREATE INDEX IF NOT EXISTS idx_data_sensor_device_ts ON data_sensor(device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_data_sensor_type ON data_sensor(sensor_type);
CREATE INDEX IF NOT EXISTS idx_data_sensor_timestamp ON data_sensor(timestamp DESC);

-- Bảng device_actions - Lưu lịch sử điều khiển
CREATE TABLE IF NOT EXISTS device_actions (
  id BIGSERIAL PRIMARY KEY,
  device_id VARCHAR(64) NOT NULL,
  target VARCHAR(16) NOT NULL,
  action VARCHAR(16) NOT NULL,
  issued_by VARCHAR(64),
  result VARCHAR(16),
  note VARCHAR(255),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index cho query nhanh
CREATE INDEX IF NOT EXISTS idx_device_actions_device_ts ON device_actions(device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_device_actions_target ON device_actions(target);
CREATE INDEX IF NOT EXISTS idx_device_actions_timestamp ON device_actions(timestamp DESC);

-- Thông báo hoàn thành
SELECT 'Database schema created successfully!' AS message;
SELECT 'Tables: data_sensor, device_actions' AS info;

