import type { Awaitable } from "@sapphire/utilities";
import type { ButtonInteraction, ExcludeEnum, InteractionButtonOptions, InteractionCollector, Message, MessageComponentInteraction, MessageEmbed, MessageOptions, MessageSelectMenuOptions, SelectMenuInteraction, User } from "discord.js";
import type { MessageButtonStyles, MessageComponentTypes } from "discord.js/typings/enums";
import type { PaginatedComponentMessage } from "./PaginatedComponentMessage";

export interface PaginatedComponentMessageOptions {
    /**
     * Whether this {@link PaginatedComponentMessage}
     * is paginated. If true, this message will include
     * the page controller.
     * @default ```true```
     */
    isPaginated?: boolean;

    /**
     * Pages to display in this {@link PaginatedComponentMessage}
     */
    pages?: MessageOptions[];

    /**
     * The template for this {@link PaginatedComponentMessage}.
     * You can use template to set defaults that will apply
     * to each and every page in the {@link PaginatedComponentMessage}.
     * @remark This template is applied only when
     * {@link PaginatedComponentMessage.isPaginated} is set to true.
     */
    template?: MessageEmbed | MessageOptions;

    /**
     * Whether this {@link PaginatedComponentMessage} loads pages
     * when requested.
     * @default ```false```
     */
    lazyLoad?: boolean;
}

export interface PaginatedComponentMessageActionContext {
    interaction: ButtonInteraction | SelectMenuInteraction;
    handler: PaginatedComponentMessage;
    author: User;
    channel: Message['channel'];
    collector: InteractionCollector<MessageComponentInteraction>;
}

export type PaginatedComponentMessageAction = PaginatedComponentMessageActionButton | PaginatedComponentMessageActionMenu;

export interface PaginatedComponentMessageActionButton extends Omit<InteractionButtonOptions, 'style'> {
    type: ExcludeEnum<typeof MessageComponentTypes, 'SELECT_MENU' | 'ACTION_ROW'>;
    style: ExcludeEnum<typeof MessageButtonStyles, 'LINK'>;
    run(context: PaginatedComponentMessageActionContext): Awaitable<unknown>;
}

export interface PaginatedComponentMessageActionMenu extends Omit<MessageSelectMenuOptions, 'customId'> {
    customId: string;
    type: ExcludeEnum<typeof MessageComponentTypes, 'BUTTON' | 'ACTION_ROW'>;
    run(context: PaginatedComponentMessageActionContext): Awaitable<unknown>;
}
