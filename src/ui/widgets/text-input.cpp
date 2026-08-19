#include "text-input.hpp"

#include "../ui.hpp"

#include <cfloat>
#include <algorithm>
#include <imgui_stdlib.h>
#include <SDL3/SDL_keycode.h>

namespace ui {
    TextInputWidget::TextInputWidget(UI& ui, std::string& value, std::string label)
        : Widget({}, WidgetType::TextInput), m_ui(ui), m_value(&value), m_label(std::move(label)) {
        set_accepts_focus(true);

        on_event = [this](UiEvent& event) {
            if (event.type != EventType::Cancel && !(event.type == EventType::KeyDown && event.key == SDLK_ESCAPE)) {
                return;
            }

            m_ui.input_router().clear_focus(*this);
            event.stop_propagation();
        };
    }

    void TextInputWidget::on_layout() {
        ImVec2 size = layout().size();

        const ImVec2 available = ImGui::GetContentRegionAvail();
        const ImVec2 padding = style().padding();

        if (size.x <= 0.0F) {
            size.x = std::max(0.0F, available.x);
        }

        if (size.y <= 0.0F) {
            size.y = ImGui::GetTextLineHeight() + padding.y * 2.0F;
        }

        layout().set_size(size);
    }

    bool TextInputWidget::on_draw() {
        const Style& current_style = style();
        ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, current_style.padding());

        const ImVec4 color = current_style.background_color().get();
        ImGui::PushStyleColor(ImGuiCol_FrameBg, color);
        ImGui::PushStyleColor(ImGuiCol_FrameBgHovered, color);
        ImGui::PushStyleColor(ImGuiCol_FrameBgActive, color);

        ImGui::SetNextItemWidth(-FLT_MIN);
        ImGui::InputText(m_label.c_str(), m_value);
        m_input_state = m_ui.input().observe(*this);

        ImGui::PopStyleColor(3);
        ImGui::PopStyleVar();
        return true;
    }

    void TextInputWidget::on_draw_end() {
        apply_input_state(m_input_state);
        state().update(ImGui::GetIO().DeltaTime);
    }

    const ItemInputState& TextInputWidget::input_state() const {
        return m_input_state;
    }

    std::optional<std::string> TextInputWidget::get_content() const {
        return m_value == nullptr ? std::nullopt : std::optional<std::string>{*m_value};
    }

    bool TextInputWidget::set_content(std::string content) {
        if (m_value == nullptr || *m_value == content) {
            return false;
        }

        *m_value = std::move(content);
        return true;
    }
} // namespace ui
