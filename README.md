# Yamanly (Android)

Capacitor wrapper around the Yamanly web app.

- `src/` the app (head.html, app.js) and the native bridge (native.js)
- `scripts/build_www.py` builds `www/` from `src/`
- `android/` the Android project
- `.github/workflows/build-android.yml` cloud build that makes the signed .aab
- `docs/privacy.html` privacy policy (host with GitHub Pages)
- `store/` Play Store graphics, listing text and the step by step guide

Update flow: edit files in `src/`, push to GitHub, the build runs automatically (or press Run workflow).
