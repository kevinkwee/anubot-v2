import { isGuildBasedChannel, isMessageInstance } from '@sapphire/discord.js-utilities';
import { container } from '@sapphire/framework';
import { Time } from '@sapphire/time-utilities';
import { Awaitable, deepClone, isFunction, isNullish, isNullOrUndefinedOrEmpty } from '@sapphire/utilities';
import {
    ButtonInteraction,
    Collection,
    Constants,
    InteractionCollector,
    Message,
    MessageActionRow,
    MessageComponentInteraction,
    MessageEmbed,
    MessageOptions,
    MessageSelectMenu,
    SelectMenuInteraction,
    Snowflake,
    TextBasedChannel,
    User,
} from 'discord.js';

import type { PaginatedComponentMessageAction, PaginatedComponentMessageActionMenu, PaginatedComponentMessageOptions } from "./PaginatedComponentMessageTypes";

/**
 * This is a {@link PaginatedComponentMessage}, a utility to create a component message, either paginated or not.
 */
export class PaginatedComponentMessage {
    /**
     * Whether this {@link PaginatedComponentMessage}
     * is paginated. If true, this message will include
     * the page controller.
     * @default ```true```
     */
    public readonly isPaginated: boolean;

    /**
     * The pages to be converted to {@link PaginatedComponentMessage.resolvedPages}
     */
    public pages: MessageOptions[];

    /**
     * The pages which were converted from {@link PaginatedComponentMessage.pages}
     */
    public resolvedPages: (MessageOptions | null)[] = [];

    /**
     * The template for this {@link PaginatedComponentMessage}.
     * You can use template to set defaults that will apply
     * to each and every page in the {@link PaginatedComponentMessage}.
     * @remark This template is applied only when
     * {@link PaginatedComponentMessage.isPaginated} is set to true.
     */
    public template: MessageOptions;

    /**
     * The handler's current page index.
     */
    public index: number = 0;

    /**
     * The amount of milliseconds to idle before the message component
     * collector is closed.
     * @default 14.5 minutes
     * @remark This is to ensure it is a bit before interactions expire.
     */
    public idle = Time.Minute * 14.5;

    /**
     * Whether this {@link PaginatedComponentMessage} loads pages
     * when requested.
     * @default ```false```
     */
    public lazyLoad: boolean;

    /**
     * A list of `customId` that are bound to actions that will stop the {@link PaginatedComponentMessage}
     * @default []
     */
    public stopPaginatedComponentMessageCustomIds: string[] = [];

    /**
     * The message used to edit on page changes.
     */
    public message: Message | null = null;

    /**
     * The function executed when the {@link InteractionCollector} ends.
     */
    public onEnd: (reason: string) => Awaitable<unknown> = () => { };

    /**
     * The collector used for handling component interactions.
     */
    private collector: InteractionCollector<MessageComponentInteraction> | null = null;

    /**
     * The actions which are to be used and converted to {@link PaginatedComponentMessage.actionRows}
     */
    private actions = new Map<string, PaginatedComponentMessageAction>();

    /**
     * The action rows which are to be used and were converted from {@link PaginatedComponentMessage.actions}.
     * If {@link PaginatedComponentMessage.isPaginated} is set to true,
     * then index 0 is used for the page controller action buttons' row.
     * @remark The max number of rows is 5.  
     */
    private actionRows: MessageActionRow[] = [];

    /**
     * Constructor for the {@link PaginatedComponentMessage} class
     * @param __namedParamaters The {@link PaginatedComponentMessageOptions} for this instance of the {@link PaginatedComponentMessage} class.
     */
    constructor({
        isPaginated,
        pages,
        template,
        lazyLoad
    }: PaginatedComponentMessageOptions) {
        this.isPaginated = isPaginated ?? true;
        this.pages = pages ?? [];
        this.lazyLoad = lazyLoad ?? false;

        if (this.isPaginated) this.actionRows.push(new MessageActionRow());

        this.template = this.resolveTemplate(template);
    }

    /**
     * Sets the amount of time to idle before the paginator is closed.
     * @param idle The number to set the idle to.
     * @returns 
     */
    public setIdle(idle: number) {
        this.idle = idle;
        return this;
    }

    /**
     * Sets the function to be executed when {@link InteractionCollector} ends.
     * @param onEnd The function to set
     */
    public setOnEnd(onEnd: (reason: string) => Awaitable<unknown>) {
        this.onEnd = onEnd;
        return this;
    }

