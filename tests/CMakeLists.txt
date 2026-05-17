add_custom_target(test-data
    COMMAND "${CMAKE_COMMAND}"
        -DPROJECT_SOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}
        -DPROJECT_BINARY_DIR=${CMAKE_CURRENT_BINARY_DIR}
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/fetch_test_data.cmake"
    VERBATIM
)

message(${CMAKE_CURRENT_SOURCE_DIR})

add_executable(tests
    beatmap_parser_tests.cpp
    clients_tests.cpp
    legacy_parser_tests.cpp
    osdb_parser_tests.cpp
    test_helper.hpp
)

add_dependencies(tests test-data)

target_link_libraries(tests PRIVATE
    osu-stuff-core
    Catch2::Catch2WithMain
)

target_include_directories(tests PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
)

catch_discover_tests(tests
    WORKING_DIRECTORY "$<TARGET_FILE_DIR:tests>"
    DISCOVERY_MODE PRE_TEST
)
