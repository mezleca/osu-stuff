const { auth } = require("osu-api-extended");

export const check_login = async (id, secret) => {

    const auth_login = auth.login(id, secret, ['public']);

    if (!auth_login) {
        return null;
    }

    return auth_login;
};
