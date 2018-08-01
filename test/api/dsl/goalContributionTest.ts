/*
 * Copyright © 2018 Atomist, Inc.
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

import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";
import { InMemoryProject } from "@atomist/automation-client/project/mem/InMemoryProject";
import * as assert from "power-assert";
import { fakePush } from "../../../src/api-helper/test/fakePush";
import {
    enrichGoalSetters,
    goalContributors,
} from "../../../src/api/dsl/goalContribution";
import {
    onAnyPush,
    whenPushSatisfies,
} from "../../../src/api/dsl/goalDsl";
import { MessageGoal } from "../../../src/api/goal/common/MessageGoal";
import { Goal } from "../../../src/api/goal/Goal";
import { Goals } from "../../../src/api/goal/Goals";
import {
    AutofixGoal,
    BuildGoal,
    FingerprintGoal, LockingGoal,
    PushReactionGoal,
    ReviewGoal,
} from "../../../src/api/machine/wellKnownGoals";
import { GoalSetter } from "../../../src/api/mapping/GoalSetter";
import { TestSoftwareDeliveryMachine } from "../../api-helper/TestSoftwareDeliveryMachine";

const SomeGoalSet = new Goals("SomeGoalSet", new Goal({
    uniqueName: "Fred",
    environment: "0-code/", orderedName: "0-Fred",
}));

describe("goalContribution", () => {

    describe("goalContributors", () => {

        it("should set no goals", async () => {
            const gs = goalContributors(whenPushSatisfies(() => false).itMeans("thing").setGoals(SomeGoalSet));
            const p = fakePush();
            const goals: Goals = await gs.mapping(p);
            assert.equal(goals, undefined);
        });

        it("should set goals from one goal", async () => {
            const gs = goalContributors(whenPushSatisfies(() => true).itMeans("thing").setGoals(BuildGoal));
            const p = fakePush();
            const goals: Goals = await gs.mapping(p);
            assert.deepEqual(goals.goals, [BuildGoal]);
            assert.equal(goals.name, "build");
        });

        it("should set goals from one goals", async () => {
            const r = whenPushSatisfies(() => true).setGoals(SomeGoalSet);
            const gs = goalContributors(r);
            const p = fakePush();
            assert.equal(await r.mapping(p), SomeGoalSet);
            const goals: Goals = await gs.mapping(p);
            assert.deepEqual(goals.goals, SomeGoalSet.goals);
            assert.equal(goals.name, "SomeGoalSet");
        });

    });

    describe("enrichGoalSetters", () => {

        it("should set no goals", async () => {
            const gs: GoalSetter = enrichGoalSetters(whenPushSatisfies(() => false).itMeans("thing").setGoals(SomeGoalSet),
                whenPushSatisfies(() => false).setGoals(SomeGoalSet));
            const p = fakePush();
            const goals: Goals = await gs.mapping(p);
            assert.equal(goals, undefined);
        });

        it("should add goal to none", async () => {
            const gs: GoalSetter = enrichGoalSetters(whenPushSatisfies(() => false).itMeans("thing").setGoals(SomeGoalSet),
                whenPushSatisfies(() => true).setGoals(SomeGoalSet));
            const p = fakePush();
            const goals: Goals = await gs.mapping(p);
            assert.deepEqual(goals.goals, SomeGoalSet.goals);
            assert.equal(goals.name, "SomeGoalSet");
        });

        it("should add goal to some", async () => {
            const mg = new MessageGoal("sendSomeMessage", "Sending message");
            const old: GoalSetter = whenPushSatisfies(() => true).itMeans("thing").setGoals(SomeGoalSet);
            const gs: GoalSetter = enrichGoalSetters(old,
                onAnyPush().setGoals(mg));
            const p = fakePush();
            const goals: Goals = await gs.mapping(p);
            assert.deepEqual(goals.goals, SomeGoalSet.goals.concat(mg));
            assert.equal(goals.name, "SomeGoalSet, Sending message");
        });

        it("should add two goals to some", async () => {
            const mg = new MessageGoal("sendSomeMessage", "Sending message");
            const old: GoalSetter = whenPushSatisfies(() => true).itMeans("thing").setGoals(SomeGoalSet);
            let gs: GoalSetter = enrichGoalSetters(old,
                onAnyPush().setGoals(mg));
            gs = enrichGoalSetters(gs,
                onAnyPush().setGoals(FingerprintGoal));
            const p = fakePush();
            const goals: Goals = await gs.mapping(p);
            assert.equal(goals.goals.length, 3);
            assert.deepEqual(goals.goals, SomeGoalSet.goals.concat([mg, FingerprintGoal] as any));
            assert.equal(goals.name, "SomeGoalSet, Sending message, Fingerprint");
        });

        it("should respect sealed goals", async () => {
            const mg = new MessageGoal("sendSomeMessage", "Sending message");
            const old: GoalSetter = whenPushSatisfies(() => true)
                .itMeans("thing")
                .setGoals(SomeGoalSet.andLock());
            const gs: GoalSetter = enrichGoalSetters(old,
                onAnyPush().setGoals(mg));
            const p = fakePush();
            const goals: Goals = await gs.mapping(p);
            assert.deepEqual(goals.goals, SomeGoalSet.goals);
            assert.equal(goals.name, "SomeGoalSet+lock");
        });

        it("should respect sealed goals after adding additional goal", async () => {
            // we create a goal setter that always sets a Fred goal
            const old: GoalSetter = whenPushSatisfies(() => true)
                .itMeans("thing")
                .setGoals(SomeGoalSet);

            // the we create a different goal setter that always sets the MessageGoal + Locks it
            const mg = new MessageGoal("sendSomeMessage", "Sending message");
            const gs: GoalSetter = enrichGoalSetters(old,
                onAnyPush().setGoals([mg, LockingGoal]));
            const gs1 = enrichGoalSetters(gs,
                whenPushSatisfies(async pu => pu.id.owner !== "bar").setGoals(mg));

            const p = fakePush(); // this does not have an owner of "bar" so it does qualify for the MessageGoal above
            const goals: Goals = await gs1.mapping(p); // we match it against the second value of `gs`

            assert.deepEqual(goals.goals, SomeGoalSet.goals.concat([mg] as any)); // and now it has accepted the addition of the MessageGoal

            const barPush = fakePush(InMemoryProject.from(new GitHubRepoRef("bar", "what"))); // but if the owner IS bar
            const barGoals: Goals = await gs1.mapping(barPush); // then it does not get the Message Goal because it doesn't pass the push test.
            assert.deepEqual(barGoals.goals, SomeGoalSet.goals.concat(mg));
        });

    });

    describe("using SDM", () => {

        it("should accept and add with () => true", async () => {
            const sdm = new TestSoftwareDeliveryMachine("test");
            sdm.addGoalContributions(goalContributors(
                onAnyPush().setGoals(new Goals("Checks", ReviewGoal, PushReactionGoal, AutofixGoal))));
            const p = fakePush();
            const goals: Goals = await sdm.pushMapping.mapping(p);
            assert.deepEqual(goals.goals.sort(), [ReviewGoal, PushReactionGoal, AutofixGoal].sort());
            sdm.addGoalContributions(whenPushSatisfies(() => true).setGoals(FingerprintGoal));
            const goals2: Goals = await sdm.pushMapping.mapping(p);
            assert.deepEqual(goals2.goals.sort(), [ReviewGoal, PushReactionGoal, AutofixGoal, FingerprintGoal].sort());
        });

        it("should accept and add with onAnyPush", async () => {
            const sdm = new TestSoftwareDeliveryMachine("test");
            sdm.addGoalContributions(goalContributors(
                onAnyPush().setGoals(new Goals("Checks", ReviewGoal, PushReactionGoal, AutofixGoal))));
            const p = fakePush();
            const goals: Goals = await sdm.pushMapping.mapping(p);
            assert.deepEqual(goals.goals.sort(), [ReviewGoal, PushReactionGoal, AutofixGoal].sort());
            sdm.addGoalContributions(onAnyPush().setGoals(FingerprintGoal));
            const goals2: Goals = await sdm.pushMapping.mapping(p);
            assert.deepEqual(goals2.goals.sort(), [ReviewGoal, PushReactionGoal, AutofixGoal, FingerprintGoal].sort());
        });
    });
});
