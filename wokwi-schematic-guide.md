# Wokwi Build Guide: Solar Micro-Grid P2P Settlement (FINAL)

Wokwi's ESP32 has real simulated WiFi with real internet access. That means
no serial port juggling, no COM ports, no bridge script watching a port.
Each ESP32 just POSTs its readings straight to your server over HTTP.

## Why two separate Wokwi projects, not one

Each node (House A, House B) is logically a separate physical device running
its own copy of the same firmware, differing only in one line (`NODE_ID`).
The most reliable way to do this in Wokwi is **two separate projects** (two
browser tabs) — rather than trying to run two independently-programmed
ESP32s inside one Wokwi project, which is not something I can guarantee
works cleanly across Wokwi's project format. Simplest and safest: build one
project fully, then use Wokwi's "Fork" / duplicate-project feature to make
a second copy, and change `NODE_ID` from `"A"` to `"B"` in the copy.

## Parts needed (per project/node)

| Part | Wokwi type | Notes |
|---|---|---|
| ESP32 board | `board-esp32-devkit-c-v4` | The standard ESP32 DevKit — this is what "New ESP32 Project" gives you by default |
| LCD display | `wokwi-lcd1602` with `"pins": "i2c"` | Shows live solar/load/state readout on the device itself |
| Solar potentiometer | `wokwi-potentiometer` | Simulates solar panel output |
| Load potentiometer | `wokwi-potentiometer` | Simulates household consumption |
| Surplus LED | `wokwi-led` (green) | Lit when this node is selling |
| Deficit LED | `wokwi-led` (yellow) | Lit when this node is buying |
| Idle LED | `wokwi-led` (red/gray) | Lit when neither |

Note: there's no role switch in this version — each node decides SURPLUS vs
DEFICIT purely from whether its own solar output currently exceeds its own
load. That's more realistic anyway: a real house doesn't need a person to
flip a switch telling it whether it has spare power.

## Full pin table (identical for both projects)

| Signal | ESP32 pin | Connects to |
|---|---|---|
| Solar potentiometer | `GPIO34` | Potentiometer's `SIG` pin |
| Load potentiometer | `GPIO35` | Potentiometer's `SIG` pin |
| Surplus LED (green) | `GPIO2` | LED anode (`A`) — cathode (`C`) to GND |
| Deficit LED (yellow) | `GPIO15` | LED anode (`A`) — cathode (`C`) to GND |
| Idle LED (gray/red) | `GPIO13` | LED anode (`A`) — cathode (`C`) to GND |
| LCD data | `GPIO21` | LCD `SDA` |
| LCD clock | `GPIO22` | LCD `SCL` |
| LCD power | `5V` (or `3V3`) | LCD `VCC` |
| LCD ground | `GND` | LCD `GND` |
| Potentiometer power (both) | `3V3` | Each potentiometer's `VCC` |
| Potentiometer ground (both) | `GND` | Each potentiometer's `GND` |

## Ready-to-paste diagram.json

Click the `diagram.json` tab in Wokwi and replace its contents with this,
then wire the two LEDs' cathodes and the potentiometers' GND/VCC using the
visual editor if this doesn't place them exactly how you like — the
important electrical connections (signal pins) are all here:

```json
{
  "version": 1,
  "author": "Ajaj Mahmud Aquil",
  "editor": "wokwi",
  "parts": [
    { "type": "board-esp32-devkit-c-v4", "id": "esp", "top": 0, "left": 0, "attrs": {} },
    {
      "type": "wokwi-led",
      "id": "led1",
      "top": 92.4,
      "left": 186.6,
      "attrs": { "color": "green", "flip": "1" }
    },
    {
      "type": "wokwi-lcd1602",
      "id": "lcd1",
      "top": -12.8,
      "left": 264.8,
      "attrs": { "pins": "i2c" }
    },
    { "type": "wokwi-potentiometer", "id": "pot1", "top": -164.5, "left": 201.4, "attrs": {} },
    {
      "type": "wokwi-text",
      "id": "text1",
      "top": -192,
      "left": 192,
      "attrs": { "text": "Solar\n\n" }
    },
    {
      "type": "wokwi-led",
      "id": "led2",
      "top": 140.4,
      "left": 186.6,
      "attrs": { "color": "yellow", "flip": "1" }
    },
    {
      "type": "wokwi-led",
      "id": "led3",
      "top": 188.4,
      "left": 186.6,
      "attrs": { "color": "red", "flip": "1" }
    },
    { "type": "wokwi-potentiometer", "id": "pot2", "top": -164.5, "left": 297.4, "attrs": {} },
    {
      "type": "wokwi-text",
      "id": "text2",
      "top": -192,
      "left": 316.8,
      "attrs": { "text": "Load" }
    },
    {
      "type": "wokwi-resistor",
      "id": "r1",
      "top": 128.75,
      "left": 134.4,
      "attrs": { "value": "220" }
    },
    {
      "type": "wokwi-resistor",
      "id": "r2",
      "top": 176.75,
      "left": 115.2,
      "attrs": { "value": "220" }
    },
    {
      "type": "wokwi-resistor",
      "id": "r3",
      "top": 224.75,
      "left": 105.6,
      "attrs": { "value": "220" }
    },
    {
      "type": "wokwi-text",
      "id": "text4",
      "top": -163.2,
      "left": 105.6,
      "attrs": { "text": "Node A" }
    }
  ],
  "connections": [
    [ "esp:TX", "$serialMonitor:RX", "", [] ],
    [ "esp:RX", "$serialMonitor:TX", "", [] ],
    [ "esp:21", "lcd1:SDA", "green", [ "h139.24", "v-29" ] ],
    [ "esp:22", "lcd1:SCL", "purple", [ "h43.24", "v38.4" ] ],
    [ "esp:GND.2", "lcd1:GND", "black", [ "v-9.6", "h129.64", "v38.4" ] ],
    [ "esp:3V3", "pot1:VCC", "red", [ "h-23.81", "v-115.2", "h278.4" ] ],
    [ "pot1:GND", "esp:GND.2", "black", [ "v105.6", "h-129.64" ] ],
    [ "esp:3V3", "lcd1:VCC", "red", [ "h-14.21", "v-38.4", "h220.8", "v67.2" ] ],
    [ "esp:34", "pot1:SIG", "violet", [ "h-33.41", "v-134.4", "h278.4" ] ],
    [ "led3:C", "led2:C", "black", [ "h48", "v-48" ] ],
    [ "led1:C", "led2:C", "black", [ "h47.6", "v57.6" ] ],
    [ "pot2:GND", "pot1:GND", "black", [ "v19.2", "h-96" ] ],
    [ "pot2:VCC", "pot1:VCC", "red", [ "v28.8", "h-96" ] ],
    [ "esp:35", "pot2:SIG", "blue", [ "h-43.01", "v-134.4", "h364.8" ] ],
    [ "esp:GND.1", "led3:C", "black", [ "h-43.01", "v86.4", "h201.6" ] ],
    [ "esp:2", "r1:1", "gray", [ "h14.44", "v-28.8" ] ],
    [ "r1:2", "led1:A", "gray", [ "v0" ] ],
    [ "r2:2", "led2:A", "gold", [ "v0" ] ],
    [ "r2:1", "esp:15", "gold", [ "v0" ] ],
    [ "r3:2", "led3:A", "green", [ "v0" ] ],
    [ "r3:1", "esp:13", "green", [ "v0", "h-134.4", "v-67.2" ] ]
  ],
  "dependencies": {}
}
```

