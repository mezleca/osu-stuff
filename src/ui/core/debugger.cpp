#include "debugger.hpp"
#include "../theme.hpp"

#include <glad/gl.h>
#include <SDL3/SDL_log.h>
#include <imgui_impl_opengl3.h>
#include <imgui_impl_sdl3.h>
#include <imgui.h>
#include <imgui_stdlib.h>

#include <algorithm>
#include <type_traits>
#include <vector>

// TODO:
// - remove node
// - add class (node doenst store that yet)

static constexpr const char* ALIGNMENT_NAMES[] = {
    "top-left",     "top-center",  "top-right",     "center-left",  "center",
    "center-right", "bottom-left", "bottom-center", "bottom-right", "custom",
};

static constexpr const char* STYLE_NAMES[] = {"default", "hover", "active", "focus"};

static constexpr ImVec2 WINDOW_SIZE = {560.0F, 720.0F};
static constexpr ImVec2 FRAME_PADDING = {6.0F, 4.0F};
static constexpr ImVec2 ICON_SIZE = {16.0F, 16.0F};
static constexpr ImVec2 CLOSE_ICON_SIZE = {18.0F, 18.0F};
static constexpr float WINDOW_PADDING = 16.0F;
static constexpr float NODE_LIST_HEIGHT = 260.0F;
static constexpr float ITEM_SPACING = 6.0F;
static constexpr float HEADER_SPACING = 8.0F;
static constexpr float SELECT_RADIUS = 5.0F;

static_assert(IM_ARRAYSIZE(ALIGNMENT_NAMES) == static_cast<int>(ui::Anchor::Custom) + 1);
static_assert(IM_ARRAYSIZE(STYLE_NAMES) == static_cast<int>(ui::StyleType::_COUNT));

namespace ui {
    Debugger::Debugger(UiRoot& root, Window& main_window) : m_root(root), m_main_window(main_window) {
        ImGuiContext* previous_context = ImGui::GetCurrentContext();

        // create debugger window
        m_main_window.make_current();
        m_window = std::make_unique<Window>(
            "ui debugger", WINDOW_SIZE, SDL_WINDOW_OPENGL | SDL_WINDOW_RESIZABLE | SDL_WINDOW_HIDDEN, &main_window
        );

        if (m_window == nullptr || !m_window->valid()) {
            return;
        }

        m_window->make_current();

        // setup imgui
        m_context = ImGui::CreateContext();
        if (m_context == nullptr) {
            SDL_Log("ImGui::CreateContext(): failed to create debugger context");
            ImGui::SetCurrentContext(previous_context);
            m_main_window.make_current();
            return;
        }

        ImGui::SetCurrentContext(m_context);
        if (!ImGui_ImplSDL3_InitForOpenGL(m_window->handle(), m_window->context())) {
            SDL_Log("ImGui_ImplSDL3_InitForOpenGL(): failed to initialize debugger backend");
            ImGui::DestroyContext(m_context);
            m_context = nullptr;
            m_main_window.make_current();
            ImGui::SetCurrentContext(previous_context);
            return;
        }

        if (!ImGui_ImplOpenGL3_Init("#version 300 es")) {
            SDL_Log("ImGui_ImplOpenGL3_Init(): failed to initialize debugger backend");
            ImGui_ImplSDL3_Shutdown();
            ImGui::DestroyContext(m_context);
            m_context = nullptr;
            m_main_window.make_current();
            ImGui::SetCurrentContext(previous_context);
            return;
        }

        ImGui::StyleColorsDark();
        ImGui::GetIO().IniFilename = nullptr;
        ImGui::GetIO().LogFilename = nullptr;

        m_main_window.make_current();

        // restore the context that was active before creating this window.
        ImGui::SetCurrentContext(previous_context);

        m_icon.set_size(ICON_SIZE);
        m_icon.state().set_for_all_styles([](Style& style) { style.color.set(ui_theme::ACCENT_COLOR); });
        m_icon.state().snap_to_style(StyleType::DEFAULT);

        m_close_icon.set_size(CLOSE_ICON_SIZE);
        m_close_icon.state().set_for_all_styles([](Style& style) { style.color.set(ui_theme::TEXT_COLOR); });
        m_close_icon.state().snap_to_style(StyleType::DEFAULT);
    }

