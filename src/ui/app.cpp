#include "app.hpp"
#include "managers/notifications.hpp"
#include "theme.hpp"
#include "tabs/detail.hpp"
#include "../utils/log.hpp"
#include "widgets/tab-button.hpp"

#include <ui/diagnostics/debugger.hpp>
#include <ui/layout/container.hpp>
#include <ui/layout/stack-container.hpp>
#include <cstdlib>
#include <string_view>
#include <utility>

using namespace ui;

static bool debugger_enabled_from_env() {
    const char* value = std::getenv("ENABLE_DEBUGGER");
    return value != nullptr && std::string_view{value} == "1";
}

class AppHeaderNode final : public StackContainer {
public:
    AppHeaderNode(UI& ui, float& height) : StackContainer("header", StackDirection::Horizontal), m_height(height) {
        set_size({grow(), fit()});
        ImFont* font = ui.get_font("Torus Bold", 20);
        set_font(font);
        set_spacing(HEADER_TABS_GAP);

        const Theme& theme = ui.theme();
        configure_all_styles([&theme](Style& style) {
            style.padding({theme.content_padding, theme.content_padding})
                .background_color(theme.header_background_color)
                .border(BORDER_BOTTOM)
                .border_color(theme.header_border_color);
        });
    }

protected:
    void on_measure() override {
        StackContainer::on_measure();
        m_height = layout().intrinsic_size().y;
    }

private:
    float& m_height;
};

class AppContentNode final : public Container {
public:
    explicit AppContentNode(UI& ui) : Container("content") {
        set_font(ui.get_font("Torus Regular", 20));
        configure_all_styles([](Style& style) { style.padding({0.0F, 0.0F}); });
    }
};

class AppLayoutNode final : public StackContainer {
public:
    AppLayoutNode() : StackContainer("app-layout", StackDirection::Vertical) {}
};

AppUI::AppUI(Runtime& runtime, std::unique_ptr<Backend> backend)
    : m_ui(runtime, {.backend = std::move(backend), .enable_debugger = debugger_enabled_from_env()}) {
    if (!m_ui.ready()) {
        LOG_ERROR("[App]: UI failed to initialize, app will not run");
        return;
    }

    m_ui.set_primary_font(runtime.fonts().find("Torus SemiBold"));
    m_ui.set_secondary_font(runtime.fonts().find("Torus SemiBold"));

    auto& app_layout = m_ui.root().add<AppLayoutNode>();
    auto& header = app_layout.add<AppHeaderNode>(m_ui, m_header_end_height);
    auto& content = app_layout.add<AppContentNode>(m_ui);
    auto& notification_manager = m_ui.root().add<UINotificationManager>(m_ui);

    m_notification_manager = &notification_manager;

    const auto add_tab = [this](TabButtonWidget& button, UITab& tab) {
        tab.set_visible(false);
        m_tabs.push_back({&button, &tab});
    };

    add_tab(
        header.add<TabButtonWidget>(m_ui, "osu-stuff", false, true), content.add<IndexTab>(m_ui, m_tasks, notification_manager)
    );
    add_tab(header.add<TabButtonWidget>(m_ui, "collections"), content.add<CollectionTab>(m_ui));
    add_tab(header.add<TabButtonWidget>(m_ui, "discover"), content.add<DiscoverTab>(m_ui));
    add_tab(header.add<TabButtonWidget>(m_ui, "radio"), content.add<RadioTab>(m_ui));
    add_tab(header.add<TabButtonWidget>(m_ui, "config"), content.add<ConfigTab>(m_ui));
    add_tab(header.add<TabButtonWidget>(m_ui, "status"), content.add<StatusTab>(m_ui));

    UITab& initial_tab = *m_tabs.front().tab;
    m_tabs.front().button->set_selected(true);
    initial_tab.set_visible(true);

    for (auto& entry : m_tabs) {
        entry.button->set_on_event([this, current_tab = entry.tab](UiEvent& event) {
            if (event.type != EventType::Click) {
                return;
            }

            for (auto& entry : m_tabs) {
                entry.button->set_selected(entry.tab == current_tab);
                entry.tab->set_visible(entry.tab == current_tab);
            }
            event.mark_handled();
        });
    }

    if (m_ui.debugger() != nullptr) {
        LOG_INFO("[App]: initializing UI debugger");
        configure_debugger();
    }
}

AppUI::~AppUI() = default;

void AppUI::configure_debugger() {
    Debugger* debugger = m_ui.debugger();
    if (debugger == nullptr) {
        return;
    }

    debugger->set_font("Torus Regular", 20);
}

bool AppUI::ready() const {
    return m_ui.ready();
}

bool AppUI::done() const {
    return m_ui.is_done();
}

void AppUI::process_sdl_event(SDL_Event* event) {
    if (event == nullptr || !ready()) {
        return;
    }

    ui::process_sdl_event(m_ui, *event);
}

void AppUI::render() {
    if (!ready()) {
        return;
    }

    m_ui.begin_frame();
    m_tasks.drain();
    const float dt = ImGui::GetIO().DeltaTime;

    m_notification_manager->set_header_height(m_header_end_height);

    m_ui.update(dt);
    m_ui.draw();

    m_ui.end_frame();
}
