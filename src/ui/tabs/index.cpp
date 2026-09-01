#include "detail.hpp"

#include "../app.hpp"
#include "../managers/modal.hpp"
#include "../managers/notifications.hpp"
#include "../widgets/notification.hpp"
#include "../widgets/range.hpp"

#include <ui/constants.hpp>
#include <ui/style/theme.hpp>
#include <ui/widgets/button.hpp>
#include <ui/widgets/checkbox.hpp>
#include <ui/widgets/context-menu.hpp>
#include <ui/widgets/dropdown.hpp>
#include <ui/widgets/file-dialog.hpp>
#include <ui/widgets/number-input.hpp>
#include <ui/widgets/text-input.hpp>
#include <ui/widgets/text.hpp>
#include <ui/layout/stack-container.hpp>
#include <cpr/cpr.h>
#include <nlohmann/json.hpp>
#include <array>
#include <chrono>
#include <format>
#include <vector>

using namespace ui;

class AnchorVisualTestNode final : public Container {
public:
    AnchorVisualTestNode(std::string id, std::string label, Anchor anchor, Anchor origin, ImVec2 offset, const Theme& theme)
        : Container(std::move(id)) {
        set_layout({
            .size = {px(240.0F), px(110.0F)},
            .placement = {.anchor = anchor, .origin = origin, .offset = offset},
            .in_flow = false,
        });
        configure_all_styles([&theme](Style& style) {
            style.padding({16.0F, 16.0F}).border(BORDER_ALL).border_color(theme.border_color);
        });
        add<TextWidget>(std::move(label));
    }
};

class NotificationVisualTestNode final : public StackContainer {
public:
    NotificationVisualTestNode(
        UI& surface, UINotificationManager& notification_manager, UIModalManager& modal_manager, const Theme& theme
    )
        : StackContainer("notification-test", StackDirection::Horizontal), m_modal_manager(modal_manager), m_ui(surface),
          m_manager(notification_manager) {
        set_size({grow(), px(120.0F)});
        set_spacing(8.0F);
        configure_all_styles([&theme](Style& style) {
            style.padding({8.0F, 8.0F}).border(BORDER_ALL).border_color(theme.border_color);
        });

        m_count_text = &add<TextWidget>("notifications: 0");
        m_add_button = &add<ButtonWidget>(m_ui, "add notification", LayoutSize{px(180.0F), px(30.0F)});
        m_open_modal_button = &add<ButtonWidget>(m_ui, "open modal", LayoutSize{px(180.0F), px(30.0F)});
        m_clear_button = &add<ButtonWidget>(m_ui, "clear notifications", LayoutSize{px(180.0F), px(30.0F)});

        m_add_button->set_on_event([this](UiEvent& event) {
            if (event.type != EventType::Click) {
                return;
            }

            const auto level = m_manager.count() % 2 == 0 ? LogNotificationLevel::INFO : LogNotificationLevel::WARN;
            const std::string text =
                m_manager.count() == 0 ? "small notification test" : "a not so small, kinda big but enormous notification test";
            m_manager.add(std::make_unique<LogNotificationWidget>(m_ui, level, text));
            event.mark_handled();
        });

        m_open_modal_button->set_on_event([this](UiEvent& event) {
            if (event.type != EventType::Click) {
                return;
            }

            show_modal();
            event.mark_handled();
        });

        m_clear_button->set_on_event([this](UiEvent& event) {
            if (event.type != EventType::Click) {
                return;
            }

            m_manager.clear_notifications();
            event.mark_handled();
        });
    }

protected:
    void on_update(float dt) override {
        StackContainer::on_update(dt);
        m_count_text->set_text(std::format("notifications: {}", m_manager.count()));
        m_clear_button->set_visible(m_manager.count() > 0);
    }

private:
    void show_modal() {
        static std::string modal_input;
        auto& modal = m_modal_manager.open("modal-visual-test");

        modal.add<TextWidget>("hello from modal");

        auto& input = modal.add<TextInputWidget>(m_ui, modal_input, "##modal-input");
        auto& close_button = modal.add<ButtonWidget>(m_ui, "close modal", LayoutSize{px(160.0F), px(36.0F)});

        input.set_size({px(400.0F), px(36.0F)});

        close_button.set_on_event([this](UiEvent& event) {
            if (event.type != EventType::Click) {
                return;
            }

            m_modal_manager.close();
            event.stop_propagation();
        });
    }

