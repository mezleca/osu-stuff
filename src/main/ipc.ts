import { ipcMain, IpcMainInvokeEvent, WebContents } from "electron";
import { InvokeArgs, InvokeChannels, InvokeResult, SendChannels, SendPayload } from "@shared/types";

export const handle_ipc = <T extends InvokeChannels>(
    channel: T,
    handler: (event: IpcMainInvokeEvent, ...args: InvokeArgs<T>) => Promise<InvokeResult<T>> | InvokeResult<T>
) => {
    ipcMain.handle(channel, (event, ...args) => handler(event, ...(args as InvokeArgs<T>)));
};

export const send_to_renderer = <T extends SendChannels>(webcontents: WebContents, channel: T, payload: SendPayload<T>) => {
    webcontents.send(channel, payload);
};
