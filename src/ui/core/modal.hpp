#pragma once

#include "node.hpp"

#include <string>
#include <string_view>

namespace ui {
    class Modal : public Node {
    public:
        explicit Modal(std::string_view id) : Node(std::string{id}) {
            set_cancelable(true);
        }
    };
} // namespace ui
