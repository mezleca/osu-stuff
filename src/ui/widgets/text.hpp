#pragma once

#include "../object.hpp"

#include <optional>
#include <string>
#include <utility>

namespace ui {
    class TextWidget : public StyledNode {
    public:
        explicit TextWidget(std::string text) : m_text(std::move(text)) {}

        void on_draw() override;
        [[nodiscard]] std::optional<std::string> get_content() const override;
        bool set_content(std::string content) override;

    private:
        std::string m_text;
    };

} // namespace ui
