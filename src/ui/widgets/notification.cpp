#include "notification.hpp"
#include "../ui.hpp"

NotificationState::NotificationState() : WidgetState() {
}

DefaultNotification::DefaultNotification(UI* ui, std::string text) : UIWidget(ui, "notification"), m_text(text) {
}

void DefaultNotification::render() {
}
