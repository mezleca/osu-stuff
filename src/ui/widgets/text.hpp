#pragma once

#include "../object.hpp"

#include <string>
#include <utility>

class UITextWidget : public UIObject {
public:
    explicit UITextWidget(std::string text) : m_text(std::move(text)) {
    }

    void show() override;

private:
    std::string m_text;
};
