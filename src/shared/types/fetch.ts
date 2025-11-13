import { IFetchResponse } from "./ipc";

export enum FetchError {
    UNKNOWN = -1,
    MISSING_URL = 1,
    INVALID_URL,
    MEDIA_ERROR
}

export type FetchOptions = {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
    form_data?: Record<string, string>;
};

export const get_fetch_error = (level: FetchError): string => {
    switch (level) {
        case FetchError.UNKNOWN:
            return "";
        case FetchError.MEDIA_ERROR:
            return "failed to get media";
        case FetchError.MISSING_URL:
            return "missing url";
        case FetchError.INVALID_URL:
            return "invalid url";
    }
};

export const build_fetch_options = (options: Partial<FetchOptions> = {}): FetchOptions => {
    return {
        method: "GET",
        url: "",
        headers: {},
        ...options
    };
};

export const build_fetch_result = (result: Partial<IFetchResponse> = {}): IFetchResponse => {
    return {
        success: false,
        status: 0,
        headers: {},
        ...result
    };
};
