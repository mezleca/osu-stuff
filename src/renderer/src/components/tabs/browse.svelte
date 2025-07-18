<script>
    // components
    import ExpandableMenu from "../utils/expandable-menu.svelte";
    import Search from "../utils/search.svelte";

    // icons
    import Add from "../utils/add.svelte";

    const test = () => {
        console.log("hey bro");
    };
</script>

<div class="content tab-content">
    <div class="manager-content">
        <div class="content-header">
            <Search placeholder="search local beatmaps" />
            <ExpandableMenu></ExpandableMenu>
        </div>
        <div class="beatmaps-container">
            <!-- svelte-ignore a11y_consider_explicit_label -->
            <Add callback={test} />
            <div class="manager-beatmaps-container"></div>
        </div>
    </div>
</div>
