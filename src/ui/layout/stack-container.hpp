#pragma once

#include "child-container.hpp"

namespace ui {
    class StackContainer : public ChildContainer {
    public:
        explicit StackContainer(std::string id, StackDirection direction = StackDirection::Vertical);

        void set_direction(StackDirection direction);
        [[nodiscard]] StackDirection direction() const;
        void set_spacing(float spacing);
        [[nodiscard]] float spacing() const;

    protected:
        [[nodiscard]] bool on_draw() override;
        void on_layout() override;
        void arrange_children(ImVec2 container_size);

    private:
        StackDirection m_direction;
        float m_spacing = 0.0F;
        ImVec2 m_content_size{};
    };
} // namespace ui
