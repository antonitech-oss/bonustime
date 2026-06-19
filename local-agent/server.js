/**
 * BONUSTIME LOCAL AGENT v4.0 — H264 REAL-TIME STREAM
 * screenrecord --output-format=h264 → WebSocket binary → WebCodecs decoder
 */
const http    = require("http");
const { WebSocketServer } = require("ws");
const { exec, execSync, spawn } = require("child_process");
let   sharp;
try { sharp = require("sharp"); } catch { sharp = null; }

const PORT = 8765;
const CONFIG = { pin: "111111", jpegQuality: 70, frameWidth: 540 };

// ─── ADB helpers ─────────────────────────────────────────────────────────────

function adbSync(cmd) {
  try { return execSync(cmd, { timeout: 8000 }).toString().trim(); }
  catch { return ""; }
}
function adbAsync(cmd, timeout = 10000) {
  return new Promise(res => exec(cmd, { timeout }, (e, o) => res(e ? "" : (o||"").trim())));
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

function getDeviceIds() {
  const out = adbSync("adb devices");
  return out.split("\n").slice(1)
    .filter(l => l.includes("\tdevice"))
    .map(l => l.split("\t")[0].trim()).filter(Boolean);
}

function getDeviceList() {
  const ids = getDeviceIds();
  return ids.map(id => {
    const model   = adbSync(`adb -s ${id} shell getprop ro.product.model`) || id;
    const android = adbSync(`adb -s ${id} shell getprop ro.build.version.release`) || "?";
    const bRaw    = adbSync(`adb -s ${id} shell dumpsys battery`);
    const batt    = parseInt((bRaw.match(/level:\s*(\d+)/) || [])[1] || "0");
    const wRaw    = adbSync(`adb -s ${id} shell wm size`);
    const wMatch  = wRaw.match(/(\d+)x(\d+)/);
    return {
      id, model, android, batteria: batt, status: "connesso",
      screenWidth:  wMatch ? parseInt(wMatch[1]) : 1080,
      screenHeight: wMatch ? parseInt(wMatch[2]) : 1920,
    };
  });
}

// ─── H264 Real-time stream ────────────────────────────────────────────────────
// Usa screenrecord --output-format=h264 per streaming hardware H264
// Il browser decodifica con WebCodecs API → 20-30fps reale

const h264Procs    = new Map(); // "deviceId:clientId" → ChildProcess
const h264Stopping = new Set(); // deviceIds in fase di stop (no auto-restart)

function startH264(ws, deviceId, clientId) {
  const key = `${deviceId}:${clientId}`;
  if (h264Procs.has(key)) return;
  h264Stopping.delete(key);

  // Binary header: magic(2) + deviceId null-padded a 32 byte = 34 byte totali
  const header = Buffer.alloc(34);
  header[0] = 0xB0; header[1] = 0x0B;
  Buffer.from(deviceId).copy(header, 2, 0, Math.min(deviceId.length, 32));

  const proc = spawn("adb", [
    "-s", deviceId, "exec-out",
    "screenrecord",
    "--time-limit=180",
    "--output-format=h264",
    "--bit-rate", "3000000",   // 3 Mbps
    "--size", "360x640",       // risoluzione ridotta → meno dati, più fps
    "-"
  ]);

  h264Procs.set(key, proc);

  proc.stdout.on("data", chunk => {
    if (ws.readyState !== 1) { proc.kill(); return; }
    ws.send(Buffer.concat([header, chunk]), { binary: true });
  });

  proc.stderr.on("data", d => {
    const s = d.toString().trim();
    if (s) console.log(`[H264] ${deviceId.slice(0,8)}: ${s}`);
  });

  proc.on("close", code => {
    h264Procs.delete(key);
    if (!h264Stopping.has(key) && ws.readyState === 1) {
      // screenrecord ha un limite di 180s, si auto-riavvia
      setTimeout(() => startH264(ws, deviceId, clientId), 400);
    }
    h264Stopping.delete(key);
  });

  console.log(`[H264] ${deviceId.slice(0,8)} started @2Mbps`);
}

function stopH264(deviceId, clientId) {
  const key = `${deviceId}:${clientId}`;
  h264Stopping.add(key);
  const proc = h264Procs.get(key);
  if (proc) { proc.kill("SIGKILL"); h264Procs.delete(key); }
}

// ─── JPEG stream (fallback) ───────────────────────────────────────────────────

async function captureFrame(deviceId) {
  const rawBuf = await new Promise((resolve, reject) => {
    exec(
      `adb -s ${deviceId} exec-out screencap -p`,
      { encoding: "buffer", maxBuffer: 20 * 1024 * 1024, timeout: 12000 },
      (err, stdout) => { if (err) reject(err); else resolve(stdout); }
    );
  });
  if (sharp) {
    return await sharp(rawBuf)
      .resize(CONFIG.frameWidth, null, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: CONFIG.jpegQuality, mozjpeg: false })
      .toBuffer();
  }
  return rawBuf;
}

