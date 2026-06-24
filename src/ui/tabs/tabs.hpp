#pragma once

#include <memory>
#include <string>
#include <vector>

struct UITab {
    explicit UITab() = default;

    std::string m_id;

    virtual ~UITab();
    virtual void render() = 0;
};

[[nodiscard]] std::vector<std::unique_ptr<UITab>> create_default_tabs();
