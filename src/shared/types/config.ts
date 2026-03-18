export interface ManagerConfig {
    _id: number;
    osu_id: string;
    osu_secret: string;
    stable_path: string;
    stable_songs_path: string;
    lazer_path: string;
    export_path: string;
    local_images: boolean;
    lazer_mode: boolean;
    radio_background: boolean;
    radio_volume: number;
}

export interface ManagerMirror {
    name: string;
    url: string;
}
