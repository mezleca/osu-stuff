import { create_alert } from "../../popup/popup.js"

export const osu_login = async (id, secret) => {

    try {

        const form_data = new FormData();

        form_data.append("grant_type", 'client_credentials');
        form_data.append("client_id", id);
        form_data.append("client_secret", secret);
        form_data.append("scope", "public");
            
        const response = await fetch(`https://osu.ppy.sh/oauth/token`, { method: 'POST', body: form_data });
        const data = await response.json();

        if (response.status != 200) {
            create_alert("failed to login<br>make sure your osu_id/secret is valid", { type: "error", seconds: 10 });
            return null;
        }
        
        return data;
    } catch(err) {
        console.log("[Login] error:", err);
        return null;
    }
};
