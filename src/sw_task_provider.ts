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

	action: string; // build, generate, configure, run explan etc.
	compiler: string;
	configuration: string;
	libraries: string; // static, shared
	buildCurrentFile: boolean;
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

		//
		{
			const taskName = "build current file (last configuration)";
			const kind: SwTaskDefinition = {
				type: 'sw',
				task: taskName,
				action: "build",
				compiler: "",
				configuration: "",
				libraries: "",
				buildCurrentFile: true
			};
			var cmd = "sw build -sfc -el --file ${file}";
			const task = new vscode.Task(kind, workspaceFolder, taskName, 'sw', new vscode.ShellExecution(cmd), "$gcc");
			result.push(task);
			task.group = vscode.TaskGroup.Build;
		}

		//
        const runExplan = "run execution plan";
		const compilerType = ["gcc", "clang"/*, "msvc"*/];
        const actionType = ["build", "generate", "configure", runExplan, "test"];
        const configurationType = [["debug","d"], ["release","r"], ["release with debug info","rwdi"]]; // msr
        const staticShared = ["static", "shared"];
        for (const compiler of compilerType) {
			for (const configuration of configurationType) {
				for (const stsh of staticShared) {
					var build_cmd;
					var generate_cmd;
					var configure_cmd;
					for (const action of actionType) {
						var addBuildCurrentFileOption = [false];
						if (action === runExplan) {
							addBuildCurrentFileOption = [true, false];
						}
						for (const buildCurrentFile of addBuildCurrentFileOption) {
							var taskName = action + " " + compiler + " " + stsh + " " + configuration[0];
							if (action === runExplan) {
								taskName += " (call after configure)";
							}
							if (buildCurrentFile) {
								taskName += " (build current file)";
							}
							const kind: SwTaskDefinition = {
								type: 'sw',
								task: taskName,
								action: action,
								compiler: compiler,
								configuration: configuration[0],
								libraries: stsh,
								buildCurrentFile: buildCurrentFile
							};
							const bname = compiler + "_" + stsh + "_" + configuration[1];
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
								cmd += " -g compdb --local-targets-only --compdb-symlink";
							}
							if (action === "generate" || action === "configure" || action === runExplan) {
								cmd += " --build-name " + bname;
							}
							if (buildCurrentFile) {
								cmd += " --file \"${file}\"";
							}
							const task = new vscode.Task(kind, workspaceFolder, taskName, 'sw', new vscode.ShellExecution(cmd), "$gcc");
							result.push(task);
							task.group = vscode.TaskGroup.Build;
							if (action === "test") {
								task.group = vscode.TaskGroup.Test;
							}
							if (action === "build") {
								build_cmd = cmd;
							}
							if (action === "generate") {
								generate_cmd = cmd;
							}
							if (action === "configure") {
								configure_cmd = cmd;
							}
						}
					}

					const taskName2 = "prepare for vs code" + " " + compiler + " " + stsh + " " + configuration[0];
					const action = "prepare_for_vs_code";
					const kind: SwTaskDefinition = {
						type: 'sw',
						task: taskName2,
						action: action,
						compiler: compiler,
						configuration: configuration[0],
						libraries: stsh,
						buildCurrentFile: false
					};
					const task = new vscode.Task(kind, workspaceFolder, taskName2, 'sw',
						new vscode.ShellExecution(build_cmd + " && " + generate_cmd + " && " + configure_cmd), "$gcc");
					result.push(task);
					task.group = vscode.TaskGroup.Build;
				}
			}
		}
	}
	return result;
}