    /**
     * Sets the {@link PaginatedComponentMessage.stopPaginatedComponentMessageCustomIds} for this instance of {@link PaginatedComponentMessage}.
     * This will only apply to this one instance and no others.
     * @param stopPaginatedComponentMessageCustomIds The new `stopPaginatedComponenMessageCustomIds` to set
     * @returns The current instance of {@link PaginatedComponentMessage}
     */
    public setStopPaginatedComponentMessageCustomIds(stopPaginatedComponentMessageCustomIds: string[]) {
        this.stopPaginatedComponentMessageCustomIds = stopPaginatedComponentMessageCustomIds;
        return this;
    }

    /**
     * Adds a page to this PaginatedComponentMessage. This will be added as the last page.
     * @param page The page to add.
     */
    public addPage(page: MessageOptions) {
        this.pages.push(page);
        return this;
    }

    /**
     * Adds a page to this PaginatedComponentMessage using simple message content. This will be added as the last page.
     * @param content The message content to set.
     */
    public addPageContent(content: string) {
        return this.addPage({ content });
    }

    /**
     * Adds a page to this PaginatedComponentMessage using a {@link MessageEmbed}. This will be added as the last page.
     * @param embed The embed to add.
     */
    public addPageEmbed(embed: MessageEmbed | ((embed: MessageEmbed) => MessageEmbed)) {
        return this.addPage({ embeds: isFunction(embed) ? [embed(new MessageEmbed())] : [embed] });
    }

    /**
     * Adds page embeds to this PaginatedComponentMessage using a {@link MessageEmbed}. One embed per page.
     */
    public addPageEmbeds(embeds: MessageEmbed[]) {
        embeds.forEach((embed) => {
            this.addPageEmbed(embed);
        });
        return this;
    }

    /**
     * Adds actions to the spesific action row.
     * @param actions The actions to add.
     * @param rowIndex The index of action row where the actions will be added.
     * @remark ***DON'T** add any actions at index 0 of the action rows if this message is paginated. Index 0 will be used for the page controller action.*
     */
    public addActions(actions: PaginatedComponentMessageAction[], rowIndex: number) {
        for (const action of actions) this.addAction(action, rowIndex);
        return this;
    }

    /**
     * Adds an action to the spesific action row.
     * @param action The action to add
     * @param rowIndex The index of action row where the action will be added.
     * @remark ***DON'T** add any actions at index 0 of the action rows if this message is paginated. Index 0 will be used for the page controller action.*
     */
    public addAction(action: PaginatedComponentMessageAction, rowIndex: number) {
        // Throw error if this is paginated and the rowIndex is 0,
        // because the first action row will be used for the page controller action.
        if (this.isPaginated && rowIndex === 0) throw new Error('Don\'t add any actions at index 0 of the action rows if this message is paginated.');

        // Throw error if the specified action row
        // has reached the maximum width.
        const hasSelectMenu = !isNullOrUndefinedOrEmpty(
            this.actionRows[rowIndex]?.components.filter(
                (component) => component.type === 'SELECT_MENU'
            )
        );
        const actionRowsLimit = this.isPaginated ? 4 : 5;
        const hasReachedMaxWidth = this.actionRows[rowIndex]?.components.length === actionRowsLimit;
        if (hasSelectMenu || hasReachedMaxWidth) throw new Error(`The action row at index ${rowIndex} has reached the maximum width.`);

        this.actions.set(action.customId, action);

        this.actionRows[rowIndex] ??= new MessageActionRow();
        this.actionRows[rowIndex].addComponents(action);

        return this;
    }

    private async setUpMessage(channel: Message['channel']) {
        const page = this.resolvePage(this.index);

        if (this.isPaginated) {
            const action = PaginatedComponentMessage.pageControllerAction;

            this.actions.set(action.customId, action);

            const pageControllerSelectMenu = new MessageSelectMenu({
                ...action,
                options: this.pages.map((_, index) => ({
                    label: `Halaman ${index + 1}`,
                    value: index.toString()
                }))
            });

            this.actionRows[0].setComponents([
                pageControllerSelectMenu
            ]);
        }

        this.actionRows = this.actionRows.filter((value) => !isNullish(value));

        page.components = this.actionRows;

        this.message = await channel.send(page);
    }

