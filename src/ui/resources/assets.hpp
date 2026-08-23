#pragma once

#include "font.hpp"
#include "icon.hpp"

#include <array>
#include <filesystem>
#include <memory>
#include <string>
#include <string_view>
#include <unordered_map>

namespace ui {
    class AssetRegistry {
    public:
        AssetRegistry();

        AssetRegistry(const AssetRegistry&) = delete;
        AssetRegistry& operator=(const AssetRegistry&) = delete;

        [[nodiscard]] Font* add_font(FontType type, std::filesystem::path location);
        [[nodiscard]] Font* find_font(FontType type);
        [[nodiscard]] Font& font(FontType type);
        [[nodiscard]] IconTexture* add_resource(std::string id, std::filesystem::path location);
        [[nodiscard]] IconTexture* texture(std::string_view id);

        void release_context(ImGuiContext* context, SDL_GLContext gl_context);

    private:
        std::array<std::unique_ptr<Font>, static_cast<size_t>(FontType::FONT_COUNT)> m_fonts;
        std::unordered_map<std::string, std::unique_ptr<IconTexture>> m_textures;
    };
} // namespace ui
