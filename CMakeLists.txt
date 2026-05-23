cmake_minimum_required(VERSION 3.20)
project(osu-stuff VERSION 3.0.0 LANGUAGES CXX)

include(GNUInstallDirs)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

option(USE_VENDORED_SDL "force vendored sdl" OFF)
option(OSU_STUFF_BUILD_TESTS "build project tests" OFF)

find_program(CCACHE_PROGRAM ccache)

if(CCACHE_PROGRAM)
    set(CMAKE_C_COMPILER_LAUNCHER ${CCACHE_PROGRAM})
    set(CMAKE_CXX_COMPILER_LAUNCHER ${CCACHE_PROGRAM})
endif()

if(NOT DEFINED OUTPUT_NAME OR OUTPUT_NAME STREQUAL "")
    set(OUTPUT_NAME "${PROJECT_NAME}")
endif()

if(MSVC)
    set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>DLL")
endif()

if(NOT CMAKE_CONFIGURATION_TYPES AND NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

find_package(OpenGL REQUIRED)

if(WIN32 OR USE_VENDORED_SDL)
    add_subdirectory(vendor/SDL)
else()
    find_package(SDL3 REQUIRED)
endif()

add_subdirectory(vendor/miniz)
add_subdirectory(vendor/realm-cpp)
add_subdirectory(vendor/utf8proc)

file(GLOB_RECURSE SOURCES CONFIGURE_DEPENDS "src/*.cpp")
file(GLOB_RECURSE HEADERS CONFIGURE_DEPENDS "src/*.hpp")
file(GLOB IMGUI_CORE_SOURCES "vendor/imgui/*.cpp")

set(IMGUI_BACKEND_SOURCES
    "vendor/imgui/backends/imgui_impl_sdl3.cpp"
    "vendor/imgui/backends/imgui_impl_opengl3.cpp"
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
)

target_include_directories(${PROJECT_NAME}-core PUBLIC
    src/
    vendor/imgui/
    vendor/imgui/backends
)

target_link_libraries(${PROJECT_NAME}-core PUBLIC
    miniz
    cpprealm
    utf8proc
    OpenGL::GL
    SDL3::SDL3
)

if(MSVC)
    string(REPLACE "/Zi" "/Z7" CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG}")
    string(REPLACE "/Zi" "/Z7" CMAKE_C_FLAGS_DEBUG "${CMAKE_C_FLAGS_DEBUG}")

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

        $<$<CONFIG:Debug>:/Z7>
        $<$<CONFIG:Release>:/O2 /DNDEBUG>
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

# https://wiki.libsdl.org/SDL3/README-cmake#how-do-i-copy-a-sdl3-dynamic-library-to-another-location
if(WIN32)
    add_custom_command(
        TARGET ${PROJECT_NAME} POST_BUILD
        COMMAND "${CMAKE_COMMAND}" -E copy $<TARGET_FILE:SDL3::SDL3-shared> $<TARGET_FILE_DIR:${PROJECT_NAME}>
        VERBATIM
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
