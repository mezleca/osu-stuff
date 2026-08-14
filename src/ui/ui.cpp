#include "ui.hpp"
#include "constants.hpp"
#include "theme.hpp"
#include "texture/icon.hpp"
#include "texture/svg.hpp"

#include <imgui_impl_opengl3.h>
#include <imgui_impl_sdl3.h>
#include <SDL3/SDL_log.h>
#include <filesystem>
#include <iostream>
#include <cstdlib>

namespace fs = std::filesystem;

static UI* current_ui = nullptr;

UI& ui::current() {
    if (current_ui == nullptr) {
        std::abort();
    }

    return *current_ui;
}

UI::UI(ui::Window& window, ui::Config config) : m_debugger(m_root, window) {
    current_ui = this;

    float main_scale = SDL_GetDisplayContentScale(SDL_GetPrimaryDisplay());

    if (ImGui::CreateContext() == nullptr) {
        SDL_Log("ImGui::CreateContext(): failed to create context");
        return;
    }

    m_io = &ImGui::GetIO();

    m_io->IniFilename = nullptr;
    m_io->LogFilename = nullptr;

    ImGui::StyleColorsDark();

    // setup default theme
    ImGuiStyle& style = ImGui::GetStyle();
    ImVec4* colors = style.Colors;

    // ui items / widgets
    style.WindowRounding = 0.0f;
    style.ChildRounding = 0.0f;
    style.FrameRounding = 4.0f;
    style.PopupRounding = 6.0f;
    style.GrabRounding = 4.0f;
    style.TabRounding = 4.0f;
    style.WindowPadding = ImVec2{0.0f, 0.0f};
    style.FramePadding = ImVec2{12.0f, 8.0f};
    style.ItemSpacing = ImVec2{10.0f, 10.0f};
    style.ItemInnerSpacing = ImVec2{8.0f, 6.0f};
    style.CellPadding = ImVec2{0.0f, 0.0f};

    // make lines look normal
    style.CircleTessellationMaxError = 0.10f;
    style.AntiAliasedLinesUseTex = false;

    style.ScaleAllSizes(main_scale);
    style.FontScaleDpi = main_scale;

    ImFontConfig font_cfg;
    font_cfg.PixelSnapH = false;
    font_cfg.OversampleH = 5;
    font_cfg.OversampleV = 5;
    font_cfg.RasterizerMultiply = 1.2f;

    colors[ImGuiCol_WindowBg] = ui_theme::BG_COLOR;
    colors[ImGuiCol_ChildBg] = ui_theme::BG_SECONDARY_COLOR;
    colors[ImGuiCol_Border] = ui_theme::HEADER_BORDER_COLOR;
    colors[ImGuiCol_Separator] = ui_theme::HEADER_BORDER_COLOR;
    colors[ImGuiCol_Text] = ui_theme::TEXT_COLOR;
    colors[ImGuiCol_TextDisabled] = ui_theme::TEXT_SECONDARY_COLOR;
    colors[ImGuiCol_Button] = ui_theme::BG_SECONDARY_COLOR;
    colors[ImGuiCol_ButtonHovered] = ui_theme::BG_TERTIARY_COLOR;
    colors[ImGuiCol_ButtonActive] = ui_theme::BUTTON_ACTIVE_COLOR;
    colors[ImGuiCol_Header] = ui_theme::BG_SECONDARY_COLOR;
    colors[ImGuiCol_HeaderHovered] = ui_theme::BG_TERTIARY_COLOR;
    colors[ImGuiCol_HeaderActive] = ui_theme::BUTTON_ACTIVE_COLOR;
    colors[ImGuiCol_FrameBg] = ui_theme::BG_SECONDARY_COLOR;
    colors[ImGuiCol_FrameBgHovered] = ui_theme::BG_TERTIARY_COLOR;
    colors[ImGuiCol_FrameBgActive] = ui_theme::BUTTON_ACTIVE_COLOR;
    colors[ImGuiCol_TitleBg] = ui_theme::BG_SECONDARY_COLOR;
    colors[ImGuiCol_TitleBgActive] = ui_theme::BG_SECONDARY_COLOR;
    colors[ImGuiCol_CheckMark] = ui_theme::ACCENT_COLOR;
    colors[ImGuiCol_SliderGrab] = ui_theme::ACCENT_COLOR;
    colors[ImGuiCol_SliderGrabActive] = ui_theme::ACCENT_HOVER_COLOR;

#ifndef NDEBUG
    m_debugger.set_style(style);
#endif

    if (!ImGui_ImplSDL3_InitForOpenGL(window.handle(), window.context())) {
        SDL_Log("ImGui_ImplSDL3_InitForOpenGL(): failed to initialize");
        ImGui::DestroyContext();
        m_io = nullptr;
        return;
    }

    if (!ImGui_ImplOpenGL3_Init("#version 300 es")) {
        SDL_Log("ImGui_ImplOpenGL3_Init(): failed to initialize");
        ImGui_ImplSDL3_Shutdown();
        ImGui::DestroyContext();
        m_io = nullptr;
        return;
    }

    m_ready = true;

    // initialize / preload font variations
    for (std::size_t index = 0; index < static_cast<size_t>(ui::FontType::FONT_COUNT); ++index) {
        m_fonts[index].initialize(font_cfg, config.font_paths[index].string(), m_io);
    }

    // load textures (svgs)
    fs::path textures_location = config.icon_path;

    m_textures.emplace("default", std::make_unique<IconTexture>(DEFAULT_WARN_SVG));

    if (fs::exists(textures_location)) {
        for (const auto& entry : fs::directory_iterator(textures_location)) {
            auto path = entry.path();

            if (!fs::is_regular_file(entry.status())) continue;
            if (path.extension() != ".svg") continue;

            auto texture = std::make_unique<IconTexture>(path);

            texture->get(constants::TEXTURE_SMALL);
            texture->get(constants::TEXTURE_MEDIUM);
            texture->get(constants::TEXTURE_BIG);
            texture->get(constants::TEXTURE_EXTRA_BIG);

            if (texture->get_id() == "") {
                std::cout << "[warn] failed to get class id from " << path.string() << "\n";
                continue;
            }

            if (!m_textures.emplace(texture->get_id(), std::move(texture)).second) {
                std::cout << "[warn] duplicate icon id, skipping " << path.string() << "\n";
            }
        }
    }

#ifndef NDEBUG
    m_debugger.set_icon(get_texture("circle-icon"));
    m_debugger.set_close_icon(get_texture("x-icon"));
    m_debugger.set_font(
        config.font_paths[static_cast<size_t>(ui::FontType::REGULAR)].string(), ui::FONT_MEDIUM, font_cfg
    );
    m_debugger.set_bold_font(
        config.font_paths[static_cast<size_t>(ui::FontType::BOLD)].string(), ui::FONT_MEDIUM, font_cfg
    );
#endif

    // load font variants
    for (auto& font : m_fonts) {
        font.load(ui::FONT_SMALL);
        font.load(ui::FONT_MEDIUM);
        font.load(ui::FONT_LARGE);
    }
}

