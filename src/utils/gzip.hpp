#pragma once

#include <cstdint>
#include <vector>
#include <miniz.h>

namespace binary {
    inline bool gzip_decompress(const std::vector<uint8_t>& input, std::vector<uint8_t>& output) {
        if (input.empty()) {
            return true;
        }

        const size_t max_decompressed_size = 256 * 1024 * 1024; // 256 MiB safety cap for inflate.
        std::vector<uint8_t> temp_output;

        const uint8_t* data = input.data();
        const size_t size = input.size();
        size_t member_offset = 0;

        while (member_offset < size) {
            // GZIP header (10 bytes) + footer (8 bytes) minimum.
            if (size - member_offset < 18) {
                return false;
            }

            // ID1=0x1F, ID2=0x8B, CM=0x08 (deflate).
            if (data[member_offset] != 0x1F || data[member_offset + 1] != 0x8B || data[member_offset + 2] != 0x08) {
                return false;
            }

            const uint8_t flags = data[member_offset + 3];

            // reserved bits must be zero.
            if ((flags & 0xE0) != 0) {
                return false;
            }

            // fixed header length: ID1, ID2, CM, FLG, MTIME(4), XFL, OS.
            size_t offset = member_offset + 10;

            if (flags & 0x04) {
                // FEXTRA: 2 byte length followed by extra data.
                if (offset + 2 > size) {
                    return false;
                }
                const uint16_t xlen =
                    static_cast<uint16_t>(data[offset]) | (static_cast<uint16_t>(data[offset + 1]) << 8);
                offset += 2;
                if (offset + xlen > size) {
                    return false;
                }
                offset += xlen;
            }

            if (flags & 0x08) {
                // FNAME: null-terminated filename.
                while (offset < size && data[offset] != 0x00) {
                    offset++;
                }
                if (offset >= size) {
                    return false;
                }
                offset++;
            }

            if (flags & 0x10) {
                // FCOMMENT: null-terminated comment.
                while (offset < size && data[offset] != 0x00) {
                    offset++;
                }
                if (offset >= size) {
                    return false;
                }
                offset++;
            }

            if (flags & 0x02) {
                // FHCRC: 2-byte CRC16 of the header.
                if (offset + 2 > size) {
                    return false;
                }

                const mz_ulong header_crc = mz_crc32(MZ_CRC32_INIT, data + member_offset, offset - member_offset);

                const uint16_t expected_crc16 =
                    static_cast<uint16_t>(data[offset]) | (static_cast<uint16_t>(data[offset + 1]) << 8);

                if ((header_crc & 0xFFFFu) != expected_crc16) {
                    return false;
                }

                offset += 2;
            }

            // footer is CRC32 + ISIZE (4 bytes each).
            if (offset + 8 > size) {
                return false;
            }

            mz_stream stream{};

            stream.next_in = const_cast<unsigned char*>(data + offset);
            stream.avail_in = static_cast<mz_uint32>(size - offset);

            if (mz_inflateInit2(&stream, -MZ_DEFAULT_WINDOW_BITS) != MZ_OK) {
                return false;
            }

            const size_t chunk_size = 262144; // 256 KiB inflate chunk.
            int status = MZ_OK;

            while (status != MZ_STREAM_END) {
                const size_t start = temp_output.size();
                if (start + chunk_size > max_decompressed_size) {
                    mz_inflateEnd(&stream);
                    return false;
                }
                temp_output.resize(start + chunk_size);
                stream.next_out = temp_output.data() + start;
                stream.avail_out = static_cast<mz_uint32>(chunk_size);

                status = mz_inflate(&stream, MZ_NO_FLUSH);
                if (status != MZ_OK && status != MZ_STREAM_END) {
                    mz_inflateEnd(&stream);
                    return false;
                }

                const size_t produced = chunk_size - stream.avail_out;
                if (start + produced > max_decompressed_size) {
                    mz_inflateEnd(&stream);
                    return false;
                }
                temp_output.resize(start + produced);
            }

            mz_inflateEnd(&stream);

            const size_t footer_offset = offset + static_cast<size_t>(stream.total_in);

            if (footer_offset + 8 > size) {
                return false;
            }

            // CRC32 of uncompressed data.
            const mz_ulong expected_crc = static_cast<mz_ulong>(data[footer_offset]) |
                                          (static_cast<mz_ulong>(data[footer_offset + 1]) << 8) |
                                          (static_cast<mz_ulong>(data[footer_offset + 2]) << 16) |
                                          (static_cast<mz_ulong>(data[footer_offset + 3]) << 24);

            // ISIZE: uncompressed size modulo 2^32.
            const mz_ulong expected_size = static_cast<mz_ulong>(data[footer_offset + 4]) |
                                           (static_cast<mz_ulong>(data[footer_offset + 5]) << 8) |
                                           (static_cast<mz_ulong>(data[footer_offset + 6]) << 16) |
                                           (static_cast<mz_ulong>(data[footer_offset + 7]) << 24);

            const size_t member_output_offset = temp_output.size() - static_cast<size_t>(stream.total_out);
            const mz_ulong actual_crc = mz_crc32(MZ_CRC32_INIT, temp_output.data() + member_output_offset,
                                                 static_cast<size_t>(stream.total_out));

            if (actual_crc != expected_crc) {
                return false;
            }

            if ((stream.total_out & 0xFFFFFFFFu) != expected_size) {
                return false;
            }

            member_offset = footer_offset + 8;
            if (member_offset == size) {
                break;
            }
        }

        output.swap(temp_output);
        return true;
    }