    Debugger::~Debugger() {
        shutdown();
    }

    void Debugger::shutdown() {
        if (m_context == nullptr) {
            return;
        }

        ImGuiContext* previous_context = ImGui::GetCurrentContext();
        m_window->make_current();

        ImGui::SetCurrentContext(m_context);

        ImGui_ImplOpenGL3_Shutdown();
        ImGui_ImplSDL3_Shutdown();

        ImGui::DestroyContext(m_context);

        m_context = nullptr;
        m_main_window.make_current();
        m_window.reset();

        ImGui::SetCurrentContext(previous_context);
    }

    void Debugger::set_icon(IconTexture* icon) {
        m_icon.set_texture(icon);
    }

    void Debugger::set_close_icon(IconTexture* icon) {
        m_close_icon.set_texture(icon);
    }

    bool Debugger::ready() const {
        return m_context != nullptr && m_window != nullptr && m_window->valid();
    }

    void Debugger::set_enabled(bool enabled) {
        if (m_enabled == enabled) {
            return;
        }

        m_enabled = enabled;
        if (m_enabled) {
            m_window->show();
            m_window->raise();
            return;
        }

        m_window->hide();
        set_select_mode(false);
    }

    void Debugger::set_style(const ImGuiStyle& style) {
        if (!ready()) {
            return;
        }

        ImGuiContext* previous_context = ImGui::GetCurrentContext();

        ImGui::SetCurrentContext(m_context);
        ImGui::GetStyle() = style;
        ImGui::SetCurrentContext(previous_context);
    }

    void Debugger::set_font(std::string_view path, float size, const ImFontConfig& config) {
        if (!ready() || path.empty()) {
            return;
        }

        ImGuiContext* previous_context = ImGui::GetCurrentContext();

        ImGui::SetCurrentContext(m_context);
        m_font = ImGui::GetIO().Fonts->AddFontFromFileTTF(std::string(path).c_str(), size, &config);

        if (m_font == nullptr) {
            SDL_Log("failed to load debugger font: %s", std::string(path).c_str());
        }

        ImGui::SetCurrentContext(previous_context);
    }

    void Debugger::set_bold_font(std::string_view path, float size, const ImFontConfig& config) {
        if (!ready() || path.empty()) {
            return;
        }

        ImGuiContext* previous_context = ImGui::GetCurrentContext();

        ImGui::SetCurrentContext(m_context);
        m_bold_font = ImGui::GetIO().Fonts->AddFontFromFileTTF(std::string(path).c_str(), size, &config);

        if (m_bold_font == nullptr) {
            SDL_Log("failed to load debugger bold font: %s", std::string(path).c_str());
        }

        ImGui::SetCurrentContext(previous_context);
    }

    bool Debugger::handle_select_event(const SDL_Event& event, SDL_WindowID main_window_id) {
        if (!m_select_mode) {
            return false;
        }

        if (event.type == SDL_EVENT_MOUSE_BUTTON_DOWN && event.button.windowID == main_window_id &&
            event.button.button == SDL_BUTTON_LEFT) {
            if (Node* clicked_node = m_root.input_router().node_at({event.button.x, event.button.y});
                clicked_node != nullptr) {
                m_target = clicked_node;
                m_scroll_to_target = true;
                set_select_mode(false, true);
            }
        }

        return true;
    }

