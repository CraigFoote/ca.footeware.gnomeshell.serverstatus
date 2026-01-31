#! /bin/bash

zip serverstatus@footeware.ca.zip \
*.js \
metadata.json \
LICENSE \
*.css \
schemas/org.gnome.shell.extensions.serverstatus.gschema.xml \
assets/* \
-x assets/screenshot.png \
-x assets/icon.png
