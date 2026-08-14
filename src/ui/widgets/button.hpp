#pragma once

#include "base/widget.hpp"
#include "base/text.hpp"

#include <imgui.h>
#include <optional>

namespace ui {
    class ButtonWidget : public Widget {
    public:
        ButtonWidget(std::string text, ImVec2 size = {100.0f, 60.0f});

        void on_draw() override;
        [[nodiscard]] std::optional<std::string> get_content() const override;
        bool set_content(std::string content) override;

    private:
        TextValue<std::string> m_text;
        ImVec2 m_size;
    };

} // namespace ui
