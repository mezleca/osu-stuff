#pragma once

#include "base/widget.hpp"
#include "base/text.hpp"
#include "../core/input.hpp"
#include "image.hpp"

#include <optional>

class IconTexture;

namespace ui {
    class SearchInputWidget : public Widget {
    public:
        explicit SearchInputWidget(std::string& value);

        void on_draw() override;
        void set_fit_width(bool value);
        [[nodiscard]] std::optional<std::string> get_content() const override;
        bool set_content(std::string content) override;

        FormattedText<void*> m_label;
        std::string* m_value;

    private:
        void on_layout() override;
        void draw_children() override;
        void on_draw_end() override;

        ImageWidget* m_icon = nullptr;
        LastItemState m_input_state;
        ImVec2 m_size = {120.0f, 30.0f};
        bool m_fit_width = false;
    };

} // namespace ui
