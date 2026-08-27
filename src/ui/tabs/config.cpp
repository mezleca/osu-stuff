#include "detail.hpp"
#include "../app.hpp"
#include "../../database/database.hpp"
#include "../../utils/log.hpp"
#include "../../clients/detail.hpp"

#include <ui/ui.hpp>
#include <ui/widgets/checkbox.hpp>
#include <ui/widgets/dropdown.hpp>
#include <ui/widgets/number-input.hpp>
#include <ui/widgets/text.hpp>
#include <ui/widgets/text-input.hpp>
#include <string>
#include <type_traits>
#include <utility>

// TOFIX / TODO
// 1 - FileSelectorWidget for location fields
// 2 - either implement a file navigation widget (to use on a modal)
// or get a library to do file dialog stuff

using namespace ui;
using namespace app;

struct ConfigFieldInfo {
    std::string label;
    std::string description;
};

class ConfigFieldBase : public StackContainer {
protected:
    explicit ConfigFieldBase(UI& ui) : StackContainer({}, StackDirection::Vertical), m_ui(ui) {
        set_spacing(7.0F);
        fit_content_height();
        style().padding({5.0F, 5.0F});
    }

    void configure_input(StyledNode& input, ImVec2 padding) {
        const Theme& theme = m_ui.theme();
        input.configure_all_styles([padding](Style& style) { style.padding(padding); });
        input.configure_style(StyleType::DEFAULT, [&theme](Style& style) {
            style.background_color(theme.background_tertiary_color);
        });
    }

    void add_description(std::string description) {
        if (description.empty()) {
            return;
        }

        const Theme& theme = m_ui.theme();
        m_description = &add_child<TextWidget>(std::move(description));
        m_description->set_font(m_ui.get_font(FontType::BOLD).get(17));
        m_description->configure_all_styles([&theme](Style& style) { style.color(theme.text_secondary_color); });
    }

    void align_description(float x) {
        if (m_description == nullptr) {
            return;
        }

        m_description->configure_all_styles([x](Style& style) {
            const ImVec2 padding = style.padding();
            style.padding({x, padding.y});
        });
    }

    UI& m_ui;
    Widget* m_widget = nullptr;
    TextWidget* m_description = nullptr;

private:
    virtual void commit_binding() = 0;

    void on_draw_end() override {
        if (m_widget != nullptr && m_widget->changed()) {
            commit_binding();
        }

        StackContainer::on_draw_end();
    }
};

template <typename T>
class ConfigField final : public ConfigFieldBase {
public:
    ConfigField(UI& ui, DatabaseBinding<T> binding, ConfigFieldInfo info) : ConfigFieldBase(ui), m_binding(std::move(binding)) {
        if constexpr (std::is_same_v<T, bool>) {
            add_checkbox(std::move(info.label));
            add_description(std::move(info.description));
            align_checkbox_description();
        } else {
            add_label(std::move(info.label));
            add_description(std::move(info.description));
            add_input();
        }
    }

private:
    void add_label(std::string label) {
        auto& label_widget = add_child<TextWidget>(std::move(label));
        label_widget.set_font(m_ui.get_font(FontType::BOLD).get(18));
    }

    void add_checkbox(std::string label) {
        auto& checkbox = add_child<CheckboxWidget>(m_ui, m_binding.value(), std::move(label));
        checkbox.set_font(m_ui.get_font(FontType::BOLD).get(18));
        m_widget = &checkbox;
    }

    void align_checkbox_description() {
        if (m_widget == nullptr) {
            return;
        }

        align_description(
            m_widget->style().padding().x + 20.0F +
            (ImGui::GetCurrentContext() == nullptr ? 0.0F : ImGui::GetStyle().ItemInnerSpacing.x)
        );
    }

    void add_input() {
        if constexpr (std::is_same_v<T, std::string>) {
            auto& input = add_child<TextInputWidget>(m_ui, m_binding.value());
            input.set_font(m_ui.get_primary_font(20));

            configure_input(input, {12.0F, 11.0F});
            m_widget = &input;
        } else if constexpr (requires { NumberInputWidget(m_ui, m_binding.value()); }) {
            auto& input = add_child<NumberInputWidget>(m_ui, m_binding.value());
            input.set_font(m_ui.get_font(FontType::BOLD).get(18));

            configure_input(input, {10.0F, 5.0F});
            m_widget = &input;
        } else {
            static_assert(std::is_same_v<T, void>, "unsupported config field type");
        }
    }

