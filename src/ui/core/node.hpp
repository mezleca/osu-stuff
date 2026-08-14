#pragma once

#include "event.hpp"
#include "geometry.hpp"

#include <memory>
#include <functional>
#include <chrono>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace ui {
    class Node {
    public:
        explicit Node(std::string id = {});
        virtual ~Node() = default;

        Node(const Node&) = delete;
        Node& operator=(const Node&) = delete;
        Node(Node&& other) noexcept;
        Node& operator=(Node&& other) noexcept;

        void add(std::unique_ptr<Node> child);

        template <typename T>
        T& add_child(std::unique_ptr<T> child) {
            T* result = child.get();
            add(std::move(child));
            return *result;
        }

        template <typename T, typename... Args>
        T& emplace_child(Args&&... args) {
            return add_child(std::make_unique<T>(std::forward<Args>(args)...));
        }

        void update(float dt);
        virtual void draw();
        std::unique_ptr<Node> remove(Node& child);
        [[nodiscard]] Node* find(std::string_view id);
        [[nodiscard]] const Node* find(std::string_view id) const;
        [[nodiscard]] bool contains(const Node* node) const;

        [[nodiscard]] const std::string& id() const {
            return m_id;
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

        [[nodiscard]] bool visible() const {
            return m_visible;
        }
        void set_visible(bool visible) {
            m_visible = visible;
        }

        [[nodiscard]] bool cancelable() const {
            return m_cancelable;
        }

        void set_cancelable(bool cancelable) {
            m_cancelable = cancelable;
        }

        [[nodiscard]] LayoutState& layout() {
            return m_layout;
        }

        [[nodiscard]] const LayoutState& layout() const {
            return m_layout;
        }

        [[nodiscard]] double draw_time_ms() const {
            return m_draw_time_ms;
        }

        virtual std::optional<std::string> get_content() const;
        virtual bool set_content(std::string content);

        // assign one handler and filter event.type inside it when needed
        std::function<void(UiEvent&)> on_event;

    protected:
        class DrawScope {
        public:
            explicit DrawScope(Node& node);
            ~DrawScope();

            DrawScope(const DrawScope&) = delete;
            DrawScope& operator=(const DrawScope&) = delete;

        private:
            Node& m_node;
            std::chrono::steady_clock::time_point m_start;
        };

        [[nodiscard]] DrawScope measure_draw();
        virtual void on_update(float dt);
        virtual void on_draw();

    private:
        std::string m_id;
        Node* m_parent = nullptr;
        std::vector<std::unique_ptr<Node>> m_children;
        bool m_visible = true;
        bool m_cancelable = false;
        LayoutState m_layout;
        double m_draw_time_ms = 0.0;
    };

} // namespace ui
