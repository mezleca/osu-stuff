#include "ui.hpp"
#include "constants.hpp"
#include "imgui/context-scope.hpp"
#include "style/theme.hpp"
#include "tree/node.hpp"

#include <imgui_impl_opengl3.h>
#include <imgui_impl_sdl3.h>
#include <SDL3/SDL_log.h>
#include <algorithm>
#include <cstdint>
#include <optional>

namespace ui {
    static PointerButton pointer_button(uint8_t button) {
        switch (button) {
            case SDL_BUTTON_LEFT:
                return PointerButton::Left;
            case SDL_BUTTON_RIGHT:
                return PointerButton::Right;
            case SDL_BUTTON_MIDDLE:
                return PointerButton::Middle;
            default:
                return PointerButton::None;
        }
    }

    static std::optional<UiEvent> from_sdl_event(const SDL_Event& event) {
        UiEvent ui_event = UiEvent::make(EventType::Cancel);

        switch (event.type) {
            case SDL_EVENT_KEY_DOWN:
                ui_event.type = EventType::KeyDown;
                ui_event.key = event.key.key;
                break;
            case SDL_EVENT_KEY_UP:
                ui_event.type = EventType::KeyUp;
                ui_event.key = event.key.key;
                break;
            case SDL_EVENT_TEXT_INPUT:
                ui_event.type = EventType::TextInput;
                ui_event.text = event.text.text != nullptr ? event.text.text : "";
                break;
            case SDL_EVENT_MOUSE_BUTTON_DOWN:
                ui_event.type = EventType::PointerDown;
                ui_event.position = {event.button.x, event.button.y};
                ui_event.button = pointer_button(event.button.button);
                break;
            case SDL_EVENT_MOUSE_BUTTON_UP:
                ui_event.type = EventType::PointerUp;
                ui_event.position = {event.button.x, event.button.y};
                ui_event.button = pointer_button(event.button.button);
                break;
            case SDL_EVENT_MOUSE_MOTION:
                ui_event.type = EventType::PointerMove;
                ui_event.position = {event.motion.x, event.motion.y};
                break;
            case SDL_EVENT_MOUSE_WHEEL:
                ui_event.type = EventType::Scroll;
                ui_event.position = {event.wheel.mouse_x, event.wheel.mouse_y};
                ui_event.scroll = {
                    event.wheel.x * constants::SCROLL_WHEEL_SCALE,
                    event.wheel.y * constants::SCROLL_WHEEL_SCALE,
                };
                break;
            default:
                return std::nullopt;
        }

        return ui_event;
    }
    class SurfaceRootNode final : public Node {
    public:
        SurfaceRootNode() : Node("surface-root") {}

    protected:
        bool on_draw() override {
            const ImGuiViewport* viewport = ImGui::GetMainViewport();
            ImGui::SetNextWindowPos(viewport->WorkPos);
            ImGui::SetNextWindowSize(viewport->WorkSize);
            ImGui::Begin("##ui-surface", nullptr, constants::WINDOW_FLAGS);

            const ImVec2 position = ImGui::GetWindowPos();
            const ImVec2 size = ImGui::GetWindowSize();
            layout().set_size(size);
            layout().set_screen_rect(Rect::from_position_size(position, size));
            return true;
        }

        void on_draw_end() override {
            ImGui::End();
        }
    };
} // namespace ui

UI::UI(ui::Runtime& runtime, ui::Config config)
    : m_runtime(runtime), m_imgui_input(input_router()), m_profiler(runtime.performance_directory()), m_config(config) {
    m_runtime.register_surface(*this);
    initialize();
}

UI::~UI() {
    m_runtime.unregister_surface(*this);

    if (!m_ready) {
        return;
    }

    const ui::ImGuiContextScope scope(m_context);

    m_runtime.release_context(m_context, m_window->context());
    ImGui_ImplOpenGL3_Shutdown();
    ImGui_ImplSDL3_Shutdown();
    ImGui::DestroyContext(m_context);
}