    UIModalManager& m_modal_manager;
    UI& m_ui;
    UINotificationManager& m_manager;
    TextWidget* m_count_text = nullptr;
    ButtonWidget* m_add_button = nullptr;
    ButtonWidget* m_open_modal_button = nullptr;
    ButtonWidget* m_clear_button = nullptr;
};

class WidgetVisualTestNode final : public StackContainer {
public:
    WidgetVisualTestNode(UI& surface, ContextMenuWidget& context_menu)
        : StackContainer("widget-test"), m_ui(surface), m_text_value("editable text") {
        set_size({grow(), px(360.0F)});
        set_spacing(10.0F);
        set_scrollable(true);
        set_input_mode(InputMode::Target);

        configure_all_styles([this](Style& style) {
            style.padding({12.0F, 12.0F}).border(BORDER_ALL).border_color(m_ui.theme().border_color);
        });

        m_button = &add<ButtonWidget>(m_ui, "button", LayoutSize{px(160.0F), px(36.0F)});

        auto& text_input = add<TextInputWidget>(m_ui, m_text_value, "##widget-test-text");
        text_input.set_size({px(380.0F), px(44.0F)});

        auto& number_input = add<NumberInputWidget>(m_ui, m_number_value, "widget-test-number");
        number_input.set_label("number input").set_range(0.0, 100.0).set_size({px(380.0F), px(36.0F)});

        auto& dropdown = add<DropdownWidget>(
            m_ui, m_dropdown_value, std::vector<DropdownOption>{{"recent", "recent"}, {"title", "title"}, {"artist", "artist"}},
            "widget-test-dropdown"
        );
        dropdown.set_label("sort by").set_size({px(380.0F), px(62.0F)});

        auto& dialog_mode = add<DropdownWidget>(
            m_ui, m_dialog_mode,
            std::vector<DropdownOption>{{"file", "file"}, {"multiple files", "multiple files"}, {"folder", "folder"}},
            "widget-test-dropdown"
        );
        dialog_mode.set_label("dialog mode").set_size({px(380.0F), px(62.0F)});

        auto& default_folder = add<TextInputWidget>(m_ui, m_default_folder, "##default-folder");
        default_folder.set_visible(false);

        dialog_mode.set_on_change([this, &default_folder]() { default_folder.set_visible(m_dialog_mode == "folder"); });

        auto& file_dialog = add<FileDialogWidget>(m_ui, "file dialog placeholder");
        file_dialog.set_on_event([this, &file_dialog](UiEvent& event) {
            if (event.type != EventType::Click) {
                return;
            }

            static const std::array<FileDialogFilter, 1> source_filters{{{"source files", "cpp,c"}}};

            if (m_dialog_mode == "file") {
                const FileDialogResult result = file_dialog.select_file({.filters = source_filters});
                if (result.accepted() && !result.paths.empty()) file_dialog.set_value(result.paths.front().string());
            } else if (m_dialog_mode == "multiple files") {
                const FileDialogResult result = file_dialog.select_files({.filters = source_filters});
                if (result.accepted()) file_dialog.set_value(std::format("selected {} file(s)", result.paths.size()));
            } else {
                const FileDialogResult result = file_dialog.select_folder(std::filesystem::path{m_default_folder});
                if (result.accepted() && !result.paths.empty()) file_dialog.set_value(result.paths.front().string());
            }

            event.mark_handled();
        });

        auto& range = add<RangeWidget>(m_ui, m_range_minimum, m_range_maximum, "widget-test-range");
        range.set_label("difficulty range").set_bounds(0.0F, 10.0F).set_step(0.1F).set_size({px(380.0F), px(60.0F)});

        auto& checkbox = add<CheckboxWidget>(m_ui, m_checked, "checkbox", "widget-test-checkbox");
        checkbox.set_size({grow(), px(30.0F)});

        auto& radio = add<CheckboxWidget>(m_ui, m_radio_selected, "radio", "widget-test-radio");
        radio.set_type(CheckboxType::Radio).set_size({grow(), px(30.0F)});

        set_on_event([&context_menu](UiEvent& event) {
            if (event.type == EventType::ContextClick) {
                context_menu.open_at(event.position);
                event.mark_handled();
                return;
            }
        });

        m_button->set_on_event([this](UiEvent& event) {
            if (event.type != EventType::Click) {
                return;
            }

            ++m_click_count;
            m_button->set_text(std::format("button ({})", m_click_count));
            event.mark_handled();
        });
    }

private:
    UI& m_ui;
    std::string m_text_value;
    std::string m_default_folder = "/";
    std::string m_dropdown_value = "recent";
    std::string m_dialog_mode = "file";
    ButtonWidget* m_button = nullptr;
    float m_number_value = 50.0F;
    float m_range_minimum = 2.0F;
    float m_range_maximum = 8.0F;
    int m_click_count = 0;
    bool m_checked = false;
    bool m_radio_selected = false;
};

