#pragma once

#include <imgui.h>
#include <string>
#include <cstdint>
#include <unordered_map>

enum UIFonts {
    TORUS = 0,
    TORUS_SEMI,
    TORUS_BOLD,
    FONT_COUNT
};

enum UIFontVar : int32_t {
    FONT_EXTRA_SMALL = 10,
    FONT_SMALL = 14,
    FONT_MEDIUM = 20,
    FONT_LARGE = 26,
    FONT_EXTRA_LARGE = 32
};

class UIFont {
public:
    void initialize(ImFontConfig cfg, std::string_view location, ImGuiIO* io);

    [[nodiscard]]
    ImFont* get(int size) {
        auto font_it = m_fonts.find(size);

        if (font_it == m_fonts.end()) {
            return load_font_variation(size);
        }

        return font_it->second;
    }

    bool load(int size);

private:
    ImFont* load_font_variation(int size);

    ImGuiIO* m_io;
    std::string m_font_location;
    std::unordered_map<int, ImFont*> m_fonts;
    ImFontConfig m_cfg;
};
