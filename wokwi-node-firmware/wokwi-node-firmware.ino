#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <LiquidCrystal_I2C.h>

// CHANGE THESE TWO PER NODE
const char *NODE_ID = "A"; // "A" on one project, "B" on the other
const char *SERVER_URL = "https://random-words-here.trycloudflare.com/api/update";

const char *WIFI_SSID = "Wokwi-GUEST";
const char *WIFI_PASSWORD = "";
const int WIFI_CHANNEL = 6;

const int PIN_SOLAR_POT = 34;
const int PIN_LOAD_POT = 35;
const int PIN_LED_SURPLUS = 2;
const int PIN_LED_DEFICIT = 15;
const int PIN_LED_IDLE = 13;

const unsigned long REPORT_INTERVAL_MS = 3000;
const float ADC_MAX = 4095.0;
const float MAX_SOLAR_KW = 4.0; // typical residential rooftop panel peak
const float MAX_LOAD_KW = 3.0;  // typical household peak draw
const float BALANCE_DEADBAND_KW = 0.05;

LiquidCrystal_I2C lcd(0x27, 16, 2);
unsigned long lastReportTime = 0;

void setup()
{
  Serial.begin(115200);
  pinMode(PIN_LED_SURPLUS, OUTPUT);
  pinMode(PIN_LED_DEFICIT, OUTPUT);
  pinMode(PIN_LED_IDLE, OUTPUT);

  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Node ");
  lcd.print(NODE_ID);
  lcd.setCursor(0, 1);
  lcd.print("Connecting WiFi");

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD, WIFI_CHANNEL);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(200);
    Serial.print(".");
  }
  Serial.println(" connected!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  lcd.setCursor(0, 1);
  lcd.print("WiFi OK          ");
  delay(800);
}

void loop()
{
  float solarKw = (analogRead(PIN_SOLAR_POT) / ADC_MAX) * MAX_SOLAR_KW;
  float loadKw = (analogRead(PIN_LOAD_POT) / ADC_MAX) * MAX_LOAD_KW;
  float netKw = solarKw - loadKw;

  String state = classifyState(netKw);
  updateLeds(state);
  updateLcd(solarKw, loadKw, netKw, state);

  if (millis() - lastReportTime >= REPORT_INTERVAL_MS)
  {
    float kwhDelta = netKw * (REPORT_INTERVAL_MS / 3600000.0);
    sendUpdate(state, solarKw, loadKw, netKw, kwhDelta);
    lastReportTime = millis();
  }

  delay(100);
}

String classifyState(float netKw)
{
  if (netKw > BALANCE_DEADBAND_KW)
    return "surplus";
  if (netKw < -BALANCE_DEADBAND_KW)
    return "deficit";
  return "idle";
}

void updateLeds(String state)
{
  digitalWrite(PIN_LED_SURPLUS, state == "surplus" ? HIGH : LOW);
  digitalWrite(PIN_LED_DEFICIT, state == "deficit" ? HIGH : LOW);
  digitalWrite(PIN_LED_IDLE, state == "idle" ? HIGH : LOW);
}

void updateLcd(float solarKw, float loadKw, float netKw, String state)
{
  char line1[17];
  char line2[17];
  char solarStr[6], loadStr[6], netStr[7];

  dtostrf(solarKw, 4, 1, solarStr);
  dtostrf(loadKw, 4, 1, loadStr);
  dtostrf(netKw, 5, 2, netStr);

  snprintf(line1, sizeof(line1), "So:%sk Ld:%sk", solarStr, loadStr);

  String label = state;
  label.toUpperCase();
  snprintf(line2, sizeof(line2), "%-8s%7skW", label.c_str(), netStr);

  lcd.setCursor(0, 0);
  lcd.print(line1);
  lcd.setCursor(0, 1);
  lcd.print(line2);
}

void sendUpdate(String state, float solarKw, float loadKw, float netKw, float kwhDelta)
{
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("WiFi not connected, skipping update");
    return;
  }

  HTTPClient http;
  WiFiClientSecure secureClient;
  WiFiClient plainClient;
  bool isHttps = String(SERVER_URL).startsWith("https");

  if (isHttps)
  {
    secureClient.setInsecure();
    http.begin(secureClient, SERVER_URL);
  }
  else
  {
    http.begin(plainClient, SERVER_URL);
  }
  http.setTimeout(20000);
  http.addHeader("Content-Type", "application/json");

  String body = "{\"node\":\"" + String(NODE_ID) +
                "\",\"state\":\"" + state +
                "\",\"solar_kw\":" + String(solarKw, 3) +
                ",\"load_kw\":" + String(loadKw, 3) +
                ",\"net_kw\":" + String(netKw, 3) +
                ",\"kwh_delta\":" + String(kwhDelta, 5) + "}";

  int httpCode = http.POST(body);
  Serial.print("POST -> ");
  Serial.print(httpCode);
  Serial.print(" | ");
  Serial.println(body);
  http.end();
}