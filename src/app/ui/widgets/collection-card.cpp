#include "collection-card.hpp"
#include "../../../ui/ui.hpp"
#include "../../../ui/core/draw.hpp"
#include "../theme.hpp"
#include "../../../ui/constants.hpp"

constexpr float ALPHA_ANIM_SPEED = 12.0f;
constexpr ImVec2 ICON_SIZE = {16.0f, 16.0f};

CollectionCardWidget::CollectionCardWidget(std::string name)
    : ui::Widget("collection-card"), m_name(name), m_count("0 maps") {

    UI& ui = ui::current();
    ui::Style& active_style = state().get_style(ui::StyleType::ACTIVE);
    ui::Style& hover_style = state().get_style(ui::StyleType::HOVER);

    auto music_icon = ui.get_texture("music-icon");

    ImFont* font = ui.get_font(ui::FontType::SEMIBOLD).get(18);
    m_font_small = ui.get_font(ui::FontType::SEMIBOLD).get(14);

    state().set_for_all_styles([&](ui::Style& style) {
        style.font = font;

        style.border_thickness = 2.0f;

        style.border_color.value = app_theme::TRANSPARENT;
        style.border_color.speed = ALPHA_ANIM_SPEED;

        style.background_color.value = app_theme::TRANSPARENT;
        style.background_color.speed = ALPHA_ANIM_SPEED;
    });

    active_style.border_color.value = app_theme::ACCENT_COLOR_HALF;
    active_style.background_color.value = app_theme::ACCENT_COLOR_SECONDARY;
    hover_style.border_color.value = app_theme::ACCENT_COLOR_HALF;

    auto icon = std::make_unique<ui::ImageWidget>();
    m_icon = icon.get();
    m_icon->set_texture(music_icon);
    m_icon->set_size(ICON_SIZE);

    m_icon->state().set_for_all_styles([&](ui::Style& style) { style.color.set(app_theme::ACCENT_COLOR); });

    auto title = std::make_unique<ui::CachedTextNode>("collection-title", m_name, font);
    m_title = title.get();

    auto count = std::make_unique<ui::CachedTextNode>("collection-count", m_count, m_font_small);
    m_count_label = count.get();

    m_icon->layout().set_anchor(ui::Anchor::CenterLeft);
    m_icon->layout().set_origin(ui::Origin::CenterLeft);

    m_title->layout().set_anchor(ui::Anchor::CenterLeft);
    m_title->layout().set_origin(ui::Origin::CenterLeft);
    m_title->layout().set_offset({ICON_SIZE.x + 10.0F, 0.0F});

    m_count_label->layout().set_anchor(ui::Anchor::CenterRight);
    m_count_label->layout().set_origin(ui::Origin::CenterRight);

    add_child(std::move(icon));
    add_child(std::move(title));
    add_child(std::move(count));
}

void CollectionCardWidget::set_selected(bool value) {
    m_selected = value;
}

void CollectionCardWidget::toggle_selected() {
    m_selected = !m_selected;
}

bool CollectionCardWidget::is_selected() const {
    return m_selected;
}

std::optional<std::string> CollectionCardWidget::get_content() const {
    return m_name.str();
}

bool CollectionCardWidget::set_content(std::string content) {
    if (content == m_name.str()) {
        return false;
    }

    m_name.set(std::move(content));
    return true;
}

void CollectionCardWidget::on_layout() {
    ImVec2 size = m_size;

    // collection card will always use the full width
    const ImVec2 available = ImGui::GetContentRegionAvail();
    size.x = available.x;
    layout().set_size(size);
}

void CollectionCardWidget::on_draw() {
    if (!state().is_visible()) {
        skip_draw();
        return;
    }

    const ui::Style& style = state().get_style();

    const ImVec2 size = layout().size();

    ImGui::PushStyleVar(ImGuiStyleVar_ChildRounding, app_theme::BOX_ROUNDING);
    ImGui::PushStyleVar(ImGuiStyleVar_FramePadding, {0.0f, 0.0f});
    ImGui::PushStyleVar(ImGuiStyleVar_Alpha, state().get_opacity());
    ImGui::PushStyleColor(ImGuiCol_ChildBg, style.background_color.get());
    ImGui::PushStyleColor(ImGuiCol_FrameBg, app_theme::TRANSPARENT);
    ImGui::PushStyleColor(ImGuiCol_FrameBgHovered, app_theme::TRANSPARENT);
    ImGui::PushStyleColor(ImGuiCol_FrameBgActive, app_theme::TRANSPARENT);
    ImGui::PushID(this);

    ImGui::BeginChild(
        "##collection-card", size, ImGuiChildFlags_AlwaysUseWindowPadding, constants::WIDGET_WINDOW_FLAGS
    );
    {
        ImGui::PushFont(style.font);
    }
}

void CollectionCardWidget::on_draw_end() {
    ui::InputRouter& router = ui::current().input_router();

    const ui::Style& style = state().get_style();
    const float dt = ImGui::GetIO().DeltaTime;

    ui::draw_child_rect(style.border_color.get_col(), style.border_radius, style.border_thickness);
    ImGui::PopFont();
    ImGui::EndChild();
    ImGui::PopID();
    ImGui::PopStyleVar(3);
    ImGui::PopStyleColor(4);

    const ui::LastItemState input = router.handle_last_item(*this, {.accepts_input = state().accepts_input()});

    if (m_selected) {
        state().set_style(ui::StyleType::ACTIVE);
    } else {
        state().set_item_state(input.hovered, input.active);
    }

    state().update(dt);
}
