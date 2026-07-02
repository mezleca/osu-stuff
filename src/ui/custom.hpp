#pragma once

#include <glad/gl.h>
#include <imgui.h>
#include <lunasvg.h>
#include <cstdint>
#include <format>
#include <memory>
#include <string>
#include <string_view>
#include <unordered_map>
#include <filesystem>
#include <utility>

#include "widget.hpp"
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

struct TabButtonStyle : WidgetStyle {
    AnimatedFloat line_alpha;
    AnimatedFloat line_width;
    AnimatedColor text_color = {ui_theme::TEXT_COLOR};
};

struct TabButtonState : WidgetStyle {
    TabButtonStyle style;
};

struct SearchInputStyle : WidgetStyle {
    AnimatedColor m_border_color = {ui_theme::BORDER_COLOR};

    ImColor m_text_color = {240, 240, 240, 255};
    ImColor m_icon_color = {120, 120, 120, 255};
};

struct InputState : WidgetStyle {
    explicit InputState(IconTexture* texture);

    // data
    std::string m_label = "";
    std::string m_value = "";

    // animated stuff
    SearchInputStyle style;

    ImVec2 m_size = {120, 30};

    IconTexture* m_search_texture;

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

struct IconTexture {
public:
    explicit IconTexture(std::filesystem::path& location);

    GLuint get(int width, int height) {
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

    GLuint load(uint8_t* data, int width, int height);

private:
    std::unordered_map<std::string, std::pair<GLuint, std::unique_ptr<lunasvg::Bitmap>>> m_bitmaps;
    std::unique_ptr<lunasvg::Document> m_document;
};

namespace custom_imgui {
    void search_input(InputState* state);
    void line(ImVec2 a, ImVec2 b, ImU32 color, float thickness);
    bool begin_child(ChildState& state, ImGuiChildFlags child_flags = 0, ImGuiWindowFlags window_flags = 0);
    void end_child(ChildState& state, float thickness = 1.0f);
    void destroy_texture(uint32_t id);
    void image(IconTexture* texture, ImVec2 size = {0.0f, 0.0f}, ImColor color = ui_theme::TEXT_COLOR);
    bool tab_button(TabButtonState& state, std::string_view label, bool selected, bool draw_line, bool is_title);
}; // namespace custom_imgui
