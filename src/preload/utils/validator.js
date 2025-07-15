const path = require("path");
const fs = require("fs");
const os = require("os");

const { exec } = require("child_process");

export const check_folder_permissions = async (folder) => {
	try {
		const test_file = path.join(folder, `test-${Date.now()}.tmp`);
		const test_file_renamed = path.join(folder, "renamed-test.tmp");

		fs.writeFileSync(test_file, "test");
		fs.readFileSync(test_file);
		fs.renameSync(test_file, test_file_renamed);
		fs.unlinkSync(test_file_renamed);

		const first_file = fs.readdirSync(folder)[0];

		if (first_file) {
			const file_path = path.join(folder, first_file);
			const stats = fs.statSync(file_path);
			const is_dir = (stats.mode & 0o170000) == 0o040000;
			const temp_name = path.join(folder, is_dir ? "stufttest0101" : "renamed-test.tmp");
			fs.renameSync(file_path, temp_name);
			fs.renameSync(temp_name, file_path);
		}

		return true;
	} catch (err) {
		console.log("folder perm error:", err);
		return false;
	}
};

export const get_linux_path = async () => {
	const default_path = path.join(os.homedir(), ".local", "share", "osu-wine", "osu!");
	const custom_path = path.join(os.homedir(), ".local/share/osuconfig/osupath");

	if (fs.existsSync(default_path)) {
		return default_path;
	}

	const result = await new Promise((resolve, reject) => {
		exec(`[ -e "$HOME/.local/share/osuconfig/osupath" ] && echo "1"`, (err, stdout, stderr) => {
			if (err) {
				return resolve("");
			}

			if (stderr) {
				return resolve("");
			}

			if (stdout.trim() == "1" && fs.existsSync(custom_path)) {
				return resolve(fs.readFileSync(custom_path, "utf-8").split("\n")[0]);
			}

			return resolve("");
		});
	});

	return result;
};
