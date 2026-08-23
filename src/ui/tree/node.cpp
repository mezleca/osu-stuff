#include "node.hpp"

#include "../diagnostics/profiler.hpp"
#include "../input/router.hpp"

#include <algorithm>
#include <atomic>
#include <utility>

namespace ui {
    static std::atomic<uint64_t> next_node_id = 1;

    Node::Node(std::string id) : m_id(std::move(id)), m_identity(next_node_id.fetch_add(1)) {}

    void Node::dispatch_event(UiEvent& event) {
        if (_on_event) {
            _on_event(event);
        }
    }

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

        // flow uses imgui's current cursor; explicit placement resolves against
        // the window content rectangle before converting the result to screen space.
        ImVec2 window_position = ImGui::GetCursorPos();
        if (m_layout.has_explicit_position()) {
            const Rect arranged_rect = resolve_layout_rect(
                {content_min, content_max}, m_layout.size(), m_layout.anchor_factor(), m_layout.origin_factor(),
                m_layout.offset()
            );
            window_position = arranged_rect.min;
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

    void Node::set_profiler(Profiler* profiler) {
        m_profiler = profiler;
        for (const auto& child : m_children) {
            child->set_profiler(profiler);
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
        child->set_profiler(m_profiler);
        m_children.emplace_back(std::move(child));
        invalidate_measure();
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
            // the router stores raw targets across frames, so detach must clear
            // every state that could outlive ownership in this tree.
            m_input_router->clear_focus(child);
            m_input_router->release_pointer(child);
            m_input_router->clear_keyboard_target(child);
        }

        std::unique_ptr<Node> result = std::move(*it);
        m_children.erase(it);
        result->m_parent = nullptr;
        result->assign_input_layer(InputLayer::Count);
        result->set_input_router(nullptr);
        result->set_profiler(nullptr);
        invalidate_measure();
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

    void Node::invalidate_measure() {
        m_measure_dirty = true;
        if (m_parent != nullptr && !m_parent->m_measure_dirty) {
            m_parent->invalidate_measure();
        }
    }

    void Node::invalidate_measure_subtree() {
        m_measure_dirty = true;
        for (const auto& child : m_children) {
            child->invalidate_measure_subtree();
        }

        if (m_parent != nullptr && !m_parent->m_measure_dirty) {
            m_parent->invalidate_measure();
        }
    }

    void Node::capture_leaf_rect(ImGuiID previous_item_id, Rect previous_item_rect) {
        if (!m_children.empty() || ImGui::GetCurrentContext() == nullptr) {
            return;
        }

        const Rect item_rect{ImGui::GetItemRectMin(), ImGui::GetItemRectMax()};
        // many imgui items use id zero. compare both id and bounds so a node that
        // emitted nothing cannot inherit the item left by the previous node.
        const bool same_item = ImGui::GetItemID() == previous_item_id && item_rect.min.x == previous_item_rect.min.x &&
                               item_rect.min.y == previous_item_rect.min.y &&
                               item_rect.max.x == previous_item_rect.max.x &&
                               item_rect.max.y == previous_item_rect.max.y;
        if (same_item) {
            return;
        }

        if (item_rect.valid()) {
            m_layout.set_screen_rect(item_rect);
        }
    }

    void Node::measure_tree() {
        if (!m_visible || !m_measure_dirty) {
            return;
        }

        // measurement is bottom-up because container intrinsic size may depend
        // on sizes resolved by its children in the same frame.
        for (const auto& child : m_children) {
            child->measure_tree();
        }
        on_measure();
        m_measure_dirty = false;
    }

    void Node::draw() {
        UI_PROFILE_NODE(m_profiler, "Node::draw", m_identity);

        if (!m_visible) {
            return;
        }

        if (m_parent == nullptr && m_measure_dirty) {
            measure_tree();
        }

        // layout runs before drawing so widgets can use the active parent window;
        // placement then establishes both local and screen coordinate rectangles.
        on_layout();
        position_in_parent();

        const ImGuiID previous_item_id = ImGui::GetCurrentContext() == nullptr ? 0 : ImGui::GetItemID();
        const Rect previous_item_rect =
            ImGui::GetCurrentContext() == nullptr ? Rect{} : Rect{ImGui::GetItemRectMin(), ImGui::GetItemRectMax()};

        // early return when node did not open a draw scope.
        if (!on_draw()) {
            return;
        }

        capture_leaf_rect(previous_item_id, previous_item_rect);

        // containers keep their imgui scope open between on_draw() and on_draw_end().
        draw_children();
        on_draw_end();

        const Rect screen_rect = m_layout.screen_rect();
        if (m_input_router != nullptr && m_parent != nullptr && screen_rect.valid()) {
            m_input_router->register_region(*this, screen_rect);
        }
    }

    void Node::draw_children() {
        for (const auto& child : m_children) {
            child->draw();
        }
    }

    std::optional<std::string> Node::content() const {
        return std::nullopt;
    }

    bool Node::try_set_content(std::string) {
        return false;
    }

    bool Node::on_draw() {
        return true;
    }

    void Node::on_update(float) {}
    void Node::on_measure() {}
    void Node::on_layout() {}
    void Node::on_draw_end() {}

} // namespace ui
