#pragma once

#include "state.hpp"
#include "../tree/node.hpp"
#include "../widgets/widget-type.hpp"

#include <imgui.h>
#include <utility>

namespace ui {
    class StyledNode : public Node {
    public:
        explicit StyledNode(std::string id = {}, WidgetType type = WidgetType::Unknown)
            : Node(std::move(id)), m_widget_type(type) {}
        StyledNode(const StyledNode&) = delete;
        StyledNode& operator=(const StyledNode&) = delete;

        [[nodiscard]] WidgetType widget_type() const {
            return m_widget_type;
        }

        /// effective values for the current transition.
        [[nodiscard]] Style& style() {
            return m_state.style();
        }

        [[nodiscard]] const Style& style() const {
            return m_state.style();
        }

        [[nodiscard]] Style& style(StyleType type) {
            return m_state.style(type);
        }

        [[nodiscard]] const Style& style(StyleType type) const {
            return m_state.style(type);
        }

        template <typename Func>
        StyledNode& configure_style(StyleType type, Func&& func) {
            m_state.configure_style(type, std::forward<Func>(func));
            return *this;
        }

        template <typename Func>
        StyledNode& configure_all_styles(Func&& func) {
            m_state.configure_all_styles(std::forward<Func>(func));
            return *this;
        }

        [[nodiscard]] StyleType style_type() const {
            return m_state.style_type();
        }

        void set_visual_style(StyleType type) {
            m_state.set_style(type);
        }

        void set_interaction_style(bool hovered, bool active, bool focused = false) {
            m_state.set_item_state(hovered, active, focused);
        }

        void fade_in() {
            m_state.fade_in();
        }

        void fade_out() {
            m_state.fade_out();
        }

        void set_opacity(float opacity) {
            m_state.set_opacity(opacity);
        }

        [[nodiscard]] float opacity() const {
            return m_state.opacity();
        }

        [[nodiscard]] bool visually_visible() const {
            return m_state.is_visible();
        }

        [[nodiscard]] bool accepts_visual_input() const {
            return m_state.accepts_input();
        }

        /// remeasures descendants because they may inherit this font.
        virtual StyledNode& set_font(ImFont* font) {
            ImFont* resolved_font = resolve_font(font);
            configure_all_styles([resolved_font](Style& style) { style.font(resolved_font); });
            invalidate_measure_subtree();
            return *this;
        }

        /// resolves the local font, then the closest styled ancestor, then imgui's font.
        [[nodiscard]] ImFont* font() const {
            if (style().font() != nullptr) {
                return style().font();
            }

            for (const Node* ancestor = parent(); ancestor != nullptr; ancestor = ancestor->parent()) {
                const auto* styled_ancestor = dynamic_cast<const StyledNode*>(ancestor);
                if (styled_ancestor != nullptr && styled_ancestor->style().font() != nullptr) {
                    return styled_ancestor->style().font();
                }
            }

            return ImGui::GetCurrentContext() == nullptr ? nullptr : ImGui::GetFont();
        }

        void draw() override {
            if (ImGui::GetCurrentContext() == nullptr) {
                Node::draw();
                return;
            }

            const Style& current_style = draw_style();
            const float inherited_alpha = ImGui::GetStyle().Alpha;

            ImGui::PushStyleVar(ImGuiStyleVar_FrameRounding, current_style.border_radius());
            ImGui::PushStyleVar(ImGuiStyleVar_ChildRounding, current_style.border_radius());
            ImGui::PushStyleVar(ImGuiStyleVar_Alpha, inherited_alpha * current_style.alpha() * draw_opacity());
            Node::draw();
            ImGui::PopStyleVar(3);
        }

    protected:
        void set_widget_type(WidgetType type) {
            m_widget_type = type;
        }

        [[nodiscard]] virtual const Style& draw_style() const {
            return style();
        }

        [[nodiscard]] virtual float draw_opacity() const {
            return 1.0F;
        }

        void advance_frame_state(float dt) final {
            m_state.update(dt);
        }

    private:
        static ImFont* resolve_font(ImFont* font) {
            return font != nullptr || ImGui::GetCurrentContext() == nullptr ? font : ImGui::GetFont();
        }

        VisualState m_state;
        WidgetType m_widget_type = WidgetType::Unknown;
    };
} // namespace ui
