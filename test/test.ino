#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

// ==================== WIFI & MQTT CONFIG ====================
const char* WIFI_SSID = "LAMTHANHDUC";
const char* WIFI_PASS = "27042004";
const char* MQTT_HOST = "172.11.247.231";
const int   MQTT_PORT = 1883;
const char* MQTT_USER = "user1";
const char* MQTT_PASSWORD = "123456";

// ==================== HARDWARE PINS ====================
const int LED_PIN = 5;      // LED (Lights)
const int FAN_PIN = 18;     // LED (FAN) - MỚI THÊM
const int AC_PIN = 19;      // LED (AC) - MỚI THÊM
const int DHT_PIN = 4;      // DHT11 Sensor
const int LIGHT_PIN = 34;   // Light Sensor (ADC)

// ==================== LED CẢNH BÁO (BÀI 4) ====================
const int LED_RAIN_ALERT = 21;  // LED cảnh báo mưa (>= 50mm)
const int LED_WIND_ALERT = 22;  // LED cảnh báo gió (>= 25 m/s)

// ==================== FEATURE FLAGS ====================
// Chỉ bật cho thiết bị có phần cứng thật
const bool ENABLE_LED = true;   // 
const bool ENABLE_FAN = true;   // 
const bool ENABLE_AC = true;    //

#define DHT_TYPE DHT11
DHT dht(DHT_PIN, DHT_TYPE);

// ==================== MQTT TOPICS ====================
// LED (Lights)
const char* LED_CMD = "iot/esp32_01/led/command";
const char* LED_STAT = "iot/esp32_01/led/status";

// FAN
const char* FAN_CMD = "iot/esp32_01/fan/command";
const char* FAN_STAT = "iot/esp32_01/fan/status";

// AC
const char* AC_CMD = "iot/esp32_01/ac/command";
const char* AC_STAT = "iot/esp32_01/ac/status";

// Telemetry
const char* TELEM = "iot/esp32_01/telemetry";

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

unsigned long lastSend = 0;

// ==================== SETUP ====================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("ESP32 MQTT IoT - FAN & AC Version");
  
  // Khởi tạo phần cứng
  if (ENABLE_LED) {
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);
  }
  if (ENABLE_FAN) {
    pinMode(FAN_PIN, OUTPUT);
    digitalWrite(FAN_PIN, LOW);
  }
  if (ENABLE_AC) {
    pinMode(AC_PIN, OUTPUT);
    digitalWrite(AC_PIN, LOW);
  }
  
  // Khởi tạo LED cảnh báo (BÀI 4)
  pinMode(LED_RAIN_ALERT, OUTPUT);
  pinMode(LED_WIND_ALERT, OUTPUT);
  digitalWrite(LED_RAIN_ALERT, LOW);
  digitalWrite(LED_WIND_ALERT, LOW);
  
  dht.begin();
  analogReadResolution(12);
  analogSetPinAttenuation(LIGHT_PIN, ADC_11db);
  
  Serial.println("✅ Hardware initialized:");
  if (ENABLE_LED) Serial.println("   LED (Lights): GPIO 5 - ENABLED");
  if (ENABLE_FAN) Serial.println("   FAN: GPIO 18 - ENABLED");
  else Serial.println("   FAN: GPIO 18 - DISABLED (no hardware)");
  if (ENABLE_AC) Serial.println("   AC: GPIO 19 - ENABLED");
  else Serial.println("   AC: GPIO 19 - DISABLED (no hardware)");
  
  // Kết nối WiFi
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi Connected!");
  Serial.print("   ESP32 IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("   Gateway: ");
  Serial.println(WiFi.gatewayIP());
  
  // Kết nối MQTT
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(onMessage);
  
  connectMQTT();
  
  Serial.println("✅ System Ready!");
}

// ==================== LOOP ====================
void loop() {
  // Auto-reconnect MQTT nếu mất kết nối
  if (!mqttClient.connected()) {
    connectMQTT();
  }
  mqttClient.loop();
  
  // Gửi telemetry mỗi 2 giây
  if (millis() - lastSend > 2000) {
    sendData();
    lastSend = millis();
  }
}

