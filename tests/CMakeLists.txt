add_executable(tests
    beatmap_parser_tests.cpp
    clients_tests.cpp
    legacy_parser_tests.cpp
    stuff_utils.cpp
    osdb_parser_tests.cpp
    test_helper.hpp
)

target_link_libraries(tests PRIVATE
    osu-stuff-core
    Catch2::Catch2WithMain
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
endif()

catch_discover_tests(tests
    WORKING_DIRECTORY "$<TARGET_FILE_DIR:tests>"
    DISCOVERY_MODE PRE_TEST
)
