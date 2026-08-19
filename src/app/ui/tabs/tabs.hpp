#pragma once

#include "../../../ui/tree/node.hpp"

#include <string>
#include <utility>

class UI;

class UITab : public ui::Node {
public:
    UITab(UI& ui, std::string id) : ui::Node(std::move(id)), m_ui(ui) {}

    void draw() override;
    [[nodiscard]] bool is_initialized() const {
        return m_initialized;
    }

    virtual void setup() = 0;
    virtual void render() = 0;

protected:
    [[nodiscard]] UI& ui() {
        return m_ui;
    }

    void mark_initialized() {
        m_initialized = true;
    }

private:
    UI& m_ui;
    bool m_initialized = false;
};
