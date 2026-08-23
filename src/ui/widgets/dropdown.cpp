#include "dropdown.hpp"

#include "../style/theme.hpp"
#include "../ui.hpp"
#include "../imgui/draw.hpp"
#include "text.hpp"

#include <imgui.h>

#include <algorithm>

namespace ui {
    class DropdownTriggerNode final : public Widget {
    public:
        explicit DropdownTriggerNode(DropdownWidget& dropdown)
            : Widget("trigger", WidgetType::Dropdown), m_dropdown(dropdown) {}

    private:
        [[nodiscard]] bool on_draw() override {
            return m_dropdown.draw_trigger(*this);
        }

        DropdownWidget& m_dropdown;
    };

    class DropdownBodyNode final : public Widget {
    public:
        explicit DropdownBodyNode(DropdownWidget& dropdown)
            : Widget("body", WidgetType::Dropdown), m_dropdown(dropdown) {}

    private:
        [[nodiscard]] bool on_draw() override {
            return m_dropdown.draw_body(*this);
        }

        DropdownWidget& m_dropdown;
    };

    DropdownWidget::DropdownWidget(UI& ui, std::string& value, std::vector<DropdownOption> options, std::string id)
        : Widget(std::move(id), WidgetType::Dropdown), m_ui(ui), m_value(&value), m_options(std::move(options)) {
        m_label_node = &add_child<TextWidget>("");
        m_trigger = &add_child<DropdownTriggerNode>(*this);
        m_body = &add_child<DropdownBodyNode>(*this);
        configure_default_styles();
    }

    void DropdownWidget::configure_default_styles() {
        const Theme& theme = m_ui.theme();

        const auto configure = [&theme](Widget& widget) {
            widget.configure_all_styles([&theme](Style& style) {
                style.color(theme.text_color)
                    .background_color(theme.control_background_color)
                    .border_color(theme.control_border_color, 18.0F)
                    .padding({10.0F, 6.0F})
                    .border(BORDER_ALL)
                    .border_radius(theme.control_rounding)
                    .border_thickness(theme.control_border_thickness);
            });
        };

        m_label_node->style().color(theme.text_color);

        configure(*m_trigger);
        configure(*m_body);

        m_trigger->configure_style(StyleType::HOVER, [&theme](Style& style) {
            style.background_color(theme.control_hover_color);
        });

        m_trigger->configure_style(StyleType::ACTIVE, [&theme](Style& style) {
            style.background_color(theme.control_active_color);
        });
    }

    DropdownWidget& DropdownWidget::set_label(std::string label) {
        static_cast<void>(m_label_node->try_set_content(std::move(label)));
        if (ImGui::GetCurrentContext() != nullptr && has_label() &&
            m_label_placement == DropdownLabelPlacement::Above) {
            Node::set_size({m_trigger_size.x, m_trigger_size.y + ImGui::GetTextLineHeightWithSpacing()});
        }
        return *this;
    }

    DropdownWidget& DropdownWidget::set_label_placement(DropdownLabelPlacement placement) {
        m_label_placement = placement;
        if (ImGui::GetCurrentContext() != nullptr) {
            const float label_height = !has_label() || placement == DropdownLabelPlacement::Inline
                                           ? 0.0F
                                           : ImGui::GetTextLineHeightWithSpacing();
            Node::set_size({m_trigger_size.x, m_trigger_size.y + label_height});
        }
        return *this;
    }

    DropdownWidget& DropdownWidget::set_placeholder(std::string placeholder) {
        m_placeholder = std::move(placeholder);
        return *this;
    }

    DropdownWidget& DropdownWidget::set_options(std::vector<DropdownOption> options) {
        m_options = std::move(options);
        return *this;
    }

    DropdownWidget& DropdownWidget::set_size(ImVec2 size) {
        m_trigger_size = size;
        m_trigger->set_size(size);
        const float label_height =
            has_label() && m_label_placement == DropdownLabelPlacement::Above && ImGui::GetCurrentContext() != nullptr
                ? ImGui::GetTextLineHeightWithSpacing()
                : 0.0F;
        Node::set_size({size.x, size.y + label_height});
        return *this;
    }

    bool DropdownWidget::changed() const {
        return m_changed;
    }

    TextWidget& DropdownWidget::label() {
        return *m_label_node;
    }

    Widget& DropdownWidget::trigger() {
        return *m_trigger;
    }

    Widget& DropdownWidget::body() {
        return *m_body;
    }

    bool DropdownWidget::on_draw() {
        ImGui::PushID(this);
        return true;
    }

