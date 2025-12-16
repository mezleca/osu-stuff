export interface IDownloadProgress {
    id: string;
    paused: boolean;
    length: number;
    current: number;
}

export interface IDownloadData {
    id: string;
    beatmaps: IDownloadedBeatmap[];
    progress?: IDownloadProgress;
}

export interface IDownloadedBeatmap {
    md5?: string;
    beatmapset_id?: number;
}

export type DownloadUpdate = "started" | "resumed" | "paused" | "finished" | "no mirrors" | "update";

export interface IDownloadEvent {
    type: DownloadUpdate;
    data: IDownloadProgress;
}

export interface IMirrorWithCooldown {
    name: string;
    url: string;
    cooldown: number | null;
}

export interface IBeatmapDownloader {
    initialize(): void;
    resume(id: string): boolean;
    add_single(data: IDownloadedBeatmap): Promise<boolean>;
    add_to_queue(data: IDownloadData): boolean;
    remove_from_queue(id: string): boolean;
    pause(id: string): boolean;
    get_queue(): IDownloadData[];
}
