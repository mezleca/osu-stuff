#include "modal-container.hpp"

#include "../ui.hpp"

#include <SDL3/SDL_keycode.h>

namespace ui {
    static ModalPanel* active_modal(const Node& container) {
        for (auto it = container.children().rbegin(); it != container.children().rend(); ++it) {
            if ((*it)->visible()) {
                return static_cast<ModalPanel*>(it->get());
            }
        }

        return nullptr;
    }

    ModalContainer::ModalContainer(UI& ui) : Node("modal-container"), m_ui(ui), m_input_router(ui.input_router()) {
        set_visible(true);

        _on_event = [this](UiEvent& event) {
            if (!has_open_modal()) {
                return;
            }

            const bool clicked_outside = (event.type == EventType::Click || event.type == EventType::PointerDown) &&
                                         event.button == PointerButton::Left &&
                                         (event.position.x < m_panel_min.x || event.position.x > m_panel_max.x ||
                                          event.position.y < m_panel_min.y || event.position.y > m_panel_max.y);
            const bool pressed_escape =
                event.type == EventType::Cancel || (event.type == EventType::KeyDown && event.key == SDLK_ESCAPE);

            if (pressed_escape || clicked_outside) {
                close_top();
                event.stop_propagation();
            }
        };
    }

    ModalPanel& ModalContainer::open(std::string id) {
        if (ModalPanel* current = active(); current != nullptr) {
            current->set_visible(false);
        }

        ModalPanel& modal = add_child<ModalPanel>(m_ui, std::move(id));
        modal.set_visible(true);
        modal.fade_in();

        m_input_router.set_layer_policy(InputLayer::Modal, InputPolicy::BlockAll);
        m_input_router.set_keyboard_target(*this);
        return modal;
    }

    bool ModalContainer::close(ModalPanel& modal) {
        if (!contains(&modal) || m_pending_close == &modal) {
            return false;
        }

        // hide immediately so hit testing stops this frame, but defer ownership
        // removal until update to avoid mutating children during draw/event dispatch.
        const bool was_active = active() == &modal;
        modal.set_visible(false);
        m_pending_close = &modal;

        if (was_active) {
            if (ModalPanel* previous = active(); previous != nullptr) {
                previous->set_visible(true);
            } else {
                m_input_router.set_layer_policy(InputLayer::Modal, InputPolicy::PassThrough);
            }
        }

        return true;
    }

    void ModalContainer::close_top() {
        if (ModalPanel* current = active(); current != nullptr) {
            close(*current);
        }
    }

    ModalPanel* ModalContainer::active() {
        return active_modal(*this);
    }

    const ModalPanel* ModalContainer::active() const {
        return active_modal(*this);
    }

    bool ModalContainer::has_open_modal() const {
        return active() != nullptr;
    }

    void ModalContainer::on_update(float) {
        remove_pending_modal();

        if (has_open_modal()) {
            return;
        }

        // external visibility changes can leave no active panel without calling
        // close(), so input policy is reconciled every update.
        m_input_router.set_layer_policy(InputLayer::Modal, InputPolicy::PassThrough);
        m_input_router.clear_keyboard_target(InputLayer::Modal);
        m_input_router.clear_focus(*this);
        m_input_router.release_pointer(*this);
    }

    void ModalContainer::remove_pending_modal() {
        if (m_pending_close == nullptr) {
            return;
        }

        ModalPanel* modal = m_pending_close;
        m_pending_close = nullptr;

        m_input_router.clear_focus(*modal);
        m_input_router.clear_keyboard_target(*modal);
        static_cast<void>(remove(*modal));

        if (active() == nullptr) {
            m_input_router.set_layer_policy(InputLayer::Modal, InputPolicy::PassThrough);
            m_input_router.clear_keyboard_target(InputLayer::Modal);
        }
    }

    bool ModalContainer::on_draw() {
        if (!has_open_modal()) {
            return false;
        }

        const ImGuiViewport* viewport = ImGui::GetMainViewport();
        ImGui::SetNextWindowPos(viewport->WorkPos);
        ImGui::SetNextWindowSize(viewport->WorkSize);
        ImGui::PushStyleVar(ImGuiStyleVar_WindowPadding, ImVec2{0.0F, 0.0F});
        ImGui::PushStyleVar(ImGuiStyleVar_WindowRounding, 0.0F);
        ImGui::PushStyleVar(ImGuiStyleVar_WindowBorderSize, 0.0F);
        ImGui::PushStyleColor(ImGuiCol_WindowBg, ImVec4{0.0F, 0.0F, 0.0F, 0.0F});

        ImGui::Begin(
            "##ui-modal-container", nullptr,
            ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove | ImGuiWindowFlags_NoResize |
                ImGuiWindowFlags_NoSavedSettings
        );
        m_backdrop_min = ImGui::GetWindowPos();
        m_backdrop_max = {m_backdrop_min.x + ImGui::GetWindowSize().x, m_backdrop_min.y + ImGui::GetWindowSize().y};
        m_input_router.register_region_in_layer(*this, Rect{m_backdrop_min, m_backdrop_max}, InputLayer::Modal);
        ImGui::GetWindowDrawList()->AddRectFilled(m_backdrop_min, m_backdrop_max, ImColor(0.0F, 0.0F, 0.0F, 0.42F));
        return true;
    }

    void ModalContainer::draw_children() {
        if (ModalPanel* current = active(); current != nullptr) {
            current->draw();
            const Rect panel = current->layout().screen_rect();
            m_panel_min = panel.min;
            m_panel_max = panel.max;
        }
    }

    void ModalContainer::on_draw_end() {
        ImGui::End();
        ImGui::PopStyleColor();
        ImGui::PopStyleVar(3);
    }
} // namespace ui
