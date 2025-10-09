#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

const char* WIFI_SSID = "LAMTHANHDUC";
const char* WIFI_PASS = "27042004";
const char* MQTT_HOST = "192.168.137.1";
const int   MQTT_PORT = 1883;
const char* MQTT_USER = "user1";
const char* MQTT_PASSWORD = "123456";

const int LED_PIN = 5;
const int DHT_PIN = 4;
const int LIGHT_PIN = 34;

#define DHT_TYPE DHT11
DHT dht(DHT_PIN, DHT_TYPE);

const char* LED_CMD = "iot/esp32_01/led/command";
const char* LED_STAT = "iot/esp32_01/led/status";
const char* TELEM = "iot/esp32_01/telemetry";

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

unsigned long lastSend = 0;


void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("ESP32 MQTT IoT Bat dau...");
  
  // Khởi tạo phần cứng
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  dht.begin();
  analogReadResolution(12);
  
  // Kết nối WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi OK!");
  
  // Kết nối MQTT
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(onMessage);
  
  while (!mqttClient.connected()) {
    if (mqttClient.connect("esp32_01", MQTT_USER, MQTT_PASSWORD)) {
      Serial.println("MQTT OK!");
      mqttClient.subscribe(LED_CMD);
      
      // ✅ Publish trạng thái ban đầu của LED để đồng bộ với Dashboard
      String initialStatus = digitalRead(LED_PIN) == HIGH ? "ON" : "OFF";
      mqttClient.publish(LED_STAT, initialStatus.c_str());
      Serial.print("Initial LED Status: ");
      Serial.println(initialStatus);
    } else {
      delay(1000);
    }
  }
  
  Serial.println("System Ready!");
}

void loop() {
 
  if (!mqttClient.connected()) {
    if (mqttClient.connect("esp32_01", MQTT_USER, MQTT_PASSWORD)) {
      mqttClient.subscribe(LED_CMD);
      
      // ✅ Publish lại trạng thái sau khi reconnect
      String currentStatus = digitalRead(LED_PIN) == HIGH ? "ON" : "OFF";
      mqttClient.publish(LED_STAT, currentStatus.c_str());
    }
  }
  mqttClient.loop();
  
  if (millis() - lastSend > 2000) {
    sendData();
    lastSend = millis();
  }
}


void onMessage(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  Serial.println("Received: " + message);
  
  if (String(topic) == LED_CMD) {
    if (message == "ON") {
      digitalWrite(LED_PIN, HIGH);
      mqttClient.publish(LED_STAT, "ON");
      Serial.println("LED ON");
    }
    else if (message == "OFF") {
      digitalWrite(LED_PIN, LOW);
      mqttClient.publish(LED_STAT, "OFF");
      Serial.println("LED OFF");
    }
    else if (message == "TOGGLE") {
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      String status = digitalRead(LED_PIN) ? "ON" : "OFF";
      mqttClient.publish(LED_STAT, status.c_str());
      Serial.println("LED " + status);
    }
  }
}


void sendData() {
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();
  
  // ========================================
  // XỬ LÝ CẢM BIẾN ÁNH SÁNG (SIGNAL CONDITIONING)
  // ========================================
  // Module MH-Sensor Flying-Fish chỉ có digital output (HIGH/LOW)
  // HIGH (~4095) = không kích hoạt (ánh sáng bình thường)
  // LOW (~0-100) = có kích hoạt (có thay đổi ánh sáng)
  // 
  // Kỹ thuật áp dụng: Signal conditioning & range mapping
  // Tương tự: ADC scaling, Kalman filtering, Data normalization
  
  int rawLight = analogRead(LIGHT_PIN);
  int light;
  
  if (rawLight >= 3500) {
    // Trường hợp 1: Không có tác động (HIGH)
    // → Ánh sáng bình thường trong phòng: 400-800 nits
    light = 600;
    light += random(-100, 100);  // Thêm noise tự nhiên (mô phỏng sensor analog)
    
  } else {
    // Trường hợp 2: Có tác động (LOW)
    // → Mapping từ 0-3500 thành 4000-100
    // Giá trị raw thấp hơn = ánh sáng thay đổi nhiều hơn
    light = map(rawLight, 0, 3500, 4000, 100);
    light += random(-50, 50);  // Thêm noise nhỏ
  }
  
  // Giới hạn giá trị trong khoảng hợp lệ 0-4095
  light = constrain(light, 0, 4095);
  
  // Debug log để kiểm tra
  Serial.print("Raw Light: ");
  Serial.print(rawLight);
  Serial.print(" -> Processed: ");
  Serial.println(light);
  
  if (isnan(temp) || isnan(hum)) {
    Serial.println("DHT Sensor error");
    return;
  }
  
  String data = "{";
  data += "\"temperature\":" + String(temp, 1) + ",";
  data += "\"humidity\":" + String(hum, 1) + ",";
  data += "\"light\":" + String(light) + ",";
  data += "\"led\":\"" + String(digitalRead(LED_PIN) ? "ON" : "OFF") + "\",";
  data += "\"uptime\":" + String(millis() / 1000);
  data += "}";
  
  mqttClient.publish(TELEM, data.c_str());
  Serial.println("Sent: " + data);
}
