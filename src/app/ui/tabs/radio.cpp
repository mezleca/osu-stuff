#include "detail.hpp"
#include "../../../ui/widgets/text.hpp"

RadioTab::RadioTab() : UITab("radio") {}

void RadioTab::setup() {
    auto content_layout = std::make_unique<ui::ChildLayout>("##radio-content");
    m_content_layout = content_layout.get();
    m_content_layout->add(std::make_unique<ui::TextWidget>("radio"));
    add(std::move(content_layout));
    mark_initialized();
}

void RadioTab::render() {
    if (!is_initialized()) {
        return;
    }

    m_content_layout->set_size({0.0F, 0.0F});
    m_content_layout->draw();
}
