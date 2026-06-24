#pragma once

#include <cstdint>
#include <imgui.h>
#include <string>
#include <string_view>

enum customChildBorder : uint8_t {
    BORDER_NONE = 0,
    BORDER_LEFT = 1 << 0,
    BORDER_TOP = 1 << 1,
    BORDER_RIGHT = 1 << 2,
    BORDER_BOTTOM = 1 << 3,
    BORDER_ALL = 1 << 4,
};

enum customChildResize : uint8_t { CHILD_RESIZE_NONE, CHILD_RESIZE_X = 1 << 0, CHILD_RESIZE_Y = 1 << 1 };

struct ChildState {
    std::string m_id;

    ImVec2 m_drag_start;
    ImVec2 m_size;
    ImVec2 m_saved_size;

    float m_drag_offset;
    bool m_dragging;

    customChildResize m_resize = CHILD_RESIZE_NONE;
    customChildResize m_resizing = CHILD_RESIZE_NONE;
};

namespace custom_imgui {
    void search_input(std::string_view label, std::string& input);
    void line(ImVec2 a, ImVec2 b, ImU32 color, float thickness);
    bool begin_child(ChildState* state, ImGuiChildFlags child_flags = 0, ImGuiWindowFlags window_flags = 0);
    void end_child(ChildState* state, customChildBorder flags, ImU32 color, float thickness = 1.0f);
}; // namespace custom_imgui
