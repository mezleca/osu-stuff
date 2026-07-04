#pragma once

#include "custom.hpp"
#include "tabs/tabs.hpp"
#include "fonts/font.hpp"

#include <glad/gl.h>
#include <imgui.h>
#include <SDL3/SDL_events.h>
#include <SDL3/SDL_video.h>
#include <memory>
#include <string>
#include <unordered_map>
#include <vector>

struct UIModal;
struct TabButtonWidget;

struct FrameCounter {
    Uint64 last_time = 0;
    Uint64 frame_count = 0;
    double current_fps = 0.0;
    bool show_ui = false;
};

struct UI {
public:
    UI(SDL_GLContext* context, SDL_Window* window);
    ~UI();

    void show_debug_ui();
    void render();
    void process_sdl_event(SDL_Event* event);

    bool is_done() {
        return m_done;
    }
    void exit() {
        m_done = true;
    };

    double get_fps() {
        return m_counter.current_fps;
    }

    // textures
    [[nodiscard]] IconTexture* get_texture(std::string_view id);

    // modals
    [[nodiscard]] bool is_modal_focused(UIModal* modal) const;
    [[nodiscard]] bool has_modal(std::string_view id) const;
    [[nodiscard]] UIModal* focused_modal() const;
    [[nodiscard]] size_t modal_count();
    [[nodiscard]] bool remove_modal(std::string_view id);
    [[nodiscard]] bool remove_focused_modal();
    void show_modal(UIModal* modal, bool wipe = false);
    void clear_modals();
    void handle_escape();

    UIFont m_fonts[FONT_COUNT];
    FrameCounter m_counter;

private:
    std::unordered_map<std::string, std::unique_ptr<IconTexture>> m_textures;
    std::vector<std::pair<TabButtonWidget, std::unique_ptr<UITab>>> m_tabs;
    std::vector<UIModal*> m_modals;
    bool m_done = false;
    SDL_Window* m_window;
    ImGuiIO* m_io;
    UITab* m_current_tab = nullptr;
};
