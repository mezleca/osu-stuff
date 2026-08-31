#pragma once

#include <ui/layout/child-container.hpp>
#include <ui/widgets/text.hpp>
#include <ui/widgets/image.hpp>

class IconTexture;
class UI;

namespace app {

    class CollectionCardWidget : public ui::ChildContainer {
    public:
        CollectionCardWidget(UI& ui, std::string name);

        void set_text(std::string text);
        void set_count(std::string count);
        void set_selected(bool value);
        void toggle_selected();
        [[nodiscard]] bool is_selected() const;

    protected:
        void input_state_changed() override;

    private:
        UI& m_ui;
        ui::ImageWidget* m_icon = nullptr;
        ui::TextWidget* m_title = nullptr;
        ui::TextWidget* m_count_label = nullptr;
        bool m_selected = false;
    };

} // namespace app
