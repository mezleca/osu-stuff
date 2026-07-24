#include "ui.hpp"
#include "managers/notification-manager.hpp"
#include "constants.hpp"
#include "tabs/detail.hpp"
#include "widgets/tab-button.hpp"
#include "theme.hpp"
#include "modal.hpp"
#include "texture/icon.hpp"
#include "texture/svg.hpp"

#include <algorithm>
#include <format>
#include <imgui_impl_opengl3.h>
#include <imgui_impl_sdl3.h>
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

UI::UI(SDL_GLContext* ctx, SDL_Window* window) : m_window(window) {
    current_ui = this;

    float main_scale = SDL_GetDisplayContentScale(SDL_GetPrimaryDisplay());

    ImGui::CreateContext();
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

    ImGui_ImplSDL3_InitForOpenGL(window, ctx);
    ImGui_ImplOpenGL3_Init("#version 300 es");

    // initialize / preload font variations
    m_fonts[TORUS].initialize(font_cfg, "resources/fonts/Torus-Regular.ttf", m_io);
    m_fonts[TORUS_SEMI].initialize(font_cfg, "resources/fonts/Torus-SemiBold.ttf", m_io);
    m_fonts[TORUS_BOLD].initialize(font_cfg, "resources/fonts/Torus-Bold.ttf", m_io);

    // load textures (svgs)
    fs::path textures_location = "resources/icons/ui/";

    m_textures.emplace("default", std::make_unique<IconTexture>(DEFAULT_WARN_SVG));

    if (fs::exists(textures_location)) {
        for (const auto& entry : fs::directory_iterator(textures_location)) {
            auto path = entry.path();

            if (!fs::is_regular_file(entry.status())) continue;
            if (path.extension() != ".svg") continue;

            auto texture = std::make_unique<IconTexture>(path);

            texture->get(16, 16);
            texture->get(18, 18);
            texture->get(32, 32);

            if (texture->get_id() == "") {
                std::cout << "[warn] failed to get class id from " << path.string() << "\n";
            }

            m_textures.emplace(texture->get_id(), std::move(texture));
        }
    }

    // load font variants
    for (auto& font : m_fonts) {
        font.load(FONT_SMALL);
        font.load(FONT_MEDIUM);
        font.load(FONT_LARGE);
    }

    // create / intitialize tabs
    m_tabs.push_back({TabButtonWidget{"osu-stuff", false, true}, std::make_unique<IndexTab>()});
    m_tabs.push_back({TabButtonWidget{"collections"}, std::make_unique<CollectionTab>()});
    m_tabs.push_back({TabButtonWidget{"discover"}, std::make_unique<DiscoverTab>()});
    m_tabs.push_back({TabButtonWidget{"radio"}, std::make_unique<RadioTab>()});
    m_tabs.push_back({TabButtonWidget{"config"}, std::make_unique<ConfigTab>()});
    m_tabs.push_back({TabButtonWidget{"status"}, std::make_unique<StatusTab>()});

    m_current_tab = m_tabs.front().second.get();

    for (auto& [button, tab] : m_tabs) {
        button.m_onclick = [this, cur_tab = tab.get()]() {
            for (auto& [widget, tab] : m_tabs) {
                widget.set_selected(tab.get() == cur_tab);
            }

            m_current_tab = cur_tab;
        };
    }

    m_notification_manager = new UINotificationManager();
}

UI::~UI() {
    current_ui = nullptr;
    m_notification_manager = nullptr;
    m_current_tab = nullptr;

    ImGui_ImplOpenGL3_Shutdown();
    ImGui_ImplSDL3_Shutdown();
    ImGui::DestroyContext();
}

void UIDebug::update() {
    const Uint64 now = SDL_GetPerformanceCounter();
    m_frame_count++;

    if (m_last_time == 0) {
        m_last_time = now;
        return;
    }

    const double elapsed_seconds =
        static_cast<double>(now - m_last_time) / static_cast<double>(SDL_GetPerformanceFrequency());

    if (elapsed_seconds >= 1.0) {
        m_current_fps = static_cast<double>(m_frame_count) / elapsed_seconds;
        m_frame_count = 0;
        m_last_time = now;
    }
}

