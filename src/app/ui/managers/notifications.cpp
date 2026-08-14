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

bool UINotificationManager::add(std::unique_ptr<UINotification> notification) {
    if (notification == nullptr) {
        return false;
    }

    auto& owned = add_child(std::move(notification));
    owned.set_offset(m_offset, true);
    return true;
}

bool UINotificationManager::remove(size_t index) {
    UINotification* notification = get(index);
    return notification != nullptr && remove(notification);
}

bool UINotificationManager::remove(UINotification* to_remove) {
    if (to_remove == nullptr || to_remove->parent() != this) {
        return false;
    }

    if (m_rendering) {
        if (std::find(m_pending_removals.begin(), m_pending_removals.end(), to_remove) == m_pending_removals.end()) {
            m_pending_removals.push_back(to_remove);
        }
        return true;
    }

    return ui::Node::remove(*to_remove) != nullptr;
}

UINotification* UINotificationManager::get(size_t index) {
    if (index >= children().size()) {
        return nullptr;
    }

    return static_cast<UINotification*>(children()[index].get());
}

size_t UINotificationManager::count() const {
    return children().size();
}

void UINotificationManager::clear() {
    if (m_rendering) {
        for (const auto& child : children()) {
            static_cast<void>(remove(static_cast<UINotification*>(child.get())));
        }
        return;
    }

    while (!children().empty()) {
        ui::Node::remove(*children().back());
    }
}

void UINotificationManager::draw() {
    const auto draw_measurement = measure_draw();
    if (!visible()) {
        return;
    }

    const ImGuiViewport* viewport = ImGui::GetMainViewport();
    ImGui::SetNextWindowPos(viewport->WorkPos);
    ImGui::SetNextWindowSize(viewport->WorkSize);
    ImGui::SetNextWindowBgAlpha(0.0F);
    ImGui::Begin("##notifications-overlay", nullptr, ui_constants::NOTIFICATION_OVERLAY_FLAGS);

    const ImVec2 available = ImGui::GetContentRegionAvail();
    m_offset = {-5.0F, m_header_height + 10.0F};
    const float more_height = std::max(MORE_NOTIFICATIONS_MIN_HEIGHT, m_more_notifications->state().get_size().y);
    const float max_height = available.y - BOTTOM_MARGIN - more_height - SPACING;

    ImVec2 offset = m_offset;

    size_t index = 0;

    // defer removals until child traversal is complete.
    m_rendering = true;

    const size_t notification_count = children().size();
    for (auto it = children().rbegin(); it != children().rend(); ++it) {
        if (offset.y >= max_height) {
            m_more_notifications->set_text(std::format("{} more...", notification_count - index));
            m_more_notifications->set_offset({-5.0F, offset.y});
            m_more_notifications->draw();
            break;
        }

        UINotification* notification = static_cast<UINotification*>(it->get());
        const ImVec2& size = notification->state().get_size();

        notification->set_offset({-5.0F, offset.y});
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
