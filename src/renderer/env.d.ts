/// <reference types="vite/client" />

import { ElectronApi } from "@shared/types";

declare global {
    interface Window {
        api: ElectronApi;
    }
}

declare module "*.css";
