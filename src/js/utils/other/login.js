export const osu_login = async (id, secret) => {

    const form_data = new FormData();

    form_data.append("grant_type", 'client_credentials');
    form_data.append("client_id", id);
    form_data.append("client_secret", secret);
    form_data.append("scope", "public");
        
    const response = await fetch(`https://osu.ppy.sh/oauth/token`, { method: 'POST', body: form_data });
    const data = await response.json();

    if (!data) {
        return null;
    }
    
    return data;
};
