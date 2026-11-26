# GKEET — Battle Strike + Classic Fighting

GKEET is a standalone mobile-first game project. It is separate from IMSIYA.

## Game modes
- **Battle Strike** (www/shooter.html): 2D side-view shooter with 20 zones, weapons, enemy squads, waves, pickups, training and mobile touch controls.
- **Classic Fighting** (www/index.html): 3D one-on-one fighter mode with animated characters, stages, combat controls and progression.

## Online rooms — integration status
A dedicated Supabase project is configured for GKEET only. The online lobby client supports:
- Email account sign-up and sign-in.
- Creating a room with a six-character invite code.
- Joining a room by invite code.
- A maximum of six room members.
- Private Realtime room channels and player presence.

**Important:** This is the online room/lobby foundation, not yet completed online multiplayer gameplay. Player movement, aiming, bullets, damage, match start/finish and network reconciliation still need implementation and testing before GKEET can be described as a playable online multiplayer game.

The online lobby uses the GKEET Supabase project and its public publishable key. Never put a Supabase secret/service-role key in the app. The project uses authenticated-only table access and RLS policies. Email confirmation may be required depending on the Supabase Auth settings.

## Play locally
Serve the www/ directory with a static web server and open shooter.html for Battle Strike or index.html for Classic Fighting. Online room features require an internet connection.

## Android APK
Every push to main starts the **Build GKEET Android APK** workflow. When it succeeds, open the workflow run on GitHub and download the GKEET-Android-APK artifact.

## Google Play preparation
- Read PLAY_STORE_RELEASE.md for the signed AAB workflow and upload-key setup.
- Read PRIVACY_POLICY.md before publishing; it must be updated to disclose online accounts and room/presence data before online features launch.
- The signed AAB workflow targets Android API 36 and requires the four Android upload-signing GitHub secrets listed in the release guide.
- Browser smoke tests cover the existing game modes. Online room integration still needs authenticated end-to-end tests using separate test accounts.

A successful CI build is not a substitute for testing on physical Android devices. Verify touch controls, sound, performance, account flows, room joining, Realtime connectivity and all stages on real phones before publishing.
