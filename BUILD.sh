#! /bin/bash

# export required files to a properly named zip
git archive -o serverstatus@footeware.ca.zip HEAD -- \
extension.js \
prefs.js \
metadata.json \
LICENSE \
README.md \
serverPanel.js \
serverSetting.js \
settingsEditor.js \
styles.css \
assets \
schemas
