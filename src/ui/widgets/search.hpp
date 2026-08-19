#pragma once

#include "../layout/child-container.hpp"
#include "text-value.hpp"
#include "image.hpp"
#include "text-input.hpp"

#include <optional>

class IconTexture;
class UI;

namespace ui {
    class SearchInputWidget : public ChildContainer {
    public:
        SearchInputWidget(UI& ui, std::string& value);

        void set_fit_width(bool value);
        bool set_content(std::string content) override;

        [[nodiscard]] std::optional<std::string> get_content() const override;

        std::string* m_value;

    private:
        void on_layout() override;
        void on_draw_end() override;

        UI& m_ui;
        ImageWidget* m_icon = nullptr;
        TextInputWidget* m_input = nullptr;
        bool m_fit_width = false;
    };

} // namespace ui
