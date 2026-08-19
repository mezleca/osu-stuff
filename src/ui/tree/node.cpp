#include "node.hpp"

#include "../input/router.hpp"

#include <algorithm>
#include <atomic>
#include <chrono>
#include <utility>

namespace ui {
    static std::atomic<uint64_t> next_node_id = 1;

    Node::Node(std::string id) : m_id(std::move(id)), m_identity(next_node_id.fetch_add(1)) {}

    void Node::position_in_parent() {
        if (ImGui::GetCurrentContext() == nullptr) {
            m_layout.set_arranged_rect(Rect::from_position_size(m_layout.offset(), m_layout.size()));
            m_layout.set_screen_rect(m_layout.arranged_rect());
            return;
        }

        const ImVec2 content_min = ImGui::GetWindowContentRegionMin();
        const ImVec2 content_max = ImGui::GetWindowContentRegionMax();
        const ImVec2 content_size = {content_max.x - content_min.x, content_max.y - content_min.y};

        m_layout.set_parent_content_rect(Rect::from_position_size(content_min, content_size));

        ImVec2 window_position = ImGui::GetCursorPos();
        if (m_layout.has_explicit_position()) {
            const ImVec2 local_position = resolve_layout_position(
                content_size, m_layout.size(), m_layout.anchor_factor(), m_layout.origin_factor(), m_layout.offset()
            );
            window_position = {content_min.x + local_position.x, content_min.y + local_position.y};
            ImGui::SetCursorPos(window_position);
        }

        const ImVec2 screen_position = ImGui::GetCursorScreenPos();

        m_layout.set_arranged_rect(Rect::from_position_size(window_position, m_layout.size()));
        m_layout.set_screen_rect(Rect::from_position_size(screen_position, m_layout.size()));
    }

    void Node::set_input_router(InputRouter* router) {
        m_input_router = router;
        for (const auto& child : m_children) {
            child->set_input_router(router);
        }
    }

    bool Node::add(std::unique_ptr<Node> child) {
        if (child == nullptr || child.get() == this || child->m_parent != nullptr || child->contains(this)) {
            return false;
        }

        child->m_parent = this;

        if (m_input_layer != InputLayer::Count) {
            child->assign_input_layer(m_input_layer);
        }

        child->set_input_router(m_input_router);
        child->set_draw_profiling_enabled(m_draw_profiling_enabled);
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

        if (m_input_router != nullptr) {
            m_input_router->clear_focus(child);
            m_input_router->release_pointer(child);
            m_input_router->clear_keyboard_target(child);
        }

        std::unique_ptr<Node> result = std::move(*it);
        m_children.erase(it);
        result->m_parent = nullptr;
        result->assign_input_layer(InputLayer::Count);
        result->set_input_router(nullptr);
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

    void Node::set_draw_profiling_enabled(bool enabled) {
        m_draw_profiling_enabled = enabled;

        if (!enabled) {
            m_draw_time_ms = 0.0F;
        }

        for (const auto& child : m_children) {
            child->set_draw_profiling_enabled(enabled);
        }
    }

    void Node::draw() {
        const bool profile_draw = m_draw_profiling_enabled;
        const auto start_time =
            profile_draw ? std::chrono::steady_clock::now() : std::chrono::steady_clock::time_point{};
        const auto finish_draw = [this, profile_draw, start_time] {
            if (!profile_draw) {
                return;
            }

            m_draw_time_ms =
                std::chrono::duration<float, std::milli>(std::chrono::steady_clock::now() - start_time).count();
        };

        if (!m_visible) {
            finish_draw();
            return;
        }

        // layout runs before drawing so widgets can update dynamic sizes while the parent imgui window is active
        // then the node is positioned once.
        on_layout();
        position_in_parent();

        // early return when node did not open a draw scope.
        if (!on_draw()) {
            finish_draw();
            return;
        }

        // containers keep their imgui scope open between on_draw() and on_draw_end().
        draw_children();
        on_draw_end();

        if (m_input_router != nullptr && m_parent != nullptr) {
            Rect rect = m_layout.screen_rect();
            const ImVec2 item_min = ImGui::GetItemRectMin();
            const ImVec2 item_max = ImGui::GetItemRectMax();
            if (rect.max.x <= rect.min.x || rect.max.y <= rect.min.y) {
                rect = {item_min, item_max};
                m_layout.set_screen_rect(rect);
            }

            if (rect.max.x > rect.min.x && rect.max.y > rect.min.y) {
                m_input_router->register_region(*this, rect);
            }
        }

        finish_draw();
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

    bool Node::on_draw() {
        return true;
    }

    void Node::on_update(float) {}
    void Node::on_layout() {}
    void Node::on_draw_end() {}

} // namespace ui
