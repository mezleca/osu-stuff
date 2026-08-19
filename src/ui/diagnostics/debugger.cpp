#include "debugger.hpp"
#include "../ui.hpp"
#include "../platform/window.hpp"
#include "../constants.hpp"
#include "../style/styled-node.hpp"
#include "../style/theme.hpp"
#include "../imgui/context-scope.hpp"

#include <glad/gl.h>
#include <SDL3/SDL_keyboard.h>
#include <SDL3/SDL_log.h>
#include <imgui_impl_opengl3.h>
#include <imgui_impl_sdl3.h>
#include <imgui.h>
#include <imgui_stdlib.h>

#include <algorithm>
#include <string>
#include <vector>

namespace ui {
    static constexpr const char* ALIGNMENT_NAMES[] = {
        "top-left",     "top-center",  "top-right",     "center-left",  "center",
        "center-right", "bottom-left", "bottom-center", "bottom-right", "custom",
    };

    static constexpr const char* STYLE_NAMES[] = {"default", "hover", "active", "focus"};

    static constexpr uint64_t WINDOW_FLAGS = SDL_WINDOW_OPENGL | SDL_WINDOW_RESIZABLE | SDL_WINDOW_HIDDEN;
    static constexpr ImVec2 ICON_SIZE = {16.0F, 16.0F};
    static constexpr float WINDOW_PADDING = 8.0F;
    static constexpr float ITEM_SPACING = 6.0F;

    static SDL_WindowID mouse_event_window_id(const SDL_Event& event) {
        switch (event.type) {
            case SDL_EVENT_MOUSE_MOTION:
                return event.motion.windowID;
            case SDL_EVENT_MOUSE_BUTTON_DOWN:
            case SDL_EVENT_MOUSE_BUTTON_UP:
                return event.button.windowID;
            default:
                return 0;
        }
    }

    static ImVec2 mouse_event_position(const SDL_Event& event) {
        if (event.type == SDL_EVENT_MOUSE_MOTION) {
            return {event.motion.x, event.motion.y};
        }

        return {event.button.x, event.button.y};
    }

    Debugger::Debugger(UI& target) : m_target(target) {}

    Debugger::~Debugger() {
        shutdown();
    }

    void Debugger::shutdown() {
        if constexpr (constants::IS_DEBUG_BUILD) {
            if (!m_target.runtime().performance().metrics().empty()) {
                static_cast<void>(m_target.runtime().performance().save());
            }
        }

        if (m_ui == nullptr) {
            return;
        }

        m_ui.reset();

        if (m_target.window() != nullptr) {
            m_target.window()->make_current();
        }
    }

    void Debugger::setup() {
        ui::Config config{};
        config.window.title = "debugger";
        config.window.size = {560.0F, 720.0F};
        config.window.flags = WINDOW_FLAGS;
        config.window.shared_context_with = m_target.window();

        m_ui = std::make_unique<UI>(m_target.runtime(), config);

        if (!m_ui->ready()) {
            SDL_Log("Debugger: failed to initialize debugger UI");
            m_ui.reset();
            m_target.window()->make_current();
            return;
        }

        int target_x = 0;
        int target_y = 0;
        int target_width = 0;
        SDL_GetWindowPosition(m_target.window()->handle(), &target_x, &target_y);
        SDL_GetWindowSize(m_target.window()->handle(), &target_width, nullptr);
        m_ui->window()->set_position(target_x + target_width + 16, target_y);

        const ui::ImGuiContextScope scope(m_ui->imgui_context());

        m_icon.set_size(ICON_SIZE);
        m_icon.state().configure_all_styles([this](Style& style) { style.color(m_ui->theme().text_secondary_color); });

        m_target.window()->make_current();
    }

    void Debugger::set_icon(IconTexture* icon) {
        m_icon.set_texture(icon);
    }

    void Debugger::set_target(Node* target) {
        m_node_target = target;
        m_profiling_target = target;
        m_target_identity = target == nullptr ? 0 : target->identity();
        m_target_was_flow_position = target != nullptr && !target->layout().has_explicit_position();
        m_select_properties = target != nullptr;

        auto* widget = dynamic_cast<Widget*>(target);
        m_inspected_style = widget == nullptr ? StyleType::DEFAULT : widget->state().style_type();

        if (m_node_target == nullptr) {
            m_highlight_valid = false;
            return;
        }

        refresh_highlight();
    }

