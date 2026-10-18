#pragma once

#include <imgui-ui/layout/layer-container.hpp>

#include <string>

class UIModalManager final : public ui::LayerContainer {
public:
    UIModalManager();

    ui::Container& open(std::string id);
    void close();

    [[nodiscard]] bool is_open() const;

private:
    void apply_theme_defaults(const ui::Theme& theme) override;
    void event(ui::UiEvent& event) override;

    ui::Container& m_panel;
};
