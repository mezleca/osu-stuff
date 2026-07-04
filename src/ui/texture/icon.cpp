#include "icon.hpp"

#include <format>

IconTexture::IconTexture(std::filesystem::path& location) {
    auto document = lunasvg::Document::loadFromFile(location.string());

    if (document == nullptr) {
        throw std::runtime_error(std::format("[IconTexture] failed to find {}", location.string()));
    }

    m_document = std::move(document);
}

IconTexture::IconTexture(std::string_view content) {
    auto document = lunasvg::Document::loadFromData(content.data());

    if (document == nullptr) {
        throw std::runtime_error(std::format("[IconTexture] failed to load svg from data"));
    }

    m_document = std::move(document);
}

GLuint IconTexture::get(int width, int height) {
    auto key = std::format("{}x{}", width, height);
    auto it = m_bitmaps.find(key);

    if (it != m_bitmaps.end()) {
        return it->second.first;
    }

    auto bitmap_data = m_document->renderToBitmap(width, height);
    bitmap_data.convertToRGBA();

    auto bitmap = std::make_unique<lunasvg::Bitmap>(bitmap_data);
    auto id = load(bitmap->data(), width, height);

    m_bitmaps.emplace(key, std::make_pair(id, std::move(bitmap)));
    return id;
}

GLuint IconTexture::load(uint8_t* data, int w, int h) {
    // Create a OpenGL texture identifier
    GLuint image_texture;

    glGenTextures(1, &image_texture);
    glBindTexture(GL_TEXTURE_2D, image_texture);

    // Setup filtering parameters for display
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);

    // Upload bitmap into texture
    glPixelStorei(GL_UNPACK_ROW_LENGTH, 0);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, w, h, 0, GL_RGBA, GL_UNSIGNED_BYTE, data);

    return image_texture;
}