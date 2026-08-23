#include "text-input.hpp"

#include "../ui.hpp"
#include "../style/theme.hpp"
#include "image.hpp"

#include <algorithm>
#include <cfloat>
#include <imgui_stdlib.h>
#include <SDL3/SDL_keycode.h>

static constexpr ImVec2 INPUT_ICON_SIZE = {18.0F, 18.0F};
static constexpr float INPUT_ICON_SPACING = 10.0F;

namespace ui {
    class TextInputWidget::FieldNode final : public Node {
    public:
        explicit FieldNode(TextInputWidget& input) : Node("text"), m_input(input) {}

        [[nodiscard]] bool accepts_input() const override {
            return false;
        }

        [[nodiscard]] std::optional<std::string> content() const override {
            return m_input.content();
        }

        bool try_set_content(std::string content) override {
            return m_input.try_set_content(std::move(content));
        }

    private:
        [[nodiscard]] bool on_draw() override {
            return m_input.draw_field();
        }

        TextInputWidget& m_input;
    };

    TextInputWidget::TextInputWidget(UI& ui, std::string& value) : TextInputWidget(ui, value, {}) {}

    TextInputWidget::TextInputWidget(UI& ui, std::string& value, std::string label)
        : ChildContainer(label, WidgetType::TextInput), m_ui(ui), m_value(&value), m_label(std::move(label)) {
        const Theme& theme = m_ui.theme();

        set_accepts_focus(true);
        set_center_content_vertically(true);
        set_font(ui.get_primary_font(18));

        configure_all_styles([&theme](Style& style) {
            style.border_color(theme.border_color, 24.0F)
                .padding({12.0F, 14.0F})
                .background_color(theme.background_secondary_color)
                .border(BORDER_ALL)
                .border_radius(theme.box_rounding);
        });

        configure_style(StyleType::ACTIVE, [&theme](Style& style) { style.border_color(theme.accent_color); });
        configure_style(StyleType::FOCUS, [&theme](Style& style) { style.border_color(theme.accent_color); });
        configure_style(StyleType::HOVER, [&theme](Style& style) { style.border_color(theme.accent_color); });

        m_field_node = &add_child<FieldNode>(*this);

        _on_event = [this](UiEvent& event) {
            if (event.type == EventType::PointerDown && event.button == PointerButton::Left) {
                m_focus_requested = m_ui.input_router().set_focus(*this);
            }

            if (event.type != EventType::Cancel && !(event.type == EventType::KeyDown && event.key == SDLK_ESCAPE)) {
                return;
            }

            m_ui.input_router().clear_focus(*this);
            event.stop_propagation();
        };
    }

    TextInputWidget& TextInputWidget::set_icon(IconTexture* icon) {
        if (icon == nullptr) {
            if (m_icon_node != nullptr) {
                static_cast<void>(remove(*m_icon_node));
                m_icon_node = nullptr;
            }
            return *this;
        }

        if (m_icon_node == nullptr) {
            m_icon_node = &add_child<ImageWidget>();
            m_icon_node->set_id("icon");
            m_icon_node->set_size(INPUT_ICON_SIZE);
            m_icon_node->set_enabled(false);
        }

        m_icon_node->set_texture(icon);
        return *this;
    }

    TextInputWidget& TextInputWidget::set_fit_width(bool fit_width) {
        m_fit_width = fit_width;
        return *this;
    }

    void TextInputWidget::on_layout() {
        ImVec2 size = layout().size();
        const ImVec2 available = ImGui::GetContentRegionAvail();

        if (m_fit_width || size.x <= 0.0F) {
            size.x = std::max(0.0F, available.x);
        }

        resolve_size(size);
    }

    bool TextInputWidget::draw_field() {
        if (m_focus_requested) {
            ImGui::SetKeyboardFocusHere();
            m_focus_requested = false;
        }

        ImGui::SetNextItemWidth(-FLT_MIN);
        ImGui::InputText(m_label.empty() ? "##text-input" : m_label.c_str(), m_value);
        return true;
    }

    void TextInputWidget::draw_children() {
        const bool has_icon = m_icon_node != nullptr;
        const float icon_width = has_icon ? INPUT_ICON_SIZE.x + INPUT_ICON_SPACING : 0.0F;
        const ImVec2 input_position = ImGui::GetCursorPos();
        const float input_height = ImGui::GetTextLineHeight();
        const float input_width = std::max(0.0F, ImGui::GetContentRegionAvail().x - icon_width);

        ImGui::SetCursorPosX(input_position.x + icon_width);
        m_field_node->set_size({input_width, input_height});
        ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, {0.0F, 0.0F});

        const ImVec4 transparent = m_ui.theme().transparent;
        ImGui::PushStyleColor(ImGuiCol_FrameBg, transparent);
        ImGui::PushStyleColor(ImGuiCol_FrameBgHovered, transparent);
        ImGui::PushStyleColor(ImGuiCol_FrameBgActive, transparent);

        m_field_node->draw();
        // the field supplies item geometry; the outer container owns interaction and focus.
        m_input_state = m_ui.input().observe(*this);
        m_input_state.hovered = m_input_state.hovered || ImGui::IsWindowHovered();

        ImGui::PopStyleColor(3);
        ImGui::PopStyleVar();

        if (!has_icon) {
            return;
        }

        const ImVec4 icon_color =
            m_input_state.hovered || m_input_state.active ? m_ui.theme().text_color : m_ui.theme().text_secondary_color;
        m_icon_node->style().color().set(ImColor(icon_color));
        m_icon_node->set_placement(
            Anchor::TopLeft, Origin::TopLeft, {0.0F, std::max(0.0F, (input_height - INPUT_ICON_SIZE.y) * 0.5F)}
        );
        m_icon_node->draw();
    }

    void TextInputWidget::on_draw_end() {
        apply_input_state(m_input_state);
        ChildContainer::on_draw_end();
    }

    const ItemInputState& TextInputWidget::input_state() const {
        return m_input_state;
    }

    std::optional<std::string> TextInputWidget::content() const {
        return m_value == nullptr ? std::nullopt : std::optional<std::string>{*m_value};
    }

    bool TextInputWidget::try_set_content(std::string content) {
        if (m_value == nullptr || *m_value == content) {
            return false;
        }

        *m_value = std::move(content);
        return true;
    }
} // namespace ui