    private setUpCollector(channel: TextBasedChannel, targetUser: User) {
        this.collector = new InteractionCollector<MessageComponentInteraction>(targetUser.client, {
            filter: (interaction) =>
                !isNullish(this.message)
                && interaction.isMessageComponent()
                && this.actions.has(interaction.customId),
            time: this.idle,
            guild: isGuildBasedChannel(channel) ? channel.guild : undefined,
            channel,
            interactionType: Constants.InteractionTypes.MESSAGE_COMPONENT,
            message: this.message
        })
            .on('collect', this.handleCollect.bind(this, targetUser, channel))
            .on('end', this.handleEnd.bind(this));
    }

    /**
     * Handles the `collect` event from the collector.
     * @param targetUser The user the handler is for.
     * @param channel The channel the handler is running at.
     * @param interaction The button interaction that was received.
     */
    private async handleCollect(
        targetUser: User,
        channel: Message['channel'],
        interaction: ButtonInteraction | SelectMenuInteraction
    ) {
        if (interaction.user.id === targetUser.id) {
            this.message = isMessageInstance(interaction.message) ? interaction.message : this.message;
            const action = this.actions.get(interaction.customId)!;
            const previousIndex = this.index;
            await action.run({
                interaction,
                handler: this,
                author: targetUser,
                channel,
                collector: this.collector!
            });

            if (!this.stopPaginatedComponentMessageCustomIds.includes(action.customId)) {
                const newIndex = previousIndex === this.index ? previousIndex : this.index;
                const page = this.resolvePage(newIndex);
                await interaction.update(page);
            }
        }
    }

    /**
     * Handles the `end` event from the collector.
     */
    private handleEnd(_: Collection<Snowflake, ButtonInteraction | SelectMenuInteraction>, reason: string) {
        this.collector?.removeAllListeners();

        if (!PaginatedComponentMessage.deletionStopReasons.includes(reason)) {
            this.message?.edit({ components: [] })
                .catch((err) => container.client.logger.error(err));
        }

        this.onEnd(reason);
    }

    /**
     * Handle the load of a page.
     * @param index The index of the current page.
     * @param page The page to be loaded.
     */
    private handlePageLoad(index: number, page: MessageOptions) {
        // If this PaginatedComponentMessage is not paginated, don't do anything:
        if (!this.isPaginated) return page;

        // Clone the template to leave the original intact
        const clonedTemplate = deepClone(this.template);

        // Apply the template to the page
        const pageWithTemplate = this.applyTemplate(clonedTemplate, page);

        // Apply the footer to the page
        return this.applyFooter(index, pageWithTemplate);
    }

    /**
     * Executes the {@link PaginatedComponentMessage} and sends the pages corresponding with {@link PaginatedComponentMessage.index}.
     * The handler will start collecting message component interactions.
     * @param channel The channel where this {@link PaginatedComponentMessage} will be sent.
     * @param targetUser The user who will be able to interact with the buttons of this {@link PaginatedComponentMessage}
     */
    public async run(
        channel: Message['channel'],
        targetUser: User
    ) {
        // Get the previous PaginatedComponentMessage for this user
        const paginatedMessage = PaginatedComponentMessage.handlers.get(targetUser.id);

        // If a PaginatedComponentMessage was found then stop it
        paginatedMessage?.collector?.stop();

        this.resolvePagesOnRun();

        // Sanity checks
        if (!this.resolvedPages.length) throw new Error('There are no messages.');
        if (!this.actions.size && !this.isPaginated) throw new Error('There are no actions.');

        await this.setUpMessage(channel);
        this.setUpCollector(channel, targetUser);

        if (this.collector) {
            this.collector.once('end', () => {
                PaginatedComponentMessage.handlers.delete(targetUser.id);
            });

            PaginatedComponentMessage.handlers.set(targetUser.id, this);
        }

        return this;
    }

    /**
     * Extecuted whenever {@link PaginatedComponentMessage.run} is called
     * and {@link PaginatedComponentMessage.lazyLoad} is false.
     */
    private resolvePagesOnRun() {
        if (this.lazyLoad) {
            this.resolvePage(this.index);
            return;
        }

        for (let i = 0; i < this.pages.length; i++) {
            this.resolvePage(i);
        }
    }

    /**
     * Executed whenever an action is triggered and resolved.
     * @param index The index to resolve.
     */
    private resolvePage(index: number) {
        // If the page was already resolved, do not load it again:
        let resolvedPage = this.resolvedPages[index];
        if (!isNullish(resolvedPage)) {
            return resolvedPage;
        }

        // Load page and return it:
        resolvedPage = this.handlePageLoad(index, this.pages[index]);
        this.resolvedPages[index] = resolvedPage;

        return resolvedPage;
    }

