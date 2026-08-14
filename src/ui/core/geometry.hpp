#pragma once

#include <imgui.h>
#include <cstdint>

namespace ui {
    enum class Anchor : uint8_t {
        TopLeft,
        TopCenter,
        TopRight,
        CenterLeft,
        Center,
        CenterRight,
        BottomLeft,
        BottomCenter,
        BottomRight,
        Custom,
    };

    // origin uses the same points as anchor.
    // only the side of the relationship changes.
    using Origin = Anchor;

    [[nodiscard]] inline ImVec2 alignment_factor(Anchor alignment) {
        switch (alignment) {
            case Anchor::TopLeft:
                return {0.0F, 0.0F};
            case Anchor::TopCenter:
                return {0.5F, 0.0F};
            case Anchor::TopRight:
                return {1.0F, 0.0F};
            case Anchor::CenterLeft:
                return {0.0F, 0.5F};
            case Anchor::Center:
                return {0.5F, 0.5F};
            case Anchor::CenterRight:
                return {1.0F, 0.5F};
            case Anchor::BottomLeft:
                return {0.0F, 1.0F};
            case Anchor::BottomCenter:
                return {0.5F, 1.0F};
            case Anchor::BottomRight:
                return {1.0F, 1.0F};
            case Anchor::Custom:
                return {};
        }
        return {};
    }

    [[nodiscard]] inline ImVec2 resolve_layout_position(
        ImVec2 parent_size, ImVec2 child_size, ImVec2 anchor_factor, ImVec2 origin_factor, ImVec2 offset = {}
    ) {
        return {
            parent_size.x * anchor_factor.x - child_size.x * origin_factor.x + offset.x,
            parent_size.y * anchor_factor.y - child_size.y * origin_factor.y + offset.y,
        };
    }

    [[nodiscard]] inline ImVec2
    resolve_layout_position(ImVec2 parent_size, ImVec2 child_size, Anchor anchor, Origin origin, ImVec2 offset = {}) {
        return resolve_layout_position(
            parent_size, child_size, alignment_factor(anchor), alignment_factor(origin), offset
        );
    }

    class LayoutState {
    public:
        void set_size(ImVec2 size) {
            m_size = size;
        }

        [[nodiscard]] const ImVec2& size() const {
            return m_size;
        }

        void set_anchor(Anchor anchor) {
            m_anchor = anchor;
        }

        void set_anchor_position(ImVec2 position) {
            m_anchor = Anchor::Custom;
            m_anchor_position = position;
        }

        void set_origin(Origin origin) {
            m_origin = origin;
        }

        void set_origin_position(ImVec2 position) {
            m_origin = Origin::Custom;
            m_origin_position = position;
        }

        void set_offset(ImVec2 offset) {
            m_offset = offset;
        }

        [[nodiscard]] Anchor anchor() const {
            return m_anchor;
        }

        [[nodiscard]] Origin origin() const {
            return m_origin;
        }

        [[nodiscard]] ImVec2 anchor_factor() const {
            return m_anchor == Anchor::Custom ? m_anchor_position : alignment_factor(m_anchor);
        }

        [[nodiscard]] ImVec2 origin_factor() const {
            return m_origin == Origin::Custom ? m_origin_position : alignment_factor(m_origin);
        }

        [[nodiscard]] const ImVec2& offset() const {
            return m_offset;
        }

    private:
        ImVec2 m_size = {};
        ImVec2 m_offset = {};
        ImVec2 m_anchor_position = {};
        ImVec2 m_origin_position = {};
        Anchor m_anchor = Anchor::TopLeft;
        Origin m_origin = Origin::TopLeft;
    };

} // namespace ui
