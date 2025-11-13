import { IBeatmapFilter, IBeatmapResult, BeatmapSetResult, ICollectionResult, BeatmapFile } from "@shared/types/osu";
import { BaseDriver } from "./base";

class StableBeatmapDriver extends BaseDriver {
    constructor() {
        super();
    }

    initialize(): Promise<void> {
        throw new Error("Method not implemented.");
    }

    get_player_name(): string {
        throw new Error("Method not implemented.");
    }

    add_collection(name: string, beatmaps: string[]): boolean {
        throw new Error("Method not implemented.");
    }

    delete_collection(name: string): boolean {
        throw new Error("Method not implemented.");
    }

    get_collection(name: string): ICollectionResult | undefined {
        throw new Error("Method not implemented.");
    }

    get_collections(): ICollectionResult[] {
        throw new Error("Method not implemented.");
    }

    update_collection(collections: ICollectionResult[]): boolean {
        throw new Error("Method not implemented.");
    }

    add_beatmap(beatmap: IBeatmapResult): boolean {
        throw new Error("Method not implemented.");
    }

    get_beatmap_by_md5(md5: string): IBeatmapResult | undefined {
        throw new Error("Method not implemented.");
    }

    get_beatmap_by_id(id: number): IBeatmapResult | undefined {
        throw new Error("Method not implemented.");
    }

    get_beatmapset(set_id: number): BeatmapSetResult | undefined {
        throw new Error("Method not implemented.");
    }

    search_beatmaps(options: IBeatmapFilter): string[] {
        throw new Error("Method not implemented.");
    }

    get_all_beatmaps(): string[] {
        throw new Error("Method not implemented.");
    }

    fetch_beatmaps(checksums: string[]): IBeatmapResult[] {
        throw new Error("Method not implemented.");
    }

    get_beatmapset_files(id: number): BeatmapFile[] {
        throw new Error("Method not implemented.");
    }

    dispose(): Promise<void> {
        throw new Error("Method not implemented.");
    }
}

export const stable_driver = new StableBeatmapDriver();
