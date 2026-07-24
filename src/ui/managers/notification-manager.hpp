#pragma once

#include "../widgets/notification.hpp"

#include <memory>
#include <vector>

class UINotificationManager {
public:
    UINotificationManager();
    ~UINotificationManager();

    [[nodiscard]] bool add(std::unique_ptr<UINotification> notification) {
        if (notification == nullptr) {
            return false;
        }

        notification->set_offset(m_offset, true);
        m_notifications.push_back(std::move(notification));
        return true;
    }

    [[nodiscard]] bool remove(size_t index) {
        if (index >= m_notifications.size()) {
            return false;
        }

        m_notifications.erase(m_notifications.begin() + index);
        return true;
    }

    [[nodiscard]] UINotification* get(size_t index) {
        if (index >= m_notifications.size()) {
            return nullptr;
        }

        return m_notifications[index].get();
    }

    [[nodiscard]] size_t count() const {
        return m_notifications.size();
    }

    void render();

    void set_offset(ImVec2 offset) {
        m_offset = offset;
    }

    void clear() {
        m_notifications.clear();
    }

private:
    std::vector<std::unique_ptr<UINotification>> m_notifications;
    LogNotificationWidget* m_more_notifications;
    ImVec2 m_offset = {0.0f, 0.0f};
};
