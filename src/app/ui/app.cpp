#include "app.hpp"
#include "constants.hpp"

#include "managers/notifications.hpp"
#include "theme.hpp"
#include "tabs/detail.hpp"
#include "widgets/tab-button.hpp"

#include <cstdlib>

static app::OsuStuffApp* current_app = nullptr;

namespace app {
    class AppHeaderNode final : public ui::Node {
    public:
        AppHeaderNode(UI& ui, float& height) : ui::Node("header"), m_ui(ui), m_height(height) {
        }

        void draw() override {
            [[maybe_unused]] const auto draw_scope = measure_draw();

            if (!visible()) {
                return;
            }

            ImFont* font = m_ui.get_font(ui::FontType::BOLD).get(ui::FONT_MEDIUM);
            ImGui::PushFont(font);
            m_height = ImGui::GetFrameHeight() + app_theme::CONTENT_PADDING * 2.0F;
            ImGui::PopFont();

            const ImVec2 available = ImGui::GetContentRegionAvail();
            const ImVec2 start = ImGui::GetCursorScreenPos();

            ImGui::PushStyleColor(ImGuiCol_ChildBg, app_theme::HEADER_BG_COLOR);
            ImGui::PushStyleVar(ImGuiStyleVar_ChildRounding, 0.0F);
            ImGui::PushStyleVar(ImGuiStyleVar_ItemSpacing, {0.0F, 0.0F});
            ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, {app_theme::CONTENT_PADDING, app_theme::CONTENT_PADDING});
            ImGui::BeginChild(
                "header", {available.x, m_height}, ImGuiChildFlags_AlwaysUseWindowPadding, ImGuiWindowFlags_None
            );
            ImGui::PushFont(font);
            for (std::size_t index = 0; index < children().size(); ++index) {
                if (index > 0) {
                    ImGui::SameLine(0.0F, app_theme::HEADER_TABS_GAP);
                }
                children()[index]->draw();
            }
            ImGui::PopFont();

            const ImVec2 line_start = {start.x, start.y + m_height - 1.0F};
            ImGui::GetWindowDrawList()->AddLine(
                line_start, {start.x + available.x, line_start.y}, ImColor(app_theme::HEADER_BORDER_COLOR), 1.0F
            );
            ImGui::EndChild();
            ImGui::PopStyleVar(3);
            ImGui::PopStyleColor();
        }

    private:
        UI& m_ui;
        float& m_height;
    };

    class AppContentNode final : public ui::Node {
    public:
        explicit AppContentNode(UI& ui) : ui::Node("content"), m_ui(ui) {
        }

        void draw() override {
            [[maybe_unused]] const auto draw_scope = measure_draw();
            if (!visible()) {
                return;
            }

            ImFont* font = m_ui.get_font(ui::FontType::BOLD).get(ui::FONT_MEDIUM);
            ImGui::PushFont(font);
            for (const auto& child : children()) {
                child->draw();
            }
            ImGui::PopFont();
        }

    private:
        UI& m_ui;
    };

    class AppRootNode final : public ui::Node {
    public:
        AppRootNode() : ui::Node("app-root") {
        }

        void draw() override {
            [[maybe_unused]] const auto draw_scope = measure_draw();

            if (!visible()) {
                return;
            }

            const ImGuiViewport* viewport = ImGui::GetMainViewport();

            ImGui::SetNextWindowPos(viewport->WorkPos);
            ImGui::SetNextWindowSize(viewport->WorkSize);
            ImGui::Begin("##osu-stuff", nullptr, ui_constants::WINDOW_FLAGS);
            {
                for (const auto& child : children()) {
                    child->draw();
                }
            }
            ImGui::End();
        }
    };

    OsuStuffApp& current() {
        return *current_app;
    }

    OsuStuffApp::OsuStuffApp(UI& ui) : m_ui(ui) {
        current_app = this;

        auto& app_root = m_ui.root().emplace_child<AppRootNode>();
        auto& header = app_root.emplace_child<AppHeaderNode>(m_ui, m_header_end_height);
        auto& content = app_root.emplace_child<AppContentNode>(m_ui);

        const auto add_tab = [this, &header,
                              &content](std::unique_ptr<TabButtonWidget> button, std::unique_ptr<UITab> tab) {
            auto& button_ref = header.add_child(std::move(button));
            auto& tab_ref = content.add_child(std::move(tab));
            tab_ref.set_visible(false);
            m_tabs.push_back({&button_ref, &tab_ref});
        };

        add_tab(std::make_unique<TabButtonWidget>("osu-stuff", false, true), std::make_unique<IndexTab>());
        add_tab(std::make_unique<TabButtonWidget>("collections"), std::make_unique<CollectionTab>());
        add_tab(std::make_unique<TabButtonWidget>("discover"), std::make_unique<DiscoverTab>());
        add_tab(std::make_unique<TabButtonWidget>("radio"), std::make_unique<RadioTab>());
        add_tab(std::make_unique<TabButtonWidget>("config"), std::make_unique<ConfigTab>());
        add_tab(std::make_unique<TabButtonWidget>("status"), std::make_unique<StatusTab>());

        m_current_tab = m_tabs.front().tab;
        m_tabs.front().button->set_selected(true);
        m_current_tab->set_visible(true);

        for (auto& entry : m_tabs) {
            entry.button->on_event = [this, current_tab = entry.tab](ui::UiEvent& event) {
                if (event.type != ui::EventType::Click) {
                    return;
                }

                for (auto& entry : m_tabs) {
                    entry.button->set_selected(entry.tab == current_tab);
                    entry.tab->set_visible(entry.tab == current_tab);
                }

                m_current_tab = current_tab;
                event.mark_handled();
            };
        }

        auto notification_manager = std::make_unique<UINotificationManager>();
        m_notification_manager = notification_manager.get();
        m_ui.root().layer(ui::InputLayer::Notification).add(std::move(notification_manager));
    }

    OsuStuffApp::~OsuStuffApp() {
        current_app = nullptr;
    }

    UINotificationManager* OsuStuffApp::notification_manager() {
        return m_notification_manager;
    }

    void OsuStuffApp::render() {
        m_ui.begin_frame();
        m_notification_manager->set_header_height(m_header_end_height);
        m_ui.root().draw();
        m_ui.end_frame();
    }

} // namespace app
