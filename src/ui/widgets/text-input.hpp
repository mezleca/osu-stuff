#pragma once

#include "../layout/child-container.hpp"

#include <optional>
#include <string>

class IconTexture;
class UI;

namespace ui {
    class ImageWidget;

    /// the editable field and optional icon are child nodes named `text` and `icon`.
    class TextInputWidget final : public ChildContainer {
    public:
        TextInputWidget(UI& ui, std::string& value);
        TextInputWidget(UI& ui, std::string& value, std::string label);

        TextInputWidget& set_icon(IconTexture* icon);
        /// a non-positive width follows the current available content width when enabled.
        TextInputWidget& set_fit_width(bool fit_width);

        [[nodiscard]] const ItemInputState& input_state() const;
        [[nodiscard]] std::optional<std::string> content() const override;
        bool try_set_content(std::string content) override;

    private:
        class FieldNode;

        [[nodiscard]] bool draw_field();
        void on_layout() override;
        void draw_children() override;
        void on_draw_end() override;

        UI& m_ui;
        std::string* m_value;
        std::string m_label;
        ImageWidget* m_icon_node = nullptr;
        FieldNode* m_field_node = nullptr;
        ItemInputState m_input_state;
        bool m_fit_width = false;
        bool m_focus_requested = false;
    };
} // namespace ui
