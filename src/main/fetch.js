import { net } from "electron";

export class FetchManager {
    constructor() {
        this.response_template = {
            success: false,
            status: 0,
            data: null,
            error: null,
            headers: {}
        };
    }

    validate_options(options) {
        if (!options.url) {
            return { error: "missing url parameter" };
        }

        if (typeof options.url != "string") {
            return { error: "url has invalid type: " + typeof options.url };
        }
        
        return null;
    }

    prepare_body(options, fetch_options) {
        if (options.form_data) {
            const form = new FormData();

            // handle form data
            // not sure if ipc handles the formData so i will just use an object for now
            for (const [key, value] of Object.entries(options.form_data)) {
                if (value instanceof Buffer) {
                    form.append(key, new Blob([value]), value.filename || "file");
                } else {
                    form.append(key, value);
                }
            }

            fetch_options.body = form;
            delete fetch_options.headers["content-type"];
        } else if (options.body) {
            if (typeof options.body == "object") {
                fetch_options.body = JSON.stringify(options.body);
                fetch_options.headers["content-type"] = "application/json";
            } else {
                fetch_options.body = options.body;
            }
        }
    }

    async parse_response(response) {
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

    create_response(response, data) {
        return {
            success: response.ok,
            status: response.status,
            data: data,
            error: response.ok ? null : response.statusText,
            headers: Object.fromEntries(response.headers.entries())
        };
    }

    async handle_media_protocol(url) {
        const location = decodeURI(url.replace("media://", ""));
        const response = await net.fetch(`file://${location}`);
        const data = await response.arrayBuffer();

        return this.create_response(response, data);
    }

    async execute(options, fetch_options) {
        const response = await fetch(options.url, fetch_options);
        const data = await this.parse_response(response);
        return this.create_response(response, data);
    }

    async request(options = {}) {
        const error = this.validate_options(options);

        if (error) {
            return { ...this.response_template, ...error };
        }

        // handle media
        if (options.url?.startsWith("media://")) {
            try {
                return await this.handle_media_protocol(options.url);
            } catch (err) {
                console.error("[FetchManager] media failed:", err.message);
                return {
                    ...this.response_template,
                    error: err.message
                };
            }
        }

        const fetch_options = {
            method: options.method || "GET",
            headers: options.headers || {}
        };

        this.prepare_body(options, fetch_options);

        try {
            return await this.execute(options, fetch_options);
        } catch (err) {
            console.error("[FetchManager] request failed:", err.message);
            return {
                ...this.response_template,
                error: err.message
            };
        }
    }
}
