#pragma once

#include "core/root.hpp"
#include "core/debugger.hpp"
#include "core/window.hpp"
#include "fonts/font.hpp"

#include <glad/gl.h>
#include <imgui.h>
#include <SDL3/SDL_events.h>
#include <SDL3/SDL_video.h>
#include <array>
#include <filesystem>
#include <memory>
#include <string>
#include <unordered_map>

/*
 * an imgui tool that takes care of: layout, containers, styling, other annoying stuff
 * it creates a bunch of abstraction so we dont have to do shit manually every time
 * the initial idea was to create this as a subproject so i could use it when creating similar apps however,
 * since this project relies on very specific imgui / sdl versions
 * i will just copy the files when needed...
 */

class IconTexture;
class UI;

namespace ui {
    UI& current();
}

namespace ui {
    struct Config {
        std::array<std::filesystem::path, static_cast<size_t>(FontType::FONT_COUNT)> font_paths;
        std::filesystem::path icon_path;
    };
} // namespace ui

class UI {
public:
    UI(ui::Window& window, ui::Config config);
    ~UI();

    void begin_frame();
    void end_frame();
    void process_sdl_event(SDL_Event* event);

    [[nodiscard]] bool is_done() const {
        return m_done;
    }

    [[nodiscard]] bool ready() const {
        return m_ready;
    }

    void exit() {
        m_done = true;
    }

    [[nodiscard]] ui::Font& get_font(ui::FontType type) {
        return m_fonts[static_cast<size_t>(type)];
    }

    [[nodiscard]] ui::InputRouter& input_router() {
        return m_root.input_router();
    }

    [[nodiscard]] ui::UiRoot& root() {
        return m_root;
    }

    [[nodiscard]] const ui::Font& get_font(ui::FontType type) const {
        return m_fonts[static_cast<size_t>(type)];
    }

    // textures
    [[nodiscard]] IconTexture* get_texture(std::string_view id);

private:
    ui::UiRoot m_root;
    ui::Debugger m_debugger;
    ui::Font m_fonts[static_cast<size_t>(ui::FontType::FONT_COUNT)];
    std::unordered_map<std::string, std::unique_ptr<IconTexture>> m_textures;
    ImGuiIO* m_io = nullptr;
    bool m_done = false;
    bool m_ready = false;
};
