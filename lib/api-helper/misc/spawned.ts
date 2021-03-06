/*
 * Copyright © 2020 Atomist, Inc.
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

import {
    ChildProcessResult,
    spawnAndWatch as clientSpawnAndWatch,
    SpawnCommand,
    SpawnWatchOptions,
} from "@atomist/automation-client/lib/util/spawn";
import { SpawnOptions } from "child_process";
import { ProgressLog } from "../../spi/log/ProgressLog";
import { sdmGoalTimeout } from "../goal/sdmGoal";
import { DelimitedWriteProgressLogDecorator } from "../log/DelimitedWriteProgressLogDecorator";

/* tslint:disable:deprecation */

/**
 * Spawn a process and watch
 * @param {SpawnCommand} spawnCommand
 * @param options options
 * @param {ProgressLog} log
 * @param {Partial<SpawnWatchOptions>} spOpts
 * @return {Promise<ChildProcessResult>}
 * @deprecated use spawnAndLog
 */
export async function spawnAndWatch(spawnCommand: SpawnCommand,
                                    options: SpawnOptions,
                                    log: ProgressLog,
                                    spOpts: Partial<SpawnWatchOptions> = {}): Promise<ChildProcessResult> {
    const delimitedLog = new DelimitedWriteProgressLogDecorator(log, "\n");

    // Set the goal default timeout to 10mins
    if (!spOpts.timeout) {
        spOpts.timeout = sdmGoalTimeout();
    }

    return clientSpawnAndWatch(spawnCommand, options, delimitedLog, spOpts);
}
