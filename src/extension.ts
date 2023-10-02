import { ExtensionContext, Range, TextDocumentChangeReason, ThemeColor, window, workspace } from "vscode"

const DECORATOR_TYPE = window.createTextEditorDecorationType(
{
    before:
    {
        contentText: ":",
        color: new ThemeColor("disabledForeground")
    },
    textDecoration: "none; display: none;"
})

const BUFFER_LENGTH = 50
const SUPPORTED_LANGS = ["csharp", "json", "jsonl", "jsonc", "javascript", "javascriptreact", "typescript", "typescriptreact"]
let UPDATE_DECORATIONS_IF_BUFFER_ELAPSED_STATE: boolean = false
let UPDATE_DECORATIONS_WITH_DELAY_TIMEOUT: NodeJS.Timeout = undefined

function UpdateDecorations(): void
{
    const textEditor = window.activeTextEditor

    if (!SUPPORTED_LANGS.includes(textEditor.document.languageId)) return

    let firstTargetLine = Math.max(0, textEditor.visibleRanges[0].start.line - BUFFER_LENGTH)
    let lastTargetLine = Math.min(textEditor.document.lineCount, textEditor.visibleRanges[0].end.line + BUFFER_LENGTH)

    const text = textEditor.document.getText()
    const foldRanges: Range[] = []

    for (let underscoreOffset = text.indexOf("_"); underscoreOffset != -1; underscoreOffset = text.indexOf("_", underscoreOffset + 1))
    {
        const foldStartPosition = textEditor.document.positionAt(underscoreOffset)
        const foldEndPosition = textEditor.document.positionAt(underscoreOffset + 1)
        if (firstTargetLine > foldStartPosition.line || foldEndPosition.line > lastTargetLine) continue

        const foldRange = new Range(foldStartPosition, foldEndPosition)

        // Only replace underscore if character is not part of current selection
        if (!textEditor.selection.contains(foldRange) && !textEditor.selections.find(s => foldRange.contains(s)))
        {
            foldRanges.push(foldRange)
        }
    }

    textEditor.setDecorations(DECORATOR_TYPE, foldRanges)
}

/**
* Update decorations if this method hasn't been called in tha last 100ms.
*/
function UpdateDecorationsIfBufferElapsed(): void
{
    if (!UPDATE_DECORATIONS_IF_BUFFER_ELAPSED_STATE)
    {
        UPDATE_DECORATIONS_IF_BUFFER_ELAPSED_STATE = true
        setTimeout(() => UPDATE_DECORATIONS_IF_BUFFER_ELAPSED_STATE = false, 100)
        UpdateDecorations()
    }
}

/**
* Update decorations 100ms from now. If decorations are already scheduled to
* update, delay them an additional 100ms.
*/
function UpdateDecorationsWithDelay(): void
{
    if (!!UPDATE_DECORATIONS_WITH_DELAY_TIMEOUT) clearTimeout(UPDATE_DECORATIONS_WITH_DELAY_TIMEOUT)
    UPDATE_DECORATIONS_WITH_DELAY_TIMEOUT = setTimeout(() => UpdateDecorations(), 100)
}

export function activate(context: ExtensionContext): void
{
    UpdateDecorationsIfBufferElapsed()
    context.subscriptions.push
    (
        //On cursor move or selection alteration...
        window.onDidChangeTextEditorSelection(() => UpdateDecorationsIfBufferElapsed()),
        //On switch active editor...
        window.onDidChangeActiveTextEditor((e) => !!e && UpdateDecorationsWithDelay()),
        //On editor scrolled or size changed...
        window.onDidChangeTextEditorVisibleRanges((e) => !!e.textEditor && UpdateDecorationsWithDelay()),
        //On text altered due to undo or redo...
        workspace.onDidChangeTextDocument((e) => (e.reason === TextDocumentChangeReason.Undo || e.reason === TextDocumentChangeReason.Redo) && UpdateDecorationsWithDelay())
    )
}

export function deactivate(context: ExtensionContext): void
{
    context.subscriptions.forEach((d) => d.dispose())
}