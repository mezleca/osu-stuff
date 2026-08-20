#include "number-input.hpp"

#include "../style/theme.hpp"
#include "../ui.hpp"

#include <imgui.h>

#include <algorithm>
#include <charconv>
#include <type_traits>

namespace ui {
    NumberInputWidget::NumberInputWidget(UI& ui, float& value, std::string id)
        : Widget(std::move(id), WidgetType::NumberInput), m_ui(ui), m_value(&value), m_format("%.3f"), m_speed(0.1F) {
        configure_style();
    }

    NumberInputWidget::NumberInputWidget(UI& ui, int& value, std::string id)
        : Widget(std::move(id), WidgetType::NumberInput), m_ui(ui), m_value(&value), m_format("%d"), m_speed(1.0F) {
        configure_style();
    }

    void NumberInputWidget::configure_style() {
        const Theme& theme = m_ui.theme();
        m_thumb_color = theme.control_mark_color;
        m_thumb_size = theme.control_thumb_size;

        state().configure_all_styles([&theme](Style& style) {
            style.color(theme.text_color)
                .background_color(theme.control_background_color)
                .border_color(theme.control_border_color, 18.0F)
                .padding({10.0F, 6.0F})
                .border(BORDER_ALL)
                .border_radius(theme.control_rounding)
                .border_thickness(theme.control_border_thickness);
        });
        state().configure_style(StyleType::HOVER, [&theme](Style& style) {
            style.background_color(theme.control_hover_color).border_color(theme.accent_hover_color);
        });
        state().configure_style(StyleType::ACTIVE, [&theme](Style& style) {
            style.background_color(theme.control_active_color).border_color(theme.accent_color);
        });
    }

    NumberInputWidget& NumberInputWidget::set_label(std::string label) {
        m_label = std::move(label);
        return *this;
    }

    NumberInputWidget& NumberInputWidget::set_minimum(double minimum) {
        m_minimum = minimum;
        return *this;
    }

    NumberInputWidget& NumberInputWidget::set_maximum(double maximum) {
        m_maximum = maximum;
        return *this;
    }

    NumberInputWidget& NumberInputWidget::set_range(double minimum, double maximum) {
        m_minimum = std::min(minimum, maximum);
        m_maximum = std::max(minimum, maximum);
        return *this;
    }

    NumberInputWidget& NumberInputWidget::clear_range() {
        m_minimum.reset();
        m_maximum.reset();
        return *this;
    }

    NumberInputWidget& NumberInputWidget::set_speed(float speed) {
        m_speed = std::max(0.0F, speed);
        return *this;
    }

    NumberInputWidget& NumberInputWidget::set_format(std::string format) {
        m_format = std::move(format);
        return *this;
    }

    NumberInputWidget& NumberInputWidget::set_size(ImVec2 size) {
        layout().set_size(size);
        return *this;
    }

    NumberInputWidget& NumberInputWidget::set_thumb_visible(bool visible) {
        m_thumb_visible = visible;
        return *this;
    }

    NumberInputWidget& NumberInputWidget::set_thumb_size(float size) {
        m_thumb_size = std::max(1.0F, size);
        return *this;
    }

    NumberInputWidget& NumberInputWidget::set_thumb_color(ImColor color) {
        m_thumb_color = color;
        return *this;
    }

    bool NumberInputWidget::changed() const {
        return m_changed;
    }

    template <typename T>
    bool NumberInputWidget::draw_value(T& value) {
        constexpr ImGuiDataType data_type = std::is_same_v<T, float> ? ImGuiDataType_Float : ImGuiDataType_S32;
        const T minimum = static_cast<T>(m_minimum.value_or(0.0));
        const T maximum = static_cast<T>(m_maximum.value_or(0.0));
        const void* minimum_ptr = m_minimum.has_value() ? &minimum : nullptr;
        const void* maximum_ptr = m_maximum.has_value() ? &maximum : nullptr;
        const char* format = m_format.empty() ? nullptr : m_format.c_str();

        if (m_thumb_visible && m_minimum.has_value() && m_maximum.has_value() && maximum > minimum) {
            return ImGui::SliderScalar("##value", data_type, &value, &minimum, &maximum, format);
        }

        return ImGui::DragScalar("##value", data_type, &value, m_speed, minimum_ptr, maximum_ptr, format);
    }

    bool NumberInputWidget::on_draw() {
        if (!state().is_visible()) {
            return false;
        }

        const Style& current_style = style();
        ImVec2 frame_padding = current_style.padding();
        if (layout().size().y > 0.0F) {
            frame_padding.y = std::max(0.0F, (layout().size().y - ImGui::GetTextLineHeight()) * 0.5F);
        }

        ImGui::PushID(this);
        ImGui::BeginGroup();

        float input_width = layout().size().x;
        if (!m_label.empty()) {
            const float label_width = ImGui::CalcTextSize(m_label.c_str()).x + ImGui::GetStyle().ItemInnerSpacing.x;
            ImGui::AlignTextToFramePadding();
            ImGui::TextUnformatted(m_label.c_str());
            ImGui::SameLine();
            if (input_width > 0.0F) {
                input_width = std::max(1.0F, input_width - label_width);
            }
        }

        ImGui::SetNextItemWidth(input_width > 0.0F ? input_width : -1.0F);
        ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, frame_padding);
        ImGui::PushStyleVar(ImGuiStyleVar_FrameRounding, current_style.border_radius());
        ImGui::PushStyleVar(ImGuiStyleVar_FrameBorderSize, current_style.border_thickness());
        ImGui::PushStyleVar(ImGuiStyleVar_GrabMinSize, m_thumb_size);
        ImGui::PushStyleVar(ImGuiStyleVar_GrabRounding, current_style.border_radius());
        ImGui::PushStyleColor(ImGuiCol_Text, current_style.color().get());
        ImGui::PushStyleColor(ImGuiCol_FrameBg, current_style.background_color().get());
        ImGui::PushStyleColor(ImGuiCol_FrameBgHovered, current_style.background_color().get());
        ImGui::PushStyleColor(ImGuiCol_FrameBgActive, current_style.background_color().get());
        ImGui::PushStyleColor(ImGuiCol_Border, current_style.border_color().get());
        ImGui::PushStyleColor(ImGuiCol_SliderGrab, m_thumb_color.Value);
        ImGui::PushStyleColor(ImGuiCol_SliderGrabActive, m_thumb_color.Value);

        m_changed = std::visit([this](auto* value) { return draw_value(*value); }, m_value);

        ImGui::PopStyleColor(7);
        ImGui::PopStyleVar(5);
        const ItemInputState input = m_ui.input().handle(*this);
        ImGui::EndGroup();
        ImGui::PopID();

        apply_input_state(input);
        state().update(ImGui::GetIO().DeltaTime);
        return true;
    }

    std::optional<std::string> NumberInputWidget::get_content() const {
        return std::visit([](const auto* value) { return std::to_string(*value); }, m_value);
    }

    bool NumberInputWidget::set_content(std::string content) {
        return std::visit(
            [&content](auto* value) {
                using ValueType = std::remove_pointer_t<decltype(value)>;
                ValueType parsed{};
                const auto result = std::from_chars(content.data(), content.data() + content.size(), parsed);
                if (result.ec != std::errc{} || result.ptr != content.data() + content.size() || parsed == *value) {
                    return false;
                }

                *value = parsed;
                return true;
            },
            m_value
        );
    }
} // namespace ui
