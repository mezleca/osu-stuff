#include "modal-panel.hpp"

#include "../ui.hpp"
#include "../style/theme.hpp"

#include <algorithm>

namespace ui {
    ModalPanel::ModalPanel(UI& ui, std::string id) : StackContainer(std::move(id)) {
        set_widget_type(WidgetType::ModalPanel);

        set_size({480.0F, 220.0F});
        set_anchor(Anchor::Center);
        set_origin(Origin::Center);
        set_margin({48.0F, 48.0F});
        set_spacing(10.0F);

        const Theme& theme = ui.theme();
        style()
            .padding({24.0F, 24.0F})
            .background_color(theme.background_color)
            .border(BORDER_ALL)
            .border_color(theme.border_color)
            .border_radius(8.0F);
    }

    ModalPanel& ModalPanel::set_margin(ImVec2 margin) {
        m_margin = {std::max(0.0F, margin.x), std::max(0.0F, margin.y)};
        return *this;
    }

    const ImVec2& ModalPanel::margin() const {
        return m_margin;
    }

    void ModalPanel::on_layout() {
        const ImVec2 available = ImGui::GetContentRegionAvail();
        const ImVec2 maximum = {
            std::max(0.0F, available.x - m_margin.x * 2.0F),
            std::max(0.0F, available.y - m_margin.y * 2.0F),
        };

        const ImVec2 desired = layout().desired_size();

        const ImVec2 resolved = {
            desired.x <= 0.0F ? maximum.x : std::min(desired.x, maximum.x),
            desired.y <= 0.0F ? maximum.y : std::min(desired.y, maximum.y),
        };

        resolve_size(resolved);
        arrange_children(resolved);
    }
} // namespace ui
