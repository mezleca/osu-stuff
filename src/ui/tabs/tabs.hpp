#pragma once

#include <string>

struct UITab {
    explicit UITab() = default;

    std::string m_id;

    virtual ~UITab();
    virtual void render() = 0;
};
