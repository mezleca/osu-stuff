#include "detail.hpp"
#include "../../../ui/widgets/text.hpp"

ConfigTab::ConfigTab(UI& ui) : UITab(ui, "config") {}

void ConfigTab::setup() {
    m_content_layout = &add_child<ui::StackContainer>("##config-content");
    m_content_layout->add_child<ui::TextWidget>("config");
    mark_initialized();
}

void ConfigTab::render() {
    if (!is_initialized()) {
        return;
    }

    m_content_layout->draw();
}
