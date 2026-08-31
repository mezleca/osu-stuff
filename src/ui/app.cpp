#include "app.hpp"
#include "managers/notifications.hpp"
#include "theme.hpp"
#include "tabs/detail.hpp"
#include "../utils/log.hpp"
#include "widgets/tab-button.hpp"

#include <ui/backends/sdl/debugger.hpp>
#include <ui/constants.hpp>
#include <ui/imgui/context-scope.hpp>
#include <ui/layout/child-container.hpp>
#include <ui/layout/stack-container.hpp>
#include <algorithm>

using namespace app;

class AppHeaderNode final : public ui::StackContainer {
public:
    AppHeaderNode(UI& ui, float& height) : ui::StackContainer("header", ui::StackDirection::Horizontal), m_height(height) {
        ImFont* font = ui.get_font(ui::FontType::BOLD).get(ui::FONT_MEDIUM);
        set_font(font);
        set_spacing(app::HEADER_TABS_GAP);

        const ui::Theme& theme = ui.theme();
        configure_all_styles([&theme](ui::Style& style) {
            style.padding({theme.content_padding, theme.content_padding})
                .background_color(theme.header_background_color)
                .border(ui::BORDER_BOTTOM)
                .border_color(theme.header_border_color);
        });
    }

protected:
    void on_layout() override {
        float tab_height = 0.0F;
        for (const auto& child : children()) {
            if (child->visible()) {
                tab_height = std::max(tab_height, child->layout().size().y);
            }
        }

        m_height = tab_height + style().padding().y * 2.0F;

        resolve_size({ImGui::GetContentRegionAvail().x, m_height});
        ui::StackContainer::on_layout();
    }

private:
    float& m_height;
};

class AppContentNode final : public ui::ChildContainer {
public:
    explicit AppContentNode(UI& ui) : ui::ChildContainer("content") {
        set_font(ui.get_font(ui::FontType::REGULAR).get(ui::FONT_MEDIUM));
        configure_all_styles([](ui::Style& style) { style.padding({0.0F, 0.0F}); });
    }
};

class AppLayoutNode final : public ui::Node {
public:
    explicit AppLayoutNode(float& header_height) : ui::Node("app-layout"), m_header_height(header_height) {}

    void on_layout() override {
        resolve_size(ImGui::GetContentRegionAvail());
    }

    void draw_children() override {
        if (children().empty()) {
            return;
        }

        children().front()->draw();
        if (children().size() < 2) {
            return;
        }

        ui::Node& content = *children()[1];
        const ImVec2 content_size = {layout().size().x, std::max(0.0F, layout().size().y - m_header_height)};
        arrange_child(content, content_size, ui::Anchor::TopLeft, ui::Origin::TopLeft, {0.0F, m_header_height});
        content.draw();
    }

private:
    float& m_header_height;
};

AppUI::AppUI(ui::Runtime& runtime, const ui::Config& config) : m_ui(runtime, config) {
    if (!m_ui.ready()) {
        LOG_ERROR("[App]: UI failed to initialize, app will not run");
        return;
    }

    m_ui.set_primary_font(&m_ui.get_font(ui::FontType::SEMIBOLD));
    m_ui.set_secondary_font(&m_ui.get_font(ui::FontType::SEMIBOLD));

    auto& app_layout = m_ui.root().add_child<AppLayoutNode>(m_header_end_height);
    auto& header = app_layout.add_child<AppHeaderNode>(m_ui, m_header_end_height);
    auto& content = app_layout.add_child<AppContentNode>(m_ui);
    auto& notification_manager = m_ui.root().add_child<UINotificationManager>(m_ui);

    m_notification_manager = &notification_manager;

    const auto add_tab = [this](TabButtonWidget& button, UITab& tab) {
        tab.set_visible(false);
        m_tabs.push_back({&button, &tab});
    };

    add_tab(
        header.add_child<TabButtonWidget>(m_ui, "osu-stuff", false, true),
        content.add_child<IndexTab>(m_ui, m_tasks, notification_manager)
    );
    add_tab(header.add_child<TabButtonWidget>(m_ui, "collections"), content.add_child<CollectionTab>(m_ui));
    add_tab(header.add_child<TabButtonWidget>(m_ui, "discover"), content.add_child<DiscoverTab>(m_ui));
    add_tab(header.add_child<TabButtonWidget>(m_ui, "radio"), content.add_child<RadioTab>(m_ui));
    add_tab(header.add_child<TabButtonWidget>(m_ui, "config"), content.add_child<ConfigTab>(m_ui));
    add_tab(header.add_child<TabButtonWidget>(m_ui, "status"), content.add_child<StatusTab>(m_ui));

    UITab& initial_tab = *m_tabs.front().tab;
    m_tabs.front().button->set_selected(true);
    initial_tab.set_visible(true);

    for (auto& entry : m_tabs) {
        entry.button->on_event = [this, current_tab = entry.tab](ui::UiEvent& event) {
            if (event.type != ui::EventType::Click) {
                return;
            }

            for (auto& entry : m_tabs) {
                entry.button->set_selected(entry.tab == current_tab);
                entry.tab->set_visible(entry.tab == current_tab);
            }
            event.mark_handled();
        };
    }

    if (constants::IS_DEBUG_BUILD) {
        LOG_INFO("[App]: initializing UI debugger");
        setup_debugger();
    }
}

AppUI::~AppUI() = default;

void AppUI::setup_debugger() {
    m_debugger = std::make_unique<ui::Debugger>(m_ui);
    m_debugger->setup();

    if (!m_debugger->ready()) {
        LOG_WARN("[App]: failed to initialize the debugger window, continuing without it");
        m_debugger.reset();
        return;
    }

    const ui::ImGuiContextScope scope(m_ui.imgui_context());

    m_debugger->set_style(ImGui::GetStyle());
    m_debugger->set_icon(m_ui.get_texture("inspect-icon"));
    m_debugger->set_font(ui::FontType::REGULAR, ui::FONT_MEDIUM);
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

    if (m_debugger && m_debugger->process_sdl_event(event)) {
        return;
    }

    ui::process_sdl_event(m_ui, *event);
}

void AppUI::render() {
    if (!ready()) {
        return;
    }

    m_ui.begin_input_frame();
    m_ui.begin_frame();
    m_tasks.drain();
    const float dt = ImGui::GetIO().DeltaTime;

    if (m_debugger) m_debugger->update(dt);

    m_notification_manager->set_header_height(m_header_end_height);

    m_ui.root().update(dt);
    m_ui.root().draw();

    if (m_debugger) m_debugger->draw_highlight();

    m_ui.end_frame();

    if (m_debugger) m_debugger->render();
}
