#pragma once

#include "../widgets/notification.hpp"
#include <ui/layout/layer-container.hpp>

#include <vector>
#include <memory>

namespace ui {
    class UI;
}

class UINotificationManager : public ui::LayerContainer {
public:
    explicit UINotificationManager(ui::UI& ui);

    bool add(std::unique_ptr<UINotification> notification);
    bool remove(size_t index);
    bool remove(UINotification* to_remove);
    [[nodiscard]] UINotification* get(size_t index);
    [[nodiscard]] size_t count() const;

    void set_position(NotificationPosition position);

    [[nodiscard]] bool accepts_input() const override {
        return false;
    }

    void set_header_height(float height) {
        m_header_height = height;
    }

    void clear_notifications();

private:
    void on_update(float dt) override;
    void draw_children() override;

    LogNotificationWidget m_more_notifications;
    std::vector<UINotification*> m_pending_removals;
    float m_header_height = 0.0f;
    NotificationPosition m_position = NotificationPosition::Right;
};