    void DropdownWidget::on_draw_end() {
        ImGui::PopID();
    }

    void DropdownWidget::on_layout() {
        if (m_trigger_size.x == 0.0F && m_trigger_size.y == 0.0F) {
            m_trigger_size = layout().size();
        }

        m_trigger->set_size(m_trigger_size);
        if (!has_label() || m_label_placement == DropdownLabelPlacement::Inline) {
            resolve_size(m_trigger_size);
            return;
        }

        const float label_height = ImGui::GetTextLineHeightWithSpacing();
        resolve_size({m_trigger_size.x, m_trigger_size.y + label_height});
    }

    void DropdownWidget::draw_children() {
        const float content_x = ImGui::GetCursorPosX();
        if (has_label()) {
            m_label_node->draw();
            if (m_label_placement == DropdownLabelPlacement::Inline) {
                ImGui::SameLine();
            } else {
                ImGui::SetCursorPosX(content_x);
            }
        }

        // body remains a child even though imgui renders it in a separate popup
        // window; this keeps styling, profiling and debugger identity intact.
        m_trigger->draw();
        m_body->draw();
    }

    const DropdownOption* DropdownWidget::selected_option() const {
        const auto it = std::find_if(m_options.begin(), m_options.end(), [this](const DropdownOption& option) {
            return option.value == *m_value;
        });
        return it == m_options.end() ? nullptr : &*it;
    }

    bool DropdownWidget::has_label() const {
        const std::optional<std::string> text = m_label_node->content();
        return text.has_value() && !text->empty();
    }

    void DropdownWidget::draw_trigger_frame(
        ImVec2 minimum, ImVec2 maximum, std::string_view preview, bool open, const Style& current_style
    ) const {
        const Theme& theme = m_ui.theme();
        const float height = maximum.y - minimum.y;
        const ImU32 background =
            open ? ImGui::GetColorU32(theme.control_active_color) : current_style.background_color().get_col();
        const ImU32 border = current_style.border_color().get_col();
        const ImU32 text_color = current_style.color().get_col();
        draw_frame(
            minimum, maximum, background, border, current_style.border_radius(), current_style.border_thickness()
        );

        const ImVec2 text_size = ImGui::CalcTextSize(preview.data(), preview.data() + preview.size());
        const ImVec2 text_position = {
            minimum.x + current_style.padding().x,
            minimum.y + (height - text_size.y) * 0.5F,
        };

        draw_text(text_position, text_color, preview);

        const ImVec2 arrow_center = {
            maximum.x - current_style.padding().x - 4.0F,
            minimum.y + height * 0.5F,
        };
        draw_triangle(arrow_center, {8.0F, 4.0F}, text_color, open ? TriangleDirection::Up : TriangleDirection::Down);
    }

    bool DropdownWidget::draw_trigger(DropdownTriggerNode& trigger) {
        m_changed = false;
        const Style& current_style = trigger.style();
        const NodeLayout& trigger_layout = trigger.layout();

        ImGui::BeginGroup();

        float width = trigger_layout.size().x;

        if (has_label() && m_label_placement == DropdownLabelPlacement::Inline && width > 0.0F) {
            const float label_width =
                m_label_node->layout().screen_rect().size().x + ImGui::GetStyle().ItemInnerSpacing.x;
            width = std::max(1.0F, width - label_width);
        }

        const DropdownOption* selected = selected_option();
        const std::string_view preview = selected != nullptr ? selected->label : m_placeholder;
        const float trigger_width = width > 0.0F ? width : ImGui::GetContentRegionAvail().x;
        const float trigger_height = trigger_layout.size().y > 0.0F ? trigger_layout.size().y : ImGui::GetFrameHeight();

        ImGui::InvisibleButton("##trigger", {trigger_width, trigger_height});

        const ImVec2 trigger_min = ImGui::GetItemRectMin();
        const ImVec2 trigger_max = ImGui::GetItemRectMax();
        m_trigger_rect = {trigger_min, trigger_max};

        const ItemInputState input = m_ui.input().observe(trigger);
        bool open = ImGui::IsPopupOpen("##options");

        if (ImGui::IsItemClicked()) {
            if (open) {
                m_body->fade_out();
            } else {
                m_open_requested = true;
                open = true;
            }
        }

        draw_trigger_frame(trigger_min, trigger_max, preview, open, current_style);
        ImGui::EndGroup();

        trigger.apply_input_state(input, open);
        return true;
    }

