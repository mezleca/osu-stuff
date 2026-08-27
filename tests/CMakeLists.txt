add_executable(tests
    app-database.cpp
    app-ui-widgets.cpp
    beatmap-parser.cpp
    osu-clients.cpp
    osu_api_tests.cpp
    legacy-parser.cpp
    osdb-parser.cpp
    tasks.cpp
    paths.cpp
    utils.cpp
    utils/imgui-context.hpp
    utils/helper.hpp
)

target_link_libraries(tests PRIVATE
    osu-stuff-core
    Catch2::Catch2WithMain
)

target_compile_definitions(tests PRIVATE
    OSU_STUFF_SOURCE_DIR="${PROJECT_SOURCE_DIR}"
)

target_include_directories(tests PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    $<TARGET_PROPERTY:osu-stuff-core,INTERFACE_INCLUDE_DIRECTORIES>
)

if(WIN32)
    add_custom_command(TARGET tests POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
            $<TARGET_RUNTIME_DLLS:tests>
            $<TARGET_FILE_DIR:tests>
        COMMAND_EXPAND_LISTS
    )

    target_compile_options(tests PRIVATE
        /W4
        /EHsc
        /utf-8
        /wd5105
        /Zc:preprocessor
    )
else()
    target_compile_options(tests PRIVATE
        -Wpedantic
    )
    if(CMAKE_CXX_COMPILER_ID MATCHES "Clang")
        target_compile_options(tests PRIVATE -Wunused-lambda-capture)
    endif()
endif()

catch_discover_tests(tests
    WORKING_DIRECTORY "$<TARGET_FILE_DIR:tests>"
    DISCOVERY_MODE PRE_TEST
)
