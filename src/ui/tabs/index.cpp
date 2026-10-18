#include "detail.hpp"

#include "../app.hpp"
#include "../managers/modal.hpp"
#include "../managers/notifications.hpp"
#include "../widgets/notification.hpp"
#include "../widgets/range.hpp"

#include <imgui-ui/widgets/button.hpp>
#include <imgui-ui/widgets/checkbox.hpp>
#include <imgui-ui/widgets/context-menu.hpp>
#include <imgui-ui/widgets/dropdown.hpp>
#include <imgui-ui/widgets/file-dialog.hpp>
#include <imgui-ui/widgets/number-input.hpp>
#include <imgui-ui/widgets/text-input.hpp>
#include <imgui-ui/widgets/text.hpp>
#include <imgui-ui/layout/container.hpp>
#include <imgui-ui/layout/tree-container.hpp>
#include <cpr/cpr.h>
#include <nlohmann/json.hpp>
#include <array>
#include <chrono>
#include <format>
#include <vector>

using namespace ui;

class NotificationVisualTestNode final : public Container {
public:
    NotificationVisualTestNode(UINotificationManager& notification_manager, UIModalManager& modal_manager)
        : Container("notification-test", StackDirection::Horizontal), m_modal_manager(modal_manager),
          m_manager(notification_manager) {
        set_size({grow(), px(120.0F)});
        set_spacing(8.0F);

        m_count_text = &add<TextWidget>("notifications: 0");
        m_add_button = &add<ButtonWidget>("add notification", LayoutSize{px(180.0F), px(30.0F)});
        m_open_modal_button = &add<ButtonWidget>("open modal", LayoutSize{px(180.0F), px(30.0F)});
        m_clear_button = &add<ButtonWidget>("clear notifications", LayoutSize{px(180.0F), px(30.0F)});

        m_add_button->on_event([this](UiEvent& event) {
            if (event.type != EventType::Click) {
                return;
            }

            const auto level = m_manager.count() % 2 == 0 ? LogNotificationLevel::INFO : LogNotificationLevel::WARN;
            const std::string text =
                m_manager.count() == 0 ? "small notification test" : "a not so small, kinda big but enormous notification test";
            m_manager.add(level, text);
            event.mark_handled();
        });

        m_open_modal_button->on_event([this](UiEvent& event) {
            if (event.type != EventType::Click) {
                return;
            }

            show_modal();
            event.mark_handled();
        });

        m_clear_button->on_event([this](UiEvent& event) {
            if (event.type != EventType::Click) {
                return;
            }

            m_manager.clear_notifications();
            event.mark_handled();
        });
    }

protected:
    void apply_theme_defaults(const Theme& theme) override {
        Container::apply_theme_defaults(theme);
        configure_all_styles([&theme](Style& style) {
            style.padding({8.0F, 8.0F}).border(BorderEdge{1.0F, BorderType::Solid}).border_color(theme.border_color);
        });
    }

    void on_update(float dt) override {
        Container::on_update(dt);
        m_count_text->set_text(std::format("notifications: {}", m_manager.count()));
        m_clear_button->set_visible(m_manager.count() > 0);
    }

private:
    void show_modal() {
        static std::string modal_input;
        auto& modal = m_modal_manager.open("modal-visual-test");

        modal.add<TextWidget>("hello from modal");

        auto& input = modal.add<TextInputWidget>(modal_input, std::string{}, LabelPlacement::Inline, "##modal-input");
        auto& close_button = modal.add<ButtonWidget>("close modal", LayoutSize{px(160.0F), px(36.0F)});

        input.set_size({px(400.0F), fit()});

        close_button.on_event([this](UiEvent& event) {
            if (event.type != EventType::Click) {
                return;
            }

            m_modal_manager.close();
            event.stop_propagation();
        });
    }

    UIModalManager& m_modal_manager;
    UINotificationManager& m_manager;
    TextWidget* m_count_text = nullptr;
    ButtonWidget* m_add_button = nullptr;
    ButtonWidget* m_open_modal_button = nullptr;
    ButtonWidget* m_clear_button = nullptr;
};

