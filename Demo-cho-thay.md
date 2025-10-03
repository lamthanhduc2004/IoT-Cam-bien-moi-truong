# 📊 HƯỚNG DẪN DEMO CHO THẦY

## 🎯 MỤC ĐÍCH
Show cho thầy hệ thống IoT hoàn chỉnh với:
1. **ESP32** đọc sensors và gửi dữ liệu qua MQTT
2. **Backend** nhận dữ liệu, lưu database, cung cấp REST API
3. **Frontend** hiển thị realtime và điều khiển thiết bị
4. **Postman** test API endpoints

---

## 📋 CHECKLIST TRƯỚC KHI DEMO

### ✅ 1. MQTT Broker (Mosquitto)
```bash
# Kiểm tra mosquitto đang chạy
mosquitto -c mosquitto.conf -v

# Hoặc dùng public broker test:
# broker.hivemq.com:1883 (không cần auth)
```

### ✅ 2. PostgreSQL Database
```bash
# Chạy PostgreSQL (Docker)
docker run -d --name iotdb \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=iotdb \
  -p 5432:5432 \
  postgres:16

# Tạo schema
cd server
psql "postgres://postgres:postgres@localhost:5432/iotdb" -f db-schema.sql
```

### ✅ 3. Backend Server
```bash
cd server
npm install
npm run dev

# Kiểm tra log:
# ✅ PostgreSQL connected
# ✅ MQTT connected to broker
# 🚀 IoT Server running on http://localhost:3000
```

### ✅ 4. ESP32
```arduino
// Upload code test.ino lên ESP32
// Kiểm tra Serial Monitor:
// WiFi OK!
// MQTT OK!
// System Ready!
// Sent: {"temperature":28.5,"humidity":65.2,...}
```

### ✅ 5. Frontend
```bash
cd iot-dashboard
npm run dev

# Mở http://localhost:5173
```

---

## 🎬 KỊCH BẢN DEMO (10-15 phút)

### **PHẦN 1: GIỚI THIỆU HỆ THỐNG (2 phút)**

**Nói với thầy:**
> "Em xin trình bày dự án IoT với ESP32. Hệ thống gồm 4 thành phần chính:
> 1. ESP32 với cảm biến DHT11 (nhiệt độ/độ ẩm) và LDR (ánh sáng)
> 2. MQTT Broker để truyền dữ liệu realtime
> 3. Backend Server Node.js lưu dữ liệu vào PostgreSQL và cung cấp REST API
> 4. Frontend React hiển thị dashboard và điều khiển thiết bị"

**Show sơ đồ kiến trúc (vẽ trên bảng/slide):**
```
[ESP32] --MQTT--> [Broker] --MQTT--> [Backend] ---> [PostgreSQL]
                     ↓                    ↓
                [Frontend]           [REST API]
```

---

### **PHẦN 2: DEMO ESP32 & MQTT (3 phút)**

#### 2.1. Show Serial Monitor
```
Sent: {"temperature":28.5,"humidity":65.2,"light":2048,"led":"OFF","uptime":123}
```

**Nói:**
> "ESP32 đọc sensors mỗi 2 giây và gửi dữ liệu lên MQTT broker qua topic `iot/esp32_01/telemetry`"

#### 2.2. Show MQTT Messages (dùng MQTT Explorer hoặc mosquitto_sub)
```bash
mosquitto_sub -h 192.168.137.1 -p 1883 -u user1 -P 123456 -t 'iot/#' -v
```

**Show log realtime:**
```
iot/esp32_01/telemetry {"temperature":28.5,...}
iot/esp32_01/led/status ON
```

---

### **PHẦN 3: DEMO BACKEND SERVER (4 phút)**

#### 3.1. Show Terminal Backend
```
✅ PostgreSQL connected
✅ MQTT connected to broker
📥 [iot/esp32_01/telemetry] {"temperature":28.5,...}
🚀 IoT Server running on http://localhost:3000
```

**Nói:**
> "Backend nhận dữ liệu từ MQTT, lưu vào PostgreSQL, và cung cấp REST API"

#### 3.2. **MỞ POSTMAN - PHẦN QUAN TRỌNG NHẤT!**

**Test các API theo thứ tự:**

**✅ API 1: Health Check**
```
GET http://localhost:3000/api/health
```
Response:
```json
{
  "status": "ok",
  "mqtt": "connected",
  "timestamp": "2025-10-02T..."
}
```
**Nói:** "Kiểm tra server và MQTT đang hoạt động"

---

**✅ API 2: Get Latest Data**
```
GET http://localhost:3000/api/devices/esp32_01/last
```
Response:
```json
{
  "id": 123,
  "ts": "2025-10-02T10:30:45.123Z",
  "device_id": "esp32_01",
  "temperature": 28.5,
  "humidity": 65.2,
  "light": 2048,
  "led": "OFF",
  "uptime": 123
}
```
**Nói:** "Lấy dữ liệu sensors mới nhất từ database"

---

