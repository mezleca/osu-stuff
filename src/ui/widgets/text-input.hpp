#pragma once

#include "widget.hpp"
#include "text-value.hpp"

#include <optional>
#include <string>

class UI;

namespace ui {
    class TextInputWidget final : public Widget {
    public:
        TextInputWidget(UI& ui, std::string& value, std::string label);

        [[nodiscard]] bool on_draw() override;
        [[nodiscard]] const ItemInputState& input_state() const;
        [[nodiscard]] std::optional<std::string> get_content() const override;
        bool set_content(std::string content) override;

    private:
        void on_layout() override;
        void on_draw_end() override;

        UI& m_ui;
        std::string* m_value;
        std::string m_label;
        ItemInputState m_input_state;
    };
} // namespace ui
