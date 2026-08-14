#include "node.hpp"

#include <algorithm>
#include <utility>

namespace ui {
    Node::DrawScope::DrawScope(Node& node) : m_node(node), m_start(std::chrono::steady_clock::now()) {
    }

    Node::DrawScope::~DrawScope() {
        m_node.m_draw_time_ms =
            std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - m_start).count();
    }

    Node::DrawScope Node::measure_draw() {
        return DrawScope(*this);
    }

    Node::Node(std::string id) : m_id(std::move(id)) {
    }

    Node::Node(Node&& other) noexcept
        : on_event(std::move(other.on_event)), m_id(std::move(other.m_id)), m_children(std::move(other.m_children)),
          m_visible(other.m_visible), m_cancelable(other.m_cancelable), m_layout(std::move(other.m_layout)) {
        m_draw_time_ms = other.m_draw_time_ms;
        for (const auto& child : m_children) {
            child->m_parent = this;
        }
        other.m_parent = nullptr;
    }

    Node& Node::operator=(Node&& other) noexcept {
        if (this == &other) {
            return *this;
        }

        Node* existing_parent = m_parent;

        m_id = std::move(other.m_id);
        m_children = std::move(other.m_children);
        m_visible = other.m_visible;
        m_cancelable = other.m_cancelable;
        m_layout = std::move(other.m_layout);
        m_draw_time_ms = other.m_draw_time_ms;
        on_event = std::move(other.on_event);
        m_parent = existing_parent;

        for (const auto& child : m_children) {
            child->m_parent = this;
        }

        other.m_parent = nullptr;
        return *this;
    }

    void Node::add(std::unique_ptr<Node> child) {
        if (child == nullptr || child.get() == this) {
            return;
        }

        // a node has only one owner
        // parent only links back for event bubbling.
        child->m_parent = this;
        m_children.emplace_back(std::move(child));
    }

    std::unique_ptr<Node> Node::remove(Node& child) {
        const auto it =
            std::find_if(m_children.begin(), m_children.end(), [&child](const std::unique_ptr<Node>& candidate) {
                return candidate.get() == &child;
            });

        if (it == m_children.end()) {
            return nullptr;
        }

        std::unique_ptr<Node> result = std::move(*it);
        m_children.erase(it);
        result->m_parent = nullptr;
        return result;
    }

    Node* Node::find(std::string_view searched_id) {
        if (m_id == searched_id) {
            return this;
        }

        for (const auto& child : m_children) {
            if (Node* result = child->find(searched_id); result != nullptr) {
                return result;
            }
        }

        return nullptr;
    }

    const Node* Node::find(std::string_view searched_id) const {
        if (m_id == searched_id) {
            return this;
        }

        for (const auto& child : m_children) {
            if (const Node* result = child->find(searched_id); result != nullptr) {
                return result;
            }
        }

        return nullptr;
    }

    bool Node::contains(const Node* node) const {
        if (node == this) {
            return true;
        }

        for (const auto& child : m_children) {
            if (child->contains(node)) {
                return true;
            }
        }

        return false;
    }

    void Node::update(float dt) {
        if (!m_visible) {
            return;
        }

        on_update(dt);
        for (const auto& child : m_children) {
            child->update(dt);
        }
    }

    void Node::draw() {
        if (!m_visible) {
            m_draw_time_ms = 0.0;
            return;
        }

        [[maybe_unused]] const auto draw_scope = measure_draw();
        on_draw();

        for (const auto& child : m_children) {
            child->draw();
        }
    }

    std::optional<std::string> Node::get_content() const {
        return std::nullopt;
    }

    bool Node::set_content(std::string) {
        return false;
    }

    void Node::on_update(float) {
    }
    void Node::on_draw() {
    }

} // namespace ui
