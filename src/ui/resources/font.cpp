#include "font.hpp"

#include <iostream>
#include <utility>

void ui::Font::initialize(ImFontConfig cfg, std::filesystem::path location) {
    m_font_location = std::move(location);
    m_cfg = cfg;
}

ImFont* ui::Font::load_font_variation(ImGuiContext* context, int size) {
    if (context == nullptr || m_font_location.empty()) {
        return nullptr;
    }

    std::cout << "[ui] loading " << m_font_location << " (" << size << ")\n";

    ContextFonts& context_fonts = m_contexts[context];
    if (context_fonts.io == nullptr) {
        context_fonts.io = &ImGui::GetIO();
    }

    ImFont* font =
        context_fonts.io->Fonts->AddFontFromFileTTF(m_font_location.string().c_str(), static_cast<float>(size), &m_cfg);

    if (font != nullptr) {
        context_fonts.fonts[size] = font;
    }

    return font;
}

bool ui::Font::load(int size) {
    if (load_font_variation(ImGui::GetCurrentContext(), size) == nullptr) {
        std::cout << "[ui] failed to load " << m_font_location << " (" << size << ")\n";
        return false;
    }

    return true;
}

ImFont* ui::Font::get(int size) {
    ImGuiContext* context = ImGui::GetCurrentContext();
    if (context == nullptr) {
        return nullptr;
    }

    ContextFonts& context_fonts = m_contexts[context];
    const auto font_it = context_fonts.fonts.find(size);
    if (font_it != context_fonts.fonts.end()) {
        return font_it->second;
    }

    return load_font_variation(context, size);
}

void ui::Font::release_context(ImGuiContext* context) {
    if (context != nullptr) {
        m_contexts.erase(context);
    }
}
