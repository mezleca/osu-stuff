import { core } from '../app.js';

export const downloader = {

    update_mirrors: async (mirrorList) => {
        return await window.electronAPI.update_mirrors(mirrorList);
    },
    
    update_path: async (downloadPath) => {
        return await window.electronAPI.update_path(downloadPath);
    },
    
    create_download: async (id, hashes) => {
        return await window.electronAPI.create_download(id, hashes);
    },
    
    stop_download: async (id) => {
        return await window.electronAPI.stop_download(id);
    },
    
    setup_listeners: (callbacks) => {
        window.electronAPI.on_download_create((data) => {
            if (callbacks.on_download_create) {
                callbacks.on_download_create(data.id);
            }
        });
        
        window.electronAPI.on_progress_update((data) => {
            if (callbacks.on_progress_update) {
                callbacks.on_progress_update(data);
            }
        });
        
        window.electronAPI.on_progress_end((data) => {
            if (callbacks.on_progress_end) {
                callbacks.on_progress_end(data.id, data.success);
            }
        });
    }
};

export const initialize_downloader_client = async () => {

    const exports_path = core.config.get("export_path");
    const songs_path = core.config.get("stable_songs_path");

    if (!exports_path && !songs_path) {
        core.progress.update("failed to initialize downloader client (missing songs path)");
        return;
    }

    await downloader.update_mirrors(Array.from(core.mirrors));
    await downloader.update_path(core.config.get("lazer_mode") ? exports_path : songs_path);
};