// ==================== CONNECT MQTT ====================
void connectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT broker at ");
    Serial.print(MQTT_HOST);
    Serial.print(":");
    Serial.print(MQTT_PORT);
    Serial.println("...");
    
    if (mqttClient.connect("esp32_01", MQTT_USER, MQTT_PASSWORD)) {
      Serial.println("✅ MQTT Connected!");
      
      // Subscribe topics (chỉ cho thiết bị enabled)
      if (ENABLE_LED) mqttClient.subscribe(LED_CMD);
      if (ENABLE_FAN) mqttClient.subscribe(FAN_CMD);
      if (ENABLE_AC) mqttClient.subscribe(AC_CMD);
      Serial.println("✅ Subscribed to enabled command topics");
      
      // Publish trạng thái ban đầu
      publishAllStatus();
      
    } else {
      Serial.print("❌ MQTT Connection FAILED! State: ");
      Serial.println(mqttClient.state());
      Serial.println("   Error codes: -4=timeout, -3=lost, -2=failed, -1=disconnected");
      delay(2000);
    }
  }
}

// ==================== PUBLISH ALL STATUS ====================
void publishAllStatus() {
  Serial.println("📤 Publishing initial status:");
  
  if (ENABLE_LED) {
    String ledStatus = digitalRead(LED_PIN) == HIGH ? "ON" : "OFF";
    mqttClient.publish(LED_STAT, ledStatus.c_str(), true); // 
    Serial.println("   LED: " + ledStatus);
  }
  
  if (ENABLE_FAN) {
    String fanStatus = digitalRead(FAN_PIN) == HIGH ? "ON" : "OFF";
    mqttClient.publish(FAN_STAT, fanStatus.c_str(), true); // 
    Serial.println("   FAN: " + fanStatus);
  }
  
  if (ENABLE_AC) {
    String acStatus = digitalRead(AC_PIN) == HIGH ? "ON" : "OFF";
    mqttClient.publish(AC_STAT, acStatus.c_str(), true); // 
    Serial.println("   AC: " + acStatus);
  }
}

// ==================== HANDLE MQTT MESSAGES ====================
void onMessage(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  Serial.print("📥 Received [");
  Serial.print(topic);
  Serial.print("]: ");
  Serial.println(message);
  
  // ===== LED (LIGHTS) =====
  if (ENABLE_LED && String(topic) == LED_CMD) {
    if (message == "ON") {
      digitalWrite(LED_PIN, HIGH);
      mqttClient.publish(LED_STAT, "ON", true); // retain=true
      Serial.println("💡 LED ON");
    }
    else if (message == "OFF") {
      digitalWrite(LED_PIN, LOW);
      mqttClient.publish(LED_STAT, "OFF", true); // retain=true
      Serial.println("💡 LED OFF");
    }
    else if (message == "TOGGLE") {
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      String status = digitalRead(LED_PIN) ? "ON" : "OFF";
      mqttClient.publish(LED_STAT, status.c_str(), true); // retain=true
      Serial.println("💡 LED " + status);
    }
  }
  
  // ===== FAN =====
  else if (ENABLE_FAN && String(topic) == FAN_CMD) {
    if (message == "ON") {
      digitalWrite(FAN_PIN, HIGH);
      mqttClient.publish(FAN_STAT, "ON", true); // retain=true
      Serial.println("🌀 FAN ON");
    }
    else if (message == "OFF") {
      digitalWrite(FAN_PIN, LOW);
      mqttClient.publish(FAN_STAT, "OFF", true); // retain=true
      Serial.println("🌀 FAN OFF");
    }
    else if (message == "TOGGLE") {
      digitalWrite(FAN_PIN, !digitalRead(FAN_PIN));
      String status = digitalRead(FAN_PIN) ? "ON" : "OFF";
      mqttClient.publish(FAN_STAT, status.c_str(), true); // retain=true
      Serial.println("🌀 FAN " + status);
    }
  }
  
  // ===== AC =====
  else if (ENABLE_AC && String(topic) == AC_CMD) {
    if (message == "ON") {
      digitalWrite(AC_PIN, HIGH);
      mqttClient.publish(AC_STAT, "ON", true); // retain=true
      Serial.println("❄️  AC ON");
    }
    else if (message == "OFF") {
      digitalWrite(AC_PIN, LOW);
      mqttClient.publish(AC_STAT, "OFF", true); // retain=true
      Serial.println("❄️  AC OFF");
    }
    else if (message == "TOGGLE") {
      digitalWrite(AC_PIN, !digitalRead(AC_PIN));
      String status = digitalRead(AC_PIN) ? "ON" : "OFF";
      mqttClient.publish(AC_STAT, status.c_str(), true); // retain=true
      Serial.println("❄️  AC " + status);
    }
  }
}

