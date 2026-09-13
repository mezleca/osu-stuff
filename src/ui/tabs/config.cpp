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

using namespace ui;

struct ConfigFieldInfo {
    std::string label;
    std::string description;
};

class ConfigFieldBase : public Container {
protected:
    ConfigFieldBase() : Container({}, StackDirection::Vertical) {
        set_spacing(7.0F);
        set_size({grow(), fit()});
        configure_all_styles([](Style& style) { style.padding({5.0F, 5.0F}); });
    }

    void configure_input(StyledNode& input, ImVec2 padding, const Theme& theme) {
        input.configure_all_styles([padding](Style& style) { style.padding(padding); });
        input.configure_style(StyleType::DEFAULT, [&theme](Style& style) {
            style.background_color(theme.background_tertiary_color);
        });
    }

    void add_description(std::string description) {
        if (description.empty()) {
            return;
        }

        m_description = &add<TextWidget>(std::move(description));
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

    Widget* m_widget = nullptr;
    TextWidget* m_description = nullptr;

    void apply_theme_defaults(const Theme& theme) override {
        Container::apply_theme_defaults(theme);

        if (m_description == nullptr) {
            return;
        }

        m_description->set_font(surface().get_font("Torus Bold", 17));
        m_description->configure_all_styles([&theme](Style& style) { style.color(theme.text_secondary_color); });
    }
};

template <typename T>
class ConfigField final : public ConfigFieldBase {
public:
    ConfigField(DatabaseBinding<T> binding, ConfigFieldInfo info) : ConfigFieldBase(), m_binding(std::move(binding)) {
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
        m_label = &add<TextWidget>(std::move(label));
    }

    void add_checkbox(std::string label) {
        auto& checkbox = add<CheckboxWidget>(m_binding.value(), std::move(label));
        checkbox.set_on_change([this] { m_binding.commit(); });
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
            auto& input = add<TextInputWidget>(m_binding.value());
            input.set_on_change([this] { m_binding.commit(); });
            m_widget = &input;
        } else if constexpr (requires { NumberInputWidget(m_binding.value()); }) {
            auto& input = add<NumberInputWidget>(m_binding.value());
            input.set_on_change([this] { m_binding.commit(); });
            m_widget = &input;
        } else {
            static_assert(std::is_same_v<T, void>, "unsupported config field type");
        }
    }

    void apply_theme_defaults(const Theme& theme) override {
        ConfigFieldBase::apply_theme_defaults(theme);

        if (m_label != nullptr) {
            m_label->set_font(surface().get_font("Torus Bold", 18));
        }

        if constexpr (std::is_same_v<T, std::string>) {
            configure_input(*m_widget, {12.0F, 11.0F}, theme);
        } else if constexpr (!std::is_same_v<T, bool>) {
            m_widget->set_font(surface().get_font("Torus Bold", 18));
            configure_input(*m_widget, {10.0F, 5.0F}, theme);
        }
    }

    DatabaseBinding<T> m_binding;
    TextWidget* m_label = nullptr;
};

class ConfigDropdownField final : public ConfigFieldBase {
public:
    ConfigDropdownField(DatabaseBinding<std::string> binding, ConfigFieldInfo info, std::vector<DropdownOption> options)
        : ConfigFieldBase(), m_binding(std::move(binding)) {
        add<TextWidget>(std::move(info.label));
        add_description(std::move(info.description));

        auto& dropdown = add<DropdownWidget>(m_binding.value(), std::move(options));
        dropdown.set_on_change([this] { m_binding.commit(); });
        m_widget = &dropdown;
    }

private:
    void apply_theme_defaults(const Theme& theme) override {
        ConfigFieldBase::apply_theme_defaults(theme);
        configure_input(static_cast<DropdownWidget&>(*m_widget).trigger(), {10.0F, 6.0F}, theme);
    }

    DatabaseBinding<std::string> m_binding;
};

template <typename T>
static ConfigField<T>& add_config_field(Container& parent, DatabaseBinding<T> binding, ConfigFieldInfo info) {
    return parent.add<ConfigField<T>>(std::move(binding), std::move(info));
}

static ConfigDropdownField& add_config_dropdown(
    Container& parent, DatabaseBinding<std::string> binding, ConfigFieldInfo info, std::vector<DropdownOption> options
) {
    return parent.add<ConfigDropdownField>(std::move(binding), std::move(info), std::move(options));
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

ConfigTab::ConfigTab() : UITab("config") {}

void ConfigTab::setup() {
    m_content_layout = &add<Container>("##config-content");
    m_content_layout->set_size({grow(), grow()});
    m_content_layout->set_spacing(6.0F);
    m_content_layout->set_scrollable(true);
    m_content_layout->configure_all_styles([](Style& style) { style.padding({12.0F, 12.0F}); });

    if (database == nullptr) {
        LOG_WARN("[ConfigTab] cant build config layout (database is nullptr)");
        return;
    }

    build();
}

void ConfigTab::build() {
    // credentials(id): https://osu.ppy.sh/home/account/edit#oauth
    add_config_field(*m_content_layout, DATABASE_FIELD(database, credentials->id), {"osu! id", "OAuth application ID"});

    // credentials(secret): https://osu.ppy.sh/home/account/edit#oauth
    add_config_field(
        *m_content_layout, DATABASE_FIELD(database, credentials->secret), {"osu! secret", "OAuth application SECRET"}
    );

    // stable path
    add_config_field(
        *m_content_layout, DATABASE_FIELD(database, osu_data->stable_path), {"stable location", "osu! stable location"}
    );

    // lazer path
    add_config_field(*m_content_layout, DATABASE_FIELD(database, osu_data->lazer_path), {"lazer location", "lazer location"});

    // client mode
    add_config_dropdown(
        *m_content_layout, bind_osu_client_type(*database), {"current osu client", "select current osu client"},
        {{"stable", "stable"}, {"lazer", "lazer"}}
    );

    // radio: background image
    add_config_field(
        *m_content_layout, DATABASE_FIELD(database, radio_background),
        {"radio background", "enable background image in radio tab"}
    );
}
