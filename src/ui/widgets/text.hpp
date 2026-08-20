#pragma once

#include "text-value.hpp"
#include "widget.hpp"

#include <memory>
#include <optional>
#include <string>
#include <tuple>
#include <utility>

namespace ui {
    /// intrinsic size uses the font inherited through the node tree.
    class TextWidget : public StyledNode {
    public:
        explicit TextWidget(std::string text)
            : StyledNode({}, WidgetType::Text), m_text(std::make_unique<TextValue>(std::move(text))) {}

        template <typename... Args>
        TextWidget(std::string format, std::tuple<Args...> values)
            : StyledNode({}, WidgetType::Text), m_text(std::make_unique<TextFormatted<Args...>>(std::move(format))) {
            static_cast<TextFormatted<Args...>*>(m_text.get())->set(std::move(values));
        }

        /// a negative wrap value disables wrapping.
        void set_wrap(float wrap);
        /// normal tree drawing refreshes intrinsic size during measure.
        void update_layout_size();
        [[nodiscard]] bool on_draw() override;
        bool try_set_content(std::string content) override;

        [[nodiscard]] std::optional<std::string> content() const override;

    private:
        void on_measure() override;

        std::unique_ptr<TextValue> m_text;
        float m_wrap = -1.0F;
    };

} // namespace ui
