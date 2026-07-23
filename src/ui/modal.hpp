#pragma once

#include <string>
#include <string_view>

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
