#include "detail.hpp"
#include "../../../ui/widgets/text.hpp"

ConfigTab::ConfigTab(UI& ui) : UITab(ui, "config") {}

void ConfigTab::setup() {
    m_content_layout = &add_child<ui::StackContainer>("##config-content");
    m_content_layout->add_child<ui::TextWidget>("config");
}

void ConfigTab::render() {
    m_content_layout->draw();
}
