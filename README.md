# 🎲 GameBox — UNO, Ludo & More

A calm, colorful, **100% offline** game app: five classic board & card games with
smart bots and 2–4 player support, packaged as a tiny Android APK (255 KB).

## 📱 Install the APK (Android)

1. **Copy `GameBox.apk` to your phone** (download it, send it via WhatsApp/Bluetooth/USB, etc.)
2. Tap the file in your **Files** app. If asked, choose **Settings → allow installing from this source**
   ("Install unknown apps").
3. Tap **Install**. If Google Play Protect shows a warning, choose **Install anyway**
   (the app is self-signed — that is normal for apps outside the Play Store).
4. Open **GameBox** 🎉

- **Requires:** Android 7.0 (2016) or newer. Works fully offline.
- **Permissions:** only `VIBRATE` (tiny haptic feedback). No internet, no ads, no data collection.

> ⚠️ If you get "App not installed": an app with the same package name may exist, or the file
> got corrupted while transferring — re-download `GameBox.apk` and try again.

## 🌐 Play instantly in any browser

Open `index.html` in Chrome / Edge / Firefox (double-click the file) — the whole app
is a single self-contained HTML file. Same games, same bots.

## 🎮 The games

| Game | Players | Bots | Notes |
|---|---|---|---|
| 🃏 **UNO** | 2–4 | ✔ | Full 108-card deck, official rules (Skip / Reverse / +2 / Wild +4, first-card effects, Wild-+4 legality, reshuffle), UNO! call with catch-penalty, scoring to 100/200/500 |
| 🎲 **Ludo** | 2–4 | ✔ | Classic rules: 6 to start, ★ safe cells, captures, exact-count home with bounce-back, bonus rolls (6 / capture / home), three-6s forfeit, rankings |
| ❌ **Tic Tac Toe** | 2 | ✔ | The **Pro** bot plays perfectly — try to force a draw! Series to 5 |
| 🔵 **Connect Four** | 2 | ✔ | Bot looks up to 6 moves ahead. Series to 5 |
| 🐍 **Snakes & Ladders** | 2–4 | ✔ | Classic 100-square board (9 ladders, 10 snakes), roll 6 = bonus, bounce-back at 100 |

**Every seat can be Human or Bot** — mix freely:
- 1 human + bots → play against AI
- 2–4 humans → pass-and-play on one device (UNO hides your hand between turns)
- all bots → sit back and watch them battle 🍿

**Bot levels:** 😌 Chill (relaxed) • 🧠 Sharp (solid) • 🔥 Pro (ruthless)

## 🔧 Rebuild the APK (for developers)

```bash
# requirements: JDK 8+, Android build-tools 34 + platform android-34
ANDROID_SDK=/path/to/sdk bash android/build_apk.sh
```

- Web app sources: `src/` → bundled into `index.html`
- Android shell: `android/` (WebView wrapper, ~90 lines of Java)
- Signing key: `android/gamebox.keystore` (store password `android`).
  Keep it to sign future updates with the same identity.

## ✅ Quality

- `test/run_tests.js` — **589 logic tests**: card conservation across 60 full UNO bot
  matches, Ludo board geometry & capture rules, perfect Tic-Tac-Toe bot verification,
  Connect-Four bot strength, Snakes & Ladders mappings.
- `test/visual.py` + `test/dom_checks.py` — headless-browser QA over every screen
  (0 console errors, 45/45 layout & DOM checks).

*UNO® is a trademark of Mattel. This is a fan-made, unofficial implementation.*
