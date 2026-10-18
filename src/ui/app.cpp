#include "app.hpp"
#include "managers/notifications.hpp"
#include "theme.hpp"
#include "tabs/detail.hpp"
#include "../utils/log.hpp"
#include "widgets/tab-button.hpp"

#include <imgui-ui/runtime.hpp>
#include <imgui-ui/diagnostics/debugger.hpp>
#include <imgui-ui/layout/container.hpp>
#include <cstdlib>
#include <string_view>
#include <utility>

using namespace ui;

static bool debugger_enabled_from_env() {
    const char* value = std::getenv("ENABLE_DEBUGGER");
    return value != nullptr && std::string_view{value} == "1";
}

class AppHeaderNode final : public Container {
public:
    explicit AppHeaderNode(float& height) : Container("header", StackDirection::Horizontal), m_height(height) {
        set_size({grow(), fit()});
        set_spacing(HEADER_TABS_GAP);
    }

protected:
    void apply_theme_defaults(const Theme& theme) override {
        Container::apply_theme_defaults(theme);
        set_font(surface().get_font("Torus Bold"), 20.0F);
        configure_all_styles([&theme](Style& style) {
            style.padding({12.0F, 12.0F})
                .background_color(theme.header_background_color)
                .border_bottom(1.0F)
                .border_color(theme.header_border_color);
        });
    }

    void on_measure() override {
        Container::on_measure();
        m_height = layout().intrinsic_size().y;
    }

private:
    float& m_height;
};

class AppContentNode final : public Container {
public:
    AppContentNode() : Container("content") {
        configure_all_styles([](Style& style) { style.padding({0.0F, 0.0F}); });
    }

protected:
    void apply_theme_defaults(const Theme& theme) override {
        Container::apply_theme_defaults(theme);
        set_font(surface().get_font("Torus Regular"), 20.0F);
    }
};

class AppLayoutNode final : public Container {
public:
    AppLayoutNode() : Container("app-layout", StackDirection::Vertical) {}
};

AppUI::AppUI(Runtime& runtime, std::unique_ptr<Backend> backend)
    : m_ui(
          runtime, {.backend = std::move(backend), .enable_debugger = debugger_enabled_from_env(), .file_dialog_backend = nullptr}
      ) {
    m_ui.set_primary_font(runtime.fonts().find("Torus SemiBold"));

    auto& app_layout = m_ui.root().add<AppLayoutNode>();
    auto& header = app_layout.add<AppHeaderNode>(m_header_end_height);
    auto& content = app_layout.add<AppContentNode>();
    auto& notification_manager = m_ui.root().add<UINotificationManager>();

    m_notification_manager = &notification_manager;

    const auto add_tab = [this](TabButtonWidget& button, UITab& tab) {
        tab.set_visible(false);
        m_tabs.push_back({&button, &tab});
    };

    add_tab(header.add<TabButtonWidget>("osu-stuff", false, true), content.add<IndexTab>(m_tasks, notification_manager));
    add_tab(header.add<TabButtonWidget>("collections"), content.add<CollectionTab>());
    add_tab(header.add<TabButtonWidget>("discover"), content.add<DiscoverTab>());
    add_tab(header.add<TabButtonWidget>("radio"), content.add<RadioTab>());
    add_tab(header.add<TabButtonWidget>("config"), content.add<ConfigTab>());
    add_tab(header.add<TabButtonWidget>("status"), content.add<StatusTab>());

    UITab& initial_tab = *m_tabs.front().tab;
    m_tabs.front().button->set_selected(true);
    initial_tab.set_visible(true);

    for (auto& entry : m_tabs) {
        entry.button->on_event([this, current_tab = entry.tab](UiEvent& event) {
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

void AppUI::configure_debugger() {
    Debugger* debugger = m_ui.debugger();
    if (debugger == nullptr) {
        return;
    }

    debugger->set_font("Torus Regular", 20);
}

bool AppUI::done() const {
    return m_ui.is_done();
}

void AppUI::process_events() {
    m_ui.process_events();
}

void AppUI::render() {
    m_ui.begin_frame();
    m_tasks.drain();
    const float dt = ImGui::GetIO().DeltaTime;

    m_notification_manager->set_header_height(m_header_end_height);

    m_ui.update(dt);
    m_ui.draw();

    m_ui.end_frame();
}
