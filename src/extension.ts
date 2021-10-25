import * as vscode from 'vscode';
import { SwTaskProvider } from './sw_task_provider';

let swTaskProvider: vscode.Disposable | undefined;

export function activate(context: vscode.ExtensionContext) {
	const workspaceRoot = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
		? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
	if (!workspaceRoot) {
		return;
	}

	swTaskProvider = vscode.tasks.registerTaskProvider(SwTaskProvider.swType, new SwTaskProvider(workspaceRoot));
}

export function deactivate() {
	if (swTaskProvider) {
		swTaskProvider.dispose();
	}
}
