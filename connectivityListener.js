'use strict';

import Gio from 'gi://Gio';
import NM from 'gi://NM';

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
            const NetworkManagerProxy = Gio.DBusProxy.makeProxyWrapper(this.#getInterfaceXml());

            // the proxy instance
            this.networkManagerProxy = new NetworkManagerProxy(
                Gio.DBus.system,
                'org.freedesktop.NetworkManager',
                '/org/freedesktop/NetworkManager',
                (proxy, error) => {
                    if (error === null)
                        resolve(proxy);
                    else
                        reject(error);
                },
                null,
                Gio.DBusProxyFlags.NONE);
        });

        this.#resolvePromise(proxyPromise, onDisconnect, onConnect);
    }

    #resolvePromise(proxyPromise, onDisconnect, onConnect) {
        proxyPromise.then(
            proxy => {
                // get notified when the network connectivity changes
                this.signalId = proxy.connectSignal('StateChanged', (_, __, newState) => {
                    // call one of the callbacks based on new state
                    if (newState[0] === NM.State.CONNECTED_GLOBAL)
                        onConnect();
                    else
                        onDisconnect(); // network/internet is unavailable
                });
            }
        );
    }

    /**
     * Get the XML describing the NetworkManager and its StateChanged signal.
     *
     * @returns {string}
     */
    #getInterfaceXml() {
        return `
            <node>
                <interface name='org.freedesktop.NetworkManager'>
                    <signal name='StateChanged'>
                        <arg type='u' name='state'/>
                    </signal>
                </interface>
            </node>`;
    }

    /**
     * Disconnect from NetworkManager.
     */
    destroy() {
        if (this.signalId) {
            this.networkManagerProxy.disconnect(this.signalId);
            this.signalId = null;
        }
        this.networkManagerProxy = null;
    }
}
