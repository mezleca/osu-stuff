#pragma once

#include "imgui.h"
#include "ui/widgets/tab_button.hpp"

#include <SDL3/SDL_events.h>
#include <SDL3/SDL_video.h>
#include <string>
#include <vector>

enum UI_FONTS { TORUS = 0, TORUS_SEMI, TORUS_BOLD, FONT_COUNT };

enum UI_FONT_VAR { FONT_SMALL = 0, FONT_MEDIUM, FONT_LARGE, FONT_VAR_COUNT };

struct UIFont {
  private:
    ImFont* m_fonts[FONT_VAR_COUNT];

  public:
    ImFont*& operator[](UI_FONT_VAR var) {
        return m_fonts[var];
    }

    [[nodiscard]]
    ImFont* operator[](UI_FONT_VAR var) const {
        return m_fonts[var];
    }
};

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