    bool Debugger::ready() const {
        return m_ui != nullptr && m_ui->ready();
    }

    void Debugger::set_enabled(bool enabled) {
        if (m_enabled == enabled) {
            return;
        }

        m_enabled = enabled;
        m_target.root().set_draw_profiling_enabled(enabled);

        if constexpr (constants::IS_DEBUG_BUILD) {
            m_target.runtime().performance().set_enabled(enabled);
            if (!enabled) {
                static_cast<void>(m_target.runtime().performance().save());
            }
        }

        if (m_ui == nullptr) {
            return;
        }

        if (m_enabled) {
            m_ui->window()->show();
            m_ui->window()->raise();
            return;
        }

        m_ui->window()->hide();
        set_inspect_mode(false);
    }

    void Debugger::set_style(const ImGuiStyle& style) {
        if (!ready()) {
            return;
        }

        const ui::ImGuiContextScope scope(m_ui->imgui_context());
        ImGui::GetStyle() = style;
    }

    void Debugger::set_font(FontType type, int size) {
        if (!ready()) {
            return;
        }

        const ui::ImGuiContextScope scope(m_ui->imgui_context());
        m_font = m_ui->get_font(type).get(size);

        if (m_font == nullptr) {
            SDL_Log("failed to load debugger font variation %d", size);
        }
    }

    bool Debugger::handle_inspect_event(const SDL_Event& event, bool mouse_event, SDL_WindowID main_window_id) {
        if (!m_inspect_mode || !mouse_event || mouse_event_window_id(event) != main_window_id) {
            return false;
        }

        Node* focused_node = m_target.input_router().debug_node_at(mouse_event_position(event));

        if (!focused_node) {
            m_hover_target = nullptr;
            return false;
        }

        if (event.type == SDL_EVENT_MOUSE_BUTTON_DOWN) {
            set_target(focused_node);
            m_hover_target = nullptr;
            set_inspect_mode(false, true);
            m_scroll_to_target = true;
        } else {
            m_hover_target = focused_node;
        }

        return true;
    }

    bool Debugger::process_sdl_event(const SDL_Event* event) {
        if (event == nullptr || !ready()) {
            return false;
        }

        const SDL_WindowID debug_window_id = m_ui->window()->id();
        const SDL_WindowID main_window_id = m_target.window()->id();
        SDL_WindowID event_window_id = mouse_event_window_id(*event);
        const bool mouse_event = event_window_id != 0;

        if (event->type == SDL_EVENT_MOUSE_WHEEL) {
            event_window_id = event->wheel.windowID;
        }

        if (handle_inspect_event(*event, mouse_event, main_window_id)) {
            return true;
        }

        // inspect mode belongs to the main application window.
        // debugger controls will not receive mouse input.
        if (mouse_event && event_window_id != debug_window_id) {
            return false;
        }

        if (event->type == SDL_EVENT_WINDOW_CLOSE_REQUESTED && event->window.windowID == debug_window_id) {
            set_enabled(false);
            return true;
        }

        return false;
    }

    void Debugger::set_inspect_mode(bool enabled, bool wait_for_release) {
        m_inspect_mode = enabled;

        if (enabled) {
            m_target.input_router().set_debug_inspect_mode(true);
        } else if (wait_for_release) {
            m_target.input_router().finish_debug_inspect_mode();
        } else {
            m_target.input_router().clear_debug_inspect_mode();
        }

        if (!enabled) {
            m_hover_target = nullptr;
        }
    }

    void Debugger::update() {
        if (!ready()) {
            return;
        }

        const bool focused = SDL_GetKeyboardFocus() == m_target.window()->handle();

        if (focused && ImGui::IsKeyDown(ImGuiKey_LeftShift) && ImGui::IsKeyPressed(ImGuiKey_D, false)) {
            set_enabled(!m_enabled);
        }

        m_target.input_router().set_debug_inspect_mode(m_inspect_mode);
    }

    void Debugger::refresh_highlight() {
        Node* target = m_inspect_mode ? m_hover_target : nullptr;
        if (!m_target.root().contains(target) || !target->visible()) {
            m_highlight_valid = false;
            return;
        }

        const Rect rect = target->layout().screen_rect();
        if (rect.max.x <= rect.min.x || rect.max.y <= rect.min.y) {
            m_highlight_valid = false;
            return;
        }

        m_highlight = rect;
        m_highlight_valid = true;
    }

