# serverstatus@footeware.ca

A GNOME Shell extension with an indicator in the panel displaying status of entered web server URLs, IP's, or host names using emojis:

![server-init.svg](assets/server-init.svg) initializing...

![server-down.svg](assets/server-down.svg) server down/unresponsive/timed out

![server-bad.svg](assets/server-bad.svg) malformed URL

![server-up.svg](assets/server-up.svg) server up and responding

---

## Features

- The panel icon shows the worst status from the set of all server statuses in the popup menu. Server down is considered worse than bad URL.

- There's a configurable timeout on the requests (10 second default) and HTTP response codes 2xx and 3xx are treated as success. Unless the 3xx status is one that's missing the required 'Location' response header. There's a per-server option to not follow redirects if you just want to verify the forwarding server.

- There's a per server option to show a notification when it's down. It defaults to false but can easily be switched on.

- There's another per server option to ignore TLS errors. Useful if using a self-signed certificate or for accessing a server whose certificate subject is a domain name but using its IP, etc. Thanks to [FilipLaurentiu](https://github.com/FilipLaurentiu) for that enhancement request.

- [FilipLaurentiu](https://github.com/FilipLaurentiu) also requested custom request headers, now available per server.

- [alegroleo](https://github.com/alegroleo) requested a `ping` option, now available per server.

- Servers can be made visible (default) or hidden, where the server is not displayed in the menu and no requests are made to it. Many thanks to [xingwangzhe](https://github.com/xingwangzhe) for that enhancement's pull request.

- If the host OS goes into suspend mode, the http requests are paused until network connectivity is back. Thanks to [neophiliac](https://github.com/neophiliac) for the design discussions and testing.

- Install at [extensions.gnome.org](https://extensions.gnome.org/extension/4687/server-status-indicator/) or use [Extension Manager](https://flathub.org/en/apps/com.mattjakeman.ExtensionManager).

- To customize, the four **.svg** files in the **assets** folder can be swapped out with your own icons. Just keep the same filenames.

---

![screenshot](assets/screenshot.png)

![screenshot](assets/screenshot-headers.png)

## Backups

Always a good idea. I thought about adding a backup/restore function but I realized [DConf Editor](https://apps.gnome.org/DconfEditor/) already works well. Just copy the text to a backup file and paste to restore from the file. Just make sure you deal with the newer `server-settings-2` key's value.

![dconf](assets/dconf.png)

---
