export interface StuffConfig {
    osu_id: string;
    osu_secret: string;
    stable_path: string;
    stable_songs_path: string;
    lazer_path: string;
    export_path: string;
    local_images: boolean;
    lazer_mode: boolean;
    radio_volume: number;
}

export interface StuffMirror {
    name: string;
    url: string;
}
