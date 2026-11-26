#!/usr/bin/env bash
# Builds the Kin Relay Android APK with free tools only (Android SDK build-tools + JDK 17; no Gradle, no Android Studio).
#   ANDROID_HOME=<sdk with platforms/android-34 and build-tools/34.0.0>  JAVA_HOME=<jdk 17>  android/build.sh
# Output: android/out/Kin-Relay.apk, signed with the keystore in $KR_KEYSTORE (made on first run if it doesn't exist).
# The keystore is YOUR signing identity: keep it safe and never commit it. Updates only install over an app signed with the same one.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(dirname "$HERE")"
: "${ANDROID_HOME:?set ANDROID_HOME}"; : "${JAVA_HOME:?set JAVA_HOME}"
BT="$ANDROID_HOME/build-tools/34.0.0"; JAR="$ANDROID_HOME/platforms/android-34/android.jar"
KS="${KR_KEYSTORE:-$HOME/.kin-relay-android/kin-relay.keystore}"; PASS="${KR_KEYSTORE_PASS:-}"
VERSION="$(sed -n 's/.*const VERSION = "\([0-9.]*\)".*/\1/p' "$ROOT/server.js" | head -1)"
IFS=. read -r MA MI PA <<<"$VERSION"; CODE=$((MA*10000 + MI*100 + PA))
W="$HERE/.work"; OUT="$HERE/out"; rm -rf "$W"; mkdir -p "$W"/{gen,classes,assets,compiled} "$OUT"
# 1. the web app (same build as the iPhone/web version) goes inside the APK
(cd "$ROOT" && WEB_OUT="$W/assets/web" ANDROID_BUILD=1 node web/build.js >/dev/null)
# 2. manifest, version and icons
sed -e "s/__VERSION_CODE__/$CODE/" -e "s/__VERSION_NAME__/$VERSION/" "$HERE/AndroidManifest.xml" > "$W/AndroidManifest.xml"
sed "s/__VERSION_NAME__/$VERSION/" "$HERE/src/com/tilok360/kinrelay/BuildInfo.java.in" > "$W/gen/BuildInfo.java"
cp -r "$HERE/res" "$W/res"
python3 - "$ROOT/desktop/assets/icon.png" "$W/res" <<'PY'
import sys; from PIL import Image
im = Image.open(sys.argv[1]).convert("RGBA")
for d, n in (("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)):
    import os; os.makedirs(f"{sys.argv[2]}/mipmap-{d}", exist_ok=True); im.resize((n, n), Image.LANCZOS).save(f"{sys.argv[2]}/mipmap-{d}/ic_launcher.png")
PY
# 3. compile resources, Java, dex, package
"$BT/aapt2" compile --dir "$W/res" -o "$W/compiled/res.zip"
"$BT/aapt2" link -o "$W/base.apk" -I "$JAR" --manifest "$W/AndroidManifest.xml" -A "$W/assets" --min-sdk-version 24 --target-sdk-version 34 --version-code "$CODE" --version-name "$VERSION" "$W/compiled/res.zip"
"$JAVA_HOME/bin/javac" -source 8 -target 8 -Xlint:-options -cp "$JAR" -d "$W/classes" "$HERE"/src/com/tilok360/kinrelay/MainActivity.java "$W/gen/BuildInfo.java"
"$BT/d8" --min-api 24 --lib "$JAR" --output "$W" $(find "$W/classes" -name '*.class')
cp "$W/base.apk" "$W/unsigned.apk"
python3 -c "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],'a',zipfile.ZIP_DEFLATED); z.write(sys.argv[2],'classes.dex'); z.close()" "$W/unsigned.apk" "$W/classes.dex"
"$BT/zipalign" -f -p 4 "$W/unsigned.apk" "$W/aligned.apk"
# 4. sign (a self-signed key: fine for installing from a file, not for the Play Store)
if [ ! -f "$KS" ]; then
  mkdir -p "$(dirname "$KS")"; chmod 700 "$(dirname "$KS")"
  PASS="${PASS:-$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 20)}"
  "$JAVA_HOME/bin/keytool" -genkeypair -keystore "$KS" -storepass "$PASS" -keypass "$PASS" -alias kinrelay -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Kin Relay (tilok360), O=tilok360" >/dev/null 2>&1
  printf '%s' "$PASS" > "$KS.pass"; chmod 600 "$KS" "$KS.pass"
fi
PASS="${PASS:-$(cat "$KS.pass")}"
"$BT/apksigner" sign --ks "$KS" --ks-pass "pass:$PASS" --ks-key-alias kinrelay --min-sdk-version 24 --out "$OUT/Kin-Relay.apk" "$W/aligned.apk"
"$BT/apksigner" verify --min-sdk-version 24 "$OUT/Kin-Relay.apk" && echo "built $OUT/Kin-Relay.apk ($(du -h "$OUT/Kin-Relay.apk" | cut -f1)), version $VERSION (code $CODE)"
rm -rf "$W"
