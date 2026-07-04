#pragma once

#include <glad/gl.h>
#include <lunasvg.h>
#include <unordered_map>
#include <filesystem>

struct IconTexture {
public:
    explicit IconTexture(std::filesystem::path& location);
    explicit IconTexture(std::string_view location);
    GLuint get(int width, int height);
    GLuint load(uint8_t* data, int width, int height);

private:
    std::unordered_map<std::string, std::pair<GLuint, std::unique_ptr<lunasvg::Bitmap>>> m_bitmaps;
    std::unique_ptr<lunasvg::Document> m_document;
};