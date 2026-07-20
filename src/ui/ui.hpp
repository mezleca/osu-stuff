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

class UIModal;
class UINotification;
class IconTexture;
class TabButtonWidget;
class UITab;
class UI;

namespace ui {
    UI& current();
}

struct FrameCounter {
    Uint64 last_time = 0;
    Uint64 frame_count = 0;
    double current_fps = 0.0;
    bool show_ui = false;
};

class UI {
public:
    UI(SDL_GLContext* context, SDL_Window* window);
    ~UI();

    void show_debug_ui();
    void render();
    void process_sdl_event(SDL_Event* event);

    [[nodiscard]] bool is_done() const {
        return m_done;
    }

    void exit() {
        m_done = true;
    }

    [[nodiscard]] double get_fps() const {
        return m_counter.current_fps;
    }

    void update_counter();

    [[nodiscard]] UIFont& get_font(UIFonts type) {
        return m_fonts[type];
    }

    [[nodiscard]] const UIFont& get_font(UIFonts type) const {
        return m_fonts[type];
    }

    // textures
    [[nodiscard]] IconTexture* get_texture(std::string_view id);

    // modals
    [[nodiscard]] bool is_modal_focused(UIModal* modal) const;
    [[nodiscard]] bool has_modal(std::string_view id) const;
    [[nodiscard]] UIModal* focused_modal() const;
    [[nodiscard]] size_t modal_count() const;
    [[nodiscard]] bool remove_modal(std::string_view id);
    [[nodiscard]] bool remove_focused_modal();
    void show_modal(std::unique_ptr<UIModal> modal, bool wipe = false);
    void clear_modals();
    void handle_escape();

    // notifications
    void add_notification(std::unique_ptr<UINotification> notification);
    [[nodiscard]] UINotification* get_notification(size_t index);
    [[nodiscard]] const UINotification* get_notification(size_t index) const;
    [[nodiscard]] size_t notification_count() const;
    [[nodiscard]] bool remove_notification(size_t index);
    void clear_notifications();

private:
    FrameCounter m_counter;
    UIFont m_fonts[FONT_COUNT];
    std::unordered_map<std::string, std::unique_ptr<IconTexture>> m_textures;
    std::vector<std::pair<TabButtonWidget, std::unique_ptr<UITab>>> m_tabs;
    std::vector<std::unique_ptr<UIModal>> m_modals;
    std::vector<std::unique_ptr<UINotification>> m_notifications;
    bool m_done = false;
    SDL_Window* m_window;
    ImGuiIO* m_io;
    UITab* m_current_tab = nullptr;
};