    void Debugger::process_event(const SDL_Event* event) {
        if (event == nullptr || !ready()) {
            return;
        }

        const SDL_WindowID debug_window_id = m_window == nullptr ? 0 : m_window->id();
        const SDL_WindowID main_window_id = m_main_window.id();
        SDL_WindowID event_window_id = 0;
        bool mouse_event = false;

        switch (event->type) {
            case SDL_EVENT_MOUSE_MOTION:
                event_window_id = event->motion.windowID;
                mouse_event = true;
                break;
            case SDL_EVENT_MOUSE_BUTTON_DOWN:
            case SDL_EVENT_MOUSE_BUTTON_UP:
                event_window_id = event->button.windowID;
                mouse_event = true;
                break;
            case SDL_EVENT_MOUSE_WHEEL:
                event_window_id = event->wheel.windowID;
                mouse_event = true;
                break;
            default:
                break;
        }

        if (handle_select_event(*event, main_window_id)) {
            return;
        }

        // select mode belongs to the main application window.
        // debugger controls will not receive mouse input.
        if (mouse_event && event_window_id != debug_window_id) {
            return;
        }

        if (event->type == SDL_EVENT_WINDOW_CLOSE_REQUESTED && m_window != nullptr &&
            event->window.windowID == m_window->id()) {
            set_enabled(false);
        }

        ImGuiContext* previous_context = ImGui::GetCurrentContext();
        ImGui::SetCurrentContext(m_context);
        ImGui_ImplSDL3_ProcessEvent(event);
        ImGui::SetCurrentContext(previous_context);
    }

    void Debugger::set_select_mode(bool enabled, bool wait_for_release) {
        m_select_mode = enabled;

        if (enabled) {
            m_root.input_router().set_debug_select_mode(true);
        } else if (wait_for_release) {
            m_root.input_router().finish_debug_select_mode();
        } else {
            m_root.input_router().clear_debug_select_mode();
        }
    }

    void Debugger::update() {
        if (!ready()) {
            return;
        }

        const bool focused = (m_main_window.flags() & SDL_WINDOW_INPUT_FOCUS) != 0;

        if (focused && ImGui::IsKeyDown(ImGuiKey_LeftShift) && ImGui::IsKeyPressed(ImGuiKey_D, false)) {
            set_enabled(!m_enabled);
        }

        m_root.input_router().set_debug_select_mode(m_select_mode);
    }

    void Debugger::render_node_list(Node& node, int depth) {
        ImGui::PushID(&node);
        ImGui::PushStyleColor(ImGuiCol_Text, node.visible() ? ui_theme::TEXT_COLOR : ui_theme::TEXT_SECONDARY_COLOR);

        ImGuiTreeNodeFlags flags = depth < 1 ? ImGuiTreeNodeFlags_DefaultOpen : 0;
        flags |= ImGuiTreeNodeFlags_SpanAvailWidth;

        if (m_target != nullptr && &node != m_target && node.contains(m_target)) {
            ImGui::SetNextItemOpen(true, ImGuiCond_Always);
        }

        if (&node == m_target) {
            flags |= ImGuiTreeNodeFlags_Selected;
            ImGui::PushStyleColor(ImGuiCol_Header, ui_theme::ACCENT_COLOR);
            ImGui::PushStyleColor(ImGuiCol_HeaderHovered, ui_theme::ACCENT_HOVER_COLOR);
            ImGui::PushStyleColor(ImGuiCol_HeaderActive, ui_theme::ACCENT_COLOR);
        }

        if (node.children().empty()) {
            flags |= ImGuiTreeNodeFlags_Leaf | ImGuiTreeNodeFlags_NoTreePushOnOpen;
        } else {
            flags |= ImGuiTreeNodeFlags_OpenOnArrow;
        }

        const bool expanded =
            ImGui::TreeNodeEx(&node, flags, "%s", node.id().empty() ? "<unnamed>" : node.id().c_str());
        const bool clicked = ImGui::IsItemClicked(ImGuiMouseButton_Left);

        if (&node == m_target) {
            ImGui::PopStyleColor(3);
        }

        ImGui::PopStyleColor();
        ImGui::PopID();

        if (clicked) {
            m_target = &node;
            m_scroll_to_target = true;
        }

        if (&node == m_target && m_scroll_to_target) {
            const ImVec2 item_min = ImGui::GetItemRectMin();
            const ImVec2 item_max = ImGui::GetItemRectMax();
            if (!ImGui::IsRectVisible(item_min, item_max)) {
                ImGui::SetScrollHereY(0.5F);
            }
        }

        if (expanded) {
            for (const auto& child : node.children()) {
                render_node_list(*child, depth + 1);
            }

            if (!node.children().empty()) {
                ImGui::TreePop();
            }
        }
    }

