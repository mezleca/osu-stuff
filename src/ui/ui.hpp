#pragma once

#include "imgui.h"

#include <SDL3/SDL_events.h>
#include <SDL3/SDL_video.h>

enum UITAB : int { TAB_INDEX = 0, TAB_COLLECTIONS, TAB_DISCOVER, TAB_RADIO, TAB_CONFIG, TAB_STATUS };

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
    UITAB m_tab = TAB_INDEX;

    ImGuiIO* io;
};
