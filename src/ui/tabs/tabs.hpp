#pragma once

#include <string>

struct UI;

struct UITab {
    explicit UITab(UI* ui) : m_ui(ui) {
    }

    std::string m_id;
    UI* m_ui;

    virtual ~UITab();
    virtual void render() = 0;
};
