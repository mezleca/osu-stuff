#pragma once

#include <imgui.h>
#include <cstdint>
#include <string>

#include "theme.hpp"

struct IconTexture;

enum customChildBorder : uint8_t {
    BORDER_NONE = 0,
    BORDER_LEFT = 1 << 0,
    BORDER_TOP = 1 << 1,
    BORDER_RIGHT = 1 << 2,
    BORDER_BOTTOM = 1 << 3,
    BORDER_ALL = 1 << 4,
};

enum customChildResize : uint8_t {
    CHILD_RESIZE_NONE,
    CHILD_RESIZE_X = 1 << 0,
    CHILD_RESIZE_Y = 1 << 1,
    CHILD_RESIZE_ALL = 1 << 2
};

struct ChildState {
    std::string m_id;

    ImColor m_border_color = {120, 120, 120, 255};

    ImVec2 m_last_click_pos = {0.0f, 0.0f};
    ImVec2 m_drag_start = {0.0f, 0.0f};
    ImVec2 m_size = {0.0f, 0.0f};
    ImVec2 m_previous_size = {0.0f, 0.0f};

    bool m_dragging = false;

    customChildBorder m_border = BORDER_NONE;
    customChildResize m_resize = CHILD_RESIZE_NONE;
    customChildResize m_resizing = CHILD_RESIZE_NONE;
};

namespace custom_imgui {
    void line(ImVec2 a, ImVec2 b, ImU32 color, float thickness);
    bool begin_child(ChildState& state, ImGuiChildFlags child_flags = 0, ImGuiWindowFlags window_flags = 0);
    void end_child(ChildState& state, float thickness = 1.0f);
    void destroy_texture(uint32_t id);
    void image(IconTexture* texture, ImVec2 size = {0.0f, 0.0f}, ImColor color = ui_theme::TEXT_COLOR);
}; // namespace custom_imgui
