#pragma once

#include "widget.hpp"

#include <imgui.h>

class IconTexture;

namespace ui {
    /// style padding insets the image while screen bounds retain the outer size.
    class ImageWidget : public Widget {
    public:
        explicit ImageWidget(IconTexture* texture = nullptr);

        ImageWidget& set_texture(IconTexture* texture) {
            m_texture = texture;
            return *this;
        }

        ImageWidget& set_size(ImVec2 size) {
            layout().set_size(size);
            return *this;
        }

        [[nodiscard]] const ImVec2& size() const {
            return layout().size();
        }

        [[nodiscard]] bool on_draw() override;

    private:
        IconTexture* m_texture = nullptr;
    };

} // namespace ui
