#include "ui.hpp"
#include "tabs/detail.hpp"
#include "widgets/tab_button.hpp"
#include "theme.hpp"
#include "modal.hpp"
#include "widgets/notification.hpp"
#include "texture/icon.hpp"

#include <algorithm>
#include <format>
#include <imgui_impl_opengl3.h>
#include <imgui_impl_sdl3.h>
#include <filesystem>
#include <iostream>

static const std::string DEFAULT_WARN_SVG = R"(
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="800px"
        height="800px"
        viewBox="0 0 25 25"
        fill="none"
    >
        <path d="M12.5 10V14M12.5 17V15.5M14.2483 5.64697L20.8493 17.5287C21.5899 18.8618 20.6259 20.5 19.101 20.5H5.89903C4.37406 20.5 3.41013 18.8618 4.15072 17.5287L10.7517 5.64697C11.5137 4.27535 13.4863 4.27535 14.2483 5.64697Z" stroke="#ffffff" stroke-width="1.2"/>
    </svg>)";

static constexpr ImGuiWindowFlags WINDOW_FLAGS = ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove |
                                                 ImGuiWindowFlags_NoResize | ImGuiWindowFlags_NoSavedSettings |
                                                 ImGuiWindowFlags_NoBringToFrontOnFocus;

UI::UI(SDL_GLContext* ctx, SDL_Window* window) : m_window(window) {
    float main_scale = SDL_GetDisplayContentScale(SDL_GetPrimaryDisplay());

    ImGui::CreateContext();
    m_io = &ImGui::GetIO();

    m_io->IniFilename = nullptr;
    m_io->LogFilename = nullptr;

    ImGui::StyleColorsDark();

    // setup default theme
    ImGuiStyle& style = ImGui::GetStyle();
    ImVec4* colors = style.Colors;

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

    // initialize textures (svgs)
    const char* textures[] = {"search-icon", "music-icon"};
    std::filesystem::path texture_location = "resources/icons/ui/";

    auto default_texture = std::make_unique<IconTexture>(DEFAULT_WARN_SVG);
    default_texture->get(16, 16);
    default_texture->get(18, 18);
    default_texture->get(32, 32);
    m_textures.emplace("default", std::move(default_texture));

    for (const char* name : textures) {
        std::filesystem::path location = texture_location / std::format("{}.svg", name);
        std::string location_str = location.string();

        std::cout << std::format("[ui] loading svg: {}\n", location_str);
        auto texture = std::make_unique<IconTexture>(location);

        // preload some variants
        texture->get(16, 16);
        texture->get(18, 18);
        texture->get(32, 32);

        m_textures.emplace(name, std::move(texture));
    }

    for (auto& font : m_fonts) {
        font.load(FONT_SMALL);
        font.load(FONT_MEDIUM);
        font.load(FONT_LARGE);
    }

    // create / intitialize tabs
    m_tabs.push_back({TabButtonWidget{this, "osu-stuff", true}, std::make_unique<IndexTab>(this)});
    m_tabs.push_back({TabButtonWidget{this, "collections"}, std::make_unique<CollectionTab>(this)});
    m_tabs.push_back({TabButtonWidget{this, "discover"}, std::make_unique<DiscoverTab>(this)});
    m_tabs.push_back({TabButtonWidget{this, "radio"}, std::make_unique<RadioTab>(this)});
    m_tabs.push_back({TabButtonWidget{this, "config"}, std::make_unique<ConfigTab>(this)});
    m_tabs.push_back({TabButtonWidget{this, "status"}, std::make_unique<StatusTab>(this)});

    m_current_tab = m_tabs.front().second.get();

    for (auto& [button, tab] : m_tabs) {
        button.m_onclick = [this, tab = tab.get()]() { m_current_tab = tab; };
    }
}

void UI::update_counter() {
    const Uint64 now = SDL_GetPerformanceCounter();
    m_counter.frame_count++;

    if (m_counter.last_time == 0) {
        m_counter.last_time = now;
        return;
    }

    const double elapsed_seconds =
        static_cast<double>(now - m_counter.last_time) / static_cast<double>(SDL_GetPerformanceFrequency());

    if (elapsed_seconds >= 1.0) {
        m_counter.current_fps = static_cast<double>(m_counter.frame_count) / elapsed_seconds;
        m_counter.frame_count = 0;
        m_counter.last_time = now;
    }
}

