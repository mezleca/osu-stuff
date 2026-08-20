#pragma once

#include "widget.hpp"

#include <optional>
#include <string>
#include <variant>

class UI;

namespace ui {
    class NumberInputWidget final : public Widget {
    public:
        NumberInputWidget(UI& ui, float& value, std::string id = {});
        NumberInputWidget(UI& ui, int& value, std::string id = {});

        NumberInputWidget& set_label(std::string label);
        NumberInputWidget& set_minimum(double minimum);
        NumberInputWidget& set_maximum(double maximum);
        NumberInputWidget& set_range(double minimum, double maximum);
        /// removes both bounds and restores unbounded drag behavior.
        NumberInputWidget& clear_range();
        NumberInputWidget& set_speed(float speed);
        NumberInputWidget& set_format(std::string format);
        NumberInputWidget& set_size(ImVec2 size);
        NumberInputWidget& set_thumb_visible(bool visible);
        NumberInputWidget& set_thumb_size(float size);
        NumberInputWidget& set_thumb_color(ImColor color);

        [[nodiscard]] bool changed() const;
        [[nodiscard]] bool on_draw() override;
        [[nodiscard]] std::optional<std::string> content() const override;
        bool try_set_content(std::string content) override;

    private:
        template <typename T>
        bool draw_value(T& value);

        void configure_style();

        UI& m_ui;
        std::variant<float*, int*> m_value;
        std::string m_label;
        std::string m_format;
        std::optional<double> m_minimum;
        std::optional<double> m_maximum;
        ImColor m_thumb_color;
        float m_speed;
        float m_thumb_size = 10.0F;
        bool m_thumb_visible = true;
        bool m_changed = false;
    };
} // namespace ui
