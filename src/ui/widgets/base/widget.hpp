#pragma once

#include "../../object.hpp"
#include "../../style/state.hpp"

#include <string>
#include <memory>

class UIWidget : public UIObject {
public:
    explicit UIWidget(std::string id) : UIObject(std::move(id)) {
    }

protected:
    [[nodiscard]] WidgetState& state() {
        if (m_state == nullptr) {
            m_state = std::make_unique<WidgetState>();
        }

        return *m_state;
    }

private:
    std::unique_ptr<WidgetState> m_state;
};
