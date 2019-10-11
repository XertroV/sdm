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
    Project,
    ProjectFile,
} from "@atomist/automation-client";
import { FileStream } from "@atomist/automation-client/lib/project/Project";
import { AbstractProject } from "@atomist/automation-client/lib/project/support/AbstractProject";
import * as stream from "stream";

/**
 * Create a filtered view of the given project.
 * Changes to the filtered view will affect the source project.
 * @param {LocalProject} p
 * @param filter function to filter file paths. Return true to eliminate a file
 * @return {Promise<LocalProject>}
 */
export function filteredView<P extends Project = Project>(p: Project,
                                                          filter: (path: string) => boolean): P {
    // Use an ES6 proxy to bring back memories of Spring AOP
    const handler = {
        get: (target, prop) => {
            const decorator = new FilteredProject(target as AbstractProject, filter);
            if (prop.endsWith("Sync")) {
                throw new Error("Don't use sync methods: had " + prop);
            }
            const origMethod = target[prop];
            if (typeof origMethod !== "function") {
                return origMethod;
            }
            const decoratedMethod = decorator[prop];
            return function(...args: any[]): any {
                return !!decoratedMethod ?
                    decoratedMethod.apply(decorator, args) :
                    // tslint:disable-next-line:no-invalid-this
                    origMethod.apply(this, args);
            };
        },
    };
    return new Proxy(p, handler);
}

/**
 * This relies on the implementation of AbstractProject,
 * where overriding streamFilesRaw does most of what we need
 */
class FilteredProject implements Partial<Project> {

    constructor(private readonly project: Project,
                private readonly  filter: (path: string) => boolean) {
    }

    public getFile(path: string): Promise<ProjectFile | undefined> {
        return this.filter(path) ?
            this.project.getFile(path) :
            undefined;
    }

    public findFile(path: string): Promise<ProjectFile> {
        if (this.filter(path)) {
            return this.project.findFile(path);
        }
        throw new Error(`No file at ${path}`);
    }

    public async getFiles(globPatterns: string | string[] = []): Promise<ProjectFile[]> {
        const files = await this.project.getFiles(globPatterns);
        return files.filter(f => this.filter(f.path));
    }

    /**
     * This method is used by most of the others, such as totalFileCount
     * @param {string[]} globPatterns
     * @param {{}} opts
     * @return {FileStream}
     */
    public streamFilesRaw(globPatterns: string[], opts: {}): FileStream {
        const filter = this.filter;
        const onlyIncludedFilters = new stream.Transform({objectMode: true});
        onlyIncludedFilters._transform = function(f: any, encoding: string, done: stream.TransformCallback): void {
            if (filter(f.path)) {
                this.push(f);
            }
            done();
        };
        return this.project.streamFilesRaw(globPatterns, opts)
            .pipe(onlyIncludedFilters);
    }

}
