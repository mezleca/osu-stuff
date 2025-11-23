export type ContextMenuOption = {
    id: string;
    text: string;
    data?: ContextMenuOption[];
};

export type ContextEventData = {
    detail: { item: ContextMenuOption };
};

export type ContextAtPosition = "point" | "below" | "top";
