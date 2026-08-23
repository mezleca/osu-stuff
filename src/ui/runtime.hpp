#pragma once

#include "resources/assets.hpp"
#include "style/theme.hpp"

#include <SDL3/SDL_events.h>
#include <filesystem>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

class UI;

namespace ui {
    struct RuntimeConfig {
        Theme theme = Theme::defaults();
        std::filesystem::path performance_directory;
    };

    /// one runtime may back multiple windows with independent imgui contexts and routers.
    class Runtime {
    public:
        explicit Runtime(RuntimeConfig config = {});
        ~Runtime();

        Runtime(const Runtime&) = delete;
        Runtime& operator=(const Runtime&) = delete;

        [[nodiscard]] const Theme& theme() const {
            return m_theme;
        }

        /// resets input state for every registered ui surface at the frame boundary.
        void begin_input_frame();

        /// routes an sdl event to the registered surface that owns its window.
        void process_sdl_event(SDL_Event* event);

        [[nodiscard]] Font* add_font(FontType type, std::filesystem::path location) {
            return m_assets.add_font(type, std::move(location));
        }

        [[nodiscard]] IconTexture* add_resource(std::string id, std::filesystem::path location) {
            return m_assets.add_resource(std::move(id), std::move(location));
        }

        [[nodiscard]] Font* find_font(FontType type) {
            return m_assets.find_font(type);
        }

        [[nodiscard]] Font& font(FontType type) {
            return m_assets.font(type);
        }

        [[nodiscard]] const Font& font(FontType type) const {
            return const_cast<Runtime*>(this)->font(type);
        }

        [[nodiscard]] IconTexture* resource(std::string_view id) {
            return m_assets.texture(id);
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
