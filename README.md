# KORVA — LATENT RELIEF 04

Original interactive procedural 3D sculptural bust rendered as a flat-tile pixel mosaic with live two-digit quantizer numerals, horizontal band displacement, traveling scanline resolution, edge-tile dispersion, and pointer disturbance.

## Files

- `index.html` — Full-viewport standalone entry point (open directly in any modern browser).
- `mosaic.js` — Pure Canvas2D procedural 3D SDF sculptural bust raymarcher, deterministic simulation engine, numeral sprite atlas, and architectural typography overlay.
- `capture.mjs` — Deterministic zero-dependency headless Chrome (CDP) + `ffmpeg` 1080p60 capture pipeline with subtle original synthesized stereo scan ambience.
- `pixel-mosaic-portrait-scan-1080p60.mp4` — Deterministic 15.0s 1920×1080 60fps H.264 High (`yuv420p`, `+faststart`) capture.
- `stills/` — Extracted QA stills from the encoded MP4.

## Live Controls

- **Keys `1`–`4`** — Switch presets:
  1. **FORMATION** — Cool graphite and bone on black; slow bright scanline locking noisy displaced bands into sculptural relief.
  2. **CLINICAL** — Tighter 14px tiles in surgical cyan, ice, and hospital white with dual-axis diagnostic scanlines.
  3. **PHOSPHOR** — Warm calibrated amber tube with faint residual P1 green, soft bloom, and lingering afterimage trails.
  4. **FRACTURE** — High-contrast monochrome with signal-vermilion fracture flares, violent band shear, and aggressive tile swarm restitching.
- **Pointer / Touch Move** — Locally unravels mosaic tiles, shears intersecting rows, scrambles numerals, and peels numbered tiles into space.
- **Click / Tap** (or **Space**) — Fires a radial shockwave and scan pulse.
- **Key `R`** — Re-triggers noise-to-bust resolution in the current preset.

## Deterministic Capture

```bash
node capture.mjs
```
