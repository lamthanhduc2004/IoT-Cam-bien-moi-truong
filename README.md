# 🌡️ IoT Environmental Monitoring System

## 📝 Mô tả
Hệ thống giám sát môi trường IoT sử dụng ESP32 và cảm biến DHT22, LDR để đo nhiệt độ, độ ẩm, và ánh sáng. Dữ liệu được truyền qua MQTT và hiển thị trên dashboard web.

## 🛠️ Công nghệ sử dụng

### Hardware
- **ESP32** - Vi điều khiển chính
- **DHT22** - Cảm biến nhiệt độ và độ ẩm
- **MH-Sensor Flying-Fish (LDR)** - Cảm biến ánh sáng
- **LED & AC Control** - Điều khiển thiết bị

### Software
- **Frontend**: React.js + Vite
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **MQTT Broker**: Mosquitto
- **Charting**: Recharts

## 📁 Cấu trúc dự án
```
IoT-Cam-bien-moi-truong/
├── iot-dashboard/          # React Frontend
│   ├── src/
│   │   ├── pages/          # Dashboard, Data_Sensor, ActionHistory, Profile
│   │   ├── services/       # API & MQTT services
│   │   └── App.jsx
│   └── package.json
├── server/                 # Node.js Backend
│   ├── index.js            # Main server file
│   ├── db-schema.sql       # Database schema
│   └── package.json
├── test.ino                # ESP32 Arduino code
├── broker.conf             # Mosquitto MQTT config
└── start-all.bat           # Khởi động tất cả services
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
mosquitto -c broker.conf -v

# Terminal 2: Backend
cd server
npm run dev

# Terminal 3: Frontend
cd iot-dashboard
npm run dev

# Terminal 4: Upload code lên ESP32
arduino-cli upload -p COM3 test.ino
```

## 📊 Tính năng

### Dashboard (Home)
- ✅ Hiển thị realtime: Nhiệt độ, Độ ẩm, Ánh sáng
- ✅ Điều khiển: LED, Quạt, Điều hòa
- ✅ Biểu đồ 24h với sampling 30 phút
- ✅ Cảnh báo ngưỡng (warning/danger animation)

### Data_Sensor
- ✅ Bảng dữ liệu với pagination (5/10/15/20 rows)
- ✅ Tìm kiếm theo mọi trường
- ✅ Sắp xếp theo cột (backend sorting)
- ✅ Click to copy timestamp
- ✅ Filter theo sensor type

### Action History
- ✅ Lịch sử điều khiển thiết bị
- ✅ Hiển thị realtime updates

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

## 🙏 Acknowledgments
- MQTT.js
- Recharts
- React Icons
- PostgreSQL