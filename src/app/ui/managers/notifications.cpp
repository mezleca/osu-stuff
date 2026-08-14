#include "./notifications.hpp"
#include "../constants.hpp"
#include "../widgets/notification.hpp"

#include <algorithm>
#include <format>

static constexpr float BOTTOM_MARGIN = 100.0f;
static constexpr float SPACING = 10.0f;
static constexpr float MORE_NOTIFICATIONS_MIN_HEIGHT = 48.0f;

UINotificationManager::UINotificationManager() : ui::Node("notifications") {
    m_more_notifications = std::make_unique<LogNotificationWidget>(LogNotificationLevel::PLACEHOLDER, "");
}

UINotificationManager::~UINotificationManager() = default;

bool UINotificationManager::remove(UINotification* to_remove) {
    if (m_rendering) {
        m_pending_removals.push_back(to_remove);
        return true;
    }

    const auto it = std::find(m_notifications.begin(), m_notifications.end(), to_remove);
    if (it == m_notifications.end()) {
        return false;
    }

    static_cast<void>(ui::Node::remove(*to_remove));
    m_notifications.erase(it);
    return true;
}

void UINotificationManager::draw() {
    [[maybe_unused]] const auto draw_scope = measure_draw();
    if (!visible()) {
        return;
    }

    const ImGuiViewport* viewport = ImGui::GetMainViewport();
    ImGui::SetNextWindowPos(viewport->WorkPos);
    ImGui::SetNextWindowSize(viewport->WorkSize);
    ImGui::SetNextWindowBgAlpha(0.0F);
    ImGui::Begin("##notifications-overlay", nullptr, ui_constants::NOTIFICATION_OVERLAY_FLAGS);

    const ImVec2 available = ImGui::GetContentRegionAvail();
    const ImVec2 window_pos = ImGui::GetWindowPos();
    m_offset = {window_pos.x + available.x - 5.0F, m_header_height + 10.0F};
    const float more_height = std::max(MORE_NOTIFICATIONS_MIN_HEIGHT, m_more_notifications->state().get_size().y);
    const float max_height = available.y - BOTTOM_MARGIN - more_height - SPACING;

    ImVec2 offset = m_offset;

    size_t index = 0;

    // defer removals until child traversal is complete.
    m_rendering = true;

    for (auto it = m_notifications.rbegin(); it != m_notifications.rend(); ++it) {
        if (offset.y >= max_height) {
            const ImVec2& size = m_more_notifications->state().get_size();
            m_more_notifications->set_text(std::format("{} more...", m_notifications.size() - index));
            m_more_notifications->set_offset({offset.x - size.x, offset.y});
            m_more_notifications->draw();
            break;
        }

        UINotification* notification = *it;
        const ImVec2& size = notification->state().get_size();

        notification->set_offset({offset.x - size.x, offset.y});
        notification->draw();

        offset.y += size.y + SPACING;
        index++;
    }

    m_rendering = false;

    for (UINotification* notification : m_pending_removals) {
        static_cast<void>(remove(notification));
    }

    m_pending_removals.clear();
    ImGui::End();
}
