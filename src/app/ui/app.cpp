#include "app.hpp"
#include "managers/notifications.hpp"
#include "theme.hpp"
#include "tabs/detail.hpp"
#include "widgets/tab-button.hpp"

#include "../../ui/diagnostics/debugger.hpp"
#include "../../ui/constants.hpp"
#include "../../ui/imgui/context-scope.hpp"
#include "../../ui/layout/child-container.hpp"

#include <SDL3/SDL_log.h>
#include <algorithm>

using namespace app;

class AppHeaderNode final : public ui::ChildContainer {
public:
    AppHeaderNode(UI& ui, float& height) : ui::ChildContainer("header"), m_ui(ui), m_height(height) {
        set_font(m_ui.get_font(ui::FontType::BOLD).get(ui::FONT_MEDIUM));
        const ui::Theme& theme = m_ui.theme();
        state().configure_all_styles([&theme](ui::Style& style) {
            style.padding({theme.content_padding, theme.content_padding})
                .background_color(theme.header_background_color)
                .border(ui::BORDER_BOTTOM)
                .border_color(theme.header_border_color);
        });
    }

protected:
    void on_layout() override {
        ImFont* font = m_ui.get_font(ui::FontType::BOLD).get(ui::FONT_MEDIUM);
        const ui::Theme& theme = m_ui.theme();
        ImGui::PushFont(font);
        m_height = ImGui::GetFrameHeight() + theme.content_padding * 2.0F;
        ImGui::PopFont();

        set_size({ImGui::GetContentRegionAvail().x, m_height});
    }

    void draw_children() override {
        for (std::size_t index = 0; index < children().size(); ++index) {
            if (index > 0) {
                ImGui::SameLine(0.0F, app_theme::HEADER_TABS_GAP);
            }

            children()[index]->draw();
        }
    }

private:
    UI& m_ui;
    float& m_height;
};

class AppContentNode final : public ui::ChildContainer {
public:
    explicit AppContentNode(UI& ui) : ui::ChildContainer("content") {
        set_font(ui.get_font(ui::FontType::REGULAR).get(ui::FONT_MEDIUM));
        state().configure_all_styles([](ui::Style& style) { style.padding({0.0F, 0.0F}); });
    }
};

class AppLayoutNode final : public ui::Node {
public:
    explicit AppLayoutNode(float& header_height) : ui::Node("app-layout"), m_header_height(header_height) {}

    void on_layout() override {
        layout().set_size(ImGui::GetContentRegionAvail());
    }

    void draw_children() override {
        if (children().empty()) {
            return;
        }

        ImGui::PushStyleVar(ImGuiStyleVar_ItemSpacing, {0.0F, 0.0F});
        children().front()->draw();
        ImGui::PopStyleVar();
        if (children().size() < 2) {
            return;
        }

        Node& content = *children()[1];
        const ImVec2 content_size = {layout().size().x, std::max(0.0F, layout().size().y - m_header_height)};
        content.layout().set_size(content_size);
        content.layout().set_anchor(ui::Anchor::TopLeft);
        content.layout().set_origin(ui::Origin::TopLeft);
        content.layout().set_offset({0.0F, m_header_height});
        content.draw();
    }

private:
    float& m_header_height;
};

OsuStuffApp::OsuStuffApp(ui::Runtime& runtime, ui::Config config) : m_ui(runtime, std::move(config)) {
    if (!m_ui.ready()) {
        SDL_Log("[OsuStuffApp]: UI failed to initialize, app will not run");
        return;
    }

    auto& app_layout = m_ui.root().add_child<AppLayoutNode>(m_header_end_height);
    auto& header = app_layout.add_child<AppHeaderNode>(m_ui, m_header_end_height);
    auto& content = app_layout.add_child<AppContentNode>(m_ui);
    auto& notification_manager = m_ui.root().add_child<UINotificationManager>(m_ui);
    notification_manager.set_input_layer(ui::InputLayer::Notification);
    m_notification_manager = &notification_manager;

    const auto add_tab = [this](TabButtonWidget& button, UITab& tab) {
        tab.set_visible(false);
        m_tabs.push_back({&button, &tab});
    };

    add_tab(
        header.add_child<TabButtonWidget>(m_ui, "osu-stuff", false, true),
        content.add_child<IndexTab>(m_ui, notification_manager)
    );
    add_tab(header.add_child<TabButtonWidget>(m_ui, "collections"), content.add_child<CollectionTab>(m_ui));
    add_tab(header.add_child<TabButtonWidget>(m_ui, "discover"), content.add_child<DiscoverTab>(m_ui));
    add_tab(header.add_child<TabButtonWidget>(m_ui, "radio"), content.add_child<RadioTab>(m_ui));
    add_tab(header.add_child<TabButtonWidget>(m_ui, "config"), content.add_child<ConfigTab>(m_ui));
    add_tab(header.add_child<TabButtonWidget>(m_ui, "status"), content.add_child<StatusTab>(m_ui));

    UITab& initial_tab = *m_tabs.front().tab;
    initial_tab.setup();
    m_tabs.front().button->set_selected(true);
    initial_tab.set_visible(true);

    for (auto& entry : m_tabs) {
        entry.button->on_event = [this, current_tab = entry.tab](ui::UiEvent& event) {
            if (event.type != ui::EventType::Click) {
                return;
            }

            if (!current_tab->is_initialized()) {
                current_tab->setup();
            }

            for (auto& entry : m_tabs) {
                entry.button->set_selected(entry.tab == current_tab);
                entry.tab->set_visible(entry.tab == current_tab);
            }
            event.mark_handled();
        };
    }

    if constexpr (constants::IS_DEBUG_BUILD) {
        SDL_Log("[OsuStuffApp]: initializing UI debugger");
        setup_debugger();
    }
}

OsuStuffApp::~OsuStuffApp() = default;

void OsuStuffApp::setup_debugger() {
    m_debugger = std::make_unique<ui::Debugger>(m_ui);
    m_debugger->setup();

    if (!m_debugger->ready()) {
        SDL_Log("[OsuStuffApp]: failed to initialize the debugger window, continuing without it");
        m_debugger.reset();
        return;
    }

    const ui::ImGuiContextScope scope(m_ui.imgui_context());

    m_debugger->set_style(ImGui::GetStyle());
    m_debugger->set_icon(m_ui.get_texture("inspect-icon"));
    m_debugger->set_font(ui::FontType::REGULAR, ui::FONT_MEDIUM);
}

bool OsuStuffApp::ready() const {
    return m_ui.ready();
}

bool OsuStuffApp::done() const {
    return m_ui.is_done();
}

void OsuStuffApp::process_sdl_event(SDL_Event* event) {
    if (event == nullptr || !ready()) {
        return;
    }

    if (m_debugger && m_debugger->process_sdl_event(event)) {
        return;
    }

    m_ui.runtime().process_sdl_event(event);
}

void OsuStuffApp::render() {
    if (!ready()) {
        return;
    }

    m_ui.begin_frame();

    if (m_debugger) {
        m_debugger->update();
    }

    m_notification_manager->set_header_height(m_header_end_height);
    m_ui.root().update(ImGui::GetIO().DeltaTime);
    m_ui.root().draw();

    if (m_debugger) {
        m_debugger->draw_highlight();
    }

    m_ui.end_frame();

    if (m_debugger) {
        m_debugger->render();
    }
}