void UIDebug::handle_keydown(SDL_Window* window) {
    SDL_WindowFlags window_flags = SDL_GetWindowFlags(window);
    bool window_focused = window_flags & SDL_WINDOW_INPUT_FOCUS;

    if (window_focused && ImGui::IsKeyDown(ImGuiKey_LeftShift) && ImGui::IsKeyPressed(ImGuiKey_D, false)) {
        m_show_ui = !m_show_ui;
    }
}

void UIDebug::render() {
    if (!m_show_ui) {
        return;
    }

    ImGui::Begin("##debug-ui", nullptr, ImGuiWindowFlags_NoSavedSettings);
    {
        ImGui::BeginChild("##debug-child", {100, 100}, ImGuiChildFlags_AutoResizeY | ImGuiChildFlags_AutoResizeX);
        {
            ImGui::TextUnformatted(std::format("fps: {}", std::round(get_fps())).c_str());
        }
        ImGui::EndChild();
    }
    ImGui::End();
}

[[nodiscard]] IconTexture* UI::get_texture(std::string_view id) {
    auto it = m_textures.find(std::string{id});

    if (it == m_textures.end()) {
        std::cout << "[ui] failed to find " << id << " (returning default svg)\n";
        return m_textures.at("default").get();
    }

    return it->second.get();
}

bool UI::is_modal_focused(UIModal* modal) const {
    if (m_modals.empty()) {
        return false;
    }

    return m_modals.back().get() == modal;
}

bool UI::has_modal(std::string_view id) const {
    return std::any_of(m_modals.begin(), m_modals.end(), [id](const auto& modal) { return modal->id() == id; });
}

UIModal* UI::focused_modal() const {
    if (m_modals.empty()) {
        return nullptr;
    }

    return m_modals.back().get();
}

size_t UI::modal_count() const {
    return m_modals.size();
}

void UI::show_modal(std::unique_ptr<UIModal> modal, bool wipe) {
    if (modal == nullptr) {
        return;
    }

    if (wipe) {
        clear_modals();
    }

    m_modals.push_back(std::move(modal));
}

bool UI::remove_modal(std::string_view id) {
    bool removed = false;

    for (auto it = m_modals.begin(); it != m_modals.end();) {
        UIModal* modal = it->get();

        if (modal->id() != id) {
            it++;
            continue;
        }

        modal->on_remove();
        it = m_modals.erase(it);
        removed = true;
    }

    return removed;
}

bool UI::remove_focused_modal() {
    UIModal* modal = focused_modal();

    if (modal == nullptr) {
        return false;
    }

    modal->on_remove();
    m_modals.pop_back();
    return true;
}

void UI::clear_modals() {
    for (const auto& modal : m_modals) {
        modal->on_remove();
    }

    m_modals.clear();
}

void UI::handle_escape() {
    if (!ImGui::IsKeyDown(ImGuiKey_Escape)) {
        return;
    }

    UIModal* modal = focused_modal();

    if (modal != nullptr) {
        modal->on_escape();
        return;
    }
}

void UI::draw_child_rect(ImColor color, float radius, float thickness) {
    const ImVec2 win_pos = ImGui::GetWindowPos();
    const ImVec2 win_size = ImGui::GetWindowSize();

    auto* dl = ImGui::GetWindowDrawList();
    dl->AddRect(win_pos, ImVec2(win_pos.x + win_size.x, win_pos.y + win_size.y), color, radius, 0, thickness);
}

void UI::process_sdl_event(SDL_Event* event) {
    ImGui_ImplSDL3_ProcessEvent(event);
}

