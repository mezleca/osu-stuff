#pragma once

#include "../widgets/notification.hpp"
#include "../../../ui/core/node.hpp"

#include <memory>
#include <vector>

class UINotificationManager : public ui::Node {
public:
    UINotificationManager();
    ~UINotificationManager() override;

    [[nodiscard]] bool add(std::unique_ptr<UINotification> notification) {
        if (notification == nullptr) {
            return false;
        }

        auto& owned = add_child(std::move(notification));
        owned.set_offset(m_offset, true);
        m_notifications.push_back(&owned);
        return true;
    }

    [[nodiscard]] bool remove(size_t index) {
        if (index >= m_notifications.size()) {
            return false;
        }

        static_cast<void>(remove(m_notifications[index]));
        return true;
    }

    [[nodiscard]] bool remove(UINotification* to_remove);

    [[nodiscard]] UINotification* get(size_t index) {
        if (index >= m_notifications.size()) {
            return nullptr;
        }

        return m_notifications[index];
    }

    [[nodiscard]] size_t count() const {
        return m_notifications.size();
    }

    void draw() override;

    void set_header_height(float height) {
        m_header_height = height;
    }

    void clear() {
        if (m_rendering) {
            m_pending_removals.insert(m_pending_removals.end(), m_notifications.begin(), m_notifications.end());
            return;
        }

        while (!m_notifications.empty()) {
            static_cast<void>(remove(m_notifications.back()));
        }
    }

private:
    std::vector<UINotification*> m_notifications;
    std::unique_ptr<LogNotificationWidget> m_more_notifications;
    std::vector<UINotification*> m_pending_removals;
    bool m_rendering = false;
    ImVec2 m_offset = {0.0f, 0.0f};
    float m_header_height = 0.0f;
};
