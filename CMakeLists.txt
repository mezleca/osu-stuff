cmake_minimum_required(VERSION 3.20)
project(osu-stuff VERSION 3.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

if(NOT CMAKE_CONFIGURATION_TYPES AND NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

find_package(OpenGL REQUIRED)
find_package(OpenSSL REQUIRED)
find_package(ZLIB REQUIRED)
find_package(SDL3 QUIET)
find_package(libuv QUIET)

if(NOT libuv_FOUND)
    find_package(PkgConfig REQUIRED)
    pkg_check_modules(LIBUV REQUIRED libuv)
endif()

file(GLOB IMGUI_CORE_SOURCES "vendor/imgui/*.cpp")
set(IMGUI_BACKEND_SOURCES
    "vendor/imgui/backends/imgui_impl_sdl3.cpp"
    "vendor/imgui/backends/imgui_impl_opengl3.cpp"
)

add_subdirectory(vendor/miniz)
add_subdirectory(vendor/utf8proc)

include(FetchContent)

if(WIN32)
    FetchContent_Declare(
        cpprealm
        URL "https://github.com/mezleca/rel-builds/releases/download/realm-cpp-2.2.0-2/realm-cpp-2.2.0-x64-windows-msvc-static.tar.gz"
    )
else()
    FetchContent_Declare(
        cpprealm
        URL "https://github.com/mezleca/rel-builds/releases/download/realm-cpp-2.2.0-2/realm-cpp-2.2.0-x64-linux-clang-shared.tar.gz"
    )
endif()

FetchContent_Populate(cpprealm)

set(CPPREALM_INCLUDE_DIR "${cpprealm_SOURCE_DIR}/include")
set(CPPREALM_LIBRARY_DIR "${cpprealm_SOURCE_DIR}/lib")

if(WIN32)
    set(CPPREALM_LIBRARY "${CPPREALM_LIBRARY_DIR}/cpprealm.lib")
    file(GLOB CPPREALM_EXTRA_LIBRARIES CONFIGURE_DEPENDS "${CPPREALM_LIBRARY_DIR}/*.lib")
else()
    set(CPPREALM_LIBRARY "${CPPREALM_LIBRARY_DIR}/libcpprealm.a")
    file(GLOB CPPREALM_EXTRA_LIBRARIES CONFIGURE_DEPENDS "${CPPREALM_LIBRARY_DIR}/*.a")
endif()

list(REMOVE_ITEM CPPREALM_EXTRA_LIBRARIES "${CPPREALM_LIBRARY}")

add_library(cpprealm STATIC IMPORTED GLOBAL)
set_target_properties(cpprealm PROPERTIES
    IMPORTED_LOCATION "${CPPREALM_LIBRARY}"
    INTERFACE_INCLUDE_DIRECTORIES "${CPPREALM_INCLUDE_DIR}"
)

file(GLOB_RECURSE SOURCES CONFIGURE_DEPENDS "src/*.cpp")
file(GLOB_RECURSE HEADERS CONFIGURE_DEPENDS "src/*.hpp")

add_executable(${PROJECT_NAME}
    ${SOURCES}
    ${HEADERS}
    ${IMGUI_CORE_SOURCES}
    ${IMGUI_BACKEND_SOURCES}
)

target_include_directories(${PROJECT_NAME} PUBLIC
    vendor/imgui
    vendor/imgui/backends
)

if(SDL3_FOUND AND TARGET SDL3::SDL3)
    set(SDL3_LINK_TARGET SDL3::SDL3)
else()
    set(SDL3_LINK_TARGET ${SDL3_LIBRARIES})
    target_include_directories(${PROJECT_NAME} PUBLIC ${SDL3_INCLUDE_DIRS})
endif()

if(libuv_FOUND AND TARGET libuv::libuv)
    set(LIBUV_LINK_TARGET libuv::libuv)
else()
    set(LIBUV_LINK_TARGET ${LIBUV_LIBRARIES})
    target_include_directories(${PROJECT_NAME} PUBLIC ${LIBUV_INCLUDE_DIRS})
endif()

target_link_libraries(${PROJECT_NAME} PRIVATE
    cpprealm
    ${CPPREALM_EXTRA_LIBRARIES}
    miniz
    utf8proc
    OpenSSL::SSL
    OpenSSL::Crypto
    ZLIB::ZLIB
    ${SDL3_LINK_TARGET}
    ${LIBUV_LINK_TARGET}
    OpenGL::GL
)

if(MSVC)
    target_compile_options(${PROJECT_NAME} PRIVATE /W4 /permissive-)
else()
    target_compile_options(${PROJECT_NAME} PRIVATE -Wall -Wextra -Wpedantic)
endif()

add_custom_target(copy_compile_commands ALL
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
    ${CMAKE_BINARY_DIR}/compile_commands.json
    ${CMAKE_CURRENT_SOURCE_DIR}/compile_commands.json
)
