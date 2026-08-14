#include "detail.hpp"

#ifndef NDEBUG
#include "../app.hpp"
#include "../managers/notifications.hpp"
#include "../widgets/notification.hpp"
#include "../../../ui/theme.hpp"
#endif

namespace {
#ifndef NDEBUG
    class AnchorVisualTestNode final : public ui::Node {
    public:
        AnchorVisualTestNode(std::string id, std::string label, ui::Anchor anchor, ui::Origin origin, ImVec2 offset)
            : ui::Node(std::move(id)), m_label(std::move(label)) {
            layout().set_size({240.0F, 110.0F});
            layout().set_anchor(anchor);
            layout().set_origin(origin);
            layout().set_offset(offset);
        }

    private:
        void on_draw() override {
            ImGui::PushID(this);
            ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, {16.0F, 16.0F});
            ImGui::BeginChild(
                "##anchor-box", layout().size(), ImGuiChildFlags_Borders,
                ImGuiWindowFlags_NoScrollbar | ImGuiWindowFlags_NoScrollWithMouse
            );
            ImGui::TextWrapped("%s", m_label.c_str());
            ImGui::EndChild();
            ImGui::PopStyleVar();
            ImGui::PopID();
        }

        std::string m_label;
    };

    class NotificationVisualTestNode final : public ui::Node {
    public:
        NotificationVisualTestNode() : ui::Node("notification-test") {
            layout().set_size({200.0F, 84.0F});
            layout().set_anchor(ui::Anchor::TopLeft);
            layout().set_origin(ui::Origin::TopLeft);
            layout().set_offset({16.0F, 16.0F});
        }

    private:
        void on_draw() override {
            auto* manager = app::current().notification_manager();
            if (manager == nullptr) {
                return;
            }

            ImGui::PushID(this);
            ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, {6.0F, 6.0F});

            const ImVec2 button_size = {layout().size().x - 32.0F, 30.0F};

            if (ImGui::Button("add notification", button_size)) {
                const auto level = manager->count() % 2 == 0 ? LogNotificationLevel::INFO : LogNotificationLevel::WARN;
                const std::string text = manager->count() == 0
                                             ? "small notification test"
                                             : "a not so small, kinda big but bigger enormous notification test";
                static_cast<void>(manager->add(std::make_unique<LogNotificationWidget>(level, text)));
            }

            if (manager->count() > 0) {
                ImGui::SameLine();
                if (ImGui::Button("clear notifications", button_size)) manager->clear();
            }

            ImGui::PopStyleVar();
            ImGui::Text("notifications: %zu", manager->count());
            ImGui::PopID();
        }
    };

    class AnchorVisualTestLayout final : public ui::ChildLayout {
    public:
        AnchorVisualTestLayout() : ui::ChildLayout("##index-anchor-visual-test") {
            set_size({0.0F, 200.0F});

            style().border = ui::BORDER_ALL;
            style().border_color.set(ui_theme::BORDER_COLOR);

            add(std::make_unique<AnchorVisualTestNode>(
                "top-left", "anchor: TopLeft\norigin: TopLeft", ui::Anchor::TopLeft, ui::Origin::TopLeft,
                ImVec2{0.0F, 0.0F}
            ));

            add(std::make_unique<AnchorVisualTestNode>(
                "bottom-left", "anchor: BottomLeft\norigin: BottomLeft", ui::Anchor::BottomLeft, ui::Origin::BottomLeft,
                ImVec2{0.0F, 0.0F}
            ));

            add(std::make_unique<AnchorVisualTestNode>(
                "center", "anchor: Center\norigin: Center", ui::Anchor::Center, ui::Origin::Center, ImVec2{0.0F, 0.0F}
            ));

            add(std::make_unique<AnchorVisualTestNode>(
                "bottom-right", "anchor: BottomRight\norigin: BottomRight", ui::Anchor::BottomRight,
                ui::Origin::BottomRight, ImVec2{0.0F, 0.0F}
            ));

            add(std::make_unique<AnchorVisualTestNode>(
                "top-right", "anchor: TopRight\norigin: TopRight", ui::Anchor::TopRight, ui::Origin::TopRight,
                ImVec2{0.0F, 0.0F}
            ));
        }

        void on_draw() override {
            ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, {ui_theme::CONTENT_PADDING, ui_theme::CONTENT_PADDING});
            ImGui::BeginChild(
                id().c_str(), layout().size(), ImGuiChildFlags_AlwaysUseWindowPadding,
                ImGuiWindowFlags_NoBackground | ImGuiWindowFlags_NoScrollbar | ImGuiWindowFlags_NoScrollWithMouse
            );
        }
    };
#endif
} // namespace

IndexTab::IndexTab() : UITab("index") {}

void IndexTab::setup() {
#ifndef NDEBUG
    auto anchor_visual_test = std::make_unique<AnchorVisualTestLayout>();
    m_anchor_visual_test = anchor_visual_test.get();
    add(std::move(anchor_visual_test));

    auto notification_visual_test = std::make_unique<ui::ChildLayout>("##index-notification-visual-test");
    notification_visual_test->set_size({0.0F, 140.0F});
    notification_visual_test->style().border = ui::BORDER_ALL;
    notification_visual_test->style().border_color.set(ui_theme::BORDER_COLOR);
    notification_visual_test->add(std::make_unique<NotificationVisualTestNode>());
    m_notification_visual_test = notification_visual_test.get();
    add(std::move(notification_visual_test));
#endif
    mark_initialized();
}

void IndexTab::render() {
    if (!is_initialized()) {
        return;
    }

    ImGui::TextUnformatted("osu-stuff");

#ifndef NDEBUG
    render_visual_test();
#endif
}

#ifndef NDEBUG
void IndexTab::render_visual_test() {
    if (!ImGui::TreeNodeEx("ui visual tests")) {
        return;
    }

    if (ImGui::TreeNodeEx("anchors")) {
        m_anchor_visual_test->set_size({0.0F, 300.0F});
        m_anchor_visual_test->draw();
        ImGui::TreePop();
    }

    if (ImGui::TreeNodeEx("notifications")) {
        m_notification_visual_test->set_size({0.0F, 140.0F});
        m_notification_visual_test->draw();
        ImGui::TreePop();
    }

    ImGui::TreePop();
}
#endif
