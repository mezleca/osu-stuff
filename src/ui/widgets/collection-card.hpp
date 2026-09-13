#pragma once

#include <ui/layout/container.hpp>
#include <ui/widgets/text.hpp>
#include <ui/widgets/image.hpp>

class CollectionCardWidget : public ui::Container {
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
