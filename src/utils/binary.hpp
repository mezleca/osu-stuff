#pragma once

#include <charconv>
#include <cstdint>
#include <cstring>
#include <fstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <type_traits>
#include <utf8proc.h>
#include <vector>

namespace binary {
struct BinaryCursor {
  const std::vector<uint8_t> *buffer = nullptr;
  size_t offset = 0;
};

inline void set_cursor(BinaryCursor &cursor, const std::vector<uint8_t> &data) {
  cursor.buffer = &data;
  cursor.offset = 0;
}

inline void ensure_range(const BinaryCursor &cursor, size_t bytes) {
  if (!cursor.buffer) {
    throw std::runtime_error("binary read out of range");
  }

  if (cursor.offset > cursor.buffer->size()) {
    throw std::runtime_error("binary read out of range");
  }

  const size_t remaining = cursor.buffer->size() - cursor.offset;
  if (bytes > remaining) {
    throw std::runtime_error("binary read out of range");
  }
}

inline constexpr bool is_little_endian() {
#if defined(__BYTE_ORDER__) && defined(__ORDER_LITTLE_ENDIAN__) &&             \
    defined(__ORDER_BIG_ENDIAN__)
  return __BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__;
#elif defined(_WIN32)
  return true;
#else
  return true;
#endif
}

template <typename T> inline T byteswap(T value) {
  using U = std::make_unsigned_t<T>;
  U uvalue = static_cast<U>(value);
  if constexpr (sizeof(U) == 1) {
    return value;
  } else if constexpr (sizeof(U) == 2) {
    uvalue = static_cast<U>((uvalue >> 8) | (uvalue << 8));
  } else if constexpr (sizeof(U) == 4) {
    uvalue = static_cast<U>(
        ((uvalue & 0x000000FFu) << 24) | ((uvalue & 0x0000FF00u) << 8) |
        ((uvalue & 0x00FF0000u) >> 8) | ((uvalue & 0xFF000000u) >> 24));
  } else if constexpr (sizeof(U) == 8) {
    uvalue = static_cast<U>(((uvalue & 0x00000000000000FFull) << 56) |
                            ((uvalue & 0x000000000000FF00ull) << 40) |
                            ((uvalue & 0x0000000000FF0000ull) << 24) |
                            ((uvalue & 0x00000000FF000000ull) << 8) |
                            ((uvalue & 0x000000FF00000000ull) >> 8) |
                            ((uvalue & 0x0000FF0000000000ull) >> 24) |
                            ((uvalue & 0x00FF000000000000ull) >> 40) |
                            ((uvalue & 0xFF00000000000000ull) >> 56));
  }
  return static_cast<T>(uvalue);
}

template <typename T> inline T read_integral(BinaryCursor &cursor) {
  using U = std::make_unsigned_t<T>;
  U value = 0;
  ensure_range(cursor, sizeof(T));
  std::memcpy(&value, cursor.buffer->data() + cursor.offset, sizeof(T));
  cursor.offset += sizeof(T);
  if (is_little_endian()) {
    return static_cast<T>(value);
  }
  return byteswap(static_cast<T>(value));
}

inline uint8_t read_u8(BinaryCursor &cursor) {
  return read_integral<uint8_t>(cursor);
}

inline int8_t read_i8(BinaryCursor &cursor) {
  return read_integral<int8_t>(cursor);
}

inline uint16_t read_u16(BinaryCursor &cursor) {
  return read_integral<uint16_t>(cursor);
}

inline int16_t read_i16(BinaryCursor &cursor) {
  return read_integral<int16_t>(cursor);
}

inline uint32_t read_u32(BinaryCursor &cursor) {
  return read_integral<uint32_t>(cursor);
}

inline int read_i32(BinaryCursor &cursor) { return read_integral<int>(cursor); }

inline uint64_t read_u64(BinaryCursor &cursor) {
  return read_integral<uint64_t>(cursor);
}

inline int64_t read_i64(BinaryCursor &cursor) {
  return read_integral<int64_t>(cursor);
}

inline float read_f32(BinaryCursor &cursor) {
  uint32_t bits = read_u32(cursor);
  float value = 0.0f;
  std::memcpy(&value, &bits, sizeof(value));
  return value;
}

inline double read_f64(BinaryCursor &cursor) {
  uint64_t bits = read_u64(cursor);
  double value = 0.0;
  std::memcpy(&value, &bits, sizeof(value));
  return value;
}

inline bool read_bool(BinaryCursor &cursor) { return read_u8(cursor) != 0; }

inline uint32_t read_uleb128(BinaryCursor &cursor) {
  uint32_t result = 0;
  int shift = 0;
  bool has_more = true;

  // ULEB128 for uint32_t must fit within 5 bytes.
  for (int i = 0; i < 5; i++) {
    uint8_t byte = read_u8(cursor);
    if (i == 4 && (byte & 0x7F) > 0x0F) {
      throw std::runtime_error("uleb128 overflow");
    }
    result |= static_cast<uint32_t>(byte & 0x7F) << shift;
    if ((byte & 0x80) == 0) {
      has_more = false;
      break;
    }
    shift += 7;
  }

  if (has_more) {
    throw std::runtime_error("uleb128 overflow");
  }

  return result;
}

inline std::string read_string(BinaryCursor &cursor) {
  uint8_t marker = read_u8(cursor);
  if (marker == 0x00) {
    return "";
  }

  if (marker != 0x0B) {
    throw std::runtime_error("invalid string marker");
  }

  uint32_t length = read_uleb128(cursor);
  ensure_range(cursor, length);
  std::string value(
      reinterpret_cast<const char *>(cursor.buffer->data() + cursor.offset),
      length);
  cursor.offset += length;
  return value;
}

inline std::string read_string2(BinaryCursor &cursor) {
  uint32_t length = read_uleb128(cursor);
  ensure_range(cursor, length);
  std::string value(
      reinterpret_cast<const char *>(cursor.buffer->data() + cursor.offset),
      length);
  cursor.offset += length;
  return value;
}

inline void skip(BinaryCursor &cursor, size_t bytes) {
  ensure_range(cursor, bytes);
  cursor.offset += bytes;
}

template <typename T>
inline void append_integral(std::vector<uint8_t> &out, T value) {
  static_assert(std::is_integral_v<T>,
                "append_integral expects integral types");
  if (!is_little_endian()) {
    value = byteswap(value);
  }
  const size_t start = out.size();
  out.resize(start + sizeof(T));
  std::memcpy(out.data() + start, &value, sizeof(T));
}

inline void write_u8(std::vector<uint8_t> &out, uint8_t value) {
  out.push_back(value);
}

inline void write_i8(std::vector<uint8_t> &out, int8_t value) {
  append_integral(out, value);
}

inline void write_u16(std::vector<uint8_t> &out, uint16_t value) {
  append_integral(out, value);
}

inline void write_i16(std::vector<uint8_t> &out, int16_t value) {
  append_integral(out, value);
}

inline void write_u32(std::vector<uint8_t> &out, uint32_t value) {
  append_integral(out, value);
}

inline void write_i32(std::vector<uint8_t> &out, int value) {
  append_integral(out, value);
}

inline void write_u64(std::vector<uint8_t> &out, uint64_t value) {
  append_integral(out, value);
}

inline void write_i64(std::vector<uint8_t> &out, int64_t value) {
  append_integral(out, value);
}

inline void write_f32(std::vector<uint8_t> &out, float value) {
  uint32_t bits = 0;
  std::memcpy(&bits, &value, sizeof(bits));
  append_integral(out, bits);
}

inline void write_f64(std::vector<uint8_t> &out, double value) {
  uint64_t bits = 0;
  std::memcpy(&bits, &value, sizeof(bits));
  append_integral(out, bits);
}

inline void write_bool(std::vector<uint8_t> &out, bool value) {
  out.push_back(value ? 1 : 0);
}

inline void write_uleb128(std::vector<uint8_t> &out, uint32_t value) {
  do {
    uint8_t byte = static_cast<uint8_t>(value & 0x7F);
    value >>= 7;
    if (value != 0) {
      byte |= 0x80;
    }
    out.push_back(byte);
  } while (value != 0);
}

inline void write_string(std::vector<uint8_t> &out, const std::string &value) {
  if (value.empty()) {
    out.push_back(0x00);
    return;
  }

  out.push_back(0x0B);
  write_uleb128(out, static_cast<uint32_t>(value.size()));
  out.insert(out.end(), value.begin(), value.end());
}

inline void write_string2(std::vector<uint8_t> &out, const std::string &value) {
  write_uleb128(out, static_cast<uint32_t>(value.size()));
  out.insert(out.end(), value.begin(), value.end());
}

inline bool read_file_buffer(const std::string &location,
                             std::vector<uint8_t> &out) {
  std::ifstream file(location, std::ios::binary | std::ios::ate);
  if (!file.is_open()) {
    return false;
  }

  const std::ifstream::pos_type size = file.tellg();
  if (size < 0) {
    return false;
  }

  out.resize(static_cast<size_t>(size));
  file.seekg(0, std::ios::beg);
  if (!file.read(reinterpret_cast<char *>(out.data()),
                 static_cast<std::streamsize>(out.size()))) {
    out.clear();
    return false;
  }

  return true;
}

inline bool write_file_buffer(const std::string &location,
                              const std::vector<uint8_t> &buffer) {
  std::ofstream file(location, std::ios::binary | std::ios::trunc);
  if (!file.is_open()) {
    return false;
  }

  if (!buffer.empty()) {
    file.write(reinterpret_cast<const char *>(buffer.data()),
               static_cast<std::streamsize>(buffer.size()));
  }

  return file.good();
}

template <typename T> T str_to(std::string_view sv, T _d = T()) {
  T value = {};
  auto result = std::from_chars(sv.data(), sv.data() + sv.size(), value);

  if (result.ec == std::errc::invalid_argument ||
      result.ptr != sv.data() + sv.size()) {
    // fmt::println("str_to<{}>(): failed to convert {}", typeid(T).name(), sv);
    return _d;
  }

  return value;
}

template <typename T>
inline static T convert_to(std::string_view value, T _d = T()) {
  if constexpr (std::is_same_v<T, int>) {
    return str_to<int>(value);
  } else if constexpr (std::is_same_v<T, float>) {
    return str_to<float>(value);
  } else if constexpr (std::is_same_v<T, double>) {
    return str_to<double>(value);
  } else if constexpr (std::is_same_v<T, const char *>) {
    return value;
  } else if constexpr (std::is_same_v<T, std::string>) {
    return std::string(value);
  } else {
    return _d;
  }
}

inline std::string normalize_and_lower(std::string_view s) {
  utf8proc_uint8_t *result = nullptr;

  // UTF8PROC_DECOMPOSE = NFD, UTF8PROC_CASEFOLD = case folding
  utf8proc_ssize_t len = utf8proc_map(
      reinterpret_cast<const utf8proc_uint8_t *>(s.data()),
      static_cast<utf8proc_ssize_t>(s.size()), &result,
      static_cast<utf8proc_option_t>(UTF8PROC_DECOMPOSE | UTF8PROC_CASEFOLD |
                                     UTF8PROC_NLF2LS));

  if (len < 0 || !result) {
    return std::string(s);
  }

  std::string out(reinterpret_cast<char *>(result), static_cast<size_t>(len));
  free(result);
  return out;
}

template <typename T> inline T lower_if_possible(T value) {
  if constexpr (std::is_same_v<T, std::string>) {
    return normalize_and_lower(value);
  } else {
    return value;
  }
}
} // namespace binary
