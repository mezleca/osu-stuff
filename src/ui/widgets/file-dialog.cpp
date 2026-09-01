#include "file-dialog.hpp"

#include <ui/style/theme.hpp>
#include <ui/ui.hpp>
#include <ui/widgets/text.hpp>

using namespace ui;

FileDialogWidget::FileDialogWidget(UI& ui, std::string label, std::string id)
    : StackContainer(std::move(id), StackDirection::Horizontal), m_ui(ui), m_label(label) {
    const Theme& theme = m_ui.theme();

    set_input_target();
    set_type_name("TextInput");
    set_accepts_focus(true);
    set_center_content(true, true);
    fit_content_height();
    set_font(ui.get_primary_font(18));

    configure_all_styles([&theme](Style& style) {
        style.border_color(theme.border_color, 0.15F)
            .padding({14.0F, 18.0F})
            .background_color(theme.background_color)
            .border(BORDER_ALL)
            .border_radius(theme.box_rounding)
            .border_style(BorderStyle::Dashed);
    });

    configure_style(StyleType::HOVER, [&theme](Style& style) {
        style.background_color(theme.background_secondary_color).border_color(theme.accent_color);
    });

    m_field = &add_child<TextWidget>(m_label);
    m_field->configure_all_styles([&theme](Style& style) {
        style.color(theme.text_color).background_color(theme.transparent).padding({}).border(BORDER_NONE);
    });
}

std::filesystem::path FileDialogWidget::select_file(std::vector<nfdfilteritem_t> filter) {
    NFD::UniquePath output;
    auto result = NFD::OpenDialog(output, filter.data(), static_cast<nfdfiltersize_t>(filter.size()));

    if (result != NFD_OKAY) {
        return {};
    }

    return output.get();
}

std::vector<std::filesystem::path> FileDialogWidget::select_files(std::vector<nfdfilteritem_t> filter) {
    NFD::UniquePathSet output;
    auto result = NFD::OpenDialogMultiple(output, filter.data(), static_cast<nfdfiltersize_t>(filter.size()));

    if (result != NFD_OKAY) {
        return {};
    }

    std::vector<std::filesystem::path> data;

    nfdpathsetsize_t path_count;
    NFD::PathSet::Count(output, path_count);

    for (nfdpathsetsize_t i = 0; i < path_count; ++i) {
        NFD::UniquePathSetPath path;
        NFD::PathSet::GetPath(output, i, path);
        data.push_back(path.get());
    }

    return data;
}

std::filesystem::path FileDialogWidget::select_folder() {
    NFD::UniquePath output;
    auto result = NFD::PickFolder(output);

    if (result != NFD_OKAY) {
        return {};
    }

    return output.get();
}

std::string& FileDialogWidget::get_value() {
    return m_label;
}

bool FileDialogWidget::set_value(std::string_view value) {
    if (m_label == value) {
        return false;
    }

    m_label = value;
    m_field->set_text(get_value());
    notify_change();
    return true;
}
