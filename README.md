# 🌡️ IoT Environmental Monitoring System

## 📝 Mô tả
Hệ thống giám sát môi trường IoT sử dụng ESP32 và cảm biến DHT22, LDR để đo nhiệt độ, độ ẩm, và ánh sáng. Dữ liệu được truyền qua MQTT và hiển thị trên dashboard web.

## 🛠️ Công nghệ sử dụng

### Hardware
- **ESP32** - Vi điều khiển chính
- **DHT22** - Cảm biến nhiệt độ và độ ẩm
- **MH-Sensor Flying-Fish (LDR)** - Cảm biến ánh sáng
- **LED & AC Control** - Điều khiển thiết bị

### Software Stack
- **Frontend**: React.js + Vite (Layered Architecture)
- **Backend**: Node.js + Express (MVC Pattern)
- **Database**: PostgreSQL 16+
- **MQTT Broker**: Mosquitto
- **Charting**: Recharts
- **State Management**: React Hooks + localStorage
- **Architecture**: Layered Frontend + MVC Backend

## 📁 Cấu trúc dự án
```
IoT-Environmental-Monitoring/
├── 📁 iot-dashboard/          # React Frontend (Layered Architecture)
│   └── src/
│       ├── config/            # Constants & configuration
│       ├── services/          # API & MQTT client
│       ├── utils/             # Helper functions
│       ├── pages/             # UI Components
│       └── App.jsx
│
├── 📁 server/                 # Node.js Backend (MVC Architecture)
│   ├── src/
│   │   ├── config/           # Database & MQTT config
│   │   ├── models/           # Data access layer
│   │   ├── controllers/      # Business logic
│   │   ├── routes/           # API routes
│   │   ├── services/         # MQTT service
│   │   └── middleware/       # Error handling
│   ├── index.js              # Entry point (75 lines)
│   └── db-schema.sql         # Database schema
│
├── 📁 esp32/                  # ESP32 Arduino code
│   └── test.ino
│
├── 📁 mqtt-broker/            # Mosquitto configuration
│   ├── broker.conf
│   └── passwdfile
│
├── 📁 docs/                   # Documentation
│   ├── Demo-cho-thay.md
│   ├── SRS_IoT_Demo.docx
│   └── ...
│
├── 📁 tests/                  # Test files
│   └── test-action-history-api.html
│
├── 📁 design/                 # Design files
│   └── Figma IoT.fig
│
├── README.md
└── start-all.bat              # Quick start script
```

## 🚀 Hướng dẫn cài đặt

### 1. Cài đặt Dependencies

**Backend:**
```bash
cd server
npm install
```

**Frontend:**
```bash
cd iot-dashboard
npm install
```

### 2. Cấu hình Database
```bash
# Tạo database
createdb -U postgres iotdb

# Import schema
psql -U postgres -d iotdb -f server/db-schema.sql

# Tạo index (tối ưu performance)
psql -U postgres -d iotdb -c "CREATE INDEX idx_data_sensor_device_time_type ON data_sensor(device_id, timestamp DESC, sensor_type);"
psql -U postgres -d iotdb -c "ANALYZE data_sensor;"
```

### 3. Cấu hình Environment Variables
Tạo file `server/.env`:
```env
PORT=3000
MQTT_BROKER=mqtt://localhost:1883
MQTT_USER=user1
MQTT_PASS=123456
DEVICE_ID=esp32-001

DB_HOST=localhost
DB_PORT=5432
DB_NAME=iotdb
DB_USER=postgres
DB_PASS=your_password
```

### 4. Khởi động hệ thống

**Tự động (Windows):**
```bash
start-all.bat
```

**Thủ công:**
```bash
# Terminal 1: MQTT Broker
mosquitto -c mqtt-broker/broker.conf -v

# Terminal 2: Backend
cd server
node index.js

# Terminal 3: Frontend
cd iot-dashboard
npm run dev

# Terminal 4: Upload code lên ESP32
arduino-cli upload -p COM3 esp32/test.ino
```

## 📊 Tính năng

### Dashboard (Home)
- ✅ Hiển thị realtime: Nhiệt độ, Độ ẩm, Ánh sáng
- ✅ Điều khiển: LED, Quạt, Điều hòa
- ✅ Biểu đồ 24h với sampling 30 phút
- ✅ Cảnh báo ngưỡng (warning/danger animation)

### Data_Sensor
- ✅ Bảng dữ liệu với pagination (5/10/20/50 rows)
- ✅ Smart search:
  - Time: `HH:MM` hoặc `HH:MM:SS`
  - Full datetime: `HH:MM DD/MM/YYYY`
  - 2 digits: Tìm nhiệt độ + độ ẩm (28 → 28.0-28.9°C/%)
  - 3+ digits: Tìm ánh sáng (500 → 500-599 nits)
- ✅ Sắp xếp theo cột (backend sorting)
- ✅ Click to copy timestamp
- ✅ Filter theo sensor type (Temperature/Humidity/Light)
- ✅ Date picker với auto-update
- ✅ Data retention: Tự động xóa data > 30 ngày

### Action History
- ✅ Lịch sử điều khiển thiết bị
- ✅ Smart search (time, datetime, device name)
- ✅ Filter theo device (Fan/AC/LED)
- ✅ Backend sorting & pagination
- ✅ Click to copy timestamp
- ✅ Date picker với auto-update

## 🔧 ESP32 Configuration
```cpp
// WiFi
const char* ssid = "your_wifi_ssid";
const char* password = "your_wifi_password";

// MQTT
const char* mqtt_server = "192.168.x.x";
const int mqtt_port = 1883;
```

## 📡 MQTT Topics
- `esp32/telemetry` - Dữ liệu sensor (mỗi 2s)
- `esp32/control/led` - Điều khiển LED
- `esp32/control/fan` - Điều khiển quạt
- `esp32/control/ac` - Điều khiển điều hòa

## 🎨 Screenshots
_Coming soon..._

## 👥 Tác giả
- **Lâm Thanh Đức** - Developer

## 📄 License
MIT License

## 🏗️ Architecture Highlights

### Backend (MVC Pattern)
- **907 dòng → 75 dòng** trong `index.js` sau refactoring
- Tách rõ ràng: Config, Models, Controllers, Routes, Services, Middleware
- Database query optimization: Index-based filtering, range queries
- Smart duplicate prevention: Timestamp rounding to seconds
- Auto cleanup: Data retention policy (30 days)

### Frontend (Layered Architecture)
- **Centralized constants**: All magic numbers in `config/constants.js`
- **Reusable utilities**: Chart helpers, formatters
- **Performance**: React.memo, useCallback hooks
- **Persistent state**: localStorage for device states
- **Responsive UI**: Optimized table layouts with scrolling

## 🔍 Smart Search Features

### Sensor Data
- `22:47` → Tìm tất cả data trong phút 22:47 (22:47:00 - 22:47:59)
- `22:47:30` → Tìm data trong giây cụ thể
- `23:38 9/10/2025` → Tìm theo full datetime
- `28` → Tìm nhiệt độ 28.0-28.9°C VÀ độ ẩm 28.0-28.9%
- `500` → Tìm ánh sáng 500-599 nits

### Action History
- Tương tự sensor data
- Thêm text search: device name, action type

## 🙏 Acknowledgments
- MQTT.js - MQTT client for Node.js & Browser
- Recharts - Composable charting library
- React Icons - Popular icon packs
- PostgreSQL - Advanced open source database