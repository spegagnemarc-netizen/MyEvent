#!/bin/sh
set -eu
if [ "$(uname -s)" != "Darwin" ]; then
  echo "Ce contrôle exige macOS/Xcode ; aucun test natif exécuté."
  exit 1
fi
command -v xcodegen >/dev/null
command -v xcodebuild >/dev/null
: "${MYEVENT_SIMULATOR_ID:?Renseigner l'UUID d'un simulateur iPhone installé (xcrun simctl list devices available).}"
cd "$(dirname "$0")/../ios"
xcodegen generate
xcodebuild test -project MyEventMobile.xcodeproj -scheme MyEventMobile \
  -destination "platform=iOS Simulator,id=$MYEVENT_SIMULATOR_ID" \
  -derivedDataPath DerivedData CODE_SIGNING_ALLOWED=NO
