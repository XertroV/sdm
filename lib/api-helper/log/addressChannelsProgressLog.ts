/*
 * Copyright © 2019 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { HandlerContext } from "@atomist/automation-client/lib/HandlerContext";
import {
    addressChannelsFor,
    HasChannels,
} from "../../api/context/addressChannels";
import { ProgressLog } from "../../spi/log/ProgressLog";
import { format } from "./format";

/**
 * Stream the ProgressLog output to any channels associated
 * with the current model element (such a repo) in Slack or elswhere.
 * @param name name for the log. Should relate to the activity we're logging
 * @param {HasChannels} hasChannels
 * @param {HandlerContext} ctx
 * @return {ProgressLog}
 */
export function addressChannelsProgressLog(name: string, hasChannels: HasChannels, ctx: HandlerContext): ProgressLog {
    const add = addressChannelsFor(hasChannels, ctx);
    return {
        name,
        isAvailable: async () => !!hasChannels.channels && hasChannels.channels.length > 0,
        async write(msg: string, ...args: string[]): Promise<void> {
            await add(format(msg, ...args));
        },
        flush(): Promise<void> { return Promise.resolve(); },
        close(): Promise<void> { return Promise.resolve(); },
    };
}
