#pragma once

#include "../widgets/widget.hpp"

#include <imgui.h>
#include <string>

namespace ui {
    /// style padding defines the content inset; screen bounds include it.
    class ChildContainer : public Widget {
    public:
        explicit ChildContainer(std::string id, WidgetType type = WidgetType::ChildContainer);

        ChildContainer& set_scrollable(bool scrollable);
        /// replaces vertical style padding so one text line is centered in fixed height.
        ChildContainer& set_center_content_vertically(bool enabled);
        /// derived containers must close the imgui scope opened here in on_draw_end().
        [[nodiscard]] bool on_draw() override;

    protected:
        void on_layout() override;

        /// draws partial borders that cannot be represented by imgui child flags.
        virtual void draw_borders();

        /// records the outer rectangle and closes the imgui child window.
        void on_draw_end() override;

    private:
        bool m_scrollable = false;
        bool m_center_content_vertically = false;
        Rect m_child_rect{};
    };
} // namespace ui