void UI::render() {
    ImGui_ImplOpenGL3_NewFrame();
    ImGui_ImplSDL3_NewFrame();
    ImGui::NewFrame();

    // update debugger
    m_debug.handle_keydown(m_window);
    m_debug.update();

    const ImGuiViewport* viewport = ImGui::GetMainViewport();
    ImFont* torus_bold = m_fonts[TORUS_BOLD].get(FONT_MEDIUM);

    float header_end_height = 0.0f;

    ImGui::SetNextWindowPos(viewport->WorkPos);
    ImGui::SetNextWindowSize(viewport->WorkSize);

    ImGui::PushStyleVar(ImGuiStyleVar_WindowRounding, 0.0f);
    ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, {0.0f, 0.0f});
    ImGui::PushStyleVar(ImGuiStyleVar_WindowBorderSize, 0.0f);

    ImGui::PushStyleColor(ImGuiCol_WindowBg, ui_theme::BG_COLOR);

    // render ui content
    ImGui::Begin("##osu-stuff", nullptr, constants::WINDOW_FLAGS);
    {
        const ImVec2 available = ImGui::GetContentRegionAvail();

        ImGui::PushFont(torus_bold);
        const float font_height = ImGui::GetFrameHeight();
        ImGui::PopFont();

        // header
        ImGui::PushStyleColor(ImGuiCol_ChildBg, ui_theme::HEADER_BG_COLOR);
        ImGui::PushStyleVar(ImGuiStyleVar_ChildRounding, 0.0f);
        ImGui::PushStyleVar(ImGuiStyleVar_ItemSpacing, ImVec2(0.0f, 0.0f));
        ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, {ui_theme::CONTENT_PADDING, ui_theme::CONTENT_PADDING});

        const ImVec2 header_cursor_start = ImGui::GetCursorPos();
        header_end_height = font_height + ui_theme::CONTENT_PADDING * 2;

        ImGui::BeginChild(
            "header", ImVec2{available.x, header_end_height}, ImGuiChildFlags_AlwaysUseWindowPadding,
            ImGuiWindowFlags_None
        );
        {
            ImGui::PushFont(torus_bold);
            {
                for (std::size_t index = 0; index < m_tabs.size(); ++index) {
                    auto& pair = m_tabs[index];

                    TabButtonWidget& button_widget = pair.first;

                    if (index > 0) {
                        ImGui::SameLine(0.0f, ui_theme::HEADER_TABS_GAP);
                    }

                    button_widget.show();
                }
            }
            ImGui::PopFont();

            auto* dl = ImGui::GetWindowDrawList();

            ImVec2 header_line_start = {header_cursor_start.x, header_cursor_start.y + header_end_height - 1.0f};
            ImVec2 header_line_end = {available.x, header_line_start.y};

            dl->AddLine(header_line_start, header_line_end, ImColor(ui_theme::HEADER_BORDER_COLOR), 1.0f);
        }
        ImGui::EndChild();
        ImGui::PopStyleVar(3);
        ImGui::PopStyleColor(1);

        ImGui::PushFont(torus_bold);

        // render current tab
        if (m_current_tab != nullptr) {
            if (!m_current_tab->is_initialized()) m_current_tab->setup();
            m_current_tab->render();
        }

        ImGui::PopFont();
    }
    ImGui::End();
    ImGui::PopStyleColor(1);
    ImGui::PopStyleVar(3);

    ImGui::SetNextWindowPos(viewport->WorkPos);
    ImGui::SetNextWindowSize(viewport->WorkSize);
    ImGui::SetNextWindowBgAlpha(0.0f);

    // render notifications
    ImGui::Begin("##notifications-overlay", nullptr, constants::NOTIFICATION_OVERLAY_FLAGS);
    {
        const ImVec2 window_pos = ImGui::GetWindowPos();
        const ImVec2 available = ImGui::GetContentRegionAvail();

        m_notification_manager->set_offset({window_pos.x + available.x - 5.0f, header_end_height + 10.0f});
        m_notification_manager->render();
    }
    ImGui::End();

    // render debug ui
    m_debug.render();

    ImGui::Render();

    glViewport(0, 0, static_cast<int>(m_io->DisplaySize.x), static_cast<int>(m_io->DisplaySize.y));
    glClearColor(ui_theme::BG_COLOR.x, ui_theme::BG_COLOR.y, ui_theme::BG_COLOR.z, ui_theme::BG_COLOR.w);
    glClear(GL_COLOR_BUFFER_BIT);

    ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
}