class WidgetVisualTestNode final : public Widget {
public:
    explicit WidgetVisualTestNode(ContextMenuWidget& context_menu) : Widget("widget-test"), m_text_value("editable text") {
        set_size({grow(), px(360.0F)});
        set_spacing(10.0F);
        set_scrollable(true);
        set_input_mode(InputMode::Target);

        m_button = &add<ButtonWidget>("button", LayoutSize{px(160.0F), px(36.0F)});

        auto& text_input =
            add<TextInputWidget>(m_text_value, std::string{}, LabelPlacement::Inline, "##widget-test-text");
        text_input.set_size({px(380.0F), fit()});

        auto& number_input = add<NumberInputWidget<float>>(m_number_value, "widget-test-number");
        number_input.set_label("number input").set_range(0.0, 100.0).set_size({px(380.0F), fit()});

        auto& dropdown = add<DropdownWidget>(
            m_dropdown_value, std::vector<DropdownOption>{{"recent", "recent"}, {"title", "title"}, {"artist", "artist"}},
            "widget-test-sort"
        );
        dropdown.set_label("sort by").set_size({px(380.0F), fit()});

        auto& dialog_mode = add<DropdownWidget>(
            m_dialog_mode,
            std::vector<DropdownOption>{{"file", "file"}, {"multiple files", "multiple files"}, {"folder", "folder"}},
            "widget-test-dialog-mode"
        );
        dialog_mode.set_label("dialog mode").set_size({px(380.0F), fit()});

        auto& default_folder =
            add<TextInputWidget>(m_default_folder, std::string{}, LabelPlacement::Inline, "##default-folder");
        default_folder.set_visible(false);

        dialog_mode.on_change([this, &default_folder]() { default_folder.set_visible(m_dialog_mode == "folder"); });

        auto& file_dialog = add<FileDialogWidget>("file dialog placeholder");
        file_dialog.on_event([this, &file_dialog](UiEvent& event) {
            if (event.type != EventType::Click) {
                return;
            }

            static const std::array<FileDialogFilter, 1> source_filters{{{"source files", "cpp,c"}}};
            FileDialogOptions options{};
            options.filters = source_filters;

            if (m_dialog_mode == "file") {
                const FileDialogResult result = file_dialog.show_dialog(FileDialogOperation::OpenFile, options);
                if (result.accepted() && !result.paths.empty()) file_dialog.set_value(result.paths.front().string());
            } else if (m_dialog_mode == "multiple files") {
                const FileDialogResult result = file_dialog.show_dialog(FileDialogOperation::OpenFiles, options);
                if (result.accepted()) file_dialog.set_value(std::format("selected {} file(s)", result.paths.size()));
            } else {
                options.filters = {};
                options.default_path = m_default_folder;
                const FileDialogResult result = file_dialog.show_dialog(FileDialogOperation::SelectFolder, options);
                if (result.accepted() && !result.paths.empty()) file_dialog.set_value(result.paths.front().string());
            }

            event.mark_handled();
        });

        auto& range = add<RangeWidget>(m_range_minimum, m_range_maximum, "widget-test-range");
        range.set_label("difficulty range").set_bounds(0.0F, 10.0F).set_step(0.1F).set_size({px(380.0F), fit()});

        add<CheckboxWidget>(m_checked, "checkbox", LabelPlacement::Inline, "widget-test-checkbox");

        auto& radio = add<CheckboxWidget>(m_radio_selected, "radio", LabelPlacement::Inline, "widget-test-radio");
        radio.set_type(CheckboxType::Radio);

        on_event([&context_menu](UiEvent& event) {
            if (event.type == EventType::ContextClick) {
                context_menu.open_at(event.position);
                event.mark_handled();
                return;
            }
        });

        m_button->on_event([this](UiEvent& event) {
            if (event.type != EventType::Click) {
                return;
            }

            ++m_click_count;
            m_button->set_text(std::format("button ({})", m_click_count));
            event.mark_handled();
        });
    }

private:
    void apply_theme_defaults(const Theme& theme) override {
        Container::apply_theme_defaults(theme);
        configure_all_styles([&theme](Style& style) {
            style.padding({12.0F, 12.0F}).border(BorderEdge{1.0F, BorderType::Solid}).border_color(theme.border_color);
        });
    }

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

class TaskVisualTestNode final : public Container {
public:
    TaskVisualTestNode(TaskScheduler& tasks, UINotificationManager& notification_manager)
        : Container("task-test"), m_notification_manager(notification_manager), m_task(tasks) {
        set_size({grow(), px(170.0F)});
        set_spacing(10.0F);

        m_status = &add<TextWidget>("idle");
        m_result = &add<TextWidget>("result: none");
        m_start = &add<ButtonWidget>("fetch placeholder todo", LayoutSize{px(220.0F), px(36.0F)});
        m_cancel = &add<ButtonWidget>("cancel", LayoutSize{px(120.0F), px(36.0F)});

        m_start->on_event([this](UiEvent& event) {
            if (event.type != EventType::Click) {
                return;
            }

            start_request();
            event.mark_handled();
        });

        m_cancel->on_event([this](UiEvent& event) {
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
        Container::on_update(dt);
        const bool running = m_task.running();
        m_start->set_visible(!running);
        m_cancel->set_visible(running);
    }

private:
    void apply_theme_defaults(const Theme& theme) override {
        Container::apply_theme_defaults(theme);
        configure_all_styles([&theme](Style& style) {
            style.padding({12.0F, 12.0F}).border(BorderEdge{1.0F, BorderType::Solid}).border_color(theme.border_color);
        });
    }

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
                auto& notification = m_notification_manager.add(LogNotificationLevel::INFO, std::move(update));
                notification.duration = 4.0F;
                notification.persistent = false;
            }
        );

        if (started) {
            m_result->set_text("result: waiting...");
        }
    }

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
        TaskScheduler& tasks, UINotificationManager& notification_manager, UIModalManager& modal, ContextMenuWidget& context_menu
    )
        : Container("visual-tests") {
        set_scrollable(true);
        auto& tests = add<TreeContainer>("ui visual tests");
        tests.add<TreeContainer>("notifications").add<NotificationVisualTestNode>(notification_manager, modal);
        tests.add<TreeContainer>("widgets").add<WidgetVisualTestNode>(context_menu);
        tests.add<TreeContainer>("tasks").add<TaskVisualTestNode>(tasks, notification_manager);
    }
};

IndexTab::IndexTab(TaskScheduler& tasks, UINotificationManager& notification_manager)
    : UITab("index"), m_tasks(tasks), m_notification_manager(notification_manager) {}

void IndexTab::setup() {
    Surface& surface = ui();
    m_context_menu = &surface.root().add<ContextMenuWidget>(ContextMenuItems{
        ContextMenuItem::action("reload"),
        ContextMenuItem::submenu("options", {ContextMenuItem::action("inspect")}),
    });
    m_modal_manager = &surface.root().add<UIModalManager>();
#ifndef NDEBUG
    m_visual_test_layout = &add<VisualTestContainer>(m_tasks, m_notification_manager, *m_modal_manager, *m_context_menu);
    m_visual_test_layout->set_size({grow(), grow()});
#endif
}
