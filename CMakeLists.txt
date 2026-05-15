cmake_minimum_required(VERSION 3.20)
project(osu-stuff VERSION 3.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

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

# manually build sdl on windows
if(WIN32)
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

file(GLOB_RECURSE CORE_SOURCES CONFIGURE_DEPENDS
    "src/clients/*.cpp"
    "src/parser/*.cpp"
)

file(GLOB_RECURSE CORE_HEADERS CONFIGURE_DEPENDS
    "src/clients/*.hpp"
    "src/parser/*.hpp"
    "src/schemas/*.hpp"
    "src/utils/*.hpp"
)

add_library(${PROJECT_NAME}_core STATIC
    ${CORE_SOURCES}
    ${CORE_HEADERS}
)

target_link_libraries(${PROJECT_NAME}_core PUBLIC
    cpprealm
    miniz
    utf8proc
    fmt::fmt
)

add_executable(${PROJECT_NAME}
    src/main.cpp
    src/ui/ui.cpp
    src/ui/ui.hpp
    ${IMGUI_CORE_SOURCES}
    ${IMGUI_BACKEND_SOURCES}
)

set_target_properties(${PROJECT_NAME} PROPERTIES OUTPUT_NAME "${OUTPUT_NAME}")

target_include_directories(${PROJECT_NAME} PRIVATE
    vendor/imgui/
    vendor/imgui/backends
)

target_link_libraries(${PROJECT_NAME} PRIVATE
    ${PROJECT_NAME}_core
    OpenGL::GL
    SDL3::SDL3
)

if(MSVC)
    target_compile_definitions(${PROJECT_NAME}_core PRIVATE
        WIN32_LEAN_AND_MEAN
        NOMINMAX
        VC_EXTRALEAN
    )

    # set defs for osu-stuff app
    target_compile_definitions(${PROJECT_NAME} PRIVATE
        WIN32_LEAN_AND_MEAN
        NOMINMAX
        VC_EXTRALEAN
    )

    # set options for osu-stuff core
    target_compile_options(${PROJECT_NAME}_core PRIVATE
        /W4
        /EHsc
        /utf-8
        /wd5105
        /Zc:preprocessor

        $<$<CONFIG:Debug>:/Z7>
        $<$<CONFIG:Release>:/O2 /DNDEBUG>
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

    # TOFIX: is this actually needed? pretty sure realm-cpp already set this
    target_compile_options(cpprealm PRIVATE /Zc:preprocessor)
else()
    target_compile_options(${PROJECT_NAME}_core PRIVATE
        -Wall
        -Wextra
        -Wpedantic

        $<$<CONFIG:Debug>:-O0 -g3>
        $<$<CONFIG:Release>:-O2 -DNDEBUG>
    )

    target_compile_options(${PROJECT_NAME} PRIVATE
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

include(CTest)

if(BUILD_TESTING)
    add_subdirectory(vendor/realm-cpp/Catch2 EXCLUDE_FROM_ALL)

    file(GLOB_RECURSE TEST_SOURCES CONFIGURE_DEPENDS "tests/*.cpp")
    add_custom_target(${PROJECT_NAME}-test-data
        COMMAND "${CMAKE_COMMAND}"
            -DPROJECT_SOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}
            -DPROJECT_BINARY_DIR=${CMAKE_CURRENT_BINARY_DIR}
            -P "${CMAKE_CURRENT_SOURCE_DIR}/tests/cmake/fetch_test_data.cmake"
        VERBATIM
    )

    add_executable(${PROJECT_NAME}-tests
        ${TEST_SOURCES}
    )

    add_dependencies(${PROJECT_NAME}-tests ${PROJECT_NAME}-test-data)

    target_link_libraries(${PROJECT_NAME}-tests PRIVATE
        ${PROJECT_NAME}_core
        Catch2::Catch2WithMain
    )

    target_include_directories(${PROJECT_NAME}-tests PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}
    )

    list(APPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/vendor/realm-cpp/Catch2/extras")
    include(Catch)

    catch_discover_tests(${PROJECT_NAME}-tests
        WORKING_DIRECTORY "$<TARGET_FILE_DIR:${PROJECT_NAME}-tests>"
        DISCOVERY_MODE PRE_TEST
    )
endif()