struct PlaceholderTodo {
    std::string title;
    bool completed;
};

class TaskVisualTestNode final : public StackContainer {
public:
    TaskVisualTestNode(UI& surface, TaskScheduler& tasks, UINotificationManager& notification_manager)
        : StackContainer("task-test"), m_ui(surface), m_notification_manager(notification_manager), m_task(tasks) {
        set_size({grow(), px(170.0F)});
        set_spacing(10.0F);
        configure_all_styles([this](Style& style) {
            style.padding({12.0F, 12.0F}).border(BORDER_ALL).border_color(m_ui.theme().border_color);
        });

        m_status = &add<TextWidget>("idle");
        m_result = &add<TextWidget>("result: none");
        m_start = &add<ButtonWidget>(m_ui, "fetch placeholder todo", LayoutSize{px(220.0F), px(36.0F)});
        m_cancel = &add<ButtonWidget>(m_ui, "cancel", LayoutSize{px(120.0F), px(36.0F)});

        m_start->set_on_event([this](UiEvent& event) {
            if (event.type != EventType::Click) {
                return;
            }

            start_request();
            event.mark_handled();
        });

        m_cancel->set_on_event([this](UiEvent& event) {
            if (event.type != EventType::Click) {
                return;
            }

            if (m_task.cancel()) {
                m_status->set_text("cancellation requested...");
            }
            event.mark_handled();
        });
    }

protected:
    void on_update(float dt) override {
        StackContainer::on_update(dt);
        const bool running = m_task.running();
        m_start->set_visible(!running);
        m_cancel->set_visible(running);
    }

private:
    void start_request() {
        const bool started = m_task.start(
            [](TaskContext& context) -> TaskResult<PlaceholderTodo> {
                using namespace std::chrono_literals;

                const auto started_at = std::chrono::steady_clock::now();
                context.send_update("requesting JSONPlaceholder...");

                const cpr::ProgressCallback cancel_request{
                    [&context](cpr::cpr_pf_arg_t, cpr::cpr_pf_arg_t, cpr::cpr_pf_arg_t, cpr::cpr_pf_arg_t, intptr_t) {
                        return !context.cancelled();
                    }
                };
                const cpr::Response response = cpr::Get(
                    cpr::Url{"https://jsonplaceholder.typicode.com/todos/1"}, cpr::Timeout{10000}, cpr::ConnectTimeout{5000},
                    cancel_request
                );
                if (context.cancelled()) {
                    return TaskResult<PlaceholderTodo>::cancelled();
                }
                if (response.status_code < 200 || response.status_code >= 300) {
                    return TaskResult<PlaceholderTodo>::failure(
                        std::format("request failed: status={} error={}", response.status_code, response.error.message)
                    );
                }

                context.send_update("parsing response...");

                PlaceholderTodo todo;
                try {
                    const auto json = nlohmann::json::parse(response.text);
                    todo.title = json.at("title").get<std::string>();
                    todo.completed = json.at("completed").get<bool>();
                } catch (const nlohmann::json::exception& error) {
                    return TaskResult<PlaceholderTodo>::failure(error.what());
                }

                const auto elapsed = std::chrono::steady_clock::now() - started_at;
                if (elapsed < 2s) {
                    context.send_update("waiting for the artificial delay...");
                    const auto remaining = std::chrono::duration_cast<std::chrono::milliseconds>(2s - elapsed);
                    if (!context.wait_for(remaining)) {
                        return TaskResult<PlaceholderTodo>::cancelled();
                    }
                }

                return TaskResult<PlaceholderTodo>::success(std::move(todo));
            },
            [this](TaskResult<PlaceholderTodo> result) {
                switch (result.status) {
                    case TaskStatus::Success: {
                        const PlaceholderTodo& todo = *result.value;
                        m_status->set_text("success");
                        m_result->set_text(
                            std::format("result: {} ({})", todo.title, todo.completed ? "completed" : "not completed")
                        );
                        break;
                    }
                    case TaskStatus::Failure:
                        m_status->set_text(std::format("failure: {}", result.reason.value_or("unknown reason")));
                        break;
                    case TaskStatus::Cancelled:
                        m_status->set_text("cancelled");
                        break;
                }
            },
            [this](std::string update) {
                m_status->set_text(update);
                auto notification = std::make_unique<LogNotificationWidget>(m_ui, LogNotificationLevel::INFO, std::move(update));
                notification->duration = 4.0F;
                notification->persistent = false;
                m_notification_manager.add(std::move(notification));
            }
        );

        if (started) {
            m_result->set_text("result: waiting...");
        }
    }

