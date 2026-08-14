#include "detail.hpp"
#include "../../../ui/widgets/text.hpp"

ConfigTab::ConfigTab() : UITab("config") {}

void ConfigTab::setup() {
    auto content_layout = std::make_unique<ui::ChildLayout>("##config-content");
    m_content_layout = content_layout.get();
    m_content_layout->add(std::make_unique<ui::TextWidget>("config"));
    add(std::move(content_layout));
    mark_initialized();
}

void ConfigTab::render() {
    if (!is_initialized()) {
        return;
    }

    m_content_layout->set_size({0.0F, 0.0F});
    m_content_layout->draw();
}
