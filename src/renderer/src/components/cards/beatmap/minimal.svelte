<script lang="ts">
    import type { BeatmapCardViewState } from "@shared/types";
    import { open_on_browser } from "../../../lib/utils/utils";
    import { get_diff_color, get_diff_text_color } from "../../../lib/utils/card-utils";

    export let view_state: BeatmapCardViewState;
    export let on_contextmenu: (event: MouseEvent) => void = null;

    const open_beatmapset = (event: MouseEvent) => {
        event.stopPropagation();
        open_on_browser(view_state.beatmap?.beatmapset_id ?? -1);
    };
</script>

<span
    class="star-rating"
    style={`color: ${get_diff_text_color(view_state.star_rating)}; background-color: ${get_diff_color(view_state.star_rating)};`}
>
    ★ {view_state.formatted_star_rating}
</span>

<button tabindex="0" onclick={open_beatmapset} oncontextmenu={on_contextmenu}>
    {view_state.beatmap?.difficulty ?? "unknown"}
</button>

<style>
    .star-rating {
        height: max-content;
        margin-right: 6px;
        padding: 0 8px;
        border-radius: 6px;
        color: black;
        font-size: 12px;
        font-family: "Torus SemiBold";
    }

    button {
        min-width: 0;
        padding: 0;
        border: none;
        border-radius: 0;
        background: none;
        text-align: start;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: background 0.2s ease;
        font-size: 12px;
        font-family: "Torus SemiBold";
    }

    button:hover {
        cursor: pointer;
        background: rgba(255, 255, 255, 0.1);
    }
</style>
