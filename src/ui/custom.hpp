#pragma once

#include <cstdint>
#include <imgui.h>
#include <optional>
#include <string>
#include <string_view>

#include "widget.hpp"

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

struct TabButtonStyle {
    AnimatedFloat line_alpha;
    AnimatedFloat line_width;
    AnimatedColor text_color = {ui_theme::TEXT_COLOR};
};

struct TabButtonState : WidgetState {
    TabButtonStyle style;
};

struct ImageTexture {
    uint32_t m_id = 0;
    int m_width = 0;
    int m_height = 0;
};

struct InputState {
    explicit InputState(ImageTexture texture);

    std::string m_label = "";
    std::string m_value = "";

    ImColor m_border_color = {51, 51, 51, 255};
    ImColor m_text_color = {240, 240, 240, 255};

    ImVec2 m_size = {120, 30};

    ImageTexture m_search_texture;

    bool m_focused = false;
    bool m_fit_width = false;
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
    void search_input(InputState* state);
    void line(ImVec2 a, ImVec2 b, ImU32 color, float thickness);
    bool begin_child(ChildState& state, ImGuiChildFlags child_flags = 0, ImGuiWindowFlags window_flags = 0);
    void end_child(ChildState& state, float thickness = 1.0f);
    std::optional<ImageTexture> load_texture_from_file(std::string_view);
    void destroy_texture(ImageTexture& texture);
    void image(const ImageTexture& texture, ImVec2 size = {0.0f, 0.0f});
    bool tab_button(TabButtonState& state, std::string_view label, bool selected, bool draw_line, bool is_title);
}; // namespace custom_imgui
