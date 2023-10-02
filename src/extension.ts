import { ExtensionContext, Range, TextDocumentChangeReason, TextEditorDecorationType, window, workspace } from "vscode"

const BUFFER_LENGTH = 50
const SUPPORTED_LANGS = ["csharp", "json", "jsonl", "jsonc", "javascript", "javascriptreact", "typescript", "typescriptreact"]
let UPDATE_DECORATIONS_IF_BUFFER_ELAPSED_STATE: boolean = false
let UPDATE_DECORATIONS_WITH_DELAY_TIMEOUT: NodeJS.Timeout = undefined
let DECORATOR_TYPE: TextEditorDecorationType = null!

function Update_Decorations(): void
{
    const text_editor = window.activeTextEditor

    if (!SUPPORTED_LANGS.includes(text_editor.document.languageId)) return

    let first_target_line = Math.max(0, text_editor.visibleRanges[0].start.line - BUFFER_LENGTH)
    let last_target_line = Math.min(text_editor.document.lineCount, text_editor.visibleRanges[0].end.line + BUFFER_LENGTH)

    const text = text_editor.document.getText()
    const fold_Ranges: Range[] = []

    for (let underscore_offset = text.indexOf("_"); underscore_offset != -1; underscore_offset = text.indexOf("_", underscore_offset + 1))
    {
        const fold_start_position = text_editor.document.positionAt(underscore_offset)
        const fold_end_position = text_editor.document.positionAt(underscore_offset + 1)
        if (first_target_line > fold_start_position.line || fold_end_position.line > last_target_line) continue

        const fold_range = new Range(fold_start_position, fold_end_position)

        // Only replace underscore if character is not part of current selection
        if (!text_editor.selection.contains(fold_range) && !text_editor.selections.find(s => fold_range.contains(s)))
        {
            fold_Ranges.push(fold_range)
        }
    }

    text_editor.setDecorations(DECORATOR_TYPE, fold_Ranges)
}

/**
* Update decorations if this method hasn't been called in tha last 100ms.
*/
function Update_Decorations_If_Buffer_Elapsed(): void
{
    if (!UPDATE_DECORATIONS_IF_BUFFER_ELAPSED_STATE)
    {
        UPDATE_DECORATIONS_IF_BUFFER_ELAPSED_STATE = true
        setTimeout(() => UPDATE_DECORATIONS_IF_BUFFER_ELAPSED_STATE = false, 100)
        Update_Decorations()
    }
}

/**
* Update decorations 100ms from now. If decorations are already scheduled to
* update, delay them an additional 100ms.
*/
function Update_Decorations_With_Delay(): void
{
    if (!!UPDATE_DECORATIONS_WITH_DELAY_TIMEOUT) clearTimeout(UPDATE_DECORATIONS_WITH_DELAY_TIMEOUT)
    UPDATE_DECORATIONS_WITH_DELAY_TIMEOUT = setTimeout(() => Update_Decorations(), 100)
}

function Create_Decorator_Type(): void
{
    let alt_underscore = workspace.getConfiguration().get<string>("altUnderscore")

    if (typeof alt_underscore != "string" || alt_underscore.length != 1)
    {
        window.showErrorMessage("Invalid alternate underscore character: " + JSON.stringify(alt_underscore) + ". Must be single character string.")
        alt_underscore = "_"
    }
    else
    {
        window.showInformationMessage("Using alternate underscore character: \"" + alt_underscore + "\"")
    }

    DECORATOR_TYPE = window.createTextEditorDecorationType
    ({
        before:
        {
            contentText: alt_underscore
        },
        textDecoration: "none; display: none;"
    })
}

export function activate(context: ExtensionContext): void
{
    Create_Decorator_Type()
    Update_Decorations_If_Buffer_Elapsed()

    context.subscriptions.push
    (
        // On cursor move or selection alteration...
        window.onDidChangeTextEditorSelection(() => Update_Decorations_If_Buffer_Elapsed()),
        // On switch active editor...
        window.onDidChangeActiveTextEditor((e) => !!e && Update_Decorations_With_Delay()),
        // On editor scrolled or size changed...
        window.onDidChangeTextEditorVisibleRanges((e) => !!e.textEditor && Update_Decorations_With_Delay()),
        // On text altered due to undo or redo...
        workspace.onDidChangeTextDocument((e) => (e.reason === TextDocumentChangeReason.Undo || e.reason === TextDocumentChangeReason.Redo) && Update_Decorations_With_Delay()),
        // On extension config updated...
        workspace.onDidChangeConfiguration((e) => Create_Decorator_Type())
    )
}