    bool Debugger::should_restore_flow_position() const {
        if (m_node_target == nullptr || !m_target_was_flow_position) {
            return false;
        }

        const NodeLayout& layout = m_node_target->layout();
        return layout.anchor() == Anchor::TopLeft && layout.origin() == Origin::TopLeft && layout.offset().x == 0.0F &&
               layout.offset().y == 0.0F;
    }

    void Debugger::draw_highlight() {
        refresh_highlight();

        if (!m_highlight_valid) {
            return;
        }

        ImGui::GetForegroundDrawList()->AddRect(
            m_highlight.min, m_highlight.max, ImColor(m_target.theme().accent_color), 0.0F, 0, 2.0F
        );
    }

    void
    Debugger::render_node_tree(Node& node, int depth, bool show_draw_time, Node*& selected_target, bool update_target) {
        ImGui::PushID(&node);
        ImGui::PushStyleColor(
            ImGuiCol_Text, node.visible() ? m_ui->theme().text_color : m_ui->theme().text_secondary_color
        );

        ImGuiTreeNodeFlags flags = depth < 1 ? ImGuiTreeNodeFlags_DefaultOpen : 0;
        flags |= ImGuiTreeNodeFlags_SpanAvailWidth;

        if (selected_target != nullptr && &node != selected_target && node.contains(selected_target)) {
            ImGui::SetNextItemOpen(true, ImGuiCond_Always);
        }

        if (&node == selected_target) {
            flags |= ImGuiTreeNodeFlags_Selected;
            ImGui::PushStyleColor(ImGuiCol_Header, m_ui->theme().accent_color);
            ImGui::PushStyleColor(ImGuiCol_HeaderHovered, m_ui->theme().accent_hover_color);
            ImGui::PushStyleColor(ImGuiCol_HeaderActive, m_ui->theme().accent_color);
        }

        if (node.children().empty()) {
            flags |= ImGuiTreeNodeFlags_Leaf | ImGuiTreeNodeFlags_NoTreePushOnOpen;
        } else {
            flags |= ImGuiTreeNodeFlags_OpenOnArrow;
        }

        std::string_view node_id = node.id();
        if (node_id.starts_with("##")) {
            node_id.remove_prefix(2);
        }

        const auto* widget = dynamic_cast<const StyledNode*>(&node);
        std::string node_label =
            widget == nullptr ? std::string{} : std::string(widget_type_to_string(widget->widget_type()));
        if (widget != nullptr && !node_id.empty()) {
            node_label += " (";
            node_label += node_id;
            node_label += ")";
        }

        if (node_label.empty()) {
            node_label = node_id.empty() ? "Unknown" : std::string(node_id);
        }

        const bool expanded =
            show_draw_time ? ImGui::TreeNodeEx(&node, flags, "%s  %.3f ms", node_label.c_str(), node.draw_time_ms())
                           : ImGui::TreeNodeEx(&node, flags, "%s", node_label.c_str());
        const bool clicked = ImGui::IsItemClicked(ImGuiMouseButton_Left);

        if (&node == selected_target) {
            ImGui::PopStyleColor(3);
        }

        ImGui::PopStyleColor();
        ImGui::PopID();

        if (clicked) {
            selected_target = &node;
            if (update_target) {
                set_target(&node);
                m_scroll_to_target = true;
            }
        }

        if (update_target && &node == selected_target && m_scroll_to_target) {
            const ImVec2 item_min = ImGui::GetItemRectMin();
            const ImVec2 item_max = ImGui::GetItemRectMax();
            if (!ImGui::IsRectVisible(item_min, item_max)) ImGui::SetScrollHereY(0.5F);
        }

        if (expanded) {
            for (const auto& child : node.children()) {
                render_node_tree(*child, depth + 1, show_draw_time, selected_target, update_target);
            }

            if (!node.children().empty()) {
                ImGui::TreePop();
            }
        }
    }

    void Debugger::render_node_properties() {
        if (ImGui::TreeNodeEx("node", ImGuiTreeNodeFlags_DefaultOpen)) {
            const Rect arranged_rect = m_node_target->layout().arranged_rect();

            ImGui::Text("id: %s", m_node_target->id().c_str());
            ImGui::Text("children: %zu", m_node_target->children().size());
            ImGui::Text("draw time: %.3f ms", m_node_target->draw_time_ms());
            ImGui::Text("position: (%.1f, %.1f)", arranged_rect.min.x, arranged_rect.min.y);
            ImGui::Text("size: (%.1f, %.1f)", arranged_rect.size().x, arranged_rect.size().y);

            if (const std::optional<std::string> content = m_node_target->get_content(); content.has_value()) {
                std::string editable_content = *content;
                if (ImGui::InputText("content", &editable_content)) {
                    m_node_target->set_content(std::move(editable_content));
                }
            }

            bool visible = m_node_target->visible();
            if (ImGui::Checkbox("visible", &visible)) m_node_target->set_visible(visible);

            ImGui::TreePop();
        }
    }