    private applyFooter(index: number, page: MessageOptions) {
        if (!page.embeds?.length) {
            return page;
        }

        const embeds = deepClone(page.embeds);

        const lastEmbedIndex = embeds.length - 1;
        const lastEmbed = embeds[lastEmbedIndex];
        if (lastEmbed) {
            lastEmbed.footer ??= { text: this.template.embeds?.[0]?.footer?.text ?? this.template.embeds?.[0]?.footer?.text ?? '' };
            lastEmbed.footer.text = `Halaman ${index + 1} dari ${this.pages.length}${lastEmbed.footer.text ? ` | ${lastEmbed.footer.text}` : ''}`;
        }

        return { ...page, embeds: embeds };
    }

    private applyTemplate(
        template: MessageOptions,
        page: MessageOptions
    ) {
        const embed = this.applyTemplateEmbed(template.embeds, page.embeds);

        return { ...template, ...page, embeds: embed };
    }

    private applyTemplateEmbed(
        templateEmbed: MessageOptions['embeds'],
        pageEmbeds: MessageOptions['embeds']
    ) {
        if (isNullish(pageEmbeds)) {
            return templateEmbed ? [templateEmbed[0]] : undefined;
        }

        if (isNullish(templateEmbed)) {
            return pageEmbeds;
        }

        return this.mergeEmbeds(templateEmbed[0], pageEmbeds);
    }

    private resolveTemplate(template?: MessageEmbed | MessageOptions): MessageOptions {
        if (template === undefined) {
            return {};
        }

        if (template instanceof MessageEmbed) {
            return { embeds: [template] };
        }

        return template;
    }

    private mergeEmbeds(
        templateEmbed: Exclude<MessageOptions['embeds'], undefined>[0],
        pageEmbeds: Exclude<MessageOptions['embeds'], undefined>
    ) {
        const mergedEmbeds: Exclude<MessageOptions['embeds'], undefined> = [];

        for (const pageEmbed of pageEmbeds) {
            mergedEmbeds.push({
                title: pageEmbed.title ?? templateEmbed.title ?? undefined,
                description: pageEmbed.description ?? templateEmbed.description ?? undefined,
                url: pageEmbed.url ?? templateEmbed.url ?? undefined,
                timestamp:
                    (typeof pageEmbed.timestamp === 'string' ? new Date(pageEmbed.timestamp) : pageEmbed.timestamp) ??
                    (typeof templateEmbed.timestamp === 'string' ? new Date(templateEmbed.timestamp) : templateEmbed.timestamp) ??
                    undefined,
                color: pageEmbed.color ?? templateEmbed.color ?? undefined,
                fields: this.mergeArrays(templateEmbed.fields, pageEmbed.fields),
                author: pageEmbed.author ?? templateEmbed.author ?? undefined,
                thumbnail: pageEmbed.thumbnail ?? templateEmbed.thumbnail ?? undefined,
                image: pageEmbed.image ?? templateEmbed.thumbnail ?? undefined,
                video: pageEmbed.video ?? templateEmbed.video ?? undefined,
                footer: pageEmbed.footer ?? templateEmbed.footer ?? undefined
            });
        }

        return mergedEmbeds;
    }

    private mergeArrays<T>(template?: T[], array?: T[]): undefined | T[] {
        if (isNullish(array)) {
            return template;
        }

        if (isNullish(template)) {
            return array;
        }

        return [...template, ...array];
    }

    /**
     * The page controller for this {@link PaginatedComponentMessage}.
     */
    private static pageControllerAction: PaginatedComponentMessageActionMenu = {
        customId: 'paginated-component-message.goToPage',
        type: Constants.MessageComponentTypes.SELECT_MENU,
        placeholder: 'Ganti halaman',
        run: ({ handler, interaction }) => interaction.isSelectMenu() && (handler.index = parseInt(interaction.values[0], 10))
    };

    /**
     * The reasons sent by {@link InteractionCollector} event when the message
     * (or its owner) has been deleted.
     */
    public static deletionStopReasons = ['messageDelete', 'channelDelete', 'guildDelete'];

    /**
     * The current {@link InteractionCollector} handlers that are active.
     * The key is the ID of of the author who sent the message that triggered this {@link PaginatedComponentMessage}
     *
     * This is to ensure that any given author can only trigger 1 {@link PaginatedComponentMessage}.
     * This is important for performance reasons, and users should not have more than 1 {@link PaginatedComponentMessage} open at once.
     */
    public static handlers = new Map<string, PaginatedComponentMessage>();
}