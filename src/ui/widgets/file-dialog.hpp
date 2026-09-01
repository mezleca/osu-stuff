#pragma once

#include <ui/layout/stack-container.hpp>
#include <nfd.hpp>
#include <filesystem>
#include <string>

class IconTexture;
class UI;

// TODO: multiple folders

namespace ui {
    class ImageWidget;
    class TextWidget;

    class FileDialogWidget final : public StackContainer {
    public:
        explicit FileDialogWidget(UI& ui, std::string label, std::string id = "FileDialog");

        std::filesystem::path select_file(std::vector<nfdfilteritem_t> filter);
        std::vector<std::filesystem::path> select_files(std::vector<nfdfilteritem_t> filter);
        std::filesystem::path select_folder();

        bool set_value(std::string_view value);
        std::string& get_value();

    private:
        UI& m_ui;
        TextWidget* m_field;
        std::string m_label;
    };
} // namespace ui
