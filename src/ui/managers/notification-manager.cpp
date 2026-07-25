#include "./notification-manager.hpp"
#include "../ui.hpp"
#include "../widgets/notification.hpp"

#include <algorithm>
#include <format>

static constexpr float NOTIFICATION_BOTTOM_MARGIN = 100.0f;
static constexpr float NOTIFICATION_SPACING = 10.0f;
static constexpr float MORE_NOTIFICATIONS_MIN_HEIGHT = 48.0f;

UINotificationManager::UINotificationManager() {
    m_more_notifications = std::make_unique<LogNotificationWidget>(LogNotificationLevel::PLACEHOLDER, "");
}

UINotificationManager::~UINotificationManager() = default;

bool UINotificationManager::remove(UINotification* to_remove) {
    if (m_rendering) {
        m_pending_removals.push_back(to_remove);
        return true;
    }

    auto removed_count = std::erase_if(m_notifications, [to_remove](const std::unique_ptr<UINotification>& ptr) {
        return ptr.get() == to_remove;
    });

    return removed_count > 0;
}

void UINotificationManager::render() {
    const ImVec2 available = ImGui::GetContentRegionAvail();
    const float more_height = std::max(MORE_NOTIFICATIONS_MIN_HEIGHT, m_more_notifications->state().get_size().y);
    const float max_height = available.y - NOTIFICATION_BOTTOM_MARGIN - more_height - NOTIFICATION_SPACING;

    float x_offset = m_offset.x;
    float y_offset = m_offset.y;

    size_t index = 0;

    m_rendering = true;

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

        y_offset += size.y + NOTIFICATION_SPACING;
        index++;
    }

    m_rendering = false;

    for (UINotification* notification : m_pending_removals) {
        (void)remove(notification);
    }

    m_pending_removals.clear();
}
