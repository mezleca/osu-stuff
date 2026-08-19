#include "detail.hpp"

#include "../app.hpp"
#include "../managers/notifications.hpp"
#include "../widgets/notification.hpp"
#include "../../../ui/constants.hpp"
#include "../../../ui/style/theme.hpp"
#include "../../../ui/layout/modal-container.hpp"
#include "../../../ui/widgets/button.hpp"
#include "../../../ui/widgets/text-input.hpp"
#include "../../../ui/widgets/text.hpp"
#include "../../../ui/layout/stack-container.hpp"

#include <format>

class AnchorVisualTestNode final : public ui::ChildContainer {
public:
    AnchorVisualTestNode(
        std::string id, std::string label, ui::Anchor anchor, ui::Origin origin, ImVec2 offset, const ui::Theme& theme
    )
        : ui::ChildContainer(std::move(id)) {
        set_size({240.0F, 110.0F});
        set_anchor(anchor);
        set_origin(origin);
        set_offset(offset);

        style().padding({16.0F, 16.0F}).border(ui::BORDER_ALL).border_color(theme.border_color);
        add_child<ui::TextWidget>(std::move(label));
    }
};

class NotificationVisualTestNode final : public ui::StackContainer {
public:
    NotificationVisualTestNode(
        UI& surface, UINotificationManager& notification_manager, ui::ModalContainer& modal_container,
        const ui::Theme& theme
    )
        : ui::StackContainer("notification-test", ui::StackDirection::Horizontal), m_modal_container(modal_container),
          m_theme(theme), m_ui(surface), m_manager(notification_manager) {
        set_size({0.0F, 120.0F});
        set_spacing(8.0F);
        set_padding({8.0F, 8.0F});

        style().border(ui::BORDER_ALL).border_color(theme.border_color);

        m_count_text = &add_child<ui::TextWidget>("notifications: 0");
        m_add_button = &add_child<ui::ButtonWidget>(m_ui, "add notification", ImVec2{180.0F, 30.0F});
        m_open_modal_button = &add_child<ui::ButtonWidget>(m_ui, "open modal", ImVec2{180.0F, 30.0F});
        m_clear_button = &add_child<ui::ButtonWidget>(m_ui, "clear notifications", ImVec2{180.0F, 30.0F});

        m_add_button->set_size({180.0F, 30.0F});
        m_open_modal_button->set_size({180.0F, 30.0F});
        m_clear_button->set_size({180.0F, 30.0F});

        m_add_button->on_event = [this](ui::UiEvent& event) {
            if (event.type != ui::EventType::Click) {
                return;
            }

            const auto level = m_manager.count() % 2 == 0 ? LogNotificationLevel::INFO : LogNotificationLevel::WARN;
            const std::string text = m_manager.count() == 0
                                         ? "small notification test"
                                         : "a not so small, kinda big but enormous notification test";
            static_cast<void>(m_manager.add(std::make_unique<LogNotificationWidget>(m_ui, level, text)));
            event.mark_handled();
        };

        m_open_modal_button->on_event = [this](ui::UiEvent& event) {
            if (event.type != ui::EventType::Click) {
                return;
            }

            show_modal();
            event.mark_handled();
        };

        m_clear_button->on_event = [this](ui::UiEvent& event) {
            if (event.type != ui::EventType::Click) {
                return;
            }

            m_manager.clear();
            event.mark_handled();
        };
    }

protected:
    void on_update(float dt) override {
        ui::StackContainer::on_update(dt);
        static_cast<void>(m_count_text->set_content(std::format("notifications: {}", m_manager.count())));
        m_clear_button->set_visible(m_manager.count() > 0);
    }

private:
    void show_modal() {
        static std::string modal_input;
        auto& modal = m_modal_container.open("modal-visual-test");

        modal.set_size({480.0F, 220.0F});
        modal.set_margin({48.0F, 48.0F});
        modal.style()
            .padding({24.0F, 24.0F})
            .background_color(m_theme.background_color)
            .border(ui::BORDER_ALL)
            .border_color(m_theme.accent_color)
            .border_radius(8.0F);

        modal.add_child<ui::TextWidget>("hello from modal");

        auto& input = modal.add_child<ui::TextInputWidget>(m_ui, modal_input, "##modal-input");
        auto& close_button = modal.add_child<ui::ButtonWidget>(m_ui, "close modal", ImVec2{160.0F, 36.0F});

        input.set_size({400.0F, 36.0F});
        close_button.set_size({160.0F, 36.0F});

        close_button.on_event = [this, &modal](ui::UiEvent& event) {
            if (event.type != ui::EventType::Click) {
                return;
            }

            m_modal_container.close(modal);
            event.stop_propagation();
        };
    }

    ui::ModalContainer& m_modal_container;
    const ui::Theme& m_theme;
    UI& m_ui;
    UINotificationManager& m_manager;
    ui::TextWidget* m_count_text = nullptr;
    ui::ButtonWidget* m_add_button = nullptr;
    ui::ButtonWidget* m_open_modal_button = nullptr;
    ui::ButtonWidget* m_clear_button = nullptr;
};

class AnchorVisualTestLayout final : public ui::ChildContainer {
public:
    explicit AnchorVisualTestLayout(const ui::Theme& theme) : ui::ChildContainer("##index-anchor-visual-test") {
        set_size({0.0F, 200.0F});

        style().border(ui::BORDER_ALL);
        style().border_color(theme.border_color);

        add_child<AnchorVisualTestNode>(
            "top-left", "anchor: TopLeft\norigin: TopLeft", ui::Anchor::TopLeft, ui::Origin::TopLeft,
            ImVec2{0.0F, 0.0F}, theme
        );

        add_child<AnchorVisualTestNode>(
            "bottom-left", "anchor: BottomLeft\norigin: BottomLeft", ui::Anchor::BottomLeft, ui::Origin::BottomLeft,
            ImVec2{0.0F, 0.0F}, theme
        );

        add_child<AnchorVisualTestNode>(
            "center", "anchor: Center\norigin: Center", ui::Anchor::Center, ui::Origin::Center, ImVec2{0.0F, 0.0F},
            theme
        );

        add_child<AnchorVisualTestNode>(
            "bottom-right", "anchor: BottomRight\norigin: BottomRight", ui::Anchor::BottomRight,
            ui::Origin::BottomRight, ImVec2{0.0F, 0.0F}, theme
        );

        add_child<AnchorVisualTestNode>(
            "top-right", "anchor: TopRight\norigin: TopRight", ui::Anchor::TopRight, ui::Origin::TopRight,
            ImVec2{0.0F, 0.0F}, theme
        );
    }
};

IndexTab::IndexTab(UI& ui, UINotificationManager& notification_manager)
    : UITab(ui, "index"), m_notification_manager(notification_manager) {}

void IndexTab::setup() {
    if (constants::IS_DEBUG_BUILD) {
        const ui::Theme& theme = ui().theme();

        m_modal_layout = &add_child<ui::ModalContainer>(ui());
        m_anchor_visual_test = &add_child<AnchorVisualTestLayout>(theme);
        m_notification_visual_test =
            &add_child<NotificationVisualTestNode>(ui(), m_notification_manager, *m_modal_layout, theme);
    }

    mark_initialized();
}

void IndexTab::render() {
    if (!is_initialized()) {
        return;
    }

    ImGui::TextUnformatted("osu-stuff");

    if (constants::IS_DEBUG_BUILD) {
        render_visual_test();
        m_modal_layout->draw();
    }
}

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
        m_notification_visual_test->draw();
        ImGui::TreePop();
    }

    ImGui::TreePop();
}