UI::~UI() {
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

void UI::add_notification(std::unique_ptr<UINotification> notification) {
    if (notification == nullptr) {
        return;
    }

    m_notifications.push_back(std::move(notification));
}

UINotification* UI::get_notification(size_t index) {
    if (index >= m_notifications.size()) {
        return nullptr;
    }

    return m_notifications[index].get();
}

const UINotification* UI::get_notification(size_t index) const {
    if (index >= m_notifications.size()) {
        return nullptr;
    }

    return m_notifications[index].get();
}

size_t UI::notification_count() const {
    return m_notifications.size();
}

bool UI::remove_notification(size_t index) {
    if (index >= m_notifications.size()) {
        return false;
    }

    m_notifications.erase(m_notifications.begin() + index);
    return true;
}

void UI::clear_notifications() {
    m_notifications.clear();
}

void UI::process_sdl_event(SDL_Event* event) {
    ImGui_ImplSDL3_ProcessEvent(event);
}

void UI::show_debug_ui() {
    static ImGuiWindowFlags flags = ImGuiWindowFlags_NoSavedSettings;

    ImGui::Begin("##debug-ui", nullptr, flags);
    {
        ImGui::BeginChild("##debug-child", {100, 100}, ImGuiChildFlags_AutoResizeY | ImGuiChildFlags_AutoResizeX);
        {
            ImGui::TextUnformatted(std::format("fps: {}", std::round(get_fps())).c_str());
        }
        ImGui::EndChild();
    }
    ImGui::End();
}

void UI::render() {
    SDL_WindowFlags w_flags = SDL_GetWindowFlags(m_window);

    ImGui_ImplOpenGL3_NewFrame();
    ImGui_ImplSDL3_NewFrame();
    ImGui::NewFrame();

    const ImGuiViewport* viewport = ImGui::GetMainViewport();
    ImFont* torus_bold = m_fonts[TORUS_BOLD].get(FONT_MEDIUM);

    bool window_focused = w_flags & SDL_WINDOW_INPUT_FOCUS;

    if (window_focused && ImGui::IsKeyDown(ImGuiKey_LeftShift) && ImGui::IsKeyPressed(ImGuiKey_D, false)) {
        m_counter.show_ui = !m_counter.show_ui;
    }

    ImGui::SetNextWindowPos(viewport->WorkPos);
    ImGui::SetNextWindowSize(viewport->WorkSize);

    ImGui::PushStyleVar(ImGuiStyleVar_WindowRounding, 0.0f);
    ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, {0.0f, 0.0f});
    ImGui::PushStyleVar(ImGuiStyleVar_WindowBorderSize, 0.0f);

    ImGui::Begin("##osu-stuff", nullptr, WINDOW_FLAGS);
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
        const float header_size_y = font_height + ui_theme::CONTENT_PADDING * 2;

        ImGui::BeginChild(
            "header", ImVec2{available.x, header_size_y}, ImGuiChildFlags_AlwaysUseWindowPadding, ImGuiWindowFlags_None
        );
        {
            ImGui::PushFont(torus_bold);
            {
                for (std::size_t index = 0; index < m_tabs.size(); ++index) {
                    auto& pair = m_tabs[index];

                    TabButtonWidget& button_widget = pair.first;
                    UITab* tab = pair.second.get();

                    if (index > 0) {
                        ImGui::SameLine(0.0f, ui_theme::HEADER_TABS_GAP);
                    }

                    button_widget.show(m_current_tab == tab || index == 0);
                }
            }
            ImGui::PopFont();

            auto* dl = ImGui::GetWindowDrawList();
            dl->Flags |= ImDrawListFlags_AntiAliasedLines;

            ImVec2 header_line_start = {header_cursor_start.x, header_cursor_start.y + header_size_y - 1.0f};
            ImVec2 header_line_end = {available.x, header_line_start.y};

            dl->AddLine(header_line_start, header_line_end, ImColor(ui_theme::HEADER_BORDER_COLOR), 1.0f);
        }
        ImGui::EndChild();
        ImGui::PopStyleVar(3);
        ImGui::PopStyleColor(1);

        ImGui::PushFont(torus_bold);

        if (m_current_tab != nullptr) {
            if (!m_current_tab->is_initialized()) m_current_tab->setup();
            m_current_tab->render();
        }

        ImGui::PopFont();
    }
    ImGui::End();
    ImGui::PopStyleVar(3);

    if (m_counter.show_ui) {
        show_debug_ui();
    }

    ImGui::Render();

    glViewport(0, 0, static_cast<int>(m_io->DisplaySize.x), static_cast<int>(m_io->DisplaySize.y));
    glClearColor(ui_theme::BG_COLOR.x, ui_theme::BG_COLOR.y, ui_theme::BG_COLOR.z, ui_theme::BG_COLOR.w);
    glClear(GL_COLOR_BUFFER_BIT);

    ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
}