void UI::initialize() {
    m_window = std::make_unique<ui::Window>(
        m_config.window.title, m_config.window.size, m_config.window.flags, m_config.window.shared_context_with
    );

    if (!m_window->valid()) {
        SDL_Log("UI: failed to create window '%s'", m_config.window.title.c_str());
        return;
    }

    m_window->make_current();

    if (gladLoadGL(SDL_GL_GetProcAddress) == 0) {
        SDL_Log("UI: failed to initialize OpenGL functions for '%s'", m_config.window.title.c_str());
        return;
    }

    m_context = ImGui::CreateContext();

    if (m_context == nullptr) {
        SDL_Log("UI: ImGui::CreateContext() failed for '%s'", m_config.window.title.c_str());
        return;
    }

    const ui::ImGuiContextScope scope(m_context);

    m_io = &ImGui::GetIO();
    m_io->IniFilename = nullptr;
    m_io->LogFilename = nullptr;

    configure_style(SDL_GetDisplayContentScale(SDL_GetPrimaryDisplay()));

    if (!ImGui_ImplSDL3_InitForOpenGL(m_window->handle(), m_window->context())) {
        SDL_Log("UI: ImGui_ImplSDL3_InitForOpenGL() failed for '%s'", m_config.window.title.c_str());
        ImGui::DestroyContext(m_context);
        m_context = nullptr;
        return;
    }

    if (!ImGui_ImplOpenGL3_Init("#version 300 es")) {
        SDL_Log("UI: ImGui_ImplOpenGL3_Init() failed for '%s'", m_config.window.title.c_str());
        ImGui_ImplSDL3_Shutdown();
        ImGui::DestroyContext(m_context);
        m_context = nullptr;
        return;
    }

    m_ready = true;

    m_container = std::make_unique<ui::SurfaceRootNode>();
    m_container->set_input_router(&m_input_router);
    m_container->set_profiler(&m_profiler);
}

void UI::begin_input_frame() {
    if (!m_ready) {
        return;
    }

    const ui::ImGuiContextScope scope(m_context);
    m_input_router.begin_frame();
}

void UI::configure_style(float main_scale) {
    ImGui::StyleColorsDark();

    ImGuiStyle& style = ImGui::GetStyle();
    const ui::Theme& theme = m_runtime.theme();

    // ui items / widgets
    style.WindowRounding = 0.0f;
    style.ChildRounding = 0.0f;
    style.PopupRounding = 6.0f;
    style.TabRounding = 4.0f;
    style.WindowPadding = ImVec2{0.0f, 0.0f};
    style.CellPadding = ImVec2{0.0f, 0.0f};

    set_frame_style({12.0F, 8.0F}, theme.control_rounding, 0.0F);
    set_grab_style(theme.control_thumb_size, theme.control_rounding);
    set_item_spacing({10.0F, 10.0F}, {8.0F, 6.0F});

    // make lines look normal
    style.CircleTessellationMaxError = 0.10f;
    style.AntiAliasedLinesUseTex = false;

    style.ScaleAllSizes(main_scale);
    style.FontScaleDpi = main_scale;

    apply_theme_colors();
}

void UI::set_frame_style(ImVec2 padding, float rounding, float border_thickness) {
    if (m_context == nullptr) {
        return;
    }

    const ui::ImGuiContextScope scope(m_context);
    ImGuiStyle& style = ImGui::GetStyle();
    style.FramePadding = padding;
    style.FrameRounding = std::max(0.0F, rounding);
    style.FrameBorderSize = std::max(0.0F, border_thickness);
}

void UI::set_grab_style(float minimum_size, float rounding) {
    if (m_context == nullptr) {
        return;
    }

    const ui::ImGuiContextScope scope(m_context);
    ImGuiStyle& style = ImGui::GetStyle();
    style.GrabMinSize = std::max(1.0F, minimum_size);
    style.GrabRounding = std::max(0.0F, rounding);
}

void UI::set_item_spacing(ImVec2 spacing, ImVec2 inner_spacing) {
    if (m_context == nullptr) {
        return;
    }

    const ui::ImGuiContextScope scope(m_context);
    ImGuiStyle& style = ImGui::GetStyle();
    style.ItemSpacing = spacing;
    style.ItemInnerSpacing = inner_spacing;
}

