import type { BeatmapRow } from "@shared/types";
import { BeatmapParser } from "../main/osu/parsers";
import { get_audio_duration } from "../main/osu/audio";

import fs from "fs";
import path from "path";

type LazerFileInfo = {
    filename: string;
    hash: string;
};

export type StableBeatmapTask = {
    kind: "stable";
    md5: string;
    last_modified: string;
    osu_file_location: string;
    stable_songs_path: string;
    folder_name: string;
};

export type LazerBeatmapTask = {
    kind: "lazer";
    md5: string;
    last_modified: string;
    osu_file_location: string;
    lazer_files_path: string;
    files: LazerFileInfo[];
};

export type BeatmapTask = StableBeatmapTask | LazerBeatmapTask;

const get_lazer_file_location = (lazer_files_path: string, hash: string): string => {
    if (!hash) {
        return "";
    }

    return path.resolve(lazer_files_path, `${hash.substring(0, 1)}/${hash.substring(0, 2)}/${hash}`);
};

const get_beatmap_properties = async (file_location: string): Promise<{ AudioFilename: string; Background: string; Duration: number }> => {
    const parser = new BeatmapParser();

    try {
        await parser.parse(file_location);
        const media = parser.get_media();

        return {
            AudioFilename: media.AudioFilename ?? "",
            Background: media.Background ?? "",
            Duration: media.Duration ?? 0
        };
    } finally {
        parser.free();
    }
};

export const process_beatmap_task_inline = async (task: BeatmapTask): Promise<BeatmapRow | null> => {
    if (!task.osu_file_location || !fs.existsSync(task.osu_file_location)) {
        return {
            md5: task.md5,
            last_modified: task.last_modified,
            background: "",
            audio: "",
            video: "",
            duration: -1
        };
    }

    try {
        const beatmap_properties = await get_beatmap_properties(task.osu_file_location);

        let background = "";
        let audio = "";

        if (task.kind == "stable") {
            background = beatmap_properties.Background ? path.join(task.stable_songs_path, task.folder_name, beatmap_properties.Background) : "";
            audio = beatmap_properties.AudioFilename ? path.join(task.stable_songs_path, task.folder_name, beatmap_properties.AudioFilename) : "";
        } else {
            if (beatmap_properties.Background) {
                const background_hash = task.files.find((file) => file.filename == beatmap_properties.Background)?.hash ?? "";
                background = get_lazer_file_location(task.lazer_files_path, background_hash);
            }

            if (beatmap_properties.AudioFilename) {
                const audio_hash = task.files.find((file) => file.filename == beatmap_properties.AudioFilename)?.hash ?? "";
                audio = get_lazer_file_location(task.lazer_files_path, audio_hash);
            }
        }

        const audio_duration = get_audio_duration(audio);

        return {
            md5: task.md5,
            last_modified: task.last_modified,
            background,
            audio,
            video: "",
            duration: audio_duration
        };
    } catch (err) {
        console.error("failed to process beatmap task:", err);
        return {
            md5: task.md5,
            last_modified: task.last_modified,
            background: "",
            audio: "",
            video: "",
            duration: -1
        };
    }
};

const run_beatmap_task = async (task: BeatmapTask): Promise<BeatmapRow | null> => {
    return process_beatmap_task_inline(task);
};

export default run_beatmap_task;
