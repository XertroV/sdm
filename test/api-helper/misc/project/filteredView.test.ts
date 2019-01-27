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

import {
    AllFiles,
    GitCommandGitProject,
    GitHubRepoRef,
    projectUtils,
} from "@atomist/automation-client";

import * as assert from "power-assert";

import { filteredView } from "../../../../lib/api-helper/misc/project/filteredView";

describe("filteredView", () => {

    it("should suppress sync method", async () => {
        // tslint:disable-next-line:no-null-keyword
        const p = await GitCommandGitProject.cloned({ token: null }, new GitHubRepoRef("atomist-seeds", "spring-rest-seed"));
        const filtered = filteredView(p, path => path === "pom.xml");
        assert.throws(() => filtered.addFileSync("x", "y"));
    }).timeout(10000);

    it("should not filter anything", async () => {
        // tslint:disable-next-line:no-null-keyword
        const p = await GitCommandGitProject.cloned({ token: null }, new GitHubRepoRef("atomist-seeds", "spring-rest-seed"));
        const filtered = filteredView(p, path => true);
        assert.equal(await p.totalFileCount(), await filtered.totalFileCount());
    }).timeout(10000);

    it("should copy one", async () => {
        // tslint:disable-next-line:no-null-keyword
        const p = await GitCommandGitProject.cloned({ token: null }, new GitHubRepoRef("atomist-seeds", "spring-rest-seed"));
        const filtered = filteredView(p, path => path === "pom.xml");
        assert.equal(1, await filtered.totalFileCount());
        await filtered.findFile("pom.xml");
    }).timeout(10000);

    it("should find files", async () => {
        // tslint:disable-next-line:no-null-keyword
        const p = await GitCommandGitProject.cloned({ token: null }, new GitHubRepoRef("atomist-seeds", "spring-rest-seed"));
        const filtered = filteredView(p, path => path === "pom.xml");
        const r = await projectUtils.gatherFromFiles(filtered, AllFiles, async f => f.path);
        assert.deepEqual(r, ["pom.xml"]);
    }).timeout(10000);

});
