# Coin camera zoom and focus

## Changes
- `/scan/coins` and the Deep ID Lab now mount the shared camera instead of their own unadjustable getUserMedia stream. Coin front/back views use a full-rim guide, a high-resolution rear-camera preference and automatic camera startup.
- Zoom controls remain visible even if browser capabilities omit hardware zoom. Supported hardware zoom uses serialized `applyConstraints` requests; unsupported or refused hardware controls fall back to a clearly labelled 1–4× digital crop.
- Digital zoom uses a centred crop at sensor-frame resolution, never upscale/sharpen/invent coin details. The preview is measured against the sensor aspect ratio and applies the exact same crop as JPEG capture. Hardware zoom is already in the camera stream and is not applied twice.
- Continuous autofocus is requested only when exposed by the camera. Single-shot focus is used when continuous is unavailable. The UI states when focus is device-managed; no claim of browser tap-to-focus, automatic coin detection or CoinSnap-equivalent hardware access is made.
- Slider, +/- buttons and presets are touch-sized. Capture is disabled while hardware zoom or focus is being applied. Switching camera resets settings, ignores stale async completions and stops the previous stream. Closing, unmounting or hiding the page releases camera tracks.
- Camera selection (including USB microscopes), gallery upload, review and existing coin identification/persistence remain intact. No backend changes, new AI provider or cloud provisioning.

## Verification
Regression coverage: `scripts/test/camera-zoom.test.mjs`; run with `node --test scripts/test/camera-zoom.test.mjs scripts/test/camera-barcode-numista.test.mjs`.
Tests have been added but cannot be executed with the file-editing tools available in this session. Real-device verification is still required.

## Device acceptance checks
1. iPhone Safari: open obverse capture, allow camera, confirm the slider appears even without hardware zoom; use 2× and capture. Confirm the resulting photo matches the preview crop, not the unzoomed frame. Move farther away if the phone cannot focus at close distance.
2. Android Chrome: confirm hardware mode only when zoom capabilities are exposed; drag quickly between presets and capture only after adjustments settle. Inspect legends and full rim.
3. Change cameras / USB microscope: zoom resets to supported defaults, focus messaging updates and previous tracks stop.
4. Landscape and small viewports: zoom, capture and close remain reachable; circular guide stays circular and the image is not stretched or clipped by letterboxing.
5. Deny permission, close during camera startup, hide the tab and reopen: no abandoned stream, duplicate camera request or stuck shutter. Gallery remains available.
6. Complete obverse/reverse capture and identification: existing SWISH data and preserved-photo workflow are unchanged.
