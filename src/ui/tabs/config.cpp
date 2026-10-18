#include "detail.hpp"
#include "../app.hpp"
#include "../../database/database.hpp"
#include "../../utils/log.hpp"
#include "../../clients/detail.hpp"

#include <imgui-ui/surface.hpp>
#include <imgui-ui/widgets/checkbox.hpp>
#include <imgui-ui/widgets/dropdown.hpp>
#include <imgui-ui/widgets/number-input.hpp>
#include <imgui-ui/widgets/text.hpp>
#include <imgui-ui/widgets/text-input.hpp>
#include <string>
#include <type_traits>
#include <utility>

using namespace ui;

struct ConfigFieldInfo {
    std::string label;
    std::string description;
};

static std::string display_label(const ConfigFieldInfo& info) {
    return info.description.empty() ? info.label : info.label + " (?)";
}

class ConfigItem : public Container {
public:
    explicit ConfigItem(std::string label) : Container({}, StackDirection::Vertical) {
        set_spacing(7.0F);
        set_size({grow(), fit()});
        configure_all_styles([](Style& style) { style.padding({5.0F, 5.0F}); });

        if (!label.empty()) m_label = &add<TextWidget>(std::move(label));
    }

    void set_description(std::string description) {
        if (m_label != nullptr && !description.empty()) m_label->set_tooltip(std::move(description));
    }

protected:
    void apply_theme_defaults(const Theme& theme) override {
        Container::apply_theme_defaults(theme);

        if (m_label != nullptr) {
            m_label->set_font(surface().get_font("Torus Bold"), 18.0F);
        }
    }

private:
    TextWidget* m_label = nullptr;
};

template <typename T>
class ConfigField final : public ConfigItem {
public:
    ConfigField(DatabaseBinding<T> binding, ConfigFieldInfo info)
        : ConfigItem(take_item_label(info)), m_binding(std::move(binding)) {
        if constexpr (std::is_same_v<T, bool>) {
            auto& checkbox = add<CheckboxWidget>(m_binding.value(), display_label(info));
            checkbox.on_change([this] { m_binding.commit(); });
            if (!info.description.empty()) checkbox.label().set_tooltip(std::move(info.description));
        } else if constexpr (std::is_same_v<T, std::string>) {
            auto& input = add<TextInputWidget>(m_binding.value());
            input.on_change([this] { m_binding.commit(); });
            set_description(std::move(info.description));
        } else {
            static_assert(std::is_arithmetic_v<T>);
            auto& input = add<NumberInputWidget<T>>(m_binding.value());
            input.on_change([this] { m_binding.commit(); });
            set_description(std::move(info.description));
        }
    }

private:
    static std::string take_item_label(ConfigFieldInfo& info) {
        if constexpr (std::is_same_v<T, bool>) {
            return {};
        }

        return display_label(info);
    }

    DatabaseBinding<T> m_binding;
};

class ConfigDropdownField final : public ConfigItem {
public:
    ConfigDropdownField(DatabaseBinding<std::string> binding, ConfigFieldInfo info, std::vector<DropdownOption> options)
        : ConfigItem(display_label(info)), m_binding(std::move(binding)) {
        auto& dropdown = add<DropdownWidget>(m_binding.value(), std::move(options));
        dropdown.on_change([this] { m_binding.commit(); });
        set_description(std::move(info.description));
    }

private:
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
