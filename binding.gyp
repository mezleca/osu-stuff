{
  "targets": [
    {
      "target_name": "processor",
      "sources": [ "./src/modules/processor.cpp" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "conditions": [
        ["OS=='win'", {
          "conditions": [
            ["target_arch=='x64'", {
              "include_dirs": [
                "C:/vcpkg/installed/x64-windows-static/include/"
              ],
              "libraries": [
				"C:/vcpkg/installed/x64-windows-static/lib/sndfile.lib",
				"C:/vcpkg/installed/x64-windows-static/lib/FLAC.lib",
				"C:/vcpkg/installed/x64-windows-static/lib/ogg.lib",
				"C:/vcpkg/installed/x64-windows-static/lib/vorbis.lib",
				"C:/vcpkg/installed/x64-windows-static/lib/vorbisenc.lib",
				"C:/vcpkg/installed/x64-windows-static/lib/vorbisfile.lib",
				"C:/vcpkg/installed/x64-windows-static/lib/opus.lib",
				"C:/vcpkg/installed/x64-windows-static/lib/mpg123.lib",
				"C:/vcpkg/installed/x64-windows-static/lib/libmp3lame-static.lib",
				"C:/vcpkg/installed/x64-windows-static/lib/libmpghip-static.lib",
				"Shlwapi.lib"
              ],
              "defines": [
                "FLAC__NO_DLL",
                "LIBSNDFILE_STATIC"
              ]
            }]
          ]
        }],
        ["OS=='linux'", {
			"include_dirs": [
				"<!@(pkg-config --cflags-only-I sndfile | sed s/-I//g)"
			],
			"libraries": [
				"<!@(pkg-config --libs --static sndfile)"
			],
			"cflags_cc": [
				"-std=c++17",
				"<!@(pkg-config --cflags sndfile)"
			]
        }]
      ],
      "cflags_cc": [
        "-std=c++17",
        "-O3"
      ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "RuntimeLibrary": 0,
          "ExceptionHandling": 1,
          "AdditionalOptions": [
            "/std:c++17"
          ]
        }
      }
    }
  ]
}