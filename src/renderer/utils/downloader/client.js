import { core } from '../../app.js';

export const downloader = {

    intitialize: async () => {

        if (!core.login?.access_token) {
            core.progress.update("failed to initialize downloader client (missing access token)");
            return;
        }

        const exports_path = core.config.get("export_path");
        const songs_path = core.config.get("stable_songs_path");

        if (!exports_path && !songs_path) {
            core.progress.update("failed to initialize downloader client (missing songs path)");
            return;
        }

        await downloader.update_mirrors(Array.from(core.mirrors));
        await downloader.update_path(core.config.get("lazer_mode") ? exports_path : songs_path);
        await downloader.update_token(core.login.access_token);
    },

    single: async (hash) => {
        return window.electronAPI.single_map(hash);
    },

    update_mirrors: async (list) => {
        return window.electronAPI.update_mirrors(list);
    },
    
    update_path: async (path) => {
        return window.electronAPI.update_path(path);
    },

    update_token: async (token) => {
        return window.electronAPI.update_token(token);
    },
    
    create_download: async (data) => {
        const result = window.electronAPI.create_download(data);
        if (!result) {
            core.progress.update("failed to create download...");
        } else {
            core.progress.update("added download to queue");
        }  
    },
    
    stop_download: async (id) => {
        return window.electronAPI.stop_download(id);
    },
    
    setup_listeners: (callbacks) => {

        window.electronAPI.on_download_create((data) => {
            if (callbacks.on_download_create) {
                callbacks.on_download_create(data);
            }
        });
        
        window.electronAPI.on_progress_update((data) => {
            if (callbacks.on_progress_update) {
                callbacks.on_progress_update(data);
            }
        });
        
        window.electronAPI.on_progress_end((data) => {
            if (callbacks.on_progress_end) {
                callbacks.on_progress_end(data);
            }
        });
    }
};
