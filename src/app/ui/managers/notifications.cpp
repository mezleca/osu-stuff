#include "./notifications.hpp"
#include <ui/constants.hpp>
#include <ui/ui.hpp>
#include "../widgets/notification.hpp"

#include <algorithm>
#include <format>

static constexpr float SPACING = 10.0f;

UINotificationManager::UINotificationManager(UI& ui)
    : ui::Node("notifications"), m_ui(ui), m_more_notifications(m_ui, LogNotificationLevel::PLACEHOLDER, "") {
    m_more_notifications.set_id("notifications-more");
}

bool UINotificationManager::add(std::unique_ptr<UINotification> notification) {
    if (notification == nullptr) {
        return false;
    }

    UINotification& added = add_child(std::move(notification));
    added.set_id(std::format("notification-{}", added.identity()));
    added.set_overlay_position(m_position);
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

void UINotificationManager::set_position(ui::OverlayPosition position) {
    if (m_position == position) {
        return;
    }

    m_position = position;
    m_more_notifications.set_overlay_position(position);
    for (const auto& child : children()) {
        static_cast<UINotification*>(child.get())->set_overlay_position(position);
    }
}

void UINotificationManager::clear() {
    if (m_rendering) {
        for (const auto& child : children()) {
            remove(static_cast<UINotification*>(child.get()));
        }
        return;
    }

    while (!children().empty()) {
        ui::Node::remove(*children().back());
    }
}

void UINotificationManager::on_update(float dt) {
    // the overflow indicator stays outside children
    // so it is not counted as a notification.
    m_more_notifications.update(dt);
}

bool UINotificationManager::on_draw() {
    const ImGuiViewport* viewport = ImGui::GetMainViewport();
    ImGui::SetNextWindowPos(viewport->WorkPos);
    ImGui::SetNextWindowSize(viewport->WorkSize);
    ImGui::SetNextWindowBgAlpha(0.0F);
    ImGui::Begin("##notifications-overlay", nullptr, constants::NOTIFICATION_OVERLAY_FLAGS);

    const ImVec2 window_position = ImGui::GetWindowPos();
    const ImVec2 window_size = ImGui::GetWindowSize();
    resolve_size(window_size);
    set_screen_rect(ui::Rect::from_position_size(window_position, window_size));

    return true;
}

void UINotificationManager::draw_children() {
    const ImVec2 available = ImGui::GetContentRegionAvail();
    const ImVec2 initial_offset = {m_position == ui::OverlayPosition::LEFT ? 5.0F : -5.0F, m_header_height + 10.0F};
    const float more_height = std::max(48.0F, m_more_notifications.layout().screen_rect().size().y);
    const float max_height = available.y - 100.0F - more_height - SPACING;

    ImVec2 offset = initial_offset;

    size_t index = 0;

    // defer removals until child traversal is complete.
    m_rendering = true;

    const size_t notification_count = children().size();
    for (auto it = children().rbegin(); it != children().rend(); ++it) {
        if (offset.y >= max_height) {
            m_more_notifications.set_text(std::format("{} more...", notification_count - index));
            m_more_notifications.set_target_offset({initial_offset.x, offset.y});
            m_more_notifications.draw();
            break;
        }

        UINotification* notification = static_cast<UINotification*>(it->get());
        if (!notification->visually_visible()) {
            remove(notification);
            continue;
        }

        notification->set_overlay_position(m_position);
        notification->set_target_offset({initial_offset.x, offset.y});
        notification->draw();

        const ImVec2 size = notification->layout().screen_rect().size();
        offset.y += size.y + SPACING;
        ++index;
    }

    m_rendering = false;
}

void UINotificationManager::on_draw_end() {
    for (UINotification* notification : m_pending_removals) {
        remove(notification);
    }

    m_pending_removals.clear();
    ImGui::End();
}
