#pragma once

#include "../../../ui/core/node.hpp"

#include <string>
#include <utility>

class UITab : public ui::Node {
public:
    explicit UITab(std::string id) : ui::Node(std::move(id)) {
    }

    virtual ~UITab();

    void draw() override;
    [[nodiscard]] bool is_initialized() const {
        return m_initialized;
    }

    virtual void setup() = 0;
    virtual void render() = 0;

protected:
    void mark_initialized() {
        m_initialized = true;
    }

private:
    bool m_initialized = false;
};
