const fs = require("fs");
const JSZip = require("jszip");

import { validate_path } from "../utils/validator.js";

export const zip = {
	new: () => new JSZip(),
	file: (instance, name, data, options) => instance.file(name, data, options),
	folder: (instance, name) => instance.folder(name),
	filter: (instance, predicate) => instance.filter(predicate),
	remove: (instance, path) => instance.remove(path),
	generateAsync: (instance, options) => instance.generateAsync(options),
	loadAsync: (data, options) => JSZip.loadAsync(data, options),
	zip_file: async (files, base_path = null) => {
		const zip = new JSZip();

		for (let i = 0; i < files.length; i++) {
			const { name, location } = files[i];

			if (base_path) {
				const is_valid = await validate_path(location, base_path);

				if (!is_valid) {
					throw new Error(`invalid path: ${location}`);
				}
			}

			if (fs.statSync(location).isDirectory()) {
				continue;
			}

			zip.file(name, fs.readFileSync(location));
		}
		return zip.generateAsync({ type: "nodebuffer" });
	}
};
