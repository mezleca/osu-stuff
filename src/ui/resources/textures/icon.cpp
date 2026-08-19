#include "icon.hpp"

#include <string>
#include <format>

using namespace lunasvg;

IconTexture::IconTexture(const std::filesystem::path& location) {
    std::unique_ptr<Document> document = Document::loadFromFile(location.string());

    if (document == nullptr) {
        throw std::runtime_error(std::format("[IconTexture] failed to find {}", location.string()));
    }

    Element element = document->documentElement();
    m_id = element.getAttribute("class");

    m_document = std::move(document);
}

IconTexture::IconTexture(std::string_view content) {
    std::unique_ptr<Document> document = Document::loadFromData(std::string(content));

    if (document == nullptr) {
        throw std::runtime_error(std::format("[IconTexture] failed to load svg from data"));
    }

    Element element = document->documentElement();
    m_id = element.getAttribute("class");

    m_document = std::move(document);
}

GLuint IconTexture::get(const ImVec2& size) {
    const SDL_GLContext context = SDL_GL_GetCurrentContext();
    if (context == nullptr) {
        return 0;
    }

    const int width = static_cast<int>(size.x);
    const int height = static_cast<int>(size.y);
    const uint64_t size_key =
        (static_cast<uint64_t>(static_cast<uint32_t>(width)) << 32) | static_cast<uint32_t>(height);
    BitmapCache& cache = m_bitmaps[reinterpret_cast<uintptr_t>(context)];
    auto it = cache.find(size_key);

    if (it != cache.end()) {
        return it->second.first;
    }

    auto bitmap_data = m_document->renderToBitmap(width, height);
    bitmap_data.convertToRGBA();

    auto bitmap = std::make_unique<lunasvg::Bitmap>(bitmap_data);
    auto id = load(bitmap->data(), width, height);

    cache.emplace(size_key, std::make_pair(id, std::move(bitmap)));
    return id;
}

GLuint IconTexture::load(uint8_t* data, int w, int h) {
    // create an opengl texture identifier
    GLuint image_texture;

    glGenTextures(1, &image_texture);
    glBindTexture(GL_TEXTURE_2D, image_texture);

    // setup filtering parameters for display
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);

    // upload bitmap into texture
    glPixelStorei(GL_UNPACK_ROW_LENGTH, 0);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, w, h, 0, GL_RGBA, GL_UNSIGNED_BYTE, data);

    return image_texture;
}

void IconTexture::release_context(SDL_GLContext context) {
    if (context == nullptr) {
        return;
    }

    m_bitmaps.erase(reinterpret_cast<uintptr_t>(context));
}
