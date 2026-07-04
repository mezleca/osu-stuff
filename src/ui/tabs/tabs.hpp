#pragma once

#include <string>

struct UI;

struct UITab {
    explicit UITab(UI* ui) : m_ui(ui) {
    }

    virtual ~UITab();

    std::string m_id;
    UI* m_ui;
    bool m_initialized = false;

    virtual void setup() = 0;
    virtual void render() = 0;
};