const activeStreams = new Map();
const frameQueues  = new Map();

function startStream(ws, deviceId, clientId, fps = 3) {
  const key = `${deviceId}:${clientId}`;
  if (activeStreams.has(key)) return;
  const delay = Math.max(Math.round(1000 / Math.min(fps, 8)), 120);
  frameQueues.set(deviceId, { busy: false });
  const tick = async () => {
    if (ws.readyState !== 1) { stopStream(deviceId, clientId); return; }
    const q = frameQueues.get(deviceId);
    if (q?.busy) return;
    if (q) q.busy = true;
    try {
      const buf  = await captureFrame(deviceId);
      const b64  = buf.toString("base64");
      const mime = sharp ? "image/jpeg" : "image/png";
      if (ws.readyState === 1)
        ws.send(JSON.stringify({ type: "frame", deviceId, data: b64, mime }));
    } catch (e) {
      if (ws.readyState === 1)
        ws.send(JSON.stringify({ type: "stream_error", deviceId, msg: e.message }));
    } finally {
      if (q) q.busy = false;
    }
  };
  activeStreams.set(key, setInterval(tick, delay));
  tick();
}

function stopStream(deviceId, clientId) {
  const key = `${deviceId}:${clientId}`;
  const id  = activeStreams.get(key);
  if (id) { clearInterval(id); activeStreams.delete(key); }
}

// ─── Smart Tap (UIAutomator) ─────────────────────────────────────────────────
// Trova elemento UI per testo/resourceId invece di coordinate fisse
// Funziona su risoluzioni diverse + resiste agli aggiornamenti app

function parseBounds(str) {
  const m = str.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!m) return null;
  return { x1:+m[1], y1:+m[2], x2:+m[3], y2:+m[4],
    cx: Math.round((+m[1]+ +m[3])/2), cy: Math.round((+m[2]+ +m[4])/2) };
}

async function dumpUI(deviceId) {
  // Dump gerarchia UI in XML e ritorna come stringa
  return adbAsync(
    `adb -s ${deviceId} shell "uiautomator dump /sdcard/.bt_ui.xml >/dev/null 2>&1 && cat /sdcard/.bt_ui.xml"`,
    15000
  );
}

function findNodeAtCoords(xml, px, py) {
  // Trova il nodo più piccolo che contiene le coordinate (elemento preciso toccato)
  let best = null, bestArea = Infinity;
  const re = /<node\b[^\/\n>]*>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const n = m[0];
    const bm = n.match(/bounds="([^"]+)"/); if (!bm) continue;
    const b = parseBounds(bm[1]);           if (!b)  continue;
    if (px >= b.x1 && px <= b.x2 && py >= b.y1 && py <= b.y2) {
      const area = (b.x2-b.x1)*(b.y2-b.y1);
      if (area < bestArea) {
        bestArea = area;
        const tm = n.match(/text="([^"]*)"/);
        const im = n.match(/resource-id="([^"]*)"/);
        const dm = n.match(/content-desc="([^"]*)"/);
        const cl = n.match(/class="([^"]*)"/);
        best = {
          bounds: b,
          text:        tm ? tm[1] : "",
          resourceId:  im ? im[1] : "",
          contentDesc: dm ? dm[1] : "",
          className:   cl ? cl[1] : "",
        };
      }
    }
  }
  return best;
}

