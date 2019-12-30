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

import * as assert from "assert";
import * as _ from "lodash";
import {
    onAnyPush,
    whenPushSatisfies,
} from "../../../lib/api/dsl/goalDsl";
import { ExecuteGoal } from "../../../lib/api/goal/GoalInvocation";
import { Goals } from "../../../lib/api/goal/Goals";
import { goal } from "../../../lib/api/goal/GoalWithFulfillment";
import { PushTest } from "../../../lib/api/mapping/PushTest";
import {
    allSatisfied,
    anySatisfied,
} from "../../../lib/api/mapping/support/pushTestUtils";
import { TestSoftwareDeliveryMachine } from "../../api-helper/TestSoftwareDeliveryMachine";
import {
    EmptyGoalPrediction,
    MappingPrediction,
    predictGoals,
} from "./predictGoals";
import {
    FalsePushTest,
    TruePushTest,
} from "./support/pushTestUtils.test";

function goalsToNames(gp: MappingPrediction<Goals>): {
    definiteGoalNames: string[], possibleGoalNames: string[], unknownRoads: Array<{
        name: string,
        reason: string,
    }>,
} {
    return {
        definiteGoalNames: _.flatten(gp.definiteGoals.map(gg => gg.goals.map(g => g.name))),
        possibleGoalNames: _.flatten(gp.possibleGoals.map(gg => gg.goals.map(g => g.name))),
        unknownRoads: gp.unknownRoads,
    };
}

const EmptyGoalNames = {
    definiteGoalNames: [],
    possibleGoalNames: [],
    unknownRoads: [],
};

describe("making use of the pushMap structure", async () => {
    const doNothing: ExecuteGoal = async () => { // do nothing
    };
    const myGoal = goal({ displayName: "myGoal" }, doNothing);
    const anotherGoal = goal({ displayName: "anotherGoal" }, doNothing);
    const notSetGoal = goal({ displayName: "notSetGoal" }, doNothing);

    it("Can see that obvious goals will be returned", async () => {
        const sdm = new TestSoftwareDeliveryMachine("test goal setting structure",
            onAnyPush().setGoals(myGoal));

        const result = goalsToNames(await predictGoals(sdm, {}));

        assert.deepStrictEqual(result, {
            definiteGoalNames: [myGoal.name],
            possibleGoalNames: [],
            unknownRoads: [],
        });
    });

    const LooksAtPush: PushTest = { name: "looks at push", mapping: async pli => !!pli.push };

    it("Can guess at a push-dependent test", async () => {
        const sdm = new TestSoftwareDeliveryMachine("test goal setting structure",
            whenPushSatisfies(LooksAtPush).setGoals(myGoal));

        const result = goalsToNames(await predictGoals(sdm, {}));

        assert.deepStrictEqual(result, { ...EmptyGoalNames, possibleGoalNames: [myGoal.name] });
    });

    it("Skips over a definitely-unmatching PushRule", async () => {
        const sdm = new TestSoftwareDeliveryMachine("test goal setting structure",
            whenPushSatisfies(FalsePushTest).setGoals(notSetGoal),
            whenPushSatisfies(TruePushTest).setGoals(myGoal));

        const result = goalsToNames(await predictGoals(sdm, {}));

        assert.deepStrictEqual(result, {
            definiteGoalNames: [myGoal.name],
            possibleGoalNames: [],
            unknownRoads: [],
        });
    });

    it("Reports all goals as possible when PushRules are undetermined", async () => {
        const sdm = new TestSoftwareDeliveryMachine("test goal setting structure",
            whenPushSatisfies(LooksAtPush).setGoals(anotherGoal),
            whenPushSatisfies(TruePushTest).setGoals(myGoal));

        const result = await predictGoals(sdm, {});

        assert(result.definiteGoals.length === 0, "No definite goals");

        const possibleGoalNames = result.possibleGoals.map(g => g.name).sort();
        assert.deepStrictEqual(possibleGoalNames,
            [anotherGoal.name, myGoal.name]);
    });

    it("Reports that it cannot follow a custom PushRule", async () => {
        const sdm = new TestSoftwareDeliveryMachine("test goal setting structure",
            [{
                name: "My custom goal setter",
                mapping: async pli => {
                    if (pli.push) {
                        return new Goals("this is mysterious");
                    }
                    return undefined;
                },
            }]);

        const result = await predictGoals(sdm, {});

        assert.deepStrictEqual(result,
            {
                ...EmptyGoalPrediction,
                unknownRoads: [{ name: "My custom goal setter", reason: "push" }],
            });
    });

    it("Stops after a matching PushRules", async () => {
        const sdm = new TestSoftwareDeliveryMachine("test goal setting structure",
            whenPushSatisfies(TruePushTest).setGoals(myGoal),
            whenPushSatisfies(TruePushTest).setGoals(notSetGoal));

        const result = goalsToNames(await predictGoals(sdm, {}));

        assert.deepStrictEqual(result, {
            ...EmptyGoalNames,
            definiteGoalNames: [myGoal.name],
        });
    });

    it("Can drill down and notice that and(ERROR, false) == false", async () => {
        const sdm = new TestSoftwareDeliveryMachine("test goal setting structure",
            whenPushSatisfies(allSatisfied(LooksAtPush, FalsePushTest)).setGoals(notSetGoal),
            whenPushSatisfies(TruePushTest).setGoals(myGoal));

        const result = goalsToNames(await predictGoals(sdm, {}));

        assert.deepStrictEqual(result, {
            definiteGoalNames: [myGoal.name],
            possibleGoalNames: [],
            unknownRoads: [],
        });
    });

    it("Can drill down and notice that or(ERROR, true) == true", async () => {
        const sdm = new TestSoftwareDeliveryMachine("test goal setting structure",
            whenPushSatisfies(anySatisfied(LooksAtPush, TruePushTest)).setGoals(myGoal),
            whenPushSatisfies(TruePushTest).setGoals(notSetGoal));

        const result = goalsToNames(await predictGoals(sdm, {}));

        assert.deepStrictEqual(result, {
            definiteGoalNames: [myGoal.name],
            possibleGoalNames: [],
            unknownRoads: [],
        });
    });

    it("works with AdditiveGoalSetter", async () => {
        const sdm = new TestSoftwareDeliveryMachine("test goal setting structure");
        sdm.withPushRules(
            whenPushSatisfies(anySatisfied(LooksAtPush, TruePushTest)).setGoals(myGoal));
        sdm.withPushRules(whenPushSatisfies(TruePushTest).setGoals(anotherGoal),
            whenPushSatisfies(FalsePushTest, LooksAtPush).setGoals(notSetGoal));

        const result = goalsToNames(await predictGoals(sdm, {}));

        assert.deepStrictEqual(result, {
            definiteGoalNames: [myGoal.name, anotherGoal.name],
            possibleGoalNames: [],
            unknownRoads: [],
        });
    });

    it("can give me all the goals with duplicates removed and preconditions populated");

});
