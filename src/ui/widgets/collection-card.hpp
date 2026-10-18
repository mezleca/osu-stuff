#pragma once

#include <imgui-ui/widgets/widget.hpp>
#include <imgui-ui/widgets/text.hpp>
#include <imgui-ui/widgets/image.hpp>

class CollectionCardWidget : public ui::Widget {
public:
    explicit CollectionCardWidget(std::string name);

    void set_text(std::string text);
    void set_count(std::string count);
    void set_selected(bool value);
    void toggle_selected();
    [[nodiscard]] bool is_selected() const;

protected:
    void apply_theme_defaults(const ui::Theme& theme) override;
    void input_state_changed() override;

private:
    ui::ImageWidget* m_icon = nullptr;
    ui::TextWidget* m_title = nullptr;
    ui::TextWidget* m_count_label = nullptr;
    bool m_selected = false;
};
