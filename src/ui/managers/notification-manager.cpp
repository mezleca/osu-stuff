#include "./notification-manager.hpp"
#include "../ui.hpp"
#include "../widgets/notification.hpp"

#include <format>

UINotificationManager::UINotificationManager() {
    m_more_notifications = new LogNotificationWidget(LogNotificationLevel::PLACEHOLDER, "");
}

UINotificationManager::~UINotificationManager() {
    m_notifications.clear();
}

void UINotificationManager::render() {
    const ImVec2 available = ImGui::GetContentRegionAvail();
    const float max_height = available.y - 100.0f;

    float x_offset = m_offset.x;
    float y_offset = m_offset.y;

    size_t index = 0;

    for (auto it = m_notifications.rbegin(); it != m_notifications.rend(); ++it) {
        if (y_offset >= max_height) {
            const ImVec2& size = m_more_notifications->state().get_size();
            m_more_notifications->set_text(std::format("{} more...", m_notifications.size() - index));
            m_more_notifications->set_offset({x_offset - size.x, y_offset});
            m_more_notifications->show();
            break;
        }

        UINotification* notification = it->get();
        const ImVec2& size = notification->state().get_size();

        notification->set_offset({x_offset - size.x, y_offset});
        notification->show();

        y_offset += size.y + 10.0f;
        index++;
    }
}
