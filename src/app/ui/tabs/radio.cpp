#include "detail.hpp"
#include "../../../ui/widgets/text.hpp"

RadioTab::RadioTab(UI& ui) : UITab(ui, "radio") {}

void RadioTab::setup() {
    m_content_layout = &add_child<ui::StackContainer>("##radio-content");
    m_content_layout->add_child<ui::TextWidget>("radio");
    mark_initialized();
}

void RadioTab::render() {
    if (!is_initialized()) {
        return;
    }

    m_content_layout->draw();
}
