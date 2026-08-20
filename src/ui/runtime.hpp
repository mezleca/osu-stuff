#pragma once

#include "resources/assets.hpp"
#include "style/theme.hpp"

#include <SDL3/SDL_events.h>
#include <array>
#include <filesystem>
#include <vector>

class UI;

namespace ui {
    struct RuntimeConfig {
        Theme theme = Theme::defaults();
        std::array<std::filesystem::path, static_cast<size_t>(FontType::FONT_COUNT)> font_paths;
        std::filesystem::path icon_path;
        std::filesystem::path performance_directory;
    };

    class Runtime {
    public:
        explicit Runtime(RuntimeConfig config = {});
        ~Runtime();

        Runtime(const Runtime&) = delete;
        Runtime& operator=(const Runtime&) = delete;

        [[nodiscard]] Theme& theme() {
            return m_theme;
        }

        [[nodiscard]] const Theme& theme() const {
            return m_theme;
        }

        void set_theme(Theme theme);

        // resets input state for every registered ui surface at the frame boundary.
        void begin_input_frame();

        // routes an sdl event to the registered surface that owns its window.
        void process_sdl_event(SDL_Event* event);

        [[nodiscard]] const std::array<std::filesystem::path, static_cast<size_t>(FontType::FONT_COUNT)>&
        font_paths() const {
            return m_assets.font_paths();
        }

        [[nodiscard]] const std::filesystem::path& icon_path() const {
            return m_assets.icon_path();
        }

        [[nodiscard]] AssetRegistry& assets() {
            return m_assets;
        }

        [[nodiscard]] const AssetRegistry& assets() const {
            return m_assets;
        }

        [[nodiscard]] const std::filesystem::path& performance_directory() const {
            return m_performance_directory;
        }

    private:
        friend class ::UI;

        void register_surface(UI& surface);
        void unregister_surface(UI& surface);
        void release_context(ImGuiContext* context, SDL_GLContext gl_context);

        Theme m_theme;
        AssetRegistry m_assets;
        std::filesystem::path m_performance_directory;
        std::vector<UI*> m_surfaces;
    };
} // namespace ui
