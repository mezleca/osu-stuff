#ifndef SourceDir
  #error SourceDir is required
#endif

#ifndef OutputDir
  #error OutputDir is required
#endif

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

#define AppName "osu-stuff"
#define AppPublisher "mezleca"
#define AppUrl "https://github.com/mezleca/osu-stuff"
#define AppExecutable "osu-stuff.exe"

[Setup]
AppId={{51E851CD-6BC9-4EA7-B538-1D5006BC5A0A}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppUrl}
AppSupportURL={#AppUrl}/issues
AppUpdatesURL={#AppUrl}/releases
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
UninstallDisplayIcon={app}\{#AppExecutable}
OutputDir={#OutputDir}
OutputBaseFilename={#AppName}-{#AppVersion}-setup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExecutable}"; WorkingDir: "{app}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExecutable}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExecutable}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent
