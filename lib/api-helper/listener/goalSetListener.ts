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

import { QueryNoCacheOptions } from "@atomist/automation-client/lib/spi/graph/GraphClient";
import { logger } from "@atomist/automation-client/lib/util/logger";
import * as _ from "lodash";
import { GoalCompletionListener } from "../../api/listener/GoalCompletionListener";
import { SdmGoalSetForId } from "../../typings/types";
import {
    goalSetState,
    storeGoalSet,
} from "../goal/storeGoals";

/**
 * Update the state of the SdmGoalSet as the goals progress
 * @param gcl
 */
export const GoalSetGoalCompletionListener: GoalCompletionListener = async gcl => {
    const state = goalSetState(gcl.allGoals || []);

    logger.debug(`GoalSet '${gcl.completedGoal.goalSetId}' now in state '${state}' because goal '${
        gcl.completedGoal.uniqueName}' was '${gcl.completedGoal.state}'`);

    const result = await gcl.context.graphClient.query<SdmGoalSetForId.Query, SdmGoalSetForId.Variables>({
        name: "SdmGoalSetForId",
        variables: {
            goalSetId: [gcl.completedGoal.goalSetId],
        },
        options: QueryNoCacheOptions,
    });
    const goalSet = _.get(result, "SdmGoalSet[0]");
    if (!!goalSet) {
        if (goalSet.state !== state) {
            const newGoalSet = {
                ...goalSet,
                state,
            };

            await storeGoalSet(gcl.context, newGoalSet);
        }
    }
};