    void Debugger::render_node_properties() {
        if (ImGui::TreeNodeEx("node", ImGuiTreeNodeFlags_DefaultOpen)) {
            ImGui::Text("id: %s", m_target->id().c_str());
            ImGui::Text("children: %zu", m_target->children().size());
            ImGui::Text("draw time: %.3f ms", m_target->draw_time_ms());

            if (const std::optional<std::string> content = m_target->get_content(); content.has_value()) {
                std::string editable_content = *content;
                if (ImGui::InputText("content", &editable_content)) {
                    m_target->set_content(std::move(editable_content));
                }
            }

            bool visible = m_target->visible();
            if (ImGui::Checkbox("visible", &visible)) {
                m_target->set_visible(visible);
            }

            bool cancelable = m_target->cancelable();
            if (ImGui::Checkbox("cancelable", &cancelable)) {
                m_target->set_cancelable(cancelable);
            }

            ImGui::TreePop();
        }
    }

    void Debugger::render_layout_properties() {
        if (!ImGui::TreeNodeEx("layout", ImGuiTreeNodeFlags_DefaultOpen)) {
            return;
        }

        ImVec2 size = m_target->layout().size();
        if (ImGui::InputFloat2("size", &size.x)) {
            m_target->layout().set_size(size);
        }

        ImVec2 offset = m_target->layout().offset();
        if (ImGui::InputFloat2("offset", &offset.x)) {
            m_target->layout().set_offset(offset);
        }

        int anchor = static_cast<int>(m_target->layout().anchor());
        if (ImGui::Combo("anchor", &anchor, ALIGNMENT_NAMES, IM_ARRAYSIZE(ALIGNMENT_NAMES))) {
            m_target->layout().set_anchor(static_cast<Anchor>(anchor));
        }

        int origin = static_cast<int>(m_target->layout().origin());
        if (ImGui::Combo("origin", &origin, ALIGNMENT_NAMES, IM_ARRAYSIZE(ALIGNMENT_NAMES))) {
            m_target->layout().set_origin(static_cast<Origin>(origin));
        }

        if (m_target->layout().anchor() == Anchor::Custom) {
            ImVec2 anchor_position = m_target->layout().anchor_factor();
            if (ImGui::InputFloat2("anchor point", &anchor_position.x)) {
                m_target->layout().set_anchor_position(anchor_position);
            }
        }

        if (m_target->layout().origin() == Origin::Custom) {
            ImVec2 origin_position = m_target->layout().origin_factor();
            if (ImGui::InputFloat2("origin point", &origin_position.x)) {
                m_target->layout().set_origin_position(origin_position);
            }
        }

        ImGui::TreePop();
    }