UI::~UI() {
    current_ui = nullptr;

#ifndef NDEBUG
    m_debugger.shutdown();
#endif
    if (!m_ready) {
        return;
    }

    ImGui_ImplOpenGL3_Shutdown();
    ImGui_ImplSDL3_Shutdown();
    ImGui::DestroyContext();
}

[[nodiscard]] IconTexture* UI::get_texture(std::string_view id) {
    auto it = m_textures.find(std::string{id});

    if (it == m_textures.end()) {
        std::cout << "[ui] failed to find " << id << " (returning default svg)\n";
        return m_textures.at("default").get();
    }

    return it->second.get();
}

void UI::process_sdl_event(SDL_Event* event) {
    if (event == nullptr || !m_ready) {
        return;
    }

    ImGui_ImplSDL3_ProcessEvent(event);
#ifndef NDEBUG
    m_debugger.process_event(event);
#endif

    // imgui keeps native input state.
    // the router receives a copy for focused nodes.
    ui::UiEvent ui_event = ui::UiEvent::make(ui::EventType::Cancel);
    bool should_dispatch = true;

    switch (event->type) {
        case SDL_EVENT_KEY_DOWN:
            ui_event.type = ui::EventType::KeyDown;
            ui_event.key = event->key.key;
            break;
        case SDL_EVENT_KEY_UP:
            ui_event.type = ui::EventType::KeyUp;
            ui_event.key = event->key.key;
            break;
        case SDL_EVENT_TEXT_INPUT:
            ui_event.type = ui::EventType::TextInput;
            ui_event.text = event->text.text != nullptr ? event->text.text : "";
            break;
        default:
            should_dispatch = false;
            break;
    }

    if (!should_dispatch) {
        return;
    }

    const bool handled = m_root.input_router().dispatch(ui_event);

    if (event->type == SDL_EVENT_KEY_DOWN && event->key.key == SDLK_ESCAPE && !handled) {
        ui_event = ui::UiEvent::make(ui::EventType::Cancel);
        ui_event.key = event->key.key;
        const bool cancel_handled = m_root.input_router().dispatch(ui_event);
        static_cast<void>(cancel_handled);
    }
}

void UI::begin_frame() {
    if (!m_ready) {
        return;
    }

    ImGui_ImplOpenGL3_NewFrame();
    ImGui_ImplSDL3_NewFrame();
    ImGui::NewFrame();
    m_root.begin_frame();

#ifndef NDEBUG
    // update debugger
    m_debugger.update();
#endif
}

void UI::end_frame() {
    if (!m_ready) {
        return;
    }

#ifndef NDEBUG
    m_debugger.render();
#endif

    ImGui::Render();

    glViewport(0, 0, static_cast<int>(m_io->DisplaySize.x), static_cast<int>(m_io->DisplaySize.y));
    glClearColor(ui_theme::BG_COLOR.x, ui_theme::BG_COLOR.y, ui_theme::BG_COLOR.z, ui_theme::BG_COLOR.w);
    glClear(GL_COLOR_BUFFER_BIT);

    ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
}
