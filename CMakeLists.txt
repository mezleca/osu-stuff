cmake_minimum_required(VERSION 3.20)
project(osu-stuff VERSION 3.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

if(MSVC)
    set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>DLL")
endif()

if(NOT CMAKE_CONFIGURATION_TYPES AND NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

find_package(OpenGL REQUIRED)

if(WIN32)
    # manually build sdl on windows
    add_subdirectory(vendor/SDL)
else()
    find_package(SDL3 REQUIRED)
endif()

# setup imgui sources / backends
file(GLOB IMGUI_CORE_SOURCES "vendor/imgui/*.cpp")
set(IMGUI_BACKEND_SOURCES
    "vendor/imgui/backends/imgui_impl_sdl3.cpp"
    "vendor/imgui/backends/imgui_impl_opengl3.cpp"
)

# setup submodules
add_subdirectory(vendor/fmt)
add_subdirectory(vendor/miniz)
add_subdirectory(vendor/realm-cpp)
add_subdirectory(vendor/utf8proc)

include(FetchContent)

file(GLOB_RECURSE SOURCES CONFIGURE_DEPENDS "src/*.cpp")
file(GLOB_RECURSE HEADERS CONFIGURE_DEPENDS "src/*.hpp")

add_executable(${PROJECT_NAME}
    ${SOURCES}
    ${HEADERS}
    ${IMGUI_CORE_SOURCES}
    ${IMGUI_BACKEND_SOURCES}
)

target_include_directories(${PROJECT_NAME} PRIVATE
    vendor/*/include/
    vendor/imgui/
    vendor/imgui/backends
)

target_link_libraries(${PROJECT_NAME} PRIVATE
    cpprealm
    miniz
    utf8proc
    fmt::fmt
    OpenGL::GL
    SDL3::SDL3
)

if(MSVC)
    target_compile_definitions(${PROJECT_NAME} PRIVATE
        WIN32_LEAN_AND_MEAN
        NOMINMAX
        VC_EXTRALEAN
    )

    target_compile_options(${PROJECT_NAME} PRIVATE
        /W4
        /EHsc
        /utf-8
        /wd5105
        /Zc:preprocessor

        $<$<CONFIG:Debug>:/Z7>
        $<$<CONFIG:Release>:/O2 /DNDEBUG>
    )

    target_compile_options(cpprealm PRIVATE /Zc:preprocessor)
else()
    target_compile_options(${PROJECT_NAME} PRIVATE -Wall -Wextra -Wpedantic)
endif()

if(WIN32)
    # https://wiki.libsdl.org/SDL3/README-cmake#how-do-i-copy-a-sdl3-dynamic-library-to-another-location
    add_custom_command(
        TARGET ${PROJECT_NAME} POST_BUILD
        COMMAND "${CMAKE_COMMAND}" -E copy $<TARGET_FILE:SDL3::SDL3-shared> $<TARGET_FILE_DIR:${PROJECT_NAME}>
        VERBATIM
    )
endif()

# TODO: clangd works fine without this on zed editor, still need to check vscode tought
add_custom_target(copy_compile_commands ALL
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
    ${CMAKE_BINARY_DIR}/compile_commands.json
    ${CMAKE_CURRENT_SOURCE_DIR}/compile_commands.json
)
