add_executable(tests
    beatmap_parser_tests.cpp
    clients_tests.cpp
    legacy_parser_tests.cpp
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

catch_discover_tests(tests
    WORKING_DIRECTORY "$<TARGET_FILE_DIR:tests>"
    DISCOVERY_MODE PRE_TEST
)