function findNodeByKey(xml, text, resourceId, contentDesc) {
  // Cerca elemento per testo, resource-id o content-desc
  const re = /<node\b[^\/\n>]*>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const n = m[0];
    const hit =
      (text        && text.length > 0        && n.includes(`text="${text}"`)) ||
      (resourceId  && resourceId.length > 0  && n.includes(`resource-id="${resourceId}"`)) ||
      (contentDesc && contentDesc.length > 0 && n.includes(`content-desc="${contentDesc}"`));
    if (!hit) continue;
    const bm = n.match(/bounds="([^"]+)"/); if (!bm) continue;
    const b = parseBounds(bm[1]);           if (!b)  continue;
    return b;
  }
  return null;
}

async function smartTap(ws, sourceId, px, py, allTargets) {
  // 1. Dump UI del device sorgente e individua elemento toccato
  const srcXml = await dumpUI(sourceId);
  if (!srcXml || srcXml.length < 100) {
    ws.send(JSON.stringify({ type:"smart_tap_error", deviceId:sourceId, msg:"UI dump fallito" })); return;
  }
  const node = findNodeAtCoords(srcXml, px, py);
  if (!node) {
    // Fallback: tap normale su tutti
    for (const id of allTargets) await adbAsync(`adb -s ${id} shell input tap ${px} ${py}`);
    return;
  }

  const key = node.text || node.contentDesc || node.resourceId;
  ws.send(JSON.stringify({ type:"smart_tap_found", text:key, className:node.className }));

  // 2. Tappa source subito
  await adbAsync(`adb -s ${sourceId} shell input tap ${node.bounds.cx} ${node.bounds.cy}`);
  ws.send(JSON.stringify({ type:"smart_tap_ok", deviceId:sourceId, text:key }));

  // 3. Per ogni altro device: delay random 1-5s, poi trova e tappa
  const others = allTargets.filter(id => id !== sourceId);
  others.forEach(devId => {
    const delay = Math.round(1200 + Math.random() * 4000); // 1.2s – 5.2s
    setTimeout(async () => {
      try {
        const xml = await dumpUI(devId);
        let b = null;
        if (xml && xml.length > 100)
          b = findNodeByKey(xml, node.text, node.resourceId, node.contentDesc);
        if (!b) {
          // Fallback proporzionale: usa stessa posizione relativa
          const srcBoundsTotal = { w: node.bounds.x2 - node.bounds.x1, h: node.bounds.y2 - node.bounds.y1 };
          ws.send(JSON.stringify({ type:"smart_tap_miss", deviceId:devId, msg:`"${key}" non trovato, uso coord relative` }));
          await adbAsync(`adb -s ${devId} shell input tap ${px} ${py}`);
        } else {
          await adbAsync(`adb -s ${devId} shell input tap ${b.cx} ${b.cy}`);
          if (ws.readyState === 1)
            ws.send(JSON.stringify({ type:"smart_tap_ok", deviceId:devId, text:key, delay }));
        }
      } catch(e) {
        if (ws.readyState === 1)
          ws.send(JSON.stringify({ type:"smart_tap_miss", deviceId:devId, msg:e.message }));
      }
    }, delay);
  });
}

// ─── AutoClicker ─────────────────────────────────────────────────────────────
const acStates = new Map(); // clientId → { active, cycleCount, clickCount, startTime }

