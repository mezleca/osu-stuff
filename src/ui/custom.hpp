#pragma once

#include <cstdint>
#include <filesystem>
#include <imgui.h>
#include <optional>
#include <span>
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
    CHILD_RESIZE_Y = 1 << 1
};

struct ChildState {
    std::string m_id;

    ImVec2 m_drag_start = {0.0f, 0.0f};
    ImVec2 m_size = {0.0f, 0.0f};
    ImVec2 m_previous_size = {0.0f, 0.0f};

    bool m_dragging = false;

    customChildResize m_resize = CHILD_RESIZE_NONE;
    customChildResize m_resizing = CHILD_RESIZE_NONE;
};

namespace custom_imgui {
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

    void search_input(std::string_view label, std::string& input);
    void line(ImVec2 a, ImVec2 b, ImU32 color, float thickness);
    bool begin_child(ChildState& state, ImGuiChildFlags child_flags = 0, ImGuiWindowFlags window_flags = 0);
    void end_child(ChildState& state, customChildBorder flags, ImU32 color, float thickness = 1.0f);
    [[nodiscard]] std::optional<ImageTexture> load_texture_from_file(const std::filesystem::path& path);
    [[nodiscard]] std::optional<ImageTexture> load_texture_from_memory(std::span<const unsigned char> data);
    void destroy_texture(ImageTexture& texture);
    void image(const ImageTexture& texture, ImVec2 size = {0.0f, 0.0f});
    bool tab_button(TabButtonState& state, std::string_view label, bool selected, bool draw_line, bool is_title);
}; // namespace custom_imgui
