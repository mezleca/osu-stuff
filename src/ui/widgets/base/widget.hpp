#pragma once

#include "../../object.hpp"
#include "../../style/state.hpp"

#include <string>
#include <memory>

namespace ui {
    class Widget : public StyledNode {
    public:
        explicit Widget(std::string id) : StyledNode(std::move(id)) {}

        [[nodiscard]] VisualState& state() {
            if (m_state == nullptr) {
                m_state = std::make_unique<VisualState>();
            }

            return *m_state;
        }

    private:
        std::unique_ptr<VisualState> m_state;
    };

} // namespace ui
