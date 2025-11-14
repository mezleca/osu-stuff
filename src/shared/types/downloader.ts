export interface IDownloadProgress {
    id: string;
    paused: boolean;
    length: number;
    current: number;
}

export interface IDownloadData {
    id: string;
    beatmaps: IMinimalBeatmap[];
    progress?: IDownloadProgress;
}

export interface IMinimalBeatmap {
    md5?: string;
    beatmapset_id?: number;
}

export interface IBeatmapDownloader {
    initialize(): void;
    resume(id: string): boolean;
    add_single(data: IMinimalBeatmap): boolean;
    add_to_queue(data: IDownloadData): boolean;
    remove_from_queue(id: string): boolean;
    pause(id: string): boolean;
    get_queue(): IDownloadData[];
}
