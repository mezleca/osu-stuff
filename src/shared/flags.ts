export type Flags = number;

export const has_flag = (flags: Flags, flag: Flags): boolean => {
    return (flags & flag) == flag;
};

export const has_any_flag = (flags: Flags, flag: Flags): boolean => {
    return (flags & flag) != 0;
};

export const add_flag = (flags: Flags, flag: Flags): Flags => {
    return flags | flag;
};

export const remove_flag = (flags: Flags, flag: Flags): Flags => {
    return flags & ~flag;
};

export const toggle_flag = (flags: Flags, flag: Flags): Flags => {
    return flags ^ flag;
};
