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

import { GitHubRepoRef } from "@atomist/automation-client/lib/operations/common/GitHubRepoRef";
import { InMemoryProject } from "@atomist/automation-client/lib/project/mem/InMemoryProject";
import { Project } from "@atomist/automation-client/lib/project/Project";
import * as assert from "power-assert";
import {
    allPredicatesSatisfied,
    anyPredicateSatisfied,
    notPredicate,
} from "../../../../lib/api/mapping/support/projectPredicateUtils";
import {
    BigProject,
    FalseProjectPredicate,
    TrueProjectPredicate,
} from "./pushTestUtils.test";

const id = new GitHubRepoRef("atomist", "github-sdm");

describe("projectPredicatesUtilsTest", () => {

    describe("not", () => {

        it("should handle one true", async () => {
            const r = await notPredicate(TrueProjectPredicate)({ id } as any as Project);
            assert(!r);
        });

        it("should handle one false", async () => {
            const r = await notPredicate(FalseProjectPredicate)({ id } as any as Project);
            assert(r);
        });

    });

    describe("allPredicatesSatisfied", () => {

        it("should handle one true", async () => {
            const r = await allPredicatesSatisfied(TrueProjectPredicate)({ id } as any as Project);
            assert(r);
        });

        it("should handle two true", async () => {
            const r = await allPredicatesSatisfied(TrueProjectPredicate, TrueProjectPredicate)({ id } as any as Project);
            assert(r);
        });

        it("should handle one true and one false", async () => {
            const r = await allPredicatesSatisfied(TrueProjectPredicate, FalseProjectPredicate)({ id } as any as Project);
            assert(!r);
        });

        it("should handle one true and one false, and not evaluate slow predicate that will fail", async () => {
            const r = await allPredicatesSatisfied(
                TrueProjectPredicate,
                FalseProjectPredicate,
                BigProject)({ id } as any as Project);
            assert(!r);
        });

        it("should eventually evaluate slow predicate", async () => {
            const p = InMemoryProject.from(id);
            for (let i = 0; i < 500; i++) {
                p.addFileSync(`path-${i}`, "content");
            }
            const r = await allPredicatesSatisfied(
                TrueProjectPredicate,
                BigProject)(p);
            assert(r);
        });
    });

    describe("anyPredicateSatisfied", () => {

        it("should handle one true", async () => {
            const r = await anyPredicateSatisfied(TrueProjectPredicate)({ id } as any as Project);
            assert(r);
        });

        it("should handle two true", async () => {
            const r = await anyPredicateSatisfied(TrueProjectPredicate, TrueProjectPredicate)({ id } as any as Project);
            assert(r);
        });

        it("should handle one true and one false", async () => {
            const r = await anyPredicateSatisfied(TrueProjectPredicate, FalseProjectPredicate)({ id } as any as Project);
            assert(r);
        });

        it("should handle two false", async () => {
            const r = await anyPredicateSatisfied(FalseProjectPredicate, FalseProjectPredicate)({ id } as any as Project);
            assert(!r);
        });

    });

});
