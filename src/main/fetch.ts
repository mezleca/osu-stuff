import { net } from "electron";
import { build_fetch_options, build_fetch_result, FetchError, FetchOptions, GenericResult, get_fetch_error } from "../shared/types";
import { IFetchResponse } from "../shared/types";

import fs from "fs";
import path from "path";

export class MediaManager {
    constructor() {}

    get(location: string): GenericResult<ArrayBuffer> {
        const resolved = path.resolve(location);

        if (!fs.existsSync(resolved)) {
            return { success: false, reason: "invalid path" };
        }

        const buffer = fs.readFileSync(resolved);
        return { success: true, data: buffer.buffer };
    }
}

export class FetchManager {
    constructor() {}

    validate_options(options: FetchOptions): IFetchResponse {
        const result = build_fetch_result();

        if (!options.url) {
            result.error = get_fetch_error(FetchError.INVALID_URL);
        }

        if (typeof options.url != "string") {
            result.error = get_fetch_error(FetchError.MISSING_URL);
        }

        return result;
    }

    prepare_body(options: FetchOptions): FetchOptions {
        if (options.method == "") {
            options.method = "GET";
        }

        if (options.form_data) {
            const form = new FormData();

            // not sure if ipc handles the formData so i will just use an object for now
            for (const [key, value] of Object.entries(options.form_data)) {
                form.append(key, value);
            }

            options.body = form;

            // prevent trolling
            if (options.headers) {
                delete options.headers["content-type"];
            }
        } else if (options.body) {
            if (typeof options.body == "object") {
                options.body = JSON.stringify(options.body);
                if (options.headers) {
                    options.headers["content-type"] = "application/json";
                }
            } else {
                options.body = options.body;
            }
        }

        return options;
    }

    async parse_response(response: Response): Promise<any> {
        const content_type = response.headers.get("content-type") || "";

        if (content_type.includes("application/json")) {
            // fallback to text if json parsing fails
            try {
                return await response.json();
            } catch {
                return await response.text();
            }
        } else if (content_type.includes("text")) {
            return await response.text();
        } else {
            return await response.arrayBuffer();
        }
    }

    async handle_media_protocol(url: string): Promise<IFetchResponse> {
        const result = build_fetch_result();

        try {
            const location = decodeURI(url.replace("media://", ""));
            const response = await net.fetch(`file://${location}`);
            const data = await response.arrayBuffer();

            // :)
            result.success = true;
            result.data = data;
            result.status = response.status;
        } catch (err) {
            result.error = get_fetch_error(FetchError.MEDIA_ERROR);
            result.status = 500;
        }

        return result;
    }

    async execute(options: FetchOptions): Promise<IFetchResponse> {
        const result = build_fetch_result();

        try {
            const response = await fetch(options.url, options);
            const data = await this.parse_response(response);

            result.success = true;
            result.status = response.status;
            result.status_text = response.statusText;
            result.data = data;

            return result;
        } catch (err) {
            const error_message = err instanceof Error ? err.message : String(err);

            result.error = error_message;
            result.status = 0;

            return result;
        }
    }

    async request(params: FetchOptions): Promise<IFetchResponse> {
        const options = build_fetch_options(params);
        const validate_result = this.validate_options(options);

        if (validate_result.error) {
            return validate_result;
        }

        // handle media (files)
        if (options.url?.startsWith("media://")) {
            return this.handle_media_protocol(options.url);
        }

        const final_options = this.prepare_body(options);

        try {
            return this.execute(final_options);
        } catch (err) {
            console.error("[FetchManager] request failed:", err);

            const error_message = err instanceof Error ? err.message : String(err);

            return build_fetch_result({
                error: error_message,
                status: 0
            });
        }
    }
}

export const media_manager = new MediaManager();
export const fetch_manager = new FetchManager();
