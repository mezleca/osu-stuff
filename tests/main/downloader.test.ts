import { beforeEach, describe, expect, test, vi, afterEach } from "vitest";
import { beatmap_downloader } from "@main/osu/downloader";
import type { IDownloadData, IDownloadedBeatmap } from "@shared/types";

const make_beatmap = (md5: string): IDownloadedBeatmap => ({
    md5
});

const make_download = (id: string, paused: boolean, count = 1): IDownloadData =>
    ({
        id,
        beatmaps: Array.from({ length: count }, (_, i) => make_beatmap(`${id}-${i}`)),
        progress: {
            id,
            paused,
            current: 0,
            length: count
        }
    }) as IDownloadData;

describe("downloader", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    beforeEach(() => {
        const downloader = beatmap_downloader as any;
        downloader.queue = new Map();
        downloader.current_download_id = null;
        downloader.has_mirrors = () => true;
        downloader.notify_update = () => {};
        downloader.process_download = vi.fn(() => new Promise<boolean>(() => {}));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    test("queue transitions between downloads keep a single active item", () => {
        const downloader = beatmap_downloader as any;
        const d1 = make_download("d1", false, 2);
        const d2 = make_download("d2", false, 2);

        expect(beatmap_downloader.add_to_queue(d1)).toBe(true);
        expect(beatmap_downloader.add_to_queue(d2)).toBe(true);

        vi.advanceTimersByTime(150);

        expect(downloader.current_download_id).toBe("d1");
        expect(downloader.queue.get("d1")?.progress?.paused).toBe(false);
        expect(downloader.queue.get("d2")?.progress?.paused).toBe(true);
        expect(beatmap_downloader.is_active()).toBe(true);

        expect(beatmap_downloader.remove_from_queue("d1")).toBe(true);
        vi.advanceTimersByTime(150);

        expect(downloader.current_download_id).toBe("d2");
        expect(downloader.queue.get("d2")?.progress?.paused).toBe(false);
        expect(beatmap_downloader.is_active()).toBe(true);
    });

    test("pause/resume current download", () => {
        const downloader = beatmap_downloader as any;
        const d1 = make_download("d1", false, 2);

        expect(beatmap_downloader.add_to_queue(d1)).toBe(true);
        vi.advanceTimersByTime(150);

        expect(beatmap_downloader.pause("d1")).toBe(true);
        expect(downloader.queue.get("d1")?.progress?.paused).toBe(true);
        expect(beatmap_downloader.is_active()).toBe(false);

        expect(beatmap_downloader.resume("d1")).toBe(true);
        expect(downloader.queue.get("d1")?.progress?.paused).toBe(false);
        expect(beatmap_downloader.is_active()).toBe(true);
    });
});
