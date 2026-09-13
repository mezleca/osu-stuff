#include "./notifications.hpp"
#include <ui/ui.hpp>
#include <ui/tree/node.hpp>

#include <algorithm>
#include <format>

using namespace ui;

static constexpr float SPACING = 10.0f;
static constexpr float STACK_HEIGHT_RATIO = 0.8F;
static constexpr float EDGE_INSET = 10.0F;

UINotificationManager::UINotificationManager() : LayerContainer("notifications") {
    set_visible(true);
    set_input_mode(InputMode::None);
    m_more_notifications = &Node::add<LogNotificationWidget>(LogNotificationLevel::PLACEHOLDER, "");
    m_more_notifications->set_id("notifications-more");
    m_more_notifications->set_enabled(false);
    m_more_notifications->set_visible(false);
}

LogNotificationWidget& UINotificationManager::add(LogNotificationLevel level, std::string text) {
    auto& notification = Node::add<LogNotificationWidget>(level, std::move(text));
    notification.set_id(std::format("notification-{}", notification.identity()));
    notification.set_overlay_position(m_position);
    return notification;
}

bool UINotificationManager::remove(size_t index) {
    UINotification* notification = get(index);
    return notification != nullptr && remove(notification);
}

bool UINotificationManager::remove(UINotification* to_remove) {
    if (to_remove == nullptr || to_remove->parent() != this) {
        return false;
    }

    return Node::remove(*to_remove) != nullptr;
}

UINotification* UINotificationManager::get(size_t index) {
    for (const auto& child : children()) {
        auto* notification = dynamic_cast<UINotification*>(child.get());
        if (notification == nullptr || notification == m_more_notifications) {
            continue;
        }

        if (index-- == 0) {
            return notification;
        }
    }

    return nullptr;
}

size_t UINotificationManager::count() const {
    return std::count_if(children().begin(), children().end(), [this](const auto& child) {
        const auto* notification = dynamic_cast<const UINotification*>(child.get());
        return notification != nullptr && notification != m_more_notifications;
    });
}

void UINotificationManager::set_position(NotificationPosition position) {
    if (m_position == position) {
        return;
    }

    m_position = position;
    m_more_notifications->set_overlay_position(position);
    for (const auto& child : children()) {
        auto* notification = dynamic_cast<UINotification*>(child.get());
        if (notification == nullptr || notification == m_more_notifications) {
            continue;
        }

        notification->set_overlay_position(position);
    }
}

void UINotificationManager::clear_notifications() {
    while (UINotification* notification = get(0)) {
        Node::remove(*notification);
    }
}

void UINotificationManager::draw_children() {
    const ImVec2 available = layout().size();
    const float top = m_header_height + SPACING;
    const float more_height = std::max(48.0F, m_more_notifications->layout().preferred_size().y);
    const float height = std::max(0.0F, std::min(available.y * STACK_HEIGHT_RATIO, available.y - top - more_height - SPACING));
    const bool left = m_position == NotificationPosition::Left;

    std::vector<UINotification*> notifications;
    for (auto it = children().rbegin(); it != children().rend(); ++it) {
        auto* notification = dynamic_cast<UINotification*>(it->get());
        if (notification == nullptr || notification == m_more_notifications) {
            continue;
        }

        notification->set_visible(true);
        if (notification->visually_visible()) {
            notifications.push_back(notification);
        } else {
            m_pending_removals.push_back(notification);
        }
    }

    float offset = 0.0F;
    size_t overflow_index = notifications.size();
    m_more_notifications->set_visible(false);

    for (size_t index = 0; index < notifications.size(); ++index) {
        UINotification& notification = *notifications[index];
        const float notification_height = std::max(48.0F, notification.layout().preferred_size().y);
        notification.set_overlay_position(m_position);
        notification.set_target_offset({left ? EDGE_INSET : -EDGE_INSET, top + offset});
        if (offset + notification_height > height) {
            overflow_index = index;
            offset += notification_height + SPACING;
            break;
        }

        offset += notification_height + SPACING;
    }

    if (overflow_index + 1 < notifications.size()) {
        m_more_notifications->set_text(std::format("{} more...", notifications.size() - overflow_index - 1));
        m_more_notifications->set_overlay_position(m_position);
        m_more_notifications->set_target_offset({left ? EDGE_INSET : -EDGE_INSET, top + offset});
        m_more_notifications->set_visible(true);
    }

    const size_t drawn_count = overflow_index == notifications.size() ? notifications.size() : overflow_index + 1;
    for (size_t index = 0; index < drawn_count; ++index) {
        notifications[index]->draw();
    }
    m_more_notifications->draw();

    for (UINotification* notification : m_pending_removals) {
        Node::remove(*notification);
    }

    m_pending_removals.clear();
}
