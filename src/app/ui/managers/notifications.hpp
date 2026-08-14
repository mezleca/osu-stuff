#pragma once

#include "../widgets/notification.hpp"
#include "../../../ui/core/node.hpp"

#include <vector>
#include <memory>

class UINotificationManager : public ui::Node {
public:
    UINotificationManager();
    ~UINotificationManager() override;

    [[nodiscard]] bool add(std::unique_ptr<UINotification> notification);
    [[nodiscard]] bool remove(size_t index);
    [[nodiscard]] bool remove(UINotification* to_remove);
    [[nodiscard]] UINotification* get(size_t index);
    [[nodiscard]] size_t count() const;

    void draw() override;

    void set_header_height(float height) {
        m_header_height = height;
    }

    void clear();

private:
    std::unique_ptr<LogNotificationWidget> m_more_notifications;
    std::vector<UINotification*> m_pending_removals;
    bool m_rendering = false;
    ImVec2 m_offset = {0.0f, 0.0f};
    float m_header_height = 0.0f;
};
