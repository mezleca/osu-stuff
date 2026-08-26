#pragma once

#include <ui/layout/stack-container.hpp>

#include <functional>
#include <string>
#include <vector>

class UI;
class ContextMenuWidget;
class ContextMenuField;

using ContextMenuCallback = std::function<void(ContextMenuWidget&)>;

struct ContextMenuItem {
    std::string name{};
    std::vector<ContextMenuItem> children{};
    ContextMenuCallback on_click{};
};

using ContextMenuList = std::vector<ContextMenuItem>;

class ContextMenuWidget : public ui::StackContainer {
public:
    ContextMenuWidget(UI& ui, ContextMenuList items = {});

    bool build(ContextMenuList items = {});

    void show();
    void show(ImVec2 screen_position);
    void hide();
    void cancel_close_request();

    [[nodiscard]] bool is_open() const {
        return m_open;
    }

private:
    friend class ContextMenuField;

    void on_update(float) override;
    void draw_children() override;
    void on_draw_end() override;

    void activate_item(ContextMenuField& field);
    void open_submenu(ContextMenuField& field);
    void open();
    void position_submenu(ContextMenuWidget& submenu, const ui::Node& field);
    ContextMenuWidget& root_menu();
    bool contains(ImVec2 position) const;
    void close_children();

    UI& m_ui;
    std::vector<ContextMenuField*> m_fields;
    ContextMenuWidget* m_parent_menu = nullptr;
    ContextMenuField* m_hovered_field = nullptr;
    ContextMenuField* m_hover_target = nullptr;
    float m_hover_duration = 0.0F;
    float m_outside_duration = 0.0F;
    bool m_open = false;
    bool m_close_requested = false;
};
