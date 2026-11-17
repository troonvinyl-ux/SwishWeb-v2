# Cross-browser SWISH camera — 17 November 2026

## Scope and source reference

The target is any supported phone/browser, not a fix tied to one handset. Reviewed the MIT-licensed react-camera-pro implementation at https://github.com/purple-technology/react-camera-pro/blob/master/src/components/Camera/Camera.tsx as an open-source reference for device selection, readiness, framing and stream cleanup. SWISH retains its own shared camera rather than installing a second stream-owning component. No upstream source code was copied and no additional package is required.

This is entirely client-side. Existing SWISH backend binding, accounts, identification services, inventory persistence, original stored evidence, Smart Studio, eBay and Stripe are unchanged. No backend service, AI provider, schema or credential has been added.

## Capture paths

1. Live preview requests the rear camera with preferred 2560 × 1920, 4:3 framing. These are ideal constraints, not a requirement that would exclude lower-resolution devices. Only unsupported constraints or a missing specifically selected camera trigger one fallback request; permission denial and a busy camera do not trigger repeated prompts.
2. The shutter attempts ImageCapture.takePhoto when the actual browser exposes it. Advertised photo dimensions are requested with a 12-megapixel budget and flash off when exposed by the API. Capability queries and still capture have bounded timeouts. Method availability is not treated as successful still support.
3. Unsupported, refused, timed-out or undecodable stills fall back to a snapshot of the video taken at shutter time, not a later frame. A failed still attempt disables that path for the current track. The UI reports the last live photo's source and dimensions instead of claiming that every capture is a high-resolution still.
4. Use device camera opens a separate file input with capture=environment. It stops the browser stream synchronously but leaves the inputs and coin dialog mounted until the picker returns. On supporting phones this delegates focus, zoom and lens handling to the camera app. Other browsers may open a file picker. Library remains a separate action. Cancellation leaves Start live camera available rather than discarding evidence or forcing a new permission request.

## Evidence and focus

- Device-camera and Library files pass directly into the existing onPhoto evidence/review flow without local retouching or mutation of their bytes.
- An uncropped sensor still retains its original bytes and MIME-appropriate file extension. When its aspect ratio differs from the preview, or digital zoom is selected, a centre crop is exported at native resolution or downsampled within the canvas budget. No upscaling, sharpening, enhancement or invented coin detail is applied. This intentional capture crop is not claimed to preserve a separate uncropped sensor original.
- Hardware zoom is accepted only when track settings confirm a finite applied value. A resolved but ignored zoom constraint does not silently become a working zoom indicator. Fallback digital zoom is explicitly relative to the current camera view, which may retain a previous hardware setting.
- Continuous/single-shot focus is requested only when exposed by track capabilities. Continuous autofocus is labelled enabled only when settings confirm it; otherwise the UI says requested or unavailable. This is not universal tap-to-focus, automatic coin detection or a guarantee of macro focus.
- Camera/lens selection shows the cameras the browser actually exposes, including compatible USB microscopes. No inference that the last camera is a macro lens, and no opaque automatic lens switching, is introduced.

## Layout and lifecycle

Rounded matte SWISH surfaces, semantic colour tokens and outline icons are retained. Full-screen capture keeps the viewfinder and shutter in dedicated grid rows; options scroll separately. Both device-camera fallback and lens selection are explicit controls. Photo quality explanations use disclosure to avoid crowding the viewfinder. Short landscape screens have a camera stage and settings rail.

Stream ownership lives in useCameraStream. Tracks are released on stop, close, unmount, visibility changes and pagehide. Generation checks dispose of late getUserMedia results. A closed or replaced track cannot deliver a photo from an older capture. Barcode decoding continues to use that same video stream and pauses during a shutter/file operation. Audio is never requested.

## Verification

Added behavioral mock coverage in scripts/test/camera-portability.test.mjs for constraints, bounded fallback, permission/busy errors, cleanup, still dimensions, sensor byte preservation, shutter-time fallback, digital crops and stale-track rejection. Existing camera regression assertions now follow the extracted stream and photo helpers. The repository workflow already runs scripts/test/*.test.mjs.

The available editor tools cannot run Node, the typecheck, browser tests or a build. These tests are added but unrun in this session; no universal-device verification or production-release claim is made.

Run in the repository/CI:

```sh
node --test scripts/test/camera-portability.test.mjs scripts/test/camera-zoom.test.mjs scripts/test/camera-barcode-numista.test.mjs scripts/test/import-integrity.test.mjs
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

Real-device checks remain required on iOS Safari, Android Chrome/Samsung Internet, desktop Chrome/Edge, and browsers without ImageCapture such as Firefox. Check rear-lens sharpness, preview/still framing at each supported zoom, camera permission denial, picker cancellation, return from the camera app, background/foreground transitions, orientation, barcode decoding and unchanged evidence upload/review. Browser HTTPS and iframe permission policies still apply; OS-camera fallback availability is also browser/device dependent.
