export default {
  packagerConfig: {
    asar: true,
    icon: './build/icons/win/icon',
    executableName: 'osu-stuff',
    appBundleId: 'com.osustuff.app'
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'osu-stuff',
        setupIcon: './build/icons/win/icon.ico',
        setupExe: `osu-stuff-${process.env.npm_package_version}.exe`,
        noMsi: false,
        requireAdministrator: true
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: './build/icons/png/256x256.png',
          categories: ['Utility']
        }
      },
    },
    {
      name: "@reforged/maker-appimage",
      config: {
        options: {
          categories: ["Network"],
          icon: './build/icons/png/256x256.png',
        }
      }
    }
  ],
};
