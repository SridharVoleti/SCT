# Shreshta Collections Tryon

Technology by Babysteps. Independent in-store browser virtual mirror for an Android tablet.

## SCT-001 — Live Mirror

This first iteration is intentionally a single static `index.html`. It uses the browser's `getUserMedia` API to display the front camera with horizontal mirroring. It has Start/Stop controls and automatically releases the camera when the page is hidden. It does not upload, record or store camera frames.

## Deploy on Vercel

1. Import `SridharVoleti/SCT` as a new Vercel project.
2. Select **Other** as framework preset; leave build command empty and use repository root as output directory (static HTML).
3. Deploy and open the generated HTTPS URL in Chrome on the Android tablet.
4. Tap **Start Mirror** and grant camera access.
5. Tap **Stop** to release the camera.

HTTPS (or localhost) is required for camera access. Camera permission must be granted by the tablet user. If Chrome blocks access, check site permissions and whether another app is using the camera.

## SCT-001 acceptance checklist

- [ ] Opens over HTTPS on the store Android tablet
- [ ] Requests camera permission only after tapping Start
- [ ] Shows mirrored front-camera video
- [ ] Stop releases camera and restores placeholder
- [ ] Switching browser tabs releases camera
- [ ] Denied permission shows a helpful error
- [ ] No customer video leaves the device

These are manual device acceptance tests and are not yet marked as passed.

## Next iteration

SCT-002: one pair of earrings with live face tracking. Do not add it until SCT-001 is accepted.
