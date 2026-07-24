#pragma once

#include "object.hpp"

#include <imgui.h>
#include <cstdint>
#include <memory>
#include <string>
#include <vector>

enum UILayoutResize : uint8_t {
    LAYOUT_RESIZE_NONE,
    LAYOUT_RESIZE_X = 1 << 0,
    LAYOUT_RESIZE_Y = 1 << 1,
    LAYOUT_RESIZE_ALL = 1 << 2
};

class UIChildLayout : public UIObject {
public:
    explicit UIChildLayout(std::string id);

    void add(std::unique_ptr<UIObject> child);
    void set_size(ImVec2 size);
    [[nodiscard]] const ImVec2& get_size() const;
    void set_resize(UILayoutResize resize);
    void show() override;

private:
    void handle_resize();
    void draw_borders();

    std::vector<std::unique_ptr<UIObject>> m_children;
    ImVec2 m_size = {0.0f, 0.0f};
    ImVec2 m_last_click_pos = {0.0f, 0.0f};
    ImVec2 m_drag_start = {0.0f, 0.0f};
    ImVec2 m_previous_size = {0.0f, 0.0f};
    bool m_dragging = false;
    UILayoutResize m_resize = LAYOUT_RESIZE_NONE;
    UILayoutResize m_resizing = LAYOUT_RESIZE_NONE;
};
