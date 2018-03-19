/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { HandleCommand } from "@atomist/automation-client";
import { commitToMaster } from "@atomist/automation-client/operations/edit/editModes";
import { SimpleProjectEditor } from "@atomist/automation-client/operations/edit/projectEditor";
import { doWithFiles } from "@atomist/automation-client/project/util/projectUtils";
import { AllJavaFiles } from "@atomist/spring-automation/commands/generator/java/javaProjectUtils";
import { editorCommand, EmptyParameters } from "../../../../handlers/commands/editors/editorCommand";
import { OptionalBranchParameters } from "../support/OptionalBranchParameters";

/**
 * Harmlessly modify a TS file on master
 * @type {HandleCommand<EditOneOrAllParameters>}
 */
export const whackHeaderEditor: HandleCommand = editorCommand(
    () => whackSomeHeader,
    "removeHeader",
    OptionalBranchParameters,
    {
        editMode: commitToMaster(`Who needs all these extra characters`),
        intent: "remove a header"
    },
);


const HeaderRegex = /^\/\*[\s\S]*?\*\/\s*/;

const whackSomeHeader: SimpleProjectEditor = (p, ctx) => {
    let count = 0;
    return doWithFiles(p, "src/**/*.ts", async f => {
        const fileContent = await f.getContent();
        if (!fileContent.match(HeaderRegex)) {
            return;
        }
        if (count++ >= 1) {
            return;
        }
        await ctx.messageClient.respond(`Removing a header from ${f.path}`);
        return f.setContent(fileContent.replace(HeaderRegex, ""));
    });
};
