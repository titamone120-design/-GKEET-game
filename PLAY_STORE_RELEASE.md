# GKEET — Google Play release checklist

## Release build

The workflow `.github/workflows/play-store-aab.yml` builds a signed Android App Bundle (AAB), targets Android API 36, and runs the browser gameplay smoke test first.

The workflow requires a private upload keystore. Generate one on a trusted computer and keep a secure backup:

```bash
keytool -genkeypair -v -keystore gkeet-upload.jks -alias gkeet-upload -keyalg RSA -keysize 2048 -validity 10000
```

Encode the keystore as one base64 line:

```bash
base64 -w 0 gkeet-upload.jks
```

Add these repository secrets under **GitHub → Settings → Secrets and variables → Actions**:

- `ANDROID_KEYSTORE_BASE64` — the base64 output
- `ANDROID_KEYSTORE_PASSWORD` — the keystore password
- `ANDROID_KEY_ALIAS` — `gkeet-upload` (or the alias you chose)
- `ANDROID_KEY_PASSWORD` — the key password

Then open **Actions → Build GKEET Google Play AAB → Run workflow**. The signed bundle is uploaded as the `GKEET-Play-Store-AAB` artifact.

**Never commit the keystore or its passwords to the repository.** Keep at least one secure offline backup; losing the upload key can delay future releases.

## Publish the privacy policy

The web-ready policy is at `docs/privacy-policy.html`. To publish it, open **GitHub → Repository Settings → Pages**, choose **Deploy from a branch**, select branch `main` and folder `/docs`, then save. Once GitHub Pages finishes deploying, use this policy URL in Play Console:

`https://titamone120-design.github.io/-GKEET-game/privacy-policy.html`

## Before submitting to Play Console

- New Android phone apps and updates submitted from 31 August 2026 must target Android 16 / API 36 or higher; the release workflow is configured for API 36. [Google Play target API policy](https://support.google.com/googleplay/android-developer/answer/11926878)
- If the developer account is a personal account created after 13 November 2023, Google Play requires a closed test with at least 12 testers opted in continuously for 14 days before production access can be requested. [Google Play personal account testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465)
- Create/verify the Google Play developer account.
- Create the app listing and choose the final app name, category, contact details, and store description.
- Prepare a 512×512 app icon, 1024×500 feature graphic, and phone screenshots.
- Publish the privacy policy in a stable public web page and enter its URL in Play Console.
- Complete the Data safety, content rating, target audience, and ads declarations accurately.
- Test the signed AAB through an internal testing track on real Android phones.
- Check game performance, touch controls, sound, offline startup, app pause/resume, and all 20 stages.
- Complete any Play Console testing requirements shown for the developer account before requesting production access.

## Current limitations

A successful CI build or browser smoke test is not a substitute for testing on physical Android devices. The game still needs real-device performance and gameplay checks before public release.
