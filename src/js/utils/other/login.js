export const check_login = async (id, secret) => {

    const data = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: id,
        client_secret: secret,
        scope: 'public'
    });
    
    const options = {
        method: 'POST',
        headers: {
            "Accept": "application/json",
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: data
    };
        
    const response = await fetch(`https://osu.ppy.sh/oauth/token`, options);
    const r_data = await response.json();

    if (!r_data) {
        return null;
    }
    
    return { 
        access_token: r_data.access_token,
        expires_in: r_data.expires_in
    }
};
