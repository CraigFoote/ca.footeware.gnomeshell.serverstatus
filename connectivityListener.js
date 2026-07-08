"use strict";

import Gio from "gi://Gio";

/**
 * Listens for suspend and resume events from NetworkManager.
 */
export class ConnectivityListener {

    /**
     * Constructor.
     * 
     * @param {Function} onDisconnect callback
     * @param {Function} onConnect callback
     */
    constructor(onDisconnect, onConnect) {
        // create Promise
        const proxyPromise = new Promise((resolve, reject) => {

            // the class definition
            const NetworkManagerProxy = Gio.DBusProxy.makeProxyWrapper(this.getInterfaceXml());

            // the proxy instance
            this.networkManagerProxy = new NetworkManagerProxy(
                Gio.DBus.system,
                "org.freedesktop.NetworkManager",
                "/org/freedesktop/NetworkManager",
                (proxy, error) => {
                    if (error === null) {
                        resolve(proxy);
                    } else {
                        reject(error);
                    }
                },
                null,
                Gio.DBusProxyFlags.NONE);

        }).catch(() => {
            // fail silently
        });

        // resolve Promise
        if (proxyPromise) {
            proxyPromise.then(
                (proxy) => {
                    // get notified when the network connectivity changes
                    this.signalId = proxy.connectSignal("StateChanged", (_, __, newState) => {
                        // call one of the callbacks based on new state
                        if (newState[0] === 70) { // TODO magic number, 70=globally connected
                            onConnect();
                        } else {
                            onDisconnect(); // network/internet is unavailable
                        }
                    });
                }
            ).catch(() => {
                // fail silently
            });
        }
    }

    /**
     * Get the XML describing the NetworkManager and its StateChanged signal.
     * 
     * @returns {String}
     */
    getInterfaceXml() {
        return `
            <node>
                <interface name="org.freedesktop.NetworkManager">
                    <signal name="StateChanged">
                        <arg type="u" name="state"/>
                    </signal>
                </interface>
            </node>`;
    }

    /**
     * Disconnect from NetworkManager.
     */
    destroy() {
        if (this.signalId) {
            try {
                this.networkManagerProxy.disconnect(this.signalId);
            } catch {
                // fail silently
            }
            this.signalId = null;
        }
        this.networkManagerProxy = null;
    }
}