    UI& m_ui;
    UINotificationManager& m_notification_manager;
    TaskSlot m_task;
    TextWidget* m_status = nullptr;
    TextWidget* m_result = nullptr;
    ButtonWidget* m_start = nullptr;
    ButtonWidget* m_cancel = nullptr;
};

class VisualTestContainer final : public Container {
public:
    VisualTestContainer(
        UI& ui, TaskScheduler& tasks, UINotificationManager& notification_manager, UIModalManager& modal,
        ContextMenuWidget& context_menu, const Theme& theme
    )
        : Container("visual-tests") {
        set_scrollable(true);
        m_notifications = &add<NotificationVisualTestNode>(ui, notification_manager, modal, theme);
        m_widgets = &add<WidgetVisualTestNode>(ui, context_menu);
        m_tasks = &add<TaskVisualTestNode>(ui, tasks, notification_manager);
    }

private:
    void draw_children() override {
        if (!ImGui::TreeNodeEx("ui visual tests")) {
            return;
        }

        if (ImGui::TreeNodeEx("notifications")) {
            m_notifications->draw();
            ImGui::TreePop();
        }

        if (ImGui::TreeNodeEx("widgets")) {
            m_widgets->draw();
            ImGui::TreePop();
        }

        if (ImGui::TreeNodeEx("tasks")) {
            m_tasks->draw();
            ImGui::TreePop();
        }

        ImGui::TreePop();
    }

    NotificationVisualTestNode* m_notifications = nullptr;
    WidgetVisualTestNode* m_widgets = nullptr;
    TaskVisualTestNode* m_tasks = nullptr;
};

IndexTab::IndexTab(UI& ui, TaskScheduler& tasks, UINotificationManager& notification_manager)
    : UITab(ui, "index"), m_tasks(tasks), m_notification_manager(notification_manager) {
    if (OSU_STUFF_ENABLE_PROFILING != 0) {
        m_context_menu = &ui.root().add<ContextMenuWidget>(
            ui, ContextMenuItems{
                    ContextMenuItem::action("reload"),
                    ContextMenuItem::submenu("options", {ContextMenuItem::action("inspect")}),
                }
        );
        m_modal_manager = &ui.root().add<UIModalManager>(ui);
    }
}

void IndexTab::setup() {
    if (OSU_STUFF_ENABLE_PROFILING != 0) {
        const Theme& theme = ui().theme();

        m_visual_test_layout =
            &add<VisualTestContainer>(ui(), m_tasks, m_notification_manager, *m_modal_manager, *m_context_menu, theme);
    }
}

void IndexTab::render() {
    ImGui::TextUnformatted("osu-stuff");

    if (OSU_STUFF_ENABLE_PROFILING != 0) {
        m_visual_test_layout->set_size({grow(), px(ImGui::GetContentRegionAvail().y)});
        m_visual_test_layout->draw();
    }
}
