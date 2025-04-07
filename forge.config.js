import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
	packagerConfig: {
		asar: true,
		icon: path.resolve(__dirname, "./build/icons/win/icon"),
		executableName: "osu-stuff",
		appBundleId: "com.osustuff.app",
		ignore: [
			"\\.git(ignore|modules)",
			"node_modules/\\.bin",
			"\\.vscode",
			"test",
			"tests",
			"node_modules/realm/prebuilds/android-*",
			"node_modules/realm/prebuilds/apple-*",
		].filter(Boolean),
	},
	rebuildConfig: {},
	makers: [
		{
			name: "@electron-forge/maker-squirrel",
			config: {
				name: "osu-stuff",
				setupIcon: path.resolve(
					__dirname,
					"./build/icons/win/icon.ico",
				),
				setupExe: `osu-stuff-${process.env.npm_package_version}.exe`,
				noMsi: false,
				requireAdministrator: true,
			},
		},
		{
			name: "@electron-forge/maker-zip",
			platforms: ["darwin"],
		},
		{
			name: "@electron-forge/maker-deb",
			config: {
				options: {
					icon: path.resolve(
						__dirname,
						"./build/icons/png/256x256.png",
					),
					categories: ["Utility"],
				},
			},
		},
		{
			name: "@reforged/maker-appimage",
			config: {
				options: {
					categories: ["Network"],
					icon: path.resolve(
						__dirname,
						"./build/icons/png/256x256.png",
					),
				},
			},
		},
	],
};
