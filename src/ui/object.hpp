#pragma once

#include "style/style.hpp"

#include <string>
#include <utility>

class UIObject {
public:
    explicit UIObject(std::string id = {}) : m_id(std::move(id)) {
    }

    virtual ~UIObject() = default;
    virtual void show() = 0;

    [[nodiscard]] const std::string& id() const {
        return m_id;
    }

    [[nodiscard]] UIStyle& style() {
        return m_style;
    }

    [[nodiscard]] const UIStyle& style() const {
        return m_style;
    }

private:
    std::string m_id;
    UIStyle m_style;
};
