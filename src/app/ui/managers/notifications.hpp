#pragma once

#include "../widgets/notification.hpp"
#include <ui/layout/overlay-container.hpp>
#include <ui/tree/node.hpp>

#include <vector>
#include <memory>

class UI;

class UINotificationManager : public ui::Node {
public:
    explicit UINotificationManager(UI& ui);

    bool add(std::unique_ptr<UINotification> notification);
    bool remove(size_t index);
    bool remove(UINotification* to_remove);
    [[nodiscard]] UINotification* get(size_t index);
    [[nodiscard]] size_t count() const;

    void set_position(ui::OverlayPosition position);

    [[nodiscard]] bool accepts_input() const override {
        return false;
    }

    void draw() override;

    void set_header_height(float height) {
        m_header_height = height;
    }

    void clear();

private:
    void on_update(float dt) override;

    UI& m_ui;
    LogNotificationWidget m_more_notifications;
    std::vector<UINotification*> m_pending_removals;
    bool m_rendering = false;
    float m_header_height = 0.0f;
    ui::OverlayPosition m_position = ui::OverlayPosition::RIGHT;
};