// ==================== LIGHT SENSOR HELPERS ====================
// Đọc trung bình nhiều mẫu để giảm nhiễu
int readLightRawAvg(int samples = 16) {
  long sum = 0;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(LIGHT_PIN);
    delayMicroseconds(500);
  }
  return (int)(sum / samples);
}

// Hiệu chuẩn nhanh 2 điểm: che kín và ánh sáng phòng
// Mục tiêu: ánh sáng phòng ~600, che kín ~vài chục
int readLightScaled() {
  const int RAW_DARK   = 100;   // cập nhật theo raw khi che kín
  const int RAW_BRIGHT = 2000;  // cập nhật theo raw ánh sáng phòng
  const int THRESH = (RAW_DARK + RAW_BRIGHT) / 2; // ngưỡng phân biệt tối/sáng
  
  int raw = readLightRawAvg(16);
  
  // Nếu tối (che) -> 30..50, nếu sáng thường -> 600..700
  if (raw <= THRESH) {
    return random(30, 51);
  } else {
    return random(600, 701);
  }
}

// ==================== BÀI 4: CẢM BIẾN MỚI ====================
// Đọc lượng mưa (mm) - giá trị random 0-100
float readRainfall() {
  return random(0, 101) + (random(0, 100) / 100.0); // 0.00 - 100.99 mm
}

// Đọc tốc độ gió (m/s) - giá trị random 0-50
float readWindSpeed() {
  return random(0, 51) + (random(0, 100) / 100.0); // 0.00 - 50.99 m/s
}

// ==================== SEND TELEMETRY ====================
void sendData() {
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();

  int light = readLightScaled();
  
  // BÀI 4: Đọc 2 cảm biến mới
  float rainfall = readRainfall();
  float windSpeed = readWindSpeed();
  
  if (isnan(temp) || isnan(hum)) {
    Serial.println("❌ DHT Sensor error");
    return;
  }
  
  // BÀI 4: Kiểm tra ngưỡng 50% và điều khiển LED cảnh báo
  // Lượng mưa >= 50mm (50% của 100mm)
  if (rainfall >= 50.0) {
    digitalWrite(LED_RAIN_ALERT, HIGH);
  } else {
    digitalWrite(LED_RAIN_ALERT, LOW);
  }
  
  // Tốc độ gió >= 25 m/s (50% của 50 m/s)
  if (windSpeed >= 25.0) {
    digitalWrite(LED_WIND_ALERT, HIGH);
  } else {
    digitalWrite(LED_WIND_ALERT, LOW);
  }
  
  // Build JSON với trạng thái thiết bị đã enabled
  String data = "{";
  data += "\"temperature\":" + String(temp, 1) + ",";
  data += "\"humidity\":" + String(hum, 1) + ",";
  data += "\"light\":" + String(light) + ",";
  
  // BÀI 4: Thêm cảm biến mới vào telemetry
  data += "\"rainfall\":" + String(rainfall, 2) + ",";
  data += "\"wind_speed\":" + String(windSpeed, 2);
  
  if (ENABLE_LED) {
    data += ",\"led\":\"" + String(digitalRead(LED_PIN) ? "ON" : "OFF") + "\"";
  }
  if (ENABLE_FAN) {
    data += ",\"fan\":\"" + String(digitalRead(FAN_PIN) ? "ON" : "OFF") + "\"";
  }
  if (ENABLE_AC) {
    data += ",\"ac\":\"" + String(digitalRead(AC_PIN) ? "ON" : "OFF") + "\"";
  }
  
  data += ",\"uptime\":" + String(millis() / 1000);
  data += "}";
  
  mqttClient.publish(TELEM, data.c_str());
  Serial.println("📤 Telemetry: " + data);
}

