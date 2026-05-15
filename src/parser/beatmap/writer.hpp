#pragma once

#include <iomanip>
#include <sstream>
#include <string>
#include <utility>
#include <vector>

struct BeatmapWriter {
public:
  void section(const std::string &name) { out << "[" << name << "]\n"; }

  void blank() { out << "\n"; }

  void line(const std::string &value) { out << value << "\n"; }

  void key_value(const std::string &key, const std::string &value) {
    out << key << ":" << value << "\n";
  }

  void key_value(const std::string &key, const char *value) {
    out << key << ":" << value << "\n";
  }

  void key_value(const std::string &key, int value) {
    out << key << ":" << value << "\n";
  }

  void key_value_double(const std::string &key, double value) {
    out << key << ":" << format_double(value) << "\n";
  }

  std::string str() const { return out.str(); }

  static std::string format_double(double value) {
    std::ostringstream ss;
    ss << std::fixed << std::setprecision(15) << value;
    std::string out = ss.str();
    auto pos = out.find('.');
    if (pos != std::string::npos) {
      while (!out.empty() && out.back() == '0') {
        out.pop_back();
      }
      if (!out.empty() && out.back() == '.') {
        out.pop_back();
      }
    }
    if (out.empty()) {
      out = "0";
    }
    return out;
  }

  static std::string join_ints(const std::vector<int> &values, char delim) {
    std::ostringstream ss;
    for (size_t i = 0; i < values.size(); i++) {
      if (i > 0) {
        ss << delim;
      }
      ss << values[i];
    }
    return ss.str();
  }

  static std::string join_pairs(const std::vector<std::pair<int, int>> &values,
                                char delim) {
    std::ostringstream ss;
    for (size_t i = 0; i < values.size(); i++) {
      if (i > 0) {
        ss << delim;
      }
      ss << values[i].first << ":" << values[i].second;
    }
    return ss.str();
  }

private:
  std::ostringstream out;
};
