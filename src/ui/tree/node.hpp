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
    class Profiler;

    /// a node exclusively owns its children. the normal lifecycle performs
    /// update, measure, placement, drawing, profiling and input registration.
    /// override lifecycle callbacks instead of draw() unless a type deliberately
    /// lives outside that lifecycle.
    class Node {
    public:
        explicit Node(std::string id = {});
        Node(const Node&) = delete;
        virtual ~Node() = default;
        Node& operator=(const Node&) = delete;

        /// transfers ownership; rejects null nodes, cycles and children that already have a parent.
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

        /// hidden nodes skip update and their entire subtree.
        void update(float dt);

        /// runs measure, placement and draw lifecycle, then registers the input region.
        virtual void draw();

        /// detaches a direct child; input targets into its subtree are cleared.
        std::unique_ptr<Node> remove(Node& child);

        void set_input_router(InputRouter* router);
        void set_profiler(Profiler* profiler);
        [[nodiscard]] Node* find(std::string_view id);
        [[nodiscard]] const Node* find(std::string_view id) const;
        [[nodiscard]] bool contains(const Node* node) const;

        [[nodiscard]] const std::string& id() const {
            return m_id;
        }

        /// stable process-local identity used by diagnostics, independent from id().
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

        /// input layer assignment propagates to descendants.
        Node& set_input_layer(InputLayer layer) {
            assign_input_layer(layer);
            return *this;
        }

        [[nodiscard]] bool visible() const {
            return m_visible;
        }

        /// controls update and drawing independently from enabled input state.
        void set_visible(bool visible) {
            if (m_visible == visible) {
                return;
            }

            m_visible = visible;
            if (visible) {
                invalidate_measure();
            }
        }

        [[nodiscard]] bool enabled() const {
            return m_enabled;
        }

        /// controls input acceptance without hiding the node or stopping updates.
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
            invalidate_measure();
            return *this;
        }

        /// propagates intrinsic measurement invalidation to ancestors.
        void invalidate_measure();

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

        Node& set_placement(Anchor anchor, Origin origin, ImVec2 offset = {}) {
            m_layout.set_placement(anchor, origin, offset);
            return *this;
        }

        /// optional text-like representation used by the debugger and generic tooling.
        [[nodiscard]] virtual std::optional<std::string> content() const;

        virtual bool try_set_content(std::string content);

    protected:
        /// internal event behavior implemented by the node itself.
        std::function<void(UiEvent&)> _on_event;

        /// dispatches the node's internal event behavior. widgets extend this with their public callback.
        virtual void dispatch_event(UiEvent& event);

        /// resolves cursor placement and the latest layout rectangles.
        void position_in_parent();
        void assign_input_layer(InputLayer layer);
        /// marks this node and every descendant for remeasurement.
        void invalidate_measure_subtree();

        /// updates node state before children are updated.
        virtual void on_update(float dt);

        /// resolves intrinsic size after children are measured and before arrangement.
        /// this callback must not depend on the current imgui window or cursor.
        virtual void on_measure();

        /// resolves dynamic size and placement immediately before drawing.
        /// override this for imgui-dependent layout values, not rendering.
        virtual void on_layout();

        /// opens the draw scope. returning false skips children and on_draw_end().
        [[nodiscard]] virtual bool on_draw();

        /// draws children while the scope opened by on_draw() remains active.
        virtual void draw_children();

        /// finalizes drawing and closes any scope opened by on_draw().
        virtual void on_draw_end();

    private:
        friend class InputRouter;

        void measure_tree();
        void capture_leaf_rect(ImGuiID previous_item_id, Rect previous_item_rect);

        std::string m_id;
        // immutable runtime key; unlike id(), this does not need to be unique or user supplied.
        uint64_t m_identity = 0;
        // non-owning; ownership always lives in the parent's child vector.
        Node* m_parent = nullptr;
        std::vector<std::unique_ptr<Node>> m_children;
        bool m_visible = true;
        bool m_enabled = true;
        bool m_accepts_focus = false;
        // dirty state propagates upward so a root draw can measure affected subtrees once.
        bool m_measure_dirty = true;
        InputLayer m_input_layer = InputLayer::Count;
        NodeLayout m_layout;
        // surface services are inherited when a node is attached and cleared on removal.
        InputRouter* m_input_router = nullptr;
        Profiler* m_profiler = nullptr;
    };

} // namespace ui
