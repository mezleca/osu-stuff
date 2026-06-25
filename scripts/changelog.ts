import fs from "fs";

const [version, include_versions_raw, output_file] = process.argv.slice(2);
const NOTES_FILE = "changelog/notes.md";
const VERSION_HEADER_PATTERN = /^#\s+v?\d+\.\d+\.\d+(?:[-+][\w.-]+)?\s*$/i;

const normalize_version = (ver: string): string => {
    return ver.trim().replace(/^v/i, "");
};

const is_matching_version_header = (line: string, expected_version: string): boolean => {
    if (!VERSION_HEADER_PATTERN.test(line)) {
        return false;
    }

    const header_version = line.replace(/^#\s+/i, "").trim();
    return normalize_version(header_version) == normalize_version(expected_version);
};

const is_version_header = (line: string): boolean => {
    return VERSION_HEADER_PATTERN.test(line);
};

const extract_version = (ver: string, content: string) => {
    const lines = content.split("\n");

    let capturing = false;
    let found_header = false;
    let result: Array<string> = [];

    for (const line of lines) {
        if (is_matching_version_header(line, ver)) {
            capturing = true;
            found_header = true;
            continue;
        }

        if (capturing && is_version_header(line)) {
            break;
        }

        if (capturing) {
            result.push(line);
        }
    }

    // if found header but no content, just return an empty string idk
    if (found_header && result.length === 0) {
        return "";
    }

    return result.length > 0 ? result.join("\n").trim() : "_changelog not found..._";
};

(() => {
    if (!fs.existsSync(NOTES_FILE)) {
        console.log(`[log] ${NOTES_FILE} not found, creating empty output`);
        fs.writeFileSync(output_file, "");
        return;
    }

    const content = fs.readFileSync(NOTES_FILE, "utf-8");

    // extract main version
    console.log(`[log] extracting notes for ${version}`);
    const main_notes = extract_version(version, content);
    let all_notes = main_notes;

    // extract additional versions
    if (include_versions_raw && include_versions_raw.trim()) {
        const versions = include_versions_raw
            .split(",")
            .map((v) => v.trim())
            .filter((v) => v);

        for (const ver of versions) {
            console.log(`[log] extracting notes for ${ver}`);
            const ver_notes = extract_version(ver, content);

            if (all_notes) {
                all_notes += `\n\n---\n\n# ${ver}\n\n${ver_notes}`;
            } else if (main_notes === "") {
                all_notes = `# ${version}\n\n---\n\n# ${ver}\n\n${ver_notes}`;
            } else {
                all_notes = `# ${ver}\n\n${ver_notes}`;
            }
        }
    }

    console.log("[log] writing output to", output_file);
    fs.writeFileSync(output_file, all_notes, "utf-8");
    console.log("[log] changelog extraction complete");
})();