async function startAutoClicker(ws, clientId, config) {
  const ex = acStates.get(clientId); if (ex) ex.active = false;
  const state = { active: true, cycleCount: 0, clickCount: 0, startTime: Date.now() };
  acStates.set(clientId, state);
  const { deviceIds, points, stopMode, maxCycles, maxDuration, deviceDimensions } = config;
  if (ws.readyState === 1) ws.send(JSON.stringify({ type: "ac_started" }));
  const run = async () => {
    while (state.active) {
      if (stopMode === "cycles"   && state.cycleCount >= maxCycles) break;
      if (stopMode === "duration" && (Date.now() - state.startTime) >= maxDuration * 1000) break;
      for (const point of points) {
        if (!state.active) return;
        const targets = deviceIds?.length ? deviceIds : getDeviceIds();
        await Promise.all(targets.map(did => {
          const dim = deviceDimensions?.[did] || { w: 1080, h: 1920 };
          const px = Math.round(point.relX * dim.w);
          const py = Math.round(point.relY * dim.h);
          return adbAsync(`adb -s ${did} shell input tap ${px} ${py}`);
        }));
        state.clickCount++;
        if (ws.readyState === 1)
          ws.send(JSON.stringify({ type: "ac_tick", clickCount: state.clickCount, cycleCount: state.cycleCount }));
        await sleep(Math.max((point.delay || 1) * 1000, 80));
      }
      state.cycleCount++;
    }
    state.active = false; acStates.delete(clientId);
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: "ac_stopped", clickCount: state.clickCount }));
  };
  run().catch(e => {
    state.active = false; acStates.delete(clientId);
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: "ac_stopped", error: e.message }));
  });
}

// ─── Sblocco ──────────────────────────────────────────────────────────────────

async function lockDevice(id) {
  await adbAsync(`adb -s ${id} shell input keyevent KEYCODE_SLEEP`);
  return { ok: true, msg: "locked" };
}

async function unlockDevice(id, pin) {
  const sizeRaw = adbSync(`adb -s ${id} shell wm size`);
  const m = sizeRaw.match(/(\d+)x(\d+)/);
  const W = m ? parseInt(m[1]) : 1080;
  const H = m ? parseInt(m[2]) : 1920;
  const cx  = Math.round(W / 2);
  const sy1 = Math.round(H * 0.85);
  const sy2 = Math.round(H * 0.45);

  // 1. Sveglia schermo
  await adbAsync(`adb -s ${id} shell input keyevent KEYCODE_WAKEUP`);
  await sleep(600);

  // 2. Controlla se schermo è già sbloccato (se c è una finestra aperta)
  const state = adbSync(`adb -s ${id} shell dumpsys window | grep mDreamingLockscreen`);
  const isLocked = state.includes("true");

  if (isLocked) {
    // 3. Swipe up per aprire il PIN pad
    await adbAsync(`adb -s ${id} shell input swipe ${cx} ${sy1} ${cx} ${sy2} 300`);
    await sleep(800);
    // 4. Inserisci PIN cifra per cifra per sicurezza
    for (const digit of pin.split("")) {
      await adbAsync(`adb -s ${id} shell input keyevent KEYCODE_${digit}`);
      await sleep(80);
    }
    await sleep(300);
    await adbAsync(`adb -s ${id} shell input keyevent KEYCODE_ENTER`);
    await sleep(500);
  }

  return { ok: true, msg: isLocked ? `sbloccato (${W}x${H})` : `già sbloccato` };
}

// ─── HTTP + WebSocket ─────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  if (req.url === "/devices") {
    try { res.writeHead(200); res.end(JSON.stringify(getDeviceList())); }
    catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    return;
  }
  if (req.url === "/status") {
    res.writeHead(200);
    res.end(JSON.stringify({ sharp: !!sharp, devices: getDeviceIds().length, uptime: process.uptime() }));
    return;
  }
  res.writeHead(200); res.end(JSON.stringify({ status: "ok" }));
});

const wss = new WebSocketServer({ server, maxPayload: 100 * 1024 * 1024 });
let clientCounter = 0;

