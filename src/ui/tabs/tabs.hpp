#pragma once

#include <imgui-ui/layout/container.hpp>

#include <string>
#include <utility>

class UITab : public ui::Container {
public:
    explicit UITab(std::string id) : ui::Container(std::move(id), "Tab") {
        set_size({ui::grow(), ui::grow()});
    }

protected:
    [[nodiscard]] ui::Surface& ui() {
        return surface();
    }

private:
    void initialize();
    void on_update(float dt) override;
    virtual void setup() = 0;

    bool m_initialized = false;
};
