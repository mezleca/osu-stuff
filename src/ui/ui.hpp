#pragma once

#include "fonts/font.hpp"

#include <glad/gl.h>
#include <imgui.h>
#include <SDL3/SDL_events.h>
#include <SDL3/SDL_timer.h>
#include <SDL3/SDL_video.h>
#include <memory>
#include <string>
#include <unordered_map>
#include <vector>

class UINotificationManager;
class UIModal;
class IconTexture;
class TabButtonWidget;
class UITab;
class UI;

namespace ui {
    UI& current();
}

// UIDebug will be used to debug widgets, view / change its properties, etc...
// for that to happen, we will need to store the widget ptr somewhere in the ui
// and maybe use references on styling properties?
class UIDebug {
public:
    [[nodiscard]] double get_fps() const {
        return m_current_fps;
    }

    void render();
    void update();
    void handle_keydown(SDL_Window* window);

private:
    Uint64 m_last_time = 0;
    Uint64 m_frame_count = 0;
    double m_current_fps = 0.0;
    bool m_show_ui = false;
};

class UI {
public:
    UI(SDL_GLContext* context, SDL_Window* window);
    ~UI();

    void render();
    void process_sdl_event(SDL_Event* event);

    [[nodiscard]] bool is_done() const {
        return m_done;
    }

    void exit() {
        m_done = true;
    }

    UINotificationManager* notification_manager() {
        return m_notification_manager;
    }

    [[nodiscard]] UIFont& get_font(UIFonts type) {
        return m_fonts[type];
    }

    [[nodiscard]] const UIFont& get_font(UIFonts type) const {
        return m_fonts[type];
    }

    // draw helpers
    void draw_child_rect(ImColor border_color, float radius = 4.0f, float thickness = 1.0f);

    // textures
    [[nodiscard]] IconTexture* get_texture(std::string_view id);

    // modals
    // TODO: ModalManager
    [[nodiscard]] bool is_modal_focused(UIModal* modal) const;
    [[nodiscard]] bool has_modal(std::string_view id) const;
    [[nodiscard]] UIModal* focused_modal() const;
    [[nodiscard]] size_t modal_count() const;
    [[nodiscard]] bool remove_modal(std::string_view id);
    [[nodiscard]] bool remove_focused_modal();
    void show_modal(std::unique_ptr<UIModal> modal, bool wipe = false);
    void clear_modals();
    void handle_escape();

private:
    UIFont m_fonts[FONT_COUNT];
    std::unordered_map<std::string, std::unique_ptr<IconTexture>> m_textures;
    UIDebug m_debug;
    std::vector<std::pair<TabButtonWidget, std::unique_ptr<UITab>>> m_tabs;
    std::vector<std::unique_ptr<UIModal>> m_modals;
    UINotificationManager* m_notification_manager;
    SDL_Window* m_window;
    ImGuiIO* m_io;
    UITab* m_current_tab = nullptr;
    bool m_done = false;
};
