import { config } from "../database/config";

export class BeatmapManager {
    constructor() {
        this.beatmaps = new Map();
        this.beatmapsets = new Map();
        this.version = null;
        this.folders = null;
        this.account_unlocked = null;
        this.last_unlocked_time = null;
        this.player_name = null;
        this.beatmaps_count = null;
        this.extra_start = null;
        this.permission_id = null;
        this.file_path = null;
    }

    initialize(osu_data) {
        if (!osu_data) {
            console.error("[BeatmapManager] invalid osu_data");
            return false;
        }

        this.version = osu_data.version;
        this.folders = osu_data.folders;
        this.account_unlocked = osu_data.account_unlocked;
        this.last_unlocked_time = osu_data.last_unlocked_time;
        this.player_name = osu_data.player_name;
        this.beatmaps_count = osu_data.beatmaps_count;
        this.extra_start = osu_data.extra_start;
        this.permission_id = osu_data.permission_id;
        this.file_path = osu_data.file_path;

        // process beatmaps and group them into beatmapsets
        this.process_beatmaps(osu_data.beatmaps);

        return true;
    }

    process_beatmaps(beatmaps_map) {
        this.beatmaps.clear();
        this.beatmapsets.clear();

        for (const [md5, beatmap] of beatmaps_map) {
            this.beatmaps.set(md5, beatmap);

            const beatmapset_id = beatmap.beatmapset_id;

            if (!this.beatmapsets.has(beatmapset_id)) {
                // create new beatmapset entry
                this.beatmapsets.set(beatmapset_id, {
                    beatmapset_id: beatmapset_id,
                    md5: md5,
                    artist: beatmap.artist,
                    artist_unicode: beatmap.artist_unicode,
                    title: beatmap.title,
                    title_unicode: beatmap.title_unicode,
                    mapper: beatmap.mapper,
                    source: beatmap.source,
                    tags: beatmap.tags,
                    audio_file_name: beatmap.audio_file_name,
                    unique_id: beatmap.unique_id,
                    folder_name: beatmap.folder_name,
                    last_modification: beatmap.last_modification,
                    downloaded: beatmap.downloaded,
                    local: beatmap.local,
                    audio_path: beatmap.audio_path,
                    image_path: beatmap.image_path,
                    beatmaps: []
                });
            }

            const beatmapset = this.beatmapsets.get(beatmapset_id);
            beatmapset.beatmaps.push(beatmap);
        }
    }

    get_beatmap_by_md5(md5) {
        return this.beatmaps.get(md5);
    }

    get_beatmapset_by_id(beatmapset_id) {
        return this.beatmapsets.get(beatmapset_id);
    }

    get_beatmaps_from_set(beatmapset_id) {
        const beatmapset = this.beatmapsets.get(beatmapset_id);
        return beatmapset ? beatmapset.beatmaps : [];
    }

    get_all_beatmapsets() {
        return Array.from(this.beatmapsets.values());
    }

    get_all_beatmaps() {
        return Array.from(this.beatmaps.values());
    }

    get_beatmaps_by_unique_id(unique_id) {
        const beatmaps = [];
        for (const beatmap of this.beatmaps.values()) {
            if (beatmap.unique_id === unique_id) {
                beatmaps.push(beatmap);
            }
        }
        return beatmaps;
    }

    add_beatmap(md5, beatmap) {
        if (!md5 || !beatmap) {
            console.log("[BeatmapManager] failed to add beatmap (missing data)");
            return false;
        }

        this.beatmaps.set(md5, beatmap);

        // update beatmapset if it exists
        const beatmapset_id = beatmap.beatmapset_id;
        if (this.beatmapsets.has(beatmapset_id)) {
            const beatmapset = this.beatmapsets.get(beatmapset_id);
            // check if beatmap already exists in set
            const existing_index = beatmapset.beatmaps.findIndex((b) => b.md5 == md5);
            if (existing_index >= 0) {
                beatmapset.beatmaps[existing_index] = beatmap;
            } else {
                beatmapset.beatmaps.push(beatmap);
            }
        } else {
            // create new beatmapset
            this.beatmapsets.set(beatmapset_id, {
                beatmapset_id: beatmapset_id,
                artist: beatmap.artist,
                artist_unicode: beatmap.artist_unicode,
                title: beatmap.title,
                title_unicode: beatmap.title_unicode,
                mapper: beatmap.mapper,
                source: beatmap.source,
                tags: beatmap.tags,
                audio_file_name: beatmap.audio_file_name,
                unique_id: beatmap.unique_id,
                folder_name: beatmap.folder_name,
                last_modification: beatmap.last_modification,
                downloaded: beatmap.downloaded,
                local: beatmap.local,
                audio_path: beatmap.audio_path,
                image_path: beatmap.image_path,
                beatmaps: [beatmap]
            });
        }

        return true;
    }