    void Debugger::render_profiling() {
        if constexpr (constants::IS_DEBUG_BUILD) {
            PerformanceRecorder& performance = m_target.runtime().performance();
            if (ImGui::Button("save metrics")) {
                static_cast<void>(performance.save());
            }
            ImGui::SameLine();
            if (ImGui::Button("clear metrics")) {
                performance.clear();
            }
        }

        for (const auto& child : m_target.root().children()) {
            render_node_tree(*child, 0, true, m_profiling_target, false);
        }
    }

    void Debugger::render_layout_properties() {
        if (!ImGui::TreeNodeEx("layout", ImGuiTreeNodeFlags_DefaultOpen)) {
            return;
        }

        ImVec2 size = m_node_target->layout().size();
        if (ImGui::InputFloat2("size", &size.x)) {
            m_node_target->layout().set_size(size);
        }

        ImVec2 offset = m_node_target->layout().offset();
        if (ImGui::InputFloat2("offset", &offset.x)) {
            m_node_target->layout().set_offset(offset);
        }

        int anchor = static_cast<int>(m_node_target->layout().anchor());
        if (ImGui::Combo("anchor (parent)", &anchor, ALIGNMENT_NAMES, IM_ARRAYSIZE(ALIGNMENT_NAMES))) {
            m_node_target->layout().set_anchor(static_cast<Anchor>(anchor));
            if (should_restore_flow_position()) {
                m_node_target->layout().clear_explicit_position();
            }
        }

        int origin = static_cast<int>(m_node_target->layout().origin());
        if (ImGui::Combo("origin (node)", &origin, ALIGNMENT_NAMES, IM_ARRAYSIZE(ALIGNMENT_NAMES))) {
            m_node_target->layout().set_origin(static_cast<Origin>(origin));
            if (should_restore_flow_position()) {
                m_node_target->layout().clear_explicit_position();
            }
        }

        if (m_node_target->layout().anchor() == Anchor::Custom) {
            ImVec2 anchor_position = m_node_target->layout().anchor_factor();
            if (ImGui::InputFloat2("anchor point", &anchor_position.x)) {
                m_node_target->layout().set_anchor_position(anchor_position);
            }
        }

        if (m_node_target->layout().origin() == Origin::Custom) {
            ImVec2 origin_position = m_node_target->layout().origin_factor();
            if (ImGui::InputFloat2("origin point", &origin_position.x)) {
                m_node_target->layout().set_origin_position(origin_position);
            }
        }

        ImGui::TreePop();
    }

    void Debugger::render_style_variables(Style& style) {
        StyleVariableStore& variables = style.variables();

        m_variable_names.clear();
        variables.for_each([&](const std::string& name, const GenericValue&) {
            m_variable_names.push_back(name);
            return true;
        });
        std::sort(m_variable_names.begin(), m_variable_names.end());

        if (m_variable_names.empty() || !ImGui::TreeNodeEx("variables", ImGuiTreeNodeFlags_DefaultOpen)) {
            return;
        }

        for (const std::string& name : m_variable_names) {
            GenericValue* variable = variables.find(name);
            if (variable == nullptr) {
                continue;
            }

            std::visit(
                [&](auto& value) {
                    using ValueType = std::decay_t<decltype(value)>;
                    if constexpr (std::is_same_v<ValueType, FloatValue>) {
                        ImGui::DragFloat(name.c_str(), &value.value, 0.01F);
                    } else if constexpr (std::is_same_v<ValueType, IntValue>) {
                        ImGui::DragInt(name.c_str(), &value.value, 1.0F);
                    } else if constexpr (std::is_same_v<ValueType, BoolValue>) {
                        ImGui::Checkbox(name.c_str(), &value.value);
                    } else if constexpr (std::is_same_v<ValueType, StringValue>) {
                        ImGui::InputText(name.c_str(), &value.value);
                    } else if constexpr (std::is_same_v<ValueType, ColorValue>) {
                        ImGui::ColorEdit4(name.c_str(), &value.value.Value.x, ImGuiColorEditFlags_NoInputs);
                    } else if constexpr (std::is_same_v<ValueType, Vec2Value>) {
                        ImGui::DragFloat2(name.c_str(), &value.value.x, 0.01F);
                    }
                },
                *variable
            );
        }

        ImGui::TreePop();
    }

