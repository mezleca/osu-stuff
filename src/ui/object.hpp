#pragma once

#include "core/node.hpp"
#include "style/style.hpp"

#include <string>
#include <utility>

namespace ui {
    class StyledNode : public Node {
    public:
        explicit StyledNode(std::string id = {}) : Node(std::move(id)) {
        }

        virtual ~StyledNode() = default;
        StyledNode(const StyledNode&) = delete;
        StyledNode& operator=(const StyledNode&) = delete;
        [[nodiscard]] Style& style() {
            return m_style;
        }

        [[nodiscard]] const Style& style() const {
            return m_style;
        }

    private:
        ui::Style m_style;
    };

} // namespace ui
