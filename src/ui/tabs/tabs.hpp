#pragma once

#include <ui/tree/node.hpp>

#include <string>
#include <utility>

namespace ui {
    class UI;
}

class UITab : public ui::Node {
public:
    UITab(ui::UI& ui, std::string id) : ui::Node(std::move(id)), m_ui(ui) {}

    void draw() override;

protected:
    [[nodiscard]] ui::UI& ui() {
        return m_ui;
    }

private:
    void initialize();
    void on_update(float dt) override;
    virtual void setup() = 0;
    virtual void render() = 0;

    ui::UI& m_ui;
    bool m_initialized = false;
};