    void Debugger::render_style_properties() {
        auto* styled = dynamic_cast<StyledNode*>(m_node_target);

        if (styled == nullptr || !ImGui::TreeNodeEx("style", ImGuiTreeNodeFlags_DefaultOpen)) {
            return;
        }

        Style* style = &styled->style();
        Widget* widget = dynamic_cast<Widget*>(m_node_target);

        if (widget != nullptr) {
            const bool app_focused = SDL_GetKeyboardFocus() == m_target.window()->handle();
            if (app_focused) {
                m_inspected_style = widget->state().style_type();
            }

            int style_index = static_cast<int>(m_inspected_style);
            if (ImGui::Combo("state", &style_index, STYLE_NAMES, IM_ARRAYSIZE(STYLE_NAMES))) {
                m_inspected_style = static_cast<StyleType>(style_index);
            }

            style = &widget->state().style(m_inspected_style);
        }

        ImVec4 color = style->color().get();
        if (ImGui::ColorEdit4("color", &color.x, ImGuiColorEditFlags_NoInputs)) {
            style->color().set(color);
        }

        ImVec4 background_color = style->background_color().get();
        if (ImGui::ColorEdit4("background", &background_color.x, ImGuiColorEditFlags_NoInputs)) {
            style->background_color().set(background_color);
        }

        ImVec4 border_color = style->border_color().get();
        if (ImGui::ColorEdit4("border", &border_color.x, ImGuiColorEditFlags_NoInputs)) {
            style->border_color().set(border_color);
        }

        ImGui::DragFloat2("padding", &style->padding().x, 0.1F, 0.0F, 128.0F);
        ImGui::DragFloat("alpha", &style->alpha(), 0.01F, 0.0F, 1.0F);
        ImGui::DragFloat("border radius", &style->border_radius(), 0.1F, 0.0F, 64.0F);
        ImGui::DragFloat("border thickness", &style->border_thickness(), 0.1F, 0.0F, 16.0F);

        render_style_variables(*style);

        ImGui::TreePop();
    }

    void Debugger::render_properties() {
        if (m_node_target == nullptr) {
            ImGui::TextUnformatted("select a node from the list");
            return;
        }

        render_node_properties();
        render_layout_properties();

        render_style_properties();

        if (ImGui::Button("clear target")) {
            set_target(nullptr);
            m_scroll_to_target = false;
        }
    }

    void Debugger::render_toolbar() {
        const ImVec2 icon_position = ImGui::GetCursorScreenPos();
        const bool inspect_clicked = ImGui::InvisibleButton("##debug-inspect-mode", ICON_SIZE);

        ImGui::SetCursorScreenPos(icon_position);
        m_icon.state().style().color().set(
            ImColor(m_inspect_mode ? m_ui->theme().accent_color : m_ui->theme().text_secondary_color)
        );
        m_icon.draw();

        if (inspect_clicked) {
            set_inspect_mode(!m_inspect_mode, m_inspect_mode);
        }

        ImGui::SameLine(0.0F, ITEM_SPACING);
        ImGui::SetCursorPosY(ImGui::GetCursorPosY() + (ICON_SIZE.y - ImGui::GetTextLineHeight()) * 0.5F);
        ImGui::TextUnformatted("inspect");
        ImGui::Separator();
    }

    void Debugger::render_node_list() {
        ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, {WINDOW_PADDING, 4.0F});
        ImGui::BeginChild(
            "##debugger-nodes", {0.0F, 260.0F}, ImGuiChildFlags_Borders,
            ImGuiWindowFlags_NoBackground | ImGuiWindowFlags_NoScrollbar
        );
        ImGui::PopStyleVar();

        for (const auto& child : m_target.root().children()) {
            render_node_tree(*child, 0, false, m_node_target, true);
        }

