#pragma once

#include <string>

class UI;

class UIWidget {
public:
    explicit UIWidget(UI* ui, std::string id) : m_id(std::move(id)), m_ui(ui) {
    }

protected:
    std::string m_id;
    UI* m_ui;
};
