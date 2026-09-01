#pragma once

#include <ui/layout/layer-container.hpp>
#include <ui/layout/stack-container.hpp>

#include <string>

namespace ui {
    class InputRouter;
    class UI;
} // namespace ui

class UIModalManager final : public ui::LayerContainer {
public:
    explicit UIModalManager(ui::UI& ui);

    ui::StackContainer& open(std::string id);
    void close();

    [[nodiscard]] bool is_open() const;

private:
    void on_event(ui::UiEvent& event) override;

    ui::InputRouter& m_input_router;
    ui::StackContainer& m_panel;
};
