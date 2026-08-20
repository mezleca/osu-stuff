#pragma once

#include "child-container.hpp"

namespace ui {
    class ResizableContainer : public ChildContainer {
    public:
        explicit ResizableContainer(std::string id);

        void set_resize(ResizeAxes resize);
        [[nodiscard]] ResizeAxes resize_axes() const;

    protected:
        void on_draw_end() override;

    private:
        void handle_resize();
        void draw_resize_indicator();

        ImVec2 m_drag_start = {0.0f, 0.0f};
        ImVec2 m_previous_size = {0.0f, 0.0f};
        bool m_dragging = false;
        ResizeAxes m_resize = ResizeAxes::None;
        ResizeAxes m_resizing = ResizeAxes::None;
    };
} // namespace ui