    void Debugger::render_style_variables(const Style& style) {
        const StyleVariableStore& variables = style.variables();
        if (m_variable_store != &variables || m_variable_names.size() != variables.size()) {
            m_variable_store = &variables;
            m_variable_names.clear();
            variables.for_each([&](const std::string& name, const GenericValue&) {
                m_variable_names.push_back(name);
                return true;
            });
            std::sort(m_variable_names.begin(), m_variable_names.end());
        }

        if (m_variable_names.empty() || !ImGui::TreeNodeEx("variables", ImGuiTreeNodeFlags_DefaultOpen)) {
            return;
        }

        for (const std::string& name : m_variable_names) {
            const GenericValue* variable = variables.find(name);
            if (variable == nullptr) {
                continue;
            }

            std::visit(
                [&](const auto& value) {
                    using ValueType = std::decay_t<decltype(value)>;
                    if constexpr (std::is_same_v<ValueType, FloatValue>) {
                        ImGui::Text("%s: %.3f", name.c_str(), value.value);
                    } else if constexpr (std::is_same_v<ValueType, IntValue>) {
                        ImGui::Text("%s: %d", name.c_str(), value.value);
                    } else if constexpr (std::is_same_v<ValueType, BoolValue>) {
                        ImGui::Text("%s: %s", name.c_str(), value.value ? "true" : "false");
                    } else if constexpr (std::is_same_v<ValueType, StringValue>) {
                        ImGui::Text("%s: %s", name.c_str(), value.value.c_str());
                    } else if constexpr (std::is_same_v<ValueType, ColorValue>) {
                        const ImVec4 color = value.get();
                        ImGui::Text(
                            "%s: rgba(%.2f, %.2f, %.2f, %.2f)", name.c_str(), color.x, color.y, color.z, color.w
                        );
                    } else if constexpr (std::is_same_v<ValueType, Vec2Value>) {
                        ImGui::Text("%s: (%.2f, %.2f)", name.c_str(), value.value.x, value.value.y);
                    }
                },
                *variable
            );
        }

        ImGui::TreePop();
    }

    void Debugger::render_style_properties() {
        auto* styled = dynamic_cast<StyledNode*>(m_target);
        if (styled == nullptr || !ImGui::TreeNodeEx("style", ImGuiTreeNodeFlags_DefaultOpen)) {
            return;
        }

        Style* style = &styled->style();
        Widget* widget = dynamic_cast<Widget*>(m_target);
        int style_index = 0;

        if (widget != nullptr) {
            style_index = static_cast<int>(widget->state().get_style_type());
            if (ImGui::Combo("state", &style_index, STYLE_NAMES, IM_ARRAYSIZE(STYLE_NAMES))) {
                widget->state().set_style(static_cast<StyleType>(style_index));
            }
            style = &widget->state().get_style(static_cast<StyleType>(style_index));
        }

        ImVec4 color = style->color.get();
        bool style_changed = false;
        if (ImGui::ColorEdit4("color", &color.x, ImGuiColorEditFlags_NoInputs)) {
            style->color.set(color);
            style_changed = true;
        }

        ImVec4 background_color = style->background_color.get();
        if (ImGui::ColorEdit4("background", &background_color.x, ImGuiColorEditFlags_NoInputs)) {
            style->background_color.set(background_color);
            style_changed = true;
        }

        ImVec4 border_color = style->border_color.get();
        if (ImGui::ColorEdit4("border", &border_color.x, ImGuiColorEditFlags_NoInputs)) {
            style->border_color.set(border_color);
            style_changed = true;
        }

        style_changed |= ImGui::DragFloat("border radius", &style->border_radius, 0.1F, 0.0F, 64.0F);
        style_changed |= ImGui::DragFloat("border thickness", &style->border_thickness, 0.1F, 0.0F, 16.0F);

        if (style_changed && widget != nullptr) {
            widget->state().snap_to_style(static_cast<StyleType>(style_index));
        }

        render_style_variables(*style);
        ImGui::TreePop();
    }

    void Debugger::render_properties() {
        if (m_target == nullptr) {
            ImGui::TextUnformatted("select a node from the list");
            return;
        }

        render_node_properties();
        render_layout_properties();

        render_style_properties();

        if (ImGui::Button("clear target")) {
            m_target = nullptr;
            m_scroll_to_target = false;
        }
    }

