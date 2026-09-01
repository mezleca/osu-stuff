#include "utils/gzip.hpp"

#include <catch2/catch_test_macros.hpp>

static const std::vector<uint8_t> HELLO_MEMBER = {
    0x1F, 0x8B, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xCB, 0x48, 0xCD,
    0xC9, 0xC9, 0x07, 0x00, 0x86, 0xA6, 0x10, 0x36, 0x05, 0x00, 0x00, 0x00,
};

static const std::vector<uint8_t> WORLD_MEMBER = {
    0x1F, 0x8B, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x53, 0x28, 0xCF,
    0x2F, 0xCA, 0x49, 0x01, 0x00, 0xCB, 0x42, 0x3B, 0x4A, 0x06, 0x00, 0x00, 0x00,
};

static std::vector<uint8_t> member_with_optional_header_fields() {
    std::vector<uint8_t> member = HELLO_MEMBER;
    member[3] = 0x1E; // FEXTRA, FNAME, FCOMMENT and FHCRC.

    const std::vector<uint8_t> fields = {
        0x02, 0x00, 0xCA, 0xFE, // FEXTRA
        'h',  'e',  'l',  'l',  'o',  0x00, // FNAME
        't',  'e',  's',  't',  0x00, // FCOMMENT
    };
    const size_t crc_offset = 10 + fields.size();
    member.insert(member.begin() + 10, fields.begin(), fields.end());

    const mz_ulong crc = mz_crc32(MZ_CRC32_INIT, member.data(), crc_offset);
    member.insert(
        member.begin() + static_cast<std::ptrdiff_t>(crc_offset),
        {static_cast<uint8_t>(crc & 0xFF), static_cast<uint8_t>((crc >> 8) & 0xFF)}
    );
    return member;
}

TEST_CASE("gzip decompression validates members", "[utils][gzip]") {
    SECTION("decompresses a valid member") {
        std::vector<uint8_t> output;

        REQUIRE(binary::gzip_decompress(HELLO_MEMBER, output));
        REQUIRE(output == std::vector<uint8_t>{'h', 'e', 'l', 'l', 'o'});
    }

    SECTION("decompresses concatenated members") {
        std::vector<uint8_t> input = HELLO_MEMBER;
        input.insert(input.end(), WORLD_MEMBER.begin(), WORLD_MEMBER.end());
        std::vector<uint8_t> output;

        REQUIRE(binary::gzip_decompress(input, output));
        REQUIRE(output == std::vector<uint8_t>{'h', 'e', 'l', 'l', 'o', ' ', 'w', 'o', 'r', 'l', 'd'});
    }

    SECTION("supports optional header fields") {
        const std::vector<uint8_t> input = member_with_optional_header_fields();
        std::vector<uint8_t> output;

        REQUIRE(binary::gzip_decompress(input, output));
        REQUIRE(output == std::vector<uint8_t>{'h', 'e', 'l', 'l', 'o'});
    }

    SECTION("rejects invalid headers and footers") {
        std::vector<uint8_t> output = {'k', 'e', 'e', 'p'};

        auto invalid_header = HELLO_MEMBER;
        invalid_header[3] = 0x20;
        REQUIRE_FALSE(binary::gzip_decompress(invalid_header, output));

        auto invalid_crc = HELLO_MEMBER;
        invalid_crc[17] ^= 0xFF;
        REQUIRE_FALSE(binary::gzip_decompress(invalid_crc, output));

        auto truncated = HELLO_MEMBER;
        truncated.pop_back();
        REQUIRE_FALSE(binary::gzip_decompress(truncated, output));
        REQUIRE(output == std::vector<uint8_t>{'k', 'e', 'e', 'p'});
    }
}
