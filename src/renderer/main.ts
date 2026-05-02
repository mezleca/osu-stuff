import { mount } from "svelte";

import App from "./App.svelte";
import "./assets/app.css";

const app = mount(App, {
    // @ts-ignore
    target: document.getElementById("app")
});

export default app;
