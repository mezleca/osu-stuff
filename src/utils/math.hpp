#pragma once

#include <algorithm>

namespace math_utils {
    inline float lerp(float a, float b, float t) {
        return a + ((b - a) * t);
    }

    inline float smoothstep(float t) {
        return (t * t) * (3.0f - (2.0f * t));
    }

    inline float clampf(float v, float lo, float hi) {
        return std::clamp(v, lo, hi);
    }
} // namespace math_utils