        m_scroll_to_target = false;
        ImGui::EndChild();
    }

    void Debugger::render_sections() {
        ImGui::BeginChild(
            "##debugger-sections", {0.0F, 0.0F}, ImGuiChildFlags_Borders,
            ImGuiWindowFlags_NoBackground | ImGuiWindowFlags_NoScrollbar
        );

        if (ImGui::BeginTabBar("##debugger-sections-tabs", ImGuiTabBarFlags_FittingPolicyScroll)) {
            const ImGuiTabItemFlags properties_flags =
                m_select_properties ? ImGuiTabItemFlags_SetSelected : ImGuiTabItemFlags_None;
            if (m_node_target != nullptr && ImGui::BeginTabItem("properties", nullptr, properties_flags)) {
                m_select_properties = false;
                ImGui::BeginChild(
                    "##debugger-properties-content", {0.0F, 0.0F}, ImGuiChildFlags_None,
                    ImGuiWindowFlags_NoBackground | ImGuiWindowFlags_NoScrollbar
                );
                render_properties();
                ImGui::EndChild();
                ImGui::EndTabItem();
            }

            if (ImGui::BeginTabItem("profiling")) {
                ImGui::BeginChild(
                    "##debugger-profiling-content", {0.0F, 0.0F}, ImGuiChildFlags_None,
                    ImGuiWindowFlags_NoBackground | ImGuiWindowFlags_NoScrollbar
                );
                render_profiling();
                ImGui::EndChild();
                ImGui::EndTabItem();
            }

            ImGui::EndTabBar();
        }

        ImGui::EndChild();
    }

    void Debugger::render() {
        if (!m_enabled || !ready()) {
            return;
        }

        if constexpr (constants::IS_DEBUG_BUILD) {
            m_target.runtime().performance().begin_frame("debugger");
        }

        const ui::ImGuiContextScope scope(m_ui->imgui_context());
        m_ui->window()->make_current();

        ImGui_ImplOpenGL3_NewFrame();
        ImGui_ImplSDL3_NewFrame();
        ImGui::NewFrame();

        if (m_node_target != nullptr && !m_target.root().contains(m_node_target)) {
            set_target(nullptr);
            m_scroll_to_target = false;
        } else if (m_node_target != nullptr && m_node_target->identity() != m_target_identity) {
            set_target(nullptr);
            m_scroll_to_target = false;
        }

        if (m_profiling_target != nullptr && !m_target.root().contains(m_profiling_target)) {
            m_profiling_target = nullptr;
        }

        const ImVec2 display_size = m_ui->window()->display_size();

        ImGui::SetNextWindowPos({0.0F, 0.0F}, ImGuiCond_Always);
        ImGui::SetNextWindowSize(display_size, ImGuiCond_Always);
        ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, {WINDOW_PADDING, WINDOW_PADDING});

        const bool debugger_visible = ImGui::Begin(
            "##ui-debugger", nullptr,
            ImGuiWindowFlags_NoTitleBar | ImGuiWindowFlags_NoMove | ImGuiWindowFlags_NoResize |
                ImGuiWindowFlags_NoCollapse | ImGuiWindowFlags_NoScrollbar | ImGuiWindowFlags_NoScrollWithMouse |
                ImGuiWindowFlags_NoSavedSettings
        );
        if (debugger_visible) {
            const bool has_font = m_font != nullptr;

            if (has_font) {
                ImGui::PushFont(m_font);
            }

            ImGui::BeginChild(
                "##debugger-content", {0.0F, 0.0F}, ImGuiChildFlags_None,
                ImGuiWindowFlags_NoBackground | ImGuiWindowFlags_NoScrollbar
            );

            ImGui::PushStyleVar(ImGuiStyleVar_ItemSpacing, {ITEM_SPACING, 4.0F});
            ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, {6.0F, 4.0F});
            render_toolbar();
            render_node_list();
            render_sections();
            ImGui::PopStyleVar(2);

            ImGui::EndChild();

            if (has_font) {
                ImGui::PopFont();
            }
        }

        ImGui::End();
        ImGui::PopStyleVar();

        ImGui::Render();

        glViewport(0, 0, static_cast<int>(display_size.x), static_cast<int>(display_size.y));
        glClearColor(
            m_ui->theme().background_color.x, m_ui->theme().background_color.y, m_ui->theme().background_color.z,
            m_ui->theme().background_color.w
        );

        glClear(GL_COLOR_BUFFER_BIT);
        ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());

        m_ui->window()->swap();

        if constexpr (constants::IS_DEBUG_BUILD) {
            m_target.runtime().performance().end_frame("debugger");
        }

        m_target.window()->make_current();
    }
} // namespace ui