wss.on("connection", (ws) => {
  const clientId = ++clientCounter;
  console.log(`[WS] #${clientId} connesso`);
  ws.send(JSON.stringify({ type: "devices", payload: getDeviceList() }));

  ws.on("message", async (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    const { type, deviceId, deviceIds, command, label, fps, x, y } = msg;

    switch (type) {
      case "start_h264":   startH264(ws, deviceId, clientId); break;
      case "stop_h264":    stopH264(deviceId, clientId); break;
      case "start_stream": startStream(ws, deviceId, clientId, fps ?? 3); break;
      case "stop_stream":  stopStream(deviceId, clientId); break;

      case "set_quality":
        if (msg.quality) CONFIG.jpegQuality = Math.max(20, Math.min(95, msg.quality));
        if (msg.width)   CONFIG.frameWidth  = Math.max(270, Math.min(1080, msg.width));
        break;

      case "refresh_devices":
        ws.send(JSON.stringify({ type: "devices", payload: getDeviceList() }));
        break;

      case "tap":
        await adbAsync(`adb -s ${deviceId} shell input tap ${Math.round(x)} ${Math.round(y)}`);
        ws.send(JSON.stringify({ type: "tap_ok", deviceId, x, y }));
        break;

      case "smart_tap": {
        const stTargets = deviceIds?.length ? deviceIds : getDeviceIds();
        smartTap(ws, deviceId, Math.round(x), Math.round(y), stTargets);
        break;
      }

      case "longpress":
        await adbAsync(`adb -s ${deviceId} shell input swipe ${Math.round(x)} ${Math.round(y)} ${Math.round(x)} ${Math.round(y)} ${msg.duration||600}`);
        ws.send(JSON.stringify({ type: "tap_ok", deviceId, x, y }));
        break;

      case "double_tap":
        await adbAsync(`adb -s ${deviceId} shell input tap ${Math.round(x)} ${Math.round(y)}`);
        await sleep(60);
        await adbAsync(`adb -s ${deviceId} shell input tap ${Math.round(x)} ${Math.round(y)}`);
        break;

      case "swipe":
        await adbAsync(`adb -s ${deviceId} shell input swipe ${Math.round(msg.x1)} ${Math.round(msg.y1)} ${Math.round(msg.x2)} ${Math.round(msg.y2)} ${msg.dur||300}`);
        break;

      case "wifi": {
        const wt = deviceIds?.length ? deviceIds : getDeviceIds();
        const wCmd = msg.on ? "enable" : "disable";
        await Promise.all(wt.map(id => adbAsync(`adb -s ${id} shell svc wifi ${wCmd}`)));
        ws.send(JSON.stringify({ type: "exec_result", label: `wifi ${wCmd}`, results: wt.map(id=>({deviceId:id,ok:true})) }));
        break;
      }

      case "airplane": {
        const at = deviceIds?.length ? deviceIds : getDeviceIds();
        const aVal = msg.on ? "1" : "0";
        await Promise.all(at.map(async id => {
          await adbAsync(`adb -s ${id} shell settings put global airplane_mode_on ${aVal}`);
          await adbAsync(`adb -s ${id} shell am broadcast -a android.intent.action.AIRPLANE_MODE --ez state ${msg.on?"true":"false"}`);
        }));
        ws.send(JSON.stringify({ type: "exec_result", label: `aereo ${msg.on?"on":"off"}`, results: at.map(id=>({deviceId:id,ok:true})) }));
        break;
      }

      case "rotation": {
        const rt = deviceIds?.length ? deviceIds : getDeviceIds();
        const rAngle = msg.landscape ? 1 : 0;
        await Promise.all(rt.map(async id => {
          await adbAsync(`adb -s ${id} shell settings put system accelerometer_rotation 0`);
          await adbAsync(`adb -s ${id} shell settings put system user_rotation ${rAngle}`);
        }));
        ws.send(JSON.stringify({ type: "exec_result", label: `rot ${msg.landscape?"land":"port"}`, results: rt.map(id=>({deviceId:id,ok:true})) }));
        break;
      }

      case "clear_cookies": {
        const ct = deviceIds?.length ? deviceIds : getDeviceIds();
        const pkg = msg.pkg || "com.android.chrome";
        await Promise.all(ct.map(id => adbAsync(`adb -s ${id} shell pm clear ${pkg}`, 30000)));
        ws.send(JSON.stringify({ type: "exec_result", label: "clear cookies", results: ct.map(id=>({deviceId:id,ok:true})) }));
        break;
      }

      case "type_text": {
        const tt = deviceIds?.length ? deviceIds : getDeviceIds();
        const raw = msg.text || "";
        const escaped = raw
          .replace(/\\/g, "\\\\").replace(/'/g, "\\'")
          .replace(/ /g, "%s").replace(/&/g, "\\&")
          .replace(/</g, "\\<").replace(/>/g, "\\>")
          .replace(/\|/g, "\\|").replace(/;/g, "\\;")
          .replace(/\$/g, "\\$").replace(/`/g, "\\`");
        await Promise.all(tt.map(id => adbAsync(`adb -s ${id} shell input text '${escaped}'`, 20000)));
        ws.send(JSON.stringify({ type: "exec_result", label: `text: ${raw.slice(0,20)}`, results: tt.map(id=>({deviceId:id,ok:true})) }));
        break;
      }

      case "keyevent_multi": {
        const kt = deviceIds?.length ? deviceIds : getDeviceIds();
        await Promise.all(kt.map(id => adbAsync(`adb -s ${id} shell input keyevent ${msg.keycode}`)));
        break;
      }

      case "ac_start":
        startAutoClicker(ws, clientId, msg.config);
        break;

      case "ac_stop": {
        const acs = acStates.get(clientId);
        if (acs) acs.active = false;
        break;
      }

      case "exec": {
        const targets = deviceIds?.length ? deviceIds : getDeviceIds();
        const results = await Promise.all(targets.map(async did => {
          const out = await adbAsync(`adb -s ${did} shell ${command}`, 15000);
          return { deviceId: did, ok: true, output: out };
        }));
        ws.send(JSON.stringify({ type: "exec_result", label, results }));
        break;
      }

      case "lock": {
        const tL = deviceIds?.length ? deviceIds : getDeviceIds();
        await Promise.all(tL.map(id => lockDevice(id)));
        ws.send(JSON.stringify({ type: "exec_result", label: "lock", results: tL.map(id=>({deviceId:id,ok:true})) }));
        break;
      }

      case "unlock": {
        const t2 = deviceIds?.length ? deviceIds : getDeviceIds();
        const r2 = await Promise.all(t2.map(async id => {
          try { return { deviceId: id, ...(await unlockDevice(id, msg.pin || CONFIG.pin)) }; }
          catch (e) { return { deviceId: id, ok: false, msg: e.message }; }
        }));
        ws.send(JSON.stringify({ type: "unlock_result", results: r2 }));
        break;
      }
    }
  });

  ws.on("close", () => {
    for (const key of [...activeStreams.keys()])
      if (key.endsWith(`:${clientId}`)) { clearInterval(activeStreams.get(key)); activeStreams.delete(key); }
    for (const [k, p] of [...h264Procs.entries()])
      if (k.endsWith(`:${clientId}`)) { p.kill("SIGKILL"); h264Procs.delete(k); }
    const acs = acStates.get(clientId); if (acs) { acs.active = false; acStates.delete(clientId); }
    console.log(`[WS] #${clientId} disconnesso`);
  });
});

// Hotplug
let prevSnap = "";
setInterval(() => {
  const ids  = getDeviceIds();
  const snap = ids.sort().join(",");
  if (snap !== prevSnap) {
    prevSnap = snap;
    const msg = JSON.stringify({ type: "devices", payload: getDeviceList() });
    wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
    console.log(`[Hotplug] ${ids.length} device`);
  }
}, 5000);

server.listen(PORT, () => {
  console.log("\n╔═══════════════════════════════════════════════╗");
  console.log(`║  Bonustime Agent v4.0  ws://localhost:${PORT}    ║`);
  console.log(`║  H264 streaming + WebCodecs decoder             ║`);
  console.log("╚═══════════════════════════════════════════════╝\n");
  const devs = getDeviceList();
  console.log(`[ADB] ${devs.length} dispositivi:`, devs.map(d => d.model).join(", ") || "nessuno");
  console.log("[Web] http://localhost:3001/dispositivi\n");
});
