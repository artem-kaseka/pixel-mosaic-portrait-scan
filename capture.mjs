#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = __dirname;
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 60;
const TOTAL_FRAMES = 900; // 15.00 seconds
const DURATION = TOTAL_FRAMES / FPS;

const CHROME_CANDIDATES = [
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    if (p && fs.existsSync(p)) return p;
  }
  throw new Error('Could not find system Chrome/Chromium executable');
}

function startStaticServer(rootDir) {
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
  };
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const cleanUrl = (req.url || '/').split('?')[0];
      const rel = cleanUrl === '/' ? 'index.html' : cleanUrl.replace(/^\/+/, '');
      const fullPath = path.resolve(rootDir, rel);
      if (!fullPath.startsWith(rootDir) || !fs.existsSync(fullPath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(fullPath);
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      fs.createReadStream(fullPath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method && this.listeners.has(msg.method)) {
        for (const fn of this.listeners.get(msg.method)) fn(msg.params);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function launchBrowser() {
  const chromeBin = findChrome();
  const port = 9322 + Math.floor(Math.random() * 900);
  const profileDir = path.join(PROJECT_DIR, `.tmp_chrome_profile_${process.pid}`);
  fs.mkdirSync(profileDir, { recursive: true });
  const proc = spawn(
    chromeBin,
    [
      '--headless=new',
      `--user-data-dir=${profileDir}`,
      `--remote-debugging-port=${port}`,
      '--remote-allow-origins=*',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-gpu-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      `--window-size=${WIDTH},${HEIGHT}`,
      '--hide-scrollbars',
      '--mute-audio',
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let stderrBuf = '';
  proc.stderr.on('data', (c) => {
    stderrBuf += c.toString();
  });

  let targetWs = null;
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) {
          targetWs = page.webSocketDebuggerUrl;
          break;
        }
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }

  if (!targetWs) {
    proc.kill('SIGKILL');
    fs.rmSync(profileDir, { recursive: true, force: true });
    throw new Error('Failed to connect to Chrome CDP:\n' + stderrBuf.slice(-1200));
  }

  const cdp = new CDPClient(targetWs);
  await cdp.connect();
  return { proc, cdp, profileDir };
}

// Original subtle synthesized stereo ambience (48 kHz 16-bit PCM WAV)
// Calibrated analog scan hum, soft quantizer micro-ticks, low pulses on scripted clicks
function synthesizeScanAudioWav(outPath, durationSec) {
  const sr = 48000;
  const numSamples = Math.round(sr * durationSec);
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  let seed = 77319283;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const smoothstep = (e0, e1, x) => {
    const u = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return u * u * (3 - 2 * u);
  };

  let lpL = 0, lpR = 0;

  // Quantizer micro-ticks (subtle dry precision ticks)
  const ticks = [];
  for (let tt = 0.08; tt < durationSec - 0.55; ) {
    const step = tt >= 11.0 && tt < 13.0 ? 0.055 + rand() * 0.045 : tt >= 7.0 && tt < 11.0 ? 0.14 + rand() * 0.10 : 0.09 + rand() * 0.08;
    const freq = tt >= 3.5 && tt < 7.0 ? 1850 + rand() * 900 : tt >= 7.0 && tt < 11.0 ? 680 + rand() * 340 : 1120 + rand() * 720;
    ticks.push({
      t: tt,
      f: freq,
      pan: (rand() - 0.5) * 1.1,
      amp: tt >= 11.0 && tt < 13.1 ? 0.028 : 0.015,
    });
    tt += step;
  }

  // Scripted click / shockwave low pulses (4.35s, 8.60s, 11.85s) + preset shifts (3.5s, 7.0s, 11.0s)
  const pulses = [
    { t: 3.50, f0: 150, f1: 72, amp: 0.09, dec: 0.35, pan: 0.0 },
    { t: 4.35, f0: 210, f1: 58, amp: 0.16, dec: 0.42, pan: 0.12 },  // CLINICAL pulse
    { t: 7.00, f0: 130, f1: 54, amp: 0.10, dec: 0.48, pan: -0.05 },
    { t: 8.60, f0: 165, f1: 48, amp: 0.18, dec: 0.62, pan: -0.10 }, // PHOSPHOR pulse
    { t: 11.00, f0: 190, f1: 44, amp: 0.14, dec: 0.45, pan: 0.0 },
    { t: 11.85, f0: 240, f1: 40, amp: 0.22, dec: 0.58, pan: 0.04 },  // FRACTURE burst
    { t: 12.75, f0: 120, f1: 64, amp: 0.11, dec: 0.52, pan: 0.0 },   // Restitch sweep start
  ];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sr;
    const envMaster = smoothstep(0, 0.35, t) * (1 - smoothstep(durationSec - 0.55, durationSec, t));

    const w0 = 1 - smoothstep(3.35, 3.65, t);
    const w1 = smoothstep(3.35, 3.65, t) * (1 - smoothstep(6.85, 7.15, t));
    const w2 = smoothstep(6.85, 7.15, t) * (1 - smoothstep(10.85, 11.15, t));
    const w3 = smoothstep(10.85, 11.15, t);

    // Subtle dark calibrated scan hum per preset
    const hum0 = (Math.sin(2 * Math.PI * 55.0 * t) * 0.55 + Math.sin(2 * Math.PI * 110.2 * t) * 0.25) * 0.042 * w0;
    const hum1 = (Math.sin(2 * Math.PI * 65.4 * t) * 0.45 + Math.sin(2 * Math.PI * 196.2 * t) * 0.18) * 0.036 * w1;
    const hum2 = (Math.sin(2 * Math.PI * 60.0 * t) * 0.55 + Math.sin(2 * Math.PI * 120.0 * t) * 0.22 + Math.sin(2 * Math.PI * 180.0 * t) * 0.08) * 0.046 * w2;
    const hum3 = (Math.sin(2 * Math.PI * 49.0 * t) * 0.55 + Math.sin(2 * Math.PI * 98.4 * t) * 0.28) * 0.048 * w3;

    // Gentle stereo filtered air/static bed (stronger during initial noise & fracture chaos)
    const chaosAmp = (1 - smoothstep(0.0, 2.2, t)) * 0.045 + smoothstep(11.0, 11.4, t) * (1 - smoothstep(12.9, 14.1, t)) * 0.055;
    const nL = rand() * 2 - 1;
    const nR = rand() * 2 - 1;
    const cut = 0.04 + chaosAmp * 1.4;
    lpL += cut * (nL - lpL);
    lpR += cut * (nR - lpR);

    const baseL = hum0 + hum1 + hum2 + hum3 + lpL * (0.014 + chaosAmp);
    const baseR = hum0 + hum1 + hum2 + hum3 + lpR * (0.014 + chaosAmp);

    left[i] = baseL * envMaster;
    right[i] = baseR * envMaster;
  }

  // Mix subtle quantizer ticks
  for (const tk of ticks) {
    const startIdx = Math.floor(tk.t * sr);
    const len = Math.min(numSamples - startIdx, Math.floor(0.018 * sr));
    const gL = Math.cos(((tk.pan + 1) * Math.PI) / 4);
    const gR = Math.sin(((tk.pan + 1) * Math.PI) / 4);
    for (let k = 0; k < len; k++) {
      const dt = k / sr;
      const env = Math.exp(-dt * 260) * Math.min(1, dt / 0.0008);
      const val = Math.sin(2 * Math.PI * tk.f * dt) * env * tk.amp;
      left[startIdx + k] += val * gL;
      right[startIdx + k] += val * gR;
    }
  }

  // Mix low resonant sub-pulses
  for (const pl of pulses) {
    const startIdx = Math.floor(pl.t * sr);
    const len = Math.min(numSamples - startIdx, Math.floor(pl.dec * 3.5 * sr));
    const gL = Math.cos(((pl.pan + 1) * Math.PI) / 4);
    const gR = Math.sin(((pl.pan + 1) * Math.PI) / 4);
    let phase = 0;
    for (let k = 0; k < len; k++) {
      const dt = k / sr;
      const freq = pl.f1 + (pl.f0 - pl.f1) * Math.exp(-dt * 12);
      phase += (2 * Math.PI * freq) / sr;
      const env = Math.min(1, dt / 0.008) * Math.exp(-dt / pl.dec);
      const val = (Math.sin(phase) * 0.8 + Math.sin(phase * 2.0) * 0.2) * env * pl.amp;
      left[startIdx + k] += val * gL;
      right[startIdx + k] += val * gR;
    }
  }

  // Write 16-bit Stereo PCM WAV
  const dataBytes = numSamples * 4;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataBytes, 40);

  let off = 44;
  for (let i = 0; i < numSamples; i++) {
    const vL = Math.max(-0.92, Math.min(0.92, left[i]));
    const vR = Math.max(-0.92, Math.min(0.92, right[i]));
    buf.writeInt16LE(Math.round(vL * 32767), off);
    buf.writeInt16LE(Math.round(vR * 32767), off + 2);
    off += 4;
  }
  fs.writeFileSync(outPath, buf);
}

async function evalJs(cdp, expression) {
  const res = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.exceptionDetails) {
    throw new Error('Page JS error: ' + JSON.stringify(res.exceptionDetails));
  }
  return res.result?.value;
}

