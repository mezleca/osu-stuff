cmake_minimum_required(VERSION 3.25)
project(osu-stuff VERSION 3.0.0 LANGUAGES CXX)

option(USE_VENDORED_SDL "force vendored sdl" OFF)
option(OSU_STUFF_BUILD_TESTS "build project tests" OFF)

function(configure_sdl)
    if(USE_VENDORED_SDL)
        add_subdirectory(vendor/SDL EXCLUDE_FROM_ALL)
        return()
    endif()

    find_package(SDL3 QUIET CONFIG)

    if(SDL3_FOUND)
        return()
    endif()

    find_package(PkgConfig QUIET)

    if(PkgConfig_FOUND)
        pkg_check_modules(SDL3_PKG QUIET IMPORTED_TARGET sdl3)
        if(SDL3_PKG_FOUND)
            add_library(SDL3::SDL3 INTERFACE IMPORTED)
            set_property(TARGET SDL3::SDL3 PROPERTY INTERFACE_LINK_LIBRARIES PkgConfig::SDL3_PKG)
            return()
        endif()
    endif()

    message(FATAL_ERROR "SDL3 not found.")
endfunction()

include(GNUInstallDirs)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

if(NOT DEFINED OUTPUT_NAME OR OUTPUT_NAME STREQUAL "")
    set(OUTPUT_NAME "${PROJECT_NAME}")
endif()

if(NOT CMAKE_CONFIGURATION_TYPES AND NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

set(SQLITECPP_BUILD_TESTS OFF)

find_package(OpenGL REQUIRED)

if(MSVC)
    set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>DLL")
    set(SQLITECPP_INTERNAL_SQLITE ON)
endif()

configure_sdl()

add_subdirectory(vendor/glad)
add_subdirectory(vendor/miniz)
add_subdirectory(vendor/sqlitecpp)
add_subdirectory(vendor/realm-cpp)
add_subdirectory(vendor/utf8proc)

file(GLOB_RECURSE SOURCES CONFIGURE_DEPENDS "src/*.cpp")
file(GLOB_RECURSE HEADERS CONFIGURE_DEPENDS "src/*.hpp")
file(GLOB IMGUI_CORE_SOURCES "vendor/imgui/*.cpp")

set(IMGUI_BACKEND_SOURCES
    "vendor/imgui/backends/imgui_impl_sdl3.cpp"
    "vendor/imgui/backends/imgui_impl_opengl3.cpp"
)

set(IMGUI_CPP_WRAPPER
    "vendor/imgui/misc/cpp/imgui_stdlib.cpp"
    "vendor/imgui/misc/cpp/imgui_stdlib.h"
)

list(FILTER SOURCES EXCLUDE REGEX ".*/main\\.cpp$")

add_executable(${PROJECT_NAME} src/main.cpp)
set_target_properties(${PROJECT_NAME} PROPERTIES OUTPUT_NAME "${OUTPUT_NAME}")
target_link_libraries(${PROJECT_NAME} PRIVATE osu-stuff-core)

add_library(osu-stuff-core OBJECT
    ${SOURCES}
    ${HEADERS}
    ${IMGUI_CORE_SOURCES}
    ${IMGUI_BACKEND_SOURCES}
    ${IMGUI_CPP_WRAPPER}
)

target_include_directories(${PROJECT_NAME}-core PUBLIC
    src/
    vendor/imgui/
    vendor/imgui/backends
    vendor/imgui/misc/cpp/
    vendor/stb/
)

target_link_libraries(${PROJECT_NAME}-core PUBLIC
    OpenGL::GL
    glad
    SDL3::SDL3
    miniz
    cpprealm
    utf8proc
    SQLiteCpp
    sqlite3
)

# https://wiki.libsdl.org/SDL3/README-cmake#how-do-i-copy-a-sdl3-dynamic-library-to-another-location
if(WIN32 AND TARGET SDL3::SDL3-shared)
    add_custom_command(
        TARGET ${PROJECT_NAME} POST_BUILD
        COMMAND "${CMAKE_COMMAND}" -E copy $<TARGET_FILE:SDL3::SDL3-shared> $<TARGET_FILE_DIR:${PROJECT_NAME}>
        VERBATIM
    )
endif()

if(MSVC)
    target_compile_definitions(${PROJECT_NAME}-core PUBLIC
        WIN32_LEAN_AND_MEAN
        NOMINMAX
        VC_EXTRALEAN
    )

    target_compile_options(${PROJECT_NAME}-core PUBLIC
        /W4
        /EHsc
        /utf-8
        /wd5105
        /Zc:preprocessor
    )
else()
    target_compile_options(${PROJECT_NAME}-core PUBLIC
        -Wall
        -Wextra
        -Wpedantic

        $<$<CONFIG:Debug>:-O0 -g3>
        $<$<CONFIG:Release>:-O2 -DNDEBUG>
    )
endif()

install(TARGETS ${PROJECT_NAME}
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)

install(DIRECTORY resources/
    DESTINATION ${CMAKE_INSTALL_BINDIR}/resources
)

if(OSU_STUFF_BUILD_TESTS)
    add_subdirectory(vendor/Catch2 EXCLUDE_FROM_ALL)

    list(APPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/vendor/Catch2/extras")

    include(Catch)
    include(CTest)

    add_subdirectory(tests)
endif()
