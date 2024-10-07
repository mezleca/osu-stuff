import { core } from "../config.js";

export const osu_fetch = async (url) => {
    try {
        const response = await fetch(url, {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": `Bearer ${core.login.access_token}`
            }
        });
        return await response.json();
    } catch (error) {
        console.error("fetch failed:", error);
        return null;
    }
};