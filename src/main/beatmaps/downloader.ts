import { BrowserWindow } from "electron";
import { config } from "../database/config";
import { BeatmapFile, ExportResult, GenericResult, IBeatmapResult, IExportUpdatePayload } from "@shared/types";
import { get_driver } from "../drivers/driver";

import fs from "fs";
import path from "path";
// @ts-ignore
import AdmZip from "adm-zip";

export class BeatmapExporter {
    private window: BrowserWindow | null = null;

    initialize(window: BrowserWindow) {
        this.window = window;
    }

    private emit_update(data: IExportUpdatePayload) {
        try {
            if (this.window) {
                this.window.webContents.send("export:update", data);
            }
        } catch (err) {
            const error = err as string;
            console.log("[export] failed to emit update:", error);
        }
    }

    private ensure_directory(dir_path: string): boolean {
        try {
            if (!fs.existsSync(dir_path)) {
                fs.mkdirSync(dir_path, { recursive: true });
            }
            return true;
        } catch (err) {
            const error = err as string;
            console.log(`[export] failed to create directory ${dir_path}:`, error);
            return false;
        }
    }

    private create_zip_from_files(files: BeatmapFile[], target_path: string): boolean {
        try {
            const zip = new AdmZip();

            for (const file of files) {
                try {
                    zip.addLocalFile(file.location, file.name, file.name);
                } catch (err) {
                    const error = err as { message: string };
                    console.log(`[export] failed to add file ${file.location}:`, error.message);
                }
            }

            zip.writeZip(target_path);
            return true;
        } catch (err) {
            const error = err as string;
            console.log(`[export] failed to create zip:`, error);
            return false;
        }
    }

    private async export_beatmap_to_path(beatmap: IBeatmapResult, target: string): Promise<GenericResult<string>> {
        if (fs.existsSync(target)) {
            return { success: true, data: "" };
        }

        try {
            const driver = get_driver();
            const files = driver.get_beatmapset_files(beatmap.beatmapset_id);

            if (files.length == 0) {
                return { success: false, reason: "found 0 files to export..." };
            }

            const success = this.create_zip_from_files(files, target);

            if (!success) {
                return { success: false, reason: "failed to create zip file" };
            }

            return { success: true, data: target };
        } catch (err) {
            const error = err as string;
            console.log(`[export] failed to export beatmap:`, error);
            return { success: false, reason: error };
        }
    }

    async export_single(md5: string): Promise<GenericResult<string>> {
        if (!md5) {
            return { success: false, reason: "invalid md5" };
        }

        try {
            this.emit_update({ md5, status: "start" });

            if (!config.get().export_path) {
                const reason = "no export path configured";
                this.emit_update({ md5, status: "error", reason });
                return { success: false, reason };
            }

            if (!this.ensure_directory(config.get().export_path)) {
                const reason = "failed to create export directory";
                this.emit_update({ md5, status: "error", reason });
                return { success: false, reason };
            }

            const driver = get_driver();
            const beatmap_data = driver.get_beatmap_by_md5(md5);

            if (!beatmap_data) {
                const reason = "beatmap not found";
                this.emit_update({ md5, status: "error", reason });
                return { success: false, reason };
            }

            const id = beatmap_data.beatmapset_id || beatmap_data.online_id || md5 || Date.now();
            const filename = `${id}.osz`;
            const target_path = path.join(config.get().export_path, filename);
            const export_result = await this.export_beatmap_to_path(beatmap_data, target_path);

            if (!export_result.success) {
                return { success: false, reason: export_result.reason };
            }

            this.emit_update({
                md5: md5,
                status: export_result.data != "" ? "exists" : "done",
                path: export_result.data
            });

            return {
                success: true,
                data: export_result.data
            };
        } catch (err) {
            const error = err as { message: string };
            console.log(`[export] error:`, error);
            this.emit_update({ md5, status: "error" });
            return { success: false, reason: error.message };
        }
    }

    async export_batch(md5_list: string[], export_path: string, get_beatmap: (md5: string) => Promise<any>): Promise<ExportResult> {
        if (!Array.isArray(md5_list) || md5_list.length == 0) {
            const reason = "invalid md5 list";
            this.emit_update({ status: "error", reason });
            return { success: false, written: [], reason };
        }

        try {
            if (!export_path || !this.ensure_directory(export_path)) {
                const reason = "export path not configured or failed to create";
                this.emit_update({ status: "error", reason });
                return { success: false, written: [], reason };
            }

            const exported_cache = new Map();
            const written_files = [];

            this.emit_update({ status: "start", total: md5_list.length });

            for (const md5 of md5_list) {
                try {
                    const beatmap_data = await get_beatmap(md5);

                    if (!beatmap_data?.beatmapset_id) {
                        this.emit_update({ status: "missing", md5 });
                        continue;
                    }

                    const id = String(beatmap_data.beatmapset_id);
                    const target_path = path.join(export_path, `${id}.osz`);

                    if (exported_cache.has(id)) {
                        await this.handle_cached_beatmap(id, target_path, exported_cache);
                    } else {
                        await this.handle_new_beatmap(beatmap_data, id, target_path, exported_cache);
                    }

                    written_files.push(target_path);
                } catch (err) {
                    const error = err as { message: string };
                    console.log(`[export] error processing beatmap ${md5}:`, error);
                    this.emit_update({ status: "missing", md5 });
                }
            }

            const success = written_files.length > 0;

            if (success) {
                console.log(`[export] batch finished, exported ${written_files.length} files`);
                this.emit_update({ status: "complete", written: written_files.length });
            } else {
                const reason = "no files were exported";
                console.log(`[export] batch finished with zero exports`);
                this.emit_update({ status: "error", reason });
            }

            return { success, written: written_files, reason: success ? "" : "no files were exported" };
        } catch (err) {
            const error = err as { message: string };
            const reason = `export failed: ${error.message}`;
            this.emit_update({ status: "error", reason });
            return { success: false, written: [], reason };
        }
    }

    private async handle_cached_beatmap(id: string, target_path: string, exported_cache: Map<string, string>) {
        if (fs.existsSync(target_path)) {
            this.emit_update({
                beatmapset_id: id,
                status: "exists",
                path: target_path
            });
            return;
        }

        const existing_path = exported_cache.get(id);

        if (!existing_path) {
            return;
        }

        try {
            try {
                fs.linkSync(existing_path, target_path);
            } catch (link_err) {
                fs.copyFileSync(existing_path, target_path);
            }

            this.emit_update({
                beatmapset_id: id,
                status: "linked",
                path: target_path
            });
        } catch (err) {
            const error = err as { message: string };
            console.log(`[export] failed to link/copy for ${id}:`, error.message);
        }
    }

    private async handle_new_beatmap(beatmap_data: any, id: string, target_path: string, exported_cache: Map<string, string>) {
        const export_result = await this.export_beatmap_to_path(beatmap_data, target_path);
        exported_cache.set(id, target_path);

        if (!export_result.success) {
            return;
        }

        const status = export_result.data ? "exists" : "done";

        this.emit_update({
            beatmapset_id: id,
            status,
            path: target_path
        });
    }
}

export const beatmap_exporter = new BeatmapExporter();
