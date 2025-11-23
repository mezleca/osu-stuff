const { contextBridge, ipcRenderer } = require("electron");
import { ElectronApi, InvokeChannels, InvokeParams, InvokeResult, OnChannels, OnPayload } from "@shared/types.js";

const api: ElectronApi = {
    invoke: <T extends InvokeChannels>(
        channel: T,
        ...args: InvokeParams<T> extends undefined ? [] : InvokeParams<T> extends any[] ? InvokeParams<T> : [InvokeParams<T>]
    ): Promise<InvokeResult<T>> => {
        return args.length == 0 ? ipcRenderer.invoke(channel) : ipcRenderer.invoke(channel, ...args);
    },
    on: <T extends OnChannels>(channel: T, callback: (payload: OnPayload<T>) => void) => {
        const subscription = (_: any, payload: OnPayload<T>) => callback(payload);
        ipcRenderer.on(channel, subscription);

        return () => {
            ipcRenderer.removeListener(channel, subscription);
        };
    }
};

// expose api
contextBridge.exposeInMainWorld("api", api);
