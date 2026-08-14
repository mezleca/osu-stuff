#pragma once

#include "base/text.hpp"
#include "../core/node.hpp"

namespace ui {
    class CachedTextNode final : public Node {
    public:
        CachedTextNode(std::string id, CachedText& text, ImFont* font);

        void set_wrap(float wrap);
        void update_layout_size();

    private:
        void on_layout() override;
        void on_draw() override;

        CachedText& m_text;
        ImFont* m_font = nullptr;
        float m_wrap = -1.0F;
    };
} // namespace ui
