#include "font.hpp"

#include <iostream>

void UIFont::initialize(ImFontConfig cfg, std::string location, ImGuiIO* io) {
    m_font_location = location;
    m_cfg = cfg;
    m_io = io;
}

ImFont* UIFont::load_font_variation(int size) {
    std::cout << "[ui] loading " << m_font_location << " (" << size << ")\n";

    ImFont* font = m_io->Fonts->AddFontFromFileTTF(m_font_location.c_str(), static_cast<float>(size), &m_cfg);

    if (font != nullptr) {
        m_fonts[size] = font;
    }

    return font;
}

bool UIFont::load(int size) {
    if (m_font_location.empty()) {
        return false;
    }

    if (load_font_variation(size) == nullptr) {
        std::cout << "[ui] failed to load " << m_font_location << " (" << size << ")\n";
        return false;
    }

    return true;
}
