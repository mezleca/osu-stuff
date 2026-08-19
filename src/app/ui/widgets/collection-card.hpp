#pragma once

#include "../../../ui/layout/child-container.hpp"
#include "../../../ui/widgets/text.hpp"
#include "../../../ui/widgets/image.hpp"

#include <optional>

class IconTexture;
class UI;

class CollectionCardWidget : public ui::ChildContainer {
public:
    CollectionCardWidget(UI& ui, std::string name);

    [[nodiscard]] std::optional<std::string> get_content() const override;
    bool set_content(std::string content) override;
    void set_count(std::string count);
    void set_selected(bool value);
    void toggle_selected();
    [[nodiscard]] bool is_selected() const;

private:
    UI& m_ui;
    void on_layout() override;
    ui::ImageWidget* m_icon = nullptr;
    ui::TextWidget* m_title = nullptr;
    ui::TextWidget* m_count_label = nullptr;
    ImVec2 m_size = {150.0f, 50.0f};
    bool m_selected = false;

    void on_draw_end() override;
};
