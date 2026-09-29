#!/bin/bash
# Build GameBox.apk from android/ + ../index.html
# Requirements: JDK 8+, Android build-tools 34 + platform android-34 (SDK dir below)
set -e
SDK="${ANDROID_SDK:-/home/user/.cache/android-sdk}"
BT="$SDK/build-tools/34.0.0"
PLAT="$SDK/platforms/android-34/android.jar"
cd "$(dirname "$0")"

[ -x "$BT/aapt2" ] || { echo "ERROR: aapt2 not found at $BT (set ANDROID_SDK)"; exit 1; }
[ -f "$PLAT" ] || { echo "ERROR: android.jar not found at $PLAT"; exit 1; }

KT="$(command -v keytool || true)"
[ -z "$KT" ] && KT=/usr/lib/jvm/jdk-11/bin/keytool

echo "==> fresh build dir"
rm -rf build && mkdir -p build/obj build/dex

echo "==> bundle game into assets"
mkdir -p assets
cp -f ../index.html assets/index.html

echo "==> compile resources"
"$BT/aapt2" compile --dir res -o build/res.zip

echo "==> link resources + manifest + assets"
"$BT/aapt2" link -o build/base.apk -I "$PLAT" --manifest AndroidManifest.xml -A assets build/res.zip --auto-add-overlay

echo "==> compile java"
javac -encoding UTF-8 -source 8 -target 8 -nowarn -bootclasspath "$PLAT" -d build/obj java/com/soothing/gamebox/MainActivity.java

echo "==> dex"
"$BT/d8" --release --min-api 24 --lib "$PLAT" --output build/dex $(find build/obj -name '*.class')

echo "==> package classes.dex"
(cd build/dex && zip -q ../base.apk classes.dex)

echo "==> zipalign"
"$BT/zipalign" -f 4 build/base.apk build/aligned.apk

echo "==> sign (self-signed keystore: android/gamebox.keystore, pass: android)"
[ -f gamebox.keystore ] || "$KT" -genkeypair -keystore gamebox.keystore -alias gamebox \
  -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=GameBox"
"$BT/apksigner" sign --ks gamebox.keystore --ks-pass pass:android --key-pass pass:android \
  --out ../GameBox.apk build/aligned.apk

echo "==> verify"
"$BT/apksigner" verify ../GameBox.apk && echo "signature OK"
"$BT/aapt2" dump badging ../GameBox.apk | head -4
ls -la ../GameBox.apk
echo "DONE: GameBox.apk"
