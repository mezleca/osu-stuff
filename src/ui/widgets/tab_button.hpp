#include "base/widget.hpp"
#include "base/text.hpp"

#include <functional>

class IconTexture;

class TabButtonWidget : public UIWidget {
public:
    explicit TabButtonWidget(std::string name, bool is_title = false, IconTexture* texture = nullptr);

    void show() override {
        show(false);
    }

    void show(bool selected);

    UIText<std::string> m_name;
    std::function<void()> m_onclick;
    IconTexture* m_icon = nullptr;

private:
    bool m_draw_line = true;
    bool m_is_title = false;
};