    inline bool gzip_compress(const std::vector<uint8_t>& input, std::vector<uint8_t>& output) {
        mz_stream stream{};
        stream.next_in = const_cast<unsigned char*>(input.data());
        stream.avail_in = static_cast<mz_uint32>(input.size());

        if (mz_deflateInit2(&stream, MZ_BEST_COMPRESSION, MZ_DEFLATED, -MZ_DEFAULT_WINDOW_BITS, 8,
                            MZ_DEFAULT_STRATEGY) != MZ_OK) {
            return false;
        }

        // GZIP header: ID1=0x1F, ID2=0x8B, CM=0x08 (deflate), FLG=0, MTIME=0, XFL=0, OS=255 (unknown).
        const uint8_t header[10] = {0x1F, 0x8B, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF};

        std::vector<uint8_t> temp_output;
        temp_output.insert(temp_output.end(), std::begin(header), std::end(header));

        const size_t chunk_size = 262144; // 256 KiB deflate chunk.
        int status = MZ_OK;

        while (status != MZ_STREAM_END) {
            const size_t start = temp_output.size();
            temp_output.resize(start + chunk_size);
            stream.next_out = temp_output.data() + start;
            stream.avail_out = static_cast<mz_uint32>(chunk_size);

            status = mz_deflate(&stream, stream.avail_in ? MZ_NO_FLUSH : MZ_FINISH);
            if (status != MZ_OK && status != MZ_STREAM_END) {
                mz_deflateEnd(&stream);
                return false;
            }

            temp_output.resize(start + (chunk_size - stream.avail_out));
        }

        mz_deflateEnd(&stream);

        // Footer: CRC32 and ISIZE.
        const mz_ulong crc = mz_crc32(MZ_CRC32_INIT, input.data(), input.size());
        const mz_ulong isize = static_cast<mz_ulong>(input.size() & 0xFFFFFFFFu);

        temp_output.push_back(static_cast<uint8_t>(crc & 0xFF));
        temp_output.push_back(static_cast<uint8_t>((crc >> 8) & 0xFF));
        temp_output.push_back(static_cast<uint8_t>((crc >> 16) & 0xFF));
        temp_output.push_back(static_cast<uint8_t>((crc >> 24) & 0xFF));
        temp_output.push_back(static_cast<uint8_t>(isize & 0xFF));
        temp_output.push_back(static_cast<uint8_t>((isize >> 8) & 0xFF));
        temp_output.push_back(static_cast<uint8_t>((isize >> 16) & 0xFF));
        temp_output.push_back(static_cast<uint8_t>((isize >> 24) & 0xFF));

        output.swap(temp_output);
        return true;
    }
}
