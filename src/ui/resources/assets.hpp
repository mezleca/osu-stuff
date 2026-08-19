#pragma once

#include "fonts/font.hpp"
#include "textures/icon.hpp"

#include <array>
#include <filesystem>
#include <memory>
#include <string>
#include <string_view>
#include <unordered_map>

namespace ui {
    class AssetRegistry {
    public:
        AssetRegistry(
            std::array<std::filesystem::path, static_cast<size_t>(FontType::FONT_COUNT)> font_paths,
            std::filesystem::path icon_path
        );

        AssetRegistry(const AssetRegistry&) = delete;
        AssetRegistry& operator=(const AssetRegistry&) = delete;

        [[nodiscard]] Font& font(FontType type, ImGuiContext* context, ImGuiIO* io);
        [[nodiscard]] IconTexture* texture(std::string_view id);

        void release_context(ImGuiContext* context, SDL_GLContext gl_context);

        [[nodiscard]] const std::array<std::filesystem::path, static_cast<size_t>(FontType::FONT_COUNT)>&
        font_paths() const {
            return m_font_paths;
        }

        [[nodiscard]] const std::filesystem::path& icon_path() const {
            return m_icon_path;
        }

    private:
        struct FontAsset {
            std::filesystem::path path;
            std::unordered_map<ImGuiContext*, std::unique_ptr<Font>> contexts;
        };

        void load_textures();

        std::array<std::filesystem::path, static_cast<size_t>(FontType::FONT_COUNT)> m_font_paths;
        std::filesystem::path m_icon_path;
        std::array<FontAsset, static_cast<size_t>(FontType::FONT_COUNT)> m_fonts;
        std::unordered_map<std::string, std::unique_ptr<IconTexture>> m_textures;
    };
} // namespace ui
