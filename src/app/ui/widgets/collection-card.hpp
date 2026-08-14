#pragma once

#include "../../../ui/widgets/base/widget.hpp"
#include "../../../ui/widgets/base/text.hpp"
#include "../../../ui/widgets/cached-text.hpp"
#include "../../../ui/widgets/image.hpp"

#include <functional>
#include <optional>

class IconTexture;

class CollectionCardWidget : public ui::Widget {
public:
    explicit CollectionCardWidget(std::string name);

    void on_draw() override;
    [[nodiscard]] std::optional<std::string> get_content() const override;
    bool set_content(std::string content) override;
    void set_selected(bool value);
    void toggle_selected();
    [[nodiscard]] bool is_selected() const;

    ui::TextValue<std::string> m_name;
    ui::TextValue<std::string> m_count;

private:
    void on_layout() override;
    ui::ImageWidget* m_icon = nullptr;
    ui::CachedTextNode* m_title = nullptr;
    ui::CachedTextNode* m_count_label = nullptr;
    ImVec2 m_size = {150.0f, 50.0f};
    ImFont* m_font_small = nullptr;
    bool m_selected = false;

    void on_draw_end() override;
};
