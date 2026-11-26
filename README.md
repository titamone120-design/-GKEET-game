# GKEET — Shadow Arena

A standalone mobile-first 3D fighting game. This repository is separate from IMSIYA.

## Play
Open `www/index.html` in a modern browser, or serve `www/` with a static web server.

## Controls
- Mobile: on-screen left/right, jump, punch, kick, special, and guard.
- Double-tap left or right to dash.
- Keyboard: A/D or arrows to move, W/Up/Space to jump, J punch, K kick, L special, H guard, Escape pause.

## Features
- 20 progressively harder rivals with stage-based enemy strength and visual themes.
- Rigged humanoid 3D fighters with skeletal idle, walk, punch, real kick, hook, hit-reaction, jump, dodge and guard animations.
- Health and special-energy bars, combo counter, timer, hit effects, knockback and enemy AI.
- Stage unlocks, wins, sound preference and difficulty saved on the device.
- Offline Android build; Three.js, GLTFLoader, fighter models and animation clips are bundled locally.

## Android APK
Every push to `main` starts the **Build GKEET Android APK** workflow. When it succeeds, open the workflow run on GitHub and download the `GKEET-Android-APK` artifact.

## Google Play preparation
- Read [PLAY_STORE_RELEASE.md](PLAY_STORE_RELEASE.md) for the signed AAB workflow and upload-key setup.
- Read [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for the current offline/local-storage privacy policy.
- The signed AAB workflow targets Android API 36 and requires the four Android upload-signing GitHub secrets listed in the release guide.
- Browser smoke tests check the 3D fighters, animation loading, fight timer, pause/resume state, and 20-stage menu.

A successful CI build is not a substitute for testing on physical Android devices. Verify touch controls, sound, performance, pause/resume, and all stages on real phones before publishing.
