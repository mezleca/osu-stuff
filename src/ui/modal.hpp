#pragma once

#include <string>
#include <string_view>

namespace ui_modal_id {
    static constexpr std::string_view TEST = "test";
} // namespace ui_modal_id

class UIModal {
public:
    explicit UIModal(std::string_view id) : m_id(id) {
    }
    virtual ~UIModal() = default;

    [[nodiscard]] std::string_view id() const {
        return m_id;
    }

    virtual void on_remove() = 0;
    virtual void on_escape() = 0;
    virtual void render() = 0;

private:
    std::string m_id;
};
