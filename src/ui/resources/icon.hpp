#pragma once

#include <glad/gl.h>
#include <imgui.h>
#include <SDL3/SDL_video.h>
#include <lunasvg.h>
#include <cstdint>
#include <memory>
#include <string>
#include <unordered_map>
#include <filesystem>

class IconTexture {
public:
    explicit IconTexture(const std::filesystem::path& location);
    explicit IconTexture(std::string_view location);
    GLuint get(const ImVec2& size);
    GLuint load(uint8_t* data, int width, int height);
    void release_context(SDL_GLContext context);

    const std::string& get_id() {
        return m_id;
    }

private:
    using BitmapCache = std::unordered_map<uint64_t, std::pair<GLuint, std::unique_ptr<lunasvg::Bitmap>>>;
    std::unordered_map<uintptr_t, BitmapCache> m_bitmaps;
    std::unique_ptr<lunasvg::Document> m_document;
    std::string m_id = "";
};
