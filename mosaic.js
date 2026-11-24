(() => {
  'use strict';

  // =========================================================================
  // KORVA — LATENT RELIEF 04
  // Original Procedural 3D Sculptural Bust Pixel-Mosaic Scan
  // Pure Canvas2D engine with deterministic time-stepped simulation
  // =========================================================================

  const SANS_FONT = "'Helvetica Neue', 'Inter', 'Liberation Sans', 'FreeSans', system-ui, sans-serif";
  const MONO_FONT = "'JetBrains Mono', 'SF Mono', 'Liberation Mono', 'DejaVu Sans Mono', ui-monospace, monospace";

  const TOTAL_CAPTURE_FRAMES = 900; // 15.00s @ 60fps
  const CAPTURE_FPS = 60;

  // Deterministic PRNG (Mulberry32)
  function createRng(seed) {
    let s = seed | 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Fast deterministic integer hash -> [0, 1)
  function hash2(a, b, seed) {
    let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(e0, e1, x) {
    const u = clamp((x - e0) / (e1 - e0), 0, 1);
    return u * u * (3 - 2 * u);
  }

  function rgbStr(r, g, b, a = 1) {
    if (a >= 0.999) return `rgb(${r | 0},${g | 0},${b | 0})`;
    return `rgba(${r | 0},${g | 0},${b | 0},${a.toFixed(3)})`;
  }

  function samplePalette(stops, t) {
    const u = clamp(t, 0, 1) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(u));
    const f = u - i;
    const a = stops[i];
    const b = stops[i + 1];
    return [
      Math.round(a[0] + (b[0] - a[0]) * f),
      Math.round(a[1] + (b[1] - a[1]) * f),
      Math.round(a[2] + (b[2] - a[2]) * f),
    ];
  }

  // =========================================================================
  // PRESET DEFINITIONS (Keys 1 - 4)
  // =========================================================================
  const PRESETS = [
    {
      id: 0,
      key: '1',
      name: 'FORMATION',
      code: 'M-01 // GRAPHITE-BONE',
      cellSize: 18,
      gap: 2,
      bg: [7, 8, 10],
      bgHex: '#07080a',
      // Graphite -> cool slate -> silver -> warm bone
      stops: [
        [16, 18, 22],
        [30, 34, 41],
        [52, 58, 68],
        [84, 91, 103],
        [124, 130, 140],
        [170, 173, 176],
        [214, 211, 202],
        [244, 239, 228],
      ],
      accent: [236, 230, 216],
      scanColor: [246, 241, 230],
      scanGlow: 'rgba(235, 230, 218, 0.22)',
      uiPrimary: 'rgba(238, 235, 228, 0.92)',
      uiMuted: 'rgba(155, 162, 174, 0.56)',
      uiHairline: 'rgba(210, 215, 224, 0.16)',
      scanSpeed: 0.44,       // slow luminous scanline
      scanDirection: 'down',
      rowJitterAmp: 1.0,
      rowSpringK: 42,
      rowDamp: 7.5,
      tileReturnSpeed: 5.2,  // tiles crawl back smoothly
      flickerHz: 9,
      edgeSpawnRate: 1.0,
      bloomAlpha: 0,
      persistence: 0,        // no phosphor trail
      contrastPow: 0.96,
      lightKey: [-0.62, 0.56, 0.55],
      lightRim: [0.80, 0.26, -0.54],
      rimBoost: 0.52,
      quantLevels: 14,
      noiseFloorColor: [24, 27, 33],
    },
    {
      id: 1,
      key: '2',
      name: 'CLINICAL',
      code: 'M-02 // CRYO-SCAN',
      cellSize: 14,
      gap: 1.5,
      bg: [4, 9, 14],
      bgHex: '#04090e',
      // Deep abyssal navy -> cold steel -> surgical cyan -> hospital ice-white
      stops: [
        [8, 20, 31],
        [14, 42, 62],
        [22, 76, 106],
        [36, 126, 162],
        [62, 182, 214],
        [124, 222, 242],
        [198, 244, 252],
        [242, 252, 255],
      ],
      accent: [72, 224, 250],
      scanColor: [165, 248, 255],
      scanGlow: 'rgba(56, 217, 245, 0.28)',
      uiPrimary: 'rgba(218, 247, 255, 0.94)',
      uiMuted: 'rgba(116, 178, 198, 0.58)',
      uiHairline: 'rgba(72, 224, 250, 0.20)',
      scanSpeed: 0.62,
      scanDirection: 'dual', // crisp horizontal + vertical diagnostic sweep
      rowJitterAmp: 0.72,
      rowSpringK: 95,        // surgical snap-back
      rowDamp: 12.0,
      tileReturnSpeed: 10.5, // snaps back sharply
      flickerHz: 15,
      edgeSpawnRate: 0.95,
      bloomAlpha: 0.10,
      persistence: 0,
      contrastPow: 0.88,
      lightKey: [-0.46, 0.44, 0.77], // colder clinical wrap light
      lightRim: [0.85, 0.36, -0.38],
      rimBoost: 0.72,
      quantLevels: 16,
      noiseFloorColor: [12, 32, 46],
    },
    {
      id: 2,
      key: '3',
      name: 'PHOSPHOR',
      code: 'M-03 // AMBER-P1 TUBE',
      cellSize: 18,
      gap: 2,
      bg: [9, 6, 3],
      bgHex: '#090603',
      // Smoked umber -> warm copper -> calibrated amber -> incandescent pale gold
      stops: [
        [24, 15, 6],
        [52, 30, 10],
        [96, 52, 14],
        [152, 84, 18],
        [208, 126, 26],
        [246, 172, 54],
        [255, 214, 118],
        [255, 244, 204],
      ],
      accent: [255, 184, 64],
      secondaryTint: [82, 218, 134], // faint residual phosphor green
      scanColor: [255, 220, 128],
      scanGlow: 'rgba(245, 162, 36, 0.30)',
      uiPrimary: 'rgba(255, 218, 146, 0.92)',
      uiMuted: 'rgba(182, 142, 86, 0.58)',
      uiHairline: 'rgba(245, 170, 56, 0.18)',
      scanSpeed: 0.34,       // slower calibrated tube sweep
      scanDirection: 'down',
      rowJitterAmp: 1.15,
      rowSpringK: 26,        // slower heavier row slides
      rowDamp: 4.8,
      tileReturnSpeed: 3.8,
      flickerHz: 5,          // slower quantizer refresh
      edgeSpawnRate: 1.15,
      bloomAlpha: 0.28,      // softer warm numeral bloom
      persistence: 0.74,     // lingering phosphor afterimage
      contrastPow: 0.92,
      lightKey: [-0.66, 0.50, 0.56],
      lightRim: [0.76, 0.24, -0.60],
      rimBoost: 0.58,
      quantLevels: 14,
      noiseFloorColor: [28, 22, 14],
    },
    {
      id: 3,
      key: '4',
      name: 'FRACTURE',
      code: 'M-04 // SHEAR-STITCH',
      cellSize: 16,
      gap: 2,
      bg: [6, 6, 7],
      bgHex: '#060607',
      // Stark carbon -> gunmetal -> high-contrast stark chalk white
      stops: [
        [14, 14, 16],
        [28, 29, 33],
        [58, 60, 66],
        [102, 105, 112],
        [154, 157, 164],
        [204, 206, 212],
        [238, 239, 242],
        [255, 255, 255],
      ],
      accent: [255, 68, 48], // piercing signal vermilion on fracture energy
      scanColor: [255, 86, 62],
      scanGlow: 'rgba(255, 68, 48, 0.34)',
      uiPrimary: 'rgba(248, 248, 250, 0.95)',
      uiMuted: 'rgba(162, 164, 174, 0.60)',
      uiHairline: 'rgba(255, 76, 54, 0.26)',
      scanSpeed: 0.76,       // aggressive stitching sweep
      scanDirection: 'down',
      rowJitterAmp: 2.35,    // violent band jitter
      rowSpringK: 64,
      rowDamp: 5.4,
      tileReturnSpeed: 4.5,
      flickerHz: 22,
      edgeSpawnRate: 2.4,    // heavy tile swarm dispersion
      bloomAlpha: 0.14,
      persistence: 0.24,
      contrastPow: 0.78,     // stark contrast
      lightKey: [-0.70, 0.54, 0.47],
      lightRim: [0.86, 0.22, -0.46],
      rimBoost: 0.85,
      quantLevels: 12,
      noiseFloorColor: [24, 20, 22],
    },
  ];

  // =========================================================================
  // ORIGINAL 3D PROCEDURAL SCULPTURAL BUST SDF
  // Abstract modernist anatomical head, neck, clavicles & shoulders
  // Zero photographs, zero external data, pure implicit 3D geometry
  // =========================================================================

  function smin(a, b, k) {
    const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
    return b * (1 - h) + a * h - k * h * (1 - h);
  }

  function smax(a, b, k) {
    return -smin(-a, -b, k);
  }

  function sdEllipsoid(px, py, pz, rx, ry, rz) {
    const x0 = px / rx, y0 = py / ry, z0 = pz / rz;
    const k0 = Math.sqrt(x0 * x0 + y0 * y0 + z0 * z0);
    if (k0 < 1e-6) return -Math.min(rx, ry, rz);
    const x1 = x0 / rx, y1 = y0 / ry, z1 = z0 / rz;
    const k1 = Math.sqrt(x1 * x1 + y1 * y1 + z1 * z1);
    return (k0 * (k0 - 1.0)) / k1;
  }

  function sdCapsule(px, py, pz, ax, ay, az, bx, by, bz, r) {
    const pax = px - ax, pay = py - ay, paz = pz - az;
    const bax = bx - ax, bay = by - ay, baz = bz - az;
    const denom = bax * bax + bay * bay + baz * baz;
    const h = clamp((pax * bax + pay * bay + paz * baz) / denom, 0, 1);
    const dx = pax - bax * h;
    const dy = pay - bay * h;
    const dz = paz - baz * h;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
  }

  function sdTaperedCapsule(px, py, pz, ax, ay, az, bx, by, bz, ra, rb) {
    const pax = px - ax, pay = py - ay, paz = pz - az;
    const bax = bx - ax, bay = by - ay, baz = bz - az;
    const denom = bax * bax + bay * bay + baz * baz;
    const h = clamp((pax * bax + pay * bay + paz * baz) / denom, 0, 1);
    const dx = pax - bax * h;
    const dy = pay - bay * h;
    const dz = paz - baz * h;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * h);
  }

  // Evaluate signed distance of the original sculptural bust in local bust space
  function sdBust(x, y, z, headPitchCos, headPitchSin) {
    // Subtle living head articulation above neck pivot (y = -0.35)
    let hx = x;
    let hy = y;
    let hz = z;
    if (y > -0.45) {
      const w = smoothstep(-0.45, -0.10, y);
      const dy = y + 0.35;
      const dz = z + 0.04;
      const ry = dy * headPitchCos - dz * headPitchSin - 0.35;
      const rz = dy * headPitchSin + dz * headPitchCos - 0.04;
      hy = y + (ry - y) * w;
      hz = z + (rz - z) * w;
    }

    const ax = Math.abs(hx);

    // 1. Cranium dome + facial mask + sculpted jaw
    let dHead = sdEllipsoid(hx, hy - 0.30, hz + 0.05, 0.43, 0.46, 0.49);
    const dFace = sdEllipsoid(hx, hy - 0.02, hz - 0.05, 0.35, 0.42, 0.41);
    dHead = smin(dHead, dFace, 0.14);

    // Chin prominence
    const dChin = sdEllipsoid(hx, hy + 0.37, hz - 0.25, 0.125, 0.115, 0.135);
    dHead = smin(dHead, dChin, 0.13);

    // Cheekbones (zygomatic arches)
    const dCheek = sdEllipsoid(ax - 0.255, hy - 0.035, hz - 0.21, 0.145, 0.105, 0.165);
    dHead = smin(dHead, dCheek, 0.11);

    // Sculpted jaw angle (mandible corner)
    const dJaw = sdEllipsoid(ax - 0.255, hy + 0.21, hz - 0.03, 0.12, 0.12, 0.14);
    dHead = smin(dHead, dJaw, 0.12);

    // Subtle temple plane hollows (architectural carving)
    const dTemple = sdEllipsoid(ax - 0.41, hy - 0.24, hz - 0.12, 0.12, 0.16, 0.16);
    dHead = smax(dHead, -dTemple, 0.09);

    // Subtle cheek-hollow under zygomatic arch for chiaroscuro drama
    const dHollow = sdEllipsoid(ax - 0.28, hy + 0.15, hz - 0.23, 0.11, 0.10, 0.11);
    dHead = smax(dHead, -dHollow, 0.09);

    // 2. Prominent brow ridge & deep-set orbital sockets
    const browArchY = 0.195 - 0.025 * clamp((ax - 0.08) * 3.5, 0, 1);
    const dBrow = sdCapsule(ax, hy, hz, 0.0, 0.188, 0.365, 0.245, browArchY, 0.30, 0.062);
    dHead = smin(dHead, dBrow, 0.065);

    // Orbital eye socket cavities
    const dSocket = sdEllipsoid(ax - 0.158, hy - 0.088, hz - 0.385, 0.115, 0.072, 0.118);
    dHead = smax(dHead, -dSocket, 0.055);

    // Subtle sculptural eye dome / upper eyelid inside socket
    const dEye = sdEllipsoid(ax - 0.155, hy - 0.086, hz - 0.312, 0.072, 0.044, 0.064);
    dHead = smin(dHead, dEye, 0.022);

    // 3. Chiseled nose bridge, tip & alar wings
    const dNoseBridge = sdTaperedCapsule(hx, hy, hz, 0.0, 0.175, 0.372, 0.0, -0.052, 0.478, 0.042, 0.052);
    const dNoseTip = sdEllipsoid(hx, hy + 0.068, hz - 0.462, 0.054, 0.040, 0.052);
    const dNoseWing = sdEllipsoid(ax - 0.052, hy + 0.082, hz - 0.408, 0.038, 0.030, 0.040);
    const dNose = smin(smin(dNoseBridge, dNoseTip, 0.032), dNoseWing, 0.032);
    dHead = smin(dHead, dNose, 0.042);

    // Sub-nasal philtrum shadow
    const dSubNose = sdEllipsoid(hx, hy + 0.128, hz - 0.432, 0.075, 0.036, 0.048);
    dHead = smax(dHead, -dSubNose, 0.028);

    // 4. Sculpted lips & mouth parting
    const lipCurveZ = 0.378 - ax * ax * 1.45;
    const dUpperLip = sdCapsule(ax, hy, hz, 0.0, -0.184, 0.392, 0.105, -0.194, 0.348, 0.034);
    const dLowerLip = sdCapsule(ax, hy, hz, 0.0, -0.238, 0.388, 0.088, -0.232, 0.348, 0.038);
    dHead = smin(dHead, dUpperLip, 0.028);
    dHead = smin(dHead, dLowerLip, 0.032);

    // Mouth crease
    const dMouthCut = sdCapsule(ax, hy, hz, 0.0, -0.212, lipCurveZ + 0.036, 0.112, -0.210, 0.358, 0.015);
    dHead = smax(dHead, -dMouthCut, 0.014);

    // Labiomental hollow (above chin)
    const dChinCrease = sdEllipsoid(hx, hy + 0.295, hz - 0.385, 0.105, 0.042, 0.058);
    dHead = smax(dHead, -dChinCrease, 0.032);

    // 5. Minimal abstract sculptural ears
    const dEar = sdEllipsoid(ax - 0.425, hy - 0.035, hz + 0.055, 0.048, 0.135, 0.080);
    dHead = smin(dHead, dEar, 0.045);

    // 6. Neck column + sternocleidomastoid V-muscles
    const dNeck = sdTaperedCapsule(x, y, z, 0.0, -0.32, -0.055, 0.0, -0.80, -0.075, 0.198, 0.228);
    const dSCM = sdCapsule(Math.abs(x), y, z, 0.175, -0.36, -0.05, 0.055, -0.76, 0.145, 0.062);
    let dTorso = smin(dNeck, dSCM, 0.06);

    // Clavicles (collarbone ridges)
    const dClav = sdTaperedCapsule(Math.abs(x), y, z, 0.085, -0.755, 0.145, 0.56, -0.795, -0.02, 0.068, 0.082);
    dTorso = smin(dTorso, dClav, 0.075);

    // Trapezius slope & broad architectural shoulders
    const dTrap = sdCapsule(Math.abs(x), y, z, 0.16, -0.60, -0.09, 0.62, -0.86, -0.10, 0.14);
    const dShoulders = sdEllipsoid(x, y + 1.04, z + 0.09, 0.88, 0.38, 0.33);
    dTorso = smin(dTorso, dTrap, 0.11);
    dTorso = smin(dTorso, dShoulders, 0.14);

    // Suprasternal hollow (throat notch)
    const dNotch = sdEllipsoid(x, y + 0.745, z - 0.195, 0.085, 0.062, 0.085);
    dTorso = smax(dTorso, -dNotch, 0.045);

    // Combine head & torso cleanly
    let d = smin(dHead, dTorso, 0.075);

    // Clean sculptural museum-bust cut (curved arch along chest & tapered shoulders)
    const bustBottomCut = (-1.20 + 0.14 * x * x) - y;
    d = smax(d, bustBottomCut, 0.055);

    // Clean back-cut plane so bust has architectural depth
    const backCut = -z - 0.62;
    d = smax(d, backCut, 0.08);

    return d;
  }

  // =========================================================================
  // NUMERAL SPRITE ATLAS (Razor-sharp 00..99 in quantized palette inks)
  // =========================================================================
  function buildNumeralAtlas(preset) {
    const levels = preset.quantLevels + 3; // extra slots for bright accent / scanline / green phosphor
    const cell = preset.cellSize;
    const drawSize = Math.max(8, Math.floor(cell - preset.gap));
    const fontSize = Math.max(7, Math.round(drawSize * 0.56));
    const canvas = document.createElement('canvas');
    canvas.width = 100 * drawSize;
    canvas.height = levels * drawSize;
    const ctx = canvas.getContext('2d');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${fontSize}px ${MONO_FONT}`;

    const inkColors = [];
    for (let lv = 0; lv < preset.quantLevels; lv++) {
      const t = lv / (preset.quantLevels - 1);
      const base = samplePalette(preset.stops, t);
      // Tinted with tile color, shifted lighter for dark/mid tiles and dark-etched on ultra-bright speculars
      let r, g, b, a;
      if (t > 0.84) {
        r = Math.round(base[0] * 0.24);
        g = Math.round(base[1] * 0.26);
        b = Math.round(base[2] * 0.28);
        a = 0.88;
      } else {
        const lift = 0.42 + (1 - t) * 0.22;
        r = Math.min(255, Math.round(base[0] + (255 - base[0]) * lift));
        g = Math.min(255, Math.round(base[1] + (255 - base[1]) * lift));
        b = Math.min(255, Math.round(base[2] + (255 - base[2]) * lift));
        a = 0.58 + t * 0.34;
      }
      inkColors.push(rgbStr(r, g, b, a));
    }
    // Special slot: accent highlight ink
    inkColors.push(rgbStr(preset.accent[0], preset.accent[1], preset.accent[2], 0.96));
    // Special slot: bright scanline ink
    inkColors.push(rgbStr(preset.scanColor[0], preset.scanColor[1], preset.scanColor[2], 0.98));
    // Special slot: secondary tint (residual phosphor green or crisp dark)
    if (preset.secondaryTint) {
      inkColors.push(rgbStr(preset.secondaryTint[0], preset.secondaryTint[1], preset.secondaryTint[2], 0.86));
    } else {
      inkColors.push(rgbStr(preset.bg[0], preset.bg[1], preset.bg[2], 0.90));
    }

    for (let lv = 0; lv < levels; lv++) {
      ctx.fillStyle = inkColors[lv];
      const cy = lv * drawSize + drawSize * 0.54;
      for (let n = 0; n < 100; n++) {
        const txt = n < 10 ? '0' + n : String(n);
        ctx.fillText(txt, n * drawSize + drawSize * 0.5, cy);
      }
    }

    return {
      canvas,
      drawSize,
      accentSlot: preset.quantLevels,
      scanSlot: preset.quantLevels + 1,
      altSlot: preset.quantLevels + 2,
    };
  }

  // =========================================================================
  // DETERMINISTIC CAPTURE TIMELINE (15.0s = 900 frames @ 60fps)
  // =========================================================================
  function getScriptedState(frameIndex, W, H) {
    const t = frameIndex / CAPTURE_FPS;

    // Preset schedule:
    // 0.0 - 3.5s:  FORMATION (0)
    // 3.5 - 7.0s:  CLINICAL  (1)
    // 7.0 - 11.0s: PHOSPHOR  (2)
    // 11.0 - 15.0s: FRACTURE (3)
    let presetIdx = 0;
    if (t >= 11.0) presetIdx = 3;
    else if (t >= 7.0) presetIdx = 2;
    else if (t >= 3.5) presetIdx = 1;

    // Scripted pointer path (normalized coords -> pixel coords)
    let px = W * 0.5;
    let py = H * 0.5;
    let pointerActive = false;

    if (t >= 2.05 && t < 3.45) {
      // FORMATION: pointer glides in across cheek & brow, locally unraveling tiles
      pointerActive = true;
      const u = (t - 2.05) / 1.40;
      const e = smoothstep(0, 1, u);
      px = W * (0.37 + 0.25 * e + 0.03 * Math.sin(u * Math.PI * 2.2));
      py = H * (0.32 + 0.19 * Math.sin(u * Math.PI * 0.95) + 0.05 * u);
    } else if (t >= 4.25 && t < 6.85) {
      // CLINICAL: sharp cross-face diagnostic sweep
      pointerActive = true;
      const u = (t - 4.25) / 2.60;
      const e = smoothstep(0, 1, u);
      px = W * (0.58 - 0.22 * Math.sin(e * Math.PI * 1.15) + 0.08 * Math.cos(e * Math.PI * 2.0));
      py = H * (0.34 + 0.32 * e);
    } else if (t >= 8.45 && t < 10.85) {
      // PHOSPHOR: slow fluid arc around cheekbone, jaw & shoulder
      pointerActive = true;
      const u = (t - 8.45) / 2.40;
      const angle = -0.7 + u * 2.45;
      px = W * (0.50 + 0.14 * Math.cos(angle));
      py = H * (0.52 + 0.20 * Math.sin(angle));
    } else if (t >= 11.20 && t < 13.40) {
      // FRACTURE: rapid turbulent whip stirring a tile swarm
      pointerActive = true;
      const u = (t - 11.20) / 2.20;
      px = W * (0.39 + 0.22 * (0.5 + 0.5 * Math.sin(u * Math.PI * 2.6)));
      py = H * (0.36 + 0.28 * u + 0.06 * Math.cos(u * Math.PI * 3.5));
    }

    // Scripted click/pulse frames (exact frame triggers)
    let pulse = null;
    if (frameIndex === 261) {
      // 4.35s CLINICAL hard scan pulse on cheek/temple
      pulse = { x: W * 0.54, y: H * 0.40 };
    } else if (frameIndex === 516) {
      // 8.60s PHOSPHOR warm amber pulse near center-left bust
      pulse = { x: W * 0.46, y: H * 0.46 };
    } else if (frameIndex === 711) {
      // 11.85s FRACTURE violent burst tearing silhouette
      pulse = { x: W * 0.51, y: H * 0.44 };
    }

    return { t, presetIdx, px, py, pointerActive, pulse };
  }

  // =========================================================================
  // MAIN MOSAIC ENGINE
  // =========================================================================
  class MosaicEngine {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.W = 1920;
      this.H = 1080;

      // Offscreen trail buffer for PHOSPHOR / FRACTURE afterimage
      this.trailCanvas = document.createElement('canvas');
      this.trailCtx = this.trailCanvas.getContext('2d', { alpha: false });

      this.atlases = PRESETS.map((p) => buildNumeralAtlas(p));
      this.presetIdx = 0;
      this.preset = PRESETS[0];

      // Simulation state
      this.rng = createRng(40921847);
      this.time = 0;
      this.presetTime = 0;
      this.frameCount = 0;
      this.lastCaptureFrame = -1;

      // Pointer state (live or scripted)
      this.pointer = {
        x: 960,
        y: 540,
        vx: 0,
        vy: 0,
        active: false,
        energy: 0,
      };

      // Active shockwaves / click pulses
      this.pulses = [];
      // Detached dispersing square tiles
      this.particles = [];
      this.maxParticles = 420;

      // Scanline state
      this.scanY = -0.05;     // normalized 0..1
      this.scanX = -0.05;     // used by CLINICAL dual scan
      this.prevScanY = -0.05;

      // Grid buffers (allocated per preset cellSize & canvas dimensions)
      this.cols = 0;
      this.rows = 0;
      this.allocGrid();
      this.reset();
    }

    resize(w, h) {
      const nw = Math.max(640, Math.round(w));
      const nh = Math.max(360, Math.round(h));
      if (nw === this.W && nh === this.H && this.canvas.width === nw && this.canvas.height === nh) {
        return;
      }
      this.W = nw;
      this.H = nh;
      this.canvas.width = nw;
      this.canvas.height = nh;
      this.trailCanvas.width = nw;
      this.trailCanvas.height = nh;
      this.allocGrid();
      this.clearTrail();
    }

    clearTrail() {
      const bg = this.preset.bgHex;
      this.trailCtx.fillStyle = bg;
      this.trailCtx.fillRect(0, 0, this.W, this.H);
    }

    allocGrid() {
      const cell = this.preset.cellSize;
      this.cols = Math.ceil(this.W / cell) + 2;
      this.rows = Math.ceil(this.H / cell) + 2;
      const n = this.cols * this.rows;

      // Per-tile 3D raymarch outputs
      this.tileHit = new Uint8Array(n);
      this.tileEdge = new Uint8Array(n);
      this.tileLuma = new Float32Array(n);
      this.tileFresnel = new Float32Array(n);
      this.tileNormalX = new Float32Array(n);
      this.tileNormalY = new Float32Array(n);
      this.tileDepth = new Float32Array(n);

      // Per-tile dynamic disturbance offsets & scramble energy
      this.tileOffX = new Float32Array(n);
      this.tileOffY = new Float32Array(n);
      this.tileVelX = new Float32Array(n);
      this.tileVelY = new Float32Array(n);
      this.tileScramble = new Float32Array(n);
      this.tileScale = new Float32Array(n);
      this.tileScale.fill(1);

      // Per-row displacement & lock state
      this.rowLock = new Float32Array(this.rows);
      this.rowDispX = new Float32Array(this.rows);
      this.rowVelX = new Float32Array(this.rows);
      this.rowBandSeed = new Float32Array(this.rows);
      this.rowBandSign = new Float32Array(this.rows);
      this.rowGlitch = new Float32Array(this.rows);

      this.initRowBands();
    }

    initRowBands() {
      // Architectural multi-row horizontal bands (2..6 rows thick)
      let r = 0;
      let bandId = 0;
      while (r < this.rows) {
        const thickness = 2 + Math.floor(hash2(bandId, 17, 913) * 5);
        const dir = hash2(bandId, 43, 913) > 0.5 ? 1 : -1;
        const mag = 0.35 + hash2(bandId, 71, 913) * 0.85;
        for (let k = 0; k < thickness && r < this.rows; k++, r++) {
          this.rowBandSign[r] = dir;
          this.rowBandSeed[r] = mag * (0.85 + 0.30 * hash2(r, bandId, 307));
        }
        bandId++;
      }
    }

    reset() {
      this.rng = createRng(40921847);
      this.time = 0;
      this.presetTime = 0;
      this.frameCount = 0;
      this.lastCaptureFrame = -1;
      this.presetIdx = 0;
      this.preset = PRESETS[0];
      this.allocGrid();
      this.pulses = [];
      this.particles = [];
      this.pointer.active = false;
      this.pointer.energy = 0;
      this.pointer.vx = 0;
      this.pointer.vy = 0;

      // Start in unmistakable chaotic noise state for FORMATION resolve
      this.scanY = 0.02;
      this.prevScanY = 0.0;
      this.scanX = 0.0;
      for (let r = 0; r < this.rows; r++) {
        this.rowLock[r] = 0.02;
        const bandShift = this.rowBandSign[r] * this.rowBandSeed[r] * 210;
        this.rowDispX[r] = bandShift;
        this.rowVelX[r] = -bandShift * 0.25;
        this.rowGlitch[r] = 1.0;
      }
      this.tileOffX.fill(0);
      this.tileOffY.fill(0);
      this.tileVelX.fill(0);
      this.tileVelY.fill(0);
      this.tileScramble.fill(1.0);
      this.tileScale.fill(1.0);
      this.clearTrail();
    }

    setPreset(idx, preserveLock = false) {
      const nextIdx = clamp(idx | 0, 0, PRESETS.length - 1);
      const prevCell = this.preset.cellSize;
      this.presetIdx = nextIdx;
      this.preset = PRESETS[nextIdx];
      this.presetTime = 0;

      if (this.preset.cellSize !== prevCell) {
        this.allocGrid();
      }
      this.clearTrail();

      // Mode-specific theatrical entry beat
      if (nextIdx === 0) {
        // FORMATION: full noise-to-bust resolution
        this.scanY = 0.02;
        this.prevScanY = 0.0;
        for (let r = 0; r < this.rows; r++) {
          this.rowLock[r] = preserveLock ? 0.25 : 0.02;
          this.rowDispX[r] = this.rowBandSign[r] * this.rowBandSeed[r] * (preserveLock ? 130 : 210);
          this.rowVelX[r] = 0;
          this.rowGlitch[r] = 1.0;
        }
        this.tileScramble.fill(preserveLock ? 0.65 : 1.0);
      } else if (nextIdx === 1) {
        // CLINICAL: crisp diagnostic sweep
        this.scanY = 0.05;
        this.prevScanY = 0.04;
        this.scanX = 0.12;
        for (let r = 0; r < this.rows; r++) {
          this.rowLock[r] = 0.55;
          this.rowDispX[r] = this.rowBandSign[r] * this.rowBandSeed[r] * 48;
          this.rowVelX[r] = 0;
          this.rowGlitch[r] = 0.55;
        }
        this.tileScramble.fill(0.45);
      } else if (nextIdx === 2) {
        // PHOSPHOR: warm tube sweep with slow row slide
        this.scanY = 0.08;
        this.prevScanY = 0.07;
        for (let r = 0; r < this.rows; r++) {
          this.rowLock[r] = 0.68;
          this.rowDispX[r] = this.rowBandSign[r] * this.rowBandSeed[r] * 84;
          this.rowVelX[r] = this.rowBandSign[r] * 28;
          this.rowGlitch[r] = 0.45;
        }
        this.tileScramble.fill(0.32);
      } else if (nextIdx === 3) {
        // FRACTURE: violent immediate destabilization before scanline restitch
        this.scanY = -0.10;
        this.prevScanY = -0.10;
        for (let r = 0; r < this.rows; r++) {
          this.rowLock[r] = 0.32;
          this.rowDispX[r] = this.rowBandSign[r] * this.rowBandSeed[r] * 175;
          this.rowVelX[r] = this.rowBandSign[r] * (120 + this.rowBandSeed[r] * 90);
          this.rowGlitch[r] = 1.0;
        }
        this.tileScramble.fill(0.85);
      }
    }

    setPointer(x, y, active) {
      if (active) {
        if (this.pointer.active) {
          this.pointer.vx = (x - this.pointer.x) * 60;
          this.pointer.vy = (y - this.pointer.y) * 60;
        } else {
          this.pointer.vx = 0;
          this.pointer.vy = 0;
        }
        this.pointer.x = x;
        this.pointer.y = y;
        this.pointer.active = true;
      } else {
        this.pointer.active = false;
        this.pointer.vx *= 0.8;
        this.pointer.vy *= 0.8;
      }
    }

    triggerPulse(x, y) {
      const p = this.preset;
      const strength = this.presetIdx === 3 ? 1.55 : this.presetIdx === 1 ? 1.25 : 1.05;
      this.pulses.push({
        x,
        y,
        radius: 12,
        speed: this.presetIdx === 1 ? 920 : this.presetIdx === 3 ? 860 : 640,
        maxRadius: Math.hypot(this.W, this.H) * 0.65,
        strength,
        age: 0,
      });

      // Row horizontal shock at pulse Y
      const cell = p.cellSize;
      const centerRow = Math.floor(y / cell);
      for (let r = 0; r < this.rows; r++) {
        const dr = Math.abs(r - centerRow);
        if (dr < 14) {
          const w = (1 - dr / 14) * strength;
          this.rowVelX[r] += this.rowBandSign[r] * (220 + this.rowBandSeed[r] * 180) * w;
          this.rowGlitch[r] = Math.min(1, this.rowGlitch[r] + 0.85 * w);
          if (this.presetIdx === 3) {
            this.rowLock[r] = Math.max(0.12, this.rowLock[r] - 0.55 * w);
          }
        }
      }

      // Immediate burst of dispersing numbered square tiles from the pulse origin
      const burstCount = this.presetIdx === 3 ? 52 : 30;
      for (let i = 0; i < burstCount; i++) {
        const ang = (i / burstCount) * Math.PI * 2 + (this.rng() - 0.5) * 0.4;
        const spd = (110 + this.rng() * 340) * strength;
        this.spawnParticle(
          x + Math.cos(ang) * (8 + this.rng() * 36),
          y + Math.sin(ang) * (8 + this.rng() * 36),
          Math.cos(ang) * spd,
          Math.sin(ang) * spd,
          0.55 + this.rng() * 0.45,
          Math.floor(this.rng() * 100),
          true
        );
      }
    }

    spawnParticle(x, y, vx, vy, luma, digit, isAccent = false) {
      if (this.particles.length >= this.maxParticles) {
        // Recycle oldest particle deterministically
        this.particles.shift();
      }
      const p = this.preset;
      this.particles.push({
        x,
        y,
        vx,
        vy,
        size: (p.cellSize - p.gap) * (0.78 + this.rng() * 0.34),
        life: 0,
        maxLife: (this.presetIdx === 2 ? 1.15 : this.presetIdx === 3 ? 0.95 : 0.78) * (0.65 + this.rng() * 0.65),
        luma,
        digit,
        isAccent,
        flickerPhase: this.rng() * 100,
      });
    }

    // Raymarch the 3D sculptural bust onto the current mosaic grid
    evaluateBustField() {
      const W = this.W;
      const H = this.H;
      const p = this.preset;
      const cell = p.cellSize;
      const cols = this.cols;
      const rows = this.rows;

      // Living sculptural motion: gentle three-quarter turn + subtle breath
      const t = this.time;
      const baseYaw = -0.27;
      const yaw = baseYaw + Math.sin(t * 0.52) * 0.11 + (this.presetIdx === 3 ? Math.sin(t * 2.4) * 0.03 : 0);
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);

      const headPitch = 0.03 + Math.sin(t * 0.85) * 0.025;
      const cosP = Math.cos(headPitch);
      const sinP = Math.sin(headPitch);

      // Subtle breathing lift
      const breathY = Math.sin(t * 0.95) * 0.015;

      // Dynamic key & rim lighting (subtle living catch-light drift)
      const lkBase = p.lightKey;
      const lAngle = Math.sin(t * 0.65) * 0.18;
      const cL = Math.cos(lAngle), sL = Math.sin(lAngle);
      let lkx = lkBase[0] * cL - lkBase[2] * sL;
      let lky = lkBase[1];
      let lkz = lkBase[0] * sL + lkBase[2] * cL;
      const lkLen = Math.hypot(lkx, lky, lkz);
      lkx /= lkLen; lky /= lkLen; lkz /= lkLen;

      const lr = p.lightRim;
      const lrLen = Math.hypot(lr[0], lr[1], lr[2]);
      const lrx = lr[0] / lrLen, lry = lr[1] / lrLen, lrz = lr[2] / lrLen;

      // Camera parameters (telephoto portrait framing)
      const camX = 0;
      const camY = -0.19 + breathY;
      const camZ = 2.95;
      const focal = 2.46;
      const invHalfH = 2.0 / H;
      const halfW = W * 0.5;
      const halfH = H * 0.5;

      // Bounding screen window around bust for speed
      const minCol = Math.max(0, Math.floor((W * 0.22) / cell));
      const maxCol = Math.min(cols - 1, Math.ceil((W * 0.78) / cell));
      const minRow = Math.max(0, Math.floor((H * 0.04) / cell));
      const maxRow = Math.min(rows - 1, Math.ceil((H * 0.96) / cell));

      this.tileHit.fill(0);
      this.tileEdge.fill(0);

      for (let r = minRow; r <= maxRow; r++) {
        const sy = (r + 0.5) * cell;
        const ndcY = (halfH - sy) * invHalfH;

        for (let c = minCol; c <= maxCol; c++) {
          const sx = (c + 0.5) * cell;
          const ndcX = (sx - halfW) * invHalfH;

          // Ray direction in world space
          let rdx = ndcX;
          let rdy = ndcY;
          let rdz = -focal;
          const rLen = Math.hypot(rdx, rdy, rdz);
          rdx /= rLen; rdy /= rLen; rdz /= rLen;

          // Coarse bounding-sphere reject centered at (0, -0.22, 0), radius 1.25
          const ocx = camX;
          const ocy = camY + 0.22;
          const ocz = camZ;
          const bDot = ocx * rdx + ocy * rdy + ocz * rdz;
          const cDot = ocx * ocx + ocy * ocy + ocz * ocz - 1.58;
          const disc = bDot * bDot - cDot;
          if (disc < 0) continue;

          const sqrtDisc = Math.sqrt(disc);
          let dist = Math.max(1.2, -bDot - sqrtDisc);
          const maxDist = Math.min(4.8, -bDot + sqrtDisc);

          let hit = false;
          let lx = 0, ly = 0, lz = 0;

          for (let step = 0; step < 26; step++) {
            const wx = camX + rdx * dist;
            const wy = camY + rdy * dist;
            const wz = camZ + rdz * dist;

            // Rotate into local bust space (yaw around Y)
            lx = wx * cosY + wz * sinY;
            ly = wy;
            lz = -wx * sinY + wz * cosY;

            const d = sdBust(lx, ly, lz, cosP, sinP);
            if (d < 0.0045) {
              hit = true;
              break;
            }
            dist += d * 0.92;
            if (dist > maxDist) break;
          }

          if (!hit) continue;

          const idx = r * cols + c;
          this.tileHit[idx] = 1;
          this.tileDepth[idx] = clamp((3.5 - dist) / 1.5, 0, 1);

          // Tetrahedron 4-tap normal in local bust space
          const eps = 0.0075;
          const d1 = sdBust(lx + eps, ly - eps, lz - eps, cosP, sinP);
          const d2 = sdBust(lx - eps, ly - eps, lz + eps, cosP, sinP);
          const d3 = sdBust(lx - eps, ly + eps, lz - eps, cosP, sinP);
          const d4 = sdBust(lx + eps, ly + eps, lz + eps, cosP, sinP);
          let nxL = d1 - d2 - d3 + d4;
          let nyL = -d1 - d2 + d3 + d4;
          let nzL = -d1 + d2 - d3 + d4;
          const nLen = Math.hypot(nxL, nyL, nzL) || 1;
          nxL /= nLen; nyL /= nLen; nzL /= nLen;

          // Rotate normal back to world space
          const nx = nxL * cosY - nzL * sinY;
          const ny = nyL;
          const nz = nxL * sinY + nzL * cosY;

          this.tileNormalX[idx] = nx;
          this.tileNormalY[idx] = ny;

          // View vector (toward camera)
          const vx = -rdx, vy = -rdy, vz = -rdz;
          const ndv = clamp(nx * vx + ny * vy + nz * vz, 0, 1);
          const fresnel = Math.pow(1 - ndv, 2.15);
          this.tileFresnel[idx] = fresnel;

          // Cavity AO via 1 offset SDF sample
          const aoSample = sdBust(lx + nxL * 0.075, ly + nyL * 0.075, lz + nzL * 0.075, cosP, sinP);
          const ao = clamp(aoSample / 0.075, 0.22, 1.0);

      // Chiaroscuro sculptural shading (rich midtones, prevents flat highlight clipping)
          const diffKey = clamp(nx * lkx + ny * lky + nz * lkz, 0, 1);
          const diffKeyShaped = Math.pow(diffKey, 1.18);

          // Half-vector specular catch-light on cheekbones, brow, nose bridge & clavicles
          let hxV = lkx + vx, hyV = lky + vy, hzV = lkz + vz;
          const hLen = Math.hypot(hxV, hyV, hzV) || 1;
          const spec = Math.pow(clamp((nx * hxV + ny * hyV + nz * hzV) / hLen, 0, 1), 26) * 0.28;

          // Rim light along opposite contour
          const rimRaw = clamp(nx * lrx + ny * lry + nz * lrz, 0, 1);
          const rim = rimRaw * fresnel * (p.rimBoost * 0.88) + fresnel * 0.14;

          // Subtle fill bounce so dark sculptural side retains structure
          const fill = clamp(nx * 0.2 + ny * -0.35 + nz * 0.9, 0, 1) * 0.12;

          // Subtle vertical falloff on lower shoulders so head/face remains the focal luminosity
          const torsoAtten = 1.0 - smoothstep(-0.62, -1.22, ly) * 0.16;

          let luma = (0.05 + diffKeyShaped * 0.65 + fill + spec) * (0.36 + 0.64 * ao) * torsoAtten + rim;
          luma = Math.pow(clamp(luma, 0.02, 0.985), p.contrastPow);
          this.tileLuma[idx] = luma;
        }
      }

      // Identify crisp silhouette boundary tiles (bust tiles adjacent to background)
      for (let r = minRow; r <= maxRow; r++) {
        const rowOff = r * cols;
        for (let c = minCol; c <= maxCol; c++) {
          const idx = rowOff + c;
          if (!this.tileHit[idx]) continue;
          const border =
            (c > 0 && !this.tileHit[idx - 1]) ||
            (c < cols - 1 && !this.tileHit[idx + 1]) ||
            (r > 0 && !this.tileHit[idx - cols]) ||
            (r < rows - 1 && !this.tileHit[idx + cols]);
          if (border || this.tileFresnel[idx] > 0.58) {
            this.tileEdge[idx] = border ? 2 : 1;
          }
        }
      }
    }

    // Advance deterministic simulation by fixed dt
    step(dt) {
      const p = this.preset;
      const cell = p.cellSize;
      const W = this.W;
      const H = this.H;

      this.time += dt;
      this.presetTime += dt;
      this.frameCount++;

      // 1. Evaluate 3D sculptural bust field for this frame
      this.evaluateBustField();

      // 2. Advance scanline(s)
      this.prevScanY = this.scanY;
      if (this.presetIdx === 3) {
        // FRACTURE choreography: chaotic jitter first (~1.75s), then fast stitching sweep
        if (this.presetTime < 1.65) {
          this.scanY = (this.presetTime * 1.15) % 1.15 - 0.05;
        } else if (this.presetTime < 3.25) {
          // Forceful restitch sweep top-to-bottom
          this.scanY = lerp(-0.04, 1.06, clamp((this.presetTime - 1.65) / 1.50, 0, 1));
        } else {
          // Brief dramatic hold at bottom / gentle parking
          this.scanY = 1.08;
        }
      } else {
        this.scanY += p.scanSpeed * dt;
        if (this.scanY > 1.14) {
          this.scanY = -0.10;
          this.prevScanY = -0.10;
        }
      }
      if (p.scanDirection === 'dual') {
        this.scanX += p.scanSpeed * 0.72 * dt;
        if (this.scanX > 1.12) this.scanX = -0.08;
      }

      const scanYPx = this.scanY * H;
      const scanXPx = this.scanX * W;

      // 3. Update row locks, band displacement springs, and scanline beat
      const isFractureChaos = this.presetIdx === 3 && this.presetTime < 1.70;
      const isFractureHold = this.presetIdx === 3 && this.presetTime >= 3.15;

      for (let r = 0; r < this.rows; r++) {
        const rowY = (r + 0.5) * cell;
        const rowNorm = rowY / H;

        // Did scanline pass or come near this row?
        const distScan = Math.abs(rowY - scanYPx);
        const nearScan = distScan < 56;
        const justCrossed =
          (this.prevScanY <= rowNorm && this.scanY >= rowNorm) ||
          distScan < cell * 0.85;

        if (justCrossed && this.scanY > 0.0 && this.scanY < 1.02) {
          // Structural scanline beat: row snaps/jitters briefly then locks hard
          const kick = (this.presetIdx === 3 ? 65 : this.presetIdx === 2 ? 42 : 34) * p.rowJitterAmp;
          this.rowVelX[r] += this.rowBandSign[r] * this.rowBandSeed[r] * kick * (0.6 + 0.8 * this.rng());
          this.rowGlitch[r] = Math.min(1, this.rowGlitch[r] + 0.78);
        }

        // Row lock progression
        if (this.presetIdx === 0) {
          // FORMATION: rows stay noisy ahead of scanline, lock smoothly behind it
          if (rowNorm < this.scanY + 0.02 || this.presetTime > 2.35) {
            this.rowLock[r] = Math.min(1, this.rowLock[r] + dt * 2.25);
          } else {
            this.rowLock[r] = Math.min(0.16, this.rowLock[r] + dt * 0.05);
          }
        } else if (this.presetIdx === 1) {
          // CLINICAL: fast crisp lock
          const rate = rowNorm < this.scanY + 0.04 ? 4.5 : 1.4;
          this.rowLock[r] = Math.min(1, this.rowLock[r] + dt * rate);
        } else if (this.presetIdx === 2) {
          // PHOSPHOR: smooth organic lock with periodic gentle band drift
          this.rowLock[r] = Math.min(1, this.rowLock[r] + dt * 1.45);
        } else {
          // FRACTURE: tears apart during chaos window, then scanline stitches hard!
          if (isFractureChaos) {
            const target = 0.25 + 0.20 * Math.sin(this.time * 5.0 + r * 0.35);
            this.rowLock[r] = lerp(this.rowLock[r], target, dt * 3.5);
          } else if (rowNorm < this.scanY + 0.03 || isFractureHold) {
            this.rowLock[r] = Math.min(1, this.rowLock[r] + dt * 5.2);
          }
        }

        // Target band displacement (zero when locked, architectural band shift when unlocked or slipping)
        const unlocked = 1 - this.rowLock[r];
        const baseBandShift = this.rowBandSign[r] * this.rowBandSeed[r] * unlocked * (this.presetIdx === 3 ? 210 : 195);

        // Ongoing living band-slip modulation (prevents static card feel even when resolved)
        let slip = 0;
        const bandPhase = this.time * (this.presetIdx === 2 ? 1.3 : this.presetIdx === 3 ? 6.8 : 2.1) + r * 0.19;
        if (this.presetIdx === 0) {
          const wave = Math.sin(bandPhase) * Math.sin(bandPhase * 0.37 + this.rowBandSeed[r] * 6);
          if (Math.abs(wave) > 0.72) slip = this.rowBandSign[r] * (Math.abs(wave) - 0.72) * 34;
        } else if (this.presetIdx === 1) {
          const gate = hash2(Math.floor(r / 3), Math.floor(this.time * 6), 511);
          if (gate > 0.90) slip = this.rowBandSign[r] * (gate - 0.90) * 160;
        } else if (this.presetIdx === 2) {
          slip = Math.sin(this.time * 1.55 + Math.floor(r / 4) * 1.1) * 14 * this.rowBandSeed[r];
        } else if (!isFractureHold) {
          const gate = hash2(Math.floor(r / 2), Math.floor(this.time * 14), 777);
          const burst = isFractureChaos ? 1.0 : Math.max(0, 1 - this.rowLock[r]) * 1.4;
          if (gate > 0.56) {
            slip = this.rowBandSign[r] * (gate - 0.56) * 260 * burst;
          }
        }

        // Pointer sympathetic row shear
        if (this.pointer.active) {
          const dyP = Math.abs(rowY - this.pointer.y);
          if (dyP < 120) {
            const wP = (1 - dyP / 120);
            const shear = clamp(this.pointer.vx * 0.06, -42, 42) + this.rowBandSign[r] * 26 * wP;
            this.rowVelX[r] += shear * wP * dt * 16;
            this.rowGlitch[r] = Math.min(1, this.rowGlitch[r] + wP * dt * 3.8);
          }
        }

        // Damped spring toward target displacement
        const targetX = baseBandShift + slip;
        const force = (targetX - this.rowDispX[r]) * p.rowSpringK;
        this.rowVelX[r] += force * dt;
        this.rowVelX[r] *= Math.exp(-p.rowDamp * dt);
        this.rowDispX[r] += this.rowVelX[r] * dt;

        // Glitch energy decay
        const glitchDecay = nearScan ? 1.5 : 3.2;
        this.rowGlitch[r] = Math.max(0, this.rowGlitch[r] - dt * glitchDecay);
      }

      // 4. Advance expanding shockwave pulses
      for (let i = this.pulses.length - 1; i >= 0; i--) {
        const pulse = this.pulses[i];
        pulse.age += dt;
        pulse.radius += pulse.speed * dt;
        if (pulse.radius > pulse.maxRadius) {
          this.pulses.splice(i, 1);
        }
      }

      // 5. Update per-tile disturbance (pointer scatter, pulse wave, recovery, & edge particle spawning)
      this.pointer.energy = lerp(this.pointer.energy, this.pointer.active ? 1 : 0, dt * 8);
      const pointerRad = this.presetIdx === 3 ? 165 : this.presetIdx === 1 ? 125 : 145;
      const pointerRadSq = pointerRad * pointerRad;
      const retSpd = p.tileReturnSpeed;

      for (let r = 0; r < this.rows; r++) {
        const baseY = (r + 0.5) * cell;
        const rowShift = this.rowDispX[r];
        const distScanY = Math.abs(baseY - scanYPx);
        const onScanline = distScanY < cell * 1.4 && this.scanY > 0 && this.scanY < 1.02;
        const rowOff = r * this.cols;

        for (let c = 0; c < this.cols; c++) {
          const idx = rowOff + c;
          const isHit = this.tileHit[idx] === 1;
          const baseX = (c + 0.5) * cell + rowShift;

          // Pointer disturbance
          if (this.pointer.active && isHit) {
            const dx = baseX - this.pointer.x;
            const dy = baseY - this.pointer.y;
            const dSq = dx * dx + dy * dy;
            if (dSq < pointerRadSq) {
              const d = Math.sqrt(dSq) || 1;
              const falloff = 1 - d / pointerRad;
              const push = falloff * falloff * (this.presetIdx === 3 ? 980 : 640);
              // Radial repel + swirl + cursor drag
              const nx = dx / d;
              const ny = dy / d;
              this.tileVelX[idx] += (nx * push - ny * push * 0.25 + this.pointer.vx * 0.45 * falloff) * dt;
              this.tileVelY[idx] += (ny * push + nx * push * 0.25 + this.pointer.vy * 0.45 * falloff) * dt;
              this.tileScramble[idx] = Math.min(1, this.tileScramble[idx] + falloff * dt * 8.0);
              this.tileScale[idx] = Math.min(this.tileScale[idx], 1 - falloff * 0.36);

              // Spawn peeling numbered tile off pointer edge
              if (falloff > 0.35 && this.rng() < 0.055 * p.edgeSpawnRate) {
                const digit = Math.floor(this.tileLuma[idx] * 99);
                this.spawnParticle(
                  baseX + this.tileOffX[idx],
                  baseY + this.tileOffY[idx],
                  nx * (90 + this.rng() * 190) + this.pointer.vx * 0.22,
                  ny * (90 + this.rng() * 190) + this.pointer.vy * 0.22,
                  this.tileLuma[idx],
                  digit,
                  this.presetIdx === 3 || this.presetIdx === 1
                );
              }
            }
          }

          // Pulse shockwave disturbance
          if (isHit && this.pulses.length > 0) {
            for (let k = 0; k < this.pulses.length; k++) {
              const pl = this.pulses[k];
              const dx = baseX - pl.x;
              const dy = baseY - pl.y;
              const d = Math.hypot(dx, dy) || 1;
              const band = Math.abs(d - pl.radius);
              if (band < 48) {
                const w = (1 - band / 48) * pl.strength * (1 - pl.radius / pl.maxRadius);
                this.tileVelX[idx] += (dx / d) * 820 * w * dt;
                this.tileVelY[idx] += (dy / d) * 820 * w * dt;
                this.tileScramble[idx] = Math.min(1, this.tileScramble[idx] + w * 0.95);
              }
            }
          }

          // Fracture aggressive tile swarm disturbance
          if (isHit && isFractureChaos && this.tileEdge[idx] > 0) {
            const nx = this.tileNormalX[idx];
            const ny = -this.tileNormalY[idx];
            const jitter = (this.rng() - 0.4) * 320;
            this.tileVelX[idx] += (nx * 190 + this.rowBandSign[r] * 120 + jitter) * dt;
            this.tileVelY[idx] += (ny * 140 + (this.rng() - 0.5) * 180) * dt;
            this.tileScramble[idx] = Math.min(1, this.tileScramble[idx] + dt * 2.5);
          }

          // Spring-back recovery to grid cell
          const ox = this.tileOffX[idx];
          const oy = this.tileOffY[idx];
          if (ox !== 0 || oy !== 0 || this.tileVelX[idx] !== 0 || this.tileVelY[idx] !== 0) {
            const springMult = isFractureHold ? 2.4 : 1.0;
            this.tileVelX[idx] += -ox * retSpd * 4.5 * springMult * dt;
            this.tileVelY[idx] += -oy * retSpd * 4.5 * springMult * dt;
            const damp = Math.exp(-retSpd * 1.45 * springMult * dt);
            this.tileVelX[idx] *= damp;
            this.tileVelY[idx] *= damp;
            this.tileOffX[idx] += this.tileVelX[idx] * dt;
            this.tileOffY[idx] += this.tileVelY[idx] * dt;
            if (Math.abs(this.tileOffX[idx]) < 0.05 && Math.abs(this.tileVelX[idx]) < 0.2) {
              this.tileOffX[idx] = 0;
              this.tileVelX[idx] = 0;
            }
            if (Math.abs(this.tileOffY[idx]) < 0.05 && Math.abs(this.tileVelY[idx]) < 0.2) {
              this.tileOffY[idx] = 0;
              this.tileVelY[idx] = 0;
            }
          }

          // Recover scale & scramble
          this.tileScale[idx] = lerp(this.tileScale[idx], 1.0, clamp(dt * retSpd * 1.1, 0, 1));
          const targetScramble = 1 - this.rowLock[r];
          if (onScanline) {
            this.tileScramble[idx] = Math.min(1, Math.max(this.tileScramble[idx], 0.85));
          } else {
            this.tileScramble[idx] = lerp(this.tileScramble[idx], targetScramble, clamp(dt * 3.8, 0, 1));
          }

          // Edge dispersion spawning along silhouette & scanline
          if (isHit && (this.tileEdge[idx] === 2 || (onScanline && this.tileEdge[idx] >= 1))) {
            let spawnProb = 0.022 * p.edgeSpawnRate;
            if (onScanline) spawnProb *= 5.2;
            if (isFractureChaos) spawnProb *= 2.6;
            if (isFractureHold) spawnProb *= 0.22;
            if (this.rng() < spawnProb) {
              const outX = this.tileNormalX[idx] || this.rowBandSign[r];
              const outY = -this.tileNormalY[idx];
              const spd = (44 + this.rng() * 125) * (isFractureChaos ? 2.0 : 1.0);
              const vx = outX * spd + this.rowVelX[r] * 0.28 + (this.rng() - 0.5) * 32;
              const vy = outY * spd * 0.7 + (this.presetIdx === 2 ? -22 : (this.rng() - 0.5) * 34);
              const digit = Math.floor(this.tileLuma[idx] * 99);
              this.spawnParticle(
                baseX + this.tileOffX[idx],
                baseY + this.tileOffY[idx],
                vx,
                vy,
                this.tileLuma[idx],
                digit,
                onScanline || (this.presetIdx === 3 && this.rng() < 0.52)
              );
            }
          }
        }
      }

      // 6. Update detached edge-dispersion square tiles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const pt = this.particles[i];
        pt.life += dt;
        if (pt.life >= pt.maxLife) {
          this.particles.splice(i, 1);
          continue;
        }
        // Subtle architectural drift + drag
        const drag = Math.exp(-(this.presetIdx === 2 ? 1.1 : 2.1) * dt);
        pt.vx *= drag;
        pt.vy *= drag;
        if (this.presetIdx === 3 && !isFractureHold) {
          // Subtle lateral shear turbulence in FRACTURE
          pt.vx += Math.sin(this.time * 12 + pt.flickerPhase) * 85 * dt;
        }
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
      }

      // Decay pointer velocity slightly
      this.pointer.vx *= 0.88;
      this.pointer.vy *= 0.88;
    }

    // =========================================================================
    // DRAW FRAME
    // =========================================================================
    draw() {
      const ctx = this.ctx;
      const W = this.W;
      const H = this.H;
      const p = this.preset;
      const atlas = this.atlases[this.presetIdx];
      const cell = p.cellSize;
      const drawSize = atlas.drawSize;
      const halfDraw = drawSize * 0.5;

      // 1. Background / Phosphor persistence buffer
      if (p.persistence > 0) {
        // Fade previous frame gently into trail buffer
        this.trailCtx.fillStyle = rgbStr(p.bg[0], p.bg[1], p.bg[2], 1 - p.persistence);
        this.trailCtx.fillRect(0, 0, W, H);
        ctx.drawImage(this.trailCanvas, 0, 0);
      } else {
        ctx.fillStyle = p.bgHex;
        ctx.fillRect(0, 0, W, H);
      }

      // Subtle dark atmospheric radial vignette behind the bust (pure architectural depth)
      const vig = ctx.createRadialGradient(W * 0.5, H * 0.48, H * 0.08, W * 0.5, H * 0.50, W * 0.56);
      if (this.presetIdx === 1) {
        vig.addColorStop(0, 'rgba(18, 52, 74, 0.22)');
      } else if (this.presetIdx === 2) {
        vig.addColorStop(0, 'rgba(62, 34, 10, 0.22)');
      } else if (this.presetIdx === 3) {
        vig.addColorStop(0, 'rgba(42, 16, 16, 0.16)');
      } else {
        vig.addColorStop(0, 'rgba(34, 38, 46, 0.18)');
      }
      vig.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      const scanYPx = this.scanY * H;
      const scanXPx = this.scanX * W;
      const flickerTick = Math.floor(this.time * p.flickerHz);
      const fastTick = Math.floor(this.time * (p.flickerHz * 2.6));
      const quantLevels = p.quantLevels;

      // 2. Render subtle background architectural matrix tiles (only near scanline, noise, or bust halo)
      const cols = this.cols;
      const rows = this.rows;
      const bgFloor = p.noiseFloorColor;

      for (let r = 0; r < rows; r++) {
        const cy = (r + 0.5) * cell;
        const rowShift = this.rowDispX[r];
        const lock = this.rowLock[r];
        const distScanY = Math.abs(cy - scanYPx);
        const scanBand = Math.max(0, 1 - distScanY / 78);
        const unlocked = 1 - lock;
        const rowOff = r * cols;

        for (let c = 0; c < cols; c++) {
          const idx = rowOff + c;
          if (this.tileHit[idx]) continue;

          // Determine if a background data-noise cell should show here
          const hCell = hash2(c, r, 101);
          const cx = (c + 0.5) * cell + rowShift;
          // Distance from portrait center
          const nx = (cx - W * 0.5) / (W * 0.34);
          const ny = (cy - H * 0.50) / (H * 0.44);
          const radial = Math.hypot(nx, ny);

          // Show chaotic scattered tiles during unresolved noise, near scanline, or faintly in matrix halo
          let showAlpha = 0;
          if (unlocked > 0.15 && radial < 1.38) {
            const noiseMask = hash2(c, r, 33 + Math.floor(this.time * 4));
            if (noiseMask > 0.42 + lock * 0.45) {
              showAlpha = unlocked * (1 - radial / 1.45) * 0.72;
            }
          }
          if (scanBand > 0.08 && radial < 1.42 && hCell > 0.32) {
            showAlpha = Math.max(showAlpha, scanBand * 0.44 * (1 - radial / 1.55));
          }
          if (radial < 1.15 && hCell > 0.86) {
            showAlpha = Math.max(showAlpha, 0.14 * (1 - radial / 1.25));
          }

          if (showAlpha <= 0.03) continue;

          const x0 = Math.round(cx - halfDraw);
          const y0 = Math.round(cy - halfDraw);
          if (x0 < -cell || x0 > W + cell) continue;

          const nLuma = hash2(c, r, 211 + (unlocked > 0.3 ? fastTick : flickerTick));
          const col = samplePalette(p.stops, nLuma * 0.42 * showAlpha + (scanBand > 0.55 ? 0.18 : 0));
          ctx.fillStyle = rgbStr(
            lerp(bgFloor[0], col[0], 0.75),
            lerp(bgFloor[1], col[1], 0.75),
            lerp(bgFloor[2], col[2], 0.75),
            clamp(showAlpha * 1.15, 0, 0.92)
          );
          ctx.fillRect(x0, y0, drawSize, drawSize);

          // Number on active noise / scanline background cells
          if (showAlpha > 0.22) {
            const digit = Math.floor(hash2(c, r, 509 + fastTick) * 100);
            const slot = scanBand > 0.65 ? atlas.scanSlot : Math.min(quantLevels - 1, Math.floor(nLuma * 4));
            ctx.globalAlpha = clamp(showAlpha * 0.9, 0.15, 0.78);
            ctx.drawImage(
              atlas.canvas,
              digit * drawSize,
              slot * drawSize,
              drawSize,
              drawSize,
              x0,
              y0,
              drawSize,
              drawSize
            );
            ctx.globalAlpha = 1;
          }
        }
      }

      // 3. Render the Pixel-Mosaic Portrait Bust Tiles + Two-Digit Numerals
      for (let r = 0; r < rows; r++) {
        const baseY = (r + 0.5) * cell;
        const rowShift = this.rowDispX[r];
        const lock = this.rowLock[r];
        const glitch = this.rowGlitch[r];
        const distScanY = Math.abs(baseY - scanYPx);
        const scanProx = Math.max(0, 1 - distScanY / (cell * 2.6));
        const rowOff = r * cols;

        for (let c = 0; c < cols; c++) {
          const idx = rowOff + c;
          if (!this.tileHit[idx]) continue;

          const ox = this.tileOffX[idx];
          const oy = this.tileOffY[idx];
          const scramble = this.tileScramble[idx];
          const scale = this.tileScale[idx];

          // When heavily unresolved, drop out some tiles sporadically so the bust builds out of sparse data
          if (lock < 0.35) {
            const gate = hash2(c, r, 733 + Math.floor(this.time * 5));
            if (gate > 0.42 + lock * 1.65) continue;
          }

          let px = (c + 0.5) * cell + rowShift + ox;
          let py = baseY + oy;

          // Subtle micro-jitter on active scanline or high fracture glitch
          if (scanProx > 0.4 || glitch > 0.45) {
            const jh = (hash2(c, r, 919 + fastTick) - 0.5) * 2;
            px += jh * (scanProx * 5.5 + glitch * (this.presetIdx === 3 ? 11 : 4));
          }

          // Quantize luminance into architectural steps
          let luma = this.tileLuma[idx];
          // During unresolved/scrambled state, blend true luminance with quantized noise
          if (scramble > 0.08) {
            const nl = hash2(c, r, 401 + fastTick);
            luma = lerp(luma, nl * 0.85, scramble * 0.72);
          }

          // Scanline highlight boost
          let isScanAccent = false;
          if (scanProx > 0.55) {
            luma = Math.min(1, luma + scanProx * 0.28);
            if (scanProx > 0.82 && hash2(c, r, 811 + fastTick) > 0.45) {
              isScanAccent = true;
            }
          }
          // Dual vertical scanline highlight in CLINICAL
          if (p.scanDirection === 'dual') {
            const distScanX = Math.abs(px - scanXPx);
            if (distScanX < cell * 1.6) {
              const sxW = 1 - distScanX / (cell * 1.6);
              luma = Math.min(1, luma + sxW * 0.26);
              if (sxW > 0.72) isScanAccent = true;
            }
          }

          // Discreet high-velocity vermilion flash in FRACTURE
          const dispSpeed = Math.hypot(ox, oy);
          const isFractureFlare =
            this.presetIdx === 3 &&
            (dispSpeed > 18 || (glitch > 0.65 && this.tileEdge[idx] > 0 && hash2(c, r, 613 + fastTick) > 0.62));

          // Phosphor faint residual P1-green tint (confined softly to outer silhouette & trailing slides)
          const isPhosphorGreen =
            this.presetIdx === 2 &&
            (this.tileEdge[idx] === 2 || Math.abs(rowShift) > 14) &&
            hash2(c, r, 419 + flickerTick) > 0.80;

          const qStep = clamp(Math.floor(luma * (quantLevels - 0.001)), 0, quantLevels - 1);
          const qLuma = qStep / (quantLevels - 1);

          let tileColor;
          if (isFractureFlare) {
            tileColor = rgbStr(p.accent[0], p.accent[1], p.accent[2], 0.96);
          } else if (isScanAccent) {
            const sc = p.scanColor;
            tileColor = rgbStr(sc[0], sc[1], sc[2], 0.95);
          } else if (isPhosphorGreen) {
            const st = p.secondaryTint;
            const baseRgb = samplePalette(p.stops, qLuma);
            tileColor = rgbStr(
              Math.round(lerp(baseRgb[0], st[0] * (0.38 + qLuma * 0.45), 0.52)),
              Math.round(lerp(baseRgb[1], st[1] * (0.38 + qLuma * 0.45), 0.52)),
              Math.round(lerp(baseRgb[2], st[2] * (0.38 + qLuma * 0.45), 0.52)),
              0.92
            );
          } else {
            const rgb = samplePalette(p.stops, qLuma);
            tileColor = rgbStr(rgb[0], rgb[1], rgb[2], 1);
          }

          // Compute two-digit numeral (quantizer settling behavior, not random TV snow)
          const baseDigit = clamp(Math.round(luma * 99), 0, 99);
          let digit = baseDigit;
          if (scramble > 0.16) {
            // Active quantizer searching/cycling
            const cycleHash = hash2(c, r, 701 + fastTick);
            if (cycleHash < scramble) {
              digit = Math.floor(hash2(c, r, 883 + fastTick) * 100);
            }
          } else {
            // Subtle quantized ADC tick (±1..±2 on a sparse staggered cadence)
            const tileCadence = (c * 13 + r * 29) % 19;
            if ((flickerTick + tileCadence) % 11 === 0) {
              const delta = hash2(c, r, 997 + flickerTick) > 0.5 ? 1 : -1;
              digit = clamp(baseDigit + delta, 0, 99);
            }
          }

          // Draw flat architectural square tile
          const sz = Math.max(4, Math.round(drawSize * scale));
          const x0 = Math.round(px - sz * 0.5);
          const y0 = Math.round(py - sz * 0.5);

          ctx.fillStyle = tileColor;
          ctx.fillRect(x0, y0, sz, sz);

          // Draw crisp two-digit numeral from pre-baked atlas
          let slot = qStep;
          if (isFractureFlare) slot = atlas.altSlot;
          else if (isScanAccent) slot = atlas.altSlot;
          else if (isPhosphorGreen) slot = atlas.altSlot;

          if (sz === drawSize) {
            ctx.drawImage(
              atlas.canvas,
              digit * drawSize,
              slot * drawSize,
              drawSize,
              drawSize,
              x0,
              y0,
              drawSize,
              drawSize
            );
          } else if (sz >= 7) {
            ctx.drawImage(
              atlas.canvas,
              digit * drawSize,
              slot * drawSize,
              drawSize,
              drawSize,
              x0,
              y0,
              sz,
              sz
            );
          }
        }
      }

      // 4. Phosphor soft numeral/highlight bloom pass (additive low-alpha glow)
      if (p.bloomAlpha > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = p.bloomAlpha;
        // Subtle glow along the scanline band
        const grad = ctx.createLinearGradient(0, scanYPx - 54, 0, scanYPx + 54);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.5, rgbStr(p.accent[0], p.accent[1], p.accent[2], 0.55));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(W * 0.14, scanYPx - 54, W * 0.72, 108);
        ctx.restore();
      }

      // 5. Render Edge-Dispersion Numbered Square Particles
      for (let i = 0; i < this.particles.length; i++) {
        const pt = this.particles[i];
        const prog = pt.life / pt.maxLife;
        const alpha = Math.pow(1 - prog, 1.35);
        const curSize = Math.max(3, Math.round(pt.size * (1 - prog * 0.62)));
        const x0 = Math.round(pt.x - curSize * 0.5);
        const y0 = Math.round(pt.y - curSize * 0.5);

        let rgb;
        if (pt.isAccent) {
          rgb = p.accent;
        } else if (this.presetIdx === 2 && (i % 4 === 0)) {
          rgb = p.secondaryTint;
        } else {
          rgb = samplePalette(p.stops, clamp(pt.luma + 0.12, 0.15, 0.95));
        }

        ctx.fillStyle = rgbStr(rgb[0], rgb[1], rgb[2], alpha * 0.92);
        ctx.fillRect(x0, y0, curSize, curSize);

        // Flickering 2-digit number inside peeling square particles
        if (curSize >= 8 && alpha > 0.22) {
          const pDigit = (pt.digit + Math.floor(this.time * 14 + pt.flickerPhase)) % 100;
          const slot = pt.isAccent ? atlas.altSlot : Math.min(quantLevels - 1, Math.floor(pt.luma * quantLevels));
          ctx.globalAlpha = alpha * 0.92;
          ctx.drawImage(
            atlas.canvas,
            pDigit * drawSize,
            slot * drawSize,
            drawSize,
            drawSize,
            x0,
            y0,
            curSize,
            curSize
          );
          ctx.globalAlpha = 1;
        }
      }

      // 6. Save frame to trail buffer (before crisp scanline & UI overlay so UI never smears!)
      if (p.persistence > 0) {
        this.trailCtx.drawImage(this.canvas, 0, 0);
      }

      // 7. Render Active Scanline(s) & Click Shockwave Rings
      this.drawScanlines(ctx, W, H, scanYPx, scanXPx);
      this.drawPulses(ctx);
      this.drawPointerReticle(ctx);

      // 8. Render Quiet-Luxury Architectural Typography Frame
      this.drawTypography(ctx, W, H);
    }

    drawScanlines(ctx, W, H, scanYPx, scanXPx) {
      const p = this.preset;
      const sc = p.scanColor;

      if (this.scanY > -0.02 && this.scanY < 1.03) {
        const y = Math.round(scanYPx) + 0.5;
        // Soft directional wake behind scanline
        const wakeH = this.presetIdx === 2 ? 72 : this.presetIdx === 3 ? 48 : 56;
        const grad = ctx.createLinearGradient(0, y - wakeH, 0, y + 14);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.82, p.scanGlow);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(W * 0.16, y - wakeH, W * 0.68, wakeH + 14);

        // Razor-sharp horizontal scanline core (kept clear of corner typography)
        const lineGrad = ctx.createLinearGradient(W * 0.18, 0, W * 0.82, 0);
        lineGrad.addColorStop(0, rgbStr(sc[0], sc[1], sc[2], 0));
        lineGrad.addColorStop(0.15, rgbStr(sc[0], sc[1], sc[2], 0.72));
        lineGrad.addColorStop(0.5, rgbStr(sc[0], sc[1], sc[2], 0.96));
        lineGrad.addColorStop(0.85, rgbStr(sc[0], sc[1], sc[2], 0.72));
        lineGrad.addColorStop(1, rgbStr(sc[0], sc[1], sc[2], 0));
        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = this.presetIdx === 3 ? 2 : 1.5;
        ctx.beginPath();
        ctx.moveTo(W * 0.18, y);
        ctx.lineTo(W * 0.82, y);
        ctx.stroke();

        // Small architectural margin index ticks on left/right of scanline (clear of top/bottom UI)
        if (this.scanY > 0.12 && this.scanY < 0.88) {
          ctx.fillStyle = rgbStr(sc[0], sc[1], sc[2], 0.85);
          ctx.fillRect(Math.round(W * 0.178), Math.round(y - 3), 5, 5);
          ctx.fillRect(Math.round(W * 0.822 - 5), Math.round(y - 3), 5, 5);

          ctx.font = `500 10px ${MONO_FONT}`;
          ctx.fillStyle = p.uiMuted;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(`Y.${clamp(this.scanY, 0, 1).toFixed(3)}`, W * 0.171, y);
        }
      }

      // Secondary crisp vertical scanline in CLINICAL
      if (p.scanDirection === 'dual' && this.scanX > 0.10 && this.scanX < 0.90) {
        const x = Math.round(scanXPx) + 0.5;
        const vGrad = ctx.createLinearGradient(0, H * 0.08, 0, H * 0.92);
        vGrad.addColorStop(0, rgbStr(sc[0], sc[1], sc[2], 0));
        vGrad.addColorStop(0.2, rgbStr(sc[0], sc[1], sc[2], 0.45));
        vGrad.addColorStop(0.5, rgbStr(sc[0], sc[1], sc[2], 0.78));
        vGrad.addColorStop(0.8, rgbStr(sc[0], sc[1], sc[2], 0.45));
        vGrad.addColorStop(1, rgbStr(sc[0], sc[1], sc[2], 0));
        ctx.strokeStyle = vGrad;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, H * 0.08);
        ctx.lineTo(x, H * 0.92);
        ctx.stroke();
      }
    }

    drawPulses(ctx) {
      const p = this.preset;
      const ac = p.accent;
      for (let i = 0; i < this.pulses.length; i++) {
        const pl = this.pulses[i];
        const prog = pl.radius / pl.maxRadius;
        const alpha = Math.pow(1 - prog, 1.8) * 0.72;
        if (alpha <= 0.01) continue;

        ctx.save();
        ctx.strokeStyle = rgbStr(ac[0], ac[1], ac[2], alpha);
        ctx.lineWidth = this.presetIdx === 1 ? 1.5 : 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(pl.x, pl.y, pl.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Crisp inner echo ring
        if (pl.radius > 28) {
          ctx.setLineDash([]);
          ctx.strokeStyle = rgbStr(p.scanColor[0], p.scanColor[1], p.scanColor[2], alpha * 0.42);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(pl.x, pl.y, pl.radius - 18, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    drawPointerReticle(ctx) {
      if (this.pointer.energy < 0.05) return;
      const p = this.preset;
      const ac = p.accent;
      const a = this.pointer.energy * 0.78;
      const x = Math.round(this.pointer.x) + 0.5;
      const y = Math.round(this.pointer.y) + 0.5;
      const arm = 12;
      const gap = 5;

      ctx.save();
      ctx.strokeStyle = rgbStr(ac[0], ac[1], ac[2], a);
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(x - arm, y); ctx.lineTo(x - gap, y);
      ctx.moveTo(x + gap, y); ctx.lineTo(x + arm, y);
      ctx.moveTo(x, y - arm); ctx.lineTo(x, y - gap);
      ctx.moveTo(x, y + gap); ctx.lineTo(x, y + arm);
      ctx.stroke();

      // Tiny corner brackets around cursor (discreet optical probe feel)
      const b = 22;
      const t = 5;
      ctx.strokeStyle = rgbStr(ac[0], ac[1], ac[2], a * 0.42);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - b, y - b + t); ctx.lineTo(x - b, y - b); ctx.lineTo(x - b + t, y - b);
      ctx.moveTo(x + b - t, y - b); ctx.lineTo(x + b, y - b); ctx.lineTo(x + b, y - b + t);
      ctx.moveTo(x - b, y + b - t); ctx.lineTo(x - b, y + b); ctx.lineTo(x - b + t, y + b);
      ctx.moveTo(x + b - t, y + b); ctx.lineTo(x + b, y + b); ctx.lineTo(x + b, y + b - t);
      ctx.stroke();
      ctx.restore();
    }

    drawTrackedText(ctx, text, x, y, tracking, align = 'left') {
      const chars = Array.from(text);
      const widths = chars.map((ch) => ctx.measureText(ch).width);
      const totalW = widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, chars.length - 1);
      let cursorX = align === 'right' ? x - totalW : align === 'center' ? x - totalW * 0.5 : x;
      ctx.textAlign = 'left';
      for (let i = 0; i < chars.length; i++) {
        ctx.fillText(chars[i], cursorX, y);
        cursorX += widths[i] + tracking;
      }
    }

    drawTypography(ctx, W, H) {
      const p = this.preset;
      const padX = Math.round(W * 0.032); // ~61px at 1920
      const padY = Math.round(H * 0.046); // ~50px at 1080
      const ac = p.accent;

      ctx.save();

      // Subtle architectural corner registration hairlines (no heavy bezel)
      ctx.strokeStyle = p.uiHairline;
      ctx.lineWidth = 1;
      const tick = 10;
      const m = 24.5;
      ctx.beginPath();
      ctx.moveTo(m, m + tick); ctx.lineTo(m, m); ctx.lineTo(m + tick, m);
      ctx.moveTo(W - m - tick, m); ctx.lineTo(W - m, m); ctx.lineTo(W - m, m + tick);
      ctx.moveTo(m, H - m - tick); ctx.lineTo(m, H - m); ctx.lineTo(m + tick, H - m);
      ctx.moveTo(W - m - tick, H - m); ctx.lineTo(W - m, H - m); ctx.lineTo(W - m, H - m - tick);
      ctx.stroke();

      // ---- TOP-LEFT: Invented Wordmark Lockup (KORVA) ----
      // Minimal 2x2 mosaic aperture emblem
      const markX = padX;
      const markY = padY - 1;
      const ms = 6;
      const mg = 2;
      ctx.fillStyle = p.uiPrimary;
      ctx.fillRect(markX, markY, ms, ms);
      ctx.fillRect(markX + ms + mg, markY + ms + mg, ms, ms);
      ctx.fillStyle = rgbStr(ac[0], ac[1], ac[2], 0.92);
      ctx.fillRect(markX + ms + mg, markY, ms, ms);
      ctx.fillStyle = p.uiHairline;
      ctx.fillRect(markX, markY + ms + mg, ms, ms);

      ctx.textBaseline = 'top';
      ctx.font = `600 20px ${SANS_FONT}`;
      ctx.fillStyle = p.uiPrimary;
      this.drawTrackedText(ctx, 'KORVA', markX + 24, padY - 3, 6.5, 'left');

      ctx.font = `500 10px ${MONO_FONT}`;
      ctx.fillStyle = p.uiMuted;
      this.drawTrackedText(ctx, 'OPTICAL QUANTIZER  //  UNIT 04', markX, padY + 23, 1.4, 'left');

      // ---- TOP-RIGHT: Original Piece Title ----
      ctx.font = `500 13px ${SANS_FONT}`;
      ctx.fillStyle = p.uiPrimary;
      this.drawTrackedText(ctx, 'LATENT RELIEF 04', W - padX, padY, 3.6, 'right');

      ctx.font = `500 10px ${MONO_FONT}`;
      ctx.fillStyle = p.uiMuted;
      this.drawTrackedText(ctx, 'SCULPTURAL FIELD QUANTIZATION', W - padX, padY + 21, 1.3, 'right');

      // Compute concise live telemetry for bottom-left
      let lockSum = 0;
      let maxShift = 0;
      for (let r = 0; r < this.rows; r++) {
        lockSum += this.rowLock[r];
        const a = Math.abs(this.rowDispX[r]);
        if (a > maxShift) maxShift = a;
      }
      const avgLockPct = ((lockSum / this.rows) * 100).toFixed(1).padStart(5, ' ');
      const maxShiftStr = String(Math.round(maxShift)).padStart(3, '0');
      const scanPosStr = clamp(this.scanY, 0, 1).toFixed(3);

      // ---- BOTTOM-LEFT: Active Preset & Telemetry ----
      const botY = H - padY;
      ctx.textBaseline = 'bottom';
      ctx.font = `500 10px ${MONO_FONT}`;
      ctx.fillStyle = p.uiMuted;
      ctx.textAlign = 'left';
      ctx.fillText(
        `SCAN ${scanPosStr}   ·   LOCK ${avgLockPct}%   ·   ΔROW ${maxShiftStr}PX   ·   PITCH ${p.cellSize}PX`,
        padX,
        botY - 22
      );

      // Discreet 1-4 preset selector labels
      let pxCursor = padX;
      for (let i = 0; i < PRESETS.length; i++) {
        const pr = PRESETS[i];
        const active = i === this.presetIdx;
        const label = `0${i + 1} ${pr.name}`;
        ctx.font = active ? `600 11px ${MONO_FONT}` : `500 11px ${MONO_FONT}`;
        ctx.fillStyle = active ? p.uiPrimary : p.uiMuted;
        ctx.textAlign = 'left';
        ctx.fillText(label, pxCursor, botY);
        const lw = ctx.measureText(label).width;
        if (active) {
          ctx.fillStyle = rgbStr(ac[0], ac[1], ac[2], 0.95);
          ctx.fillRect(pxCursor, botY + 4, lw, 1.5);
        }
        pxCursor += lw + 22;
      }

      // ---- BOTTOM-RIGHT: Sparse Technical Specification Block ----
      ctx.textAlign = 'right';
      ctx.font = `500 10px ${MONO_FONT}`;
      ctx.fillStyle = p.uiMuted;
      const gridSpec = `GRID ${this.cols - 2}×${this.rows - 2}   ·   Q-STEP 0.01   ·   ${p.code}`;
      ctx.fillText('Φ(x,y) = ⌊99 · clamp(N·L + R_edge, 0, 1)⌋', W - padX, botY - 28);
      ctx.fillText(gridSpec, W - padX, botY - 14);
      ctx.fillText('POINTER: DISTURB   ·   CLICK: PULSE   ·   KEYS 1–4', W - padX, botY);

      ctx.restore();
    }

    // Deterministic capture hook: render exact frame index (0..TOTAL_CAPTURE_FRAMES-1)
    renderFrame(frameIndex) {
      const target = Math.max(0, Math.floor(frameIndex));
      if (target <= this.lastCaptureFrame || this.lastCaptureFrame < 0) {
        this.reset();
        this.lastCaptureFrame = -1;
      }

      const dt = 1 / CAPTURE_FPS;
      for (let f = this.lastCaptureFrame + 1; f <= target; f++) {
        const st = getScriptedState(f, this.W, this.H);
        if (f > 0 && st.presetIdx !== this.presetIdx) {
          this.setPreset(st.presetIdx);
        }
        this.setPointer(st.px, st.py, st.pointerActive);
        if (st.pulse) {
          this.triggerPulse(st.pulse.x, st.pulse.y);
        }
        this.step(dt);
      }

      this.lastCaptureFrame = target;
      this.draw();
    }

    getInfo() {
      return {
        width: this.W,
        height: this.H,
        cols: this.cols,
        rows: this.rows,
        preset: this.preset.name,
        frameCount: this.frameCount,
        particles: this.particles.length,
        totalCaptureFrames: TOTAL_CAPTURE_FRAMES,
      };
    }
  }

  // =========================================================================
  // BOOTSTRAP (Live Interactive Mode vs Deterministic Capture Mode)
  // =========================================================================
  const canvas = document.getElementById('mosaic-canvas');
  const params = new URLSearchParams(window.location.search);
  const captureMode = params.get('capture') === '1';

  const engine = new MosaicEngine(canvas);

  function syncCanvasSize() {
    if (captureMode) {
      engine.resize(1920, 1080);
    } else {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      engine.resize(Math.round(window.innerWidth * dpr), Math.round(window.innerHeight * dpr));
    }
  }

  syncCanvasSize();

  // Expose deterministic capture & inspection API
  window.__mosaic = {
    renderFrame: (f) => engine.renderFrame(f),
    setPreset: (i) => engine.setPreset(i),
    setPointer: (x, y, a) => engine.setPointer(x, y, a),
    triggerPulse: (x, y) => engine.triggerPulse(x, y),
    reset: () => engine.reset(),
    getInfo: () => engine.getInfo(),
    PRESETS: PRESETS.map((p) => p.name),
  };

  if (!captureMode) {
    window.addEventListener('resize', () => {
      syncCanvasSize();
      engine.draw();
    });

    const toCanvasCoords = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * engine.W,
        y: ((clientY - rect.top) / rect.height) * engine.H,
      };
    };

    canvas.addEventListener('pointermove', (e) => {
      const pt = toCanvasCoords(e.clientX, e.clientY);
      engine.setPointer(pt.x, pt.y, true);
    });

    canvas.addEventListener('pointerleave', () => {
      engine.setPointer(engine.pointer.x, engine.pointer.y, false);
    });

    canvas.addEventListener('pointerdown', (e) => {
      const pt = toCanvasCoords(e.clientX, e.clientY);
      engine.setPointer(pt.x, pt.y, true);
      engine.triggerPulse(pt.x, pt.y);
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === '1') engine.setPreset(0);
      else if (e.key === '2') engine.setPreset(1);
      else if (e.key === '3') engine.setPreset(2);
      else if (e.key === '4') engine.setPreset(3);
      else if (e.key === 'r' || e.key === 'R') engine.setPreset(engine.presetIdx, false);
      else if (e.key === ' ') {
        e.preventDefault();
        engine.triggerPulse(engine.W * 0.5, engine.H * 0.46);
      }
    });

    let lastTs = performance.now();
    const tick = (now) => {
      const dt = clamp((now - lastTs) / 1000, 0.001, 0.05);
      lastTs = now;
      engine.step(dt);
      engine.draw();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
})();
