#pragma once

#include "ui/custom.hpp"
#include "ui/tabs/tabs.hpp"

#include <SDL3/SDL_events.h>
#include <SDL3/SDL_video.h>
#include <imgui.h>
#include <memory>
#include <string>
#include <unordered_map>
#include <vector>

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

struct UIFont {
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

struct UITab;

class UI {
public:
    UI(SDL_GLContext* context, SDL_Window* window);
    ~UI();

    void render();
    void process_sdl_event(SDL_Event* event);

    bool is_done() {
        return m_done;
    }
    void exit() {
        m_done = true;
    };

private:
    bool m_done = false;
    UITab* m_current_tab = nullptr;
    std::vector<std::pair<custom_imgui::TabButtonState, std::unique_ptr<UITab>>> m_tabs;
    ImGuiIO* io;
    UIFont m_fonts[FONT_COUNT];
};
