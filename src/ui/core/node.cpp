#include "node.hpp"

#include <algorithm>
#include <atomic>
#include <utility>

static std::atomic<uint64_t> NEXT_NODE_ID = 1;

namespace ui {
    Node::DrawScope::DrawScope(Node& node) : m_node(node), m_start(std::chrono::steady_clock::now()) {}

    Node::DrawScope::~DrawScope() {
        m_node.m_draw_time_ms =
            std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - m_start).count();
    }

    Node::DrawScope Node::measure_draw() {
        return DrawScope(*this);
    }

    void Node::position_in_parent() {
        if (m_layout.anchor() == Anchor::TopLeft && m_layout.origin() == Origin::TopLeft &&
            m_layout.offset().x == 0.0F && m_layout.offset().y == 0.0F) {
            return;
        }

        const ImVec2 parent_min = ImGui::GetWindowContentRegionMin();
        const ImVec2 parent_max = ImGui::GetWindowContentRegionMax();
        const ImVec2 parent_size = {parent_max.x - parent_min.x, parent_max.y - parent_min.y};
        const ImVec2 local_position = resolve_layout_position(
            parent_size, m_layout.size(), m_layout.anchor_factor(), m_layout.origin_factor(), m_layout.offset()
        );
        const ImVec2 position = {parent_min.x + local_position.x, parent_min.y + local_position.y};

        ImGui::SetCursorPos(position);
    }

    void Node::skip_draw() {
        m_skip_draw = true;
    }

    Node::Node(std::string id) : m_id(std::move(id)), m_identity(NEXT_NODE_ID.fetch_add(1)) {}

    bool Node::add(std::unique_ptr<Node> child) {
        if (child == nullptr || child.get() == this) {
            return false;
        }

        // a node has only one owner
        // parent only links back for event bubbling.
        child->m_parent = this;
        if (m_input_layer != InputLayer::Count) {
            child->assign_input_layer(m_input_layer);
        }
        m_children.emplace_back(std::move(child));
        return true;
    }

    void Node::assign_input_layer(InputLayer layer) {
        m_input_layer = layer;
        for (const auto& child : m_children) {
            child->assign_input_layer(layer);
        }
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

        [[maybe_unused]] const auto& mesasure_time = measure_draw();
        m_skip_draw = false;

        // layout runs before drawing so widgets can update dynamic sizes while
        // the parent imgui window is active, then the node is positioned once.
        on_layout();

        if (m_skip_draw) {
            return;
        }

        position_in_parent();
        on_draw();

        // a node may decide that it has nothing to draw without opening an imgui scope.
        // in that case, its children must not run.
        if (m_skip_draw) {
            return;
        }

        // containers open their imgui scope in on_draw() and close it in
        // on_draw_end(), with children rendered between those two funcs.
        draw_children();
        on_draw_end();
    }

    void Node::draw_children() {
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

    void Node::on_update(float) {}
    void Node::on_layout() {}
    void Node::on_draw() {}
    void Node::on_draw_end() {}

} // namespace ui