    bool DropdownWidget::draw_body(DropdownBodyNode& body) {
        const Theme& theme = m_ui.theme();

        if (m_open_requested) {
            body.fade_in();
            ImGui::OpenPopup("##options");
            m_open_requested = false;
        }

        if (!ImGui::IsPopupOpen("##options")) return false;

        const Style& current_style = body.style();
        const ImVec2 default_position = {m_trigger_rect.min.x, m_trigger_rect.max.y + 4.0F};
        const ImVec2 popup_position =
            body.layout().has_explicit_position() ? body.layout().screen_rect().min : default_position;
        const ImVec2 body_size = body.layout().size();

        const float item_height = ImGui::GetTextLineHeight() + current_style.padding().y * 2.0F;
        const float popup_width = body_size.x > 0.0F ? body_size.x : m_trigger_rect.size().x;

        ImGui::SetNextWindowPos(popup_position, ImGuiCond_Always);
        ImGui::SetNextWindowSize({popup_width, body_size.y}, ImGuiCond_Always);
        ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, ImVec2{current_style.padding().x, 8.0F});
        ImGui::PushStyleVar(ImGuiStyleVar_PopupBorderSize, current_style.border_thickness());
        ImGui::PushStyleVar(ImGuiStyleVar_PopupRounding, current_style.border_radius() + 2.0F);
        ImGui::PushStyleVar(ImGuiStyleVar_ItemSpacing, ImVec2{});
        ImGui::PushStyleVar(ImGuiStyleVar_SelectableRounding, current_style.border_radius());
        ImGui::PushStyleVar(ImGuiStyleVar_SelectableTextAlign, ImVec2{0.0F, 0.5F});
        ImGui::PushStyleColor(ImGuiCol_PopupBg, theme.control_background_color);
        ImGui::PushStyleColor(ImGuiCol_Border, current_style.border_color().get_col());
        ImGui::PushStyleColor(ImGuiCol_Text, current_style.color().get_col());
        ImGui::PushStyleColor(ImGuiCol_Header, ImVec4{});
        ImGui::PushStyleColor(ImGuiCol_HeaderHovered, ImVec4{});
        ImGui::PushStyleColor(ImGuiCol_HeaderActive, ImVec4{});

        bool changed = false;
        if (ImGui::BeginPopup("##options")) {
            if (!body.visually_visible()) {
                ImGui::CloseCurrentPopup();
            } else {
                for (const DropdownOption& option : m_options) {
                    const ImVec2 item_position = ImGui::GetCursorScreenPos();
                    const ImVec2 item_size = {ImGui::GetContentRegionAvail().x, item_height};
                    const ImVec2 item_max = {item_position.x + item_size.x, item_position.y + item_size.y};
                    const bool hovered = ImGui::IsMouseHoveringRect(item_position, item_max);
                    const bool is_selected = option.value == *m_value;
                    const ImU32 text_color = hovered       ? ImGui::GetColorU32(theme.accent_hover_color)
                                             : is_selected ? ImGui::GetColorU32(theme.accent_color)
                                                           : current_style.color().get_col();
                    ImGui::PushStyleColor(ImGuiCol_Text, text_color);

                    const bool pressed = ImGui::Selectable(
                        option.label.c_str(), is_selected, ImGuiSelectableFlags_NoAutoClosePopups, item_size
                    );
                    ImGui::PopStyleColor();

                    if (pressed) {
                        if (!is_selected) {
                            *m_value = option.value;
                            changed = true;
                        }
                        body.fade_out();
                    }

                    if (is_selected) {
                        ImGui::SetItemDefaultFocus();
                    }
                }
            }

            const ImVec2 popup_min = ImGui::GetWindowPos();
            const ImVec2 popup_size = ImGui::GetWindowSize();

            m_body_rect = {popup_min, {popup_min.x + popup_size.x, popup_min.y + popup_size.y}};
            set_child_screen_rect(body, m_body_rect);
            m_ui.input_router().register_region_in_layer(body, m_body_rect, InputLayer::Overlay);

            ImGui::EndPopup();
        }

        ImGui::PopStyleColor(6);
        ImGui::PopStyleVar(6);
        m_changed = changed;
        return true;
    }

    std::optional<std::string> DropdownWidget::content() const {
        return m_value == nullptr ? std::nullopt : std::optional<std::string>{*m_value};
    }

    bool DropdownWidget::try_set_content(std::string content) {
        if (m_value == nullptr || *m_value == content ||
            std::none_of(m_options.begin(), m_options.end(), [&content](const DropdownOption& option) {
                return option.value == content;
            })) {
            return false;
        }

        *m_value = std::move(content);
        return true;
    }
} // namespace ui
