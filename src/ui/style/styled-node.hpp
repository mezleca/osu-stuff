#pragma once

#include "style.hpp"
#include "../tree/node.hpp"
#include "../widgets/widget-type.hpp"

#include <imgui.h>

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

        [[nodiscard]] Style& style() {
            return m_style;
        }

        [[nodiscard]] const Style& style() const {
            return m_style;
        }

        virtual StyledNode& set_font(ImFont* font) {
            m_style.font(resolve_font(font));
            return *this;
        }

        [[nodiscard]] ImFont* font() const {
            if (m_style.font() != nullptr) {
                return m_style.font();
            }

            return ImGui::GetCurrentContext() == nullptr ? nullptr : ImGui::GetFont();
        }

        // applies the resolved style and opacity around the node draw lifecycle.
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
            return m_style;
        }

        [[nodiscard]] virtual float draw_opacity() const {
            return 1.0F;
        }

    private:
        static ImFont* resolve_font(ImFont* font) {
            return font != nullptr || ImGui::GetCurrentContext() == nullptr ? font : ImGui::GetFont();
        }

        Style m_style;
        WidgetType m_widget_type = WidgetType::Unknown;
    };
} // namespace ui