    remove_beatmap(md5) {
        const beatmap = this.beatmaps.get(md5);
        if (!beatmap) {
            return false;
        }

        this.beatmaps.delete(md5);

        // remove from beatmapset
        const beatmapset_id = beatmap.beatmapset_id;
        if (this.beatmapsets.has(beatmapset_id)) {
            const beatmapset = this.beatmapsets.get(beatmapset_id);
            beatmapset.beatmaps = beatmapset.beatmaps.filter((b) => b.md5 != md5);

            // if no more beatmaps in set, remove the set
            if (beatmapset.beatmaps.length === 0) {
                this.beatmapsets.delete(beatmapset_id);
            }
        }

        return true;
    }

    filter_beatmaps(criteria = {}) {
        const results = [];

        for (const beatmap of this.beatmaps.values()) {
            let matches = true;

            if (criteria.status && beatmap.status_text != criteria.status) {
                matches = false;
            }

            if (criteria.mode != undefined && beatmap.mode != criteria.mode) {
                matches = false;
            }

            if (criteria.downloaded != undefined && beatmap.downloaded != criteria.downloaded) {
                matches = false;
            }

            if (criteria.beatmapset_id && beatmap.beatmapset_id != criteria.beatmapset_id) {
                matches = false;
            }

            if (matches) {
                results.push(beatmap.md5);
            }
        }

        return results;
    }

    filter_beatmapsets(criteria = {}) {
        const results = [];

        for (const beatmapset of this.beatmapsets.values()) {
            let matches = true;

            if (criteria?.artist && !beatmapset.artist.toLowerCase().includes(criteria.artist.toLowerCase())) {
                matches = false;
            }

            if (criteria?.title && !beatmapset.title.toLowerCase().includes(criteria.title.toLowerCase())) {
                matches = false;
            }

            if (criteria?.mapper && !beatmapset.mapper.toLowerCase().includes(criteria.mapper.toLowerCase())) {
                matches = false;
            }

            if (criteria?.downloaded != undefined && beatmapset.downloaded != criteria.downloaded) {
                matches = false;
            }

            if (matches) {
                results.push({
                    beatmapset_id: beatmapset.beatmapset_id,
                    md5: beatmapset.md5,
                    beatmaps: beatmapset.beatmaps.map((b) => b.md5)
                });
            }
        }

        return results;
    }

    get_stats() {
        return {
            total_beatmaps: this.beatmaps.size,
            total_beatmapsets: this.beatmapsets.size,
            downloaded_beatmaps: this.filter_beatmaps({ downloaded: true }).length,
            downloaded_beatmapsets: this.filter_beatmapsets({ downloaded: true }).length,
            modes: this.get_mode_distribution(),
            statuses: this.get_status_distribution()
        };
    }

    get_mode_distribution() {
        const modes = {};
        for (const beatmap of this.beatmaps.values()) {
            const mode = beatmap.mode || 0;
            modes[mode] = (modes[mode] || 0) + 1;
        }
        return modes;
    }

    get_status_distribution() {
        const statuses = {};
        for (const beatmap of this.beatmaps.values()) {
            const status = beatmap.status_text || "unknown";
            statuses[status] = (statuses[status] || 0) + 1;
        }
        return statuses;
    }

    clear() {
        this.beatmaps.clear();
        this.beatmapsets.clear();
        this.version = null;
        this.folders = null;
        this.account_unlocked = null;
        this.last_unlocked_time = null;
        this.player_name = null;
        this.beatmaps_count = null;
        this.extra_start = null;
        this.permission_id = null;
        this.file_path = null;
    }

    get_raw_data() {
        return {
            version: this.version,
            folders: this.folders,
            account_unlocked: this.account_unlocked,
            last_unlocked_time: this.last_unlocked_time,
            player_name: this.player_name,
            beatmaps_count: this.beatmaps_count,
            beatmaps: this.beatmaps,
            beatmapsets: this.beatmapsets,
            extra_start: this.extra_start,
            permission_id: this.permission_id,
            file_path: this.file_path
        };
    }
}

export const beatmap_manager = new BeatmapManager();