void UI::apply_theme_colors() {
    const ui::Theme& theme = m_runtime.theme();
    ImVec4* colors = ImGui::GetStyle().Colors;

    colors[ImGuiCol_WindowBg] = theme.background_color;
    colors[ImGuiCol_ChildBg] = theme.background_secondary_color;
    colors[ImGuiCol_Border] = theme.control_border_color;
    colors[ImGuiCol_Separator] = theme.header_border_color;
    colors[ImGuiCol_Text] = theme.text_color;
    colors[ImGuiCol_TextDisabled] = theme.text_secondary_color;
    colors[ImGuiCol_Button] = theme.background_secondary_color;
    colors[ImGuiCol_ButtonHovered] = theme.background_tertiary_color;
    colors[ImGuiCol_ButtonActive] = theme.button_active_color;
    colors[ImGuiCol_Header] = theme.header_background_color;
    colors[ImGuiCol_HeaderHovered] = theme.background_tertiary_color;
    colors[ImGuiCol_HeaderActive] = theme.button_active_color;
    colors[ImGuiCol_Tab] = theme.background_tertiary_color;
    colors[ImGuiCol_TabHovered] = theme.accent_hover_color;
    colors[ImGuiCol_TabSelected] = theme.accent_color;
    colors[ImGuiCol_TabSelectedOverline] = theme.accent_color;
    colors[ImGuiCol_TabDimmed] = theme.background_tertiary_color;
    colors[ImGuiCol_TabDimmedSelected] = theme.accent_color;
    colors[ImGuiCol_TabDimmedSelectedOverline] = theme.accent_color;
    colors[ImGuiCol_FrameBg] = theme.control_background_color;
    colors[ImGuiCol_FrameBgHovered] = theme.control_hover_color;
    colors[ImGuiCol_FrameBgActive] = theme.control_active_color;
    colors[ImGuiCol_CheckboxSelectedBg] = theme.control_background_color;
    colors[ImGuiCol_TitleBg] = theme.background_secondary_color;
    colors[ImGuiCol_TitleBgActive] = theme.background_secondary_color;
    colors[ImGuiCol_CheckMark] = theme.control_mark_color;
    colors[ImGuiCol_SliderGrab] = theme.control_mark_color;
    colors[ImGuiCol_SliderGrabActive] = theme.accent_hover_color;
}

[[nodiscard]] IconTexture* UI::get_texture(std::string_view id) {
    return m_runtime.resource(id);
}

void UI::process_sdl_event(SDL_Event* event) {
    if (event == nullptr || !m_ready) {
        return;
    }

    const ui::ImGuiContextScope scope(m_context);

    SDL_Event imgui_event = *event;
    if (imgui_event.type == SDL_EVENT_MOUSE_WHEEL) {
        imgui_event.wheel.x *= constants::SCROLL_WHEEL_SCALE;
        imgui_event.wheel.y *= constants::SCROLL_WHEEL_SCALE;
    }

    ImGui_ImplSDL3_ProcessEvent(&imgui_event);

    if (event->type == SDL_EVENT_QUIT ||
        (event->type == SDL_EVENT_WINDOW_CLOSE_REQUESTED && event->window.windowID == window()->id())) {
        exit();
        return;
    }

    std::optional<ui::UiEvent> ui_event = ui::from_sdl_event(*event);
    if (!ui_event.has_value()) {
        return;
    }

    static_cast<void>(input_router().dispatch(*ui_event));
}

void UI::begin_frame() {
    if (!m_ready) {
        return;
    }

    m_previous_context = ImGui::GetCurrentContext();
    ImGui::SetCurrentContext(m_context);
    m_window->make_current();

    m_profiler.begin_frame();

    ImGui_ImplOpenGL3_NewFrame();
    ImGui_ImplSDL3_NewFrame();
    ImGui::NewFrame();
}

void UI::end_frame() {
    if (!m_ready) {
        return;
    }

    ImGui::Render();

    glViewport(0, 0, static_cast<int>(m_io->DisplaySize.x), static_cast<int>(m_io->DisplaySize.y));
    glClearColor(
        m_runtime.theme().background_color.x, m_runtime.theme().background_color.y,
        m_runtime.theme().background_color.z, m_runtime.theme().background_color.w
    );
    glClear(GL_COLOR_BUFFER_BIT);

    ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
    m_profiler.end_frame();
    m_window->swap();

    ImGui::SetCurrentContext(m_previous_context);
    m_previous_context = nullptr;
}
