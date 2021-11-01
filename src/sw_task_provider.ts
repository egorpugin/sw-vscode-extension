import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

export class SwTaskProvider implements vscode.TaskProvider {
	static swType = 'sw';
	private swPromise: Thenable<vscode.Task[]> | undefined = undefined;

	constructor(workspaceRoot: string) {
		/*const pattern = path.join(workspaceRoot, 'sw.cpp');
		const fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
		fileWatcher.onDidChange(() => this.swPromise = undefined);
		fileWatcher.onDidCreate(() => this.swPromise = undefined);
		fileWatcher.onDidDelete(() => this.swPromise = undefined);*/
	}
	public provideTasks(): Thenable<vscode.Task[]> | undefined {
		if (!this.swPromise) {
			this.swPromise = getSwTasks();
		}
		return this.swPromise;
	}
	public resolveTask(_task: vscode.Task): vscode.Task | undefined {
		return undefined;
	}
}

function exists(file: string): Promise<boolean> {
	return new Promise<boolean>((resolve, _reject) => {
		fs.exists(file, (value) => {
			resolve(value);
		});
	});
}

interface SwTaskDefinition extends vscode.TaskDefinition {
	task: string;
}

async function getSwTasks(): Promise<vscode.Task[]> {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	const result: vscode.Task[] = [];
	if (!workspaceFolders || workspaceFolders.length === 0) {
		return result;
	}
	for (const workspaceFolder of workspaceFolders) {
		const folderString = workspaceFolder.uri.fsPath;
		if (!folderString) {
			continue;
		}
		const swFile = path.join(folderString, 'sw.cpp');
		if (!await exists(swFile)) {
			continue;
		}

        const runExplan = "run execution plan";
		const compilerType = ["gcc", "clang"/*, "msvc"*/];
        const actionType = ["build", "generate", "configure", runExplan, "test"];
        const configurationType = [["debug","d"], ["release","r"], ["release with debug info","rwdi"]]; // msr
        const staticShared = ["static", "shared"];
        for (const compiler of compilerType) {
			for (const action of actionType) {
				for (const configuration of configurationType) {
					for (const stsh of staticShared) {
						var taskName = action + " " + compiler + " " + stsh + " " + configuration[0];
						if (action === runExplan) {
							taskName += " (call after configure)";
						}
						const kind: SwTaskDefinition = {
							type: 'sw',
							task: taskName
						};
						const bname = stsh + "_" + configuration[1];
						var aname = action;
						if (action === runExplan) {
							aname = "build -e";
						}
						var cmd = "sw " + aname +
							" --compiler " + compiler +
							" -" + stsh +
							" --config " + configuration[1] +
							" --config-name " + bname + ""
							;
						if (action === "generate") {
							cmd += " -g pcompdb";
						}
						if (action === "generate" || action === "configure" || action === runExplan) {
							cmd += " --build-name " + bname;
						}
						const task = new vscode.Task(kind, workspaceFolder, taskName, 'sw', new vscode.ShellExecution(cmd), "$gcc");
						result.push(task);
						task.group = vscode.TaskGroup.Build;
						if (action === "test") {
							task.group = vscode.TaskGroup.Test;
						}
					}
				}
			}
		}
	}
	return result;
}
