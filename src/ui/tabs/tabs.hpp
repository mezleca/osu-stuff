#pragma once

#include <string>

class UITab {
public:
    explicit UITab() = default;

    virtual ~UITab();

    [[nodiscard]] bool is_initialized() const {
        return m_initialized;
    }

    virtual void setup() = 0;
    virtual void render() = 0;

protected:
    void mark_initialized() {
        m_initialized = true;
    }

    std::string m_id;

private:
    bool m_initialized = false;
};
