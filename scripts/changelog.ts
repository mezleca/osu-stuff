import fs from "fs";

const [version, include_versions_raw, output_file] = process.argv.slice(2);
const NOTES_FILE = "changelog/notes.md";

const extract_version = (ver: string, content: string) => {
    const lines = content.split("\n");
    const header = `# ${ver}`;

    let capturing = false;
    let result: Array<string> = [];

    for (const line of lines) {
        if (line === header) {
            capturing = true;
            continue;
        }

        if (capturing && line.startsWith("# ")) {
            break;
        }

        if (capturing) {
            result.push(line);
        }
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
    let all_notes = `# ${version}\n\n${main_notes}`;

    // extract additional versions
    if (include_versions_raw && include_versions_raw.trim()) {
        const versions = include_versions_raw
            .split(",")
            .map((v) => v.trim())
            .filter((v) => v);

        for (const ver of versions) {
            console.log(`[log] extracting notes for ${ver}`);
            const ver_notes = extract_version(ver, content);
            all_notes += `\n\n# ${ver}\n\n${ver_notes}`;
        }
    }

    console.log("[log] writing output to", output_file);
    fs.writeFileSync(output_file, all_notes, "utf-8");
    console.log("[log] changelog extraction complete");
})();
