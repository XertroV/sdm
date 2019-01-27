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

import {
    GitHubRepoRef,
    InMemoryProject,
} from "@atomist/automation-client";
import * as assert from "power-assert";
import {
    CachingProjectLoader,
    save,
} from "../../../lib/api-helper/project/CachingProjectLoader";
import { SingleProjectLoader } from "../../../lib/api-helper/testsupport/SingleProjectLoader";

describe("cachingProjectLoader", () => {

    it("should load project", async () => {
        const id = new GitHubRepoRef("a", "b", "master");
        const p = InMemoryProject.from(id);
        const pl = new SingleProjectLoader(p);
        const cp = new CachingProjectLoader(pl);
        const p1 = await save(cp, {id, credentials: undefined, readOnly: true});
        assert(p1 as any === p);
    });

});
