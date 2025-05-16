#! /bin/bash

zip serverstatus@footeware.ca.zip \
*.js \
metadata.json \
LICENSE \
stylesheet.css \
schemas/* \
assets/* \
-x assets/screenshot.png \
-x assets/icon.png
