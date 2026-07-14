#! /bin/bash

zip serverstatus@footeware.ca.zip \
*.js \
metadata.json \
LICENSE \
*.css \
schemas/org.gnome.shell.extensions.serverstatus.gschema.xml \
assets/* \
-x eslint.config.js \
-x assets/screenshot.jpg \
-x assets/icon.png \
-x assets/dconf.png
