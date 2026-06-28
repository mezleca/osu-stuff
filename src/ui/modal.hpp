#pragma once

#include <string>
#include <string_view>

namespace ui_modal_id {
    static constexpr std::string_view TEST = "test";
} // namespace ui_modal_id

struct UIModal {
    explicit UIModal(std::string_view id) : m_id(id) {
    }
    virtual ~UIModal() = default;

    std::string m_id;

    virtual void on_remove() = 0;
    virtual void on_escape() = 0;
    virtual void render() = 0;
};
