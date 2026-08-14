#pragma once

#include "../object.hpp"

#include <imgui.h>

namespace ui {
    class LineWidget : public StyledNode {
    public:
        LineWidget(ImVec2 start, ImVec2 end, ImColor color, float thickness = 1.0f)
            : m_start(start), m_end(end), m_color(color), m_thickness(thickness) {}

        void on_draw() override;

    private:
        ImVec2 m_start;
        ImVec2 m_end;
        ImColor m_color;
        float m_thickness;
    };

} // namespace ui