**✅ API 3: Get Time Series (cho biểu đồ)**
```
GET http://localhost:3000/api/devices/esp32_01/series?from=1 hour&limit=500
```
Response:
```json
[
  {"ts": "2025-10-02T09:30:00Z", "temperature": 27.8, "humidity": 64.5, ...},
  {"ts": "2025-10-02T09:30:02Z", "temperature": 27.9, "humidity": 64.6, ...},
  ...
]
```
**Nói:** "Lấy dữ liệu lịch sử để vẽ biểu đồ trên frontend"

---

**✅ API 4: Control LED - Turn ON**
```
POST http://localhost:3000/api/devices/esp32_01/cmd/led
Content-Type: application/json

{
  "value": "ON"
}
```
Response:
```json
{
  "ok": true,
  "device": "esp32_01",
  "target": "led",
  "value": "ON",
  "timestamp": "2025-10-02T10:31:00Z"
}
```
**Nói:** "Gửi lệnh bật LED qua API, backend sẽ publish MQTT message tới ESP32"

**🎯 QUAN TRỌNG: Ngay sau khi gửi, show:**
1. **LED trên ESP32 sáng** (show phần cứng)
2. **Serial Monitor hiện:** `Received: ON` → `LED ON`
3. **MQTT log hiện:** `iot/esp32_01/led/status ON`

---

**✅ API 5: Get Control Logs**
```
GET http://localhost:3000/api/devices/esp32_01/controls
```
Response:
```json
[
  {"id": 1, "ts": "2025-10-02T10:31:00Z", "device_id": "esp32_01", "target": "led", "ack": {"status": "ON", ...}},
  ...
]
```
**Nói:** "Lịch sử tất cả lệnh điều khiển đã được lưu trong database"

---

### **PHẦN 4: DEMO FRONTEND (4 phút)**

#### 4.1. Trang HOME
- Show biểu đồ Temperature, Humidity, Light đang update realtime
- Show phần Devices với toggle LED
- **Click toggle LED** → LED trên ESP32 sáng/tắt ngay lập tức
- **Nói:** "Frontend kết nối MQTT WebSocket để nhận dữ liệu realtime và điều khiển thiết bị"

#### 4.2. Trang Data_Sensor
- Show bảng dữ liệu với pagination
- **Nói:** "Dữ liệu từ database, có thể xem lịch sử và tìm kiếm"

#### 4.3. Trang Action History
- Show lịch sử điều khiển LED
- **Nói:** "Lưu lại tất cả hành động điều khiển thiết bị"

#### 4.4. Trang Profile
- Show thông tin sinh viên

---

### **PHẦN 5: ƯU ĐIỂM & KẾT LUẬN (2 phút)**

**Tổng kết:**
> "Em đã hoàn thành hệ thống IoT với các tính năng:
> 
> ✅ **Hardware:** ESP32 đọc sensors realtime (2s/lần)
> ✅ **Communication:** MQTT với QoS 1, reconnect tự động
> ✅ **Storage:** PostgreSQL lưu trữ lịch sử dữ liệu
> ✅ **Backend:** REST API đầy đủ CRUD operations
> ✅ **Frontend:** Dashboard realtime với biểu đồ và điều khiển
> ✅ **Testing:** Postman collection để test tất cả API
> 
> Hệ thống có thể mở rộng cho nhiều thiết bị, thêm sensors, và deploy lên cloud."

---

## 📌 TIPS QUAN TRỌNG

### 1. **Postman là KEY!**
Thầy muốn thấy:
- ✅ API hoạt động (GET data từ DB)
- ✅ Control qua API (POST command)
- ✅ Response đúng format JSON
- ✅ Database có lưu dữ liệu

### 2. **Luồng Demo Hoàn Chỉnh:**
```
ESP32 → MQTT → Backend → PostgreSQL → API → Postman
  ↓                                           ↓
Serial Monitor                         Show Response
```

### 3. **Chuẩn bị sẵn:**
- MQTT broker chạy ổn định
- Database có sẵn data (chạy ESP32 trước 5-10 phút)
- Postman collection đã import và test thử
- Frontend đang chạy sẵn

### 4. **Nếu bị hỏi:**
- **"Tại sao dùng MQTT?"** → Realtime, lightweight, QoS levels
- **"Tại sao cần Backend?"** → Lưu lịch sử, REST API, rule engine
- **"Security?"** → MQTT có auth (user/pass), có thể thêm TLS
- **"Scalability?"** → Dễ thêm devices, chỉ cần subscribe thêm topics

---

## 🚀 CHECKLIST NGÀY DEMO

- [ ] MQTT broker chạy
- [ ] PostgreSQL chạy + có data
- [ ] Backend server chạy
- [ ] ESP32 online, gửi data
- [ ] Frontend chạy
- [ ] Postman đã import collection
- [ ] Test thử 1 lần toàn bộ flow
- [ ] Chuẩn bị backup plan (nếu MQTT lỗi → dùng mock data)

---

**CHÚC BẠN DEMO THÀNH CÔNG! 🎉**