    void Debugger::render() {
        if (!m_enabled) {
            return;
        }

        if (!ready()) {
            return;
        }

        ImGuiContext* main_context = ImGui::GetCurrentContext();
        m_window->make_current();
        ImGui::SetCurrentContext(m_context);
        ImGui_ImplOpenGL3_NewFrame();
        ImGui_ImplSDL3_NewFrame();
        ImGui::NewFrame();

        if (m_target != nullptr && !m_root.contains(m_target)) {
            m_target = nullptr;
            m_scroll_to_target = false;
        }

        const ImVec2 display_size = m_window->display_size();
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

            ImGui::PushStyleVar(ImGuiStyleVar_ScrollbarSize, 0.0F);
            ImGui::BeginChild(
                "##debugger-content", {0.0F, 0.0F}, ImGuiChildFlags_None,
                ImGuiWindowFlags_NoBackground | ImGuiWindowFlags_AlwaysVerticalScrollbar
            );
            {
                ImGui::PushStyleVar(ImGuiStyleVar_ItemSpacing, {ITEM_SPACING, ITEM_SPACING});
                ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, FRAME_PADDING);

                const ImVec2 icon_position = ImGui::GetCursorScreenPos();
                const bool select_clicked = ImGui::InvisibleButton("##debug-select-mode", {16.0F, 16.0F});

                ImGui::SetCursorScreenPos(icon_position);

                if (m_select_mode) {
                    ImGui::GetWindowDrawList()->AddCircleFilled(
                        {icon_position.x + ICON_SIZE.x / 2.0F, icon_position.y + ICON_SIZE.y / 2.0F}, SELECT_RADIUS,
                        ImColor(ui_theme::ACCENT_COLOR)
                    );
                }

                m_icon.draw();

                if (select_clicked) {
                    set_select_mode(!m_select_mode, m_select_mode);
                }

                ImGui::SameLine(0.0F, HEADER_SPACING);
                ImGui::TextUnformatted("|");
                ImGui::SameLine(0.0F, HEADER_SPACING);

                if (m_bold_font != nullptr) {
                    ImGui::PushFont(m_bold_font);
                }

                ImGui::TextUnformatted("ui debugger");

                if (m_bold_font != nullptr) {
                    ImGui::PopFont();
                }

                ImGui::SameLine(ImGui::GetWindowContentRegionMax().x - m_close_icon.get_size().x);

                m_close_icon.draw();

                if (ImGui::IsItemHovered() && ImGui::IsMouseClicked(ImGuiMouseButton_Left)) {
                    set_enabled(false);
                }

                ImGui::SeparatorText("nodes");
                ImGui::PushStyleVar(ImGuiStyleVar_ScrollbarSize, 0.0F);
                ImGui::BeginChild(
                    "##debugger-nodes", {0.0F, NODE_LIST_HEIGHT}, ImGuiChildFlags_None,
                    ImGuiWindowFlags_NoBackground | ImGuiWindowFlags_HorizontalScrollbar
                );
                {
                    render_node_list(m_root, 0);
                    m_scroll_to_target = false;
                    ImGui::EndChild();
                    ImGui::PopStyleVar();

                    ImGui::SeparatorText("properties");
                    render_properties();

                    if (has_font) {
                        ImGui::PopFont();
                    }
                }
                ImGui::PopStyleVar(2);
                ImGui::PopStyleVar();
                ImGui::EndChild();
            }
            ImGui::End();
            ImGui::PopStyleVar();

            ImGui::Render();
            glViewport(0, 0, static_cast<int>(display_size.x), static_cast<int>(display_size.y));
            glClearColor(ui_theme::BG_COLOR.x, ui_theme::BG_COLOR.y, ui_theme::BG_COLOR.z, ui_theme::BG_COLOR.w);
            glClear(GL_COLOR_BUFFER_BIT);
            ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
            m_window->swap();

            m_main_window.make_current();
            ImGui::SetCurrentContext(main_context);
        }
    }
} // namespace ui
