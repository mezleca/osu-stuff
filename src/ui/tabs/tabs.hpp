#pragma once

#include <string>

class UI;

class UITab {
public:
    explicit UITab(UI* ui) : m_ui(ui) {
    }

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
    UI* m_ui;

private:
    bool m_initialized = false;
};