A couple of honest caveats on this JSON: I've verified the ESP32 board type,
the LCD1602 I2C wiring, and the potentiometer `SIG`/`VCC`/`GND` pin names
against real Wokwi examples, so those should paste in and work as-is. The
exact `top`/`left` layout coordinates are just reasonable guesses for
non-overlapping placement — Wokwi will happily let you drag parts around
afterward if anything visually overlaps. If a connection shows an error on
paste (occasionally a GND numbering like `GND.2` vs `GND.3` doesn't exist on
every board variant), just delete that one wire in the visual editor and
redraw it by dragging from the pin — the signal pins in the table above are
what matters, not the exact GND index.

## Firmware

Use `wokwi-node-firmware.ino`. Before running each project:
1. Set `NODE_ID` to `"A"` (first project) or `"B"` (second project/fork)
2. Set `SERVER_URL` to your public server address — see below, you need
   this running *before* you can test the full flow
3. In Wokwi's Library Manager, add `LiquidCrystal_I2C` (search and install)

## Getting your server reachable from Wokwi (Cloudflare Quick Tunnel)

Wokwi's simulated ESP32 has real internet access, but it **cannot reach your
laptop's `localhost`** — from its point of view, your laptop isn't on the
public internet. So `server.js` (running on your machine) needs a public
address.

**Note on ngrok:** ngrok was tried first, but Wokwi's simulated TLS stack
never actually reached it — ngrok's own request inspector showed zero
traces from Wokwi, only hits from a browser opening the link directly
(suspected SNI/TLS incompatibility). Cloudflare Quick Tunnel, which uses
different TLS infrastructure, worked immediately. **Use Cloudflare Quick
Tunnel — it's the method that actually works with Wokwi:**

1. Download `cloudflared` from https://github.com/cloudflare/cloudflared/releases
   (Windows: grab the `.exe`, e.g. `cloudflared-windows-amd64.exe`)
2. Start your server: `node server.js` (default port **3000** — check your
   terminal output/`.env` if you've changed `PORT`)
3. In another terminal, run:
   `cloudflared.exe tunnel --url http://localhost:3000`
4. It prints a link like `https://random-words-here.trycloudflare.com`
5. Put `https://random-words-here.trycloudflare.com/api/update` as
   `SERVER_URL` in BOTH Wokwi projects' firmware
6. Play and check the serial output for `POST -> 200`

**Important:** this URL is **not permanent** — every time you restart
`cloudflared`, you get a new random URL, and you'll need to update
`SERVER_URL` in both Wokwi firmwares again. No account or sign-up needed,
though — it's a single command.

## This is also your answer to "can people see it online without seeing the hardware"

Once the tunnel is running, the same public URL (without the `/api/update`
path — just `https://random-words-here.trycloudflare.com/`) opens your
**live dashboard** (`server.js` serves `public/index.html` at that root).
Anyone with that link — a Discord mod, a hackathon judge, a friend — can
open it in a plain browser and watch both houses' solar/load numbers update
live, see the settlement log fill in, and watch the animated flow between
the two houses whenever a trade settles. They don't need to see Wokwi, the
circuit, or either ESP32 at all — the dashboard tells the whole story by
itself. That's the "site" you were asking for.

For a **permanent** link that doesn't change on every restart, see the
deployment guide (Render.com) — that's the longer-term plan for Phase 7.