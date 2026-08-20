#pragma once

#include "../widgets/widget.hpp"

#include <imgui.h>
#include <string>

namespace ui {
    /// style padding defines the content inset; screen bounds include it.
    class ChildContainer : public Widget {
    public:
        explicit ChildContainer(std::string id, WidgetType type = WidgetType::ChildContainer);

        /// a non-positive width opts into available-width fitting.
        ChildContainer& set_size(ImVec2 size);
        ChildContainer& set_scrollable(bool scrollable);
        /// replaces vertical style padding so one text line is centered in fixed height.
        ChildContainer& set_center_content_vertically(bool enabled);
        [[nodiscard]] const ImVec2& size() const;
        [[nodiscard]] Rect rect() const;
        ChildContainer& set_anchor(Anchor anchor);
        ChildContainer& set_anchor_position(ImVec2 relative_position);
        ChildContainer& set_origin(Origin origin);
        ChildContainer& set_origin_position(ImVec2 relative_position);
        ChildContainer& set_offset(ImVec2 offset);
        ChildContainer& set_placement(Anchor anchor, Origin origin, ImVec2 offset = {});
        /// derived containers must close the imgui scope opened here in on_draw_end().
        [[nodiscard]] bool on_draw() override;

    protected:
        void on_layout() override;

        /// draws partial borders that cannot be represented by imgui child flags.
        virtual void draw_borders();

        /// records the outer rectangle and closes the imgui child window.
        void on_draw_end() override;

    private:
        bool m_fit_width = false;
        bool m_scrollable = false;
        bool m_center_content_vertically = false;
        Rect m_child_rect{};
    };
} // namespace ui
