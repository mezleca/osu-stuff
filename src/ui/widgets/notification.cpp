#include "notification.hpp"
#include "../ui.hpp"

DefaultNotification::DefaultNotification(std::string text) : UINotification(), m_text(text) {
}

void DefaultNotification::render() {
}
