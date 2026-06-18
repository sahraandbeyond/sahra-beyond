# Sahra & Beyond — Android App (TWA) Build Guide

This turns the live website into an installable Android app using a **TWA**
(Trusted Web Activity — the app is a thin wrapper that loads your real site
full-screen, with no browser bar). Do this only **after** the site is live and
the PWA bits below are deployed.

> Prerequisite: the site must be live over HTTPS (your Netlify URL or custom
> domain) with `manifest.json`, `sw.js`, the icon PNGs, and
> `/.well-known/assetlinks.json` all reachable.

---

## What's already wired for you

- **manifest.json** — TWA-complete: `name`, `short_name`, `start_url` =
  `/?platform=android`, `scope` = `/`, `display` = `standalone`, brand
  `theme_color` (#C0702E) / `background_color` (#FAF6EF), and an icons array
  with 192/512 PNGs plus a 512 maskable.
- **Ad gating** — the website shows Google **AdSense**; the app does **not**
  (AdSense-in-app violates policy). The app loads `/?platform=android`, which
  the site detects and suppresses all AdSense. In the app you use **AdMob**
  instead (added in the Android project — see below).
- **assetlinks.json** — placeholder at `/.well-known/assetlinks.json`. You must
  fill in the package name and signing fingerprint (steps below).
- **Service worker** — root scope, offline-first app shell.

---

## Option A — PWABuilder (recommended, no command line)

1. Go to **https://www.pwabuilder.com**.
2. Enter your live URL (e.g. `https://sahra-beyond.netlify.app`) and click
   **Start**. It scores the manifest/SW (should pass).
3. Click **Package for stores → Android → Google Play**.
4. Set:
   - **Package ID**: `app.sahraandbeyond.twa` (must match `assetlinks.json`).
   - **App name**: Sahra & Beyond
   - **Launch URL**: `/?platform=android` (so the app self-identifies and
     AdSense stays off).
5. Click **Generate**. Download the ZIP — it contains the Android project, the
   signed **`.aab`** (upload to Play), and a **`signing-key-info`** /
   `assetlinks.json` snippet containing your **SHA-256 fingerprint**.
6. Copy that SHA-256 fingerprint into your site's
   `/.well-known/assetlinks.json` (replace `REPLACE_WITH_SHA256_FINGERPRINT`),
   commit, and redeploy. This is what removes the browser address bar.

## Option B — Bubblewrap (command line)

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://sahra-beyond.netlify.app/manifest.json
# When prompted: Application ID = app.sahraandbeyond.twa
#                Launch URL     = /?platform=android
bubblewrap build
```

`bubblewrap build` produces `app-release-signed.aab` and prints the **SHA-256
fingerprint** (also via `keytool -list -v -keystore android.keystore`). Paste
that fingerprint into `assetlinks.json`, redeploy.

---

## Getting / verifying the SHA-256 fingerprint

- PWABuilder/Bubblewrap output includes it, **or** run:
  `keytool -list -v -keystore <your-keystore> -alias <alias>` and copy the
  `SHA256:` value (uppercase hex with colons, e.g. `AB:CD:...`).
- **Important:** if you let **Google Play App Signing** manage your key (the
  default), Play re-signs the app, so you must also add the **App signing key
  certificate** SHA-256 from *Play Console → your app → Setup → App signing*
  to `assetlinks.json`. The `sha256_cert_fingerprints` array can hold multiple
  fingerprints — include both your upload key and the Play app-signing key.

## assetlinks.json — what to fill in

File: `/.well-known/assetlinks.json`
- `package_name`: must equal the Package ID used in the build
  (default suggested: `app.sahraandbeyond.twa`).
- `sha256_cert_fingerprints`: replace `REPLACE_WITH_SHA256_FINGERPRINT` with the
  real fingerprint(s). Verify after deploy with Google's tester:
  `https://developers.google.com/digital-asset-links/tools/generator`

---

## Where AdMob goes (in the generated Android project)

The site deliberately serves **no ads in-app**, so monetize the app with AdMob:

1. Create an **AdMob** account, add the app, and create ad units (banner /
   interstitial). Note the **AdMob App ID** (`ca-app-pub-…~…`) and **ad unit
   IDs** (`ca-app-pub-…/…`).
2. In the generated Android project (`app/build.gradle`), add the Play Services
   Ads dependency: `implementation 'com.google.android.gms:play-services-ads:23.+'`.
3. In `app/src/main/AndroidManifest.xml`, add inside `<application>`:
   `<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY"/>`
   (TODO: your AdMob App ID).
4. Because a plain TWA shows only the web view, to display AdMob you either:
   (a) keep ads out of the immersive web view and add AdMob to a small native
   shell/launch activity, or (b) use a **bottom AdMob banner** in a custom TWA
   `LauncherActivity`. PWABuilder's project includes an activity you can extend;
   add the AdView there.
5. Initialize the SDK (`MobileAds.initialize(this)`) and load ads with your unit
   IDs. Use **test ad unit IDs** during development, real ones for release.

---

## Publish to the Play Store

1. Create a **Google Play Developer** account (one-time $25).
2. Play Console → **Create app** → fill listing (name, description, screenshots,
   icon — reuse `icon-512.png`).
3. **Production → Create release →** upload the `.aab` from the build step.
4. Complete the content rating, data-safety, and privacy-policy forms.
5. Roll out. After approval, confirm the address bar is gone (proves
   `assetlinks.json` verified). If the bar shows, the fingerprint/package in
   `assetlinks.json` doesn't match — fix and redeploy.

---

## Placeholders you still must fill

| Where | Placeholder | Replace with |
|---|---|---|
| `index.html` (head) | `ca-pub-XXXXXXXXXXXXXXXX` | your AdSense publisher ID |
| `index.html` (`AD_SLOTS`) | `0000000000` (×2) | real AdSense ad-unit slot IDs |
| `ads.txt` | `pub-XXXXXXXXXXXXXXXX` | your AdSense publisher ID (no `ca-`) |
| `assetlinks.json` | `REPLACE_WITH_SHA256_FINGERPRINT` | app SHA-256 fingerprint(s) |
| `assetlinks.json` | `app.sahraandbeyond.twa` | confirm/replace your package ID |
| Android project | AdMob App ID + unit IDs | from your AdMob account |
