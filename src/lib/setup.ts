// Unless explicitly defined, set NODE_ENV as development:
process.env.NODE_ENV ??= 'development';

import '@sapphire/plugin-api/register';
import '@sapphire/plugin-logger/register';
import 'reflect-metadata';

import * as colorette from 'colorette';
import { config } from 'dotenv-cra';
import { join } from 'path';
import { inspect } from 'util';

import { srcDir } from './constants';
import { container } from '@sapphire/framework';
import { MusicCommandCacheManager } from './commands/Music/MusicCommandCacheManager';

// Read env var
config({ path: join(srcDir, '.env') });

// Set default inspection depth
inspect.defaultOptions.depth = 1;

// Enable colorette
colorette.createColors({ useColor: true });

// Extend container for music command data
container.musicCommandCache = new MusicCommandCacheManager();

declare module '@sapphire/pieces' {
    interface Container {
        musicCommandCache: MusicCommandCacheManager
    }
}
