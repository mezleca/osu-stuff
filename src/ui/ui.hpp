#pragma once

#include "imgui.h"
#include "ui/widgets/tab_button.hpp"

#include <SDL3/SDL_events.h>
#include <SDL3/SDL_video.h>
#include <string>
#include <vector>

enum customChildBorder : uint8_t {
    BORDER_NONE = 0,
    BORDER_LEFT = 1 << 0,
    BORDER_TOP = 1 << 1,
    BORDER_RIGHT = 1 << 2,
    BORDER_BOTTOM = 1 << 3,
    BORDER_ALL = 1 << 4,
};

enum UIFonts { TORUS = 0, TORUS_SEMI, TORUS_BOLD, FONT_COUNT };
enum UIFontsVar { FONT_SMALL = 0, FONT_MEDIUM, FONT_LARGE, FONT_VAR_COUNT };

struct UIFont {
  private:
    ImFont* m_fonts[FONT_VAR_COUNT];

  public:
    ImFont*& operator[](UIFontsVar var) {
        return m_fonts[var];
    }

    [[nodiscard]]
    ImFont* operator[](UIFontsVar var) const {
        return m_fonts[var];
    }
};

struct ChildState {
    std::string m_id;

    ImVec2 m_drag_start;
    ImVec2 m_size;
    ImVec2 m_saved_size;

    float m_drag_offset;
    bool m_dragging;
};

namespace custom_imgui {
    void search_input(std::string_view label, std::string& input);
    void line(ImVec2 a, ImVec2 b, ImU32 color, float thickness);
    bool begin_child(ChildState* state, ImGuiChildFlags child_flags = 0, ImGuiWindowFlags window_flags = 0);
    void end_child(ChildState* state, customChildBorder flags, ImU32 color, float thickness = 1.0f);
}; // namespace custom_imgui

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
    std::string m_tab = "index";
    std::vector<std::string> m_tabs_str = {"index", "collections", "discover", "radio", "config", "status"};
    std::vector<TabButtonWidget> m_tabs;

    ImGuiIO* io;
    UIFont m_fonts[FONT_COUNT];
};
