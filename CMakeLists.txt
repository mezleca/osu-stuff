cmake_minimum_required(VERSION 3.25)
project(osu-stuff VERSION 3.0.0 LANGUAGES CXX)

option(OSU_STUFF_BUILD_TESTS "Build project tests" OFF)

include(GNUInstallDirs)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

set(CPR_CURL_USE_LIBPSL FALSE CACHE BOOL "" FORCE)
set(IMGUI_UI_BUILD_SDL ON)
set(IMGUI_UI_USE_NFD ON)

if(MSVC)
    add_compile_options(/W4 /EHsc /utf-8 /wd5105 /Zc:preprocessor)
else()
    add_compile_options(-Wall -Wextra)

    if(CMAKE_CXX_COMPILER_ID MATCHES "Clang")
        add_compile_options($<$<COMPILE_LANGUAGE:CXX>:-Wdeprecated-copy-with-user-provided-copy>)
    endif()
endif()

# keep the CRT external
if(MSVC)
    set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>DLL")
endif()

find_package(OpenGL REQUIRED)

if(LINUX)
    set(CPR_USE_SYSTEM_CURL ON CACHE BOOL "" FORCE)
    find_package(CURL REQUIRED)
else()
    set(CPR_USE_SYSTEM_CURL OFF CACHE BOOL "" FORCE)
endif()

find_package(SDL3 QUIET)
if(NOT TARGET SDL3::SDL3)
    message(STATUS "using vendored sdl3")
    add_subdirectory(vendor/sdl)
endif()

find_package(SDL3_mixer QUIET)
if(NOT TARGET SDL3_mixer::SDL3_mixer)
    message(STATUS "using vendored sdl3_mixer")
    add_subdirectory(vendor/SDL3_mixer)
endif()

find_package(utf8proc QUIET)
if (NOT TARGET utf8proc)
    message(STATUS "using vendored utf8proc")
    add_subdirectory(vendor/utf8proc)
endif()

add_subdirectory(vendor/json)
add_subdirectory(vendor/cpr)
add_subdirectory(vendor/miniz)
add_subdirectory(vendor/lunasvg)
add_subdirectory(vendor/realm-cpp)
add_subdirectory(vendor/imgui-ui)

file(GLOB_RECURSE CORE_SOURCES CONFIGURE_DEPENDS "src/*.cpp")
file(GLOB_RECURSE CORE_HEADERS CONFIGURE_DEPENDS "src/*.hpp")
file(GLOB_RECURSE UI_SOURCES CONFIGURE_DEPENDS "src/ui/*.cpp")
file(GLOB_RECURSE UI_HEADERS CONFIGURE_DEPENDS "src/ui/*.hpp")

list(FILTER CORE_SOURCES EXCLUDE REGEX ".*/main\\.cpp$")
list(FILTER CORE_SOURCES EXCLUDE REGEX ".*/ui/.*")
list(FILTER CORE_HEADERS EXCLUDE REGEX ".*/ui/.*")

add_library(${PROJECT_NAME}-core OBJECT ${CORE_SOURCES} ${CORE_HEADERS})

target_include_directories(${PROJECT_NAME}-core PUBLIC
    src/
    vendor/stb/
)

target_link_libraries(${PROJECT_NAME}-core PUBLIC
    CURL::libcurl
    SDL3_mixer::SDL3_mixer
    miniz
    cpprealm
    utf8proc
    cpr
    nlohmann_json
)

# resolve the psapi symbols used by realm
if(WIN32)
    target_link_libraries(${PROJECT_NAME}-core PUBLIC psapi)
endif()

if(MSVC)
    target_compile_definitions(${PROJECT_NAME}-core PUBLIC
        WIN32_LEAN_AND_MEAN
        NOMINMAX
        VC_EXTRALEAN
    )
else()
    target_compile_options(${PROJECT_NAME}-core PUBLIC
        -Wpedantic
        -Wunused-variable
        -Wunused-function
        -Wunused-lambda-capture

        $<$<CONFIG:Debug>:-O0 -g3>
        $<$<CONFIG:Release>:-O2 -DNDEBUG>
    )
endif()

add_library(${PROJECT_NAME}-ui OBJECT ${UI_SOURCES} ${UI_HEADERS})

target_include_directories(${PROJECT_NAME}-ui PUBLIC
    src/
)

target_link_libraries(${PROJECT_NAME}-ui PUBLIC
    ${PROJECT_NAME}-core
    OpenGL::GL
    SDL3::SDL3
    imgui-ui::sdl
    lunasvg
)

add_executable(${PROJECT_NAME} src/main.cpp)
target_link_libraries(${PROJECT_NAME} PRIVATE ${PROJECT_NAME}-core ${PROJECT_NAME}-ui)

# copy runtime dlls next to the executable.
if(WIN32)
    add_custom_command(
        TARGET ${PROJECT_NAME} POST_BUILD
        COMMAND "${CMAKE_COMMAND}" -E copy -t $<TARGET_FILE_DIR:${PROJECT_NAME}> $<TARGET_RUNTIME_DLLS:${PROJECT_NAME}>
        COMMAND_EXPAND_LISTS
        VERBATIM
    )
endif()

install(TARGETS ${PROJECT_NAME}
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)

# keep resources next to the executable in portable Windows packages.
if(WIN32)
    set(RESOURCE_INSTALL_DIR resources)
else()
    set(RESOURCE_INSTALL_DIR ${CMAKE_INSTALL_DATADIR}/${PROJECT_NAME}/resources)
endif()

install(DIRECTORY resources/runtime/
    DESTINATION ${RESOURCE_INSTALL_DIR}
)

if(OSU_STUFF_BUILD_TESTS)
    if(NOT TARGET Catch2::Catch2WithMain)
        add_subdirectory(vendor/Catch2 EXCLUDE_FROM_ALL)
    endif()

    list(APPEND
        CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/vendor/Catch2/extras"
    )

    include(Catch)
    include(CTest)

    add_subdirectory(tests)
endif()