async function grabCanvasPng(cdp, frameIndex) {
  const dataUrl = await evalJs(
    cdp,
    `(() => {
      window.__mosaic.renderFrame(${frameIndex});
      return document.getElementById('mosaic-canvas').toDataURL('image/png');
    })()`
  );
  const comma = dataUrl.indexOf(',');
  return Buffer.from(dataUrl.slice(comma + 1), 'base64');
}

async function main() {
  const args = process.argv.slice(2);
  const previewOnly = args.includes('--preview-stills');
  const crfArg = args.find((a) => a.startsWith('--crf='));
  const crf = crfArg ? crfArg.split('=')[1] : '18';

  const { server, port } = await startStaticServer(PROJECT_DIR);
  const { proc: chromeProc, cdp, profileDir } = await launchBrowser();

  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1,
      mobile: false,
    });

    const loadDone = new Promise((resolve) => cdp.on('Page.loadEventFired', resolve));
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html?capture=1` });
    await loadDone;
    await evalJs(cdp, 'document.fonts ? document.fonts.ready : Promise.resolve()');

    // Quick determinism + live-frame performance benchmark
    const perfInfo = await evalJs(
      cdp,
      `(() => {
        const t0 = performance.now();
        for (let i = 0; i < 60; i++) window.__mosaic.renderFrame(i);
        const dt60 = performance.now() - t0;
        const p1 = document.getElementById('mosaic-canvas').toDataURL('image/png');
        window.__mosaic.renderFrame(59);
        const p2 = document.getElementById('mosaic-canvas').toDataURL('image/png');
        window.__mosaic.reset();
        return {
          info: window.__mosaic.getInfo(),
          msPerFrame: +(dt60 / 60).toFixed(2),
          deterministic: p1 === p2,
        };
      })()`
    );
    console.log('Engine check:', JSON.stringify(perfInfo));
    if (!perfInfo.deterministic) {
      throw new Error('Determinism check failed: identical frame index produced different PNG!');
    }

    const stillsDir = path.join(PROJECT_DIR, 'stills');
    fs.mkdirSync(stillsDir, { recursive: true });

    if (previewOnly) {
      const previewFrames = [
        { f: 6,   name: '01_formation_noise_0.1s.png' },
        { f: 66,  name: '02_formation_scanline_1.1s.png' },
        { f: 156, name: '03_formation_pointer_scatter_2.6s.png' },
        { f: 270, name: '04_clinical_pulse_4.5s.png' },
        { f: 525, name: '05_phosphor_amber_8.75s.png' },
        { f: 718, name: '06_fracture_swarm_11.97s.png' },
        { f: 864, name: '07_fracture_restitched_14.4s.png' },
      ];
      for (const item of previewFrames) {
        const png = await grabCanvasPng(cdp, item.f);
        fs.writeFileSync(path.join(stillsDir, item.name), png);
        console.log(`Saved stills/${item.name} (${(png.length / 1024).toFixed(1)} KB)`);
      }
      return;
    }

    // Full deterministic 1080p60 capture piped directly into ffmpeg
    const wavPath = path.join(PROJECT_DIR, '.tmp_scan_audio.wav');
    const mp4Path = path.join(PROJECT_DIR, 'pixel-mosaic-portrait-scan-1080p60.mp4');
    console.log('Synthesizing 15.0s stereo scan ambience (48 kHz)...');
    synthesizeScanAudioWav(wavPath, DURATION);

    const ffmpegArgs = [
      '-y',
      '-f', 'image2pipe',
      '-vcodec', 'png',
      '-framerate', String(FPS),
      '-i', 'pipe:0',
      '-i', wavPath,
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-c:v', 'libx264',
      '-profile:v', 'high',
      '-preset', 'slow',
      '-crf', String(crf),
      '-pix_fmt', 'yuv420p',
      '-r', String(FPS),
      '-c:a', 'aac',
      '-ar', '48000',
      '-ac', '2',
      '-b:a', '128k',
      '-shortest',
      '-movflags', '+faststart',
      mp4Path,
    ];

    console.log(`Starting ffmpeg pipe encode (${TOTAL_FRAMES} frames @ ${WIDTH}x${HEIGHT} ${FPS}fps, CRF ${crf})...`);
    const ff = spawn('ffmpeg', ffmpegArgs, { stdio: ['pipe', 'inherit', 'pipe'] });
    let ffStderr = '';
    ff.stderr.on('data', (chunk) => {
      ffStderr += chunk.toString();
    });

    const ffDone = new Promise((resolve, reject) => {
      ff.on('error', reject);
      ff.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}:\n${ffStderr.slice(-1600)}`));
      });
    });

    const tStart = Date.now();
    for (let f = 0; f < TOTAL_FRAMES; f++) {
      const png = await grabCanvasPng(cdp, f);
      if (!ff.stdin.write(png)) {
        await new Promise((resolve) => ff.stdin.once('drain', resolve));
      }
      if ((f + 1) % 100 === 0 || f === TOTAL_FRAMES - 1) {
        const elapsed = ((Date.now() - tStart) / 1000).toFixed(1);
        console.log(`Captured ${f + 1}/${TOTAL_FRAMES} frames (${elapsed}s elapsed)`);
      }
    }
    ff.stdin.end();
    await ffDone;

    if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);

    const stat = fs.statSync(mp4Path);
    const sizeMB = stat.size / (1024 * 1024);
    console.log(`Encoded ${mp4Path}: ${stat.size} bytes (${sizeMB.toFixed(2)} MB)`);

    // Extract QA stills directly from the encoded MP4 so QA reflects actual compressed output
    const qaTimes = [
      { ts: '00:00:00.10', name: 'qa_01_formation_noise_0.1s.png' },
      { ts: '00:00:01.10', name: 'qa_02_formation_scanline_1.1s.png' },
      { ts: '00:00:02.60', name: 'qa_03_formation_pointer_scatter_2.6s.png' },
      { ts: '00:00:04.50', name: 'qa_04_clinical_pulse_4.5s.png' },
      { ts: '00:00:08.75', name: 'qa_05_phosphor_amber_8.75s.png' },
      { ts: '00:00:11.97', name: 'qa_06_fracture_swarm_11.97s.png' },
      { ts: '00:00:14.45', name: 'qa_07_fracture_restitched_14.45s.png' },
    ];
    for (const q of qaTimes) {
      const out = path.join(stillsDir, q.name);
      execFileSync('ffmpeg', ['-y', '-ss', q.ts, '-i', mp4Path, '-frames:v', '1', '-q:v', '2', out], {
        stdio: 'ignore',
      });
    }
    console.log(`Extracted ${qaTimes.length} QA stills from MP4 into stills/`);
  } finally {
    try { cdp.close(); } catch {}
    try { chromeProc.kill('SIGKILL'); } catch {}
    try { server.close(); } catch {}
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
