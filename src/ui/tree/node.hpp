#pragma once

#include "../input/event.hpp"
#include "../input/layer.hpp"
#include "../layout/geometry.hpp"

#include <memory>
#include <functional>
#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <stdexcept>
#include <utility>
#include <vector>

namespace ui {
    class InputRouter;
    class Node {
    public:
        explicit Node(std::string id = {});
        Node(const Node&) = delete;
        virtual ~Node() = default;
        Node& operator=(const Node&) = delete;

        bool add(std::unique_ptr<Node> child);

        template <typename T>
        T& add_child(std::unique_ptr<T> child) {
            if (child == nullptr || child.get() == this) {
                throw std::invalid_argument("a node cannot be added as its own child");
            }

            T* result = child.get();
            if (!add(std::move(child))) {
                throw std::logic_error("failed to add node child");
            }

            return *result;
        }

        template <typename T, typename... Args>
        T& add_child(Args&&... args) {
            return add_child(std::make_unique<T>(std::forward<Args>(args)...));
        }

        // updates this node and its descendants for one simulation frame.
        // hidden nodes skip this callback and do not update their descendants.
        void update(float dt);

        // runs this node's layout and draw lifecycle, then registers its input region.
        virtual void draw();
        std::unique_ptr<Node> remove(Node& child);

        void set_draw_profiling_enabled(bool enabled);
        void set_input_router(InputRouter* router);
        [[nodiscard]] Node* find(std::string_view id);
        [[nodiscard]] const Node* find(std::string_view id) const;
        [[nodiscard]] bool contains(const Node* node) const;

        [[nodiscard]] float draw_time_ms() const {
            return m_draw_time_ms;
        }

        [[nodiscard]] const std::string& id() const {
            return m_id;
        }

        [[nodiscard]] uint64_t identity() const {
            return m_identity;
        }

        void set_id(std::string id) {
            m_id = std::move(id);
        }

        [[nodiscard]] Node* parent() {
            return m_parent;
        }

        [[nodiscard]] const Node* parent() const {
            return m_parent;
        }

        [[nodiscard]] const std::vector<std::unique_ptr<Node>>& children() const {
            return m_children;
        }

        [[nodiscard]] InputLayer input_layer() const {
            return m_input_layer;
        }

        Node& set_input_layer(InputLayer layer) {
            assign_input_layer(layer);
            return *this;
        }

        [[nodiscard]] bool visible() const {
            return m_visible;
        }

        void set_visible(bool visible) {
            m_visible = visible;
        }

        [[nodiscard]] bool enabled() const {
            return m_enabled;
        }

        void set_enabled(bool enabled) {
            m_enabled = enabled;
        }

        [[nodiscard]] virtual bool accepts_input() const {
            return m_visible && m_enabled;
        }

        [[nodiscard]] bool accepts_focus() const {
            return m_accepts_focus;
        }

        Node& set_accepts_focus(bool accepts_focus) {
            m_accepts_focus = accepts_focus;
            return *this;
        }

        [[nodiscard]] NodeLayout& layout() {
            return m_layout;
        }

        [[nodiscard]] const NodeLayout& layout() const {
            return m_layout;
        }

        Node& set_size(ImVec2 size) {
            m_layout.set_size(size);
            return *this;
        }

        Node& set_anchor(Anchor anchor) {
            m_layout.set_anchor(anchor);
            return *this;
        }

        Node& set_anchor_position(ImVec2 position) {
            m_layout.set_anchor_position(position);
            return *this;
        }

        Node& set_origin(Origin origin) {
            m_layout.set_origin(origin);
            return *this;
        }

        Node& set_origin_position(ImVec2 position) {
            m_layout.set_origin_position(position);
            return *this;
        }

        Node& set_offset(ImVec2 offset) {
            m_layout.set_offset(offset);
            return *this;
        }

        virtual std::optional<std::string> get_content() const;
        virtual bool set_content(std::string content);

        std::function<void(UiEvent&)> on_event;

    protected:
        void position_in_parent();
        void assign_input_layer(InputLayer layer);
        // updates node state before its children are updated.
        virtual void on_update(float dt);

        // resolves dynamic size and layout values before drawing begins.
        // override this to update layout-dependent values, not to draw imgui items.
        virtual void on_layout();

        // opens this node's draw scope and returns whether its children should be drawn.
        // returning false skips both child drawing and on_draw_end().
        [[nodiscard]] virtual bool on_draw();

        // draws children while the scope opened by on_draw() is active.
        virtual void draw_children();

        // finalizes drawing and closes any scope opened by on_draw().
        virtual void on_draw_end();

    private:
        std::string m_id;
        uint64_t m_identity = 0;
        Node* m_parent = nullptr;
        std::vector<std::unique_ptr<Node>> m_children;
        bool m_visible = true;
        bool m_enabled = true;
        bool m_accepts_focus = false;
        bool m_draw_profiling_enabled = false;
        float m_draw_time_ms = 0.0F;
        InputLayer m_input_layer = InputLayer::Count;
        NodeLayout m_layout;
        InputRouter* m_input_router = nullptr;
    };

} // namespace ui
