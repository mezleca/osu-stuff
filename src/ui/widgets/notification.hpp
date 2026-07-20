#pragma once

#include "base/widget.hpp"
#include "base/text.hpp"

#include <functional>
#include <cstdint>

enum class NotificationType : int32_t {
    DEFAULT,
    ALERT,
    ERROR,
    ACTION
};

class UINotification : public UIWidget {
public:
    UINotification() : UIWidget("notification") {
    }

    virtual ~UINotification() = default;

    virtual void render() = 0;
    [[nodiscard]] virtual NotificationType get_type() const = 0;
};

class DefaultNotification : public UINotification {
public:
    explicit DefaultNotification(std::string text);

    void render() override;
    [[nodiscard]] NotificationType get_type() const override {
        return m_type;
    }

    std::function<void(UINotification*)> m_onconfirm = nullptr;
    std::function<void(UINotification*)> m_oncancel = nullptr;

private:
    UIText<std::string> m_text;
    NotificationType m_type = NotificationType::DEFAULT;
};
