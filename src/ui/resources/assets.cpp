#include "assets.hpp"

#include "../constants.hpp"
#include "svg.hpp"

#include <SDL3/SDL_log.h>

#include <iostream>
#include <utility>

namespace ui {
    AssetRegistry::AssetRegistry(
        std::array<std::filesystem::path, static_cast<size_t>(FontType::FONT_COUNT)> font_paths,
        std::filesystem::path icon_path
    )
        : m_font_paths(std::move(font_paths)), m_icon_path(std::move(icon_path)) {
        for (std::size_t index = 0; index < m_fonts.size(); ++index) {
            m_fonts[index].path = m_font_paths[index];
        }

        load_textures();
    }

    Font& AssetRegistry::font(FontType type, ImGuiContext* context, ImGuiIO* io) {
        const std::size_t index = static_cast<size_t>(type);
        FontAsset& asset = m_fonts[index];
        auto it = asset.contexts.find(context);

        if (it != asset.contexts.end()) {
            return *it->second;
        }

        auto font = std::make_unique<Font>();
        ImFontConfig config;
        config.PixelSnapH = false;
        config.OversampleH = 5;
        config.OversampleV = 5;
        config.RasterizerMultiply = 1.2f;
        font->initialize(config, asset.path.string(), io);

        Font* result = font.get();
        asset.contexts.emplace(context, std::move(font));
        return *result;
    }

    IconTexture* AssetRegistry::texture(std::string_view id) {
        const auto it = m_textures.find(std::string{id});

        if (it == m_textures.end()) {
            std::cout << "[ui] failed to find " << id << " (returning default svg)\n";
            return m_textures.at("default").get();
        }

        return it->second.get();
    }

    void AssetRegistry::release_context(ImGuiContext* context, SDL_GLContext gl_context) {
        for (FontAsset& asset : m_fonts) {
            asset.contexts.erase(context);
        }

        for (auto& [id, texture] : m_textures) {
            static_cast<void>(id);
            texture->release_context(gl_context);
        }
    }

    void AssetRegistry::load_textures() {
        m_textures.emplace("default", std::make_unique<IconTexture>(std::string_view{DEFAULT_WARN_SVG}));

        if (!std::filesystem::exists(m_icon_path)) {
            return;
        }

        for (const auto& entry : std::filesystem::directory_iterator(m_icon_path)) {
            const auto path = entry.path();

            if (!std::filesystem::is_regular_file(entry.status()) || path.extension() != ".svg") {
                continue;
            }

            auto texture = std::make_unique<IconTexture>(path);

            if (texture->get_id().empty()) {
                SDL_Log("UI: failed to get asset id from %s", path.string().c_str());
                continue;
            }

            if (!m_textures.emplace(texture->get_id(), std::move(texture)).second) {
                SDL_Log("UI: duplicate icon asset id, skipping %s", path.string().c_str());
            }
        }
    }
} // namespace ui
