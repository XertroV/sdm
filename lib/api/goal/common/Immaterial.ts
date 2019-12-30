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

import { Success } from "@atomist/automation-client/lib/HandlerResult";
import { logger } from "@atomist/automation-client/lib/util/logger";
import {
    goals,
    Goals,
} from "../Goals";
import { GoalWithFulfillment } from "../GoalWithFulfillment";

/**
 * Goal that should be scheduled for immaterial changes.
 * Uses a no-op goalExecutor.
 */
export const Immaterial = new GoalWithFulfillment({
    uniqueName: "nevermind",
    displayName: "immaterial",
    completedDescription: "No material changes",
}).with({
    name: "immaterial",
    goalExecutor: async () => {
        logger.debug("Immaterial: Nothing to execute");
        return Success;
    },
});

/**
 * Goals instance for Immaterial changes
 */
export const ImmaterialGoals: Goals = goals("Immaterial change").plan(Immaterial);
