#include "widget.hpp"
#include "../utils/math.hpp"

#include <imgui.h>

static auto get_anim_entry(std::unordered_map<std::string, WidgetAnim>& anims, std::string_view name) -> WidgetAnim& {
    return anims.try_emplace(std::string(name), WidgetAnim{}).first->second;
}

static auto find_anim_entry(const std::unordered_map<std::string, WidgetAnim>& anims, std::string_view name)
    -> const WidgetAnim* {
    const auto it = anims.find(std::string(name));

    if (it == anims.end()) {
        return nullptr;
    }

    return &it->second;
}

void WidgetState::configure_anim(std::string_view name, float initial_value, float speed) {
    auto& anim = get_anim_entry(anims, name);
    anim.value = initial_value;
    anim.target = initial_value;
    anim.speed = speed;
}

void WidgetState::set_anim_target(std::string_view name, float target, float speed) {
    auto& anim = get_anim_entry(anims, name);
    anim.target = target;
    anim.speed = speed;
}

void WidgetState::set_anim_value(std::string_view name, float value) {
    auto& anim = get_anim_entry(anims, name);
    anim.value = value;
    anim.target = value;
}

float WidgetState::get_anim(std::string_view name, float fallback) const {
    const auto* anim = find_anim_entry(anims, name);

    if (anim == nullptr) {
        return fallback;
    }

    return anim->value;
}

void WidgetState::tick() {
    const float dt = ImGui::GetIO().DeltaTime;

    for (auto& [_, anim] : anims) {
        anim.value = exp_lerp(anim.value, anim.target, anim.speed, dt);
    }
}