    void commit_binding() override {
        m_binding.commit();
    }

    DatabaseBinding<T> m_binding;
};

class ConfigDropdownField final : public ConfigFieldBase {
public:
    ConfigDropdownField(UI& ui, DatabaseBinding<std::string> binding, ConfigFieldInfo info, std::vector<DropdownOption> options)
        : ConfigFieldBase(ui), m_binding(std::move(binding)) {
        auto& label = add_child<TextWidget>(std::move(info.label));
        label.set_font(m_ui.get_font(FontType::BOLD).get(18));

        add_description(std::move(info.description));

        auto& dropdown = add_child<DropdownWidget>(m_ui, m_binding.value(), std::move(options));
        dropdown.set_font(m_ui.get_font(FontType::BOLD).get(18));
        configure_input(dropdown.trigger(), {10.0F, 5.0F});
        m_widget = &dropdown;
    }

private:
    void commit_binding() override {
        m_binding.commit();
    }

    DatabaseBinding<std::string> m_binding;
};

template <typename T>
static ConfigField<T>& add_config_field(ChildContainer& parent, UI& ui, DatabaseBinding<T> binding, ConfigFieldInfo info) {
    return parent.add_child<ConfigField<T>>(ui, std::move(binding), std::move(info));
}

static ConfigDropdownField& add_config_dropdown(
    ChildContainer& parent, UI& ui, DatabaseBinding<std::string> binding, ConfigFieldInfo info,
    std::vector<DropdownOption> options
) {
    return parent.add_child<ConfigDropdownField>(ui, std::move(binding), std::move(info), std::move(options));
}

static DatabaseBinding<std::string> bind_osu_client_type(AppDatabase& app_database) {
    return app_database.bind(
        [](auto& config) {
            const auto type = static_cast<OsuClientType>(config.osu_data->type.detach());
            return std::string{type == OsuClientType::Lazer ? "lazer" : "stable"};
        },
        [](auto& change, auto& config, const std::string& value) {
            const auto type = value == "lazer" ? OsuClientType::Lazer : OsuClientType::Stable;
            change.set(config.osu_data->type, static_cast<int64_t>(type));
        }
    );
}

ConfigTab::ConfigTab(UI& ui) : UITab(ui, "config") {}

void ConfigTab::setup() {
    m_content_layout = &add_child<StackContainer>("##config-content");
    m_content_layout->set_spacing(6.0F);

    if (database == nullptr) {
        LOG_WARN("[ConfigTab] cant build config layout (database is nullptr)");
        return;
    }

    build();
}

void ConfigTab::build() {
    // credentials(id): https://osu.ppy.sh/home/account/edit#oauth
    add_config_field(*m_content_layout, ui(), DATABASE_FIELD(database, credentials->id), {"osu! id", "OAuth application ID"});

    // credentials(secret): https://osu.ppy.sh/home/account/edit#oauth
    add_config_field(
        *m_content_layout, ui(), DATABASE_FIELD(database, credentials->secret), {"osu! secret", "OAuth application SECRET"}
    );

    // stable path
    add_config_field(
        *m_content_layout, ui(), DATABASE_FIELD(database, osu_data->stable_path), {"stable location", "osu! stable location"}
    );

    // lazer path
    add_config_field(
        *m_content_layout, ui(), DATABASE_FIELD(database, osu_data->lazer_path), {"lazer location", "lazer location"}
    );

    // client mode
    add_config_dropdown(
        *m_content_layout, ui(), bind_osu_client_type(*database), {"current osu client", "select current osu client"},
        {{"stable", "stable"}, {"lazer", "lazer"}}
    );

    // radio: background image
    add_config_field(
        *m_content_layout, ui(), DATABASE_FIELD(database, radio_background),
        {"radio background", "enable background image in radio tab"}
    );
}

void ConfigTab::render() {
    m_content_layout->set_size({0.0F, ImGui::GetContentRegionAvail().y});
    m_content_layout->draw();
}
