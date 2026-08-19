#pragma once

#include "../widgets/widget.hpp"

#include <imgui.h>
#include <string>

namespace ui {
    class ChildContainer : public Widget {
    public:
        explicit ChildContainer(std::string id, WidgetType type = WidgetType::ChildContainer);

        ChildContainer& set_size(ImVec2 size);
        ChildContainer& set_scrollable(bool scrollable);
        [[nodiscard]] const ImVec2& size() const;
        [[nodiscard]] Rect rect() const;
        ChildContainer& set_anchor(Anchor anchor);
        ChildContainer& set_anchor_position(ImVec2 relative_position);
        ChildContainer& set_origin(Origin origin);
        ChildContainer& set_origin_position(ImVec2 relative_position);
        ChildContainer& set_offset(ImVec2 offset);
        // opens the imgui child window using the current style and layout size.
        // derived containers must close or replace this scope in on_draw_end().
        [[nodiscard]] bool on_draw() override;

    protected:
        // fills non-positive dimensions from the current imgui content region.
        void on_layout() override;

        // draws borders that cannot be represented by imgui child flags.
        virtual void draw_borders();

        // records the child rectangle, closes the imgui child window and updates state.
        void on_draw_end() override;

    private:
        bool m_fit_width = false;
        bool m_scrollable = false;
        Rect m_child_rect{};
    };
} // namespace ui
